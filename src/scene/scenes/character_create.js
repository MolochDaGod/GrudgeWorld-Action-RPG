/**
 * character_create.js
 * Grudge Warlords — Character Creation Scene (F4)
 *
 * Full-screen overlay character creator matching the WCS reference design:
 * - Left column: 3D Babylon.js preview on a platform + race grid
 * - Right column: Scrollable panels — name, class, stats, equipment (arrow cycling), anims
 * - Real data from Grudge ObjectStore (races, classes, attributes, factions)
 * - 6 race GLB models with equipment slot toggling
 * - 4 classes with weapon restrictions and starting attributes
 * - 136 animations across 4 packs (base + sword&shield + longbow + magic)
 * - Enter World → transitions to outdoor scene
 *
 * Access: F4 hotkey or ?scene=character_create
 */

import { loadRaceCharacter } from '../../character/raceHero.js';
import { FACTIONS, RACE_ORDER, ANIMATION_PACKS, SLOT_PATTERNS, WEAPON_SLOTS }
  from '../../character/GrudgeFactionRegistry.js';
import { GrudgeSDK, ANIM_CATALOG, CLASS_ANIM_MAP, getAnimsForClass, getAllAnims }
  from '../../lib/grudgeSDK.js';
import { getSkillDisplayList, ELEMENT_ICONS, ELEMENT_COLORS }
  from '../../combat/weaponSkills.js';

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

  const availableRaces = Object.keys(racesMap);
  const availableClasses = Object.keys(classesMap);

  // ── Camera ──────────────────────────────────────────────────────────────────
  // Target chest-height (y=0.85) so the full character is visible in frame
  const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.8, 4,
    new BABYLON.Vector3(0, 0.85, 0), scene);
  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 8;
  camera.upperBetaLimit = Math.PI / 2.1;
  camera.wheelDeltaPercentage = 0.02;
  camera.minZ = 0.1;
  camera.attachControl(engine.getRenderingCanvas(), true);

  // ── Lighting ────────────────────────────────────────────────────────────────
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.8;
  hemi.diffuse = new BABYLON.Color3(1.0, 0.95, 0.9);
  hemi.groundColor = new BABYLON.Color3(0.15, 0.15, 0.2);

  const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, -1), scene);
  dir.intensity = 1.6;
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
  // Small, subtle platform at y=0 so the character stands on it naturally
  const ground = BABYLON.MeshBuilder.CreateCylinder('platform',
    { diameter: 2.5, height: 0.08, tessellation: 64 }, scene);
  ground.position.y = -0.04;
  const gMat = new BABYLON.PBRMaterial('gMat', scene);
  gMat.albedoColor = new BABYLON.Color3(0.10, 0.08, 0.06);
  gMat.metallic = 0.3;
  gMat.roughness = 0.8;
  ground.material = gMat;
  ground.receiveShadows = true;

  // Subtle gold accent ring — thin and understated
  const ring = BABYLON.MeshBuilder.CreateTorus('ring',
    { diameter: 2.5, thickness: 0.015, tessellation: 64 }, scene);
  ring.position.y = 0.01;
  const rMat = new BABYLON.PBRMaterial('rMat', scene);
  rMat.albedoColor = new BABYLON.Color3(0.60, 0.50, 0.25);
  rMat.metallic = 0.8;
  rMat.roughness = 0.3;
  rMat.emissiveColor = new BABYLON.Color3(0.15, 0.12, 0.03);
  ring.material = rMat;

  // ── State ───────────────────────────────────────────────────────────────────
  let activeRace = CHAR_SELECT?.race || 'human';
  let activeClass = CHAR_SELECT?.class || 'warrior';
  if (!racesMap[activeRace]) activeRace = availableRaces[0] || RACE_ORDER[0] || 'human';
  if (!classesMap[activeClass]) activeClass = availableClasses[0] || 'warrior';
  let currentRaceChar = null;
  const characterNode = new BABYLON.TransformNode('charRoot', scene);
  let autoRotate = true;
  let classAnimActions = {};

  // ── DOM UI (full-screen overlay) ────────────────────────────────────────────
  const ui = _buildUI(racesMap, classesMap, factionsMap, FACTIONS, {
    onRaceChange: async (raceId) => {
      activeRace = raceId;
      await _switchRace(raceId);
    },
    onClassChange: async (classId) => {
      activeClass = classId;
      // Apply class build: swap armor PBR (metal/leather/cloth) + weapon + shield
      if (currentRaceChar) currentRaceChar.applyClassBuild(classId);
      _updateStats();
      _updateEquipPanel();
      _updateSkillsPanel();
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
    onEquipCycle: (slot, direction) => {
      if (!currentRaceChar) return;
      const summary = currentRaceChar.equipManager.getSummary();
      const info = summary[slot];
      if (!info || !info.variants.length) return;
      let idx = info.variants.indexOf(info.equipped);
      if (idx < 0) idx = 0;
      idx += direction;
      if (idx < 0) idx = 0;
      if (idx >= info.variants.length) idx = info.variants.length - 1;
      const v = info.variants[idx];
      const em = currentRaceChar.equipManager;
      if (WEAPON_SLOTS.has(slot)) em.equipWeapon(slot, v);
      else if (slot === 'shield') em.equipShield(v);
      else em.equip(slot, v);
      _updateEquipPanel();
      _updateSkillsPanel();
    },
    onAnimPlay: (animKey) => {
      if (!currentRaceChar) return;
      const allAnims = getAnimsForClass(activeClass);
      const def = allAnims[animKey];
      const loop = def ? def.loop : !['death','hit','attack1','attack2','attack3'].includes(animKey);
      if (classAnimActions[animKey]) {
        _playAnimGroup(classAnimActions[animKey], loop);
      } else {
        currentRaceChar.playAnim(animKey, loop);
      }
    },
    onEnterWorld: (charName) => {
      CHAR_SELECT.race = activeRace;
      CHAR_SELECT.class = activeClass;
      CHAR_SELECT.name = charName || '';
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

    // Dispose previous class animation groups to prevent accumulation
    for (const ag of Object.values(classAnimActions)) {
      try { ag.stop(); ag.dispose(); } catch (_) {}
    }
    classAnimActions = {};
    _currentClassAG = null;
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
    // Dispose previous class anims first (they reference the old skeleton)
    for (const ag of Object.values(classAnimActions)) {
      try { ag.stop(); ag.dispose(); } catch (_) {}
    }
    classAnimActions = {};
    _currentClassAG = null;

    if (currentRaceChar) {
      currentRaceChar.dispose();
      currentRaceChar = null;
    }

    try {
      currentRaceChar = await loadRaceCharacter(scene, raceId, characterNode, { classId: activeClass });
      for (const mesh of currentRaceChar.result.meshes) {
        shadowGen.addShadowCaster(mesh);
      }
      _updateEquipPanel();
      _updateStats();
      _updateSkillsPanel();
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

  function _updateSkillsPanel() {
    const equipped = currentRaceChar?.equipManager?.equipped;
    const weaponType = equipped?.weapon?.type || 'sword';
    ui.updateSkills(weaponType, activeClass);
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
// DOM UI BUILDER — Full-screen overlay, WCS-themed, reference-style layout
// ═══════════════════════════════════════════════════════════════════════════════

const SLOT_ICONS = {
  body: '👕', arms: '🧤', legs: '👖', head: '⛑', shoulders: '🦺',
  sword: '⚔', axe: '🪓', hammer: '🔨', pick: '⛏', spear: '🔱',
  bow: '🏹', staff: '🪄', shield: '🛡', bag: '🎒', wood: '🪵', quiver: '🏹',
};

const SLOT_LABELS = {
  body: 'Body', arms: 'Arms', legs: 'Legs', head: 'Helmet', shoulders: 'Shoulders',
  sword: 'Sword', axe: 'Axe', hammer: 'Hammer', pick: 'Pick', spear: 'Spear',
  bow: 'Bow', staff: 'Staff', shield: 'Shield', bag: 'Backpack', wood: 'Wood', quiver: 'Quiver',
};

function _buildUI(racesMap, classesMap, factionsMap, factionRegistry, callbacks) {
  // ── Inject CSS + Fonts ──
  _injectAssets();

  const root = document.createElement('div');
  root.id = 'grudge-char-create';

  const raceOrder = ['human', 'barbarian', 'elf', 'dwarf', 'orc', 'undead'];
  const initRace = CHAR_SELECT?.race || 'human';
  const initClass = CHAR_SELECT?.class || 'warrior';

  root.innerHTML = `
    <div class="cc-overlay">
      <div class="cc-panel">
        <!-- HEADER -->
        <div class="cc-header">
          <div class="cc-header-title">
            <h2>Grudge Warlords</h2>
            <span class="cc-header-subtitle">Character Creation</span>
          </div>
        </div>

        <!-- CONTENT: preview left, controls right -->
        <div class="cc-content">
          <!-- LEFT: 3D Preview + Race Selection -->
          <div class="cc-preview-col">
            <div class="cc-preview-wrap">
              <div class="cc-loading" id="cc-loading" style="display:none">
                <div class="cc-spinner"></div>
                <span>Loading model…</span>
              </div>
              <!-- The Babylon.js canvas covers the whole page behind this overlay.
                   The preview-wrap is transparent so the 3D scene shows through. -->
            </div>
            <div class="cc-preview-hint">Drag to rotate | Scroll to zoom | Double-click to auto-rotate</div>

            <!-- Race Grid -->
            <div class="cc-race-section">
              <div class="cc-race-row">
                ${raceOrder.map(rId => {
                  const r = racesMap[rId];
                  const f = factionRegistry[rId];
                  const name = r?.name || f?.name || rId;
                  const desc = f?.faction || '';
                  const color = f?.color || r?.color || '#ccc';
                  return `<button class="cc-race-btn ${rId === initRace ? 'active' : ''}" data-race="${rId}">
                    <span class="cc-race-icon" style="background:${color}"></span>
                    <span class="cc-race-name">${name}</span>
                    <span class="cc-race-desc">${desc}</span>
                  </button>`;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- RIGHT: Scrollable Controls -->
          <div class="cc-controls">
            <div class="cc-tab-panels">
              <!-- Character Name -->
              <h3 class="cc-section-label">Character Name</h3>
              <input type="text" id="cc-name-input" class="cc-name-input" placeholder="Enter a name…" maxlength="24" />
              <div class="cc-section-divider"></div>

              <!-- Class -->
              <h3 class="cc-section-label">Class</h3>
              <div class="cc-class-row" id="cc-class-row">
                ${Object.entries(classesMap).map(([cId, c]) => {
                  return `<button class="cc-class-btn ${cId === initClass ? 'active' : ''}" data-class="${cId}">
                    <span class="cc-class-icon">${c.emoji || c.icon || '⚔'}</span>
                    <span class="cc-class-name">${c.name}</span>
                    <span class="cc-class-desc">${c.description ? c.description.substring(0, 50) + '…' : ''}</span>
                    <span class="cc-class-bonuses">${_formatBonuses(c.startingAttributes)}</span>
                  </button>`;
                }).join('')}
              </div>
              <div class="cc-section-divider"></div>

              <!-- Attributes -->
              <h3 class="cc-section-label">Attributes</h3>
              <div id="cc-stats"></div>
              <div class="cc-section-divider"></div>

              <!-- Equipment (arrow cycling) -->
              <h3 class="cc-section-label">Equipment</h3>
              <div id="cc-equip"></div>
              <div class="cc-section-divider"></div>

              <!-- Skills (weapon-based) -->
              <h3 class="cc-section-label">Skills</h3>
              <div id="cc-skills" class="cc-skill-grid"></div>
              <div class="cc-section-divider"></div>

              <!-- Animations -->
              <h3 class="cc-section-label">Animations</h3>
              <div id="cc-anims" class="cc-anim-grid"></div>
            </div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="cc-footer">
          <button class="cc-enter-btn" id="cc-enter-world">Enter World</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // ── Wire events ─────────────────────────────────────────────────────────────

  // Race buttons
  root.querySelectorAll('.cc-race-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.cc-race-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      callbacks.onRaceChange(btn.dataset.race);
    });
  });

  // Class buttons
  root.querySelectorAll('.cc-class-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.cc-class-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      callbacks.onClassChange(btn.dataset.class);
    });
  });

  // Enter World
  root.querySelector('#cc-enter-world').addEventListener('click', () => {
    const nameInput = root.querySelector('#cc-name-input');
    callbacks.onEnterWorld(nameInput ? nameInput.value.trim() : '');
  });

  // ── Return UI handle ────────────────────────────────────────────────────────
  return {
    root,

    updateStats(raceBonuses, classAttrs) {
      const container = root.querySelector('#cc-stats');
      if (!container) return;
      const ATTRS = ['Strength','Intellect','Vitality','Dexterity','Endurance','Wisdom','Agility','Tactics'];
      let h = '';
      for (const attr of ATTRS) {
        const rVal = raceBonuses[attr] || 0;
        const cVal = classAttrs[attr] || 0;
        const total = rVal + cVal;
        const pct = Math.min((total / 5) * 100, 100);
        h += `<div class="cc-stat-row">
          <span class="cc-stat-label">${attr.substring(0,3).toUpperCase()}</span>
          <div class="cc-stat-bar-wrap">
            <div class="cc-stat-bar" style="width:${pct}%"></div>
          </div>
          <span class="cc-stat-value">${total}</span>
        </div>`;
      }
      container.innerHTML = h;
    },

    updateEquipment(summary, allowedWeapons) {
      const container = root.querySelector('#cc-equip');
      if (!container) return;
      let h = '<div class="cc-equip-grid">';
      for (const [slot, info] of Object.entries(summary)) {
        if (!info.variants.length) continue;
        const isWeapon = WEAPON_SLOTS.has(slot);
        const locked = isWeapon && !allowedWeapons.has(slot);
        const icon = SLOT_ICONS[slot] || '📦';
        const label = SLOT_LABELS[slot] || slot;
        const idx = info.variants.indexOf(info.equipped);
        const total = info.variants.length;

        h += `<div class="cc-equip-slot" ${locked ? 'style="opacity:0.4"' : ''}>
          <span class="cc-equip-icon">${icon}</span>
          <span class="cc-equip-label">${label}${locked ? ' 🔒' : ''}</span>
          <div class="cc-equip-arrows">
            <button class="cc-eq-prev" data-slot="${slot}" ${locked || idx <= 0 ? 'disabled' : ''}>◀</button>
            <span class="cc-equip-current">${idx + 1}/${total}</span>
            <button class="cc-eq-next" data-slot="${slot}" ${locked || idx >= total - 1 ? 'disabled' : ''}>▶</button>
          </div>
        </div>`;
      }
      h += '</div>';
      container.innerHTML = h;

      // Wire arrow buttons
      container.querySelectorAll('.cc-eq-prev').forEach(btn => {
        btn.addEventListener('click', () => callbacks.onEquipCycle(btn.dataset.slot, -1));
      });
      container.querySelectorAll('.cc-eq-next').forEach(btn => {
        btn.addEventListener('click', () => callbacks.onEquipCycle(btn.dataset.slot, 1));
      });
    },

    updateSkills(weaponType, classId) {
      const container = root.querySelector('#cc-skills');
      if (!container) return;
      const skills = getSkillDisplayList(weaponType, classId);
      if (skills.length === 0) {
        container.innerHTML = '<div style="color:var(--cc-dim);font-size:11px;">No weapon equipped</div>';
        return;
      }
      container.innerHTML = skills.map(s => {
        const icon = ELEMENT_ICONS[s.element] || '⚔';
        const color = ELEMENT_COLORS[s.element] || '#b8b8c0';
        const stat = s.heal ? `+${s.heal} HP` : (s.damage ? `${s.damage} dmg` : '');
        const dot = s.dot ? ` +${s.dot}` : '';
        return `<div class="cc-skill-card">
          <span class="cc-skill-icon" style="color:${color}">${icon}</span>
          <div class="cc-skill-info">
            <span class="cc-skill-name">${s.name}</span>
            <span class="cc-skill-stat" style="color:${color}">${stat}${dot}</span>
          </div>
        </div>`;
      }).join('');
    },

    updateAnimations(anims) {
      const container = root.querySelector('#cc-anims');
      if (!container) return;
      let h = '';
      for (const [key, def] of Object.entries(anims)) {
        h += `<button class="cc-anim-btn" data-anim="${key}">${def.label}</button>`;
      }
      container.innerHTML = h;
      container.querySelectorAll('.cc-anim-btn').forEach(btn => {
        btn.addEventListener('click', () => callbacks.onAnimPlay(btn.dataset.anim));
      });
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function _injectAssets() {
  // Google Fonts
  if (!document.querySelector('link[href*="Cinzel"]')) {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Fira+Sans:wght@300;400;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  // Character Creator CSS
  if (!document.querySelector('link[href*="characterCreator"]')) {
    const css = document.createElement('link');
    css.href = './src/styles/characterCreator.css';
    css.rel = 'stylesheet';
    document.head.appendChild(css);
  }
}

function _formatBonuses(attrs) {
  if (!attrs) return '';
  return Object.entries(attrs)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `+${v} ${k.substring(0, 3)}`)
    .join(', ');
}
