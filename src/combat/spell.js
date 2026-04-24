import { Projectile } from "./visual/projectile.js";

// ─── Base Spell ──────────────────────────────────────────────────────────────
export class Spell {
  constructor(name, effects, animation, vfx, range) {
    this.name = name;
    this.effects = effects;
    this.animation = animation;
    this.vfx = vfx;
    this.range = range;
    this.facingThreshold = 0.507; // ~60° cone
  }

  canCast(caster, target) {
    if (caster.parent && caster.name !== "Hero") {
      caster.rotationCheck = caster.parent;
      caster.rangeCheck = caster.parent;
    }
    const targetMesh = target.parent;
    const dist = BABYLON.Vector3.Distance(
      caster.rangeCheck.position,
      targetMesh.position,
    );
    if (dist > this.range) return false;

    const dir = targetMesh.position
      .subtract(caster.rangeCheck.position)
      .normalize();
    const dot = BABYLON.Vector3.Dot(caster.rotationCheck.forward, dir);
    if (dot < this.facingThreshold) {
      console.log("Caster is not facing the target.");
      return false;
    }
    return true;
  }

  cast(caster, target) {
    if (!this.canCast(caster, target)) return false;
    this.playVFX(caster, target);
    this.playAnimation(caster);
    this.effects.forEach((effect) => effect.apply(target));
  }

  playAnimation(caster) {
    /* hook for future animation dispatch */
  }

  playVFX(caster, target) {
    if (typeof this.vfx === "function") {
      this.vfx(caster, target, SCENE_MANAGER.activeScene);
    } else {
      // Legacy fireball projectile path
      const proj = new Projectile(5000, 1000, new BABYLON.Vector3(100, 0, 0));
      proj.launch(caster, target);
    }
  }
}

// ─── ThunderballSpell ─────────────────────────────────────────────────────────
// Tab-targeted; bypasses the facing check so it fires at any selected enemy
// within range regardless of which direction the caster is looking.
export class ThunderballSpell extends Spell {
  cast(caster, target) {
    if (!target || !target.parent || !target.isAlive) return false;
    const casterPos = caster.rangeCheck
      ? caster.rangeCheck.position
      : caster.parent
        ? caster.parent.position
        : BABYLON.Vector3.Zero();
    const dist = BABYLON.Vector3.Distance(casterPos, target.parent.position);
    if (dist > this.range) return false;
    this.playVFX(caster, target);
    this.effects.forEach((effect) => effect.apply(target));
    return true;
  }
}

// ─── MultiTargetSpell ────────────────────────────────────────────────────────
// Finds up to `targetCount` alive enemies within `range` of the caster,
// picks them randomly, applies effects to each, and fires the VFX.
// Call via  SPELLS.tripleOrb.castAOE(PLAYER.health)
export class MultiTargetSpell {
  constructor(name, effects, animation, vfx, range, targetCount = 3) {
    this.name = name;
    this.effects = effects;
    this.animation = animation;
    this.vfx = vfx;
    this.range = range;
    this.targetCount = targetCount;
  }

  castAOE(caster) {
    const scene = SCENE_MANAGER.activeScene;
    const casterPos = caster.rangeCheck
      ? caster.rangeCheck.position
      : caster.parent
        ? caster.parent.position
        : BABYLON.Vector3.Zero();

    // Collect nearby alive enemies
    const nearby = [];
    scene.meshes.forEach((mesh) => {
      if (mesh.name === "enemy" && mesh.health && mesh.health.isAlive) {
        const dist = BABYLON.Vector3.Distance(casterPos, mesh.position);
        if (dist <= this.range) nearby.push(mesh);
      }
    });

    if (nearby.length === 0) return false;

    // Shuffle → take up to targetCount
    nearby.sort(() => Math.random() - 0.5);
    const targets = nearby.slice(0, this.targetCount);

    targets.forEach((targetMesh) => {
      this.effects.forEach((effect) => {
        if (targetMesh.health) effect.apply(targetMesh.health);
      });
    });

    if (typeof this.vfx === "function") {
      this.vfx(caster, targets, scene);
    }
    return true;
  }
}

// ─── HealSpell ────────────────────────────────────────────────────────────────
// Mirrors FRESH GRUDGE's TargetHealSkill / AreaHealSkill.
// Skips the facing-cone check — you can always heal a friendly target.
export class HealSpell extends Spell {
  cast(caster, target) {
    if (!target || !target.isAlive) return false;
    const casterPos = caster.rangeCheck
      ? caster.rangeCheck.position
      : caster.parent
        ? caster.parent.position
        : BABYLON.Vector3.Zero();
    const dist = BABYLON.Vector3.Distance(casterPos, target.parent.position);
    if (dist > this.range) return false;
    this.effects.forEach((effect) => effect.apply(target));
    this.playVFX(caster, target);
    return true;
  }
}

// ─── DOTSpell ─────────────────────────────────────────────────────────────────
// Mirrors FRESH GRUDGE's ProjectileSkillEffect + poison/DOT combo.
// Applies instant hit effects AND a lingering cloud VFX for the DOT duration.
export class DOTSpell extends Spell {
  constructor(name, effects, animation, hitVfx, cloudVfx, range, dotDuration) {
    super(name, effects, animation, hitVfx, range);
    this.cloudVfx = cloudVfx;
    this.dotDuration = dotDuration;
  }

  cast(caster, target) {
    if (!this.canCast(caster, target)) return false;
    const scene = SCENE_MANAGER.activeScene;
    // Instant hit VFX (slash)
    if (typeof this.vfx === "function") this.vfx(caster, target, scene);
    // Lingering cloud VFX follows target for DOT duration
    if (typeof this.cloudVfx === "function") {
      this.cloudVfx(caster, target, scene, this.dotDuration);
    }
    this.effects.forEach((effect) => effect.apply(target));
    return true;
  }
}

// ─── AOESpell ─────────────────────────────────────────────────────────────────
// Mirrors FRESH GRUDGE's AreaBuffSkill / AreaHealSkill using OverlapSphere.
// No target required — always casts at caster's position, hits everything
// within `radius` scene units.
export class AOESpell {
  constructor(name, effects, animation, vfx, radius) {
    this.name = name;
    this.effects = effects;
    this.animation = animation;
    this.vfx = vfx;
    this.radius = radius;
  }

  castAOE(caster) {
    const scene = SCENE_MANAGER.activeScene;
    const casterPos = caster.rangeCheck
      ? caster.rangeCheck.position
      : caster.parent
        ? caster.parent.position
        : BABYLON.Vector3.Zero();

    let hit = false;
    scene.meshes.forEach((mesh) => {
      if (mesh.name === "enemy" && mesh.health && mesh.health.isAlive) {
        const dist = BABYLON.Vector3.Distance(casterPos, mesh.position);
        if (dist <= this.radius) {
          this.effects.forEach((effect) => effect.apply(mesh.health));
          hit = true;
        }
      }
    });

    if (typeof this.vfx === "function") {
      this.vfx(caster, this.radius, scene);
    }
    return hit;
  }
}

// ─── BuffSpell ────────────────────────────────────────────────────────────────
// Mirrors FRESH GRUDGE's TargetBuffSkill / BuffSkillEffect.
// Applies HOT/slow/speedBoost effects and shows a glow VFX for `buffDuration`.
export class BuffSpell extends Spell {
  constructor(name, effects, animation, vfx, range, buffDuration = 3000) {
    super(name, effects, animation, vfx, range);
    this.buffDuration = buffDuration;
  }

  cast(caster, target) {
    if (!target || !target.isAlive) return false;
    const casterPos = caster.rangeCheck
      ? caster.rangeCheck.position
      : caster.parent
        ? caster.parent.position
        : BABYLON.Vector3.Zero();
    const dist = BABYLON.Vector3.Distance(casterPos, target.parent.position);
    if (dist > this.range) return false;
    this.effects.forEach((effect) => effect.apply(target));
    const scene = SCENE_MANAGER.activeScene;
    if (typeof this.vfx === "function") {
      this.vfx(caster, target, scene, this.buffDuration);
    }
    return true;
  }
}
