/**
 * AnimController.js
 * Shared animation utilities for GrudgeWorld-Action-RPG.
 *
 * Exports:
 *   retargetAnimGroup(animGroup, skeleton) — bone remapping with 3-stage lookup
 *   AnimController                          — unified animation registry + smooth blending
 */

// ── Bone name normalization ────────────────────────────────────────────────────
// Strip well-known prefixes and collapse separators so Mixamo, Bip001, and
// AutoRig Pro naming conventions can all be compared without exact string matches.
function _normalizeBoneName(name) {
  return name
    .toLowerCase()
    .replace(/^mixamorig[:\s_]*/i, "") // mixamorig:Hips → hips
    .replace(/^bip001[\s_]*/i, "") // Bip001 Spine → spine
    .replace(/[\s_]+/g, "") // collapse spaces / underscores
    .replace(/[.\-]/g, ""); // drop dots and hyphens
}

// Cross-convention alias table.
// Maps a normalized source name (Mixamo, etc.) to the normalized canonical
// name used inside the target skeleton.  Both keys AND values are in the
// fully-normalized form produced by _normalizeBoneName().
const BONE_ALIAS = {
  // Root / pelvis
  hips: "pelvis",
  pelvis: "hips",
  root: "pelvis",

  // Spine
  spine: "spine",
  spine1: "spine1",
  spine2: "spine2",
  chest: "spine2",
  upperchest: "spine2",

  // Neck / Head
  neck: "neck",
  neck1: "neck",
  head: "head",

  // Left arm
  leftshoulder: "lclavicle",
  lclavicle: "leftshoulder",
  leftarm: "lupperarm",
  lupperarm: "leftarm",
  leftforearm: "lforearm",
  lforearm: "leftforearm",
  lefthand: "lhand",
  lhand: "lefthand",

  // Right arm
  rightshoulder: "rclavicle",
  rclavicle: "rightshoulder",
  rightarm: "rupperarm",
  rupperarm: "rightarm",
  rightforearm: "rforearm",
  rforearm: "rightforearm",
  righthand: "rhand",
  rhand: "righthand",

  // Left leg
  leftupleg: "lthigh",
  lthigh: "leftupleg",
  leftleg: "lcalf",
  lcalf: "leftleg",
  leftfoot: "lfoot",
  lfoot: "leftfoot",
  lefttoebase: "ltoe0",
  ltoe0: "lefttoebase",

  // Right leg
  rightupleg: "rthigh",
  rthigh: "rightupleg",
  rightleg: "rcalf",
  rcalf: "rightleg",
  rightfoot: "rfoot",
  rfoot: "rightfoot",
  righttoebase: "rtoe0",
  rtoe0: "righttoebase",

  // Fingers (basic index mapping)
  lefthandindex1: "lfinger0",
  lfinger0: "lefthandindex1",
  righthandindex1: "rfinger0",
  rfinger0: "righthandindex1",
};

/**
 * Build exact-name and normalized-name lookup maps from a Babylon.js Skeleton.
 * @param {BABYLON.Skeleton} skeleton
 * @returns {{ exactMap: Map<string, BABYLON.Bone>, normalizedMap: Map<string, BABYLON.Bone> }}
 */
function _buildBoneLookup(skeleton) {
  const exactMap = new Map();
  const normalizedMap = new Map();
  for (const bone of skeleton.bones) {
    exactMap.set(bone.name, bone);
    const norm = _normalizeBoneName(bone.name);
    if (!normalizedMap.has(norm)) normalizedMap.set(norm, bone); // first match wins
  }
  return { exactMap, normalizedMap };
}

/**
 * Retarget an AnimationGroup to a different skeleton using a 3-stage lookup:
 *   Stage 1 — Exact bone name match
 *   Stage 2 — Normalized name match (strips prefixes, collapses whitespace/separators)
 *   Stage 3 — Cross-convention alias table (Mixamo ↔ Bip001 ↔ AutoRig Pro)
 *
 * Animations that cannot be matched at any stage are left unchanged (silent skip).
 *
 * @param {BABYLON.AnimationGroup} animGroup   — The group to retarget in-place.
 * @param {BABYLON.Skeleton}       skeleton    — Target skeleton whose bones will be used.
 * @returns {number} Number of targeted animations that were successfully remapped.
 */
export function retargetAnimGroup(animGroup, skeleton) {
  const { exactMap, normalizedMap } = _buildBoneLookup(skeleton);
  let matched = 0,
    unmatched = 0;

  for (const ta of animGroup.targetedAnimations) {
    const srcName = ta.target?.name;
    if (!srcName) continue;

    // Stage 1: exact match
    if (exactMap.has(srcName)) {
      ta.target = exactMap.get(srcName);
      matched++;
      continue;
    }

    // Stage 2: normalized match
    const srcNorm = _normalizeBoneName(srcName);
    if (normalizedMap.has(srcNorm)) {
      ta.target = normalizedMap.get(srcNorm);
      matched++;
      continue;
    }

    // Stage 3: alias table — try the normalized source name and its alias
    const aliasNorm = BONE_ALIAS[srcName.toLowerCase()] ?? BONE_ALIAS[srcNorm];
    if (aliasNorm) {
      const bone = normalizedMap.get(aliasNorm) ?? exactMap.get(aliasNorm);
      if (bone) {
        ta.target = bone;
        matched++;
        continue;
      }
    }

    unmatched++;
  }

  if (unmatched > 0) {
    console.debug(
      `[retargetAnimGroup] "${animGroup.name}": ${matched} matched, ${unmatched} unmatched`,
    );
  }
  return matched;
}

// ── AnimController ────────────────────────────────────────────────────────────

/**
 * Unified animation controller for a single skeleton/character.
 *
 * Both the base animation pack and the class-specific animation pack are
 * stored in one Map-based registry.  All play() calls go through a single
 * smooth cross-fade system that cancels any in-flight blend observer before
 * starting a new one — so concurrent observer leaks are impossible.
 *
 * @example
 *   const ctrl = new AnimController(previewScene);
 *   ctrl.registerAll(raceChar._animActions);           // base pack
 *   ctrl.register('ss_idle', classIdleAG);             // class pack
 *   ctrl.play('ss_idle', { loop: true, blendTime: 0.2 });
 *   ctrl.play('idle',    { loop: true, blendTime: 0.15 }); // smooth crossfade
 */
export class AnimController {
  /**
   * @param {BABYLON.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;
    this._registry = new Map(); // key → AnimationGroup
    this._current = null; // currently-playing AnimationGroup
    this._blendObs = null; // active onBeforeRender blend observer (or null)
  }

  // ── Registry ──────────────────────────────────────────────────────────────

  /** Register a named AnimationGroup. Overwrites an existing entry for the same key. */
  register(key, animGroup) {
    this._registry.set(key, animGroup);
  }

  /** Bulk-register from a plain { key: AnimationGroup } object (e.g. raceChar._animActions). */
  registerAll(animMap) {
    for (const [key, ag] of Object.entries(animMap)) {
      this._registry.set(key, ag);
    }
  }

  /** Returns true if the given key exists in the registry. */
  has(key) {
    return this._registry.has(key);
  }

  /**
   * Remove (and optionally dispose) a single animation from the registry.
   * If that animation is currently playing the controller is stopped first.
   *
   * @param {string}  key
   * @param {boolean} [dispose=true]  — Whether to stop+dispose the AnimationGroup.
   */
  unregister(key, dispose = true) {
    const ag = this._registry.get(key);
    if (!ag) return;
    if (this._current === ag) {
      this._cancelBlend();
      this._current = null;
    }
    if (dispose) {
      try {
        ag.stop();
        ag.dispose();
      } catch (_) {}
    }
    this._registry.delete(key);
  }

  /**
   * Unregister multiple keys at once.
   * @param {Iterable<string>} keys
   * @param {boolean} [dispose=true]
   */
  unregisterAll(keys, dispose = true) {
    for (const key of keys) this.unregister(key, dispose);
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  /** Returns true if the given key is the currently active animation. */
  isPlaying(key) {
    const ag = this._registry.get(key);
    return ag != null && ag === this._current;
  }

  /** The key of the currently-playing animation, or null. */
  get currentKey() {
    if (!this._current) return null;
    for (const [k, ag] of this._registry) {
      if (ag === this._current) return k;
    }
    return null;
  }

  /**
   * Play an animation by key with an optional smooth cross-fade from the current one.
   *
   * @param {string} key              — Key registered via register() / registerAll().
   * @param {object} [opts]
   * @param {boolean} [opts.loop=true]        — Loop the animation.
   * @param {number}  [opts.blendTime=0.15]   — Cross-fade duration in seconds (0 = hard cut).
   * @param {number}  [opts.speed=1.0]        — Playback speed ratio.
   */
  play(key, { loop = true, blendTime = 0.15, speed = 1.0 } = {}) {
    const next = this._registry.get(key);
    if (!next) {
      console.warn(`[AnimController] Unknown animation key: "${key}"`);
      return;
    }

    // Already playing this exact animation — no-op.
    if (next === this._current && next.isPlaying) return;

    this._cancelBlend(); // abort any in-flight blend observer

    const prev = this._current;
    this._current = next;

    if (!prev || prev === next || blendTime <= 0) {
      // Hard cut: stop previous immediately, start next at full weight.
      if (prev && prev !== next) {
        prev.setWeightForAllAnimatables(0);
        prev.stop();
      }
      next.start(loop, speed, next.from, next.to, false);
      next.setWeightForAllAnimatables(1);
      return;
    }

    // Smooth cross-fade: ramp next 0 → 1, ramp prev 1 → 0 over blendTime seconds.
    next.start(loop, speed, next.from, next.to, false);
    next.setWeightForAllAnimatables(0);
    prev.setWeightForAllAnimatables(1); // ensure prev starts at full weight

    let elapsed = 0;
    this._blendObs = this._scene.onBeforeRenderObservable.add(() => {
      elapsed += this._scene.getEngine().getDeltaTime() / 1000;
      const t = Math.min(elapsed / blendTime, 1);
      next.setWeightForAllAnimatables(t);
      prev.setWeightForAllAnimatables(1 - t);
      if (t >= 1) {
        prev.stop();
        this._cancelBlend();
      }
    });
  }

  /** Stop all animations immediately and clear the active-animation state. */
  stopAll() {
    this._cancelBlend();
    for (const ag of this._registry.values()) {
      try {
        ag.setWeightForAllAnimatables(0);
        ag.stop();
      } catch (_) {}
    }
    this._current = null;
  }

  /** Dispose all registered AnimationGroups and clean up observers. */
  dispose() {
    this.stopAll();
    for (const ag of this._registry.values()) {
      try {
        ag.dispose();
      } catch (_) {}
    }
    this._registry.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _cancelBlend() {
    if (this._blendObs) {
      this._scene.onBeforeRenderObservable.remove(this._blendObs);
      this._blendObs = null;
    }
  }
}
