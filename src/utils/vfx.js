// ─────────────────────────────────────────────────────────────────────────────
// Slash Effects — 7 color presets
// ─────────────────────────────────────────────────────────────────────────────

const SLASH_PRESETS = {
  fire: { c1: [1.0, 0.28, 0.08, 1], c2: [1.0, 0.65, 0.0, 1] },
  ice: { c1: [0.2, 0.8, 1.0, 1], c2: [0.55, 1.0, 1.0, 1] },
  poison: { c1: [0.1, 1.0, 0.1, 1], c2: [0.4, 0.9, 0.0, 1] },
  arcane: { c1: [0.7, 0.0, 1.0, 1], c2: [1.0, 0.2, 0.85, 1] },
  lightning: { c1: [1.0, 1.0, 0.28, 1], c2: [0.9, 1.0, 1.0, 1] },
  dark: { c1: [0.28, 0.0, 0.5, 1], c2: [0.6, 0.0, 0.8, 1] },
  holy: { c1: [1.0, 1.0, 0.8, 1], c2: [1.0, 0.9, 0.5, 1] },
};

function _makeSlashPS(scene, emitter, preset) {
  const p = SLASH_PRESETS[preset] || SLASH_PRESETS.fire;
  const ps = new BABYLON.ParticleSystem(
    "slash_" + preset + "_" + Date.now(),
    2000,
    scene,
  );
  ps.particleTexture = new BABYLON.Texture("textures/flare.png", scene);
  ps.emitter = emitter;
  ps.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.3);
  ps.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0.3);
  ps.color1 = new BABYLON.Color4(...p.c1);
  ps.color2 = new BABYLON.Color4(...p.c2);
  ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
  ps.minSize = 0.08;
  ps.maxSize = 0.46;
  ps.minLifeTime = 0.1;
  ps.maxLifeTime = 0.4;
  ps.emitRate = 650;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  ps.gravity = new BABYLON.Vector3(0, -2, 0);
  ps.direction1 = new BABYLON.Vector3(-1.5, 2, -1.5);
  ps.direction2 = new BABYLON.Vector3(1.5, 2, 1.5);
  ps.minAngularSpeed = 0;
  ps.maxAngularSpeed = Math.PI;
  ps.minEmitPower = 2;
  ps.maxEmitPower = 5;
  ps.updateSpeed = 0.007;
  return ps;
}

function _spawnSlash(scene, emitter, preset = "fire", duration = 280) {
  const ps = _makeSlashPS(scene, emitter, preset);
  ps.start();
  setTimeout(() => {
    ps.stop();
    setTimeout(() => ps.dispose(), 600);
  }, duration);
}

// Named exports — call as SlashEffect(scene, emitter) from a Spell vfx function
export function SlashEffect(caster, target, scene) {
  const em = caster.rangeCheck || caster.parent;
  _spawnSlash(scene, em, "fire");
}
export function IceSlashEffect(caster, target, scene) {
  const em = caster.rangeCheck || caster.parent;
  _spawnSlash(scene, em, "ice");
}
export function PoisonSlashEffect(caster, target, scene) {
  const em = caster.rangeCheck || caster.parent;
  _spawnSlash(scene, em, "poison");
}
export function ArcaneSlashEffect(caster, target, scene) {
  const em = caster.rangeCheck || caster.parent;
  _spawnSlash(scene, em, "arcane");
}
export function LightningSlashEffect(caster, target, scene) {
  const em = caster.rangeCheck || caster.parent;
  _spawnSlash(scene, em, "lightning");
}
export function DarkSlashEffect(caster, target, scene) {
  const em = caster.rangeCheck || caster.parent;
  _spawnSlash(scene, em, "dark");
}
export function HolySlashEffect(caster, target, scene) {
  const em = caster.rangeCheck || caster.parent;
  _spawnSlash(scene, em, "holy");
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightning Ball VFX
//   Phase 1 (0–600 ms): white-blush pulsing orb floats above target's head
//   Phase 2 (600 ms):   zigzag lightning bolt strikes down onto target
//   Phase 3:            impact particle burst at ground
// ─────────────────────────────────────────────────────────────────────────────

export function LightningBallVFX(caster, target, scene) {
  const targetMesh = target.parent;
  const basePos = targetMesh.position.clone();
  const ballPos = basePos.clone();
  ballPos.y += 9;

  // Glowing orb
  const ball = BABYLON.MeshBuilder.CreateSphere(
    "lball_" + Date.now(),
    { diameter: 1.8, segments: 8 },
    scene,
  );
  ball.position = ballPos.clone();
  const ballMat = new BABYLON.StandardMaterial("lballMat_" + Date.now(), scene);
  ballMat.emissiveColor = new BABYLON.Color3(1.0, 0.88, 0.96);
  ballMat.disableLighting = true;
  ball.material = ballMat;

  // Halo particle shimmer
  const halo = _makeHaloPS(scene, ball);
  halo.start();

  // Pulse scale animation
  const pulseAnim = new BABYLON.Animation(
    "ballPulse",
    "scaling",
    60,
    BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
    BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  pulseAnim.setKeys([
    { frame: 0, value: new BABYLON.Vector3(1, 1, 1) },
    { frame: 15, value: new BABYLON.Vector3(1.2, 1.2, 1.2) },
    { frame: 30, value: new BABYLON.Vector3(1, 1, 1) },
  ]);
  ball.animations = [pulseAnim];
  scene.beginAnimation(ball, 0, 30, true);

  // Phase 2 after 600 ms
  setTimeout(() => {
    halo.stop();
    scene.stopAnimation(ball);
    _fireLightningBolt(scene, ball.position.clone(), basePos.clone(), () => {
      ball.dispose();
      setTimeout(() => halo.dispose(), 800);
      _spawnImpactBurst(scene, basePos.clone());
    });
  }, 600);
}

function _makeHaloPS(scene, emitter) {
  const ps = new BABYLON.ParticleSystem("halo_" + Date.now(), 300, scene);
  ps.particleTexture = new BABYLON.Texture("textures/flare.png", scene);
  ps.emitter = emitter;
  ps.minEmitBox = new BABYLON.Vector3(-0.4, -0.4, -0.4);
  ps.maxEmitBox = new BABYLON.Vector3(0.4, 0.4, 0.4);
  ps.color1 = new BABYLON.Color4(1.0, 0.95, 1.0, 0.9);
  ps.color2 = new BABYLON.Color4(0.8, 0.65, 1.0, 0.7);
  ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
  ps.minSize = 0.4;
  ps.maxSize = 1.3;
  ps.minLifeTime = 0.25;
  ps.maxLifeTime = 0.55;
  ps.emitRate = 130;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  ps.gravity = BABYLON.Vector3.Zero();
  ps.direction1 = new BABYLON.Vector3(-0.8, -0.4, -0.8);
  ps.direction2 = new BABYLON.Vector3(0.8, 0.4, 0.8);
  ps.minEmitPower = 0.4;
  ps.maxEmitPower = 1.4;
  return ps;
}

function _fireLightningBolt(scene, from, to, onComplete) {
  const SEGS = 12;
  const points = [];
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS;
    const p = BABYLON.Vector3.Lerp(from, to, t);
    if (i > 0 && i < SEGS) {
      p.x += (Math.random() - 0.5) * 2.8;
      p.z += (Math.random() - 0.5) * 2.8;
    }
    points.push(p);
  }

  const uid = Date.now();
  const boltMat = new BABYLON.StandardMaterial("boltMat_" + uid, scene);
  boltMat.emissiveColor = new BABYLON.Color3(0.95, 0.97, 1.0);
  boltMat.disableLighting = true;

  const glowMat = new BABYLON.StandardMaterial("boltGlow_" + uid, scene);
  glowMat.emissiveColor = new BABYLON.Color3(0.5, 0.62, 1.0);
  glowMat.alpha = 0.38;
  glowMat.disableLighting = true;

  const bolt = BABYLON.MeshBuilder.CreateTube(
    "bolt_" + uid,
    { path: points, radius: 0.11, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
  bolt.material = boltMat;

  const glow = BABYLON.MeshBuilder.CreateTube(
    "boltG_" + uid,
    { path: points, radius: 0.38, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
  glow.material = glowMat;

  let flickers = 0;
  const iv = setInterval(() => {
    bolt.isVisible = !bolt.isVisible;
    glow.isVisible = !glow.isVisible;
    if (++flickers >= 6) {
      clearInterval(iv);
      bolt.dispose();
      glow.dispose();
      if (onComplete) onComplete();
    }
  }, 65);
}

function _spawnImpactBurst(scene, position) {
  const ps = new BABYLON.ParticleSystem("impact_" + Date.now(), 400, scene);
  ps.particleTexture = new BABYLON.Texture("textures/flare.png", scene);
  ps.emitter = position;
  ps.minEmitBox = ps.maxEmitBox = new BABYLON.Vector3(0, 0, 0);
  ps.color1 = new BABYLON.Color4(1.0, 1.0, 1.0, 1.0);
  ps.color2 = new BABYLON.Color4(0.7, 0.8, 1.0, 0.9);
  ps.colorDead = new BABYLON.Color4(0.2, 0.2, 0.8, 0.0);
  ps.minSize = 0.2;
  ps.maxSize = 1.1;
  ps.minLifeTime = 0.2;
  ps.maxLifeTime = 0.65;
  ps.manualEmitCount = 220;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  ps.gravity = new BABYLON.Vector3(0, 2, 0);
  ps.direction1 = new BABYLON.Vector3(-4, 1, -4);
  ps.direction2 = new BABYLON.Vector3(4, 7, 4);
  ps.minEmitPower = 3;
  ps.maxEmitPower = 9;
  ps.start();
  setTimeout(() => {
    ps.stop();
    setTimeout(() => ps.dispose(), 800);
  }, 120);
}

// ─────────────────────────────────────────────────────────────────────────────
// Triple Orb VFX
//   Phase 1 (0–500 ms): spinning torusKnot materialises in front of caster
//   Phase 2 (500 ms):   knot dissolves → 3 colour-coded orbs with trails
//                       fly to up-to-3 target meshes (staggered 110 ms each)
//   Phase 3:            each orb bursts on impact
// ─────────────────────────────────────────────────────────────────────────────

const _ORB_COLORS = [
  new BABYLON.Color3(0.28, 0.92, 1.0), // cyan
  new BABYLON.Color3(0.82, 0.28, 1.0), // violet
  new BABYLON.Color3(0.28, 1.0, 0.55), // mint
];

export function TripleOrbVFX(caster, targets, scene) {
  const casterMesh = caster.rangeCheck || caster.parent;
  const forward = casterMesh.forward || new BABYLON.Vector3(0, 0, 1);
  const spawnPos = casterMesh.position
    .add(forward.scale(3))
    .add(new BABYLON.Vector3(0, 1.5, 0));

  // Spinning torusKnot
  const knot = BABYLON.MeshBuilder.CreateTorusKnot(
    "tOrbKnot_" + Date.now(),
    {
      radius: 1.2,
      tube: 0.16,
      radialSegments: 64,
      tubularSegments: 16,
      p: 2,
      q: 3,
    },
    scene,
  );
  knot.position = spawnPos.clone();
  const knotMat = new BABYLON.StandardMaterial("knotMat_" + Date.now(), scene);
  knotMat.emissiveColor = new BABYLON.Color3(0.35, 0.9, 1.0);
  knotMat.disableLighting = true;
  knot.material = knotMat;

  let spinAngle = 0;
  const spinObs = scene.onBeforeRenderObservable.add(() => {
    spinAngle += 0.09;
    knot.rotation.y = spinAngle;
    knot.rotation.x = spinAngle * 0.55;
  });

  // Launch orbs after 500 ms
  setTimeout(() => {
    scene.onBeforeRenderObservable.remove(spinObs);
    knot.dispose();
    targets.forEach((target, i) => {
      setTimeout(() => _launchOrb(scene, spawnPos.clone(), target, i), i * 110);
    });
  }, 500);
}

function _launchOrb(scene, from, targetMesh, index) {
  const col = _ORB_COLORS[index % _ORB_COLORS.length];
  const orb = BABYLON.MeshBuilder.CreateSphere(
    "triOrb_" + index + "_" + Date.now(),
    { diameter: 0.9, segments: 6 },
    scene,
  );
  orb.position = from.clone();
  const orbMat = new BABYLON.StandardMaterial(
    "orbMat_" + index + "_" + Date.now(),
    scene,
  );
  orbMat.emissiveColor = col;
  orbMat.disableLighting = true;
  orb.material = orbMat;

  // Colour-coded trail
  const trail = new BABYLON.ParticleSystem(
    "orbTrail_" + index + "_" + Date.now(),
    160,
    scene,
  );
  trail.particleTexture = new BABYLON.Texture("textures/flare.png", scene);
  trail.emitter = orb;
  trail.minEmitBox = trail.maxEmitBox = new BABYLON.Vector3(0, 0, 0);
  trail.color1 = new BABYLON.Color4(col.r, col.g, col.b, 0.9);
  trail.color2 = new BABYLON.Color4(col.r * 0.5, col.g * 0.5, col.b * 0.5, 0.5);
  trail.colorDead = new BABYLON.Color4(0, 0, 0, 0);
  trail.minSize = 0.2;
  trail.maxSize = 0.6;
  trail.minLifeTime = 0.18;
  trail.maxLifeTime = 0.45;
  trail.emitRate = 90;
  trail.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  trail.gravity = BABYLON.Vector3.Zero();
  trail.direction1 = trail.direction2 = new BABYLON.Vector3(0, 0, 0);
  trail.minEmitPower = 0.1;
  trail.maxEmitPower = 0.3;
  trail.start();

  // Fly-to animation
  const dest = targetMesh.position.clone();
  dest.y += 1.0;
  const flyAnim = new BABYLON.Animation(
    "orbFly_" + index,
    "position",
    60,
    BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  const ease = new BABYLON.QuadraticEase();
  ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
  flyAnim.setEasingFunction(ease);
  flyAnim.setKeys([
    { frame: 0, value: from.clone() },
    { frame: 32, value: dest },
  ]);
  orb.animations = [flyAnim];

  scene.beginAnimation(orb, 0, 32, false, 1.0, () => {
    trail.stop();
    orb.dispose();
    _spawnImpactBurst(scene, dest);
    setTimeout(() => trail.dispose(), 700);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HealBurstVFX — green/gold upward particle burst on target
// Matches FRESH GRUDGE's TargetHealSkill / AreaHealSkill effect prefab
// ─────────────────────────────────────────────────────────────────────────────
export function HealBurstVFX(caster, target, scene) {
  const pos = target.parent
    ? target.parent.position.clone()
    : BABYLON.Vector3.Zero();
  pos.y += 0.5;

  const ps = new BABYLON.ParticleSystem("healBurst_" + Date.now(), 500, scene);
  ps.particleTexture = new BABYLON.Texture("textures/flare.png", scene);
  ps.emitter = pos;
  ps.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
  ps.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0.5);
  ps.color1 = new BABYLON.Color4(0.2, 1.0, 0.3, 1.0);
  ps.color2 = new BABYLON.Color4(1.0, 0.9, 0.2, 1.0);
  ps.colorDead = new BABYLON.Color4(0, 0.3, 0, 0);
  ps.minSize = 0.1;
  ps.maxSize = 0.5;
  ps.minLifeTime = 0.4;
  ps.maxLifeTime = 1.1;
  ps.emitRate = 300;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  ps.gravity = new BABYLON.Vector3(0, -0.5, 0);
  ps.direction1 = new BABYLON.Vector3(-1, 4, -1);
  ps.direction2 = new BABYLON.Vector3(1, 8, 1);
  ps.minEmitPower = 2;
  ps.maxEmitPower = 5;
  ps.start();
  setTimeout(() => {
    ps.stop();
    setTimeout(() => ps.dispose(), 1200);
  }, 350);
}

// ─────────────────────────────────────────────────────────────────────────────
// AOEExplosionVFX — expanding ring + outward burst for area-damage spells
// Matches FRESH GRUDGE's AreaBuffSkill / AreaHealSkill cast range indicator
// ─────────────────────────────────────────────────────────────────────────────
export function AOEExplosionVFX(caster, radius, scene) {
  const casterMesh = caster.rangeCheck || caster.parent;
  const origin = casterMesh.position.clone();

  // Expanding torus ring
  const ring = BABYLON.MeshBuilder.CreateTorus(
    "aoeRing_" + Date.now(),
    { diameter: 0.1, thickness: 0.15, tessellation: 40 },
    scene,
  );
  ring.position = origin.clone();
  ring.position.y += 0.1;
  const ringMat = new BABYLON.StandardMaterial(
    "aoeRingMat_" + Date.now(),
    scene,
  );
  ringMat.emissiveColor = new BABYLON.Color3(1.0, 0.4, 0.1);
  ringMat.disableLighting = true;
  ring.material = ringMat;

  const expandAnim = new BABYLON.Animation(
    "aoeExpand",
    "scaling",
    60,
    BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  const targetScale = radius / 5; // normalize to scene units
  expandAnim.setKeys([
    { frame: 0, value: new BABYLON.Vector3(0.1, 1, 0.1) },
    { frame: 28, value: new BABYLON.Vector3(targetScale, 1, targetScale) },
  ]);
  ring.animations = [expandAnim];
  scene.beginAnimation(ring, 0, 28, false, 1.0, () => ring.dispose());

  // Outward particle burst
  const ps = new BABYLON.ParticleSystem("aoeBlast_" + Date.now(), 700, scene);
  ps.particleTexture = new BABYLON.Texture("textures/flare.png", scene);
  ps.emitter = origin.clone();
  ps.minEmitBox = new BABYLON.Vector3(-0.3, 0, -0.3);
  ps.maxEmitBox = new BABYLON.Vector3(0.3, 0.5, 0.3);
  ps.color1 = new BABYLON.Color4(1.0, 0.55, 0.05, 1.0);
  ps.color2 = new BABYLON.Color4(1.0, 0.15, 0.0, 0.8);
  ps.colorDead = new BABYLON.Color4(0.2, 0, 0, 0);
  ps.minSize = 0.15;
  ps.maxSize = 0.8;
  ps.minLifeTime = 0.3;
  ps.maxLifeTime = 0.9;
  ps.emitRate = 500;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  ps.gravity = new BABYLON.Vector3(0, 1.5, 0);
  ps.direction1 = new BABYLON.Vector3(-5, 2, -5);
  ps.direction2 = new BABYLON.Vector3(5, 5, 5);
  ps.minEmitPower = 4;
  ps.maxEmitPower = 10;
  ps.start();
  setTimeout(() => {
    ps.stop();
    setTimeout(() => ps.dispose(), 1000);
  }, 200);
}

// ─────────────────────────────────────────────────────────────────────────────
// PoisonCloudVFX — lingering green cloud DOT indicator on target
// Matches FRESH GRUDGE's BuffSkillEffect (follows target for buff duration)
// ─────────────────────────────────────────────────────────────────────────────
export function PoisonCloudVFX(caster, target, scene, durationMs = 4000) {
  const targetMesh = target.parent;

  const ps = new BABYLON.ParticleSystem(
    "poisonCloud_" + Date.now(),
    150,
    scene,
  );
  ps.particleTexture = new BABYLON.Texture("textures/flare.png", scene);
  ps.emitter = targetMesh; // follows the target automatically
  ps.minEmitBox = new BABYLON.Vector3(-0.8, 0, -0.8);
  ps.maxEmitBox = new BABYLON.Vector3(0.8, 1.5, 0.8);
  ps.color1 = new BABYLON.Color4(0.1, 0.9, 0.1, 0.6);
  ps.color2 = new BABYLON.Color4(0.3, 0.6, 0.0, 0.4);
  ps.colorDead = new BABYLON.Color4(0, 0.1, 0, 0);
  ps.minSize = 0.3;
  ps.maxSize = 1.0;
  ps.minLifeTime = 0.8;
  ps.maxLifeTime = 1.8;
  ps.emitRate = 50;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
  ps.gravity = new BABYLON.Vector3(0, 0.3, 0);
  ps.direction1 = new BABYLON.Vector3(-0.5, 1, -0.5);
  ps.direction2 = new BABYLON.Vector3(0.5, 2, 0.5);
  ps.minEmitPower = 0.3;
  ps.maxEmitPower = 0.8;
  ps.start();
  setTimeout(() => {
    ps.stop();
    setTimeout(() => ps.dispose(), 2000);
  }, durationMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// BuffGlowVFX — gold shimmer aura for positive buff (speed boost, holy, etc.)
// Matches FRESH GRUDGE's BuffSkillEffect (follows target for buff duration)
// ─────────────────────────────────────────────────────────────────────────────
export function BuffGlowVFX(caster, target, scene, durationMs = 3000) {
  const targetMesh = target.parent;

  const ps = new BABYLON.ParticleSystem("buffGlow_" + Date.now(), 120, scene);
  ps.particleTexture = new BABYLON.Texture("textures/flare.png", scene);
  ps.emitter = targetMesh;
  ps.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
  ps.maxEmitBox = new BABYLON.Vector3(0.5, 2.0, 0.5);
  ps.color1 = new BABYLON.Color4(1.0, 0.9, 0.2, 0.8);
  ps.color2 = new BABYLON.Color4(1.0, 0.7, 0.1, 0.5);
  ps.colorDead = new BABYLON.Color4(1.0, 1.0, 0.5, 0);
  ps.minSize = 0.08;
  ps.maxSize = 0.35;
  ps.minLifeTime = 0.5;
  ps.maxLifeTime = 1.2;
  ps.emitRate = 60;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  ps.gravity = new BABYLON.Vector3(0, -0.2, 0);
  ps.direction1 = new BABYLON.Vector3(-0.3, 2, -0.3);
  ps.direction2 = new BABYLON.Vector3(0.3, 3, 0.3);
  ps.minEmitPower = 0.5;
  ps.maxEmitPower = 1.5;
  ps.start();
  setTimeout(() => {
    ps.stop();
    setTimeout(() => ps.dispose(), 1500);
  }, durationMs);
}
