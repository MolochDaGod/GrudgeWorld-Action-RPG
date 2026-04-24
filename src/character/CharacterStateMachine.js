/**
 * CharacterStateMachine.js
 * Robust FSM for Grudge Warlords characters (hero and enemy).
 *
 * Inspired by YetAnotherZombieHorror's `blockingAnimation` pattern but
 * extended into a full state table so animations and transitions are
 * data-driven and bug-free (no more manual boolean flag soup).
 *
 * Usage:
 *   const sm = new CharacterStateMachine(animMap, onStateEnter);
 *   sm.transition('run');
 *   sm.transition('attack1');   // blocked if hit/dead
 *   sm.update(delta);           // fires one-shot finish if needed
 */

// ── State Definitions ──────────────────────────────────────────────────────────

export const STATE = Object.freeze({
  IDLE:         'idle',
  WALK:         'walk',
  RUN:          'run',
  COMBAT_IDLE:  'combatIdle',
  ATTACK_1:     'attack1',
  ATTACK_2:     'attack2',
  ATTACK_3:     'attack3',
  BLOCK:        'block',
  HIT:          'hit',
  DEATH:        'death',
  CAST:         'cast',
  ROLL:         'roll',
});

/**
 * Full transition table.
 * Each entry:
 *   animKey:  key in the animMap
 *   loop:     whether the animation loops
 *   duration: ms for one-shot animations (auto-transitions back after)
 *   blocking: cannot be interrupted (except by HIT / DEATH)
 *   from:     Set of states this can transition FROM (null = any)
 */
const STATE_TABLE = {
  [STATE.IDLE]: {
    animKey:  'idle',
    loop:     true,
    blocking: false,
    from:     null,
  },
  [STATE.WALK]: {
    animKey:  'walk',
    loop:     true,
    blocking: false,
    from:     new Set([STATE.IDLE, STATE.COMBAT_IDLE, STATE.WALK, STATE.RUN]),
  },
  [STATE.RUN]: {
    animKey:  'run',
    loop:     true,
    blocking: false,
    from:     new Set([STATE.IDLE, STATE.WALK, STATE.RUN, STATE.COMBAT_IDLE]),
  },
  [STATE.COMBAT_IDLE]: {
    animKey:  'combatIdle',
    loop:     true,
    blocking: false,
    from:     null,
  },
  [STATE.ATTACK_1]: {
    animKey:  'attack1',
    loop:     false,
    duration: 900,
    blocking: true,
    from:     new Set([STATE.IDLE, STATE.WALK, STATE.COMBAT_IDLE]),
  },
  [STATE.ATTACK_2]: {
    animKey:  'attack2',
    loop:     false,
    duration: 800,
    blocking: true,
    from:     new Set([STATE.ATTACK_1]),   // chained combo
  },
  [STATE.ATTACK_3]: {
    animKey:  'attack3',
    loop:     false,
    duration: 1100,
    blocking: true,
    from:     new Set([STATE.ATTACK_2]),   // chained combo
  },
  [STATE.BLOCK]: {
    animKey:  'block',
    loop:     true,
    blocking: false,
    from:     new Set([STATE.IDLE, STATE.COMBAT_IDLE, STATE.WALK]),
  },
  [STATE.HIT]: {
    animKey:  'hit',
    loop:     false,
    duration: 600,
    blocking: true,
    from:     null,  // always interruptible by HIT
  },
  [STATE.DEATH]: {
    animKey:  'death',
    loop:     false,
    duration: 3000,
    blocking: true,
    from:     null,  // always allowed
  },
  [STATE.CAST]: {
    animKey:  'cast',
    loop:     false,
    duration: 1200,
    blocking: true,
    from:     new Set([STATE.IDLE, STATE.COMBAT_IDLE]),
  },
  [STATE.ROLL]: {
    animKey:  'roll',
    loop:     false,
    duration: 700,
    blocking: true,
    from:     new Set([STATE.IDLE, STATE.WALK, STATE.RUN, STATE.COMBAT_IDLE]),
  },
};

// ── CharacterStateMachine ─────────────────────────────────────────────────────

export class CharacterStateMachine {
  /**
   * @param {Object}   animMap     - { [animKey]: BABYLON.AnimationGroup | callable }
   * @param {Function} onEnter     - optional cb(stateName, prevStateName)
   * @param {number}   blendTime   - animation cross-fade time in seconds
   */
  constructor(animMap, onEnter = null, blendTime = 0.12) {
    this._animMap   = animMap;
    this._onEnter   = onEnter;
    this._blendTime = blendTime;

    this._current    = null;
    this._currentDef = null;
    this._timer      = 0;          // ms remaining for one-shot
    this._queued     = null;       // next state queued during blocking anim
    this._dead       = false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Current state name */
  get state() { return this._current; }

  get isDead()        { return this._dead; }
  get isBlocking()    { return this._currentDef?.blocking && this._timer > 0; }
  get isInCombat()    { return this._current === STATE.COMBAT_IDLE || this._isAttacking; }
  get canMove()       { return !this.isBlocking || this._current === STATE.BLOCK; }

  get _isAttacking() {
    return this._current === STATE.ATTACK_1 ||
           this._current === STATE.ATTACK_2 ||
           this._current === STATE.ATTACK_3;
  }

  /**
   * Request a state transition.
   * Returns true if the transition occurred, false if blocked.
   * @param {string} nextState
   * @param {boolean} [force=false]  - bypass guards (use for DEATH/HIT)
   */
  transition(nextState, force = false) {
    if (this._dead && nextState !== STATE.DEATH) return false;

    const def = STATE_TABLE[nextState];
    if (!def) {
      console.warn(`[CharacterStateMachine] Unknown state: "${nextState}"`);
      return false;
    }

    // DEATH and HIT always interrupt (inspired by YAZH's unconditional hit path)
    const alwaysInterrupt = nextState === STATE.DEATH || nextState === STATE.HIT;

    // Check FROM guard
    if (!alwaysInterrupt && !force && def.from !== null) {
      if (!def.from.has(this._current)) {
        // Queue the transition if we're currently blocking (e.g., queue attack2 during attack1 end)
        if (this.isBlocking) this._queued = nextState;
        return false;
      }
    }

    // Check blocking guard
    if (!alwaysInterrupt && !force && this.isBlocking) {
      this._queued = nextState;
      return false;
    }

    this._applyTransition(nextState, def);
    return true;
  }

  /**
   * Convenience: transition to IDLE unless dead/blocking.
   */
  rest() {
    if (!this.isBlocking && !this._dead) this.transition(STATE.IDLE);
  }

  /**
   * Call once per frame with delta in ms.
   * Handles one-shot timer → auto restores to COMBAT_IDLE or IDLE.
   */
  update(deltaMs) {
    if (!this._currentDef || this._currentDef.loop || this._timer <= 0) return;

    this._timer -= deltaMs;
    if (this._timer <= 0) {
      this._timer = 0;
      // Fire queued transition OR return to rest state
      const next = this._queued || (this._dead ? null : STATE.COMBAT_IDLE);
      this._queued = null;
      if (next) this._applyTransition(next, STATE_TABLE[next]);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _applyTransition(nextState, def) {
    const prev = this._current;

    this._current    = nextState;
    this._currentDef = def;
    this._timer      = def.duration || 0;
    if (nextState === STATE.DEATH) this._dead = true;

    // Play animation
    this._playAnim(def.animKey, def.loop);

    if (this._onEnter) this._onEnter(nextState, prev);
  }

  _playAnim(key, loop) {
    const anim = this._animMap[key];
    if (!anim) return;

    if (typeof anim === 'function') {
      anim(loop);
      return;
    }

    // BABYLON.AnimationGroup path
    try {
      // Stop all other groups with blend
      for (const [k, ag] of Object.entries(this._animMap)) {
        if (k !== key && ag && typeof ag.isPlaying === 'boolean' && ag.isPlaying) {
          if (this._blendTime > 0) {
            // Fade out via weight
            _fadeWeight(ag, 0, this._blendTime * 1000);
          } else {
            ag.stop();
          }
        }
      }

      const target = this._animMap[key];
      target.start(loop);
      if (this._blendTime > 0) {
        _fadeWeight(target, 1, this._blendTime * 1000);
      }
    } catch (e) {
      console.warn('[CharacterStateMachine] Anim play error:', e);
    }
  }
}

// ── Animation blend helper ─────────────────────────────────────────────────────

function _fadeWeight(animGroup, targetWeight, durationMs) {
  if (!animGroup) return;
  const startWeight = animGroup.weight ?? (targetWeight > 0 ? 0 : 1);
  const startTime = performance.now();
  function tick() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / durationMs, 1);
    const w = startWeight + (targetWeight - startWeight) * t;
    try { animGroup.weight = w; } catch (_) { return; }
    if (t < 1) requestAnimationFrame(tick);
    else if (targetWeight === 0) { try { animGroup.stop(); } catch (_) {} }
  }
  requestAnimationFrame(tick);
}

// ── Factory helpers ───────────────────────────────────────────────────────────

/**
 * Build an animMap from a BABYLON.Scene's animationGroups by name.
 * Maps STATE keys to matching groups by fuzzy name lookup.
 *
 * @param {BABYLON.Scene} scene
 * @param {Object} nameMap  - { [stateKey]: 'AnimationGroupName' }
 */
export function buildAnimMapFromScene(scene, nameMap) {
  const map = {};
  for (const [key, name] of Object.entries(nameMap)) {
    const ag = scene.getAnimationGroupByName(name);
    if (ag) map[key] = ag;
    else    console.warn(`[buildAnimMapFromScene] Group "${name}" not found for key "${key}"`);
  }
  return map;
}

/**
 * Default name map for HumanBaseMesh_WithEquips.glb KayKit adventurer.
 */
export const KAYKIT_ANIM_NAMES = {
  [STATE.IDLE]:        'BreathingIdle',
  [STATE.WALK]:        'Walking_A',
  [STATE.RUN]:         'RunningSprint',
  [STATE.COMBAT_IDLE]: 'Sword And Shield Idle',
  [STATE.ATTACK_1]:    'Sword And Shield Attack',
  [STATE.ATTACK_2]:    'OneHandClubCombo',
  [STATE.BLOCK]:       'Sword And Shield Block',
  [STATE.HIT]:         'Sword And Shield Impact',
  [STATE.DEATH]:       'Sword And Shield Death',
  [STATE.CAST]:        'Standing 2H Magic Area Attack 02',
  [STATE.ROLL]:        'SprintingForwardRollInPlace',
};
