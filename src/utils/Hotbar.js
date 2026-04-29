/**
 * Hotbar.js
 * Populates the #toolBar div in index.html with the 4 spell slots that
 * movement.js currently binds:
 *
 *   1 \u2192 Thunderball     (requires tab-target)
 *   2 \u2192 Triple Orb AOE
 *   4 \u2192 Combo strike
 *   5 \u2192 Heavy Swing      (requires tab-target)
 *
 * Slot 3 is reserved for a future skill. Slot R is mapped to the SelfCast
 * animation. The hotbar is purely cosmetic + accessibility \u2014 the actual
 * keybindings remain in movement.js. Buttons forward keyboard events
 * synthetically so mouse users can play.
 */

const SLOTS = [
  { key: '1', label: 'Thunder',  glyph: '\u26A1', desc: 'Thunderball (target)'  },
  { key: '2', label: 'Orbs',     glyph: '\u2728', desc: 'Triple Orb AOE'        },
  { key: '4', label: 'Combo',    glyph: '\u2694',  desc: 'Combo strike'          },
  { key: '5', label: 'Heavy',    glyph: '\uD83D\uDCA5', desc: 'Heavy Swing (target)' },
  { key: 'r', label: 'Cast',     glyph: '\uD83C\uDF00', desc: 'Self-cast'            },
];

let _built = false;

export function buildHotbar() {
  if (_built) return;
  _built = true;

  const bar = document.getElementById('toolBar');
  if (!bar) return;

  // Style overrides scoped to the hotbar
  if (!document.getElementById('grudgeHotbarStyle')) {
    const style = document.createElement('style');
    style.id = 'grudgeHotbarStyle';
    style.textContent = `
      #toolBar { gap: 8px !important; pointer-events: none; }
      .ghud-slot {
        pointer-events: auto;
        width: 56px; height: 56px;
        background: rgba(8,10,18,0.78);
        border: 1px solid rgba(200,169,81,0.35);
        border-radius: 8px;
        color: #c8a951;
        font-family: 'Cinzel','Georgia',serif;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        cursor: pointer; user-select: none;
        position: relative;
        transition: transform 0.1s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .ghud-slot:hover {
        border-color: rgba(200,169,81,0.85);
        box-shadow: 0 0 10px rgba(200,169,81,0.45),
                    inset 0 0 10px rgba(200,169,81,0.25);
      }
      .ghud-slot.active {
        transform: scale(0.92);
        border-color: #f5ca56;
        box-shadow: 0 0 14px #f5ca56cc, inset 0 0 14px #f5ca5666;
      }
      .ghud-slot .glyph { font-size: 22px; line-height: 1; }
      .ghud-slot .label { font-size: 9px; letter-spacing: 1px; opacity: 0.85; }
      .ghud-slot .key {
        position: absolute; top: 2px; right: 4px;
        font-size: 10px; color: #c8a951aa; font-family: monospace;
      }
    `;
    document.head.appendChild(style);
  }

  for (const slot of SLOTS) {
    const btn = document.createElement('div');
    btn.className = 'ghud-slot';
    btn.title = slot.desc;
    btn.innerHTML = `
      <span class="key">${slot.key.toUpperCase()}</span>
      <span class="glyph">${slot.glyph}</span>
      <span class="label">${slot.label.toUpperCase()}</span>
    `;
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      _flash(btn);
      // Synthesize a keydown so the existing movement.js handlers fire
      window.dispatchEvent(new KeyboardEvent('keydown', { key: slot.key }));
    });
    bar.appendChild(btn);
  }

  // Visually flash the slot when its key is pressed via keyboard
  window.addEventListener('keydown', (e) => {
    const idx = SLOTS.findIndex(s => s.key.toLowerCase() === (e.key || '').toLowerCase());
    if (idx >= 0) _flash(bar.children[idx]);
  });
}

function _flash(el) {
  if (!el) return;
  el.classList.add('active');
  clearTimeout(el._flashT);
  el._flashT = setTimeout(() => el.classList.remove('active'), 180);
}
