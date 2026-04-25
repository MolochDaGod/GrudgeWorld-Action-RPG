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
    modelPath: './assets/characters/races/human/WK_Characters_customizable.FBX',
    icon: null,
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
    modelPath: './assets/characters/races/barbarian/BRB_Characters_customizable.FBX',
    icon: null,
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
    modelPath: './assets/characters/races/elf/ELF_Characters_customizable.FBX',
    icon: null,
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
    modelPath: './assets/characters/races/dwarf/DWF_Characters_customizable.FBX',
    icon: null,
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
    modelPath: './assets/characters/races/orc/ORC_Characters_Customizable.FBX',
    icon: null,
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
    modelPath: './assets/characters/races/undead/UD_Characters_customizable.FBX',
    icon: null,
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
  idle:        './assets/characters/races/animations/idle.fbx',
  combatIdle:  './assets/characters/races/animations/combat_idle.fbx',
  combatRun:   './assets/characters/races/animations/combat_run.fbx',
  attack1:     './assets/characters/races/animations/attack1.fbx',
  attack2:     './assets/characters/races/animations/attack2.fbx',
  attack3:     './assets/characters/races/animations/attack3.fbx',
  death:       './assets/characters/races/animations/death.fbx',
  hit:         './assets/characters/races/animations/hit.fbx',
  block:       './assets/characters/races/animations/block.fbx',
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
  sword:      /Units_sword_([AB])/i,
  axe:        /Units_axe_([AB])/i,
  hammer:     /Units_hammer_([AB])/i,
  pick:       /Units_pick/i,
  spear:      /Units_spear/i,
  bow:        /Units_Bow/i,
  staff:      /Units_staff_([ABC])/i,
  shield:     /Units_shield_([A-D])/i,
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
