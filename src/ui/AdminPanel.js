/**
 * AdminPanel.js
 * Grudge Warlords — Admin / Object Storage browser panel.
 *
 * Toggle: P key (or ?debug=true URL param auto-opens).
 * Connects to Grudge ObjectStore APIs via grudgeSDK.js.
 *
 * Categories:
 *   - Weapons   (master-items.json filtered by type=weapon)
 *   - Armor     (master-items.json filtered by type=armor)
 *   - Items     (full master-items.json)
 *   - Recipes   (master-recipes.json)
 *   - Materials (master-materials.json)
 *   - Races     (races.json)
 *   - Classes   (classes.json)
 *   - Factions  (factions.json)
 *
 * Features:
 *   - Live search/filter within loaded data
 *   - Item detail expand with stats, lore, UUID
 *   - Copy UUID to clipboard
 *   - Links to grudge-crafting.puter.site and info.grudge-studio.com
 */

import { GrudgeSDK } from '../lib/grudgeSDK.js';

export class AdminPanel {
  constructor() {
    this._open = false;
    this._data = {};       // cached category data
    this._activeTab = 'weapons';
    this._search = '';
    this._build();
    this._wireToggle();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════════════════

  _build() {
    if (document.getElementById('grudgeAdmin')) return;

    const s = document.createElement('style');
    s.id = 'grudgeAdminStyle';
    s.textContent = `
      #grudgeAdmin {
        position:fixed; top:0; right:0; width:420px; height:100vh;
        display:none; flex-direction:column;
        background:linear-gradient(180deg,rgba(14,10,8,0.96),rgba(8,6,4,0.94));
        border-left:1px solid rgba(200,169,81,0.3);
        z-index:10100; font-family:'Cinzel','Georgia',serif;
        box-shadow:-8px 0 40px rgba(0,0,0,0.7);
        backdrop-filter:blur(8px);
      }
      #grudgeAdmin.open { display:flex; }

      /* Header */
      .ap-header {
        display:flex; align-items:center; gap:10px;
        padding:14px 16px; flex-shrink:0;
        border-bottom:1px solid rgba(200,169,81,0.2);
        background:linear-gradient(90deg,rgba(200,169,81,0.06),transparent);
      }
      .ap-title {
        flex:1; font-size:12px; font-weight:700; color:#c8a951;
        letter-spacing:3px; text-transform:uppercase;
      }
      .ap-links { display:flex; gap:6px; }
      .ap-link {
        font-size:8px; padding:3px 8px; border-radius:4px; cursor:pointer;
        background:rgba(200,169,81,0.08); border:1px solid rgba(200,169,81,0.2);
        color:#c8a951; text-decoration:none; letter-spacing:0.5px;
        font-family:'Cinzel',serif; transition:0.15s;
      }
      .ap-link:hover { background:rgba(200,169,81,0.2); border-color:#c8a951; }
      .ap-close {
        cursor:pointer; color:#555; font-size:16px; padding:2px 6px;
        border-radius:4px; transition:0.15s; background:none; border:none;
      }
      .ap-close:hover { color:#c8a951; background:rgba(200,169,81,0.1); }

      /* Tabs */
      .ap-tabs {
        display:flex; flex-wrap:wrap; gap:2px; padding:8px 12px;
        border-bottom:1px solid rgba(200,169,81,0.1);
        background:rgba(0,0,0,0.15); flex-shrink:0;
      }
      .ap-tab {
        padding:5px 10px; font-size:9px; font-weight:700; letter-spacing:1px;
        text-transform:uppercase; color:#555; cursor:pointer;
        border:1px solid transparent; border-radius:4px;
        background:none; font-family:inherit; transition:0.15s;
      }
      .ap-tab:hover { color:#ccc; border-color:rgba(200,169,81,0.2); }
      .ap-tab.active {
        color:#c8a951; border-color:rgba(200,169,81,0.3);
        background:rgba(200,169,81,0.06);
      }

      /* Search */
      .ap-search-row {
        display:flex; padding:8px 12px; gap:8px;
        border-bottom:1px solid rgba(200,169,81,0.06); flex-shrink:0;
      }
      .ap-search {
        flex:1; padding:6px 10px; font-size:11px;
        background:rgba(0,0,0,0.3); border:1px solid rgba(200,169,81,0.15);
        border-radius:5px; color:#ddd; outline:none;
        font-family:'Cinzel',serif; letter-spacing:0.5px;
      }
      .ap-search::placeholder { color:#444; }
      .ap-search:focus { border-color:rgba(200,169,81,0.4); }
      .ap-count {
        font-size:9px; color:#555; display:flex; align-items:center;
        letter-spacing:1px; font-family:monospace;
      }

      /* Results list */
      .ap-results {
        flex:1; overflow-y:auto; padding:8px 12px;
        scrollbar-width:thin; scrollbar-color:#c8a951 #111;
      }
      .ap-results::-webkit-scrollbar { width:4px; }
      .ap-results::-webkit-scrollbar-thumb { background:#c8a951; border-radius:2px; }

      .ap-loading {
        text-align:center; padding:40px; color:#444;
        font-size:10px; letter-spacing:2px;
      }

      /* Item card */
      .ap-item {
        padding:8px 10px; margin-bottom:4px;
        background:rgba(16,18,30,0.6); border:1px solid rgba(255,255,255,0.03);
        border-radius:6px; cursor:pointer; transition:0.15s;
      }
      .ap-item:hover { border-color:rgba(200,169,81,0.2); background:rgba(200,169,81,0.03); }
      .ap-item.expanded { border-color:rgba(200,169,81,0.3); background:rgba(200,169,81,0.05); }

      .ap-item-head { display:flex; align-items:center; gap:8px; }
      .ap-item-icon {
        width:28px; height:28px; border-radius:6px; flex-shrink:0;
        background:rgba(200,169,81,0.08); border:1px solid rgba(200,169,81,0.1);
        display:flex; align-items:center; justify-content:center;
        font-size:14px;
      }
      .ap-item-name { font-size:11px; color:#ddd; font-weight:700; letter-spacing:0.3px; flex:1; }
      .ap-item-tier {
        font-size:8px; padding:2px 6px; border-radius:3px;
        font-weight:700; letter-spacing:0.5px; flex-shrink:0;
      }
      .ap-item-type { font-size:8px; color:#555; margin-top:2px; letter-spacing:0.5px; }

      /* Expanded detail */
      .ap-detail { display:none; margin-top:8px; padding-top:8px; border-top:1px solid rgba(200,169,81,0.06); }
      .ap-item.expanded .ap-detail { display:block; }
      .ap-detail-row {
        display:flex; justify-content:space-between; padding:2px 0;
        font-size:10px;
      }
      .ap-detail-key { color:#6b5535; letter-spacing:0.5px; }
      .ap-detail-val { color:#c8a951; font-family:monospace; font-size:9px; }
      .ap-detail-lore {
        font-size:10px; color:#8a7a60; font-style:italic;
        line-height:1.5; margin:6px 0;
        font-family:Georgia,'Times New Roman',serif;
      }
      .ap-uuid {
        font-size:8px; color:#444; font-family:monospace;
        cursor:pointer; padding:2px 4px; border-radius:3px;
        transition:0.15s; margin-top:4px; display:inline-block;
      }
      .ap-uuid:hover { color:#c8a951; background:rgba(200,169,81,0.08); }
      .ap-uuid.copied { color:#6ec96e; }
    `;
    document.head.appendChild(s);

    this._root = document.createElement('div');
    this._root.id = 'grudgeAdmin';
    this._root.innerHTML = `
      <div class="ap-header">
        <span class="ap-title">⚙ Admin Panel</span>
        <div class="ap-links">
          <a class="ap-link" href="${GrudgeSDK.craftingUrl()}" target="_blank">Crafting</a>
          <a class="ap-link" href="${GrudgeSDK.infoUrl()}" target="_blank">Info Hub</a>
        </div>
        <button class="ap-close" id="ap-close">✕</button>
      </div>
      <div class="ap-tabs" id="ap-tabs"></div>
      <div class="ap-search-row">
        <input class="ap-search" id="ap-search" placeholder="Search items, weapons, recipes…" />
        <span class="ap-count" id="ap-count">—</span>
      </div>
      <div class="ap-results" id="ap-results">
        <div class="ap-loading">Press a category tab to load data</div>
      </div>
    `;
    document.body.appendChild(this._root);

    this._root.querySelector('#ap-close').addEventListener('click', () => this.close());
    this._root.querySelector('#ap-search').addEventListener('input', (e) => {
      this._search = e.target.value.toLowerCase();
      this._renderResults();
    });

    this._buildTabs();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TABS
  // ═══════════════════════════════════════════════════════════════════════════

  _buildTabs() {
    const TABS = [
      { key: 'weapons',   label: 'Weapons',   icon: '⚔' },
      { key: 'armor',     label: 'Armor',     icon: '🛡' },
      { key: 'items',     label: 'All Items', icon: '📦' },
      { key: 'recipes',   label: 'Recipes',   icon: '🔨' },
      { key: 'materials', label: 'Materials', icon: '💎' },
      { key: 'races',     label: 'Races',     icon: '👤' },
      { key: 'classes',   label: 'Classes',   icon: '⚔' },
      { key: 'factions',  label: 'Factions',  icon: '🏰' },
    ];

    const container = this._root.querySelector('#ap-tabs');
    container.innerHTML = '';
    for (const tab of TABS) {
      const btn = document.createElement('button');
      btn.className = 'ap-tab' + (tab.key === this._activeTab ? ' active' : '');
      btn.textContent = `${tab.icon} ${tab.label}`;
      btn.dataset.key = tab.key;
      btn.addEventListener('click', () => this._selectTab(tab.key));
      container.appendChild(btn);
    }
  }

  async _selectTab(key) {
    this._activeTab = key;
    this._root.querySelectorAll('.ap-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.key === key));
    this._search = '';
    this._root.querySelector('#ap-search').value = '';

    if (!this._data[key]) {
      this._showLoading();
      this._data[key] = await this._fetchCategory(key);
    }
    this._renderResults();
  }

  async _fetchCategory(key) {
    switch (key) {
      case 'weapons': {
        const d = await GrudgeSDK.fetchMasterItems();
        const items = Array.isArray(d) ? d : (d?.items || Object.values(d || {}));
        return items.filter(i => i.type === 'weapon');
      }
      case 'armor': {
        const d = await GrudgeSDK.fetchMasterItems();
        const items = Array.isArray(d) ? d : (d?.items || Object.values(d || {}));
        return items.filter(i => i.type === 'armor');
      }
      case 'items': {
        const d = await GrudgeSDK.fetchMasterItems();
        return Array.isArray(d) ? d : (d?.items || Object.values(d || {}));
      }
      case 'recipes':   return this._flatten(await GrudgeSDK.fetchMasterRecipes());
      case 'materials': return this._flatten(await GrudgeSDK.fetchMasterMaterials());
      case 'races': {
        const d = await GrudgeSDK.fetchRaces();
        return Object.values(d?.races || d || {});
      }
      case 'classes': {
        const d = await GrudgeSDK.fetchClasses();
        return Object.values(d?.classes || d || {});
      }
      case 'factions': {
        const d = await GrudgeSDK.fetchFactions();
        return Object.values(d?.factions || d || {});
      }
      default: return [];
    }
  }

  _flatten(d) {
    if (Array.isArray(d)) return d;
    if (!d || typeof d !== 'object') return [];
    // Handle nested structures: { categories: { swords: { items: [...] } } }
    const flat = [];
    const walk = (obj) => {
      if (Array.isArray(obj)) { flat.push(...obj); return; }
      if (typeof obj === 'object') {
        for (const v of Object.values(obj)) {
          if (Array.isArray(v)) flat.push(...v);
          else if (v && typeof v === 'object') {
            if (v.items) flat.push(...v.items);
            else if (v.id || v.uuid || v.name) flat.push(v);
            else walk(v);
          }
        }
      }
    };
    walk(d);
    return flat.length > 0 ? flat : Object.values(d);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  _showLoading() {
    this._root.querySelector('#ap-results').innerHTML =
      '<div class="ap-loading">Loading from ObjectStore…</div>';
    this._root.querySelector('#ap-count').textContent = '—';
  }

  _renderResults() {
    const container = this._root.querySelector('#ap-results');
    const items = this._data[this._activeTab] || [];

    if (!items.length) {
      container.innerHTML = '<div class="ap-loading">No data loaded</div>';
      this._root.querySelector('#ap-count').textContent = '0';
      return;
    }

    // Filter
    const filtered = this._search
      ? items.filter(i => {
          const str = JSON.stringify(i).toLowerCase();
          return str.includes(this._search);
        })
      : items;

    this._root.querySelector('#ap-count').textContent = `${filtered.length}`;

    // Render (cap at 200 for performance)
    const show = filtered.slice(0, 200);
    let html = '';
    for (const item of show) {
      html += this._renderItem(item);
    }
    if (filtered.length > 200) {
      html += `<div class="ap-loading">${filtered.length - 200} more — refine search</div>`;
    }
    container.innerHTML = html;

    // Wire expand
    container.querySelectorAll('.ap-item').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('expanded'));
    });

    // Wire UUID copy
    container.querySelectorAll('.ap-uuid').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(el.textContent).then(() => {
          el.classList.add('copied');
          setTimeout(() => el.classList.remove('copied'), 1000);
        });
      });
    });
  }

  _renderItem(item) {
    const name = item.name || item.id || '???';
    const type = item.type || item.category || item.faction || '';
    const tier = item.tier ?? item.tierLabel ?? '';
    const uuid = item.uuid || item.id || '';
    const lore = item.lore || item.description || '';
    const emoji = item.emoji || item.icon || this._typeEmoji(type);

    // Tier color
    const TIER_COLORS = {
      1:'#9ca3af', 2:'#6ec96e', 3:'#5a9ad8', 4:'#a87ddb',
      5:'#d4a400', 6:'#ef4444', 7:'#ff6b6b', 8:'#ffd700',
    };
    const tierColor = TIER_COLORS[tier] || '#555';
    const tierLabel = tier ? `T${tier}` : '';

    // Stats
    const stats = item.stats || item.bonuses || item.startingAttributes || {};
    const statsHtml = Object.entries(stats).map(([k, v]) =>
      `<div class="ap-detail-row"><span class="ap-detail-key">${k}</span><span class="ap-detail-val">${v}</span></div>`
    ).join('');

    // Abilities (for classes)
    const abilities = item.abilities || [];
    const abilitiesHtml = abilities.length > 0
      ? `<div class="ap-detail-row"><span class="ap-detail-key">Abilities</span><span class="ap-detail-val">${abilities.length}</span></div>`
      : '';

    return `
      <div class="ap-item">
        <div class="ap-item-head">
          <div class="ap-item-icon">${emoji}</div>
          <div style="flex:1;min-width:0;">
            <div class="ap-item-name">${name}</div>
            <div class="ap-item-type">${type}</div>
          </div>
          ${tierLabel ? `<span class="ap-item-tier" style="color:${tierColor};border:1px solid ${tierColor}40;background:${tierColor}10;">${tierLabel}</span>` : ''}
        </div>
        <div class="ap-detail">
          ${lore ? `<div class="ap-detail-lore">${lore}</div>` : ''}
          ${statsHtml}
          ${abilitiesHtml}
          ${item.source ? `<div class="ap-detail-row"><span class="ap-detail-key">Source</span><span class="ap-detail-val">${item.source}</span></div>` : ''}
          ${item.weaponTypes ? `<div class="ap-detail-row"><span class="ap-detail-key">Weapons</span><span class="ap-detail-val">${item.weaponTypes.join(', ')}</span></div>` : ''}
          ${uuid ? `<div class="ap-uuid" title="Click to copy UUID">${uuid}</div>` : ''}
        </div>
      </div>`;
  }

  _typeEmoji(type) {
    const MAP = {
      weapon:'⚔', armor:'🛡', food:'🍖', potion:'🧪',
      sword:'⚔', axe:'🪓', bow:'🏹', staff:'🪄', hammer:'🔨',
      shield:'🛡', spear:'🔱', dagger:'🗡',
      crusade:'🏰', fabled:'🌿', legion:'💀',
      warrior:'⚔', mage:'🔮', ranger:'🏹', worge:'🐺',
      human:'👤', elf:'🧝', dwarf:'⛏', orc:'👹', undead:'💀', barbarian:'🪓',
    };
    return MAP[type?.toLowerCase()] || '📄';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOGGLE
  // ═══════════════════════════════════════════════════════════════════════════

  _wireToggle() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Auto-open on ?debug=true
    if (new URLSearchParams(window.location.search).get('debug') === 'true') {
      setTimeout(() => this.open(), 500);
    }
  }

  open() {
    this._open = true;
    this._root.classList.add('open');
    if (!this._data[this._activeTab]) this._selectTab(this._activeTab);
  }

  close() {
    this._open = false;
    this._root.classList.remove('open');
  }

  toggle() { this._open ? this.close() : this.open(); }
  get isOpen() { return this._open; }

  dispose() {
    this._root?.remove();
    document.getElementById('grudgeAdminStyle')?.remove();
  }
}
