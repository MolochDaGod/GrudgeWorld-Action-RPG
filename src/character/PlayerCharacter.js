/**
 * PlayerCharacter.js
 * Grudge Warlords — Unified character loading for all scenes.
 *
 * MMO pattern: one character prefab, selected during creation, loaded
 * identically in every scene. All scenes import loadPlayerCharacter()
 * instead of hero.js or raceHero.js directly.
 *
 * Flow:
 *   1. Character creation (F4) sets CHAR_SELECT.race / .class / .equip
 *   2. Any scene calls loadPlayerCharacter(scene, parentNode)
 *   3. Returns { hero, skeleton, raceChar, anim } ready for movement.js
 *
 * Race GLB characters are the ONLY option. The old HumanBaseMesh is gone.
 */

import { loadRaceCharacter } from './raceHero.js';
import { FACTIONS } from './GrudgeFactionRegistry.js';

// Null animation stub — prevents crashes when an anim key is missing
function _nullAnim() {
  return { start(){}, stop(){}, play(){}, isPlaying: false, from: 0, to: 0, setWeightForAllAnimatables(){} };
}

/**
 * Load the player's selected character into a scene.
 *
 * @param {BABYLON.Scene} scene
 * @param {BABYLON.TransformNode|BABYLON.Mesh} parentNode - physics/movement node
 * @param {Object} [opts]
 * @param {boolean} [opts.loadAnims=true] - load base animation pack
 * @returns {Promise<PlayerCharacterHandle>}
 */
export async function loadPlayerCharacter(scene, parentNode, opts = {}) {
  const selectedRace = (typeof CHAR_SELECT !== 'undefined' && CHAR_SELECT.race) || 'human';
  const selectedEquip = (typeof CHAR_SELECT !== 'undefined' && CHAR_SELECT.equip) || null;

  let hero, skeleton, raceChar, useRaceChar = false;

  // ── Load race character GLB (no fallback — race chars are the only option) ───
  raceChar = await loadRaceCharacter(scene, selectedRace, parentNode, {
    preset: selectedEquip || undefined,
    loadAnims: opts.loadAnims !== false,
  });
  hero = raceChar.root;
  skeleton = raceChar.skeleton;
  useRaceChar = true;
  console.log(`[PlayerCharacter] Race character loaded: ${selectedRace}`);

  // ── Build animation bridge ──────────────────────────────────────────────────
  // movement.js expects: anim.BreathingIdle, anim.Running, anim.Jump, anim.Roll,
  //   anim.SelfCast, anim.Combo, anim.Attack, anim.Block
  let anim;
  if (useRaceChar && raceChar._animActions) {
    const ra = raceChar._animActions;
    anim = {
      BreathingIdle: ra.idle       || ra.combatIdle || _nullAnim(),
      Running:       ra.combatRun  || _nullAnim(),
      Jump:          ra.idle       || _nullAnim(),
      Roll:          ra.hit        || _nullAnim(),
      SelfCast:      ra.attack3    || _nullAnim(),
      Combo:         ra.attack2    || _nullAnim(),
      Attack:        ra.attack1    || _nullAnim(),
      Block:         ra.block      || _nullAnim(),
    };

    // Enable blending
    scene.animationPropertiesOverride = new BABYLON.AnimationPropertiesOverride();
    scene.animationPropertiesOverride.enableBlending = true;
    scene.animationPropertiesOverride.blendingSpeed = 0.15;

    // Hot-swap real jump/roll/block GLBs async
    _loadExtraAnims(scene, skeleton, anim);
  }

  // ── Faction info for HUD ────────────────────────────────────────────────────
  const faction = FACTIONS[selectedRace] || {};

  return {
    hero,
    skeleton,
    raceChar,
    anim,
    useRaceChar,
    raceName: faction.name || 'Human',
    factionColor: faction.color || '#c8a951',
    raceId: selectedRace,
    equipManager: raceChar?.equipManager || null,
  };
}

// ── Load extra weapon-pack GLB anims and hot-swap into the anim bridge ────────

async function _loadExtraAnims(scene, skeleton, anim) {
  const extras = {
    Jump:  './assets/glb/anims/sword_shield/sword_and_shield_jump.glb',
    Roll:  './assets/glb/anims/longbow/standing_dodge_forward.glb',
    Block: './assets/glb/anims/sword_shield/sword_and_shield_block.glb',
  };
  for (const [key, path] of Object.entries(extras)) {
    try {
      const folder = path.substring(0, path.lastIndexOf('/') + 1);
      const file = path.substring(path.lastIndexOf('/') + 1);
      const result = await BABYLON.SceneLoader.ImportMeshAsync(null, folder, file, scene);
      if (result.animationGroups?.length > 0) {
        const ag = result.animationGroups[0];
        ag.name = key;
        if (skeleton) {
          const boneMap = {};
          for (const bone of skeleton.bones) boneMap[bone.name] = bone;
          for (const ta of ag.targetedAnimations) {
            if (ta.target?.name && boneMap[ta.target.name]) ta.target = boneMap[ta.target.name];
          }
        }
        for (const m of result.meshes) m.dispose();
        anim[key] = ag;
      }
    } catch (_) {}
  }
}
