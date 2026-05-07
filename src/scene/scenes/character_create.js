/**
 * character_create.js
 * Grudge Warlords — Character Creation Scene (F4)
 *
 * Architecture: DEDICATED preview engine on its own <canvas> inside the
 * left panel, completely isolated from the main game engine. The character
 * model, camera, lights, and platform all live in a separate Babylon.js
 * Engine+Scene so framing, lighting, and equipment switching are reliable.
 *
 * The main engine receives a near-empty scene (dark background only).
 * The UI is plain HTML overlaying both canvases.
 */

import { loadRaceCharacter } from '../../character/raceHero.js';
import { FACTIONS, RACE_ORDER, WEAPON_SLOTS } from '../../character/GrudgeFactionRegistry.js';
import { GrudgeSDK, ANIM_CATALOG, CLASS_ANIM_MAP, getAnimsForClass } from '../../lib/grudgeSDK.js';
import { getSkillDisplayList, ELEMENT_ICONS, ELEMENT_COLORS } from '../../combat/weaponSkills.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE FACTORY — called by SceneManager
// ═══════════════════════════════════════════════════════════════════════════════

export async function createCharacterCreate(engine) {
  // The main engine gets a blank dark scene (the preview is on its own canvas)
  const mainScene = new BABYLON.Scene(engine);
  mainScene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.06, 1);

  // ── Prefetch game data ──────────────────────────────────────────────────
  const sdk = await GrudgeSDK.prefetch();
  const racesMap   = GrudgeSDK.getRacesMap(sdk.races);
  const classesMap = GrudgeSDK.getClassesMap(sdk.classes);

  // ── State ───────────────────────────────────────────────────────────────
  let activeRace  = CHAR_SELECT?.race  || 'human';
  let activeClass = CHAR_SELECT?.class || 'warrior';
  if (!racesMap[activeRace])   activeRace  = 'human';
  if (!classesMap[activeClass]) activeClass = 'warrior';

  let currentRaceChar  = null;
  let classAnimActions  = {};
  let _currentClassAG   = null;
  let previewEngine     = null;
  let previewScene      = null;
  let characterNode     = null;
  let autoRotate        = true;

  // ── Build DOM UI ────────────────────────────────────────────────────────
  _injectAssets();
  const root = _buildDOM(racesMap, classesMap, activeRace, activeClass);
  document.body.appendChild(root);

  // ── Create dedicated preview engine on the preview canvas ───────────────
  const previewCanvas = root.querySelector('#cc-preview-canvas');
  try {
    previewEngine = new BABYLON.Engine(previewCanvas, true, { preserveDrawingBuffer: true, stencil: true });
    previewScene  = new BABYLON.Scene(previewEngine);
    previewScene.clearColor = new BABYLON.Color4(0.07, 0.07, 0.10, 1);

    // Camera — targets chest height, tight framing
    const cam = new BABYLON.ArcRotateCamera('ccCam', -Math.PI / 2, Math.PI / 2.6, 3.5,
      new BABYLON.Vector3(0, 0.85, 0), previewScene);
    cam.lowerRadiusLimit = 1.5;
    cam.upperRadiusLimit = 8;
    cam.upperBetaLimit = Math.PI / 2.1;
    cam.wheelDeltaPercentage = 0.02;
    cam.minZ = 0.1;
    cam.attachControl(previewCanvas, true);

    // Lighting — studio rig
    const hemi = new BABYLON.HemisphericLight('ccHemi', new BABYLON.Vector3(0, 1, 0), previewScene);
    hemi.intensity = 0.8;
    hemi.diffuse = new BABYLON.Color3(1.0, 0.95, 0.9);
    hemi.groundColor = new BABYLON.Color3(0.15, 0.15, 0.2);

    const key = new BABYLON.DirectionalLight('ccKey', new BABYLON.Vector3(-1, -2, -1), previewScene);
    key.intensity = 1.8;
    key.position.copyFromFloats(3, 6, 4);

    const fill = new BABYLON.DirectionalLight('ccFill', new BABYLON.Vector3(2, -1, 1), previewScene);
    fill.intensity = 0.6;
    fill.diffuse = new BABYLON.Color3(0.7, 0.75, 0.85);

    // Shadow
    const shadowGen = new BABYLON.ShadowGenerator(1024, key);
    shadowGen.usePoissonSampling = true;

    // IBL
    try {
      const envMap = BABYLON.CubeTexture.CreateFromPrefilteredData(
        './assets/textures/lighting/environment.env', previewScene);
      previewScene.environmentTexture = envMap;
      previewScene.environmentIntensity = 0.6;
    } catch (_) {}

    // Platform
    const ground = BABYLON.MeshBuilder.CreateCylinder('ccPlatform',
      { diameter: 2.5, height: 0.08, tessellation: 64 }, previewScene);
    ground.position.y = -0.04;
    const gMat = new BABYLON.PBRMaterial('ccGMat', previewScene);
    gMat.albedoColor = new BABYLON.Color3(0.08, 0.06, 0.04);
    gMat.metallic = 0.3; gMat.roughness = 0.8;
    ground.material = gMat;
    ground.receiveShadows = true;

    const ring = BABYLON.MeshBuilder.CreateTorus('ccRing',
      { diameter: 2.5, thickness: 0.015, tessellation: 64 }, previewScene);
    ring.position.y = 0.01;
    const rMat = new BABYLON.PBRMaterial('ccRMat', previewScene);
    rMat.albedoColor = new BABYLON.Color3(0.60, 0.50, 0.25);
    rMat.metallic = 0.8; rMat.roughness = 0.3;
    rMat.emissiveColor = new BABYLON.Color3(0.15, 0.12, 0.03);
    ring.material = rMat;

    // Character root node
    characterNode = new BABYLON.TransformNode('ccCharRoot', previewScene);

    // Auto-rotate
    previewScene.onBeforeRenderObservable.add(() => {
      if (autoRotate && characterNode) characterNode.rotation.y += 0.004;
    });
    previewCanvas.addEventListener('pointerdown', () => { autoRotate = false; });
    previewCanvas.addEventListener('dblclick', () => { autoRotate = true; });

    // Start preview render loop
    previewEngine.runRenderLoop(() => previewScene.render());

    // Resize
    const resizePreview = () => {
      const wrap = previewCanvas.parentElement;
      if (wrap) {
        previewCanvas.width = wrap.clientWidth;
        previewCanvas.height = wrap.clientHeight;
        previewEngine.resize();
      }
    };
    window.addEventListener('resize', resizePreview);
    setTimeout(resizePreview, 100);

  } catch (err) {
    console.error('[character_create] Preview engine failed:', err);
  }

  // ── Wire UI events ──────────────────────────────────────────────────────
  // Race buttons
  root.querySelectorAll('.cc-race-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.cc-race-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeRace = btn.dataset.race;
      _switchRace(activeRace);
    });
  });

  // Class buttons
  root.querySelectorAll('.cc-class-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.cc-class-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeClass = btn.dataset.class;
      if (currentRaceChar) currentRaceChar.applyClassBuild(activeClass);
      _updateStats();
      _updateEquipPanel();
      _updateSkillsPanel();
      _loadClassAnims(activeClass);
    });
  });

  // Equipment cycling
  root.addEventListener('click', (e) => {
    const prev = e.target.closest('.cc-eq-prev');
    const next = e.target.closest('.cc-eq-next');
    if (!prev && !next) return;
    if (!currentRaceChar) return;
    const slot = (prev || next).dataset.slot;
    const dir = prev ? -1 : 1;
    const summary = currentRaceChar.equipManager.getSummary();
    const info = summary[slot];
    if (!info || !info.variants.length) return;
    let idx = info.variants.indexOf(info.equipped);
    if (idx < 0) idx = 0;
    idx = Math.max(0, Math.min(info.variants.length - 1, idx + dir));
    const v = info.variants[idx];
    const em = currentRaceChar.equipManager;
    if (WEAPON_SLOTS.has(slot)) em.equipWeapon(slot, v);
    else if (slot === 'shield') em.equipShield(v);
    else em.equip(slot, v);
    _updateEquipPanel();
    _updateSkillsPanel();
  });

  // Enter World
  root.querySelector('#cc-enter-world').addEventListener('click', () => {
    CHAR_SELECT.race  = activeRace;
    CHAR_SELECT.class = activeClass;
    CHAR_SELECT.name  = (root.querySelector('#cc-name-input')?.value || '').trim();
    CHAR_SELECT.equip = currentRaceChar?.equipManager?.equipped || {};
    if (typeof SCENE_MANAGER?.navigateTo === 'function') {
      SCENE_MANAGER.navigateTo('outdoor');
    }
  });

  // ── Character loading ───────────────────────────────────────────────────
  async function _switchRace(raceId) {
    // Dispose old class anims
    for (const ag of Object.values(classAnimActions)) {
      try { ag.stop(); ag.dispose(); } catch (_) {}
    }
    classAnimActions = {};
    _currentClassAG = null;

    // Dispose old character
    if (currentRaceChar) {
      currentRaceChar.dispose();
      currentRaceChar = null;
    }

    if (!previewScene) return;

    try {
      currentRaceChar = await loadRaceCharacter(previewScene, raceId, characterNode, { classId: activeClass });
      // Add shadows
      const sg = previewScene.getLightByID('ccKey')?._shadowGenerators?.[0];
      if (sg) {
        for (const mesh of currentRaceChar.result.meshes) sg.addShadowCaster(mesh);
      }
      _updateEquipPanel();
      _updateStats();
      _updateSkillsPanel();
      _loadClassAnims(activeClass);
      autoRotate = true;
    } catch (err) {
      console.error('[character_create] Race load failed:', err);
    }
  }

  async function _loadClassAnims(classId) {
    for (const ag of Object.values(classAnimActions)) {
      try { ag.stop(); ag.dispose(); } catch (_) {}
    }
    classAnimActions = {};
    _currentClassAG = null;

    const packKey = CLASS_ANIM_MAP[classId];
    const pack = ANIM_CATALOG[packKey];
    if (!pack || !currentRaceChar?.skeleton || !previewScene) return;
    const skeleton = currentRaceChar.skeleton;

    const entries = Object.entries(pack.anims);
    await Promise.allSettled(entries.map(async ([animKey, def]) => {
      const fullPath = pack.path + def.file;
      const folder = fullPath.substring(0, fullPath.lastIndexOf('/') + 1);
      const file = fullPath.substring(fullPath.lastIndexOf('/') + 1);
      try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(null, folder, file, previewScene);
        const animGroups = result.animationGroups || previewScene.animationGroups.slice(-1);
        if (animGroups.length > 0) {
          const ag = animGroups[0];
          ag.name = animKey;
          const boneMap = {};
          for (const bone of skeleton.bones) boneMap[bone.name] = bone;
          for (const ta of ag.targetedAnimations) {
            if (ta.target?.name && boneMap[ta.target.name]) ta.target = boneMap[ta.target.name];
          }
          for (const m of result.meshes) m.dispose();
          classAnimActions[animKey] = ag;
        }
      } catch (_) {}
    }));

    _updateAnimGrid();
  }

  // ── UI update helpers ───────────────────────────────────────────────────
  function _updateStats() {
    const container = root.querySelector('#cc-stats');
    if (!container) return;
    const raceData = racesMap[activeRace];
    const classData = classesMap[activeClass];
    const rb = raceData?.bonuses || {};
    const ca = classData?.startingAttributes || {};
    const ATTRS = ['Strength','Intellect','Vitality','Dexterity','Endurance','Wisdom','Agility','Tactics'];
    container.innerHTML = ATTRS.map(attr => {
      const total = (rb[attr] || 0) + (ca[attr] || 0);
      const pct = Math.min((total / 5) * 100, 100);
      return `<div class="cc-stat-row">
        <span class="cc-stat-label">${attr.substring(0,3).toUpperCase()}</span>
        <div class="cc-stat-bar-wrap"><div class="cc-stat-bar" style="width:${pct}%"></div></div>
        <span class="cc-stat-value">${total}</span>
      </div>`;
    }).join('');
  }

  function _updateEquipPanel() {
    const container = root.querySelector('#cc-equip');
    if (!container || !currentRaceChar) return;
    const summary = currentRaceChar.equipManager.getSummary();
    const classData = classesMap[activeClass];
    const allowed = new Set(classData?.weaponTypes || ['sword','axe','hammer','bow','staff','spear']);
    const ICONS = { body:'👕', arms:'🧤', legs:'👖', head:'⛑', shoulders:'🦺', sword:'⚔', axe:'🪓', hammer:'🔨', bow:'🏹', staff:'🪄', shield:'🛡', spear:'🗡', lance:'🏇', mace:'🪃', pick:'⛏', dagger:'🗡', bag:'👜', wood:'🪵', quiver:'🏹' };
    const LABELS = { body:'Body', arms:'Arms', legs:'Legs', head:'Helmet', shoulders:'Shoulders', sword:'Sword', axe:'Axe', hammer:'Hammer', mace:'Mace', pick:'Pick', bow:'Bow', staff:'Staff', spear:'Spear', lance:'Lance', dagger:'Dagger', shield:'Shield', bag:'Bag', wood:'Wood', quiver:'Quiver' };
    const TIER_LABEL = { cloth:'Cloth', leather:'Leather', plate:'Plate' };

    let h = '<div class="cc-equip-grid">';
    for (const [slot, info] of Object.entries(summary)) {
      if (!info.variants.length) continue;
      const isW = WEAPON_SLOTS.has(slot);
      const locked = isW && !allowed.has(slot);
      const idx = info.variants.indexOf(info.equipped);
      const tierClass = info.equippedTier ? `cc-tier-${info.equippedTier}` : '';
      const tierLabel = info.equippedTier ? TIER_LABEL[info.equippedTier] || '' : '';
      h += `<div class="cc-equip-slot" ${locked ? 'style="opacity:0.4"' : ''}>
        <span class="cc-equip-icon">${ICONS[slot] || '📦'}</span>
        <span class="cc-equip-label">${LABELS[slot] || slot}${locked ? ' 🔒' : ''}</span>
        ${tierLabel ? `<span class="cc-tier-badge ${tierClass}">${tierLabel}</span>` : ''}
        <div class="cc-equip-arrows">
          <button class="cc-eq-prev" data-slot="${slot}" ${locked || idx <= 0 ? 'disabled' : ''}>◀</button>
          <span class="cc-equip-current">${idx + 1}/${info.variants.length}</span>
          <button class="cc-eq-next" data-slot="${slot}" ${locked || idx >= info.variants.length - 1 ? 'disabled' : ''}>▶</button>
        </div>
      </div>`;
    }
    h += '</div>';
    container.innerHTML = h;
  }

  function _updateSkillsPanel() {
    const container = root.querySelector('#cc-skills');
    if (!container) return;
    const wpn = currentRaceChar?.equipManager?.equipped?.weapon?.type || 'sword';
    const skills = getSkillDisplayList(wpn, activeClass);
    if (!skills.length) { container.innerHTML = '<div style="color:#666;font-size:11px;">No weapon</div>'; return; }
    container.innerHTML = skills.map(s => {
      const icon = ELEMENT_ICONS[s.element] || '⚔';
      const color = ELEMENT_COLORS[s.element] || '#b8b8c0';
      const stat = s.heal ? `+${s.heal} HP` : (s.damage ? `${s.damage} dmg` : '');
      return `<div class="cc-skill-card"><span class="cc-skill-icon" style="color:${color}">${icon}</span>
        <div class="cc-skill-info"><span class="cc-skill-name">${s.name}</span>
        <span class="cc-skill-stat" style="color:${color}">${stat}</span></div></div>`;
    }).join('');
  }

  function _updateAnimGrid() {
    const container = root.querySelector('#cc-anims');
    if (!container) return;
    const anims = getAnimsForClass(activeClass);
    container.innerHTML = Object.entries(anims).map(([k, d]) =>
      `<button class="cc-anim-btn" data-anim="${k}">${d.label}</button>`
    ).join('');
    container.querySelectorAll('.cc-anim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentRaceChar) return;
        const key = btn.dataset.anim;
        const def = anims[key];
        const loop = def ? def.loop : true;
        if (classAnimActions[key]) {
          if (_currentClassAG && _currentClassAG !== classAnimActions[key]) _currentClassAG.stop();
          classAnimActions[key].start(loop, 1.0);
          _currentClassAG = classAnimActions[key];
        } else {
          currentRaceChar.playAnim(key, loop);
        }
      });
    });
  }

  // ── Cleanup on scene dispose ────────────────────────────────────────────
  mainScene.onDisposeObservable.add(() => {
    if (previewEngine) {
      previewEngine.stopRenderLoop();
      if (currentRaceChar) currentRaceChar.dispose();
      for (const ag of Object.values(classAnimActions)) { try { ag.dispose(); } catch (_) {} }
      previewScene?.dispose();
      previewEngine.dispose();
    }
    if (root.parentNode) root.parentNode.removeChild(root);
  });

  // ── Initial load ────────────────────────────────────────────────────────
  await _switchRace(activeRace);

  return mainScene;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOM BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function _buildDOM(racesMap, classesMap, initRace, initClass) {
  const root = document.createElement('div');
  root.id = 'grudge-char-create';

  const raceOrder = ['human', 'barbarian', 'elf', 'dwarf', 'orc', 'undead'];

  root.innerHTML = `
    <div class="cc-overlay">
      <div class="cc-panel">
        <div class="cc-header">
          <div class="cc-header-title">
            <h2>Grudge Warlords</h2>
            <span class="cc-header-subtitle">Character Creation</span>
          </div>
        </div>
        <div class="cc-content">
          <div class="cc-preview-col">
            <div class="cc-preview-wrap">
              <canvas id="cc-preview-canvas"></canvas>
            </div>
            <div class="cc-preview-hint">Drag to rotate | Scroll to zoom | Double-click auto-rotate</div>
            <div class="cc-race-section">
              <div class="cc-race-row">
                ${raceOrder.map(rId => {
                  const f = FACTIONS[rId];
                  return `<button class="cc-race-btn ${rId === initRace ? 'active' : ''}" data-race="${rId}">
                    <span class="cc-race-icon" style="background:${f?.color || '#ccc'}"></span>
                    <span class="cc-race-name">${f?.name || rId}</span>
                    <span class="cc-race-desc">${f?.faction || ''}</span>
                  </button>`;
                }).join('')}
              </div>
            </div>
          </div>
          <div class="cc-controls">
            <div class="cc-tab-panels">
              <h3 class="cc-section-label">Character Name</h3>
              <input type="text" id="cc-name-input" class="cc-name-input" placeholder="Enter a name…" maxlength="24" />
              <div class="cc-section-divider"></div>
              <h3 class="cc-section-label">Class</h3>
              <div class="cc-class-row">
                ${Object.entries(classesMap).map(([cId, c]) =>
                  `<button class="cc-class-btn ${cId === initClass ? 'active' : ''}" data-class="${cId}">
                    <span class="cc-class-icon">${c.emoji || '⚔'}</span>
                    <span class="cc-class-name">${c.name}</span>
                    <span class="cc-class-desc">${c.description ? c.description.substring(0, 50) + '…' : ''}</span>
                    <span class="cc-class-bonuses">${_fmtBonuses(c.startingAttributes)}</span>
                  </button>`
                ).join('')}
              </div>
              <div class="cc-section-divider"></div>
              <h3 class="cc-section-label">Attributes</h3>
              <div id="cc-stats"></div>
              <div class="cc-section-divider"></div>
              <h3 class="cc-section-label">Equipment</h3>
              <div id="cc-equip"></div>
              <div class="cc-section-divider"></div>
              <h3 class="cc-section-label">Skills</h3>
              <div id="cc-skills" class="cc-skill-grid"></div>
              <div class="cc-section-divider"></div>
              <h3 class="cc-section-label">Animations</h3>
              <div id="cc-anims" class="cc-anim-grid"></div>
            </div>
          </div>
        </div>
        <div class="cc-footer">
          <button class="cc-enter-btn" id="cc-enter-world">Enter World</button>
        </div>
      </div>
    </div>
  `;
  return root;
}

function _fmtBonuses(attrs) {
  if (!attrs) return '';
  return Object.entries(attrs).filter(([,v]) => v > 0).map(([k,v]) => `+${v} ${k.substring(0,3)}`).join(', ');
}

function _injectAssets() {
  if (!document.querySelector('link[href*="Cinzel"]')) {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Fira+Sans:wght@300;400;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[href*="characterCreator"]')) {
    const css = document.createElement('link');
    css.href = './src/styles/characterCreator.css';
    css.rel = 'stylesheet';
    document.head.appendChild(css);
  }
}
