/**
 * KeybindManager.js
 * Grudge Warlords — Centralized keybind system
 *
 * All game input reads from here. Persists to localStorage.
 * Supports rebinding, mouse buttons, and animation-to-hotbar attachment.
 *
 * Default bindings (user-specified):
 *   Space   = Jump          Ctrl    = Roll
 *   Mouse5  = Roll (alt)    C       = Main Panel
 *   F5      = Camera Swap   Tab     = Target Cycle
 *   I       = Inventory     S       = Skills
 *   P       = Admin Panel   Escape  = Close All
 *   F       = Sprint Toggle
 *   1-8     = Hotbar Slots
 *   WASD    = Move           Q/E    = Strafe
 */

const STORAGE_KEY = 'grudge_keybinds';
const HOTBAR_STORAGE_KEY = 'grudge_hotbar_slots';

// ── Default keybind map ──────────────────────────────────────────────────────

const DEFAULT_BINDS = {
  // Movement
  moveForward:   'w',
  moveBack:      's',
  strafeLeft:    'q',
  strafeRight:   'e',
  moveLeft:      'a',
  moveRight:     'd',

  // Actions
  jump:          ' ',          // Space
  roll:          'Control',    // Ctrl
  roll2:         'Mouse5',     // Mouse button 5
  sprint:        'f',

  // Combat
  attack:        'Mouse1',     // LMB (handled separately)
  aim:           'Mouse2',     // RMB

  // UI
  mainPanel:     'c',
  inventory:     'i',
  skills:        's',
  adminPanel:    'p',
  closeAll:      'Escape',

  // Targeting
  target:        'Tab',

  // Camera
  cameraSwap:    'F5',

  // Hotbar (1-8)
  slot1: '1', slot2: '2', slot3: '3', slot4: '4',
  slot5: '5', slot6: '6', slot7: '7', slot8: '8',
};

// ── Default hotbar slot contents ─────────────────────────────────────────────
// Each slot: { type: 'skill'|'anim'|'item'|'empty', key, label, icon }

const DEFAULT_HOTBAR = [
  { type: 'skill', key: 'attack1',    label: 'Attack 1',  icon: '⚔' },
  { type: 'skill', key: 'attack2',    label: 'Attack 2',  icon: '🗡' },
  { type: 'skill', key: 'attack3',    label: 'Attack 3',  icon: '💥' },
  { type: 'skill', key: 'combatRun',  label: 'Charge',    icon: '🏃' },
  { type: 'empty', key: '',           label: '',          icon: '' },   // slot 5 empty per user pref
  { type: 'item',  key: 'food',       label: 'Ration',    icon: '🍖' },
  { type: 'item',  key: 'potion',     label: 'Potion',    icon: '🧪' },
  { type: 'item',  key: 'relic',      label: 'Relic',     icon: '🔱' },
];

// ═══════════════════════════════════════════════════════════════════════════════

export class KeybindManager {
  constructor() {
    this._binds = { ...DEFAULT_BINDS };
    this._hotbar = DEFAULT_HOTBAR.map(s => ({ ...s }));
    this._listeners = [];
    this._rebinding = null;  // { action, callback } when waiting for key press
    this._load();
  }

  // ── Keybind API ──────────────────────────────────────────────────────────────

  /** Get the key assigned to an action */
  getKey(action) {
    return this._binds[action] ?? DEFAULT_BINDS[action] ?? null;
  }

  /** Get all binds as { action: key } */
  getAllBinds() {
    return { ...this._binds };
  }

  /** Check if a key matches an action */
  matches(action, eventKey) {
    const bound = this.getKey(action);
    if (!bound) return false;
    // Normalize for comparison
    return bound.toLowerCase() === eventKey.toLowerCase();
  }

  /** Check if an event key matches any of the given actions */
  matchesAny(actions, eventKey) {
    return actions.some(a => this.matches(a, eventKey));
  }

  /** Rebind an action to a new key */
  rebind(action, newKey) {
    if (!DEFAULT_BINDS.hasOwnProperty(action)) return false;
    this._binds[action] = newKey;
    this._save();
    this._notify();
    return true;
  }

  /** Reset a single action to default */
  resetAction(action) {
    if (DEFAULT_BINDS[action]) {
      this._binds[action] = DEFAULT_BINDS[action];
      this._save();
      this._notify();
    }
  }

  /** Reset ALL keybinds to defaults */
  resetAll() {
    this._binds = { ...DEFAULT_BINDS };
    this._save();
    this._notify();
  }

  /** Start rebind mode — next keypress will bind to this action */
  startRebind(action, callback) {
    this._rebinding = { action, callback };
  }

  /** Cancel rebind mode */
  cancelRebind() {
    this._rebinding = null;
  }

  /** Feed a keydown event — if rebinding, capture it */
  feedKeyEvent(event) {
    if (!this._rebinding) return false;
    const key = event.key;
    this.rebind(this._rebinding.action, key);
    if (this._rebinding.callback) this._rebinding.callback(this._rebinding.action, key);
    this._rebinding = null;
    return true; // consumed
  }

  /** Feed a mouse event for rebinding mouse buttons */
  feedMouseEvent(event) {
    if (!this._rebinding) return false;
    const mouseKey = `Mouse${event.button + 1}`;
    this.rebind(this._rebinding.action, mouseKey);
    if (this._rebinding.callback) this._rebinding.callback(this._rebinding.action, mouseKey);
    this._rebinding = null;
    return true;
  }

  // ── Hotbar API ────────────────────────────────────────────────────────────────

  /** Get hotbar slot contents (0-7) */
  getHotbarSlot(index) {
    return this._hotbar[index] ?? { type: 'empty', key: '', label: '', icon: '' };
  }

  /** Get all 8 hotbar slots */
  getAllHotbar() {
    return this._hotbar.map(s => ({ ...s }));
  }

  /** Set a hotbar slot */
  setHotbarSlot(index, slotData) {
    if (index < 0 || index > 7) return;
    this._hotbar[index] = { ...slotData };
    this._saveHotbar();
    this._notify();
  }

  /** Assign an animation to a hotbar slot */
  assignAnimToSlot(index, animKey, label, icon = '🎬') {
    this.setHotbarSlot(index, { type: 'anim', key: animKey, label, icon });
  }

  /** Clear a hotbar slot */
  clearHotbarSlot(index) {
    this.setHotbarSlot(index, { type: 'empty', key: '', label: '', icon: '' });
  }

  /** Reset hotbar to defaults */
  resetHotbar() {
    this._hotbar = DEFAULT_HOTBAR.map(s => ({ ...s }));
    this._saveHotbar();
    this._notify();
  }

  // ── Change listeners ──────────────────────────────────────────────────────────

  /** Register a callback for when binds change */
  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  }

  _notify() {
    for (const fn of this._listeners) fn(this);
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(this._binds, saved);
      }
    } catch (_) {}
    try {
      const raw = localStorage.getItem(HOTBAR_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length === 8) {
          this._hotbar = saved;
        }
      }
    } catch (_) {}
  }

  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._binds)); }
    catch (_) {}
  }

  _saveHotbar() {
    try { localStorage.setItem(HOTBAR_STORAGE_KEY, JSON.stringify(this._hotbar)); }
    catch (_) {}
  }

  // ── Display helpers ───────────────────────────────────────────────────────────

  /** Get human-readable name for a key */
  static displayKey(key) {
    const MAP = {
      ' ': 'Space', 'Control': 'Ctrl', 'Shift': 'Shift', 'Alt': 'Alt',
      'Tab': 'Tab', 'Escape': 'Esc', 'Enter': 'Enter',
      'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
      'Mouse1': 'LMB', 'Mouse2': 'RMB', 'Mouse3': 'MMB', 'Mouse4': 'M4', 'Mouse5': 'M5',
    };
    return MAP[key] || key.toUpperCase();
  }

  /** Get all action names grouped by category */
  static getActionGroups() {
    return {
      'Movement': ['moveForward','moveBack','strafeLeft','strafeRight','moveLeft','moveRight'],
      'Actions':  ['jump','roll','roll2','sprint'],
      'Combat':   ['attack','aim','target'],
      'UI':       ['mainPanel','inventory','skills','adminPanel','closeAll','cameraSwap'],
      'Hotbar':   ['slot1','slot2','slot3','slot4','slot5','slot6','slot7','slot8'],
    };
  }

  /** Friendly action names */
  static actionLabel(action) {
    const MAP = {
      moveForward: 'Move Forward', moveBack: 'Move Back',
      strafeLeft: 'Strafe Left', strafeRight: 'Strafe Right',
      moveLeft: 'Move Left', moveRight: 'Move Right',
      jump: 'Jump', roll: 'Roll', roll2: 'Roll (Alt)', sprint: 'Sprint Toggle',
      attack: 'Attack', aim: 'Aim', target: 'Cycle Target',
      mainPanel: 'Main Panel', inventory: 'Inventory', skills: 'Skills',
      adminPanel: 'Admin Panel', closeAll: 'Close All', cameraSwap: 'Camera Swap',
      slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3', slot4: 'Slot 4',
      slot5: 'Slot 5', slot6: 'Slot 6', slot7: 'Slot 7', slot8: 'Slot 8',
    };
    return MAP[action] || action;
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

export const keybinds = new KeybindManager();
