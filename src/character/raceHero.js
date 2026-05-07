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
  const prefab = faction.prefab || {};

  // Parent to character movement node
  if (parent) {
    root.parent = parent;
  }

  const bounds = _computeMeshBounds(result.meshes);
  const rawHeight = Math.max(0.001, bounds.max.y - bounds.min.y);
  const targetHeight = Math.max(0.2, prefab.targetHeight || 1.85);
  const normalizeScale = targetHeight / rawHeight;

  root.scaling.scaleInPlace(normalizeScale);
  root.position.y = typeof prefab.groundOffset === 'number' ? prefab.groundOffset : -1.1;

  // GLB models are Y-up. Bip001 FBX-origin skeletons may arrive with the
  // character facing -Z; yaw π flips to face the camera. If the model
  // appears upside-down, the FBX→GLB conversion baked a Z-up → Y-up
  // rotation into the root — detect this by checking if the bbox center
  // is below origin (feet above head) and correct with an X flip.
  const bboxCenter = (bounds.min.y + bounds.max.y) / 2;
  if (bboxCenter < -0.1 && bounds.min.y < -rawHeight * 0.4) {
    // Model is inverted — flip upright
    root.rotation.x = Math.PI;
    root.rotation.y = 0;
    console.warn(`[raceHero] ${raceId} model detected upside-down, applying X-flip correction`);
  } else {
    root.rotation.y = typeof prefab.yaw === 'number' ? prefab.yaw : Math.PI;
  }

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

      if (_isPlaceholderTextureMaterial(m.material)) {
        const tint = prefab.materialTint || [0.92, 0.90, 0.88];
        if (m.material instanceof BABYLON.PBRMaterial) {
          m.material.albedoColor = new BABYLON.Color3(tint[0], tint[1], tint[2]);
          m.material.metallic = 0.0;
          m.material.roughness = 0.95;
          m.material.emissiveColor = BABYLON.Color3.Black();
        }
      }
    } else if (m.getTotalVertices && m.getTotalVertices() > 0) {
      // Mesh has geometry but no material — assign fallback
      m.material = _fallbackMat;
    }
  }

  // ── 2. Skeleton / root-motion suppression ──────────────────────────────────
  const skeleton = result.skeletons[0] || null;
  let rootMotionObserver = null;
  if (skeleton) {
    for (const bone of skeleton.bones) {
      if (bone.name === 'Bip001' || bone.name === 'RootNode') {
        // Lock root bone translation to prevent root-motion drift
        rootMotionObserver = scene.onBeforeRenderObservable.add(() => {
          bone.position.copyFromFloats(0, 0, 0);
          if (bone.rotationQuaternion) {
            bone.rotationQuaternion.copyFrom(BABYLON.Quaternion.Identity());
          }
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
    equipManager, animActions, scene, rootMotionObserver,
  });

  // Start idle immediately
  if (animActions['idle']) raceChar.playAnim('idle');

  return raceChar;
}

// ─── RaceCharacter ────────────────────────────────────────────────────────────

class RaceCharacter {
  constructor({ raceId, faction, root, skeleton, result, equipManager, animActions, scene, rootMotionObserver }) {
    this.raceId       = raceId;
    this.faction      = faction;
    this.root         = root;
    this.skeleton     = skeleton;
    this.result       = result;
    this.equipManager = equipManager;
    this._animActions = animActions;
    this._scene       = scene;
    this._currentAnim = null;
    this._rootMotionObserver = rootMotionObserver;
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
    if (this._rootMotionObserver) {
      this._scene.onBeforeRenderObservable.remove(this._rootMotionObserver);
      this._rootMotionObserver = null;
    }
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

function _computeMeshBounds(meshes) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const mesh of meshes) {
    if (!mesh.getTotalVertices || mesh.getTotalVertices() <= 0) continue;
    const bi = mesh.getBoundingInfo && mesh.getBoundingInfo();
    if (!bi || !bi.boundingBox) continue;
    const mn = bi.boundingBox.minimumWorld;
    const mx = bi.boundingBox.maximumWorld;
    minX = Math.min(minX, mn.x);
    minY = Math.min(minY, mn.y);
    minZ = Math.min(minZ, mn.z);
    maxX = Math.max(maxX, mx.x);
    maxY = Math.max(maxY, mx.y);
    maxZ = Math.max(maxZ, mx.z);
  }

  if (!Number.isFinite(minX)) {
    return {
      min: BABYLON.Vector3.Zero(),
      max: new BABYLON.Vector3(1, 1, 1),
    };
  }

  return {
    min: new BABYLON.Vector3(minX, minY, minZ),
    max: new BABYLON.Vector3(maxX, maxY, maxZ),
  };
}

function _isPlaceholderTextureMaterial(material) {
  if (!(material instanceof BABYLON.PBRMaterial)) return false;
  const tex = material.albedoTexture;
  if (!tex || !tex.getSize) return false;
  const size = tex.getSize();
  if (!size) return false;
  return size.width <= 2 && size.height <= 2;
}
