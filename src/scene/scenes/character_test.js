/**
 * character_test.js
 * Grudge Warlords Character Testing Scene
 *
 * A dedicated Babylon.js scene for live testing all 6 race characters:
 * - Race switcher (CharacterPanel)
 * - Equipment toggling via prefix-based mesh visibility
 * - Animation playback with shared Bip001 animation packs
 * - Ground platform + orbit camera
 * - IBL lighting to see materials clearly
 *
 * Access via: ?scene=character_test
 */

import { loadRaceCharacter } from '../../character/raceHero.js';
import { CharacterPanel }    from '../../character/CharacterPanel.js';

export async function createCharacterTest(engine) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.08, 1);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.5, 5, BABYLON.Vector3.Zero(), scene);
  camera.lowerRadiusLimit  = 1.5;
  camera.upperRadiusLimit  = 12;
  camera.upperBetaLimit    = Math.PI / 2;
  camera.wheelDeltaPercentage = 0.02;
  camera.attachControl(engine.getRenderingCanvas(), true);

  // ── Lighting ───────────────────────────────────────────────────────────────
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity  = 0.6;
  hemi.diffuse    = new BABYLON.Color3(0.9, 0.85, 0.75);
  hemi.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);

  const dirLight = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, -1), scene);
  dirLight.intensity = 1.2;
  dirLight.position  = new BABYLON.Vector3(5, 10, 5);

  // Shadow generator for character
  const shadowGen = new BABYLON.ShadowGenerator(1024, dirLight);
  shadowGen.usePoissonSampling = true;

  // IBL environment
  try {
    const envMap = BABYLON.CubeTexture.CreateFromPrefilteredData('./assets/textures/lighting/environment.env', scene);
    scene.environmentTexture = envMap;
    scene.environmentIntensity = 0.8;
  } catch (_) { /* env map optional */ }

  // ── Platform ───────────────────────────────────────────────────────────────
  const ground = BABYLON.MeshBuilder.CreateCylinder('platform', { diameter: 4, height: 0.15, tessellation: 64 }, scene);
  ground.position.y = -1.1;
  const groundMat = new BABYLON.PBRMaterial('groundMat', scene);
  groundMat.albedoColor = new BABYLON.Color3(0.12, 0.10, 0.08);
  groundMat.metallic    = 0.2;
  groundMat.roughness   = 0.85;
  ground.material = groundMat;

  // Border ring
  const ring = BABYLON.MeshBuilder.CreateTorus('ring', { diameter: 4, thickness: 0.03, tessellation: 64 }, scene);
  ring.position.y = -1.02;
  const ringMat = new BABYLON.PBRMaterial('ringMat', scene);
  ringMat.albedoColor  = new BABYLON.Color3(0.78, 0.66, 0.32);
  ringMat.metallic     = 0.9;
  ringMat.roughness    = 0.2;
  ringMat.emissiveColor = new BABYLON.Color3(0.4, 0.3, 0.05);
  ring.material = ringMat;

  // ── Background pillars (atmosphere) ───────────────────────────────────────
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const pillar = BABYLON.MeshBuilder.CreateCylinder(`pillar_${i}`, { diameter: 0.2, height: 6, tessellation: 12 }, scene);
    pillar.position.x = Math.cos(angle) * 7;
    pillar.position.z = Math.sin(angle) * 7;
    pillar.position.y = 1.9;
    const pMat = new BABYLON.PBRMaterial(`pMat_${i}`, scene);
    pMat.albedoColor = new BABYLON.Color3(0.1, 0.08, 0.06);
    pMat.metallic    = 0.1;
    pMat.roughness   = 0.9;
    pillar.material  = pMat;
  }

  // ── Particle emitter – ambient dust ────────────────────────────────────────
  try {
    const ps = new BABYLON.ParticleSystem('dust', 120, scene);
    ps.particleTexture  = new BABYLON.Texture('./assets/textures/flare.png', scene);
    ps.emitter          = BABYLON.Vector3.Zero();
    ps.minEmitBox       = new BABYLON.Vector3(-2, -0.5, -2);
    ps.maxEmitBox       = new BABYLON.Vector3(2,  2,    2);
    ps.color1           = new BABYLON.Color4(0.8, 0.7, 0.4, 0.08);
    ps.color2           = new BABYLON.Color4(0.6, 0.5, 0.3, 0.02);
    ps.minSize          = 0.01;
    ps.maxSize          = 0.04;
    ps.minLifeTime      = 3;
    ps.maxLifeTime      = 6;
    ps.emitRate         = 20;
    ps.direction1       = new BABYLON.Vector3(-0.1, 0.3, -0.1);
    ps.direction2       = new BABYLON.Vector3(0.1,  0.8,  0.1);
    ps.minEmitPower     = 0.01;
    ps.maxEmitPower     = 0.05;
    ps.start();
  } catch (_) { /* particle optional */ }

  // ── Character spawn node ───────────────────────────────────────────────────
  const characterNode = new BABYLON.TransformNode('raceCharRoot', scene);
  characterNode.position = BABYLON.Vector3.Zero();

  // ── State: currently loaded RaceCharacter ─────────────────────────────────
  let currentRaceChar = null;

  // ── GUI ────────────────────────────────────────────────────────────────────
  const gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);

  // Toggle button (T key or ☰ button)
  const toggleBtn = BABYLON.GUI.Button.CreateSimpleButton('togglePanel', '☰ CHAR');
  toggleBtn.width      = '90px';
  toggleBtn.height     = '32px';
  toggleBtn.color      = '#c8a951';
  toggleBtn.background = 'rgba(8,10,18,0.8)';
  toggleBtn.fontSize   = 11;
  toggleBtn.thickness  = 1;
  toggleBtn.cornerRadius = 4;
  toggleBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  toggleBtn.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  toggleBtn.paddingLeft  = '335px';
  toggleBtn.paddingBottom = '20px';
  gui.addControl(toggleBtn);

  // ── Character Panel ────────────────────────────────────────────────────────
  const panel = new CharacterPanel(
    gui,
    // onRaceChange
    async (raceId) => {
      await _switchRace(raceId);
    },
    // onEquipChange
    (slot, variant) => {
      if (!currentRaceChar) return;
      const em = currentRaceChar.equipManager;
      if (['sword','axe','hammer','pick','spear','bow','staff'].includes(slot)) {
        em.equipWeapon(slot, variant);
      } else if (slot === 'shield') {
        em.equipShield(variant);
      } else {
        em.equip(slot, variant);
      }
    },
    // onAnimPlay
    (animKey) => {
      if (!currentRaceChar) return;
      const isLoop = !['death','hit','attack1','attack2','attack3'].includes(animKey);
      currentRaceChar.playAnim(animKey, isLoop);
    }
  );

  toggleBtn.onPointerClickObservable.add(() => panel.toggle());

  // Loading overlay
  const loadingText = new BABYLON.GUI.TextBlock('loading', 'Loading Character...');
  loadingText.color    = '#c8a951';
  loadingText.fontSize = 20;
  loadingText.isVisible = false;
  gui.addControl(loadingText);

  // ── Race switch helper ─────────────────────────────────────────────────────
  async function _switchRace(raceId) {
    loadingText.isVisible = true;
    loadingText.text = `Loading ${raceId.charAt(0).toUpperCase() + raceId.slice(1)}...`;

    // Dispose previous character
    if (currentRaceChar) {
      currentRaceChar.dispose();
      currentRaceChar = null;
    }

    try {
      currentRaceChar = await loadRaceCharacter(scene, raceId, characterNode);

      // Add to shadow gen
      for (const mesh of currentRaceChar.result.meshes) {
        shadowGen.addShadowCaster(mesh);
      }

      // Refresh equipment panel to show actual slot variants
      panel.refreshFromEquipManager(currentRaceChar.equipManager);

      loadingText.isVisible = false;
    } catch (err) {
      console.error('[CharacterTest] Race load failed:', err);
      loadingText.text = `Failed to load ${raceId}`;
      setTimeout(() => { loadingText.isVisible = false; }, 3000);
    }
  }

  // ── Key bindings ───────────────────────────────────────────────────────────
  scene.actionManager = new BABYLON.ActionManager(scene);
  scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
    { trigger: BABYLON.ActionManager.OnKeyDownTrigger, parameter: 't' },
    () => panel.toggle()
  ));

  // Number keys 1-6 to switch race
  const raceKeys = { '1': 'human', '2': 'barbarian', '3': 'elf', '4': 'dwarf', '5': 'orc', '6': 'undead' };
  for (const [key, raceId] of Object.entries(raceKeys)) {
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
      { trigger: BABYLON.ActionManager.OnKeyDownTrigger, parameter: key },
      () => _switchRace(raceId)
    ));
  }

  // ── Initial load: Human ────────────────────────────────────────────────────
  await _switchRace('human');

  // ── Slow auto-rotate ───────────────────────────────────────────────────────
  let autoRotate = true;
  scene.onBeforeRenderObservable.add(() => {
    if (autoRotate) {
      characterNode.rotation.y += 0.003;
    }
  });

  // Stop auto-rotate when user interacts
  scene.onPointerObservable.add((info) => {
    if (info.type === BABYLON.PointerEventTypes.POINTERDOWN) {
      autoRotate = false;
    }
  });

  // Re-enable on double-click
  scene.onPointerObservable.add((info) => {
    if (info.type === BABYLON.PointerEventTypes.POINTERDOUBLETAP) {
      autoRotate = true;
    }
  });

  scene.executeWhenReady(() => scene.render());
  return scene;
}
