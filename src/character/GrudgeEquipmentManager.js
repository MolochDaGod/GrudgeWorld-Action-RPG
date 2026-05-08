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
    // Armor type last applied via applyPreset ('cloth'|'leather'|'metal')
    this._armorType = null;
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
      const name = mesh.name || "";
      // Strip prefix to get the base slot name
      const stripped = name.startsWith(this.prefix)
        ? name.slice(this.prefix.length)
        : name;

      let matched = false;
      for (const [slotName, pattern] of Object.entries(SLOT_PATTERNS)) {
        const match = stripped.match(pattern);
        if (match) {
          if (!this.slots[slotName]) this.slots[slotName] = [];
          const variant =
            match[match.length - 1] && /^[A-Z]$/i.test(match[match.length - 1])
              ? match[match.length - 1].toUpperCase()
              : "A"; // single-variant items (spear, bow, dagger, etc.) use 'A'
          this.slots[slotName].push({ variant, mesh });
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
   * Hides all other variants in that slot. If the requested variant doesn't
   * exist in the catalog, falls back to the first available variant so the
   * slot never ends up fully hidden by a stale preset.
   * @param {string} slotName - e.g. 'body', 'head'
   * @param {string} variant - e.g. 'A', 'B', 'C'
   */
  equip(slotName, variant) {
    const entries = this.slots[slotName];
    if (!entries || entries.length === 0) return;
    const wanted = String(variant || "").toUpperCase();
    let resolved = entries.find((e) => e.variant === wanted) ? wanted : null;
    if (!resolved) {
      resolved = entries[0].variant;
      if (wanted) {
        console.warn(
          `[GrudgeEquip] ${this.prefix}${slotName}: variant '${wanted}' not found ` +
            `(have [${entries.map((e) => e.variant).join(",")}]) — falling back to '${resolved}'.`,
        );
      }
    }
    for (const entry of entries) {
      entry.mesh.isVisible = entry.variant === resolved;
    }
    this.equipped[slotName] = resolved;
  }

  /**
   * Equip a weapon type (only one weapon shown at a time in R_hand).
   * @param {string} weaponType - e.g. 'sword', 'axe', 'bow', 'staff'
   * @param {string} variant - e.g. 'A', 'B'
   */
  equipWeapon(weaponType, variant = "A") {
    // Hide all weapon-slot meshes first
    for (const slot of WEAPON_SLOTS) {
      const entries = this.slots[slot] || [];
      for (const entry of entries) {
        entry.mesh.isVisible = false;
      }
    }
    const entries = this.slots[weaponType];
    if (!entries || entries.length === 0) {
      console.warn(
        `[GrudgeEquip] ${this.prefix}weapon '${weaponType}' not in catalog — hands empty.`,
      );
      return;
    }
    const wanted = String(variant || "A").toUpperCase();
    const hit = entries.find((e) => e.variant === wanted) || entries[0];
    hit.mesh.isVisible = true;
    this.equipped.weapon = { type: weaponType, variant: hit.variant };
  }

  /**
   * Equip a shield variant. Falls back to the first available variant if the
   * requested letter isn't in the catalog.
   * @param {string} variant - e.g. 'A', 'B', 'C', 'D'
   */
  equipShield(variant = "A") {
    this.equip("shield", variant);
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
   * @param {string} [armorType] - 'cloth'|'leather'|'metal' — stored for getSummary() tier label
   */
  applyPreset(preset, armorType) {
    if (armorType) this._armorType = armorType;
    const p = preset || {};
    // Body/arms/legs/head are MANDATORY — if the preset omits a slot we still
    // call equip() with 'A' so equip()'s fallback always picks a valid variant.
    // This prevents the "invisible character" failure mode where a stale or
    // mistyped preset hides every body mesh and leaves only a weapon visible.
    this.equip("body", p.body || "A");
    this.equip("arms", p.arms || "A");
    this.equip("legs", p.legs || "A");
    this.equip("head", p.head || "A");
    if (p.shoulders) this.equip("shoulders", p.shoulders);
    if (p.weapon) this.equipWeapon(p.weapon.type, p.weapon.variant);
    if (p.shield) this.equipShield(p.shield);
  }

  /**
   * Emergency render fallback — show body/arms/legs/head variant 'A' (or the
   * first cataloged variant in each slot) and nothing else. Use when something
   * goes wrong with the preset pipeline and you need *anything* on screen.
   */
  forceDefaults() {
    this.hideAll();
    this.equip("body", "A");
    this.equip("arms", "A");
    this.equip("legs", "A");
    this.equip("head", "A");
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
    return (this.slots[slotName] || []).map((e) => e.variant);
  }

  /**
   * Get a summary of all slots and their variants (for UI building).
   * @returns {Object}
   */
  getSummary() {
    const out = {};
    for (const [slot, entries] of Object.entries(this.slots)) {
      const equippedVariant = this.equipped[slot] || null;
      out[slot] = {
        variants: entries.map((e) => e.variant),
        equipped: equippedVariant,
        // armorType set by applyPreset — reliable for all races regardless of letter position
        equippedTier: ARMOR_SLOTS.has(slot) ? this._armorType : null,
      };
    }
    return out;
  }
}
