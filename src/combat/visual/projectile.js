/**
 * Projectile.js
 * Grudge Warlords — spline-based projectile system with trail mesh,
 * raycasting hit detection, and element-colored particle effects.
 *
 * Supports:
 *   - Catmull-Rom spline flight path (arc height + jitter)
 *   - TrailMesh with additive fire/ice/arcane shader
 *   - Per-frame raycast from projectile forward for early hit detection
 *   - onHit / onMiss callbacks for VFX + damage
 */

// ── Spline helpers ────────────────────────────────────────────────────────────

function _buildSplinePath(from, to, arcHeight = 4, jitter = 1.5) {
  const mid = BABYLON.Vector3.Lerp(from, to, 0.5);
  mid.y += arcHeight;
  // Add lateral jitter for visual interest
  mid.x += (Math.random() - 0.5) * jitter;
  mid.z += (Math.random() - 0.5) * jitter;

  // Catmull-Rom needs 4 control points; mirror start/end for tangent continuity
  const p0 = from.subtract(to.subtract(from).scale(0.2));
  const p3 = to.add(to.subtract(from).scale(0.1));
  return new BABYLON.Curve3.CreateCatmullRomSpline([p0, from, mid, to, p3], 30, false);
}

// ── Default trail material (additive glow) ───────────────────────────────

function _makeTrailMaterial(scene, color) {
  const mat = new BABYLON.StandardMaterial('projTrail_' + Date.now(), scene);
  mat.emissiveColor = color || new BABYLON.Color3(1.0, 0.5, 0.1);
  mat.disableLighting = true;
  mat.alpha = 0.6;
  return mat;
}

// ── Element color presets ───────────────────────────────────────────────

export const PROJECTILE_COLORS = {
  fire:      { orb: new BABYLON.Color3(1.0, 0.35, 0.05), trail: new BABYLON.Color3(1.0, 0.5, 0.1) },
  ice:       { orb: new BABYLON.Color3(0.2, 0.7, 1.0),   trail: new BABYLON.Color3(0.4, 0.9, 1.0) },
  arcane:    { orb: new BABYLON.Color3(0.7, 0.1, 1.0),   trail: new BABYLON.Color3(0.9, 0.3, 1.0) },
  lightning: { orb: new BABYLON.Color3(1.0, 1.0, 0.3),   trail: new BABYLON.Color3(0.9, 1.0, 0.7) },
  poison:    { orb: new BABYLON.Color3(0.2, 0.9, 0.1),   trail: new BABYLON.Color3(0.3, 1.0, 0.2) },
  dark:      { orb: new BABYLON.Color3(0.3, 0.0, 0.5),   trail: new BABYLON.Color3(0.5, 0.1, 0.7) },
  holy:      { orb: new BABYLON.Color3(1.0, 1.0, 0.7),   trail: new BABYLON.Color3(1.0, 0.95, 0.6) },
};

// ── Main Projectile class ───────────────────────────────────────────────

export class Projectile {
  /**
   * @param {Object} opts
   * @param {number}  [opts.speed=12]        — units/second along the spline
   * @param {number}  [opts.arcHeight=4]     — peak height of the arc
   * @param {number}  [opts.orbSize=0.5]     — diameter of the orb mesh
   * @param {string}  [opts.element='fire']  — color preset key
   * @param {number}  [opts.hitRadius=1.2]   — raycast hit detection radius
   * @param {Function} [opts.onHit]          — called with (targetMesh) on raycast hit
   * @param {Function} [opts.onMiss]         — called if projectile reaches end without hitting
   */
  constructor(opts = {}) {
    this.speed     = opts.speed     || 12;
    this.arcHeight = opts.arcHeight || 4;
    this.orbSize   = opts.orbSize   || 0.5;
    this.element   = opts.element   || 'fire';
    this.hitRadius = opts.hitRadius || 1.2;
    this.onHit     = opts.onHit     || null;
    this.onMiss    = opts.onMiss    || null;
  }

  /**
   * Launch a projectile from caster toward target.
   * @param {Object} caster — needs .parent or .rangeCheck with .position
   * @param {Object} target — needs .parent with .position
   */
  launch(caster, target) {
    const scene = SCENE_MANAGER.activeScene;
    if (!scene) return;

    const casterMesh = caster.rangeCheck || caster.parent;
    const targetMesh = target.parent || target;
    if (!casterMesh || !targetMesh) return;

    const from = casterMesh.position.clone();
    from.y += 1.5; // launch from chest height
    const to = targetMesh.position.clone();
    to.y += 1.0; // aim at torso

    // Build spline path
    const curve = _buildSplinePath(from, to, this.arcHeight);
    const points = curve.getPoints();
    if (points.length < 2) return;

    // Create orb mesh
    const colors = PROJECTILE_COLORS[this.element] || PROJECTILE_COLORS.fire;
    const orb = BABYLON.MeshBuilder.CreateSphere(
      'proj_' + Date.now(), { diameter: this.orbSize, segments: 8 }, scene);
    orb.position = from.clone();
    const orbMat = new BABYLON.StandardMaterial('projMat_' + Date.now(), scene);
    orbMat.emissiveColor = colors.orb;
    orbMat.disableLighting = true;
    orb.material = orbMat;

    // Create trail mesh
    let trail = null;
    try {
      trail = new BABYLON.TrailMesh('projTrail_' + Date.now(), orb, scene, 0.25, 60, true);
      trail.material = SHADERS?.fireTrailShader || _makeTrailMaterial(scene, colors.trail);
    } catch (_) {
      // TrailMesh may not be available in all Babylon.js builds
    }

    // Particle emitter following the orb
    const ps = new BABYLON.ParticleSystem('projPS_' + Date.now(), 100, scene);
    ps.particleTexture = new BABYLON.Texture('assets/textures/effects/flare.png', scene);
    ps.emitter = orb;
    ps.minEmitBox = ps.maxEmitBox = BABYLON.Vector3.Zero();
    ps.color1 = new BABYLON.Color4(colors.trail.r, colors.trail.g, colors.trail.b, 0.9);
    ps.color2 = new BABYLON.Color4(colors.orb.r, colors.orb.g, colors.orb.b, 0.5);
    ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize = 0.05; ps.maxSize = 0.2;
    ps.minLifeTime = 0.1; ps.maxLifeTime = 0.35;
    ps.emitRate = 80;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    ps.gravity = BABYLON.Vector3.Zero();
    ps.minEmitPower = 0.1; ps.maxEmitPower = 0.4;
    ps.start();

    // Animate along spline with per-frame raycast
    let pointIdx = 0;
    const totalDist = BABYLON.Curve3.CreateCatmullRomSpline(
      [from, BABYLON.Vector3.Lerp(from, to, 0.5), to], 2, false
    ).length();
    const totalFrames = points.length;
    let hitDetected = false;

    const obs = scene.onBeforeRenderObservable.add(() => {
      if (hitDetected || pointIdx >= totalFrames) {
        _cleanup();
        return;
      }

      const dt = scene.getEngine().getDeltaTime() / 1000;
      const step = Math.max(1, Math.round(this.speed * dt * (totalFrames / (totalDist || 1))));
      pointIdx = Math.min(pointIdx + step, totalFrames - 1);
      orb.position.copyFrom(points[pointIdx]);

      // Look-at next point for orientation
      if (pointIdx < totalFrames - 1) {
        const dir = points[pointIdx + 1].subtract(points[pointIdx]);
        if (dir.lengthSquared() > 0.0001) {
          orb.lookAt(points[pointIdx + 1]);
        }
      }

      // Raycast hit detection — check distance to target
      const distToTarget = BABYLON.Vector3.Distance(orb.position, targetMesh.position);
      if (distToTarget < this.hitRadius) {
        hitDetected = true;
        if (this.onHit) this.onHit(targetMesh);
        _cleanup();
        return;
      }

      // End of path without hit
      if (pointIdx >= totalFrames - 1) {
        if (this.onMiss) this.onMiss();
        _cleanup();
      }
    });

    const _cleanup = () => {
      scene.onBeforeRenderObservable.remove(obs);
      ps.stop();
      setTimeout(() => {
        orb.dispose();
        ps.dispose();
        if (trail) trail.dispose();
      }, 500);
    };
  }
}

// ── Legacy compat: old Projectile(growthDuration, moveDuration, offset) signature ──
export class LegacyProjectile extends Projectile {
  constructor(growthDuration, moveToTargetDuration, offset) {
    super({ speed: 10, arcHeight: 2, element: 'fire' });
    this._offset = offset;
  }
}
