/**
 * SettingsPanel.js
 * Grudge Warlords — Settings overlay with keybind remapping.
 *
 * Opens on Escape key. WCS gold/stone theme matching UIlayer.html.
 * Reads/writes from KeybindManager singleton.
 *
 * Sections:
 *   - Keybinds (click-to-rebind)
 *   - Graphics (shadow quality, resolution scale)
 *   - Audio (volume sliders — placeholder)
 */

import { keybinds, KeybindManager } from '../utils/KeybindManager.js';

export class SettingsPanel {
  constructor() {
    this._open = false;
    this._rebindingAction = null;
    this._build();
    this._wireEscape();
  }

  _build() {
    if (document.getElementById('grudgeSettings')) return;

    const style = document.createElement('style');
    style.id = 'grudgeSettingsStyle';
    style.textContent = `
      #grudgeSettings {
        position:fixed; inset:0; z-index:10200;
        display:none; align-items:center; justify-content:center;
        background:rgba(0,0,0,0.7); backdrop-filter:blur(8px);
        font-family:'Cinzel','Georgia',serif;
      }
      #grudgeSettings.open { display:flex; }

      .gs-window {
        width:min(580px,92vw); max-height:85vh; overflow-y:auto;
        background:linear-gradient(150deg,#1e140e 0%,#120c06 60%,#0f0805 100%);
        border:2px solid rgba(200,169,81,0.4); border-radius:14px;
        box-shadow:0 24px 80px rgba(0,0,0,0.95), inset 0 0 30px rgba(0,0,0,0.4);
        scrollbar-width:thin; scrollbar-color:#c8a951 #111;
      }
      .gs-window::-webkit-scrollbar { width:5px; }
      .gs-window::-webkit-scrollbar-thumb { background:#c8a951; border-radius:3px; }

      /* Rivets */
      .gs-window::before, .gs-window::after {
        content:''; position:absolute; width:6px; height:6px;
        background:#c8a951; border:1px solid #fff; box-shadow:0 0 4px #c8a951;
        border-radius:1px; z-index:2;
      }
      .gs-window { position:relative; }
      .gs-window::before { top:5px; left:5px; }
      .gs-window::after  { top:5px; right:5px; }

      /* Header */
      .gs-header {
        display:flex; align-items:center; justify-content:space-between;
        padding:16px 20px 14px;
        border-bottom:1px solid rgba(200,169,81,0.2);
        background:linear-gradient(90deg,rgba(200,169,81,0.07),transparent,rgba(200,169,81,0.05));
      }
      .gs-title {
        font-size:14px; font-weight:700; color:#c8a951;
        letter-spacing:3px; text-transform:uppercase;
      }
      .gs-close {
        cursor:pointer; color:#555; font-size:18px; padding:2px 6px;
        border-radius:4px; transition:0.15s; background:none; border:none;
        font-family:inherit;
      }
      .gs-close:hover { color:#c8a951; background:rgba(200,169,81,0.1); }

      /* Tabs */
      .gs-tabs {
        display:flex; border-bottom:1px solid rgba(200,169,81,0.12);
        background:rgba(0,0,0,0.2);
      }
      .gs-tab {
        flex:1; padding:10px 0; text-align:center; cursor:pointer;
        font-size:10px; font-weight:700; letter-spacing:2px;
        text-transform:uppercase; color:#555;
        border-bottom:2px solid transparent; transition:0.15s;
        background:none; border-left:none; border-right:none; border-top:none;
        font-family:inherit;
      }
      .gs-tab:hover { color:#ccc; }
      .gs-tab.active { color:#c8a951; border-bottom-color:#c8a951; background:rgba(200,169,81,0.04); }

      /* Content */
      .gs-body { padding:16px 20px 24px; }
      .gs-body[data-tab] { display:none; }
      .gs-body.active { display:block; }

      /* Section label */
      .gs-section {
        font-size:9px; font-weight:700; letter-spacing:2px;
        color:#6b5535; text-transform:uppercase; margin:14px 0 8px;
        padding-bottom:4px; border-bottom:1px solid rgba(200,169,81,0.08);
      }
      .gs-section:first-child { margin-top:0; }

      /* Keybind row */
      .gs-bind-row {
        display:flex; align-items:center; padding:5px 0; gap:8px;
      }
      .gs-bind-label {
        flex:1; font-size:11px; color:#aaa; letter-spacing:0.3px;
      }
      .gs-bind-key {
        min-width:60px; height:28px; padding:0 10px;
        display:flex; align-items:center; justify-content:center;
        background:linear-gradient(180deg,#2a1e10,#1a1008);
        border:1px solid rgba(200,169,81,0.3); border-radius:5px;
        color:#c8a951; font-size:11px; font-weight:700; font-family:monospace;
        box-shadow:0 2px 0 rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
        cursor:pointer; transition:0.15s; text-align:center;
      }
      .gs-bind-key:hover {
        border-color:#c8a951; box-shadow:0 0 8px rgba(200,169,81,0.2);
      }
      .gs-bind-key.listening {
        border-color:#f0d070; color:#f0d070;
        animation:gs-blink 0.6s ease infinite alternate;
        box-shadow:0 0 12px rgba(240,208,112,0.3);
      }
      @keyframes gs-blink { from{opacity:1} to{opacity:0.5} }

      .gs-bind-reset {
        width:22px; height:22px; border-radius:4px; cursor:pointer;
        background:rgba(200,169,81,0.08); border:1px solid rgba(200,169,81,0.15);
        color:#666; font-size:10px; display:flex; align-items:center; justify-content:center;
        transition:0.15s;
      }
      .gs-bind-reset:hover { color:#c8a951; border-color:#c8a951; }

      /* Footer */
      .gs-footer {
        display:flex; gap:8px; justify-content:flex-end;
        padding:12px 20px; border-top:1px solid rgba(200,169,81,0.1);
      }
      .gs-btn {
        padding:8px 18px; font-family:'Cinzel',serif; font-size:10px;
        font-weight:700; letter-spacing:2px; text-transform:uppercase;
        border-radius:6px; cursor:pointer; transition:0.2s;
      }
      .gs-btn-secondary {
        background:transparent; border:1px solid rgba(200,169,81,0.25);
        color:#888;
      }
      .gs-btn-secondary:hover { color:#c8a951; border-color:#c8a951; }
      .gs-btn-primary {
        background:linear-gradient(135deg,rgba(200,169,81,0.2),rgba(200,169,81,0.05));
        border:1px solid rgba(200,169,81,0.4); color:#c8a951;
      }
      .gs-btn-primary:hover {
        background:rgba(200,169,81,0.3); border-color:#c8a951;
        box-shadow:0 0 12px rgba(200,169,81,0.15);
      }
    `;
    document.head.appendChild(style);

    this._root = document.createElement('div');
    this._root.id = 'grudgeSettings';
    this._root.innerHTML = `
      <div class="gs-window">
        <div class="gs-header">
          <span class="gs-title">⚙ Settings</span>
          <button class="gs-close" id="gs-close">✕</button>
        </div>
        <div class="gs-tabs">
          <button class="gs-tab active" data-tab="keybinds">Keybinds</button>
          <button class="gs-tab" data-tab="graphics">Graphics</button>
          <button class="gs-tab" data-tab="audio">Audio</button>
        </div>
        <div class="gs-body active" id="gs-keybinds" data-tab="keybinds"></div>
        <div class="gs-body" id="gs-graphics" data-tab="graphics"></div>
        <div class="gs-body" id="gs-audio" data-tab="audio"></div>
        <div class="gs-footer">
          <button class="gs-btn gs-btn-secondary" id="gs-reset-all">Reset All</button>
          <button class="gs-btn gs-btn-primary" id="gs-done">Done</button>
        </div>
      </div>
    `;
    document.body.appendChild(this._root);

    // Tab switching
    this._root.querySelectorAll('.gs-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._root.querySelectorAll('.gs-tab').forEach(t => t.classList.remove('active'));
        this._root.querySelectorAll('.gs-body').forEach(b => b.classList.remove('active'));
        tab.classList.add('active');
        this._root.querySelector(`#gs-${tab.dataset.tab}`).classList.add('active');
      });
    });

    // Close / Done
    this._root.querySelector('#gs-close').addEventListener('click', () => this.close());
    this._root.querySelector('#gs-done').addEventListener('click', () => this.close());
    this._root.querySelector('#gs-reset-all').addEventListener('click', () => {
      keybinds.resetAll();
      this._renderKeybinds();
    });

    // Click outside to close
    this._root.addEventListener('click', (e) => {
      if (e.target === this._root) this.close();
    });

    // Capture key for rebinding
    this._keyHandler = (e) => {
      if (!this._rebindingAction) return;
      e.preventDefault();
      e.stopPropagation();
      keybinds.rebind(this._rebindingAction, e.key);
      this._rebindingAction = null;
      this._renderKeybinds();
    };

    this._renderKeybinds();
    this._renderGraphics();
    this._renderAudio();
  }

  _renderKeybinds() {
    const container = this._root.querySelector('#gs-keybinds');
    const groups = KeybindManager.getActionGroups();
    let html = '';

    for (const [groupName, actions] of Object.entries(groups)) {
      html += `<div class="gs-section">${groupName}</div>`;
      for (const action of actions) {
        const key = keybinds.getKey(action);
        const label = KeybindManager.actionLabel(action);
        const display = KeybindManager.displayKey(key);
        html += `
          <div class="gs-bind-row">
            <span class="gs-bind-label">${label}</span>
            <div class="gs-bind-key" data-action="${action}">${display}</div>
            <div class="gs-bind-reset" data-action="${action}" title="Reset to default">↺</div>
          </div>`;
      }
    }
    container.innerHTML = html;

    // Wire click-to-rebind
    container.querySelectorAll('.gs-bind-key').forEach(el => {
      el.addEventListener('click', () => {
        // Clear previous
        container.querySelectorAll('.gs-bind-key').forEach(k => k.classList.remove('listening'));
        el.classList.add('listening');
        el.textContent = '…';
        this._rebindingAction = el.dataset.action;
        window.addEventListener('keydown', this._keyHandler, { once: true });
      });
    });

    // Wire reset buttons
    container.querySelectorAll('.gs-bind-reset').forEach(el => {
      el.addEventListener('click', () => {
        keybinds.resetAction(el.dataset.action);
        this._renderKeybinds();
      });
    });
  }

  _renderGraphics() {
    const container = this._root.querySelector('#gs-graphics');
    container.innerHTML = `
      <div class="gs-section">Shadows</div>
      <div class="gs-bind-row">
        <span class="gs-bind-label">Shadow Quality</span>
        <select style="background:#1a1008;color:#c8a951;border:1px solid rgba(200,169,81,0.3);
          border-radius:4px;padding:4px 8px;font-family:monospace;font-size:11px;">
          <option value="1024">Low (1024)</option>
          <option value="2048" selected>Medium (2048)</option>
          <option value="4096">High (4096)</option>
        </select>
      </div>
      <div class="gs-section">Rendering</div>
      <div class="gs-bind-row">
        <span class="gs-bind-label">Resolution Scale</span>
        <span style="color:#c8a951;font-family:monospace;font-size:11px;">100%</span>
      </div>
      <div class="gs-bind-row">
        <span class="gs-bind-label">Anti-aliasing</span>
        <span style="color:#c8a951;font-family:monospace;font-size:11px;">FXAA + 4x MSAA</span>
      </div>
    `;
  }

  _renderAudio() {
    const container = this._root.querySelector('#gs-audio');
    container.innerHTML = `
      <div class="gs-section">Volume</div>
      <div class="gs-bind-row">
        <span class="gs-bind-label">Master Volume</span>
        <input type="range" min="0" max="100" value="80"
          style="flex:1;accent-color:#c8a951;">
        <span style="color:#c8a951;font-family:monospace;font-size:11px;width:30px;">80%</span>
      </div>
      <div class="gs-bind-row">
        <span class="gs-bind-label">Music</span>
        <input type="range" min="0" max="100" value="60"
          style="flex:1;accent-color:#c8a951;">
        <span style="color:#c8a951;font-family:monospace;font-size:11px;width:30px;">60%</span>
      </div>
      <div class="gs-bind-row">
        <span class="gs-bind-label">SFX</span>
        <input type="range" min="0" max="100" value="100"
          style="flex:1;accent-color:#c8a951;">
        <span style="color:#c8a951;font-family:monospace;font-size:11px;width:30px;">100%</span>
      </div>
    `;
  }

  _wireEscape() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this._rebindingAction) {
          this._rebindingAction = null;
          this._renderKeybinds();
          return;
        }
        this.toggle();
      }
    });
  }

  open()   { this._open = true;  this._root.classList.add('open'); }
  close()  { this._open = false; this._root.classList.remove('open'); this._rebindingAction = null; }
  toggle() { this._open ? this.close() : this.open(); }
  get isOpen() { return this._open; }

  dispose() {
    this._root?.remove();
    document.getElementById('grudgeSettingsStyle')?.remove();
  }
}
