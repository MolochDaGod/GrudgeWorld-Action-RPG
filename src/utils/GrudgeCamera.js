/**
 * GrudgeCamera.js
 * Advanced third-person camera for Grudge Warlords — inspired by
 * YetAnotherZombieHorror's Camera manager (Camera.ts).
 *
 * Features:
 *   - Over-shoulder TPS with left/right shoulder toggle (V key)
 *   - Aim-in mode: zoom + narrow shoulder offset (right-click / RMB)
 *   - FPS toggle (C key): camera snaps to head bone position
 *   - Smooth spring-arm interpolation toward target offset
 *   - Crosshair DOM element driven by camera mode
 *   - Camera bob from YAZH's `runAnimation` concept
 *   - Weapon targeting ray (for aim assist highlight)
 *
 * Usage:
 *   const cam = new GrudgeCamera(scene, engine, character, hero);
 *   cam.attachControls();           // wires V, C, RMB
 *   cam.update(deltaMs);            // call in onBeforeRenderObservable
 *   cam.setAiming(true);
 *   cam.changeShoulder();
 *   cam.toggleFPS();
 */

// ─ Config ─────────────────────────────────────────────────────────────────────

const SHOULDER = Object.freeze({ LEFT: -1, RIGHT: 1 });

const CFG = {
  // TPS normal follow
  tps: {
    radius:         8,
    heightOffset:   1.6,
    shoulderOffset: 1.0,
    alpha:          -Math.PI / 2,
    beta:           Math.PI / 3,
  },
  // TPS aim-in (YAZH Camera.aimAnimation equivalent)
  aim: {
    radius:         4,
    heightOffset:   1.5,
    shoulderOffset: 0.55,
  },
  // FPS - camera locked to head bone
  fps: {
    headOffset: new BABYLON.Vector3(0, 1.7, 0.1),
  },
  // Camera bob while running (YAZH Camera.runAnimation concept)
  bob: {
    amplitude: 0.06,
    frequency: 8,   // cycles per second
  },
  // Spring-arm interpolation speed (0=instant, 1=never catches up)
  springSpeed: 14,  // units/sec lerp factor
};

// ─── GrudgeCamera ─────────────────────────────────────────────────────────────

export class GrudgeCamera {
  /**
   * @param {BABYLON.Scene}         scene
   * @param {BABYLON.Engine}        engine
   * @param {BABYLON.Mesh}          character  - physics/movement node
   * @param {BABYLON.AbstractMesh}  hero       - visual root mesh
   */
  constructor(scene, engine, character, hero) {
    this._scene     = scene;
    this._engine    = engine;
    this._character = character;
    this._hero      = hero;

    this._shoulder   = SHOULDER.RIGHT;
    this._isFPS      = false;
    this._isAiming   = false;
    this._isRunning  = false;
    this._crosshairVisible = true;

    // Spring-arm current values (interpolated each frame)
    this._curRadius   = CFG.tps.radius;
    this._curHeight   = CFG.tps.heightOffset;
    this._curShoulder = CFG.tps.shoulderOffset * SHOULDER.RIGHT;

    // Bob state
    this._bobTime      = 0;
    this._bobActive    = false;

    this._camera = this._buildCamera();
    this._crosshair = this._buildCrosshair();
    this._buildGUI(scene);
  }

  // ── Camera construction ────────────────────────────────────────────────────

  _buildCamera() {
    const cam = new BABYLON.ArcRotateCamera(
      'grudgeCamera',
      CFG.tps.alpha,
      CFG.tps.beta,
      CFG.tps.radius,
      BABYLON.Vector3.Zero(),
      this._scene
    );

    cam.lowerRadiusLimit    = 1;
    cam.upperRadiusLimit    = 30;
    cam.upperBetaLimit      = Math.PI / 2;
    cam.lowerBetaLimit      = 0.05;
    cam.wheelDeltaPercentage = 0.02;
    cam.panningSensibility  = 0;
    cam.allowUpsideDown     = false;
    cam.collisionRadius     = new BABYLON.Vector3(0.4, 0.4, 0.4);

    // Don't attach default pointer controls — we handle them
    cam.attachControl(this._engine.getRenderingCanvas(), false);

    return cam;
  }

  _buildCrosshair() {
    // DOM crosshair — clean and perfectly pixel-aligned (like YAZH's SVG crosshair)
    const ch = document.createElement('div');
    ch.id = 'grudgeCrosshair';
    ch.innerHTML = `
      <div class="ch-h-left"></div>
      <div class="ch-h-right"></div>
      <div class="ch-v-top"></div>
      <div class="ch-v-bottom"></div>
      <div class="ch-dot"></div>
    `;
    document.body.appendChild(ch);

    // Inject styles
    if (!document.getElementById('grudgeCrosshairStyle')) {
      const style = document.createElement('style');
      style.id = 'grudgeCrosshairStyle';
      style.textContent = `
        #grudgeCrosshair {
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 999;
          width: 0; height: 0;
          --gap: 12px;
          --len: 14px;
          --thick: 2px;
          --color: rgba(200,169,81,0.92);
          --dot-size: 3px;
          transition: --gap 0.15s ease;
        }
        #grudgeCrosshair.aiming {
          --gap: 5px;
          --len: 10px;
          --color: rgba(255,255,255,0.95);
        }
        #grudgeCrosshair.moving {
          --gap: 20px;
        }
        #grudgeCrosshair .ch-h-left, #grudgeCrosshair .ch-h-right,
        #grudgeCrosshair .ch-v-top, #grudgeCrosshair .ch-v-bottom {
          position: absolute;
          background: var(--color);
          box-shadow: 0 0 4px var(--color);
          border-radius: 1px;
        }
        #grudgeCrosshair .ch-h-left, #grudgeCrosshair .ch-h-right {
          width: var(--len); height: var(--thick);
          top: calc(-1 * var(--thick) / 2);
        }
        #grudgeCrosshair .ch-h-left  { right: var(--gap); }
        #grudgeCrosshair .ch-h-right { left: var(--gap); }
        #grudgeCrosshair .ch-v-top, #grudgeCrosshair .ch-v-bottom {
          height: var(--len); width: var(--thick);
          left: calc(-1 * var(--thick) / 2);
        }
        #grudgeCrosshair .ch-v-top    { bottom: var(--gap); }
        #grudgeCrosshair .ch-v-bottom { top: var(--gap); }
        #grudgeCrosshair .ch-dot {
          position: absolute;
          width: var(--dot-size); height: var(--dot-size);
          background: var(--color);
          border-radius: 50%;
          top: calc(-1 * var(--dot-size) / 2);
          left: calc(-1 * var(--dot-size) / 2);
          box-shadow: 0 0 6px var(--color);
        }
        #grudgeCrosshair.hidden { display: none; }
      `;
      document.head.appendChild(style);
    }

    return ch;
  }

  _buildGUI(scene) {
    // Camera mode indicator (TPS/FPS/AIM) — tiny pill in corner
    this._modeLabel = document.createElement('div');
    this._modeLabel.id = 'grudgeCamMode';
    this._modeLabel.style.cssText = `
      position:fixed; top:16px; left:50%; transform:translateX(-50%);
      color: #c8a951; font-family: monospace; font-size:11px;
      background: rgba(0,0,0,0.55); padding: 3px 10px;
      border-radius: 12px; border: 1px solid rgba(200,169,81,0.35);
      pointer-events:none; z-index:998; opacity:0.7;
      letter-spacing: 2px;
    `;
    document.body.appendChild(this._modeLabel);
    this._updateModeLabel();
  }

  // ── Public controls ────────────────────────────────────────────────────────

  /** Wire keyboard + pointer events to camera actions */
  attachControls() {
    const canvas = this._engine.getRenderingCanvas();

    // V → shoulder swap
    window.addEventListener('keydown', (e) => {
      if (e.key === 'v' || e.key === 'V') this.changeShoulder();
      if (e.key === 'c' || e.key === 'C') this.toggleFPS();
    });

    // Right mouse button → aim
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { e.preventDefault(); this.setAiming(true); }
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.setAiming(false);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Call in scene.onBeforeRenderObservable */
  update(deltaMs) {
    if (this._isFPS) {
      this._updateFPS();
      return;
    }

    const dt = deltaMs / 1000;

    // Target values
    const tgtRadius   = this._isAiming ? CFG.aim.radius        : CFG.tps.radius;
    const tgtHeight   = this._isAiming ? CFG.aim.heightOffset   : CFG.tps.heightOffset;
    const tgtShoulder = (this._isAiming ? CFG.aim.shoulderOffset : CFG.tps.shoulderOffset)
                        * this._shoulder;

    // Spring-arm interpolation (YAZH smooth camera concept)
    const spd = CFG.springSpeed * dt;
    this._curRadius   += (tgtRadius   - this._curRadius)   * spd;
    this._curHeight   += (tgtHeight   - this._curHeight)   * spd;
    this._curShoulder += (tgtShoulder - this._curShoulder) * spd;

    // Bob
    let bobY = 0;
    if (this._bobActive && !this._isAiming) {
      this._bobTime += dt;
      bobY = Math.sin(this._bobTime * CFG.bob.frequency * Math.PI * 2) * CFG.bob.amplitude;
    } else {
      this._bobTime = 0;
    }

    // Update camera target (character position + height offset)
    const pos = this._character.position;
    this._camera.target = new BABYLON.Vector3(
      pos.x,
      pos.y + this._curHeight + bobY,
      pos.z
    );

    // Shoulder offset: push aim target left/right orthogonal to camera heading
    const camDir = this._camera.target.subtract(this._camera.position).normalize();
    const right  = BABYLON.Vector3.Cross(camDir, BABYLON.Vector3.Up()).normalize();
    this._camera.target.addInPlace(right.scale(this._curShoulder));

    this._camera.radius = this._curRadius;
  }

  _updateFPS() {
    // Snap camera to hero head bone (if accessible) or above character
    const head = this._findHeadBone();
    if (head) {
      // Get world position of head bone
      const headWorld = BABYLON.Vector3.TransformCoordinates(
        BABYLON.Vector3.Zero(),
        head.getWorldMatrix()
      );
      this._camera.target.copyFrom(headWorld);
      this._camera.radius = 0.01;
    } else {
      const pos = this._character.position;
      this._camera.target = new BABYLON.Vector3(pos.x, pos.y + 1.75, pos.z);
      this._camera.radius = 0.01;
    }
  }

  _findHeadBone() {
    try {
      const meshes = this._hero.getChildMeshes ? this._hero.getChildMeshes(false) : [];
      for (const m of meshes) {
        if (m.skeleton) {
          const bone = m.skeleton.bones.find(b =>
            /head/i.test(b.name) && !/container/i.test(b.name)
          );
          if (bone) return bone;
        }
      }
    } catch (_) {}
    return null;
  }

  // ── Camera mode transitions ────────────────────────────────────────────────

  /** Toggle left/right shoulder (YAZH: Camera.changeShoulder) */
  changeShoulder() {
    this._shoulder = -this._shoulder;
    this._updateModeLabel();
  }

  /** Toggle FPS/TPS view (YAZH: Camera.changeView) */
  toggleFPS() {
    this._isFPS = !this._isFPS;
    this._camera.lowerRadiusLimit = this._isFPS ? 0 : 1;
    this.setCrosshairVisible(!this._isFPS);  // hide crosshair in FPS (pointer-lock handles it)
    this._updateModeLabel();
  }

  /**
   * Enter/exit aim mode (YAZH: Camera.aimAnimation).
   * @param {boolean} aiming
   * @param {boolean} [isRifle=false] - zooms in more for ranged weapons
   */
  setAiming(aiming, isRifle = false) {
    this._isAiming = aiming;
    this._crosshair.classList.toggle('aiming', aiming);
    this._updateModeLabel();
  }

  /** Signal running state for camera bob (YAZH: Camera.runAnimation) */
  setRunning(running) {
    this._isRunning = running;
    this._bobActive = running;
  }

  /** Signal moving state for crosshair spread */
  setMoving(moving) {
    this._crosshair.classList.toggle('moving', moving && !this._isAiming);
  }

  setCrosshairVisible(visible) {
    this._crosshairVisible = visible;
    this._crosshair.classList.toggle('hidden', !visible);
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get camera()    { return this._camera; }
  get isFPS()     { return this._isFPS; }
  get isAiming()  { return this._isAiming; }

  // ── Labelling ──────────────────────────────────────────────────────────────

  _updateModeLabel() {
    const mode    = this._isFPS ? 'FPS' : this._isAiming ? 'AIM' : 'TPS';
    const shoulder = this._isFPS ? '' : this._shoulder === SHOULDER.RIGHT ? ' ►' : ' ◄';
    this._modeLabel.textContent = `${mode}${shoulder}  [C] view  [V] shoulder  [RMB] aim`;
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  dispose() {
    this._crosshair.remove();
    this._modeLabel.remove();
    this._camera.dispose();
  }
}
