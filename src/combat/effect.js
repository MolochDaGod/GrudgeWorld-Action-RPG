import { Health } from '../character/health.js';

export class Effect {
  constructor(type, value, duration = 0) {
    this.type = type;
    this.value = value;
    this.duration = duration; // ms — used by DOT, buff, slow, speedBoost
  }

  apply(target) {
    if (!(target instanceof Health)) return;

    switch (this.type) {
      // ── Instant damage ────────────────────────────────────────────
      case "damage": {
        const roll = Math.floor(Math.random() * 3);
        target.takeDamage(this.value + roll);
        break;
      }

      // ── Instant heal ──────────────────────────────────────────────
      case "heal": {
        target.heal(this.value);
        break;
      }

      // ── Damage over time (DOT) ─────────────────────────────────────
      // Ticks once per second for `duration` ms.
      // e.g. new Effect('dot', 3, 4000) = 3 dmg/s for 4 s
      case "dot": {
        const tickInterval = 1000;
        const ticks = Math.floor(this.duration / tickInterval);
        let tickCount = 0;
        const id = setInterval(() => {
          if (!target.isAlive || tickCount >= ticks) {
            clearInterval(id);
            return;
          }
          target.takeDamage(this.value);
          tickCount++;
        }, tickInterval);
        break;
      }

      // ── Heal over time (HOT) ───────────────────────────────────────
      // e.g. new Effect('hot', 5, 3000) = 5 hp/s for 3 s
      case "hot": {
        const tickInterval = 1000;
        const ticks = Math.floor(this.duration / tickInterval);
        let tickCount = 0;
        const id = setInterval(() => {
          if (!target.isAlive || tickCount >= ticks) {
            clearInterval(id);
            return;
          }
          target.heal(this.value);
          tickCount++;
        }, tickInterval);
        break;
      }

      // ── Slow ───────────────────────────────────────────────────────
      // Multiplies target.speedMultiplier (default 1.0) by `value` (e.g. 0.5)
      // for `duration` ms, then restores it.
      case "slow": {
        if (target.speedMultiplier === undefined) target.speedMultiplier = 1.0;
        target.speedMultiplier *= this.value;
        setTimeout(() => {
          target.speedMultiplier /= this.value;
        }, this.duration);
        break;
      }

      // ── Speed boost ────────────────────────────────────────────────
      // e.g. new Effect('speedBoost', 1.5, 3000)
      case "speedBoost": {
        if (target.speedMultiplier === undefined) target.speedMultiplier = 1.0;
        target.speedMultiplier *= this.value;
        setTimeout(() => {
          target.speedMultiplier /= this.value;
        }, this.duration);
        break;
      }

      // ── Stun ───────────────────────────────────────────────────────
      // Sets target.stunned = true for `duration` ms.
      case "stun": {
        target.stunned = true;
        setTimeout(() => {
          target.stunned = false;
        }, this.duration);
        break;
      }
    }
  }
}