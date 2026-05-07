/**
 * raceHero.js
 * Loads any of the 6 Grudge Warlords race characters via Babylon.js.
 *
 * Matches the reference Three.js project's pipeline:
 *  1. Load GLB model
 *  2. Load external race texture PNG + normal map PNG
 *  3. Classify each mesh by part type (head, body, arms, weapons, etc.)
 *  4. Create PBRMaterial per mesh with slot-appropriate roughness/metalness
 *  5. Apply the race texture to all meshes, normal map to armor/weapons
 *  6. Scale to target height using VISIBLE-mesh-only bounding box
 *  7. Ground model so feet sit at y=0
 *
 * Usage:
 *   import { loadRaceCharacter } from './raceHero.js';
 *   const raceChar = await loadRaceCharacter(scene, 'orc', parentNode);
 */

import { FACTIONS, ANIMATION_PACKS, classifyMeshPart, getSlotPBR } from './GrudgeFactionRegistry.js';
import { GrudgeEquipmentManager } from './GrudgeEquipmentManager.js';

// ── Texture cache (loaded once, reused across race switches) ────────────────
const _textureCache = new Map();

function _loadTexture(scene, url, useSRGB) {
  if (_textureCache.has(url)) return Promise.resolve(_textureCache.get(url));
  return new Promise((resolve) => {
    const tex = new BABYLON.Texture(
      url, scene,
      /* noMipmap */ false,
      /* invertY */ false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
      () => { _textureCache.set(url, tex); resolve(tex); },
      () => { console.warn('[raceHero] Texture load failed:', url); resolve(null); }
    );
    if (useSRGB) tex.gammaSpace = true;
    tex.anisotropicFilteringLevel = 8;
  });
}

// ── Visible-mesh-only bounding box (skip hidden equipment) ──────────────────
function _visibleBounds(meshes) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let any = false;
  for (const mesh of meshes) {
    if (!mesh.isVisible) continue;
    if (!mesh.getTotalVertices || mesh.getTotalVertices() <= 0) continue;
    const bi = mesh.getBoundingInfo && mesh.getBoundingInfo();
    if (!bi || !bi.boundingBox) continue;
    const mn = bi.boundingBox.minimumWorld;
    const mx = bi.boundingBox.maximumWorld;
    minX = Math.min(minX, mn.x); minY = Math.min(minY, mn.y); minZ = Math.min(minZ, mn.z);
    maxX = Math.max(maxX, mx.x); maxY = Math.max(maxY, mx.y); maxZ = Math.max(maxZ, mx.z);
    any = true;
  }
  if (!any) return { min: BABYLON.Vector3.Zero(), max: new BABYLON.Vector3(1, 2, 1) };
  return { min: new BABYLON.Vector3(minX, minY, minZ), max: new BABYLON.Vector3(maxX, maxY, maxZ) };
}

/**
 * Load a race character and wire up equipment + animations.
 */
export async function loadRaceCharacter(scene, raceId, parent, options = {}) {
  const faction = FACTIONS[raceId];
  if (!faction) throw new Error(`Unknown race: ${raceId}`);

  const { preset, loadAnims = true } = options;

  // ── 1. Load GLB model ─────────────────────────────────────────────────────
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

  if (parent) root.parent = parent;

  // ── 2. Load external race texture + normal map ────────────────────────────
  const [raceTex, normalTex] = await Promise.all([
    faction.texturePath   ? _loadTexture(scene, faction.texturePath, true)   : Promise.resolve(null),
    faction.normalMapPath ? _loadTexture(scene, faction.normalMapPath, false) : Promise.resolve(null),
  ]);

  // ── 3. Classify meshes and apply proper PBR materials ─────────────────────
  const armorType = 'leather'; // default; overridden by class later
  for (const mesh of result.meshes) {
    if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) continue;

    const partType = classifyMeshPart(mesh.name);
    const pbr = getSlotPBR(partType, armorType);

    const mat = new BABYLON.PBRMaterial(`${raceId}_${mesh.name}_mat`, scene);
    mat.roughness = pbr.roughness;
    mat.metallic  = pbr.metalness;

    // Apply the external race texture atlas
    if (raceTex) {
      mat.albedoTexture = raceTex;
    } else {
      const tint = prefab.materialTint || [0.92, 0.90, 0.88];
      mat.albedoColor = new BABYLON.Color3(tint[0], tint[1], tint[2]);
    }

    // Normal map adds surface detail to armor/weapons
    if (normalTex && partType && partType !== 'skin' && partType !== 'hair') {
      mat.bumpTexture = normalTex;
      mat.bumpTexture.level = (partType === 'weapons' || partType === 'shields') ? 1.5 : 1.0;
    }

    // Skin/head get softer material
    if (partType === 'skin' || partType === 'head') {
      mat.roughness = 0.70;
      mat.metallic  = 0.0;
    }

    mat.backFaceCulling = true;
    mat.forceIrradianceInFragment = true;
    mesh.material = mat;

    mesh.isPickable = false;
    mesh.receiveShadows = true;
  }

  console.log(`[raceHero] ${raceId}: ${result.meshes.length} meshes, tex=${raceTex ? 'ok' : 'fallback'}, normal=${normalTex ? 'ok' : 'none'}`);

  // ── 4. Skeleton / root-motion suppression ─────────────────────────────────
  const skeleton = result.skeletons[0] || null;
  let rootMotionObserver = null;
  if (skeleton) {
    for (const bone of skeleton.bones) {
      if (bone.name === 'Bip001' || bone.name === 'RootNode') {
        rootMotionObserver = scene.onBeforeRenderObservable.add(() => {
          bone.position.copyFromFloats(0, 0, 0);
        });
        break;
      }
    }
  }

  // ── 5. Equipment Manager ──────────────────────────────────────────────────
  const equipManager = new GrudgeEquipmentManager(faction.prefix);
  equipManager.catalog(result.meshes);

  const starterPreset = preset || _defaultPreset(raceId);
  equipManager.applyPreset(starterPreset);

  // ── 6. Scale & ground using VISIBLE meshes only ───────────────────────────
  root.computeWorldMatrix(true);
  for (const m of result.meshes) m.computeWorldMatrix(true);

  const bounds = _visibleBounds(result.meshes);
  const rawHeight = Math.max(0.01, bounds.max.y - bounds.min.y);
  const targetHeight = Math.max(0.2, prefab.targetHeight || 1.85);
  const scaleFactor = targetHeight / rawHeight;

  root.scaling.setAll(scaleFactor);

  // Recompute after scaling
  root.computeWorldMatrix(true);
  for (const m of result.meshes) m.computeWorldMatrix(true);
  const scaledBounds = _visibleBounds(result.meshes);

  // Center horizontally, ground vertically (feet at y=0)
  const cx = (scaledBounds.min.x + scaledBounds.max.x) / 2;
  const cz = (scaledBounds.min.z + scaledBounds.max.z) / 2;
  root.position.x = -cx;
  root.position.y = -scaledBounds.min.y;
  root.position.z = -cz;

  // Face camera
  root.rotation.y = typeof prefab.yaw === 'number' ? prefab.yaw : Math.PI;

  // ── 7. Animation system ───────────────────────────────────────────────────
  const animActions = {};
  if (loadAnims && skeleton) {
    try {
      await _loadAnimations(scene, skeleton, animActions);
    } catch (err) {
      console.warn('[raceHero] Some animations failed to load:', err);
    }
  }

  // ── 8. Build RaceCharacter handle ─────────────────────────────────────────
  const raceChar = new RaceCharacter({
    raceId, faction, root, skeleton, result,
    equipManager, animActions, scene, rootMotionObserver,
  });

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

  playAnim(key, loop = true, blendTime = 0.15) {
    const next = this._animActions[key];
    if (!next) return;

    const current = this._currentAnim;
    if (current && current !== next) {
      if (blendTime > 0) {
        next.start(loop, 1.0, next.from, next.to, false);
        next.setWeightForAllAnimatables(0);
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

  stopAnims() {
    for (const ag of Object.values(this._animActions)) ag.stop();
    this._currentAnim = null;
  }

  dispose() {
    this.stopAnims();
    if (this._rootMotionObserver) {
      this._scene.onBeforeRenderObservable.remove(this._rootMotionObserver);
      this._rootMotionObserver = null;
    }
    for (const mesh of this.result.meshes) mesh.dispose();
    if (this.skeleton) this.skeleton.dispose();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _loadAnimations(scene, skeleton, animActions) {
  const entries = Object.entries(ANIMATION_PACKS);
  await Promise.allSettled(
    entries.map(async ([key, path]) => {
      try {
        const folder = path.substring(0, path.lastIndexOf('/') + 1);
        const file   = path.substring(path.lastIndexOf('/') + 1);
        const res = await BABYLON.SceneLoader.ImportMeshAsync(null, folder, file, scene);
        const animGroups = res.animationGroups || scene.animationGroups.slice(-1);
        if (animGroups.length > 0) {
          const ag = animGroups[0];
          ag.name = key;
          _retargetAnimGroup(ag, skeleton);
          for (const m of res.meshes) m.dispose();
          animActions[key] = ag;
        }
      } catch (_) { /* skip */ }
    })
  );
}

function _retargetAnimGroup(animGroup, targetSkeleton) {
  const boneMap = {};
  for (const bone of targetSkeleton.bones) boneMap[bone.name] = bone;
  for (const ta of animGroup.targetedAnimations) {
    if (ta.target?.name && boneMap[ta.target.name]) {
      ta.target = boneMap[ta.target.name];
    }
  }
}

function _defaultPreset(raceId) {
  const presets = {
    human:     { body: 'B', arms: 'A', legs: 'A', head: 'B', shoulders: 'A', weapon: { type: 'sword', variant: 'A' }, shield: 'A' },
    barbarian: { body: 'C', arms: 'B', legs: 'B', head: 'A', weapon: { type: 'axe', variant: 'A' } },
    elf:       { body: 'A', arms: 'A', legs: 'A', head: 'C', weapon: { type: 'bow', variant: 'A' } },
    dwarf:     { body: 'D', arms: 'C', legs: 'B', head: 'D', shoulders: 'B', weapon: { type: 'hammer', variant: 'A' }, shield: 'B' },
    orc:       { body: 'E', arms: 'D', legs: 'C', head: 'E', weapon: { type: 'axe', variant: 'B' } },
    undead:    { body: 'B', arms: 'A', legs: 'A', head: 'F', weapon: { type: 'staff', variant: 'A' } },
  };
  return presets[raceId] || {};
}
