/**
 * GrudgeFactionRegistry.js
 * Defines the 6 Grudge Warlords race factions, their model paths,
 * equipment prefixes, and animation packs (Bip001 skeleton shared).
 */

export const FACTIONS = {
  human: {
    id: 'human',
    name: 'Human',
    faction: 'Crusade',
    prefix: 'WK_',
    color: '#4a90d9',
    accentColor: '#c8a951',
    modelPath: './assets/glb/characters/races/human.glb',
    texturePath: './assets/textures/races/human/texture.png',
    normalMapPath: './assets/textures/races/human/normal.png',
    icon: null,
    prefab: { targetHeight: 1.85, groundOffset: 0, yaw: Math.PI, materialTint: [0.95, 0.92, 0.88] },
    stats: { str: 14, dex: 12, int: 12, vit: 14, wis: 11, lck: 11, cha: 13, end: 13 },
    description: 'Balanced warriors of the Crusade. Masters of sword and shield combat.',
  },
  barbarian: {
    id: 'barbarian',
    name: 'Barbarian',
    faction: 'Crusade',
    prefix: 'BRB_',
    color: '#c0392b',
    accentColor: '#e67e22',
    modelPath: './assets/glb/characters/races/barbarian.glb',
    texturePath: './assets/textures/races/barbarian/texture.png',
    normalMapPath: './assets/textures/races/barbarian/normal.png',
    icon: null,
    prefab: { targetHeight: 1.95, groundOffset: 0, yaw: Math.PI, materialTint: [0.92, 0.86, 0.80] },
    stats: { str: 18, dex: 13, int: 8, vit: 16, wis: 8, lck: 10, cha: 9, end: 18 },
    description: 'Ferocious berserkers. Unmatched raw strength and endurance.',
  },
  elf: {
    id: 'elf',
    name: 'Elf',
    faction: 'Fabled',
    prefix: 'ELF_',
    color: '#27ae60',
    accentColor: '#a8e6cf',
    modelPath: './assets/glb/characters/races/elf.glb',
    texturePath: './assets/textures/races/elf/texture.png',
    normalMapPath: './assets/textures/races/elf/normal.png',
    icon: null,
    prefab: { targetHeight: 1.8, groundOffset: 0, yaw: Math.PI, materialTint: [0.88, 0.95, 0.90] },
    stats: { str: 10, dex: 18, int: 15, vit: 10, wis: 14, lck: 14, cha: 12, end: 7 },
    description: 'Swift archers and mages of the Fabled. Unrivaled agility and arcane skill.',
  },
  dwarf: {
    id: 'dwarf',
    name: 'Dwarf',
    faction: 'Fabled',
    prefix: 'DWF_',
    color: '#8e44ad',
    accentColor: '#f1c40f',
    modelPath: './assets/glb/characters/races/dwarf.glb',
    texturePath: './assets/textures/races/dwarf/texture.png',
    normalMapPath: './assets/textures/races/dwarf/normal.png',
    icon: null,
    prefab: { targetHeight: 1.6, groundOffset: 0, yaw: Math.PI, materialTint: [0.90, 0.86, 0.82] },
    stats: { str: 15, dex: 9, int: 13, vit: 18, wis: 14, lck: 12, cha: 9, end: 10 },
    description: 'Stout craftsmen and engineers. Exceptional vitality and wisdom.',
  },
  orc: {
    id: 'orc',
    name: 'Orc',
    faction: 'Legion',
    prefix: 'ORC_',
    color: '#2ecc71',
    accentColor: '#8B0000',
    modelPath: './assets/glb/characters/races/orc.glb',
    texturePath: './assets/textures/races/orc/texture.png',
    normalMapPath: './assets/textures/races/orc/normal.png',
    icon: null,
    prefab: { targetHeight: 2.0, groundOffset: 0, yaw: Math.PI, materialTint: [0.84, 0.90, 0.82] },
    stats: { str: 19, dex: 10, int: 8, vit: 17, wis: 7, lck: 9, cha: 8, end: 20 },
    description: 'Brutal warlords of the Legion. Overpowering strength and unstoppable endurance.',
  },
  undead: {
    id: 'undead',
    name: 'Undead',
    faction: 'Legion',
    prefix: 'UD_',
    color: '#7f8c8d',
    accentColor: '#9b59b6',
    modelPath: './assets/glb/characters/races/undead.glb',
    texturePath: './assets/textures/races/undead/texture.png',
    normalMapPath: './assets/textures/races/undead/normal.png',
    icon: null,
    prefab: { targetHeight: 1.9, groundOffset: 0, yaw: Math.PI, materialTint: [0.86, 0.88, 0.90] },
    stats: { str: 12, dex: 11, int: 16, vit: 8, wis: 16, lck: 10, cha: 6, end: 21 },
    description: 'Deathbound legions. High intelligence and endurance beyond mortality.',
  },
};

/** Ordered list for UI display */
export const RACE_ORDER = ['human', 'barbarian', 'elf', 'dwarf', 'orc', 'undead'];

/**
 * Shared animation pack paths (Bip001 skeleton — shared across all 6 races).
 * Files verified present in assets/characters/races/animations/
 * NOTE: run.fbx and walk.fbx are not in the assets folder — use combatRun for movement.
 */
export const ANIMATION_PACKS = {
  // -- Base locomotion / combat --
  idle: "./assets/glb/anims/base/idle.glb",
  combatIdle: "./assets/glb/anims/base/combat_idle.glb",
  combatRun: "./assets/glb/anims/base/combat_run.glb",
  attack1: "./assets/glb/anims/base/attack1.glb",
  attack2: "./assets/glb/anims/base/attack2.glb",
  attack3: "./assets/glb/anims/base/attack3.glb",
  death: "./assets/glb/anims/base/death.glb",
  hit: "./assets/glb/anims/base/hit.glb",
  block: "./assets/glb/anims/base/block.glb",

  // -- Melee weapon combos (extras) --
  greatSwordSlash: "./assets/glb/anims/extras/great_sword_slash.glb",
  greatSwordSlash2: "./assets/glb/anims/extras/great_sword_slash_1.glb",
  dualWeaponCombo: "./assets/glb/anims/extras/dual_weapon_combo.glb",
  twoHandSwordCombo: "./assets/glb/anims/extras/two_hand_sword_combo.glb",
  twoHandClubCombo: "./assets/glb/anims/extras/two_hand_club_combo.glb",
  oneHandSwordCombo: "./assets/glb/anims/extras/one_hand_sword_combo.glb",
  oneHandClubCombo: "./assets/glb/anims/extras/one_hand_club_combo.glb",
  swordAndShieldAttack: "./assets/glb/anims/extras/sword_and_shield_attack.glb",
  swordAndShieldAttack2:
    "./assets/glb/anims/extras/sword_and_shield_attack_1.glb",
  swordAndShieldSlash: "./assets/glb/anims/extras/sword_and_shield_slash.glb",
  swordAndShieldSlash2:
    "./assets/glb/anims/extras/sword_and_shield_slash_1.glb",
  swordAndShieldPowerUp:
    "./assets/glb/anims/extras/sword_and_shield_power_up.glb",
  swordAndShieldCasting:
    "./assets/glb/anims/extras/sword_and_shield_casting.glb",
  kick: "./assets/glb/anims/extras/kick.glb",
  throwObject: "./assets/glb/anims/extras/throw_object.glb",

  // -- Magic / spells --
  spellCasting: "./assets/glb/anims/extras/spell_casting.glb",
  standing1hCastSpell:
    "./assets/glb/anims/extras/standing_1h_cast_spell_01.glb",
  standing2hCastSpell:
    "./assets/glb/anims/extras/standing_2h_cast_spell_01.glb",
  standing2hMagicArea1:
    "./assets/glb/anims/extras/standing_2h_magic_area_attack_01.glb",
  standing2hMagicArea2:
    "./assets/glb/anims/extras/standing_2h_magic_area_attack_02.glb",
  standing2hMagicAtk1:
    "./assets/glb/anims/extras/standing_2h_magic_attack_01.glb",
  standing2hMagicAtk3:
    "./assets/glb/anims/extras/standing_2h_magic_attack_03.glb",
  standing2hMagicAtk4:
    "./assets/glb/anims/extras/standing_2h_magic_attack_04.glb",

  // -- Movement / utility --
  crouchIdle: "./assets/glb/anims/extras/crouch_idle.glb",
  standingToCrouch: "./assets/glb/anims/extras/standing_to_crouch.glb",
  coverToStand: "./assets/glb/anims/extras/cover_to_stand.glb",
  climbingLadder: "./assets/glb/anims/extras/climbing_ladder.glb",
  swaggerWalk: "./assets/glb/anims/extras/swagger_walk.glb",
  maleSittingPose: "./assets/glb/anims/extras/male_sitting_pose.glb",

  // -- Emote / social --
  standingTauntBattlecry:
    "./assets/glb/anims/extras/standing_taunt_battlecry.glb",
  pointing: "./assets/glb/anims/extras/pointing.glb",
  patting: "./assets/glb/anims/extras/patting.glb",
  reacting: "./assets/glb/anims/extras/reacting.glb",
  lookOverShoulder: "./assets/glb/anims/extras/look_over_shoulder.glb",
  disarmed: "./assets/glb/anims/extras/disarmed.glb",

  // -- Dance --
  bboyHipHopMove: "./assets/glb/anims/extras/bboy_hip_hop_move.glb",
  hipHopDancing: "./assets/glb/anims/extras/hip_hop_dancing.glb",
  sillyDancing: "./assets/glb/anims/extras/silly_dancing.glb",
  northernSoulSpin: "./assets/glb/anims/extras/northern_soul_spin_combo.glb",
  dancingRunningMan: "./assets/glb/anims/extras/dancing_running_man.glb",

  // -- Jump / acrobatics (from builder source, with character mesh) --
  greatSwordJumpAttack: "./assets/glb/anims/extras/great_sword_jump_attack.glb",
  jumpAttack: "./assets/glb/anims/extras/jump_attack.glb",
  jumping: "./assets/glb/anims/extras/jumping.glb",
  jumpingDown: "./assets/glb/anims/extras/jumping_down.glb",
  jumpInAir: "./assets/glb/anims/extras/jump_in_air.glb",
  jumpLoop: "./assets/glb/anims/extras/jump_loop.glb",
  stabbing: "./assets/glb/anims/extras/stabbing.glb",
  tripping: "./assets/glb/anims/extras/tripping.glb",

  // -- Race-specific source animations --
  brbMageCast: "./assets/glb/anims/extras/brb_mage_cast.glb",
  brbSpearmanAttack: "./assets/glb/anims/extras/brb_spearman_attack.glb",

  // -- VFX mesh models --
  vfxFireball: "./assets/glb/vfx/fireball.glb",
  vfxFireballLow: "./assets/glb/vfx/fireball_low.glb",
  vfxIceLance: "./assets/glb/vfx/ice_lance.glb",
  vfxIceLanceLow: "./assets/glb/vfx/ice_lance_low.glb",
  vfxPotion: "./assets/glb/vfx/potion.glb",
};

/**
 * Race-specific animation overrides (keyed by race id).
 * Values are partial ANIMATION_PACKS keys to override per-race.
 */
export const RACE_ANIM_OVERRIDES = {
  barbarian: {
    standingTauntBattlecry:
      "./assets/glb/anims/extras/standing_taunt_battlecry.glb",
  },
};

/**
 * Equipment slot definitions for each prefix.
 * Every race uses the same slot structure: body, arms, legs, head,
 * shoulders, weapons (R_hand), offhand (L_hand), shields (L_shield), extras.
 */
// Patterns match BOTH naming conventions:
//   Human/Elf/Dwarf/Orc/Undead:  Units_Body_A, Units_Arms_B, etc.
//   Barbarian:                    body_A, arms_B, head_C (no "Units_" prefix)
// Variant ranges widened to cover all races (barbarian body goes to H, head to J, etc.)
// Weapon patterns use optional variant suffix (?:_([A-Z]))? so single-variant
// weapons (e.g. ELF_weapon_axe, ORC_weapon_Hammer) still catalog correctly.
export const SLOT_PATTERNS = {
  body:       /(?:Units_)?body_([A-H])/i,
  arms:       /(?:Units_)?arms_([A-E])/i,
  legs:       /(?:Units_)?legs_([A-D])/i,
  head:       /(?:Units_)?head_([A-P])/i,
  shoulders:  /(?:Units_)?[Ss]houlderpads_([A-F])/i,
  sword:      /weapon_sword(?:_([A-C]))?$/i,
  axe:        /weapon_axe(?:_([A-C]))?$/i,
  hammer:     /weapon_hammer(?:_([A-B]))?$/i,
  mace:       /weapon_mace(?:_([A-C]))?$/i,
  pick:       /weapon_pick/i,
  spear:      /weapon_spear/i,
  bow:        /weapon_bow/i,
  staff:      /weapon_staff_([A-D])/i,
  dagger:     /weapon_dagger/i,
  shield:     /Shield_([A-D])/i,
  bag:        /Xtra_bag/i,
  wood:       /Xtra_wood/i,
  quiver:     /Xtra_quiver/i,
};

export const WEAPON_SLOTS = new Set(['sword', 'axe', 'hammer', 'mace', 'pick', 'spear', 'bow', 'staff', 'dagger']);
export const SHIELD_SLOTS = new Set(['shield']);
export const ARMOR_SLOTS  = new Set(['body', 'arms', 'legs', 'head', 'shoulders']);

export function getFaction(raceId) {
  return FACTIONS[raceId] || null;
}

// ── Mesh part classification (mirrors reference characterBuilder.classifyMeshPart) ──

export function classifyMeshPart(meshName) {
  const n = meshName.toLowerCase();
  if (n.includes('hair') || n.includes('beard') || n.includes('mustache') || n.includes('eyebrow')) return 'hair';
  if (n.includes('head'))  return 'head';
  if (n.includes('skin') || n.includes('naked') || n.includes('bare')) return 'skin';
  if ((n.includes('hand') || n.includes('palm') || n.includes('finger')) &&
      !n.includes('glove') && !n.includes('gauntlet')) return 'skin';
  if (n.includes('body'))  return 'body';
  if (n.includes('arms'))  return 'arms';
  if (n.includes('legs'))  return 'legs';
  if (n.includes('shoulderpad')) return 'shoulders';
  if (n.includes('shield')) return 'shields';
  if (n.includes('xtra_') || n.includes('_bag') || n.includes('_quiver') || n.includes('_wood')) return 'accessories';
  if (n.includes('weapon_') || n.includes('sword') || n.includes('axe') || n.includes('hammer') ||
      n.includes('staff') || n.includes('spear') || n.includes('bow') || n.includes('dagger') ||
      n.includes('pick'))  return 'weapons';
  return null;
}

/** Map part type → tint category */
export function getTintCategory(partType) {
  switch (partType) {
    case 'body': case 'arms': case 'legs': case 'shoulders': return 'clothing';
    case 'head': case 'skin': return 'skin';
    case 'hair': return 'hair';
    default: return 'none';
  }
}

/**
 * Per-slot PBR properties by armor type.
 * Roughness/metalness ranges match physically-grounded values from the reference.
 */
export const SLOT_PBR_PROPS = {
  metal: {
    head:       { roughness: 0.55, metalness: 0.02 },
    body:       { roughness: 0.34, metalness: 1.00 },
    arms:       { roughness: 0.38, metalness: 1.00 },
    legs:       { roughness: 0.42, metalness: 1.00 },
    shoulders:  { roughness: 0.30, metalness: 1.00 },
  },
  leather: {
    head:       { roughness: 0.55, metalness: 0.02 },
    body:       { roughness: 0.65, metalness: 0.00 },
    arms:       { roughness: 0.68, metalness: 0.00 },
    legs:       { roughness: 0.72, metalness: 0.00 },
    shoulders:  { roughness: 0.58, metalness: 0.00 },
  },
  cloth: {
    head:       { roughness: 0.45, metalness: 0.02 },
    body:       { roughness: 0.92, metalness: 0.00 },
    arms:       { roughness: 0.95, metalness: 0.00 },
    legs:       { roughness: 0.95, metalness: 0.00 },
    shoulders:  { roughness: 0.85, metalness: 0.00 },
  },
  shared: {
    weapons:    { roughness: 0.22, metalness: 1.00 },
    shields:    { roughness: 0.28, metalness: 0.92 },
    accessories:{ roughness: 0.55, metalness: 0.10 },
    skin:       { roughness: 0.60, metalness: 0.00 },
    hair:       { roughness: 0.55, metalness: 0.00 },
    default:    { roughness: 0.60, metalness: 0.05 },
  },
};

/** Get PBR props for a mesh part + armor type. */
export function getSlotPBR(partType, armorType) {
  const at = armorType || 'leather';
  const set = SLOT_PBR_PROPS[at];
  if (set && set[partType]) return set[partType];
  if (SLOT_PBR_PROPS.shared[partType]) return SLOT_PBR_PROPS.shared[partType];
  return SLOT_PBR_PROPS.shared.default;
}
