/**
 * weaponSkills.js
 * Maps weapon types → available spells/skills per class.
 * Falls back to hardcoded defaults if GrudgeSDK.fetchWeaponSkills() is offline.
 *
 * Usage:
 *   import { getSkillsForWeapon, WEAPON_SKILL_MAP } from './weaponSkills.js';
 *   const skills = getSkillsForWeapon('sword', 'warrior');
 */

import { SPELLS } from './SPELLS.js';

// ── Default weapon → spell keys (shared across classes unless overridden) ────

const BASE_WEAPON_SKILLS = {
  sword:   ['quickSwing', 'heavySwing', 'iceSwing', 'lightningSwing'],
  axe:     ['quickSwing', 'heavySwing', 'darkSwing', 'poisonStrike'],
  hammer:  ['quickSwing', 'heavySwing', 'groundSlam', 'holySwing'],
  spear:   ['quickSwing', 'heavySwing', 'lightningSwing', 'arcaneSwing'],
  pick:    ['quickSwing', 'heavySwing'],
  bow:     ['fireball', 'thunderball', 'poisonStrike'],
  staff:   ['thunderball', 'tripleOrb', 'blizzard', 'healTouch', 'regeneration'],
  shield:  [],  // defensive only
};

// ── Class-specific overrides (some classes get extra or restricted skills) ────

const CLASS_WEAPON_OVERRIDES = {
  warrior: {
    sword:  ['quickSwing', 'heavySwing', 'iceSwing', 'lightningSwing', 'groundSlam'],
    axe:    ['quickSwing', 'heavySwing', 'darkSwing', 'poisonStrike', 'groundSlam'],
    hammer: ['quickSwing', 'heavySwing', 'groundSlam', 'holySwing'],
  },
  ranger: {
    bow:    ['fireball', 'thunderball', 'poisonStrike', 'tripleOrb'],
    sword:  ['quickSwing', 'heavySwing', 'poisonStrike'],
    spear:  ['quickSwing', 'heavySwing', 'lightningSwing'],
  },
  mage: {
    staff:  ['thunderball', 'tripleOrb', 'blizzard', 'healTouch', 'regeneration', 'groundSlam'],
    sword:  ['arcaneSwing', 'lightningSwing', 'thunderball'],
  },
  worge: {
    sword:  ['quickSwing', 'heavySwing', 'darkSwing', 'poisonStrike'],
    axe:    ['quickSwing', 'heavySwing', 'darkSwing', 'groundSlam'],
    spear:  ['quickSwing', 'heavySwing', 'poisonStrike'],
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the spell keys available for a weapon type + class combo.
 * @param {string} weaponType - 'sword', 'bow', 'staff', etc.
 * @param {string} classId - 'warrior', 'ranger', 'mage', 'worge'
 * @returns {string[]} Array of spell keys from SPELLS
 */
export function getSkillKeysForWeapon(weaponType, classId) {
  const overrides = CLASS_WEAPON_OVERRIDES[classId];
  if (overrides && overrides[weaponType]) {
    return overrides[weaponType];
  }
  return BASE_WEAPON_SKILLS[weaponType] || ['quickSwing'];
}

/**
 * Get full Spell objects for a weapon type + class combo.
 * @param {string} weaponType - 'sword', 'bow', 'staff', etc.
 * @param {string} classId - 'warrior', 'ranger', 'mage', 'worge'
 * @returns {Array<{key: string, spell: Spell}>}
 */
export function getSkillsForWeapon(weaponType, classId) {
  const keys = getSkillKeysForWeapon(weaponType, classId);
  return keys
    .filter(k => SPELLS[k])
    .map(k => ({ key: k, spell: SPELLS[k] }));
}

/**
 * Get a display-friendly skill list for UI rendering.
 * @param {string} weaponType
 * @param {string} classId
 * @returns {Array<{key, name, damage, element, range}>}
 */
export function getSkillDisplayList(weaponType, classId) {
  const skills = getSkillsForWeapon(weaponType, classId);
  return skills.map(({ key, spell }) => {
    const dmgEffect = spell.effects?.find(e => e.type === 'damage');
    const healEffect = spell.effects?.find(e => e.type === 'heal');
    const dotEffect = spell.effects?.find(e => e.type === 'dot');
    let element = 'physical';
    if (key.includes('ice') || key.includes('blizzard')) element = 'ice';
    else if (key.includes('poison')) element = 'poison';
    else if (key.includes('arcane')) element = 'arcane';
    else if (key.includes('lightning') || key.includes('thunder')) element = 'lightning';
    else if (key.includes('dark')) element = 'dark';
    else if (key.includes('holy')) element = 'holy';
    else if (key.includes('fire')) element = 'fire';
    else if (key.includes('heal') || key.includes('regen')) element = 'heal';
    else if (key.includes('ground') || key.includes('triple') || key.includes('blizzard')) element = 'arcane';

    return {
      key,
      name: spell.name,
      damage: dmgEffect ? dmgEffect.value : (healEffect ? healEffect.value : 0),
      heal: healEffect ? healEffect.value : 0,
      dot: dotEffect ? `${dotEffect.value}/s` : null,
      element,
      range: spell.range || spell.radius || 0,
    };
  });
}

/** Element → emoji icon for UI */
export const ELEMENT_ICONS = {
  physical: '⚔',
  fire: '🔥',
  ice: '❄',
  poison: '☠',
  arcane: '✨',
  lightning: '⚡',
  dark: '🌑',
  holy: '☀',
  heal: '💚',
};

/** Element → CSS color for UI */
export const ELEMENT_COLORS = {
  physical: '#b8b8c0',
  fire: '#ff6b35',
  ice: '#00d4ff',
  poison: '#44ff44',
  arcane: '#cc44ff',
  lightning: '#ffee44',
  dark: '#8844cc',
  holy: '#fff080',
  heal: '#44ff88',
};
