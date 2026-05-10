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

import {
  loadRaceCharacter,
  computeVisibleBounds,
} from "../../character/raceHero.js";
import { retargetAnimGroup } from "../../character/AnimController.js";
import {
  FACTIONS,
  RACE_ORDER,
  WEAPON_SLOTS,
} from "../../character/GrudgeFactionRegistry.js";
import {
  GrudgeSDK,
  ANIM_CATALOG,
  CLASS_ANIM_MAP,
  getAnimsForClass,
} from "../../lib/grudgeSDK.js";
import {
  getSkillDisplayList,
  ELEMENT_ICONS,
  ELEMENT_COLORS,
} from "../../combat/weaponSkills.js";

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE FACTORY — called by SceneManager
// ═══════════════════════════════════════════════════════════════════════════════

export async function createCharacterCreate(engine) {
  // The main engine gets a blank dark scene (the preview is on its own canvas)
  const mainScene = new BABYLON.Scene(engine);
  mainScene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.06, 1);

  // Babylon requires at least one camera on every rendered scene.
  // This dummy camera satisfies that requirement; the real preview lives on
  // its own dedicated canvas / engine (previewScene below).
  const _dummyCam = new BABYLON.FreeCamera(
    "_mainDummy",
    new BABYLON.Vector3(0, 0, -1),
    mainScene,
  );
  _dummyCam.setTarget(BABYLON.Vector3.Zero());

  // ── Prefetch game data ──────────────────────────────────────────────────
  const sdk = await GrudgeSDK.prefetch();
  const racesMap = GrudgeSDK.getRacesMap(sdk.races);
  const classesMap = GrudgeSDK.getClassesMap(sdk.classes);

  // ── State ───────────────────────────────────────────────────────────────
  let activeRace = CHAR_SELECT?.race || "human";
  let activeClass = CHAR_SELECT?.class || "warrior";
  if (!racesMap[activeRace]) activeRace = "human";
  if (!classesMap[activeClass]) activeClass = "warrior";

  // Maps class → the class pack's idle animation key (used to auto-start the
  // correct idle after _loadClassAnims finishes, replacing the base idle).
  const CLASS_IDLE_KEY = {
    warrior: "ss_idle",
    ranger: "bow_idle",
    mage: "mag_idle",
    worge: "ss_idle",
  };

  let currentRaceChar = null;
  // Tracks which animation keys in currentRaceChar.animCtrl belong to the
  // class-specific pack (so they can be unregistered when the class changes).
  let _classAnimKeys = new Set();
  let previewEngine = null;
  let previewScene = null;
  let previewCamera = null;
  let characterNode = null;
  let autoRotate = true;
  let _ro = null;
  let resizePreview = () => {};

  // ── Build DOM UI ────────────────────────────────────────────────────────
  _injectAssets();
  const root = _buildDOM(racesMap, classesMap, activeRace, activeClass);
  document.body.appendChild(root);

  // ── Create dedicated preview engine on the preview canvas ───────────────
  const previewCanvas = root.querySelector("#cc-preview-canvas");
  // Size the backbuffer to the wrap BEFORE constructing the engine so the
  // first rendered frame is at the correct aspect ratio.
  const _sizeCanvasToWrap = () => {
    const wrap = previewCanvas.parentElement;
    if (!wrap) return;
    const w = Math.max(1, wrap.clientWidth | 0);
    const h = Math.max(1, wrap.clientHeight | 0);
    if (previewCanvas.width !== w) previewCanvas.width = w;
    if (previewCanvas.height !== h) previewCanvas.height = h;
  };
  _sizeCanvasToWrap();

  try {
    previewEngine = new BABYLON.Engine(previewCanvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    previewScene = new BABYLON.Scene(previewEngine);
    previewScene.clearColor = new BABYLON.Color4(0.07, 0.07, 0.1, 1);

    // Camera — auto-framed per-character once the model loads.
    const cam = new BABYLON.ArcRotateCamera(
      "ccCam",
      -Math.PI / 2,
      Math.PI / 2.4,
      3.5,
      new BABYLON.Vector3(0, 1.0, 0),
      previewScene,
    );
    cam.lowerRadiusLimit = 1.2;
    cam.upperRadiusLimit = 12;
    cam.upperBetaLimit = Math.PI / 2.05;
    cam.wheelDeltaPercentage = 0.02;
    cam.minZ = 0.05;
    cam.fov = 0.8;
    cam.attachControl(previewCanvas, true);
    previewCamera = cam;

    // Lighting — studio rig
    const hemi = new BABYLON.HemisphericLight(
      "ccHemi",
      new BABYLON.Vector3(0, 1, 0),
      previewScene,
    );
    hemi.intensity = 0.8;
    hemi.diffuse = new BABYLON.Color3(1.0, 0.95, 0.9);
    hemi.groundColor = new BABYLON.Color3(0.15, 0.15, 0.2);

    const key = new BABYLON.DirectionalLight(
      "ccKey",
      new BABYLON.Vector3(-1, -2, -1),
      previewScene,
    );
    key.intensity = 1.8;
    key.position.copyFromFloats(3, 6, 4);

    const fill = new BABYLON.DirectionalLight(
      "ccFill",
      new BABYLON.Vector3(2, -1, 1),
      previewScene,
    );
    fill.intensity = 0.6;
    fill.diffuse = new BABYLON.Color3(0.7, 0.75, 0.85);

    // Shadow
    const shadowGen = new BABYLON.ShadowGenerator(1024, key);
    shadowGen.usePoissonSampling = true;

    // IBL
    try {
      const envMap = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "./assets/textures/lighting/environment.env",
        previewScene,
      );
      previewScene.environmentTexture = envMap;
      previewScene.environmentIntensity = 0.6;
    } catch (_) {}

    // Platform
    const ground = BABYLON.MeshBuilder.CreateCylinder(
      "ccPlatform",
      { diameter: 2.5, height: 0.08, tessellation: 64 },
      previewScene,
    );
    ground.position.y = -0.04;
    const gMat = new BABYLON.PBRMaterial("ccGMat", previewScene);
    gMat.albedoColor = new BABYLON.Color3(0.08, 0.06, 0.04);
    gMat.metallic = 0.3;
    gMat.roughness = 0.8;
    ground.material = gMat;
    ground.receiveShadows = true;

    const ring = BABYLON.MeshBuilder.CreateTorus(
      "ccRing",
      { diameter: 2.5, thickness: 0.015, tessellation: 64 },
      previewScene,
    );
    ring.position.y = 0.01;
    const rMat = new BABYLON.PBRMaterial("ccRMat", previewScene);
    rMat.albedoColor = new BABYLON.Color3(0.6, 0.5, 0.25);
    rMat.metallic = 0.8;
    rMat.roughness = 0.3;
    rMat.emissiveColor = new BABYLON.Color3(0.15, 0.12, 0.03);
    ring.material = rMat;

    // Character root node
    characterNode = new BABYLON.TransformNode("ccCharRoot", previewScene);

    // Auto-rotate
    previewScene.onBeforeRenderObservable.add(() => {
      if (autoRotate && characterNode) characterNode.rotation.y += 0.004;
    });
    previewCanvas.addEventListener("pointerdown", () => {
      autoRotate = false;
    });
    previewCanvas.addEventListener("dblclick", () => {
      autoRotate = true;
    });

    // Start preview render loop
    previewEngine.runRenderLoop(() => previewScene.render());

    // Resize — observe the wrap element directly so the canvas tracks layout
    // changes (panel collapse, devtools open, window resize) without timers.
    resizePreview = () => {
      _sizeCanvasToWrap();
      try {
        previewEngine.resize();
      } catch (_) {}
    };
    window.addEventListener("resize", resizePreview);
    if (typeof ResizeObserver !== "undefined" && previewCanvas.parentElement) {
      _ro = new ResizeObserver(() => resizePreview());
      _ro.observe(previewCanvas.parentElement);
    } else {
      // Fallback for environments without ResizeObserver
      setTimeout(resizePreview, 100);
    }
    // One immediate resize after the engine is up so the first render is sized.
    resizePreview();
  } catch (err) {
    console.error("[character_create] Preview engine failed:", err);
  }

  // ── Camera framing ──────────────────────────────────────────────────────
  // Frames the ArcRotateCamera around the character's actual visible bounds.
  // Called after each race load and after equipment swaps that resize the
  // silhouette (e.g. a long staff or 2H weapon).
  function _autoFrameCamera() {
    if (!previewCamera || !currentRaceChar) return;
    const bounds = computeVisibleBounds(currentRaceChar);
    if (!bounds) return;

    const minY = bounds.min.y,
      maxY = bounds.max.y;
    const minX = bounds.min.x,
      maxX = bounds.max.x;
    const minZ = bounds.min.z,
      maxZ = bounds.max.z;
    const height = Math.max(0.01, maxY - minY);
    const width = Math.max(0.01, Math.max(maxX - minX, maxZ - minZ));

    // Target the character's visible center (ignore the platform under feet).
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const cy = minY + height * 0.55; // bias toward upper torso so the head is on-frame
    previewCamera.setTarget(new BABYLON.Vector3(cx, cy, cz));

    // Choose radius so the silhouette fits with a comfortable margin. The
    // camera FOV is vertical, so use height for vertical fit and width/aspect
    // for horizontal fit; pick whichever is larger.
    const fov = previewCamera.fov || 0.8;
    const aspect =
      (previewCanvas.width || 1) / Math.max(1, previewCanvas.height || 1);
    const margin = 1.35;
    const radiusForHeight = (height * 0.5 * margin) / Math.tan(fov * 0.5);
    const radiusForWidth =
      (width * 0.5 * margin) / (Math.tan(fov * 0.5) * aspect);
    const radius = Math.max(radiusForHeight, radiusForWidth);

    previewCamera.radius = radius;
    previewCamera.lowerRadiusLimit = Math.max(0.5, radius * 0.5);
    previewCamera.upperRadiusLimit = radius * 3;
  }

  // ── Wire UI events ──────────────────────────────────────────────────────
  // Race buttons
  root.querySelectorAll(".cc-race-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      root
        .querySelectorAll(".cc-race-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeRace = btn.dataset.race;
      _switchRace(activeRace);
    });
  });

  // Class buttons
  root.querySelectorAll(".cc-class-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      root
        .querySelectorAll(".cc-class-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeClass = btn.dataset.class;
      if (currentRaceChar) currentRaceChar.applyClassBuild(activeClass);
      _updateStats();
      _updateEquipPanel();
      _updateSkillsPanel();
      _loadClassAnims(activeClass);
      _autoFrameCamera();
    });
  });

  // Equipment cycling
  root.addEventListener("click", (e) => {
    const prev = e.target.closest(".cc-eq-prev");
    const next = e.target.closest(".cc-eq-next");
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
    else if (slot === "shield") em.equipShield(v);
    else em.equip(slot, v);
    _updateEquipPanel();
    _updateSkillsPanel();
    _autoFrameCamera();
  });

  // Enter World
  root.querySelector("#cc-enter-world").addEventListener("click", () => {
    CHAR_SELECT.race = activeRace;
    CHAR_SELECT.class = activeClass;
    CHAR_SELECT.name = (
      root.querySelector("#cc-name-input")?.value || ""
    ).trim();
    CHAR_SELECT.equip = currentRaceChar?.equipManager?.equipped || {};
    if (typeof SCENE_MANAGER?.navigateTo === "function") {
      SCENE_MANAGER.navigateTo("outdoor");
    }
  });

  // ── Character loading ───────────────────────────────────────────────────
  async function _switchRace(raceId) {
    // Class anim keys are in animCtrl — animCtrl.dispose() (called by
    // currentRaceChar.dispose() below) handles their cleanup.
    _classAnimKeys.clear();

    // Dispose old character
    if (currentRaceChar) {
      currentRaceChar.dispose();
      currentRaceChar = null;
    }

    if (!previewScene) return;

    // Hide the character node completely during load so no partially-loaded
    // or all-variants-stacked geometry is visible while textures / catalog
    // / applyPreset are still in progress.
    if (characterNode) characterNode.setEnabled(false);

    try {
      currentRaceChar = await loadRaceCharacter(
        previewScene,
        raceId,
        characterNode,
        { classId: activeClass },
      );
      // Add shadows
      const sg = previewScene.getLightByID("ccKey")?._shadowGenerators?.[0];
      if (sg) {
        for (const mesh of currentRaceChar.result.meshes)
          sg.addShadowCaster(mesh);
      }
      _updateEquipPanel();
      _updateStats();
      _updateSkillsPanel();
      _loadClassAnims(activeClass);
      _autoFrameCamera();
      autoRotate = true;
      if (DEBUG) _updateDebugOverlay();
    } catch (err) {
      console.error("[character_create] Race load failed:", err);
    } finally {
      // Always re-enable — character is ready (or load failed, show whatever rendered)
      if (characterNode) characterNode.setEnabled(true);
    }
  }

  // ── Debug overlay ────────────────────────────────────────────────
  function _updateDebugOverlay() {
    if (!currentRaceChar || !DEBUG) return;
    let dbg = document.getElementById("cc-debug-overlay");
    if (!dbg) {
      dbg = document.createElement("pre");
      dbg.id = "cc-debug-overlay";
      dbg.style.cssText =
        "position:fixed;top:8px;right:8px;z-index:9999;background:rgba(0,0,0,0.85);" +
        "color:#0f0;font:11px/1.4 monospace;padding:8px 12px;border-radius:6px;max-height:80vh;overflow:auto;pointer-events:none";
      document.body.appendChild(dbg);
    }
    const em = currentRaceChar.equipManager;
    const slots = Object.entries(em.slots)
      .map(([slot, entries]) => {
        const vis = entries
          .filter((e) => e.mesh.isVisible)
          .map((e) => e.variant);
        const eq =
          em.equipped[slot] || em.equipped.weapon?.type === slot
            ? em.equipped[slot] || em.equipped.weapon?.variant
            : "—";
        return `  ${slot.padEnd(12)} variants:[${entries.map((e) => e.variant).join(",")}]  visible:[${vis.join(",") || "—"}]  equipped:${JSON.stringify(em.equipped[slot] ?? (em.equipped.weapon?.type === slot ? em.equipped.weapon?.variant : null) ?? "—")}`;
      })
      .join("\n");
    const visibleMeshes = currentRaceChar.result.meshes
      .filter((m) => m.isVisible)
      .map((m) => m.name);
    const nodeEnabled = characterNode?.isEnabled();
    dbg.textContent = [
      `RACE: ${currentRaceChar.raceId}  CLASS: ${currentRaceChar.classId}  nodeEnabled: ${nodeEnabled}`,
      `Meshes total: ${currentRaceChar.result.meshes.length}  visible: ${visibleMeshes.length}`,
      `Visible: ${visibleMeshes.join(", ") || "(none)"}`,
      ``,
      `Slots:`,
      slots,
    ].join("\n");
  }

  async function _loadClassAnims(classId) {
    // Unregister and dispose any previously-loaded class animations from the
    // shared animCtrl — base animations remain registered and unaffected.
    if (currentRaceChar?.animCtrl) {
      currentRaceChar.animCtrl.unregisterAll(_classAnimKeys);
    }
    _classAnimKeys = new Set();

    const packKey = CLASS_ANIM_MAP[classId];
    const pack = ANIM_CATALOG[packKey];
    if (!pack || !currentRaceChar?.skeleton || !previewScene) return;
    const skeleton = currentRaceChar.skeleton;

    const entries = Object.entries(pack.anims);
    await Promise.allSettled(
      entries.map(async ([animKey, def]) => {
        const fullPath = pack.path + def.file;
        const folder = fullPath.substring(0, fullPath.lastIndexOf("/") + 1);
        const file = fullPath.substring(fullPath.lastIndexOf("/") + 1);
        try {
          const result = await BABYLON.SceneLoader.ImportMeshAsync(
            null,
            folder,
            file,
            previewScene,
          );
          // Always dispose imported meshes — only the animation group is needed.
          for (const m of result.meshes) {
            try {
              m.dispose();
            } catch (_) {}
          }
          const animGroups =
            result.animationGroups || previewScene.animationGroups.slice(-1);
          if (animGroups.length > 0) {
            const ag = animGroups[0];
            ag.name = animKey;
            retargetAnimGroup(ag, skeleton);
            currentRaceChar.animCtrl.register(animKey, ag);
            _classAnimKeys.add(animKey);
          }
        } catch (_) {}
      }),
    );

    _updateAnimGrid();

    // Auto-start the class-specific idle with a smooth blend so both animation
    // tiers cross-fade cleanly through the unified animCtrl.
    const idleKey = CLASS_IDLE_KEY[classId];
    if (idleKey && currentRaceChar?.animCtrl.has(idleKey)) {
      currentRaceChar.animCtrl.play(idleKey, { loop: true, blendTime: 0.2 });
    } else if (currentRaceChar) {
      // Class pack not loaded (e.g. missing GLB files) — fall back to base idle.
      currentRaceChar.animCtrl.play("idle", { loop: true, blendTime: 0.15 });
    }
  }

  // ── UI update helpers ───────────────────────────────────────────────────
  function _updateStats() {
    const container = root.querySelector("#cc-stats");
    if (!container) return;
    const raceData = racesMap[activeRace];
    const classData = classesMap[activeClass];
    const rb = raceData?.bonuses || {};
    const ca = classData?.startingAttributes || {};
    const ATTRS = [
      "Strength",
      "Intellect",
      "Vitality",
      "Dexterity",
      "Endurance",
      "Wisdom",
      "Agility",
      "Tactics",
    ];
    container.innerHTML = ATTRS.map((attr) => {
      const total = (rb[attr] || 0) + (ca[attr] || 0);
      const pct = Math.min((total / 5) * 100, 100);
      return `<div class="cc-stat-row">
        <span class="cc-stat-label">${attr.substring(0, 3).toUpperCase()}</span>
        <div class="cc-stat-bar-wrap"><div class="cc-stat-bar" style="width:${pct}%"></div></div>
        <span class="cc-stat-value">${total}</span>
      </div>`;
    }).join("");
  }

  function _updateEquipPanel() {
    const container = root.querySelector("#cc-equip");
    if (!container || !currentRaceChar) return;
    const summary = currentRaceChar.equipManager.getSummary();
    const classData = classesMap[activeClass];
    const allowed = new Set(
      classData?.weaponTypes || [
        "sword",
        "axe",
        "hammer",
        "bow",
        "staff",
        "spear",
      ],
    );
    const ICONS = {
      body: "👕",
      arms: "🧤",
      legs: "👖",
      head: "⛑",
      shoulders: "🦺",
      sword: "⚔",
      axe: "🪓",
      hammer: "🔨",
      bow: "🏹",
      staff: "🪄",
      shield: "🛡",
      spear: "🗡",
      lance: "🏇",
      mace: "🪃",
      pick: "⛏",
      dagger: "🗡",
      bag: "👜",
      wood: "🪵",
      quiver: "🏹",
    };
    const LABELS = {
      body: "Body",
      arms: "Arms",
      legs: "Legs",
      head: "Helmet",
      shoulders: "Shoulders",
      sword: "Sword",
      axe: "Axe",
      hammer: "Hammer",
      mace: "Mace",
      pick: "Pick",
      bow: "Bow",
      staff: "Staff",
      spear: "Spear",
      lance: "Lance",
      dagger: "Dagger",
      shield: "Shield",
      bag: "Bag",
      wood: "Wood",
      quiver: "Quiver",
    };
    const TIER_LABEL = {
      cloth: "Cloth",
      leather: "Leather",
      metal: "Plate",
      plate: "Plate",
    };

    let h = '<div class="cc-equip-grid">';
    for (const [slot, info] of Object.entries(summary)) {
      if (!info.variants.length) continue;
      const isW = WEAPON_SLOTS.has(slot);
      const locked = isW && !allowed.has(slot);
      const idx = info.variants.indexOf(info.equipped);
      const tierClass = info.equippedTier ? `cc-tier-${info.equippedTier}` : "";
      const tierLabel = info.equippedTier
        ? TIER_LABEL[info.equippedTier] || ""
        : "";
      h += `<div class="cc-equip-slot" ${locked ? 'style="opacity:0.4"' : ""}>
        <span class="cc-equip-icon">${ICONS[slot] || "📦"}</span>
        <span class="cc-equip-label">${LABELS[slot] || slot}${locked ? " 🔒" : ""}</span>
        ${tierLabel ? `<span class="cc-tier-badge ${tierClass}">${tierLabel}</span>` : ""}
        <div class="cc-equip-arrows">
          <button class="cc-eq-prev" data-slot="${slot}" ${locked || idx <= 0 ? "disabled" : ""}>◀</button>
          <span class="cc-equip-current">${idx + 1}/${info.variants.length}</span>
          <button class="cc-eq-next" data-slot="${slot}" ${locked || idx >= info.variants.length - 1 ? "disabled" : ""}>▶</button>
        </div>
      </div>`;
    }
    h += "</div>";
    container.innerHTML = h;
  }

  function _updateSkillsPanel() {
    const container = root.querySelector("#cc-skills");
    if (!container) return;
    const wpn =
      currentRaceChar?.equipManager?.equipped?.weapon?.type || "sword";
    const skills = getSkillDisplayList(wpn, activeClass);
    if (!skills.length) {
      container.innerHTML =
        '<div style="color:#666;font-size:11px;">No weapon</div>';
      return;
    }
    container.innerHTML = skills
      .map((s) => {
        const icon = ELEMENT_ICONS[s.element] || "⚔";
        const color = ELEMENT_COLORS[s.element] || "#b8b8c0";
        const stat = s.heal
          ? `+${s.heal} HP`
          : s.damage
            ? `${s.damage} dmg`
            : "";
        return `<div class="cc-skill-card"><span class="cc-skill-icon" style="color:${color}">${icon}</span>
        <div class="cc-skill-info"><span class="cc-skill-name">${s.name}</span>
        <span class="cc-skill-stat" style="color:${color}">${stat}</span></div></div>`;
      })
      .join("");
  }

  function _updateAnimGrid() {
    const container = root.querySelector("#cc-anims");
    if (!container) return;
    const anims = getAnimsForClass(activeClass);
    container.innerHTML = Object.entries(anims)
      .map(
        ([k, d]) =>
          `<button class="cc-anim-btn" data-anim="${k}">${d.label}</button>`,
      )
      .join("");
    container.querySelectorAll(".cc-anim-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!currentRaceChar) return;
        const key = btn.dataset.anim;
        const def = anims[key];
        const loop = def ? def.loop : true;
        // Both base and class animations live in the same animCtrl registry;
        // play() handles the cross-fade automatically.
        currentRaceChar.animCtrl.play(key, { loop, blendTime: 0.15 });
      });
    });
  }

  // ── Cleanup on scene dispose ────────────────────────────────────────────
  mainScene.onDisposeObservable.add(() => {
    try {
      _ro && _ro.disconnect();
    } catch (_) {}
    try {
      window.removeEventListener("resize", resizePreview);
    } catch (_) {}
    if (previewEngine) {
      previewEngine.stopRenderLoop();
      // currentRaceChar.dispose() calls animCtrl.dispose() which handles all
      // registered animation groups (base + class) cleanly.
      if (currentRaceChar) currentRaceChar.dispose();
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
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Jost:wght@300;400;500;600&display=swap';
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
