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
    icon: null,
    prefab: { targetHeight: 1.85, groundOffset: -1.1, yaw: Math.PI, materialTint: [0.95, 0.92, 0.88] },
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
    icon: null,
    prefab: { targetHeight: 1.95, groundOffset: -1.1, yaw: Math.PI, materialTint: [0.92, 0.86, 0.80] },
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
    icon: null,
    prefab: { targetHeight: 1.8, groundOffset: -1.1, yaw: Math.PI, materialTint: [0.88, 0.95, 0.90] },
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
    icon: null,
    prefab: { targetHeight: 1.6, groundOffset: -1.1, yaw: Math.PI, materialTint: [0.90, 0.86, 0.82] },
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
    icon: null,
    prefab: { targetHeight: 2.0, groundOffset: -1.1, yaw: Math.PI, materialTint: [0.84, 0.90, 0.82] },
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
    icon: null,
    prefab: { targetHeight: 1.9, groundOffset: -1.1, yaw: Math.PI, materialTint: [0.86, 0.88, 0.90] },
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
export const SLOT_PATTERNS = {
  body:       /Units_Body_([A-E])/i,
  arms:       /Units_Arms_([A-D])/i,
  legs:       /Units_Legs_([A-C])/i,
  head:       /Units_head_([A-I])/i,
  shoulders:  /Units_shoulderpads_([AB])/i,
  sword:      /(weapon_sword|Units_sword)_([AB])/i,
  axe:        /(weapon_axe|Units_axe)_([AB])/i,
  hammer:     /(weapon_hammer|Units_hammer)_([AB])/i,
  pick:       /(weapon_pick|Units_pick)/i,
  spear:      /(weapon_spear|Units_spear)/i,
  bow:        /(weapon_Bow|Units_Bow)/i,
  staff:      /(weapon_staff|Units_staff)_([ABC])/i,
  shield:     /(Shield|Units_shield)_([A-D])/i,
  bag:        /Xtra_bag/i,
  wood:       /Xtra_wood/i,
  quiver:     /Xtra_quiver/i,
};

export const WEAPON_SLOTS = new Set(['sword', 'axe', 'hammer', 'pick', 'spear', 'bow', 'staff']);
export const SHIELD_SLOTS = new Set(['shield']);
export const ARMOR_SLOTS  = new Set(['body', 'arms', 'legs', 'head', 'shoulders']);

export function getFaction(raceId) {
  return FACTIONS[raceId] || null;
}
