/**
 * SceneManager.js
 * Grudge Warlords — Scene orchestrator
 *
 * Active scenes:
 *   outdoor        → Full open-world map  (default)
 *   inn            → Interior / tavern
 *   builder        → Procedural world builder + level editor
 *   character_test → Race viewer & equipment tester   (?scene=character_test)
 *
 * Navigation: floating overlay top-center (click scene button or press hotkeys).
 *   F1 → outdoor | F2 → inn | F3 → builder | F4 → character_test
 */

import { createOutdoor }       from './scenes/outdoor.js';
import { createInn }           from './scenes/inn.js';
import { createBuilder }       from './scenes/builder.js';
import { createCharacterTest } from './scenes/character_test.js';
import { buildHotbar }         from '../utils/Hotbar.js';

// ─── Scene catalog ────────────────────────────────────────────────────────────

const SCENE_CATALOG = [
  { key: 'outdoor',        label: '🌲 Outdoor',    fn: createOutdoor,       hotkey: 'F1' },
  { key: 'inn',            label: '🏠 Inn',         fn: createInn,           hotkey: 'F2' },
  { key: 'builder',        label: '🔨 Builder',     fn: createBuilder,       hotkey: 'F3' },
  { key: 'character_test', label: '⚔️ Characters',  fn: createCharacterTest, hotkey: 'F4' },
];

// ─── SceneManager ─────────────────────────────────────────────────────────────

class SceneManager {
  constructor(canvasId) {
    this.canvas      = document.getElementById(canvasId);
    this.engine      = new BABYLON.Engine(this.canvas, true);
    this.guiTextures = new Map();
    this.scenes      = [];
    this.activeScene = null;
    this._activeKey  = null;
    this._nav        = null;      // DOM nav overlay
    this._loading    = false;

    // Build lookup maps from catalog
    this.sceneCreators = {};
    for (const entry of SCENE_CATALOG) {
      this.sceneCreators[entry.key] = entry.fn;
    }
  }

  // ── Scene loading ──────────────────────────────────────────────────────────

  async loadScene(fn) {
    const scene = await fn(this.engine);
    scene.damagePopupAnimationGroup = new BABYLON.AnimationGroup('popupAnimation', scene);
    this.scenes.push(scene);
    this.guiTextures.set(scene, BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene));
    return scene;
  }

  async switchToScene(index) {
    if (this.activeScene) {
      this.engine.stopRenderLoop();
      if (DEBUG) this.activeScene.debugLayer.hide();
    }
    this.activeScene = this.scenes[index];
    this.activeGUI   = this.guiTextures.get(this.activeScene);
    this.engine.runRenderLoop(() => this.activeScene.render());
    if (DEBUG) this.activeScene.debugLayer.show();
  }

  /** Navigate to a named scene key; disposes current and loads fresh */
  async navigateTo(key) {
    if (this._loading || key === this._activeKey) return;
    const entry = SCENE_CATALOG.find(e => e.key === key);
    if (!entry) return;

    this._loading = true;
    this._updateNav(key, true);

    // Dispose active scene to free memory
    if (this.activeScene) {
      this.engine.stopRenderLoop();
      this.activeScene.dispose();
      this.scenes = [];
      this.guiTextures.clear();
    }

    // Fade canvas out
    this.canvas.classList.remove('visible');
    await new Promise(r => setTimeout(r, 400));

    await this.loadScene(entry.fn);
    await this.switchToScene(0);
    this._activeKey = key;
    this._loading   = false;

    this.canvas.classList.add('visible');
    this._updateNav(key, false);
    this.canvas.focus();
  }

  // ── Entry point ────────────────────────────────────────────────────────────

  async start() {
    const urlParams  = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') DEBUG = true;

    const sceneKey   = urlParams.get('scene');
    const startEntry = SCENE_CATALOG.find(e => e.key === sceneKey) || SCENE_CATALOG[0];

    // Fade-in delay
    const fadeDelay  = FAST_RELOAD ? 100 : 1000;
    setTimeout(() => this.canvas.classList.add('visible'), fadeDelay);

    await this.loadScene(startEntry.fn);
    await this.switchToScene(0);
    this._activeKey = startEntry.key;
    this.canvas.focus();

    this._buildNav();
    this._updateNav(startEntry.key, false);
    buildHotbar();
    this._buildControlsHelp();

    // Hotkeys F1–F4
    window.addEventListener('keydown', (e) => {
      const entry = SCENE_CATALOG.find(en => en.hotkey === e.key);
      if (entry) { e.preventDefault(); this.navigateTo(entry.key); }
    });

    window.addEventListener('resize', () => this.engine.resize());

    const endTime = performance.now();
    console.log(`Scene "${startEntry.key}" loaded in ${(endTime - startTime).toFixed(0)} ms`);
  }

  // ── Controls help ───────────────────────────────────────────────────────────
  _buildControlsHelp() {
    if (document.getElementById('grudgeControlsHelp')) return;
    const help = document.createElement('div');
    help.id = 'grudgeControlsHelp';
    help.style.cssText = `
      position:fixed; bottom:14px; right:14px;
      background:rgba(4,4,8,0.7); color:#c8a951;
      border:1px solid rgba(200,169,81,0.25);
      border-radius:8px; padding:8px 12px;
      font-family:'Open Sans','Helvetica Neue',sans-serif;
      font-size:11px; letter-spacing:0.5px; line-height:1.5;
      z-index:996; pointer-events:none; opacity:0.85;
      max-width:240px;
    `;
    help.innerHTML = `
      <div style="font-weight:bold; letter-spacing:2px; margin-bottom:4px;">CONTROLS</div>
      <div><b>WASD</b> / Arrows — move</div>
      <div><b>Space</b> — roll &nbsp; <b>Shift+W</b> — sprint (toggle <b>F</b>)</div>
      <div><b>LMB</b> — attack &nbsp; <b>Tab</b> — cycle target</div>
      <div><b>RMB</b> — aim &nbsp; <b>X</b> — swap shoulder &nbsp; <b>C</b> — FPS</div>
      <div><b>1 / 2 / 5 / R</b> — spells &nbsp; <b>F1–F4</b> — scenes</div>
    `;
    document.body.appendChild(help);
  }

  // ── Nav overlay ────────────────────────────────────────────────────────────

  _buildNav() {
    const nav = document.createElement('div');
    nav.id = 'grudgeNav';
    nav.style.cssText = `
      position:fixed; top:0; left:50%; transform:translateX(-50%);
      display:flex; gap:4px; z-index:9999; padding:6px 10px;
      background:rgba(4,4,8,0.75); border-bottom-left-radius:10px; border-bottom-right-radius:10px;
      border:1px solid rgba(200,169,81,0.25); border-top:none;
      backdrop-filter:blur(6px); pointer-events:auto;
      font-family:'Open Sans','Helvetica Neue',sans-serif;
    `;

    for (const entry of SCENE_CATALOG) {
      const btn = document.createElement('button');
      btn.dataset.sceneKey = entry.key;
      btn.textContent = `${entry.label}`;
      btn.title = `${entry.hotkey}`;
      btn.style.cssText = `
        padding:4px 12px; font-size:11px; letter-spacing:1px; cursor:pointer;
        background:transparent; border:1px solid transparent;
        color:rgba(200,169,81,0.7); border-radius:6px;
        transition:all 0.2s; white-space:nowrap;
      `;
      btn.addEventListener('mouseenter', () => {
        if (btn.dataset.sceneKey !== this._activeKey)
          btn.style.borderColor = 'rgba(200,169,81,0.5)';
      });
      btn.addEventListener('mouseleave', () => {
        if (btn.dataset.sceneKey !== this._activeKey)
          btn.style.borderColor = 'transparent';
      });
      btn.addEventListener('click', () => this.navigateTo(entry.key));
      nav.appendChild(btn);
    }

    document.body.appendChild(nav);
    this._nav = nav;
  }

  _updateNav(activeKey, isLoading) {
    if (!this._nav) return;
    for (const btn of this._nav.querySelectorAll('button')) {
      const key = btn.dataset.sceneKey;
      const isActive = key === activeKey;
      btn.style.color      = isActive ? '#c8a951' : 'rgba(200,169,81,0.6)';
      btn.style.borderColor= isActive ? 'rgba(200,169,81,0.7)' : 'transparent';
      btn.style.background = isActive ? 'rgba(200,169,81,0.1)' : 'transparent';
      btn.disabled = isLoading;
      if (isLoading && isActive) btn.textContent = '⏳ Loading…';
      else {
        const entry = SCENE_CATALOG.find(e => e.key === key);
        if (entry) btn.textContent = entry.label;
      }
    }
  }
}

export default SceneManager;
