/**
 * GrudgeEquipmentManager.js
 * Babylon.js equipment slot system for the 6 Grudge Warlords race characters.
 *
 * Catalogs all child meshes of an imported FBX by prefix + slot pattern,
 * then exposes equip/unequip methods that toggle mesh visibility.
 */

import { SLOT_PATTERNS, WEAPON_SLOTS, SHIELD_SLOTS, ARMOR_SLOTS } from './GrudgeFactionRegistry.js';

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
          const variant = match[1] || 'default';
          this.slots[slotName].push({ variant, mesh });
          this._catalogedMeshes.add(mesh);
          // Start with everything hidden
          mesh.isVisible = false;
          matched = true;
          break;
        }
      }

      // Hide uncataloged meshes (skeleton helpers, unnamed children)
      // Keep only the root transform node visible (index 0)
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
      if (entry.variant === variant || entry.variant === 'default') {
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
      out[slot] = {
        variants: entries.map(e => e.variant),
        equipped: this.equipped[slot] || null,
      };
    }
    return out;
  }
}
