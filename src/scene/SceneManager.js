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

import { createOutdoor }          from './scenes/outdoor.js';
import { createInn }              from './scenes/inn.js';
import { createBuilder }          from './scenes/builder.js';
import { createCharacterCreate }  from './scenes/character_create.js';
import { buildHotbar }            from '../utils/Hotbar.js';

// ─── Scene catalog ────────────────────────────────────────────────────────────

const SCENE_CATALOG = [
  { key: 'character_create', label: '⚔️ Create',      fn: createCharacterCreate,  hotkey: 'F4' },
  { key: 'outdoor',          label: '🌲 Outdoor',    fn: createOutdoor,         hotkey: 'F1' },
  { key: 'inn',              label: '🏠 Inn',         fn: createInn,             hotkey: 'F2' },
  { key: 'builder',          label: '🔨 Builder',     fn: createBuilder,         hotkey: 'F3' },
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
    if (DEBUG) {
      // Load inspector on-demand from CDN so it's never shipped to prod users
      if (!window._inspectorLoaded) {
        await BABYLON.Tools.LoadScriptAsync('https://cdn.babylonjs.com/inspector/babylon.inspector.bundle.js');
        window._inspectorLoaded = true;
      }
      this.activeScene.debugLayer.show();
    }
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

    try {
      await this.loadScene(entry.fn);
      await this.switchToScene(0);
      this._activeKey = key;
      this._loading = false;
    } catch (err) {
      console.error(`[SceneManager] Failed to navigate to scene "${key}":`, err);
      this._loading = false;

      const fallback = SCENE_CATALOG.find((s) => s.key === 'character_create');
      if (!fallback || key === 'character_create') {
        this._showSceneError(`Scene failed to load: ${key}. Check console for details.`);
        this._updateNav(this._activeKey, false);
        return;
      }

      try {
        await this.loadScene(fallback.fn);
        await this.switchToScene(0);
        this._activeKey = fallback.key;
        this._showSceneError(`Failed to load "${key}". Loaded Character Create fallback.`);
      } catch (fallbackErr) {
        console.error('[SceneManager] Fallback scene also failed:', fallbackErr);
        this._showSceneError('Critical scene loading failure. Check console for details.');
      }
    }

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

    try {
      await this.loadScene(startEntry.fn);
      await this.switchToScene(0);
      this._activeKey = startEntry.key;
    } catch (err) {
      console.error(
        `[SceneManager] Startup scene "${startEntry.key}" failed:`,
        err,
      );
      const fallback = SCENE_CATALOG.find((s) => s.key === "character_create");
      if (fallback && fallback.key !== startEntry.key) {
        await this.loadScene(fallback.fn);
        await this.switchToScene(0);
        this._activeKey = fallback.key;
        this._showSceneError(
          `Startup scene failed. Loaded Character Create fallback.`,
        );
      } else {
        this._showSceneError(
          "Unable to start the game. Check console for details.",
        );
        throw err;
      }
    }
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
      <div><b>WASD</b> — move &nbsp; <b>Q/E</b> — strafe</div>
      <div><b>Space</b> — jump &nbsp; <b>Ctrl</b> — roll &nbsp; <b>F</b> — sprint</div>
      <div><b>LMB</b> — attack &nbsp; <b>3</b> — dash &nbsp; <b>Tab</b> — target</div>
      <div><b>RMB</b> — aim &nbsp; <b>X</b> — shoulder &nbsp; <b>F5</b> — FPS</div>
      <div><b>C</b> — panel &nbsp; <b>1/2/4/5/R</b> — spells &nbsp; <b>F1–F4</b> — scenes</div>
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

  _showSceneError(message) {
    let el = document.getElementById('grudgeSceneError');
    if (!el) {
      el = document.createElement('div');
      el.id = 'grudgeSceneError';
      el.style.cssText = `
        position:fixed; top:44px; left:50%; transform:translateX(-50%);
        z-index:10000; padding:8px 12px; border-radius:6px;
        border:1px solid rgba(212, 80, 80, 0.45);
        background:rgba(26, 8, 8, 0.86); color:#f0b4b4;
        font-family:'Open Sans','Helvetica Neue',sans-serif;
        font-size:11px; letter-spacing:0.4px;
      `;
      document.body.appendChild(el);
    }
    el.textContent = message;
  }
}

export default SceneManager;
