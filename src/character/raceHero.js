/**
 * raceHero.js
 * Loads any of the 6 Grudge Warlords race characters via Babylon.js BABYLON.SceneLoader.
 * Supports FBX models, equipment management, and animation retargeting.
 *
 * Usage:
 *   import { loadRaceCharacter } from './raceHero.js';
 *   const raceChar = await loadRaceCharacter(scene, 'orc',  characterNode);
 *   raceChar.equipManager.equip('body', 'B');
 *   raceChar.playAnim('combatIdle');
 */

import { FACTIONS, ANIMATION_PACKS } from './GrudgeFactionRegistry.js';
import { GrudgeEquipmentManager } from './GrudgeEquipmentManager.js';

/**
 * Load a race character FBX and wire up its equipment + animations.
 *
 * @param {BABYLON.Scene}           scene
 * @param {string}                  raceId   - 'human'|'barbarian'|'elf'|'dwarf'|'orc'|'undead'
 * @param {BABYLON.TransformNode}   parent   - physics/movement node to attach to
 * @param {Object}                  [options]
 * @param {Object}                  [options.preset]  - initial equipment preset
 * @param {boolean}                 [options.loadAnims=true]
 * @returns {Promise<RaceCharacter>}
 */
export async function loadRaceCharacter(scene, raceId, parent, options = {}) {
  const faction = FACTIONS[raceId];
  if (!faction) throw new Error(`Unknown race: ${raceId}`);

  const { preset, loadAnims = true } = options;

  // ── 1. Load FBX model ──────────────────────────────────────────────────────
  const url = faction.modelPath;
  const folder = url.substring(0, url.lastIndexOf('/') + 1);
  const file   = url.substring(url.lastIndexOf('/') + 1);

  let result;
  try {
    result = await BABYLON.SceneLoader.ImportMeshAsync(null, folder, file, scene);
  } catch (err) {
    console.error(`[raceHero] Failed to load ${raceId} model:`, err);
    throw err;
  }

  const root = result.meshes[0];

  // Parent to character movement node
  if (parent) {
    root.parent = parent;
  }

  // Standard scale/position for Bip001-skeleton FBX (match existing human_basemesh)
  root.scaling.scaleInPlace(0.018);
  root.position.y = -1.1;
  root.rotation.y = Math.PI; // face forward

  // Fix materials and disable camera collision on all submeshes
  const _fallbackMat = new BABYLON.PBRMaterial(`${raceId}_fallback`, scene);
  _fallbackMat.albedoColor = new BABYLON.Color3(0.45, 0.35, 0.28);
  _fallbackMat.metallic = 0.1;
  _fallbackMat.roughness = 0.85;

  for (const m of result.meshes) {
    m.cameraCollide = false;
    if (m.material) {
      try { m.material.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE; }
      catch (_) { /* ignore */ }
    } else if (m.getTotalVertices && m.getTotalVertices() > 0) {
      // Mesh has geometry but no material — assign fallback
      m.material = _fallbackMat;
    }
  }

  // ── 2. Skeleton / root-motion suppression ──────────────────────────────────
  const skeleton = result.skeletons[0] || null;
  if (skeleton) {
    for (const bone of skeleton.bones) {
      if (bone.name === 'Bip001' || bone.name === 'RootNode') {
        // Lock root bone translation to prevent root-motion drift
        scene.onBeforeRenderObservable.add(() => {
          bone.position = BABYLON.Vector3.Zero();
        });
        break;
      }
    }
  }

  // ── 3. Equipment Manager ───────────────────────────────────────────────────
  const equipManager = new GrudgeEquipmentManager(faction.prefix);
  equipManager.catalog(result.meshes);

  // Apply default starter preset or caller-supplied preset
  const starterPreset = preset || _defaultPreset(raceId);
  equipManager.applyPreset(starterPreset);

  // ── 3b. Ensure ONLY equipped meshes are visible (catch-all) ────────────────
  // Some FBX child meshes aren't caught by slot patterns (bone helpers, extra geo).
  // Hide anything the EquipmentManager didn't catalog, except root transform.
  for (const m of result.meshes) {
    if (m === root) continue;  // root transform node stays
    if (!equipManager._catalogedMeshes?.has(m)) {
      m.isVisible = false;
    }
  }

  // ── 4. Animation system ────────────────────────────────────────────────────
  const mixer = new BABYLON.AnimationGroup('empty', scene);
  const animActions = {};

  if (loadAnims && skeleton) {
    try {
      await _loadAnimations(scene, skeleton, animActions);
    } catch (err) {
      console.warn('[raceHero] Some animations failed to load:', err);
    }
  }

  // ── 5. Build RaceCharacter handle ──────────────────────────────────────────
  const raceChar = new RaceCharacter({
    raceId, faction, root, skeleton, result,
    equipManager, animActions, scene,
  });

  // Start idle immediately
  if (animActions['idle']) raceChar.playAnim('idle');

  return raceChar;
}

// ─── RaceCharacter ────────────────────────────────────────────────────────────

class RaceCharacter {
  constructor({ raceId, faction, root, skeleton, result, equipManager, animActions, scene }) {
    this.raceId       = raceId;
    this.faction      = faction;
    this.root         = root;
    this.skeleton     = skeleton;
    this.result       = result;
    this.equipManager = equipManager;
    this._animActions = animActions;
    this._scene       = scene;
    this._currentAnim = null;
  }

  /**
   * Play an animation by key name.
   * @param {string} key - matches ANIMATION_PACKS keys: 'idle','run','combatIdle','attack1',…
   * @param {boolean} [loop=true]
   * @param {number}  [blendTime=0.15]
   */
  playAnim(key, loop = true, blendTime = 0.15) {
    const next = this._animActions[key];
    if (!next) return;

    const current = this._currentAnim;
    if (current && current !== next) {
      // Blend out current, blend in next
      if (blendTime > 0) {
        next.start(loop, 1.0, next.from, next.to, false);
        next.setWeightForAllAnimatables(0);
        // Simple lerp-blend over blendTime
        let elapsed = 0;
        const obs = this._scene.onBeforeRenderObservable.add(() => {
          elapsed += this._scene.getEngine().getDeltaTime() / 1000;
          const t = Math.min(elapsed / blendTime, 1);
          next.setWeightForAllAnimatables(t);
          if (current) current.setWeightForAllAnimatables(1 - t);
          if (t >= 1) {
            if (current) current.stop();
            this._scene.onBeforeRenderObservable.remove(obs);
          }
        });
      } else {
        current.stop();
        next.start(loop);
      }
    } else if (!current) {
      next.start(loop);
    }

    this._currentAnim = next;
  }

  /** Stop all animations */
  stopAnims() {
    for (const ag of Object.values(this._animActions)) {
      ag.stop();
    }
    this._currentAnim = null;
  }

  /** Remove from scene */
  dispose() {
    this.stopAnims();
    for (const mesh of this.result.meshes) {
      mesh.dispose();
    }
    if (this.skeleton) this.skeleton.dispose();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Load all animation FBXs and bake them into AnimationGroups retargeted to skeleton.
 */
async function _loadAnimations(scene, skeleton, animActions) {
  const entries = Object.entries(ANIMATION_PACKS);
  await Promise.allSettled(
    entries.map(async ([key, path]) => {
      try {
        const folder = path.substring(0, path.lastIndexOf('/') + 1);
        const file   = path.substring(path.lastIndexOf('/') + 1);
        const result = await BABYLON.SceneLoader.ImportMeshAsync(null, folder, file, scene);

        // Grab the animation group from the loaded anim FBX
        const animGroups = result.animationGroups || scene.animationGroups.slice(-1);
        if (animGroups.length > 0) {
          const ag = animGroups[0];
          ag.name = key;
          // Retarget: connect animation targets to our skeleton's bones by name
          _retargetAnimGroup(ag, skeleton, scene);
          // Dispose temp import meshes (we only needed the animation data)
          for (const m of result.meshes) m.dispose();
          animActions[key] = ag;
        }
      } catch (err) {
        console.warn(`[raceHero] Anim "${key}" failed:`, err.message);
      }
    })
  );
}

/**
 * Retarget an AnimationGroup to a different skeleton (same Bip001 bone names).
 */
function _retargetAnimGroup(animGroup, targetSkeleton, scene) {
  const boneMap = {};
  for (const bone of targetSkeleton.bones) {
    boneMap[bone.name] = bone;
  }
  for (const ta of animGroup.targetedAnimations) {
    // ta.target might be a bone from the import skeleton; remap by name
    if (ta.target && ta.target.name && boneMap[ta.target.name]) {
      ta.target = boneMap[ta.target.name];
    }
  }
}

/**
 * Default equipment presets per race (sensible starter loadout).
 */
function _defaultPreset(raceId) {
  const presets = {
    human:     { body: 'B', arms: 'A', legs: 'A', head: 'B', shoulders: 'A', weapon: { type: 'sword', variant: 'A' }, shield: 'A' },
    barbarian: { body: 'C', arms: 'B', legs: 'B', head: 'A', weapon: { type: 'axe',   variant: 'A' } },
    elf:       { body: 'A', arms: 'A', legs: 'A', head: 'C', weapon: { type: 'bow',    variant: 'A' } },
    dwarf:     { body: 'D', arms: 'C', legs: 'B', head: 'D', shoulders: 'B', weapon: { type: 'hammer', variant: 'A' }, shield: 'B' },
    orc:       { body: 'E', arms: 'D', legs: 'C', head: 'E', weapon: { type: 'axe',   variant: 'B' } },
    undead:    { body: 'B', arms: 'A', legs: 'A', head: 'F', weapon: { type: 'staff',  variant: 'A' } },
  };
  return presets[raceId] || {};
}
