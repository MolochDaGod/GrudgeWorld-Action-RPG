/**
 * CharacterPanel.js
 * Three.js Character Panel for Grudge Warlords — plain HTML/CSS overlay.
 * No Babylon.GUI, no React. Just DOM + CSS over the Three.js canvas.
 *
 * Usage:
 *   const panel = new CharacterPanel({ onRaceChange, onEquipChange, onAnimPlay });
 *   document.body.appendChild(panel.element);
 *
 *   // After loading a character model:
 *   panel.setRetargetTarget(object3D, threeScene, animationMixer);
 *
 *   // When equipment data is available:
 *   panel.refreshFromEquipManager(equipManager);
 */

import {
  FACTIONS,
  RACE_ORDER,
  ARMOR_SLOTS,
  WEAPON_SLOTS,
} from "./GrudgeFactionRegistry.js";
import { AnimRetargeter } from "./AnimRetargeter.js";

// ─── Styles (injected once) ───────────────────────────────────────────────────

const STYLE_ID = "grudge-character-panel-styles";
function _injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #grudge-character-panel {
      position: fixed;
      top: 0; left: 0;
      width: 300px; height: 100vh;
      overflow-y: auto;
      background: rgba(8,10,18,0.92);
      color: #aaa;
      font-family: 'Cinzel', Georgia, serif;
      font-size: 11px;
      box-sizing: border-box;
      padding: 0 0 30px 0;
      z-index: 100;
      scrollbar-width: thin;
      scrollbar-color: #c8a951 #111;
    }
    #grudge-character-panel::-webkit-scrollbar { width: 6px; }
    #grudge-character-panel::-webkit-scrollbar-thumb { background: #c8a951; border-radius: 3px; }
    #grudge-character-panel::-webkit-scrollbar-track { background: #111; }

    .cp-header { text-align: center; padding: 16px 10px 4px; color: #c8a951; font-size: 15px; font-weight: bold; letter-spacing: 3px; }
    .cp-sub    { text-align: center; padding: 0 10px 10px; color: #666; font-size: 9px; letter-spacing: 2px; }

    .cp-section { color: #c8a951; font-size: 9px; font-weight: bold; letter-spacing: 2px;
                  padding: 10px 10px 4px; border-top: 1px solid #1a1a2e; }

    .cp-race-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; padding: 4px 10px; }
    .cp-race-btn {
      padding: 5px 2px; font-size: 9px; font-family: inherit; font-weight: bold;
      background: transparent; color: #666; border: 1px solid #333; border-radius: 3px;
      cursor: pointer; transition: all 0.15s; letter-spacing: 1px;
    }
    .cp-race-btn:hover { color: #c8a951; border-color: #c8a951; }
    .cp-race-btn.active { color: #c8a951; background: rgba(200,169,81,0.18); border-color: #c8a951; }

    .cp-race-color-bar { height: 3px; margin: 4px 10px; border-radius: 2px; }
    .cp-race-desc { padding: 4px 10px 2px; color: #888; font-size: 9px; line-height: 1.5; font-family: Georgia, serif; }
    .cp-faction-label { padding: 2px 10px 6px; font-size: 9px; letter-spacing: 1px; }

    .cp-stat-row { display: flex; align-items: center; padding: 2px 10px; gap: 6px; }
    .cp-stat-label { width: 32px; color: #888; font-size: 9px; }
    .cp-stat-track { flex: 1; height: 7px; background: #222; border-radius: 4px; overflow: hidden; }
    .cp-stat-fill  { height: 100%; background: #c8a951; border-radius: 4px; transition: width 0.3s; }
    .cp-stat-val   { width: 24px; text-align: right; color: #f0d070; font-size: 9px; }

    .cp-equip-container { padding: 0 10px; }
    .cp-equip-row { display: flex; align-items: center; height: 24px; gap: 4px; }
    .cp-equip-label { width: 88px; color: #888; font-size: 9px; flex-shrink: 0; }
    .cp-equip-btn {
      flex: 1; height: 20px; font-size: 8px; font-family: inherit;
      background: transparent; color: #c8a951; border: 1px solid #333; border-radius: 3px; cursor: pointer;
    }
    .cp-equip-btn:hover { border-color: #c8a951; }
    .cp-equip-btn.selected { background: rgba(200,169,81,0.28); }
    .cp-equip-btn:disabled { color: #444; cursor: default; border-color: #222; }

    .cp-anim-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px 10px; }
    .cp-anim-btn {
      padding: 5px 4px; font-size: 9px; font-family: inherit;
      background: transparent; color: #c8a951; border: 1px solid #333; border-radius: 3px; cursor: pointer;
    }
    .cp-anim-btn:hover { border-color: #c8a951; background: rgba(200,169,81,0.12); }
    .cp-anim-btn.flash { background: rgba(200,169,81,0.35); }

    .cp-retarget-status {
      padding: 6px 10px; font-size: 9px; color: #888; line-height: 1.4; font-family: Georgia, serif;
    }
    .cp-retarget-canvas-hint {
      margin: 4px 10px 8px; padding: 8px; border: 1px dashed #333; border-radius: 4px;
      text-align: center; font-size: 9px; color: #555;
    }
    .cp-retarget-canvas-hint.drag-over { border-color: #c8a951; color: #c8a951; background: rgba(200,169,81,0.06); }
    .cp-btn-small {
      margin: 2px 10px; padding: 3px 8px; font-size: 9px; font-family: inherit;
      background: transparent; color: #666; border: 1px solid #333; border-radius: 3px; cursor: pointer;
    }
    .cp-btn-small:hover { color: #c8a951; border-color: #555; }
  `;
  document.head.appendChild(style);
}

// ─── CharacterPanelDOM (Three.js / DOM overlay version) ──────────────────────

export class CharacterPanelDOM {
  /**
   * @param {object} opts
   * @param {Function} opts.onRaceChange   cb(raceId)
   * @param {Function} opts.onEquipChange  cb(slot, variant)
   * @param {Function} opts.onAnimPlay     cb(animKey)
   */
  constructor({ onRaceChange, onEquipChange, onAnimPlay } = {}) {
    this._onRaceChange = onRaceChange || (() => {});
    this._onEquipChange = onEquipChange || (() => {});
    this._onAnimPlay = onAnimPlay || (() => {});
    this._activeRace = "human";
    this._slotSummary = {};
    this._raceButtons = {};

    // Retarget state
    this._targetObject = null;
    this._targetMixer = null;
    this._retargeter = null;

    _injectStyles();
    this._buildDOM();
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────

  _buildDOM() {
    this.element = document.createElement("div");
    this.element.id = "grudge-character-panel";

    this.element.innerHTML = `
      <div class="cp-header">GRUDGE WARLORDS</div>
      <div class="cp-sub">CHARACTER BUILDER</div>

      <div class="cp-section">SELECT RACE</div>
      <div class="cp-race-grid" id="cp-race-grid"></div>

      <div class="cp-race-color-bar" id="cp-race-color-bar"></div>
      <div class="cp-race-desc" id="cp-race-desc"></div>
      <div class="cp-faction-label" id="cp-faction-label"></div>

      <div class="cp-section">BASE ATTRIBUTES</div>
      <div id="cp-stats"></div>

      <div class="cp-section">EQUIPMENT</div>
      <div class="cp-equip-container" id="cp-equip-container"></div>

      <div class="cp-section">ANIMATIONS</div>
      <div class="cp-anim-grid" id="cp-anim-grid"></div>

      <div class="cp-section">MIXAMO RETARGET</div>
      <div class="cp-retarget-status" id="cp-retarget-status">Drop a Mixamo GLB onto the canvas below.</div>
      <div class="cp-retarget-canvas-hint" id="cp-retarget-drop-hint">Drop .glb here or onto the 3D canvas</div>
      <button class="cp-btn-small" id="cp-list-bones-btn">List Target Bones</button>
    `;

    this._buildRaceGrid();
    this._buildStats();
    this._buildAnimGrid();
    this._updateRaceInfo(this._activeRace);
    this._refreshEquipSlots();
    this._wireRetarget();
  }

  // ── Race Grid ─────────────────────────────────────────────────────────────

  _buildRaceGrid() {
    const grid = this.element.querySelector("#cp-race-grid");
    RACE_ORDER.forEach((raceId) => {
      const faction = FACTIONS[raceId];
      const btn = document.createElement("button");
      btn.className =
        "cp-race-btn" + (raceId === this._activeRace ? " active" : "");
      btn.textContent = faction.name;
      btn.addEventListener("click", () => this._selectRace(raceId));
      this._raceButtons[raceId] = btn;
      grid.appendChild(btn);
    });
  }

  _selectRace(raceId) {
    Object.entries(this._raceButtons).forEach(([id, btn]) => {
      btn.classList.toggle("active", id === raceId);
    });
    this._activeRace = raceId;
    this._updateRaceInfo(raceId);
    this._onRaceChange(raceId);
  }

  _updateRaceInfo(raceId) {
    const faction = FACTIONS[raceId];
    this.element.querySelector("#cp-race-color-bar").style.background =
      faction.color;
    this.element.querySelector("#cp-race-desc").textContent =
      faction.description;
    const fl = this.element.querySelector("#cp-faction-label");
    fl.textContent = `FACTION: ${faction.faction.toUpperCase()}`;
    fl.style.color = faction.color;
    this._updateStats(faction.stats);
    this._refreshEquipSlots();
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  _buildStats() {
    const container = this.element.querySelector("#cp-stats");
    this._statFills = {};
    this._statVals = {};

    const ATTRS = [
      ["STR", "str"],
      ["DEX", "dex"],
      ["INT", "int"],
      ["VIT", "vit"],
      ["WIS", "wis"],
      ["LCK", "lck"],
      ["CHA", "cha"],
      ["END", "end"],
    ];

    ATTRS.forEach(([label, key]) => {
      const row = document.createElement("div");
      row.className = "cp-stat-row";
      row.innerHTML = `
        <span class="cp-stat-label">${label}</span>
        <div class="cp-stat-track"><div class="cp-stat-fill" id="cp-fill-${key}" style="width:0%"></div></div>
        <span class="cp-stat-val" id="cp-val-${key}">0</span>
      `;
      container.appendChild(row);
      this._statFills[key] = row.querySelector(`#cp-fill-${key}`);
      this._statVals[key] = row.querySelector(`#cp-val-${key}`);
    });

    this._updateStats(FACTIONS[this._activeRace].stats);
  }

  _updateStats(stats) {
    const MAX = 25;
    Object.entries(this._statFills).forEach(([key, fill]) => {
      const v = stats[key] || 0;
      fill.style.width = `${Math.min((v / MAX) * 100, 100)}%`;
      this._statVals[key].textContent = String(v);
    });
  }

  // ── Equipment Slots ───────────────────────────────────────────────────────

  refreshFromEquipManager(equipManager) {
    this._slotSummary = equipManager.getSummary();
    this._refreshEquipSlots();
  }

  _refreshEquipSlots() {
    const container = this.element.querySelector("#cp-equip-container");
    container.innerHTML = "";

    const SLOT_DISPLAY = [
      ["body", "Body Armor"],
      ["arms", "Arm Guards"],
      ["legs", "Leg Guards"],
      ["head", "Helmet"],
      ["shoulders", "Shoulders"],
      ["sword", "Sword"],
      ["axe", "Axe"],
      ["hammer", "Hammer"],
      ["bow", "Bow"],
      ["staff", "Staff"],
      ["shield", "Shield"],
    ];

    const BASE_ARMOR = ["body", "arms", "legs", "head"];

    SLOT_DISPLAY.forEach(([slot, label]) => {
      const slotInfo = this._slotSummary[slot];
      const variants = slotInfo ? slotInfo.variants : [];
      if (variants.length === 0 && !BASE_ARMOR.includes(slot)) return;

      const row = document.createElement("div");
      row.className = "cp-equip-row";

      const lbl = document.createElement("span");
      lbl.className = "cp-equip-label";
      lbl.textContent = label;
      row.appendChild(lbl);

      const displayVariants = variants.length > 0 ? variants : ["—"];
      displayVariants.forEach((v) => {
        const btn = document.createElement("button");
        btn.className = "cp-equip-btn";
        btn.textContent = v === "default" ? "1" : v;
        if (slotInfo && slotInfo.equipped === v) btn.classList.add("selected");
        if (v === "—") {
          btn.disabled = true;
        } else {
          btn.addEventListener("click", () => {
            row
              .querySelectorAll(".cp-equip-btn")
              .forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
            this._onEquipChange(slot, v);
          });
        }
        row.appendChild(btn);
      });

      container.appendChild(row);
    });
  }

  // ── Animation Buttons ─────────────────────────────────────────────────────

  _buildAnimGrid() {
    const grid = this.element.querySelector("#cp-anim-grid");
    const ANIM_BTNS = [
      ["idle", "Idle"],
      ["walk", "Walk"],
      ["run", "Run"],
      ["combatIdle", "Combat Idle"],
      ["attack1", "Attack 1"],
      ["attack2", "Attack 2"],
      ["attack3", "Attack 3"],
      ["block", "Block"],
      ["hit", "Hit"],
      ["death", "Death"],
    ];

    ANIM_BTNS.forEach(([key, label]) => {
      const btn = document.createElement("button");
      btn.className = "cp-anim-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        this._onAnimPlay(key);
        btn.classList.add("flash");
        setTimeout(() => btn.classList.remove("flash"), 300);
      });
      grid.appendChild(btn);
    });
  }

  // ── Mixamo Retarget Drop Zone ─────────────────────────────────────────────

  /**
   * Set the character Object3D and its AnimationMixer as the retarget target.
   * Call this after loading a race model into Three.js.
   * @param {THREE.Object3D} object3D
   * @param {THREE.Scene} scene
   * @param {THREE.AnimationMixer} mixer
   */
  setRetargetTarget(object3D, scene, mixer) {
    this._targetObject = object3D;
    this._targetMixer = mixer;
    if (!this._retargeter) {
      this._retargeter = new AnimRetargeter(scene);
    }
    this._setRetargetStatus(
      `Target: ${object3D.name || "character"}. Drop a Mixamo GLB on the canvas.`,
    );
  }

  _setRetargetStatus(msg) {
    const el = this.element.querySelector("#cp-retarget-status");
    if (el) el.textContent = msg;
  }

  _wireRetarget() {
    // Drop zone inside the panel itself
    const dropHint = this.element.querySelector("#cp-retarget-drop-hint");
    dropHint.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropHint.classList.add("drag-over");
    });
    dropHint.addEventListener("dragleave", () =>
      dropHint.classList.remove("drag-over"),
    );
    dropHint.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropHint.classList.remove("drag-over");
      await this._handleGlbDrop(e.dataTransfer?.files?.[0]);
    });

    // Also wire the main canvas so designers can drag onto the 3D view
    const canvas =
      document.getElementById("renderCanvas") ||
      document.querySelector("canvas");
    if (canvas) {
      canvas.addEventListener("dragover", (e) => e.preventDefault());
      canvas.addEventListener("drop", async (e) => {
        e.preventDefault();
        await this._handleGlbDrop(e.dataTransfer?.files?.[0]);
      });
    }

    // List bones debug button
    this.element
      .querySelector("#cp-list-bones-btn")
      .addEventListener("click", () => {
        if (this._targetObject) {
          AnimRetargeter.listBones(this._targetObject);
          this._setRetargetStatus("Bone list printed to console (F12).");
        } else {
          this._setRetargetStatus("Call setRetargetTarget() first.");
        }
      });
  }

  async _handleGlbDrop(file) {
    if (!file || !file.name.endsWith(".glb")) {
      this._setRetargetStatus("Drop a .glb file only.");
      return;
    }
    if (!this._targetObject || !this._retargeter) {
      this._setRetargetStatus(
        "No target set — call setRetargetTarget() first.",
      );
      return;
    }

    this._setRetargetStatus(`Loading ${file.name}…`);
    try {
      const url = URL.createObjectURL(file);
      const clipNames = await this._retargeter.loadSource(url);
      URL.revokeObjectURL(url);

      const actions = this._retargeter.retargetOnto(
        this._targetObject,
        this._targetMixer,
      );
      if (actions.length === 0) {
        this._setRetargetStatus(
          "No bones matched. Check console and bone map.",
        );
        return;
      }

      // Auto-play first retargeted clip
      actions[0].action.reset().play();
      this._setRetargetStatus(
        `Retargeted ${actions.length} clip(s): ${actions.map((a) => a.name).join(", ")}`,
      );
    } catch (err) {
      console.error(
        "[CharacterPanel] Retarget failed: - CharacterPanel.js:410",
        err,
      );
      this._setRetargetStatus(`Error: ${err.message}`);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  show() {
    this.element.style.display = "";
  }
  hide() {
    this.element.style.display = "none";
  }
  toggle() {
    this.element.style.display =
      this.element.style.display === "none" ? "" : "none";
  }
  getActiveRace() {
    return this._activeRace;
  }
}

// ─── CharacterPanel (Babylon.GUI version — used by character_test scene) ─────

export class CharacterPanel {
  /**
   * @param {BABYLON.GUI.AdvancedDynamicTexture} gui    - fullscreen GUI texture
   * @param {Function} onRaceChange                     - cb(raceId) when race is selected
   * @param {Function} onEquipChange                    - cb(slot, variant) when equip changes
   * @param {Function} onAnimPlay                       - cb(animKey) when animation is tested
   */
  constructor(gui, onRaceChange, onEquipChange, onAnimPlay) {
    this._gui = gui;
    this._onRaceChange = onRaceChange;
    this._onEquipChange = onEquipChange;
    this._onAnimPlay = onAnimPlay;
    this._activeRace = "human";
    this._equipState = {};
    this._slotSummary = {};

    this._build();
  }

  // ── Build the main container ───────────────────────────────────────────────

  _build() {
    // ─ Main wrapper (left panel) ─────────────────────────────────────────────
    this._panel = new BABYLON.GUI.ScrollViewer("characterPanel");
    this._panel.width = "320px";
    this._panel.height = "100%";
    this._panel.horizontalAlignment =
      BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this._panel.background = PANEL_BG;
    this._panel.barSize = 6;
    this._panel.barColor = GOLD;
    this._panel.barBackground = "#111";
    this._gui.addControl(this._panel);

    this._stack = new BABYLON.GUI.StackPanel("cpStack");
    this._stack.width = "300px";
    this._stack.isVertical = true;
    this._stack.paddingTop = "10px";
    this._panel.addControl(this._stack);

    this._buildHeader();
    this._buildRaceSelector();
    this._buildRaceInfo();
    this._buildStatsBlock();
    this._buildSeparator();
    this._buildEquipSection();
    this._buildSeparator();
    this._buildAnimSection();
  }

  // ── Header ────────────────────────────────────────────────────────────────

  _buildHeader() {
    const header = new BABYLON.GUI.TextBlock("cpHeader", "GRUDGE WARLORDS");
    header.height = "40px";
    header.color = GOLD;
    header.fontSize = 16;
    header.fontStyle = "bold";
    header.fontFamily = "'Cinzel', 'Georgia', serif";
    header.letterSpacing = 3;
    this._stack.addControl(header);

    const sub = new BABYLON.GUI.TextBlock("cpSub", "CHARACTER BUILDER");
    sub.height = "22px";
    sub.color = TEXT_DIM;
    sub.fontSize = 10;
    sub.letterSpacing = 2;
    this._stack.addControl(sub);
  }

  // ── Race Selector (6 buttons) ─────────────────────────────────────────────

  _buildRaceSelector() {
    const label = _sectionLabel("SELECT RACE");
    this._stack.addControl(label);

    this._raceButtons = {};
    const grid = new BABYLON.GUI.Grid("raceGrid");
    grid.height = "72px";
    grid.addColumnDefinition(1 / 3, false);
    grid.addColumnDefinition(1 / 3, false);
    grid.addColumnDefinition(1 / 3, false);
    grid.addRowDefinition(0.5, false);
    grid.addRowDefinition(0.5, false);

    RACE_ORDER.forEach((raceId, i) => {
      const faction = FACTIONS[raceId];
      const row = Math.floor(i / 3);
      const col = i % 3;

      const btn = BABYLON.GUI.Button.CreateSimpleButton(
        `rb_${raceId}`,
        faction.name,
      );
      btn.color = raceId === this._activeRace ? GOLD : TEXT_DIM;
      btn.background =
        raceId === this._activeRace ? "rgba(200,169,81,0.18)" : "transparent";
      btn.fontSize = 10;
      btn.fontStyle = "bold";
      btn.thickness = 1;
      btn.cornerRadius = 3;
      btn.paddingLeft = "2px";
      btn.paddingRight = "2px";
      btn.paddingTop = "2px";
      btn.paddingBottom = "2px";

      btn.onPointerClickObservable.add(() => this._selectRace(raceId));
      this._raceButtons[raceId] = btn;
      grid.addControl(btn, row, col);
    });

    this._stack.addControl(grid);
  }

  _selectRace(raceId) {
    // Update button highlight
    for (const [id, btn] of Object.entries(this._raceButtons)) {
      const active = id === raceId;
      btn.color = active ? GOLD : TEXT_DIM;
      btn.background = active ? "rgba(200,169,81,0.18)" : "transparent";
    }
    this._activeRace = raceId;
    this._updateRaceInfo(raceId);
    this._onRaceChange(raceId);
  }

  // ── Race Description ───────────────────────────────────────────────────────

  _buildRaceInfo() {
    const faction = FACTIONS[this._activeRace];
    const line = new BABYLON.GUI.TextBlock("cpRaceColor");
    line.height = "4px";
    line.background = faction.color;
    this._stack.addControl(line);
    this._raceColorBar = line;

    const desc = new BABYLON.GUI.TextBlock("cpRaceDesc", faction.description);
    desc.height = "50px";
    desc.color = TEXT_DIM;
    desc.fontSize = 10;
    desc.textWrapping = true;
    desc.paddingLeft = "10px";
    desc.paddingRight = "10px";
    this._stack.addControl(desc);
    this._raceDescBlock = desc;

    const factionLabel = new BABYLON.GUI.TextBlock(
      "cpFaction",
      `FACTION: ${faction.faction.toUpperCase()}`,
    );
    factionLabel.height = "18px";
    factionLabel.color = faction.color;
    factionLabel.fontSize = 9;
    factionLabel.letterSpacing = 1;
    this._stack.addControl(factionLabel);
    this._factionLabel = factionLabel;
  }

  _updateRaceInfo(raceId) {
    const faction = FACTIONS[raceId];
    this._raceColorBar.background = faction.color;
    this._raceDescBlock.text = faction.description;
    this._factionLabel.text = `FACTION: ${faction.faction.toUpperCase()}`;
    this._factionLabel.color = faction.color;
    // Update stat bars
    this._updateStats(faction.stats);
    // Reset equip selectors for new race
    this._refreshEquipSlots();
  }

  // ── Stats display ──────────────────────────────────────────────────────────

  _buildStatsBlock() {
    this._stack.addControl(_sectionLabel("BASE ATTRIBUTES"));
    this._statBars = {};

    const ATTRS = [
      ["STR", "str"],
      ["DEX", "dex"],
      ["INT", "int"],
      ["VIT", "vit"],
      ["WIS", "wis"],
      ["LCK", "lck"],
      ["CHA", "cha"],
      ["END", "end"],
    ];

    for (const [label, key] of ATTRS) {
      const row = new BABYLON.GUI.StackPanel(`stat_${key}`);
      row.isVertical = false;
      row.height = "18px";
      row.paddingLeft = "10px";
      row.paddingRight = "10px";

      const lbl = new BABYLON.GUI.TextBlock(`stat_lbl_${key}`, label);
      lbl.width = "40px";
      lbl.color = TEXT_DIM;
      lbl.fontSize = 10;
      lbl.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      row.addControl(lbl);

      const bar = new BABYLON.GUI.Rectangle(`stat_bar_${key}`);
      bar.width = "180px";
      bar.height = "8px";
      bar.background = "#333";
      bar.cornerRadius = 4;
      bar.thickness = 0;
      bar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

      const fill = new BABYLON.GUI.Rectangle(`stat_fill_${key}`);
      fill.height = "8px";
      fill.background = GOLD;
      fill.cornerRadius = 4;
      fill.thickness = 0;
      fill.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      bar.addControl(fill);
      row.addControl(bar);

      const val = new BABYLON.GUI.TextBlock(`stat_val_${key}`, "0");
      val.width = "30px";
      val.color = GOLD_GLOW;
      val.fontSize = 10;
      row.addControl(val);

      this._stack.addControl(row);
      this._statBars[key] = { fill, val, bar };
    }

    this._updateStats(FACTIONS[this._activeRace].stats);
  }

  _updateStats(stats) {
    const MAX_STAT = 25;
    for (const [key, { fill, val, bar }] of Object.entries(this._statBars)) {
      const v = stats[key] || 0;
      const pct = Math.min(v / MAX_STAT, 1);
      fill.widthInPixels = Math.round(180 * pct);
      val.text = String(v);
    }
  }

  // ── Equipment Slots ────────────────────────────────────────────────────────

  _buildEquipSection() {
    this._stack.addControl(_sectionLabel("EQUIPMENT"));
    this._equipSlotsContainer = new BABYLON.GUI.StackPanel("equipContainer");
    this._equipSlotsContainer.isVertical = true;
    this._stack.addControl(this._equipSlotsContainer);
    this._refreshEquipSlots();
  }

  /**
   * Refresh equipment slot UI based on current equipManager summary.
   * Call this after loading a new race to show available variants.
   */
  refreshFromEquipManager(equipManager) {
    this._slotSummary = equipManager.getSummary();
    this._refreshEquipSlots();
  }

  _refreshEquipSlots() {
    // Remove old controls
    this._equipSlotsContainer.clearControls();

    const SLOT_DISPLAY = [
      ["body", "Body Armor"],
      ["arms", "Arm Guards"],
      ["legs", "Leg Guards"],
      ["head", "Helmet"],
      ["shoulders", "Shoulders"],
      ["sword", "Sword"],
      ["axe", "Axe"],
      ["hammer", "Hammer"],
      ["bow", "Bow"],
      ["staff", "Staff"],
      ["shield", "Shield"],
    ];

    for (const [slot, label] of SLOT_DISPLAY) {
      const slotInfo = this._slotSummary[slot];
      const variants = slotInfo ? slotInfo.variants : [];
      if (
        variants.length === 0 &&
        !["body", "arms", "legs", "head"].includes(slot)
      )
        continue;

      const row = new BABYLON.GUI.StackPanel(`equip_${slot}`);
      row.isVertical = false;
      row.height = "24px";
      row.paddingLeft = "10px";
      row.paddingRight = "10px";

      const lbl = new BABYLON.GUI.TextBlock(`equip_lbl_${slot}`, label);
      lbl.width = "90px";
      lbl.color = TEXT_DIM;
      lbl.fontSize = 10;
      lbl.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      row.addControl(lbl);

      // Display variant buttons
      const displayVariants = variants.length > 0 ? variants : ["—"];
      for (const v of displayVariants) {
        const vBtn = BABYLON.GUI.Button.CreateSimpleButton(
          `ev_${slot}_${v}`,
          v === "default" ? "1" : v,
        );
        vBtn.width = `${Math.max(24, 220 / displayVariants.length)}px`;
        vBtn.height = "20px";
        vBtn.color = GOLD;
        vBtn.background = "transparent";
        vBtn.fontSize = 9;
        vBtn.cornerRadius = 3;
        vBtn.thickness = 1;

        if (slotInfo && slotInfo.equipped === v) {
          vBtn.background = "rgba(200,169,81,0.3)";
        }

        if (v !== "—") {
          vBtn.onPointerClickObservable.add(() => {
            this._onEquipChange(slot, v);
            // Highlight selected
            for (const c of row.children) {
              if (c instanceof BABYLON.GUI.Button) {
                c.background = "transparent";
              }
            }
            vBtn.background = "rgba(200,169,81,0.3)";
          });
        } else {
          vBtn.isEnabled = false;
          vBtn.color = TEXT_OFF;
        }
        row.addControl(vBtn);
      }

      this._equipSlotsContainer.addControl(row);
    }
  }

  // ── Animation test buttons ────────────────────────────────────────────────

  _buildAnimSection() {
    this._stack.addControl(_sectionLabel("ANIMATIONS"));

    const ANIM_BTNS = [
      ["idle", "Idle"],
      ["walk", "Walk"],
      ["run", "Run"],
      ["combatIdle", "Combat Idle"],
      ["attack1", "Attack 1"],
      ["attack2", "Attack 2"],
      ["attack3", "Attack 3"],
      ["block", "Block"],
      ["hit", "Hit"],
      ["death", "Death"],
    ];

    const grid = new BABYLON.GUI.Grid("animGrid");
    grid.height = `${Math.ceil(ANIM_BTNS.length / 2) * 32}px`;
    grid.addColumnDefinition(0.5, false);
    grid.addColumnDefinition(0.5, false);
    for (let i = 0; i < Math.ceil(ANIM_BTNS.length / 2); i++) {
      grid.addRowDefinition(32, true);
    }

    ANIM_BTNS.forEach(([key, lbl], i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const btn = BABYLON.GUI.Button.CreateSimpleButton(`anim_${key}`, lbl);
      btn.color = GOLD;
      btn.background = "transparent";
      btn.fontSize = 10;
      btn.thickness = 1;
      btn.cornerRadius = 3;
      btn.paddingLeft = "4px";
      btn.paddingRight = "4px";
      btn.paddingTop = "3px";
      btn.paddingBottom = "3px";
      btn.onPointerClickObservable.add(() => {
        this._onAnimPlay(key);
        // Flash highlight
        btn.background = "rgba(200,169,81,0.35)";
        setTimeout(() => {
          btn.background = "transparent";
        }, 300);
      });
      grid.addControl(btn, row, col);
    });

    this._stack.addControl(grid);
    // Bottom padding
    const pad = new BABYLON.GUI.Rectangle("cpBottom");
    pad.height = "30px";
    pad.thickness = 0;
    this._stack.addControl(pad);

    this._buildRetargetSection();
  }

  // ── Mixamo Retarget drop zone ─────────────────────────────────────────────
  // Drag a Mixamo GLB file from Explorer onto the canvas; the status label
  // updates and the new AnimationGroups become playable via the anim buttons.

  _buildRetargetSection() {
    this._stack.addControl(_sectionLabel("MIXAMO RETARGET"));

    // Status label
    const statusLabel = new BABYLON.GUI.TextBlock(
      "retargetStatus",
      "Drop a Mixamo GLB onto the canvas",
    );
    statusLabel.height = "32px";
    statusLabel.color = TEXT_DIM;
    statusLabel.fontSize = 9;
    statusLabel.textWrapping = true;
    statusLabel.paddingLeft = "10px";
    statusLabel.paddingRight = "10px";
    this._stack.addControl(statusLabel);
    this._retargetStatus = statusLabel;

    // "List Bones" debug button
    const listBtn = BABYLON.GUI.Button.CreateSimpleButton(
      "listBonesBtn",
      "List Target Bones",
    );
    listBtn.height = "24px";
    listBtn.color = TEXT_DIM;
    listBtn.background = "transparent";
    listBtn.fontSize = 9;
    listBtn.thickness = 1;
    listBtn.cornerRadius = 3;
    listBtn.paddingLeft = "10px";
    listBtn.paddingRight = "10px";
    listBtn.paddingTop = "2px";
    listBtn.paddingBottom = "2px";
    listBtn.onPointerClickObservable.add(() => {
      if (this._targetMesh) {
        AnimRetargeter.listBones(this._targetMesh);
        this._retargetStatus.text = "Bone list printed to console";
      } else {
        this._retargetStatus.text =
          "Set a target mesh first via setRetargetTarget()";
      }
    });
    this._stack.addControl(listBtn);

    // Wire the canvas drag-and-drop (outside Babylon GUI layer)
    this._setupCanvasDrop();
  }

  /**
   * Set the character mesh that retargeted animations will be applied to.
   * Call this after loading a race model.
   * @param {BABYLON.AbstractMesh} mesh
   * @param {BABYLON.Scene} scene
   */
  setRetargetTarget(mesh, scene) {
    this._targetMesh = mesh;
    this._retargetScene = scene;
    if (!this._retargeter) {
      this._retargeter = new AnimRetargeter(scene);
    }
    this._retargetStatus.text = `Target: ${mesh.name || "character"}. Drop Mixamo GLB on canvas.`;
  }

  _setupCanvasDrop() {
    // Use native DOM drag-drop on the renderCanvas (outside Babylon GUI)
    const canvas = document.getElementById("renderCanvas");
    if (!canvas) return;

    canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    canvas.addEventListener("drop", async (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.name.endsWith(".glb")) {
        if (this._retargetStatus)
          this._retargetStatus.text = "Drop a .glb file only";
        return;
      }
      if (!this._targetMesh || !this._retargeter) {
        if (this._retargetStatus)
          this._retargetStatus.text =
            "No target mesh — call setRetargetTarget() first";
        return;
      }

      this._retargetStatus.text = `Loading ${file.name}...`;

      try {
        // Create a blob URL so Babylon's loader can read the dropped file
        const url = URL.createObjectURL(file);
        const clipNames = await this._retargeter.loadSource(url);
        URL.revokeObjectURL(url);

        const newGroups = this._retargeter.retargetOnto(this._targetMesh);
        if (newGroups.length === 0) {
          this._retargetStatus.text =
            "No bones matched — check console for details";
          return;
        }

        // Start the first retargeted clip to test
        newGroups[0].start(true);
        this._retargetStatus.text = `Retargeted ${newGroups.length} clip(s): ${newGroups.map((g) => g.name.replace("_retargeted", "")).join(", ")}`;

        // Notify parent so it can update the anim button grid
        if (this._onAnimPlay) {
          newGroups.forEach((g) => {
            const cleanName = g.name.replace("_retargeted", "");
            console.log(
              `[CharacterPanel] New retargeted clip available: "${cleanName}" - CharacterPanel.js:903`,
            );
          });
        }
      } catch (err) {
        console.error(
          "[CharacterPanel] Retarget failed: - CharacterPanel.js:907",
          err,
        );
        this._retargetStatus.text = `Error: ${err.message}`;
      }
    });
  }

  // ── Public controls ───────────────────────────────────────────────────────

  /** Show/hide the whole panel */
  setVisible(v) {
    this._panel.isVisible = v;
  }

  toggle() {
    this._panel.isVisible = !this._panel.isVisible;
  }

  /** Returns the currently selected race id */
  getActiveRace() {
    return this._activeRace;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _sectionLabel(text) {
  const label = new BABYLON.GUI.TextBlock(null, text);
  label.height = "28px";
  label.color = GOLD;
  label.fontSize = 10;
  label.fontStyle = "bold";
  label.letterSpacing = 2;
  label.paddingLeft = "10px";
  label.paddingTop = "8px";
  label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  return label;
}
