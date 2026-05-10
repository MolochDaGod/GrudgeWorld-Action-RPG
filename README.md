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
    .replace(/^mixamorig[:\s_]*/i, '')   // mixamorig:Hips → hips
    .replace(/^bip001[\s_]*/i, '')        // Bip001 Spine → spine
    .replace(/[\s_]+/g, '')               // collapse spaces / underscores
    .replace(/[.\-]/g, '');               // drop dots and hyphens
}

// Cross-convention alias table.
// Maps a normalized source name (Mixamo, etc.) to the normalized canonical
// name used inside the target skeleton.  Both keys AND values are in the
// fully-normalized form produced by _normalizeBoneName().
const BONE_ALIAS = {
  // Root / pelvis
  hips:             'pelvis',
  pelvis:           'hips',
  root:             'pelvis',

  // Spine
  spine:            'spine',
  spine1:           'spine1',
  spine2:           'spine2',
  chest:            'spine2',
  upperchest:       'spine2',

  // Neck / Head
  neck:             'neck',
  neck1:            'neck',
  head:             'head',

  // Left arm
  leftshoulder:     'lclavicle',
  lclavicle:        'leftshoulder',
  leftarm:          'lupperarm',
  lupperarm:        'leftarm',
  leftforearm:      'lforearm',
  lforearm:         'leftforearm',
  lefthand:         'lhand',
  lhand:            'lefthand',

  // Right arm
  rightshoulder:    'rclavicle',
  rclavicle:        'rightshoulder',
  rightarm:         'rupperarm',
  rupperarm:        'rightarm',
  rightforearm:     'rforearm',
  rforearm:         'rightforearm',
  righthand:        'rhand',
  rhand:            'righthand',

  // Left leg
  leftupleg:        'lthigh',
  lthigh:           'leftupleg',
  leftleg:          'lcalf',
  lcalf:            'leftleg',
  leftfoot:         'lfoot',
  lfoot:            'leftfoot',
  lefttoebase:      'ltoe0',
  ltoe0:            'lefttoebase',

  // Right leg
  rightupleg:       'rthigh',
  rthigh:           'rightupleg',
  rightleg:         'rcalf',
  rcalf:            'rightleg',
  rightfoot:        'rfoot',
  rfoot:            'rightfoot',
  righttoebase:     'rtoe0',
  rtoe0:            'righttoebase',

  // Fingers (basic index mapping)
  lefthandindex1:   'lfinger0',
  lfinger0:         'lefthandindex1',
  righthandindex1:  'rfinger0',
  rfinger0:         'righthandindex1',
};

/**
 * Build exact-name and normalized-name lookup maps from a Babylon.js Skeleton.
 * @param {BABYLON.Skeleton} skeleton
 * @returns {{ exactMap: Map<string, BABYLON.Bone>, normalizedMap: Map<string, BABYLON.Bone> }}
 */
function _buildBoneLookup(skeleton) {
  const exactMap      = new Map();
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
  let matched = 0, unmatched = 0;

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
      `[retargetAnimGroup] "${animGroup.name}": ${matched} matched, ${unmatched} unmatched`
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
    this._scene    = scene;
    this._registry = new Map();  // key → AnimationGroup
    this._current  = null;        // currently-playing AnimationGroup
    this._blendObs = null;        // active onBeforeRender blend observer (or null)
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
      try { ag.stop(); ag.dispose(); } catch (_) {}
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

    const prev     = this._current;
    this._current  = next;

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
      try { ag.dispose(); } catch (_) {}
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
    CHAR_SELECT.equip = currentRaceChar?.equipManager?.equipped || {};
    if (typeof SCENE_MANAGER?.navigateTo === "function") {
      SCENE_MANAGER.navigateTo("outdoor");
    }
  });

  // ── Character loading ───────────────────────────────────────────────────
  async function _switchRace(raceId) {
    // Class anim keys are in animCtrl — animCtrl.dispose() (called by
    // currentRaceChar.dispose() below) handles their cleanup.
    _classAnimKeys.clear();

    // Dispose old character
    if (currentRaceChar) {
      currentRaceChar.dispose();
      currentRaceChar = null;
    }

    if (!previewScene) return;

    // Hide the character node completely during load so no partially-loaded
    // or all-variants-stacked geometry is visible while textures / catalog
    // / applyPreset are still in progress.
    if (characterNode) characterNode.setEnabled(false);

    try {
      currentRaceChar = await loadRaceCharacter(
        previewScene,
        raceId,
        characterNode,
        { classId: activeClass },
      );
      // Add shadows
      const sg = previewScene.getLightByID("ccKey")?._shadowGenerators?.[0];
      if (sg) {
        for (const mesh of currentRaceChar.result.meshes)
          sg.addShadowCaster(mesh);
      }
      _updateEquipPanel();
      _updateStats();
      _updateSkillsPanel();
      _loadClassAnims(activeClass);
      _autoFrameCamera();
      autoRotate = true;
      if (DEBUG) _updateDebugOverlay();
    } catch (err) {
      console.error("[character_create] Race load failed:", err);
    } finally {
      // Always re-enable — character is ready (or load failed, show whatever rendered)
      if (characterNode) characterNode.setEnabled(true);
    }
  }

  // ── Debug overlay ────────────────────────────────────────────────
  function _updateDebugOverlay() {
    if (!currentRaceChar || !DEBUG) return;
    let dbg = document.getElementById("cc-debug-overlay");
    if (!dbg) {
      dbg = document.createElement("pre");
      dbg.id = "cc-debug-overlay";
      dbg.style.cssText =
        "position:fixed;top:8px;right:8px;z-index:9999;background:rgba(0,0,0,0.85);" +
        "color:#0f0;font:11px/1.4 monospace;padding:8px 12px;border-radius:6px;max-height:80vh;overflow:auto;pointer-events:none";
      document.body.appendChild(dbg);
    }
    const em = currentRaceChar.equipManager;
    const slots = Object.entries(em.slots)
      .map(([slot, entries]) => {
        const vis = entries
          .filter((e) => e.mesh.isVisible)
          .map((e) => e.variant);
        const eq =
          em.equipped[slot] || em.equipped.weapon?.type === slot
            ? em.equipped[slot] || em.equipped.weapon?.variant
            : "—";
        return `  ${slot.padEnd(12)} variants:[${entries.map((e) => e.variant).join(",")}]  visible:[${vis.join(",") || "—"}]  equipped:${JSON.stringify(em.equipped[slot] ?? (em.equipped.weapon?.type === slot ? em.equipped.weapon?.variant : null) ?? "—")}`;
      })
      .join("\n");
    const visibleMeshes = currentRaceChar.result.meshes
      .filter((m) => m.isVisible)
      .map((m) => m.name);
    const nodeEnabled = characterNode?.isEnabled();
    dbg.textContent = [
      `RACE: ${currentRaceChar.raceId}  CLASS: ${currentRaceChar.classId}  nodeEnabled: ${nodeEnabled}`,
      `Meshes total: ${currentRaceChar.result.meshes.length}  visible: ${visibleMeshes.length}`,
      `Visible: ${visibleMeshes.join(", ") || "(none)"}`,
      ``,
      `Slots:`,
      slots,
    ].join("\n");
  }

  async function _loadClassAnims(classId) {
    // Unregister and dispose any previously-loaded class animations from the
    // shared animCtrl — base animations remain registered and unaffected.
    if (currentRaceChar?.animCtrl) {
      currentRaceChar.animCtrl.unregisterAll(_classAnimKeys);
    }
    _classAnimKeys = new Set();

    const packKey = CLASS_ANIM_MAP[classId];
    const pack = ANIM_CATALOG[packKey];
    if (!pack || !currentRaceChar?.skeleton || !previewScene) return;
    const skeleton = currentRaceChar.skeleton;

    const entries = Object.entries(pack.anims);
    await Promise.allSettled(
      entries.map(async ([animKey, def]) => {
        const fullPath = pack.path + def.file;
        const folder = fullPath.substring(0, fullPath.lastIndexOf("/") + 1);
        const file = fullPath.substring(fullPath.lastIndexOf("/") + 1);
        try {
          const result = await BABYLON.SceneLoader.ImportMeshAsync(
            null,
            folder,
            file,
            previewScene,
          );
          // Always dispose imported meshes — only the animation group is needed.
          for (const m of result.meshes) {
            try {
              m.dispose();
            } catch (_) {}
          }
          const animGroups =
            result.animationGroups || previewScene.animationGroups.slice(-1);
          if (animGroups.length > 0) {
            const ag = animGroups[0];
            ag.name = animKey;
            retargetAnimGroup(ag, skeleton);
            currentRaceChar.animCtrl.register(animKey, ag);
            _classAnimKeys.add(animKey);
          }
        } catch (_) {}
      }),
    );

    _updateAnimGrid();

    // Auto-start the class-specific idle with a smooth blend so both animation
    // tiers cross-fade cleanly through the unified animCtrl.
    const idleKey = CLASS_IDLE_KEY[classId];
    if (idleKey && currentRaceChar?.animCtrl.has(idleKey)) {
      currentRaceChar.animCtrl.play(idleKey, { loop: true, blendTime: 0.2 });
    } else if (currentRaceChar) {
      // Class pack not loaded (e.g. missing GLB files) — fall back to base idle.
      currentRaceChar.animCtrl.play("idle", { loop: true, blendTime: 0.15 });
    }
  }

  // ── UI update helpers ───────────────────────────────────────────────────
  function _updateStats() {
    const container = root.querySelector("#cc-stats");
    if (!container) return;
    const raceData = racesMap[activeRace];
    const classData = classesMap[activeClass];
    const rb = raceData?.bonuses || {};
    const ca = classData?.startingAttributes || {};
    const ATTRS = [
      "Strength",
      "Intellect",
      "Vitality",
      "Dexterity",
      "Endurance",
      "Wisdom",
      "Agility",
      "Tactics",
    ];
    container.innerHTML = ATTRS.map((attr) => {
      const total = (rb[attr] || 0) + (ca[attr] || 0);
      const pct = Math.min((total / 5) * 100, 100);
      return `<div class="cc-stat-row">
        <span class="cc-stat-label">${attr.substring(0, 3).toUpperCase()}</span>
        <div class="cc-stat-bar-wrap"><div class="cc-stat-bar" style="width:${pct}%"></div></div>
        <span class="cc-stat-value">${total}</span>
      </div>`;
    }).join("");
  }

  function _updateEquipPanel() {
    const container = root.querySelector("#cc-equip");
    if (!container || !currentRaceChar) return;
    const summary = currentRaceChar.equipManager.getSummary();
    const classData = classesMap[activeClass];
    const allowed = new Set(
      classData?.weaponTypes || [
        "sword",
        "axe",
        "hammer",
        "bow",
        "staff",
        "spear",
      ],
    );
    const ICONS = {
      body: "👕",
      arms: "🧤",
      legs: "👖",
      head: "⛑",
      shoulders: "🦺",
      sword: "⚔",
      axe: "🪓",
      hammer: "🔨",
      bow: "🏹",
      staff: "🪄",
      shield: "🛡",
      spear: "🗡",
      lance: "🏇",
      mace: "🪃",
      pick: "⛏",
      dagger: "🗡",
      bag: "👜",
      wood: "🪵",
      quiver: "🏹",
    };
    const LABELS = {
      body: "Body",
      arms: "Arms",
      legs: "Legs",
      head: "Helmet",
      shoulders: "Shoulders",
      sword: "Sword",
      axe: "Axe",
      hammer: "Hammer",
      mace: "Mace",
      pick: "Pick",
      bow: "Bow",
      staff: "Staff",
      spear: "Spear",
      lance: "Lance",
      dagger: "Dagger",
      shield: "Shield",
      bag: "Bag",
      wood: "Wood",
      quiver: "Quiver",
    };
    const TIER_LABEL = {
      cloth: "Cloth",
      leather: "Leather",
      metal: "Plate",
      plate: "Plate",
    };

    let h = '<div class="cc-equip-grid">';
    for (const [slot, info] of Object.entries(summary)) {
      if (!info.variants.length) continue;
      const isW = WEAPON_SLOTS.has(slot);
      const locked = isW && !allowed.has(slot);
      const idx = info.variants.indexOf(info.equipped);
      const tierClass = info.equippedTier ? `cc-tier-${info.equippedTier}` : "";
      const tierLabel = info.equippedTier
        ? TIER_LABEL[info.equippedTier] || ""
        : "";
      h += `<div class="cc-equip-slot" ${locked ? 'style="opacity:0.4"' : ""}>
        <span class="cc-equip-icon">${ICONS[slot] || "📦"}</span>
        <span class="cc-equip-label">${LABELS[slot] || slot}${locked ? " 🔒" : ""}</span>
        ${tierLabel ? `<span class="cc-tier-badge ${tierClass}">${tierLabel}</span>` : ""}
        <div class="cc-equip-arrows">
          <button class="cc-eq-prev" data-slot="${slot}" ${locked || idx <= 0 ? "disabled" : ""}>◀</button>
          <span class="cc-equip-current">${idx + 1}/${info.variants.length}</span>
          <button class="cc-eq-next" data-slot="${slot}" ${locked || idx >= info.variants.length - 1 ? "disabled" : ""}>▶</button>
        </div>
      </div>`;
    }
    h += "</div>";
    container.innerHTML = h;
  }

  function _updateSkillsPanel() {
    const container = root.querySelector("#cc-skills");
    if (!container) return;
    const wpn =
      currentRaceChar?.equipManager?.equipped?.weapon?.type || "sword";
    const skills = getSkillDisplayList(wpn, activeClass);
    if (!skills.length) {
      container.innerHTML =
        '<div style="color:#666;font-size:11px;">No weapon</div>';
      return;
    }
    container.innerHTML = skills
      .map((s) => {
        const icon = ELEMENT_ICONS[s.element] || "⚔";
        const color = ELEMENT_COLORS[s.element] || "#b8b8c0";
        const stat = s.heal
          ? `+${s.heal} HP`
          : s.damage
            ? `${s.damage} dmg`
            : "";
        return `<div class="cc-skill-card"><span class="cc-skill-icon" style="color:${color}">${icon}</span>
        <div class="cc-skill-info"><span class="cc-skill-name">${s.name}</span>
        <span class="cc-skill-stat" style="color:${color}">${stat}</span></div></div>`;
      })
      .join("");
  }

  function _updateAnimGrid() {
    const container = root.querySelector("#cc-anims");
    if (!container) return;
    const anims = getAnimsForClass(activeClass);
    container.innerHTML = Object.entries(anims)
      .map(
        ([k, d]) =>
          `<button class="cc-anim-btn" data-anim="${k}">${d.label}</button>`,
      )
      .join("");
    container.querySelectorAll(".cc-anim-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!currentRaceChar) return;
        const key = btn.dataset.anim;
        const def = anims[key];
        const loop = def ? def.loop : true;
        // Both base and class animations live in the same animCtrl registry;
        // play() handles the cross-fade automatically.
        currentRaceChar.animCtrl.play(key, { loop, blendTime: 0.15 });
      });
    });
  }

  // ── Cleanup on scene dispose ────────────────────────────────────────────
  mainScene.onDisposeObservable.add(() => {
    try {
      _ro && _ro.disconnect();
    } catch (_) {}
    try {
      window.removeEventListener("resize", resizePreview);
    } catch (_) {}
    if (previewEngine) {
      previewEngine.stopRenderLoop();
      // currentRaceChar.dispose() calls animCtrl.dispose() which handles all
      // registered animation groups (base + class) cleanly.
      if (currentRaceChar) currentRaceChar.dispose();
      previewScene?.dispose();
      previewEngine.dispose();
    }
    if (root.parentNode) root.parentNode.removeChild(root);
  });

  // ── Initial load ────────────────────────────────────────────────────────
  await _switchRace(activeRace);

  return mainScene;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOM BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function _buildDOM(racesMap, classesMap, initRace, initClass) {
  const root = document.createElement('div');
  root.id = 'grudge-char-create';

  const raceOrder = ['human', 'barbarian', 'elf', 'dwarf', 'orc', 'undead'];

  root.innerHTML = `
    <div class="cc-overlay">
      <div class="cc-panel">
        <div class="cc-header">
          <div class="cc-header-title">
            <h2>Grudge Warlords</h2>
            <span class="cc-header-subtitle">Character Creation</span>
          </div>
        </div>
        <div class="cc-content">
          <div class="cc-preview-col">
            <div class="cc-preview-wrap">
              <canvas id="cc-preview-canvas"></canvas>
            </div>
            <div class="cc-preview-hint">Drag to rotate | Scroll to zoom | Double-click auto-rotate</div>
            <div class="cc-race-section">
              <div class="cc-race-row">
                ${raceOrder.map(rId => {
                  const f = FACTIONS[rId];
                  return `<button class="cc-race-btn ${rId === initRace ? 'active' : ''}" data-race="${rId}">
                    <span class="cc-race-icon" style="background:${f?.color || '#ccc'}"></span>
                    <span class="cc-race-name">${f?.name || rId}</span>
                    <span class="cc-race-desc">${f?.faction || ''}</span>
                  </button>`;
                }).join('')}
              </div>
            </div>
          </div>
          <div class="cc-controls">
            <div class="cc-tab-panels">
              <h3 class="cc-section-label">Character Name</h3>
              <input type="text" id="cc-name-input" class="cc-name-input" placeholder="Enter a name…" maxlength="24" />
              <div class="cc-section-divider"></div>
              <h3 class="cc-section-label">Class</h3>
              <div class="cc-class-row">
                ${Object.entries(classesMap).map(([cId, c]) =>
                  `<button class="cc-class-btn ${cId === initClass ? 'active' : ''}" data-class="${cId}">
                    <span class="cc-class-icon">${c.emoji || '⚔'}</span>
                    <span class="cc-class-name">${c.name}</span>
                    <span class="cc-class-desc">${c.description ? c.description.substring(0, 50) + '…' : ''}</span>
                    <span class="cc-class-bonuses">${_fmtBonuses(c.startingAttributes)}</span>
                  </button>`
                ).join('')}
              </div>
              <div class="cc-section-divider"></div>
              <h3 class="cc-section-label">Attributes</h3>
              <div id="cc-stats"></div>
              <div class="cc-section-divider"></div>
              <h3 class="cc-section-label">Equipment</h3>
              <div id="cc-equip"></div>
              <div class="cc-section-divider"></div>
              <h3 class="cc-section-label">Skills</h3>
              <div id="cc-skills" class="cc-skill-grid"></div>
              <div class="cc-section-divider"></div>
              <h3 class="cc-section-label">Animations</h3>
              <div id="cc-anims" class="cc-anim-grid"></div>
            </div>
          </div>
        </div>
        <div class="cc-footer">
          <button class="cc-enter-btn" id="cc-enter-world">Enter World</button>
        </div>
      </div>
    </div>
  `;
  return root;
}

function _fmtBonuses(attrs) {
  if (!attrs) return '';
  return Object.entries(attrs).filter(([,v]) => v > 0).map(([k,v]) => `+${v} ${k.substring(0,3)}`).join(', ');
}

function _injectAssets() {
  if (!document.querySelector('link[href*="Cinzel"]')) {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Jost:wght@300;400;500;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[href*="characterCreator"]')) {
    const css = document.createElement('link');
    css.href = './src/styles/characterCreator.css';
    css.rel = 'stylesheet';
    document.head.appendChild(css);
  }
}
          <button class="cc-enter-btn" id="cc-enter-world">Enter World</button>
        </div>
      </div>
    </div>
  `;
  return root;
}

function _fmtBonuses(attrs) {
  if (!attrs) return '';
  return Object.entries(attrs).filter(([,v]) => v > 0).map(([k,v]) => `+${v} ${k.substring(0,3)}`).join(', ');
}

function _injectAssets() {
  if (!document.querySelector('link[href*="Cinzel"]')) {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Jost:wght@300;400;500;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[href*="characterCreator"]')) {
    const css = document.createElement('link');
    css.href = './src/styles/characterCreator.css';
    css.rel = 'stylesheet';
    document.head.appendChild(css);
  }
}
