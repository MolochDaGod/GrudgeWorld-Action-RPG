/**
 * HUD.js
 * Grudge Warlords in-game HUD — health bar, ammo, status effects.
 * Inspired by YAZH's Svelte HUD components, rebuilt as pure vanilla DOM
 * so it works in the existing Babylon.js setup with zero framework deps.
 *
 * Features:
 *   - Hero faction-colored health bar with animated glow
 *   - Numeric HP + max HP display
 *   - Stamina / action bar (for blocking, rolling)
 *   - Status indicators (blocking, hit, dead)
 *   - Screen flash on hit (red vignette)
 *   - Death overlay
 *   - Mobile-friendly layout (bottom of screen)
 *
 * Usage:
 *   const hud = new GrudgeHUD({ factionColor: '#4a90d9', raceName: 'Human' });
 *   hud.setHealth(80, 100);
 *   hud.setStamina(60, 100);
 *   hud.flashHit();
 *   hud.showDeath();
 */

export class GrudgeHUD {
  /**
   * @param {Object} opts
   * @param {string} [opts.factionColor='#c8a951']
   * @param {string} [opts.raceName='Hero']
   * @param {number} [opts.maxHealth=100]
   * @param {number} [opts.maxStamina=100]
   */
  constructor(opts = {}) {
    this._color    = opts.factionColor || '#c8a951';
    this._race     = opts.raceName     || 'Hero';
    this._maxHP    = opts.maxHealth    || 100;
    this._maxStam  = opts.maxStamina   || 100;
    this._hp       = this._maxHP;
    this._stam     = this._maxStam;

    this._build();
  }

  // ── Build DOM ──────────────────────────────────────────────────────────────

  _build() {
    this._injectStyles();

    // Root container
    this._root = document.createElement('div');
    this._root.id = 'grudgeHUD';
    document.body.appendChild(this._root);

    this._root.innerHTML = `
      <div id="ghud-portrait">
        <div id="ghud-race-name">${this._race.toUpperCase()}</div>
      </div>
      <div id="ghud-bars">
        <div id="ghud-hp-row">
          <span id="ghud-hp-label">HP</span>
          <div id="ghud-hp-track">
            <div id="ghud-hp-fill"></div>
            <div id="ghud-hp-damage"></div>
          </div>
          <span id="ghud-hp-value">100 / 100</span>
        </div>
        <div id="ghud-stam-row">
          <span id="ghud-stam-label">STA</span>
          <div id="ghud-stam-track">
            <div id="ghud-stam-fill"></div>
          </div>
          <span id="ghud-stam-value">100</span>
        </div>
      </div>
      <div id="ghud-status"></div>
    `;

    // Cache references
    this._hpFill    = this._root.querySelector('#ghud-hp-fill');
    this._hpDamage  = this._root.querySelector('#ghud-hp-damage');
    this._hpValue   = this._root.querySelector('#ghud-hp-value');
    this._stamFill  = this._root.querySelector('#ghud-stam-fill');
    this._stamValue = this._root.querySelector('#ghud-stam-value');
    this._status    = this._root.querySelector('#ghud-status');

    // Apply faction color
    this._hpFill.style.background = `linear-gradient(90deg, ${this._color}cc, ${this._color})`;
    this._hpFill.style.boxShadow  = `0 0 10px ${this._color}66`;
    this._root.querySelector('#ghud-race-name').style.color = this._color;

    // Hit vignette overlay
    this._vignette = document.createElement('div');
    this._vignette.id = 'grudgeHitVignette';
    document.body.appendChild(this._vignette);

    // Death overlay
    this._deathOverlay = document.createElement('div');
    this._deathOverlay.id = 'grudgeDeathOverlay';
    this._deathOverlay.innerHTML = `
      <div id="ghud-death-text">YOU DIED</div>
      <div id="ghud-death-sub">Press R to respawn</div>
    `;
    this._deathOverlay.style.display = 'none';
    document.body.appendChild(this._deathOverlay);

    this._updateBars();
  }

  _injectStyles() {
    if (document.getElementById('grudgeHUDStyle')) return;
    const style = document.createElement('style');
    style.id = 'grudgeHUDStyle';
    style.textContent = `
      /* ── HUD Root ─────────────────────────────── */
      #grudgeHUD {
        position: fixed;
        top: 16px;
        left: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 995;
        pointer-events: none;
        font-family: 'Cinzel', 'Georgia', serif;
      }

      /* Portrait / icon */
      #ghud-portrait {
        width: 54px; height: 54px;
        background: rgba(8,10,18,0.82);
        border: 2px solid rgba(200,169,81,0.4);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 12px rgba(0,0,0,0.8);
      }
      #ghud-race-name {
        font-size: 9px;
        letter-spacing: 1px;
        text-align: center;
      }

      /* Bars column */
      #ghud-bars {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      #ghud-hp-row, #ghud-stam-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      #ghud-hp-label, #ghud-stam-label {
        font-size: 10px;
        color: #888;
        width: 28px;
        letter-spacing: 1px;
      }

      #ghud-hp-track, #ghud-stam-track {
        position: relative;
        width: 160px;
        height: 10px;
        background: rgba(255,255,255,0.08);
        border-radius: 5px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.06);
      }

      #ghud-hp-fill {
        position: absolute;
        left: 0; top: 0; bottom: 0;
        border-radius: 5px;
        transition: width 0.25s ease;
      }

      /* Delayed damage indicator (YAZH health bar pattern) */
      #ghud-hp-damage {
        position: absolute;
        left: 0; top: 0; bottom: 0;
        background: rgba(200, 50, 50, 0.55);
        border-radius: 5px;
        transition: width 0.8s ease 0.4s;
      }

      #ghud-stam-fill {
        position: absolute;
        left: 0; top: 0; bottom: 0;
        background: linear-gradient(90deg, #7ecfb3aa, #7ecfb3);
        border-radius: 5px;
        transition: width 0.2s ease;
        box-shadow: 0 0 6px #7ecfb366;
      }

      #ghud-hp-value {
        font-size: 10px;
        color: #ccc;
        width: 62px;
        letter-spacing: 0.5px;
      }
      #ghud-stam-value {
        font-size: 10px;
        color: #7ecfb3;
        width: 28px;
      }

      /* Status pills */
      #ghud-status {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .ghud-status-pill {
        font-size: 9px;
        color: #fff;
        background: rgba(200,169,81,0.2);
        border: 1px solid rgba(200,169,81,0.4);
        border-radius: 10px;
        padding: 2px 8px;
        letter-spacing: 1px;
        animation: ghud-pulse 1s ease infinite;
      }
      @keyframes ghud-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.6; }
      }

      /* Hit vignette (YAZH: red flash on damage) */
      #grudgeHitVignette {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 994;
        background: radial-gradient(ellipse at center,
          transparent 55%,
          rgba(180,0,0,0.45) 100%);
        opacity: 0;
        transition: opacity 0.08s ease;
      }
      #grudgeHitVignette.active {
        opacity: 1;
        transition: opacity 0s;
      }
      #grudgeHitVignette.fade {
        opacity: 0;
        transition: opacity 0.5s ease;
      }

      /* Critical HP pulse */
      #grudgeHUD.critical #ghud-hp-fill {
        animation: ghud-critical 0.5s ease infinite alternate;
      }
      @keyframes ghud-critical {
        from { filter: brightness(1); }
        to   { filter: brightness(2) saturate(2); }
      }

      /* Death overlay */
      #grudgeDeathOverlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.75);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: ghud-death-fade 1.5s ease;
      }
      @keyframes ghud-death-fade {
        from { opacity: 0; background: rgba(120,0,0,0.8); }
        to   { opacity: 1; background: rgba(0,0,0,0.75); }
      }
      #ghud-death-text {
        font-family: 'Cinzel', 'Georgia', serif;
        font-size: 64px;
        color: #c8a951;
        letter-spacing: 12px;
        text-shadow: 0 0 40px #c8a95188;
        animation: ghud-death-glow 2s ease infinite alternate;
      }
      @keyframes ghud-death-glow {
        from { text-shadow: 0 0 30px #c8a95144; }
        to   { text-shadow: 0 0 80px #c8a951cc; }
      }
      #ghud-death-sub {
        font-family: monospace;
        font-size: 14px;
        color: #888;
        letter-spacing: 3px;
        margin-top: 20px;
      }

      /* Mobile: move to bottom center */
      @media (max-width: 640px) {
        #grudgeHUD {
          left: 50%; bottom: 16px;
          transform: translateX(-50%);
          flex-direction: column;
          align-items: center;
        }
        #ghud-hp-track, #ghud-stam-track { width: 220px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Update health bar.
   * @param {number} hp
   * @param {number} [maxHp]
   */
  setHealth(hp, maxHp) {
    if (maxHp !== undefined) this._maxHP = maxHp;
    const prev = this._hp;
    this._hp = Math.max(0, Math.min(hp, this._maxHP));

    this._updateBars();

    // Critical HP class
    const pct = this._hp / this._maxHP;
    this._root.classList.toggle('critical', pct < 0.25);

    // Delayed damage bar
    if (hp < prev) {
      const prevPct = (prev / this._maxHP) * 100;
      this._hpDamage.style.width = prevPct + '%';
      clearTimeout(this._damageTimer);
      this._damageTimer = setTimeout(() => {
        this._hpDamage.style.width = (this._hp / this._maxHP * 100) + '%';
      }, 50);
    }
  }

  /**
   * Update stamina bar.
   * @param {number} stam
   * @param {number} [maxStam]
   */
  setStamina(stam, maxStam) {
    if (maxStam !== undefined) this._maxStam = maxStam;
    this._stam = Math.max(0, Math.min(stam, this._maxStam));
    this._updateBars();
  }

  /**
   * Flash red vignette on hit (YAZH's headAnimation pattern).
   * @param {number} [duration=500] ms
   */
  flashHit(duration = 500) {
    this._vignette.classList.remove('active', 'fade');
    requestAnimationFrame(() => {
      this._vignette.classList.add('active');
      setTimeout(() => {
        this._vignette.classList.remove('active');
        this._vignette.classList.add('fade');
      }, 100);
    });
  }

  /** Show death screen */
  showDeath() {
    this._deathOverlay.style.display = 'flex';
  }

  /** Hide death screen (on respawn) */
  hideDeathScreen() {
    this._deathOverlay.style.display = 'none';
  }

  /**
   * Show a status pill (e.g. 'BLOCKING', 'CASTING').
   * Auto-removes after duration.
   * @param {string} text
   * @param {number} [duration=2000]
   */
  showStatus(text, duration = 2000) {
    const pill = document.createElement('div');
    pill.className = 'ghud-status-pill';
    pill.textContent = text;
    this._status.appendChild(pill);
    setTimeout(() => pill.remove(), duration);
  }

  /**
   * Update the race name and faction color (after race switch).
   * @param {string} raceName
   * @param {string} factionColor  - CSS color
   */
  setRace(raceName, factionColor) {
    this._race  = raceName;
    this._color = factionColor;
    this._root.querySelector('#ghud-race-name').textContent = raceName.toUpperCase();
    this._root.querySelector('#ghud-race-name').style.color = factionColor;
    this._hpFill.style.background = `linear-gradient(90deg, ${factionColor}cc, ${factionColor})`;
    this._hpFill.style.boxShadow  = `0 0 10px ${factionColor}66`;
  }

  setVisible(v) { this._root.style.display = v ? 'flex' : 'none'; }

  dispose() {
    this._root.remove();
    this._vignette.remove();
    this._deathOverlay.remove();
    clearTimeout(this._damageTimer);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _updateBars() {
    const hpPct   = (this._hp   / this._maxHP)   * 100;
    const stamPct = (this._stam / this._maxStam) * 100;

    this._hpFill.style.width   = hpPct   + '%';
    this._stamFill.style.width = stamPct + '%';

    this._hpValue.textContent   = `${Math.round(this._hp)} / ${this._maxHP}`;
    this._stamValue.textContent = Math.round(this._stam);
  }
}
