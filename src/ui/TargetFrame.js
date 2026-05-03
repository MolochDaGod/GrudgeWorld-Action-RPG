/**
 * TargetFrame.js
 * Grudge Warlords — Enemy target frame
 *
 * Appears top-center when Tab selects an enemy.
 * Shows name, level, HP bar, and entity type badge.
 * Updates every frame from PLAYER.target.health.
 *
 * Styled to match UIlayer.html gold/stone WCS theme.
 */

export class TargetFrame {
  constructor(scene) {
    this._scene = scene;
    this._target = null;
    this._visible = false;
    this._build();
    this._startPolling();
  }

  _build() {
    if (document.getElementById('grudgeTargetFrame')) return;

    const style = document.createElement('style');
    style.id = 'grudgeTargetFrameStyle';
    style.textContent = `
      #grudgeTargetFrame {
        position:fixed; top:16px; left:50%; transform:translateX(-50%);
        display:none; align-items:center; gap:10px;
        background:linear-gradient(180deg,rgba(14,10,8,0.92),rgba(8,6,4,0.88));
        border:1px solid rgba(200,169,81,0.35); border-radius:10px;
        padding:8px 14px 8px 10px; z-index:996; pointer-events:none;
        box-shadow:0 4px 20px rgba(0,0,0,0.7), inset 0 0 12px rgba(0,0,0,0.3);
        font-family:'Cinzel','Georgia',serif; min-width:220px;
        backdrop-filter:blur(6px);
      }
      #grudgeTargetFrame.visible { display:flex; }

      /* Rivets */
      #grudgeTargetFrame::before, #grudgeTargetFrame::after {
        content:''; position:absolute; width:5px; height:5px;
        background:#c8a951; border:1px solid #fff; box-shadow:0 0 3px #c8a951;
        border-radius:1px;
      }
      #grudgeTargetFrame::before { top:3px; left:3px; }
      #grudgeTargetFrame::after  { top:3px; right:3px; }

      /* Portrait */
      .tf-portrait {
        width:42px; height:42px; border-radius:8px; flex-shrink:0;
        background:radial-gradient(circle,rgba(212,80,80,0.15),rgba(8,6,4,0.6));
        border:2px solid rgba(212,80,80,0.4);
        display:flex; align-items:center; justify-content:center;
        font-size:20px;
        box-shadow:inset 0 0 8px rgba(0,0,0,0.5);
      }

      /* Info column */
      .tf-info { flex:1; min-width:0; }
      .tf-name-row { display:flex; align-items:center; gap:6px; }
      .tf-name {
        font-size:12px; font-weight:700; color:#e8e0d0;
        letter-spacing:0.5px; white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis;
      }
      .tf-level {
        font-size:9px; font-weight:700; color:#c8a951;
        background:rgba(200,169,81,0.12); border:1px solid rgba(200,169,81,0.25);
        border-radius:4px; padding:1px 5px; letter-spacing:0.5px;
        flex-shrink:0;
      }
      .tf-type {
        font-size:8px; font-weight:800; text-transform:uppercase;
        letter-spacing:0.8px; margin-top:2px;
        color:#d45050; opacity:0.8;
      }

      /* HP bar */
      .tf-hp-track {
        position:relative; width:100%; height:8px; margin-top:5px;
        background:rgba(255,255,255,0.06); border-radius:4px;
        overflow:hidden; border:1px solid rgba(255,255,255,0.04);
      }
      .tf-hp-fill {
        position:absolute; left:0; top:0; bottom:0; border-radius:4px;
        background:linear-gradient(90deg,#7a1515,#d44040);
        transition:width 0.2s ease;
        box-shadow:0 0 6px rgba(212,64,64,0.4);
      }
      .tf-hp-text {
        position:absolute; inset:0; text-align:center;
        font-size:7px; line-height:8px; color:rgba(255,255,255,0.85);
        font-family:monospace; text-shadow:0 1px 2px #000;
      }
    `;
    document.head.appendChild(style);

    this._root = document.createElement('div');
    this._root.id = 'grudgeTargetFrame';
    this._root.innerHTML = `
      <div class="tf-portrait" id="tf-portrait">🎯</div>
      <div class="tf-info">
        <div class="tf-name-row">
          <span class="tf-name" id="tf-name">—</span>
          <span class="tf-level" id="tf-level">Lv.?</span>
        </div>
        <div class="tf-type" id="tf-type">ENEMY</div>
        <div class="tf-hp-track">
          <div class="tf-hp-fill" id="tf-hp-fill" style="width:100%"></div>
          <div class="tf-hp-text" id="tf-hp-text">? / ?</div>
        </div>
      </div>
    `;
    document.body.appendChild(this._root);

    this._elName   = this._root.querySelector('#tf-name');
    this._elLevel  = this._root.querySelector('#tf-level');
    this._elType   = this._root.querySelector('#tf-type');
    this._elHpFill = this._root.querySelector('#tf-hp-fill');
    this._elHpText = this._root.querySelector('#tf-hp-text');
    this._elPortrait = this._root.querySelector('#tf-portrait');
  }

  /** Poll PLAYER.target every frame to update the target frame */
  _startPolling() {
    this._obs = this._scene.onBeforeRenderObservable.add(() => {
      const target = (typeof PLAYER !== 'undefined') ? PLAYER.target : null;
      if (target && target.health && target.health.isAlive) {
        this._show(target);
      } else {
        this._hide();
      }
    });
  }

  _show(target) {
    if (!this._visible) {
      this._root.classList.add('visible');
      this._visible = true;
    }

    const h = target.health;
    const hp = h.health;
    const max = h.maxHealth;
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));

    this._elName.textContent = h.name || 'Enemy';
    this._elLevel.textContent = `Lv.${target.level || '?'}`;
    this._elHpFill.style.width = pct + '%';
    this._elHpText.textContent = `${Math.round(hp)} / ${max}`;

    // Color the bar based on HP percentage
    if (pct < 25) {
      this._elHpFill.style.background = 'linear-gradient(90deg,#5a0a0a,#cc2020)';
    } else if (pct < 50) {
      this._elHpFill.style.background = 'linear-gradient(90deg,#7a3515,#d48040)';
    } else {
      this._elHpFill.style.background = 'linear-gradient(90deg,#7a1515,#d44040)';
    }
  }

  _hide() {
    if (this._visible) {
      this._root.classList.remove('visible');
      this._visible = false;
    }
  }

  dispose() {
    if (this._obs) this._scene.onBeforeRenderObservable.remove(this._obs);
    this._root?.remove();
    document.getElementById('grudgeTargetFrameStyle')?.remove();
  }
}
