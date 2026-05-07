/**
 * GrudgeEquipmentManager.js
 * Babylon.js equipment slot system for the 6 Grudge Warlords race characters.
 *
 * Catalogs all child meshes of an imported FBX by prefix + slot pattern,
 * then exposes equip/unequip methods that toggle mesh visibility.
 */

import { SLOT_PATTERNS, WEAPON_SLOTS, SHIELD_SLOTS, ARMOR_SLOTS } from './GrudgeFactionRegistry.js';

// Derive tier from variant letter — mirrors the CSV Tier column:
// A/B = light/cloth, C/D/E = medium/leather, F/G/H+ = heavy/plate
const TIER_LETTERS = 'ABCDEFGHIJKLMNOP';
function _variantTier(v) {
  const i = v ? TIER_LETTERS.indexOf(v.toUpperCase()) : 0;
  if (i <= 1) return 'cloth';
  if (i <= 4) return 'leather';
  return 'plate';
}

export class GrudgeEquipmentManager {
  /**
   * @param {string} prefix - e.g. 'WK_', 'BRB_', 'ELF_', 'DWF_', 'ORC_', 'UD_'
   */
  constructor(prefix) {
    this.prefix = prefix;
    // Cataloged slots: { slotName -> [ {variant, mesh} ] }
    this.slots = {};
    // Currently equipped variant per slot
    this.equipped = {};
    this._root = null;
  }

  /**
   * Catalog all child AbstractMesh nodes from the imported model.
   * Call after BABYLON.SceneLoader.ImportMeshAsync resolves.
   * @param {BABYLON.AbstractMesh[]} meshes - result.meshes from ImportMeshAsync
   * @returns {Object} slots map
   */
  catalog(meshes) {
    this.slots = {};
    this._allMeshes = meshes;
    this._catalogedMeshes = new Set();

    for (const mesh of meshes) {
      const name = mesh.name || '';
      // Strip prefix to get the base slot name
      const stripped = name.startsWith(this.prefix) ? name.slice(this.prefix.length) : name;

      let matched = false;
      for (const [slotName, pattern] of Object.entries(SLOT_PATTERNS)) {
        const match = stripped.match(pattern);
        if (match) {
          if (!this.slots[slotName]) this.slots[slotName] = [];
          const variant =
            match[match.length - 1] && /^[A-Z]$/i.test(match[match.length - 1])
              ? match[match.length - 1].toUpperCase()
              : 'A'; // single-variant items (spear, bow, dagger, etc.) use 'A'
          const tier = _variantTier(variant);
          this.slots[slotName].push({ variant, tier, mesh });
          this._catalogedMeshes.add(mesh);
          // Start with everything hidden
          mesh.isVisible = false;
          matched = true;
          break;
        }
      }

      // Hide ALL uncataloged meshes. The old approach left uncataloged geometry
      // visible, which caused stacked/oversized renders when slot patterns
      // didn't match a race's naming convention. Only the equipment preset
      // should control visibility.
      if (!matched && mesh !== meshes[0]) {
        mesh.isVisible = false;
      }
    }

    return this.slots;
  }

  /**
   * Equip a specific variant for an armor/misc slot.
   * Hides all other variants in that slot.
   * @param {string} slotName - e.g. 'body', 'head'
   * @param {string} variant - e.g. 'A', 'B', 'C'
   */
  equip(slotName, variant) {
    const entries = this.slots[slotName];
    if (!entries) return;
    for (const entry of entries) {
      entry.mesh.isVisible = (entry.variant === variant);
    }
    this.equipped[slotName] = variant;
  }

  /**
   * Equip a weapon type (only one weapon shown at a time in R_hand).
   * @param {string} weaponType - e.g. 'sword', 'axe', 'bow', 'staff'
   * @param {string} variant - e.g. 'A', 'B'
   */
  equipWeapon(weaponType, variant = 'A') {
    // Hide all weapon-slot meshes first
    for (const slot of WEAPON_SLOTS) {
      const entries = this.slots[slot] || [];
      for (const entry of entries) {
        entry.mesh.isVisible = false;
      }
    }
    // Show the requested weapon variant
    const entries = this.slots[weaponType];
    if (!entries) return;
    for (const entry of entries) {
      if (entry.variant === variant) {
        entry.mesh.isVisible = true;
        break;
      }
    }
    this.equipped.weapon = { type: weaponType, variant };
  }

  /**
   * Equip a shield variant.
   * @param {string} variant - e.g. 'A', 'B', 'C', 'D'
   */
  equipShield(variant = 'A') {
    const entries = this.slots['shield'];
    if (!entries) return;
    for (const entry of entries) {
      entry.mesh.isVisible = (entry.variant === variant);
    }
    this.equipped.shield = variant;
  }

  /**
   * Unequip / hide all meshes in a slot.
   * @param {string} slotName
   */
  unequip(slotName) {
    const entries = this.slots[slotName] || [];
    for (const entry of entries) {
      entry.mesh.isVisible = false;
    }
    delete this.equipped[slotName];
  }

  /**
   * Apply a full equipment preset from a plain object.
   * @param {Object} preset - e.g. { body:'B', head:'C', weapon:{type:'sword',variant:'A'}, shield:'B' }
   */
  applyPreset(preset) {
    if (preset.body)      this.equip('body',      preset.body);
    if (preset.arms)      this.equip('arms',      preset.arms);
    if (preset.legs)      this.equip('legs',      preset.legs);
    if (preset.head)      this.equip('head',      preset.head);
    if (preset.shoulders) this.equip('shoulders', preset.shoulders);
    if (preset.weapon)    this.equipWeapon(preset.weapon.type, preset.weapon.variant);
    if (preset.shield)    this.equipShield(preset.shield);
  }

  /**
   * Show every cataloged mesh (debug / show-all mode).
   */
  showAll() {
    for (const entries of Object.values(this.slots)) {
      for (const entry of entries) {
        entry.mesh.isVisible = true;
      }
    }
  }

  /**
   * Hide every cataloged mesh.
   */
  hideAll() {
    for (const entries of Object.values(this.slots)) {
      for (const entry of entries) {
        entry.mesh.isVisible = false;
      }
    }
  }

  /**
   * Get all variant names available for a slot.
   * @param {string} slotName
   * @returns {string[]}
   */
  getVariants(slotName) {
    return (this.slots[slotName] || []).map(e => e.variant);
  }

  /**
   * Get a summary of all slots and their variants (for UI building).
   * @returns {Object}
   */
  getSummary() {
    const out = {};
    for (const [slot, entries] of Object.entries(this.slots)) {
      const equippedVariant = this.equipped[slot] || null;
      const equippedEntry = entries.find(e => e.variant === equippedVariant);
      out[slot] = {
        variants: entries.map(e => e.variant),
        tiers:    entries.map(e => e.tier),
        equipped: equippedVariant,
        equippedTier: equippedEntry?.tier || null,
      };
    }
    return out;
  }
}
