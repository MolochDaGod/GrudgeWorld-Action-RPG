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

import { FACTIONS, ANIMATION_PACKS, classifyMeshPart, getSlotPBR, CLASS_BUILDS, ARMOR_PRESETS, CLASS_WEAPON_PRESETS } from './GrudgeFactionRegistry.js';
import { GrudgeEquipmentManager } from './GrudgeEquipmentManager.js';
import { AnimController, retargetAnimGroup } from './AnimController.js';

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

// ── Visible BODY-only bounding box (skip weapons/shields — they attach to
// hand bones far from centre and completely break the height calculation) ──────
//
// For SKINNED meshes from GLB the default bounding box is the bind-pose box of
// the geometry, which often does NOT reflect the actual posed character. Always
// call refreshBoundingInfo({ applySkeleton:true }) on visible skinned meshes
// before reading bounds, otherwise the scale factor is wildly wrong.
function _visibleBounds(meshes) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let any = false;
  for (const mesh of meshes) {
    if (!mesh.isVisible) continue;
    if (!mesh.getTotalVertices || mesh.getTotalVertices() <= 0) continue;
    // Skip weapons, shields, and shoulderpads — they sit at hand-bone world
    // positions or extend far from the torso and inflate the bounding box,
    // producing a wrong scale factor.
    const n = (mesh.name || '').toLowerCase();
    if (n.includes('weapon') || n.includes('shield') || n.includes('xtra') || n.includes('shoulderpad')) continue;

    // Refresh skinned-mesh bounds so they include skeleton transforms.
    if (mesh.skeleton && typeof mesh.refreshBoundingInfo === 'function') {
      try { mesh.refreshBoundingInfo({ applySkeleton: true, applyMorph: false }); }
      catch (_) { try { mesh.refreshBoundingInfo(true); } catch (__) {} }
    }

    const bi = mesh.getBoundingInfo && mesh.getBoundingInfo();
    if (!bi || !bi.boundingBox) continue;
    const mn = bi.boundingBox.minimumWorld;
    const mx = bi.boundingBox.maximumWorld;
    // Reject obviously broken bounds (NaN / Infinity / collapsed).
    if (!isFinite(mn.x) || !isFinite(mx.x) || !isFinite(mn.y) || !isFinite(mx.y)) continue;
    if ((mx.y - mn.y) < 1e-4 && (mx.x - mn.x) < 1e-4) continue;
    minX = Math.min(minX, mn.x); minY = Math.min(minY, mn.y); minZ = Math.min(minZ, mn.z);
    maxX = Math.max(maxX, mx.x); maxY = Math.max(maxY, mx.y); maxZ = Math.max(maxZ, mx.z);
    any = true;
  }
  if (!any) return { min: BABYLON.Vector3.Zero(), max: new BABYLON.Vector3(1, 2, 1) };
  return { min: new BABYLON.Vector3(minX, minY, minZ), max: new BABYLON.Vector3(maxX, maxY, maxZ) };
}

// Estimate character height from the SKELETON (Bip001 hierarchy). Used as a
// fallback / sanity check when skinned-mesh bounds are unreliable. Returns null
// when the skeleton doesn't expose enough info.
function _skeletonHeight(skeleton) {
  if (!skeleton || !skeleton.bones) return null;
  let pelvisY = null, headY = null;
  for (const bone of skeleton.bones) {
    const name = (bone.name || '').toLowerCase();
    const m = bone.getAbsoluteMatrix && bone.getAbsoluteMatrix();
    if (!m) continue;
    const y = m.m ? m.m[13] : (m.getTranslation ? m.getTranslation().y : null);
    if (y == null || !isFinite(y)) continue;
    if (pelvisY == null && (name === 'bip001' || name === 'bip001 pelvis' || name === 'hips')) pelvisY = y;
    if (name.includes('head') && !name.includes('headtop') && !name.includes('headend')) headY = Math.max(headY ?? -Infinity, y);
  }
  if (pelvisY == null || headY == null || !isFinite(pelvisY) || !isFinite(headY)) return null;
  // Total height ≈ 1.85 × (head − pelvis) (head bone sits ~mid-skull, full
  // figure ≈ 1.85× the spine length from pelvis to head bone in Bip001 rigs).
  const spine = Math.abs(headY - pelvisY);
  if (spine < 1e-3) return null;
  return spine * 1.85;
}

/**
 * Load a race character and wire up equipment + animations.
 */
export async function loadRaceCharacter(scene, raceId, parent, options = {}) {
  const faction = FACTIONS[raceId];
  if (!faction) throw new Error(`Unknown race: ${raceId}`);

  const { preset, loadAnims = true, classId = 'warrior' } = options;

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

  // Hide every geometry mesh immediately so nothing is visible during the
  // async texture-load gap. catalog()+applyPreset() will re-show the correct
  // variants once the full pipeline completes.
  for (const mesh of result.meshes) {
    if (mesh.getTotalVertices && mesh.getTotalVertices() > 0) {
      mesh.isVisible = false;
    }
  }

  // ── 2. Load external race texture + normal map ────────────────────────────
  const [raceTex, normalTex] = await Promise.all([
    faction.texturePath   ? _loadTexture(scene, faction.texturePath, true)   : Promise.resolve(null),
    faction.normalMapPath ? _loadTexture(scene, faction.normalMapPath, false) : Promise.resolve(null),
  ]);

  // ── 3. Classify meshes and apply proper PBR materials ─────────────────────
  const classBuild = CLASS_BUILDS[classId] || CLASS_BUILDS.warrior;
  const armorType = classBuild.armorType || 'leather';
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
    // Ensure PBR materials are visible even without a valid environment map.
    // Without IBL, PBR renders nearly black. environmentIntensity on the
    // material + higher direct/specular ensures the character is always lit.
    mat.environmentIntensity = 0.4;
    mat.directIntensity = 1.5;
    mat.specularIntensity = 0.8;
    mesh.material = mat;

    mesh.isPickable = false;
    mesh.receiveShadows = true;
  }

  console.log(`[raceHero] ${raceId}: ${result.meshes.length} meshes, tex=${raceTex ? 'ok' : 'fallback'}, normal=${normalTex ? 'ok' : 'none'}`);

  // ── 4. Skeleton / root-motion suppression ─────────────────────────────────
  // Some GLBs (elf) have multiple skeletons or an unusual root; pick the one
  // with the most joints so retargeting works on all races.
  let skeleton = null;
  if (result.skeletons && result.skeletons.length > 0) {
    skeleton = result.skeletons.reduce((best, s) =>
      (!best || (s.bones?.length || 0) > (best.bones?.length || 0)) ? s : best, null);
  }
  let rootMotionObserver = null;
  if (skeleton) {
    for (const bone of skeleton.bones) {
      const bn = bone.name;
      if (bn === 'Bip001' || bn === 'RootNode' || bn === 'Bip001 Pelvis') {
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

  // Debug: log what got cataloged and what was missed
  if (DEBUG) {
    const slotSummary = Object.entries(equipManager.slots)
      .map(([s, e]) => `${s}:[${e.map(x => x.variant).join(',')}]`).join(' ');
    const uncataloged = result.meshes.filter(m =>
      m.getTotalVertices?.() > 0 && !equipManager._catalogedMeshes.has(m) && m !== result.meshes[0]
    ).map(m => m.name);
    console.log(`[raceHero:catalog] ${raceId} slots →`, slotSummary);
    if (uncataloged.length) console.warn(`[raceHero:catalog] ${raceId} UNCATALOGED meshes:`, uncataloged);
  }

  // Apply class-specific equipment build (weapon, shield, head preference)
  const starterPreset = preset || _classPreset(raceId, classId);
  equipManager.applyPreset(starterPreset, armorType);

  // ── Render guarantee ────────────────────────────────────────────────────
  // If the catalog/preset combination ended up with an invisible character
  // (e.g. SLOT_PATTERNS didn't match any meshes for this race), fall back to
  // 'A' defaults, then to showAll() as a last resort. The character must
  // never be a black silhouette of just a sword.
  const _bodySlot = equipManager.slots['body'] || [];
  const _bodyVisible = _bodySlot.some(e => e.mesh.isVisible);
  if (!_bodyVisible) {
    console.warn(`[raceHero] ${raceId}: body slot empty after preset — applying forceDefaults().`);
    equipManager.forceDefaults();
    const _bodyVisible2 = (equipManager.slots['body'] || []).some(e => e.mesh.isVisible);
    if (!_bodyVisible2) {
      console.warn(`[raceHero] ${raceId}: forceDefaults() also empty — calling showAll() as last resort.`);
      equipManager.showAll();
    }
  }

  // Debug: log which meshes are now visible after preset
  if (DEBUG) {
    const visible = result.meshes.filter(m => m.isVisible).map(m => m.name);
    console.log(`[raceHero:preset] ${raceId}/${classId} visible meshes (${visible.length}):`, visible);
  }

  // ── 6. Scale & ground using VISIBLE meshes only ───────────────────────
  // Temporarily detach from parent so bounds are in local space (not affected
  // by the physics capsule's world position in the outdoor scene).
  const savedParent = root.parent;
  root.parent = null;
  root.position.copyFromFloats(0, 0, 0);
  root.rotation.copyFromFloats(0, 0, 0);
  root.scaling.copyFromFloats(1, 1, 1);
  root.computeWorldMatrix(true);
  // Force the skeleton's absolute transforms so refreshBoundingInfo picks up
  // the actual posed character (otherwise GLB skinned meshes report a
  // bind-pose box that has nothing to do with the visible silhouette).
  if (skeleton && typeof skeleton.prepare === 'function') { try { skeleton.prepare(); } catch (_) {} }
  if (skeleton && typeof skeleton.computeAbsoluteTransforms === 'function') {
    try { skeleton.computeAbsoluteTransforms(true); } catch (_) {}
  }
  for (const m of result.meshes) m.computeWorldMatrix(true);

  const bounds = _visibleBounds(result.meshes);
  let rawHeight = Math.max(0.01, bounds.max.y - bounds.min.y);
  const targetHeight = Math.max(0.2, prefab.targetHeight || 1.85);

  // Sanity-check against the skeleton: if the visible-mesh bounds disagree
  // wildly with the skeleton-derived height, trust the skeleton. This catches
  // the common GLB bug where a skinned mesh reports a near-zero bind-pose box.
  const skeletonH = _skeletonHeight(skeleton);
  if (skeletonH && (rawHeight < skeletonH * 0.25 || rawHeight > skeletonH * 4)) {
    console.warn(`[raceHero] ${raceId}: visible bounds height ${rawHeight.toFixed(3)} disagrees with skeleton height ${skeletonH.toFixed(3)} — using skeleton.`);
    rawHeight = skeletonH;
  }
  const scaleFactor = targetHeight / rawHeight;

  root.scaling.copyFromFloats(scaleFactor, scaleFactor, scaleFactor);
  root.computeWorldMatrix(true);
  if (skeleton && typeof skeleton.computeAbsoluteTransforms === 'function') {
    try { skeleton.computeAbsoluteTransforms(true); } catch (_) {}
  }
  for (const m of result.meshes) m.computeWorldMatrix(true);
  const scaledBounds = _visibleBounds(result.meshes);

  // Center horizontally, ground vertically (feet at local y=0)
  const cx = (scaledBounds.min.x + scaledBounds.max.x) / 2;
  const cz = (scaledBounds.min.z + scaledBounds.max.z) / 2;
  root.position.x = -cx;
  root.position.y = -scaledBounds.min.y;
  root.position.z = -cz;

  // Face camera
  root.rotation.y = typeof prefab.yaw === 'number' ? prefab.yaw : Math.PI;

  // Cache the final post-scale visible bounds so callers (preview camera) can
  // frame the character without re-running the whole bounding pipeline.
  const finalH = Math.max(0.01, scaledBounds.max.y - scaledBounds.min.y);
  const finalW = Math.max(0.01, Math.max(scaledBounds.max.x - scaledBounds.min.x, scaledBounds.max.z - scaledBounds.min.z));
  console.log(`[raceHero] ${raceId}: scaleFactor=${scaleFactor.toFixed(3)} rawH=${rawHeight.toFixed(3)} finalH=${finalH.toFixed(3)} finalW=${finalW.toFixed(3)}`);

  // Re-attach to parent
  root.parent = savedParent;

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
    raceId, classId, faction, root, skeleton, result,
    equipManager, animActions, scene, rootMotionObserver,
    raceTex, normalTex,
    initialBounds: scaledBounds,
  });

  if (animActions['idle']) raceChar.playAnim('idle');

  return raceChar;
}

// Public helper used by character_create.js to frame the preview camera.
export function computeVisibleBounds(raceChar) {
  if (!raceChar || !raceChar.result) return null;
  if (raceChar.skeleton && typeof raceChar.skeleton.computeAbsoluteTransforms === 'function') {
    try { raceChar.skeleton.computeAbsoluteTransforms(true); } catch (_) {}
  }
  if (raceChar.root && typeof raceChar.root.computeWorldMatrix === 'function') {
    raceChar.root.computeWorldMatrix(true);
  }
  for (const m of raceChar.result.meshes) {
    if (typeof m.computeWorldMatrix === 'function') m.computeWorldMatrix(true);
  }
  return _visibleBounds(raceChar.result.meshes);
}

// ─── RaceCharacter ────────────────────────────────────────────────────────────

class RaceCharacter {
  constructor({ raceId, classId, faction, root, skeleton, result, equipManager, animActions, scene, rootMotionObserver, raceTex, normalTex, initialBounds }) {
    this.raceId       = raceId;
    this.classId      = classId;
    this.faction      = faction;
    this.root         = root;
    this.skeleton     = skeleton;
    this.result       = result;
    this.equipManager = equipManager;
    this._animActions = animActions;
    this._scene       = scene;
    this._currentAnim = null;
    this._rootMotionObserver = rootMotionObserver;
    this._raceTex     = raceTex;
    this._normalTex   = normalTex;
    this.bounds       = initialBounds || null;

    // Unified animation controller — manages both base and class animation packs
    // with smooth cross-fades and a single blend observer at a time.
    this.animCtrl = new AnimController(scene);
    this.animCtrl.registerAll(animActions);
  }

  /**
   * Switch class build — swaps to the correct armor meshes (plate/leather/cloth)
   * AND updates PBR material properties AND equips the class weapon/shield.
   */
  applyClassBuild(newClassId) {
    this.classId = newClassId;
    const build = CLASS_BUILDS[newClassId] || CLASS_BUILDS.warrior;
    const armorType = build.armorType || 'leather';

    // 1. Update PBR roughness/metalness on every mesh for the new armor type
    for (const mesh of this.result.meshes) {
      if (!mesh.material || mesh.material.roughness === undefined) continue;
      const partType = classifyMeshPart(mesh.name);
      const pbr = getSlotPBR(partType, armorType);
      if (partType === 'skin' || partType === 'head') {
        mesh.material.roughness = 0.70;
        mesh.material.metallic  = 0.0;
      } else {
        mesh.material.roughness = pbr.roughness;
        mesh.material.metallic  = pbr.metalness;
      }
    }

    // 2. Switch to the correct armor MESH variants (different geometry per armor type)
    const preset = _classPreset(this.raceId, newClassId);
    this.equipManager.applyPreset(preset, armorType);

    console.log(`[raceHero] Class build: ${newClassId} (${armorType}) — body:${preset.body} arms:${preset.arms} legs:${preset.legs}`);
  }

  playAnim(key, loop = true, blendTime = 0.15) {
    this.animCtrl.play(key, { loop, blendTime });
    // Keep _currentAnim in sync for any external code that reads it directly.
    this._currentAnim = this.animCtrl._current;
  }

  stopAnims() {
    this.animCtrl.stopAll();
    this._currentAnim = null;
  }

  dispose() {
    // Dispose all registered animation groups (base + class) and clean up blend observers.
    this.animCtrl.dispose();
    this._animActions = {};
    this._currentAnim = null;

    if (this._rootMotionObserver) {
      this._scene.onBeforeRenderObservable.remove(this._rootMotionObserver);
      this._rootMotionObserver = null;
    }

    // Dispose materials we created (prevents accumulation in scene.materials)
    for (const mesh of this.result.meshes) {
      if (mesh.material && mesh.material.name.startsWith(this.raceId + '_')) {
        mesh.material.dispose(false, true); // don't force dispose textures (shared cache)
      }
    }

    // Dispose meshes
    for (const mesh of this.result.meshes) {
      try { mesh.dispose(); } catch (_) {}
    }
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
        // Always dispose imported meshes — we only need the animation data.
        // Skipping this when animGroups is empty left VFX geometry (fireball etc.) visible.
        for (const m of res.meshes) { try { m.dispose(); } catch (_) {} }
        const animGroups = res.animationGroups || scene.animationGroups.slice(-1);
        if (animGroups.length > 0) {
          const ag = animGroups[0];
          ag.name = key;
          retargetAnimGroup(ag, skeleton);
          animActions[key] = ag;
        }
      } catch (_) { /* skip */ }
    })
  );
}

// Bone retargeting is now handled by retargetAnimGroup() in AnimController.js.

/**
 * Build the equipment preset for a race + class combination.
 * Uses ARMOR_PRESETS for the correct body/arms/legs/shoulders mesh variants
 * (different geometry per armor type) and CLASS_WEAPON_PRESETS for weapons.
 */
function _classPreset(raceId, classId) {
  const build = CLASS_BUILDS[classId] || CLASS_BUILDS.warrior;
  const armorType = build.armorType || 'leather';

  // Get the correct armor mesh variants for this race + armor type
  const raceArmor = ARMOR_PRESETS[raceId];
  const armorSet = raceArmor ? raceArmor[armorType] : null;

  const preset = {};

  // Armor slots — each variant letter IS a different mesh (plate vs leather vs robes)
  if (armorSet) {
    if (armorSet.body) preset.body = armorSet.body;
    if (armorSet.arms) preset.arms = armorSet.arms;
    if (armorSet.legs) preset.legs = armorSet.legs;
    if (armorSet.shoulders) preset.shoulders = armorSet.shoulders;
  } else {
    // Fallback if no preset defined
    preset.body = 'A'; preset.arms = 'A'; preset.legs = 'A';
  }

  // Head — always use a reasonable default per race
  const defaultHeads = { human: 'B', barbarian: 'A', elf: 'C', dwarf: 'D', orc: 'A', undead: 'A' };
  preset.head = defaultHeads[raceId] || 'A';

  // Weapon + shield from CLASS_WEAPON_PRESETS (per-race, per-class)
  const raceWeapons = CLASS_WEAPON_PRESETS[raceId];
  const wp = raceWeapons ? raceWeapons[classId] : null;
  if (wp) {
    if (wp.weapon) preset.weapon = { ...wp.weapon };
    if (wp.shield) preset.shield = wp.shield;
  }

  return preset;
}
