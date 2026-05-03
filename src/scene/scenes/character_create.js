/**
 * character_create.js
 * Grudge Warlords — Character Creation Scene (F4)
 *
 * Full Babylon.js scene for creating a character:
 * - Real data from Grudge ObjectStore (races, classes, attributes, factions)
 * - 6 race FBX models with equipment slot toggling
 * - 4 classes with weapon restrictions and starting attributes
 * - 136 animations across 4 packs (base + sword&shield + longbow + magic)
 * - Admin panel for object storage asset browsing
 * - Enter World → transitions to outdoor scene with selected config
 *
 * Access: F4 hotkey or ?scene=character_create
 */

import { loadRaceCharacter } from '../../character/raceHero.js';
import { FACTIONS, RACE_ORDER, ANIMATION_PACKS, SLOT_PATTERNS, WEAPON_SLOTS }
  from '../../character/GrudgeFactionRegistry.js';
import { GrudgeSDK, ANIM_CATALOG, CLASS_ANIM_MAP, getAnimsForClass, getAllAnims }
  from '../../lib/grudgeSDK.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export async function createCharacterCreate(engine) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.06, 1);

  // ── Prefetch real game data from Grudge ObjectStore ─────────────────────────
  const sdk = await GrudgeSDK.prefetch();
  const racesMap   = GrudgeSDK.getRacesMap(sdk.races);
  const classesMap = GrudgeSDK.getClassesMap(sdk.classes);
  const factionsMap = GrudgeSDK.getFactionsMap(sdk.factions);

  // ── Camera ──────────────────────────────────────────────────────────────────
  const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.2, 5,
    new BABYLON.Vector3(0, 0, 0), scene);
  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 10;
  camera.upperBetaLimit = Math.PI / 2;
  camera.wheelDeltaPercentage = 0.02;
  camera.attachControl(engine.getRenderingCanvas(), true);

  // ── Lighting ────────────────────────────────────────────────────────────────
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.6;
  hemi.diffuse = new BABYLON.Color3(0.9, 0.85, 0.75);
  hemi.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);

  const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, -1), scene);
  dir.intensity = 1.4;
  dir.position = new BABYLON.Vector3(5, 10, 5);

  const shadowGen = new BABYLON.ShadowGenerator(1024, dir);
  shadowGen.usePoissonSampling = true;

  // IBL
  try {
    const envMap = BABYLON.CubeTexture.CreateFromPrefilteredData(
      './assets/textures/lighting/environment.env', scene);
    scene.environmentTexture = envMap;
    scene.environmentIntensity = 0.8;
  } catch (_) {}

  // ── Platform ────────────────────────────────────────────────────────────────
  const ground = BABYLON.MeshBuilder.CreateCylinder('platform',
    { diameter: 4, height: 0.15, tessellation: 64 }, scene);
  ground.position.y = -1.1;
  const gMat = new BABYLON.PBRMaterial('gMat', scene);
  gMat.albedoColor = new BABYLON.Color3(0.12, 0.10, 0.08);
  gMat.metallic = 0.2;
  gMat.roughness = 0.85;
  ground.material = gMat;
  ground.receiveShadow = true;

  const ring = BABYLON.MeshBuilder.CreateTorus('ring',
    { diameter: 4, thickness: 0.03, tessellation: 64 }, scene);
  ring.position.y = -1.02;
  const rMat = new BABYLON.PBRMaterial('rMat', scene);
  rMat.albedoColor = new BABYLON.Color3(0.78, 0.66, 0.32);
  rMat.metallic = 0.9;
  rMat.roughness = 0.2;
  rMat.emissiveColor = new BABYLON.Color3(0.4, 0.3, 0.05);
  ring.material = rMat;

  // ── State ───────────────────────────────────────────────────────────────────
  let activeRace = CHAR_SELECT?.race || 'human';
  let activeClass = CHAR_SELECT?.class || 'warrior';
  let currentRaceChar = null;
  const characterNode = new BABYLON.TransformNode('charRoot', scene);
  let autoRotate = true;
  let classAnimActions = {}; // loaded class-specific anim actions

  // ── DOM UI ──────────────────────────────────────────────────────────────────
  const ui = _buildUI(scene, racesMap, classesMap, factionsMap, {
    onRaceChange: async (raceId) => {
      activeRace = raceId;
      await _switchRace(raceId);
    },
    onClassChange: async (classId) => {
      activeClass = classId;
      _updateStats();
      _updateEquipPanel();
      await _loadClassAnims(classId);
      _updateAnimGrid();
    },
    onEquipChange: (slot, variant) => {
      if (!currentRaceChar) return;
      const em = currentRaceChar.equipManager;
      if (WEAPON_SLOTS.has(slot)) em.equipWeapon(slot, variant);
      else if (slot === 'shield') em.equipShield(variant);
      else em.equip(slot, variant);
    },
    onAnimPlay: (animKey) => {
      if (!currentRaceChar) return;
      // Check class anims first, then base
      const allAnims = getAnimsForClass(activeClass);
      const def = allAnims[animKey];
      const loop = def ? def.loop : !['death','hit','attack1','attack2','attack3'].includes(animKey);

      // Try class anim action first
      if (classAnimActions[animKey]) {
        _playAnimGroup(classAnimActions[animKey], loop);
      } else {
        currentRaceChar.playAnim(animKey, loop);
      }
    },
    onEnterWorld: () => {
      // Store selection globally and navigate to outdoor
      CHAR_SELECT.race = activeRace;
      CHAR_SELECT.class = activeClass;
      CHAR_SELECT.equip = currentRaceChar?.equipManager?.equipped || {};
      if (typeof SCENE_MANAGER?.navigateTo === 'function') {
        SCENE_MANAGER.navigateTo('outdoor');
      }
    },
  });

  // Cleanup DOM on scene dispose
  scene.onDisposeObservable.add(() => {
    if (ui.root && ui.root.parentNode) ui.root.parentNode.removeChild(ui.root);
  });

  // ── Anim blending helper ────────────────────────────────────────────────────
  let _currentClassAG = null;
  function _playAnimGroup(ag, loop) {
    if (_currentClassAG && _currentClassAG !== ag) _currentClassAG.stop();
    if (currentRaceChar?._currentAnim) {
      currentRaceChar._currentAnim.stop();
      currentRaceChar._currentAnim = null;
    }
    ag.start(loop, 1.0, ag.from, ag.to, false);
    _currentClassAG = ag;
  }

  // ── Load class animations ───────────────────────────────────────────────────
  async function _loadClassAnims(classId) {
    const packKey = CLASS_ANIM_MAP[classId];
    const pack = ANIM_CATALOG[packKey];
    if (!pack || !currentRaceChar?.skeleton) return;

    classAnimActions = {};
    const skeleton = currentRaceChar.skeleton;

    const entries = Object.entries(pack.anims);
    await Promise.allSettled(entries.map(async ([key, def]) => {
      const fullPath = pack.path + def.file;
      const folder = fullPath.substring(0, fullPath.lastIndexOf('/') + 1);
      const file = fullPath.substring(fullPath.lastIndexOf('/') + 1);
      try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(null, folder, file, scene);
        const animGroups = result.animationGroups || scene.animationGroups.slice(-1);
        if (animGroups.length > 0) {
          const ag = animGroups[0];
          ag.name = key;
          // Retarget to our skeleton
          const boneMap = {};
          for (const bone of skeleton.bones) boneMap[bone.name] = bone;
          for (const ta of ag.targetedAnimations) {
            if (ta.target?.name && boneMap[ta.target.name]) {
              ta.target = boneMap[ta.target.name];
            }
          }
          for (const m of result.meshes) m.dispose();
          classAnimActions[key] = ag;
        }
      } catch (e) {
        // Silently skip failed anims
      }
    }));
  }

  // ── Race switch ─────────────────────────────────────────────────────────────
  async function _switchRace(raceId) {
    if (currentRaceChar) {
      currentRaceChar.dispose();
      currentRaceChar = null;
      classAnimActions = {};
      _currentClassAG = null;
    }

    try {
      currentRaceChar = await loadRaceCharacter(scene, raceId, characterNode);
      for (const mesh of currentRaceChar.result.meshes) {
        shadowGen.addShadowCaster(mesh);
      }
      _updateEquipPanel();
      _updateStats();
      await _loadClassAnims(activeClass);
      _updateAnimGrid();
      autoRotate = true;
    } catch (err) {
      console.error('[character_create] Race load failed:', err);
    }
  }

  // ── UI update helpers ───────────────────────────────────────────────────────
  function _updateStats() {
    const raceData = racesMap[activeRace];
    const classData = classesMap[activeClass];
    const bonuses = raceData?.bonuses || {};
    const classAttrs = classData?.startingAttributes || {};
    ui.updateStats(bonuses, classAttrs);
  }

  function _updateEquipPanel() {
    if (!currentRaceChar) return;
    const summary = currentRaceChar.equipManager.getSummary();
    const classData = classesMap[activeClass];
    const allowedWeapons = new Set(classData?.weaponTypes || ['sword','axe','hammer','bow','staff','spear']);
    ui.updateEquipment(summary, allowedWeapons);
  }

  function _updateAnimGrid() {
    const anims = getAnimsForClass(activeClass);
    ui.updateAnimations(anims);
  }

  // ── Auto-rotate ─────────────────────────────────────────────────────────────
  scene.onBeforeRenderObservable.add(() => {
    if (autoRotate) characterNode.rotation.y += 0.003;
  });
  scene.onPointerObservable.add((info) => {
    if (info.type === BABYLON.PointerEventTypes.POINTERDOWN) autoRotate = false;
    if (info.type === BABYLON.PointerEventTypes.POINTERDOUBLETAP) autoRotate = true;
  });

  // ── Initial load ────────────────────────────────────────────────────────────
  await _switchRace(activeRace);

  scene.executeWhenReady(() => scene.render());
  return scene;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOM UI BUILDER — Real Grudge data, WCS styling, no placeholders
// ═══════════════════════════════════════════════════════════════════════════════

function _buildUI(scene, racesMap, classesMap, factionsMap, callbacks) {
  const GOLD = '#c8a951';

  // ── Root container ──
  const root = document.createElement('div');
  root.id = 'grudge-char-create';
  root.style.cssText = `
    position:fixed; top:0; right:0; width:380px; height:100vh; overflow-y:auto;
    background:rgba(8,10,18,0.94); border-left:1px solid rgba(200,169,81,0.18);
    font-family:'Cinzel','Georgia',serif; color:#b8b8c0; z-index:9998;
    scrollbar-width:thin; scrollbar-color:${GOLD} #111;
  `;

  // Inject Google Fonts if not present
  if (!document.querySelector('link[href*="Cinzel"]')) {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Fira+Sans:wght@300;400;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  const _section = (title) => `<div style="font-family:'Cinzel',serif;font-size:10px;font-weight:700;
    letter-spacing:3px;color:${GOLD};padding:14px 16px 6px;
    border-top:1px solid rgba(200,169,81,0.08);">${title}</div>`;

  const _btn = (cls, extra = '') => `
    padding:8px 6px;text-align:center;background:rgba(16,18,30,0.85);
    border:1px solid rgba(255,255,255,0.04);border-radius:6px;cursor:pointer;
    transition:all 0.2s;font-family:'Cinzel',serif;font-size:10px;font-weight:700;
    color:#ddd;letter-spacing:1px;${extra}`;

  // ── Build HTML from real data ──
  let html = `
    <div style="text-align:center;padding:24px 16px 6px;
      background:linear-gradient(180deg,rgba(200,169,81,0.08),transparent);">
      <div style="font-size:20px;font-weight:900;letter-spacing:6px;color:${GOLD};
        text-shadow:0 0 20px rgba(200,169,81,0.3);">GRUDGE WARLORDS</div>
      <div style="font-size:10px;letter-spacing:4px;color:#666;margin-top:4px;">CHARACTER CREATION</div>
    </div>
  `;

  // ── Faction tabs ──
  html += _section('FACTION');
  html += '<div style="display:flex;gap:2px;padding:0 16px;">';
  for (const [fId, fac] of Object.entries(factionsMap)) {
    html += `<button class="cc-faction-tab" data-faction="${fId}" style="
      flex:1;padding:6px 0;text-align:center;font-family:'Cinzel',serif;font-size:9px;
      font-weight:700;letter-spacing:2px;cursor:pointer;border:1px solid transparent;
      border-radius:4px;background:transparent;color:#666;transition:all 0.2s;">
      ${(fac.name || fId).toUpperCase()}</button>`;
  }
  html += '</div>';

  // ── Race grid (from real API data) ──
  html += _section('RACE');
  html += '<div id="cc-race-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 16px;">';
  const raceOrder = ['human', 'barbarian', 'elf', 'dwarf', 'orc', 'undead'];
  for (const rId of raceOrder) {
    const r = racesMap[rId];
    if (!r) continue;
    const fName = factionsMap[r.faction]?.name || r.faction;
    html += `<div class="cc-race-card" data-race="${rId}" style="${_btn('', `position:relative;overflow:hidden;`)}">
      <div style="color:${r.color || '#ccc'};font-size:11px;">${r.name}</div>
      <div style="font-size:8px;color:#666;letter-spacing:1px;margin-top:2px;">${fName}</div>
    </div>`;
  }
  html += '</div>';
  html += '<div id="cc-race-desc" style="padding:4px 16px;font-size:11px;color:#999;font-style:italic;line-height:1.6;"></div>';

  // ── Class grid (from real API data) ──
  html += _section('CLASS');
  html += '<div id="cc-class-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 16px;">';
  for (const [cId, c] of Object.entries(classesMap)) {
    html += `<div class="cc-class-card" data-class="${cId}" style="${_btn()}">
      <div style="font-size:16px;">${c.emoji || c.icon || '⚔'}</div>
      <div style="font-size:10px;color:#ddd;margin-top:4px;">${c.name}</div>
      <div style="font-size:8px;color:#666;margin-top:2px;">${c.description ? c.description.substring(0, 40) + '…' : ''}</div>
    </div>`;
  }
  html += '</div>';

  // ── Stats ──
  html += _section('ATTRIBUTES');
  html += '<div id="cc-stats"></div>';

  // ── Equipment ──
  html += _section('EQUIPMENT');
  html += '<div id="cc-equip"></div>';

  // ── Animations ──
  html += _section('ANIMATIONS');
  html += '<div id="cc-anims" style="display:flex;flex-wrap:wrap;gap:4px;padding:6px 16px;"></div>';

  // ── Admin panel toggle ──
  html += _section('ADMIN');
  html += `<div style="padding:4px 16px;">
    <button id="cc-admin-toggle" style="width:100%;padding:8px;font-family:'Cinzel',serif;
      font-size:10px;letter-spacing:2px;background:rgba(139,32,32,0.15);
      color:#d45050;border:1px solid rgba(212,80,80,0.3);border-radius:6px;
      cursor:pointer;transition:all 0.2s;">⚙ OBJECT STORAGE BROWSER</button>
  </div>`;
  html += '<div id="cc-admin-panel" style="display:none;padding:8px 16px;"></div>';

  // ── Enter World ──
  html += `<div style="padding:20px 16px 40px;">
    <button id="cc-enter-world" style="width:100%;padding:14px;font-family:'Cinzel',serif;
      font-size:14px;font-weight:700;letter-spacing:4px;
      background:linear-gradient(135deg,rgba(200,169,81,0.2),rgba(200,169,81,0.05));
      color:${GOLD};border:1px solid rgba(200,169,81,0.45);border-radius:8px;
      cursor:pointer;transition:all 0.3s;text-shadow:0 0 10px rgba(200,169,81,0.3);">
      ENTER WORLD</button>
  </div>`;

  root.innerHTML = html;
  document.body.appendChild(root);

  // ── Wire events ─────────────────────────────────────────────────────────────
  const state = { activeRace: CHAR_SELECT?.race || 'human', activeClass: CHAR_SELECT?.class || 'warrior' };

  // Race cards
  root.querySelectorAll('.cc-race-card').forEach(card => {
    card.addEventListener('click', () => {
      state.activeRace = card.dataset.race;
      _highlightActive(root, '.cc-race-card', 'data-race', state.activeRace);
      const r = racesMap[state.activeRace];
      root.querySelector('#cc-race-desc').textContent = r?.description || r?.lore || '';
      callbacks.onRaceChange(state.activeRace);
    });
  });

  // Class cards
  root.querySelectorAll('.cc-class-card').forEach(card => {
    card.addEventListener('click', () => {
      state.activeClass = card.dataset.class;
      _highlightActive(root, '.cc-class-card', 'data-class', state.activeClass);
      callbacks.onClassChange(state.activeClass);
    });
  });

  // Enter world
  root.querySelector('#cc-enter-world').addEventListener('click', callbacks.onEnterWorld);

  // Admin toggle
  root.querySelector('#cc-admin-toggle').addEventListener('click', () => {
    const panel = root.querySelector('#cc-admin-panel');
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) _buildAdminPanel(panel);
  });

  // Initial highlights
  _highlightActive(root, '.cc-race-card', 'data-race', state.activeRace);
  _highlightActive(root, '.cc-class-card', 'data-class', state.activeClass);
  const rDesc = racesMap[state.activeRace];
  root.querySelector('#cc-race-desc').textContent = rDesc?.description || rDesc?.lore || '';

  // ── Return UI handle ────────────────────────────────────────────────────────
  return {
    root,
    updateStats(raceBonuses, classAttrs) {
      const container = root.querySelector('#cc-stats');
      const ATTRS = ['Strength','Intellect','Vitality','Dexterity','Endurance','Wisdom','Agility','Tactics'];
      let h = '';
      for (const attr of ATTRS) {
        const rVal = raceBonuses[attr] || 0;
        const cVal = classAttrs[attr] || 0;
        const total = rVal + cVal;
        const pct = Math.min((total / 5) * 100, 100);
        h += `<div style="display:flex;align-items:center;padding:3px 16px;gap:8px;">
          <span style="width:52px;font-size:9px;font-weight:600;letter-spacing:1px;color:#888;">${attr.substring(0,3).toUpperCase()}</span>
          <div style="flex:1;height:6px;background:#1a1a2e;border-radius:3px;overflow:hidden;">
            <div style="height:100%;border-radius:3px;width:${pct}%;background:linear-gradient(90deg,${GOLD},#f0d070);transition:width 0.4s;"></div>
          </div>
          <span style="width:22px;text-align:right;font-size:9px;color:#f0d070;font-weight:600;">${total}</span>
        </div>`;
      }
      container.innerHTML = h;
    },
    updateEquipment(summary, allowedWeapons) {
      const container = root.querySelector('#cc-equip');
      const SLOT_LABELS = { body:'Body', arms:'Arms', legs:'Legs', head:'Helmet', shoulders:'Shoulders',
        sword:'Sword', axe:'Axe', hammer:'Hammer', pick:'Pick', spear:'Spear', bow:'Bow', staff:'Staff',
        shield:'Shield', bag:'Backpack', wood:'Wood', quiver:'Quiver' };
      let h = '';
      for (const [slot, info] of Object.entries(summary)) {
        if (!info.variants.length) continue;
        const isWeapon = WEAPON_SLOTS.has(slot);
        const locked = isWeapon && !allowedWeapons.has(slot);
        h += `<div style="display:flex;align-items:center;padding:3px 16px;gap:6px;">
          <span style="width:80px;font-size:10px;color:${locked ? '#444' : '#888'};">
            ${SLOT_LABELS[slot] || slot}${locked ? ' 🔒' : ''}</span>
          <div style="display:flex;gap:3px;flex-wrap:wrap;">`;
        for (const v of info.variants) {
          const isActive = info.equipped === v;
          h += `<button class="cc-equip-btn" data-slot="${slot}" data-variant="${v}"
            ${locked ? 'disabled' : ''} style="
            min-width:26px;height:22px;padding:0 6px;font-size:9px;font-weight:600;
            background:${isActive ? 'rgba(200,169,81,0.25)' : 'transparent'};
            color:${locked ? '#333' : GOLD};
            border:1px solid ${isActive ? GOLD : locked ? '#1a1a1a' : 'rgba(200,169,81,0.2)'};
            border-radius:3px;cursor:${locked ? 'not-allowed' : 'pointer'};transition:all 0.15s;">
            ${v === 'default' ? '✦' : v}</button>`;
        }
        h += '</div></div>';
      }
      container.innerHTML = h;
      // Wire equip buttons
      container.querySelectorAll('.cc-equip-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
          callbacks.onEquipChange(btn.dataset.slot, btn.dataset.variant);
          // Re-render after equip change (will be called by parent)
        });
      });
    },
    updateAnimations(anims) {
      const container = root.querySelector('#cc-anims');
      let h = '';
      for (const [key, def] of Object.entries(anims)) {
        h += `<button class="cc-anim-btn" data-anim="${key}" style="
          padding:5px 10px;font-size:9px;font-family:'Cinzel',serif;
          background:transparent;color:${GOLD};
          border:1px solid rgba(200,169,81,0.15);border-radius:3px;
          cursor:pointer;transition:all 0.15s;">
          ${def.label}</button>`;
      }
      container.innerHTML = h;
      container.querySelectorAll('.cc-anim-btn').forEach(btn => {
        btn.addEventListener('click', () => callbacks.onAnimPlay(btn.dataset.anim));
      });
    },
  };
}

// ── Admin Panel (Object Storage Browser) ──────────────────────────────────────

async function _buildAdminPanel(container) {
  container.innerHTML = `
    <div style="font-size:9px;color:#c8a951;letter-spacing:2px;margin-bottom:8px;">OBJECT STORAGE BROWSER</div>
    <div style="display:flex;gap:4px;margin-bottom:8px;">
      <button class="admin-cat" data-cat="weapons" style="flex:1;padding:4px;font-size:9px;
        background:rgba(200,169,81,0.1);color:#c8a951;border:1px solid rgba(200,169,81,0.2);
        border-radius:4px;cursor:pointer;">Weapons</button>
      <button class="admin-cat" data-cat="armor" style="flex:1;padding:4px;font-size:9px;
        background:rgba(200,169,81,0.1);color:#c8a951;border:1px solid rgba(200,169,81,0.2);
        border-radius:4px;cursor:pointer;">Armor</button>
      <button class="admin-cat" data-cat="races" style="flex:1;padding:4px;font-size:9px;
        background:rgba(200,169,81,0.1);color:#c8a951;border:1px solid rgba(200,169,81,0.2);
        border-radius:4px;cursor:pointer;">Races</button>
      <button class="admin-cat" data-cat="classes" style="flex:1;padding:4px;font-size:9px;
        background:rgba(200,169,81,0.1);color:#c8a951;border:1px solid rgba(200,169,81,0.2);
        border-radius:4px;cursor:pointer;">Classes</button>
    </div>
    <div id="admin-results" style="max-height:300px;overflow-y:auto;font-size:10px;color:#888;"></div>
  `;

  container.querySelectorAll('.admin-cat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cat = btn.dataset.cat;
      const resultsEl = container.querySelector('#admin-results');
      resultsEl.innerHTML = '<div style="color:#666;padding:8px;">Loading from ObjectStore…</div>';

      let data = null;
      if (cat === 'weapons') data = await GrudgeSDK.fetchWeapons();
      else if (cat === 'armor') data = await GrudgeSDK.fetchArmor();
      else if (cat === 'races') data = await GrudgeSDK.fetchRaces();
      else if (cat === 'classes') data = await GrudgeSDK.fetchClasses();

      if (!data) {
        resultsEl.innerHTML = '<div style="color:#d45050;padding:8px;">Failed to fetch from ObjectStore</div>';
        return;
      }

      // Render results as JSON tree
      resultsEl.innerHTML = `<pre style="white-space:pre-wrap;word-break:break-word;color:#888;
        font-size:9px;font-family:monospace;padding:4px;background:rgba(0,0,0,0.3);
        border-radius:4px;max-height:280px;overflow-y:auto;">${JSON.stringify(data, null, 2)}</pre>`;
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _highlightActive(root, selector, attr, activeVal) {
  root.querySelectorAll(selector).forEach(el => {
    const isActive = el.getAttribute(attr) === activeVal;
    el.style.borderColor = isActive ? '#c8a951' : 'rgba(255,255,255,0.04)';
    el.style.background = isActive ? 'rgba(200,169,81,0.08)' : 'rgba(16,18,30,0.85)';
  });
}
