/**
 * grudgeSDK.js — Grudge Studio ObjectStore Client
 *
 * Fetches real game data from production ObjectStore APIs.
 * No placeholders — all data comes from:
 *   - https://molochdagod.github.io/ObjectStore/api/v1/*.json  (JSON game data)
 *   - https://assets.grudge-studio.com                          (R2 CDN for images/models)
 *   - https://objectstore.grudge-studio.com                     (Worker API for queries)
 *   - https://api.grudge-studio.com                             (Game API backend)
 *
 * In-memory cache with 5-minute TTL. Graceful fallback if offline.
 *
 * Primary endpoint: Cloudflare R2 CDN (assets.grudge-studio.com/api/v1)
 * D1 Worker:        objectstore.grudge-studio.com
 * Fallback:         molochdagod.github.io/ObjectStore/api/v1 (GitHub Pages)
 */

// ── Endpoints ────────────────────────────────────────────────────────────────

const OBJECTSTORE_API = 'https://assets.grudge-studio.com/api/v1';
const ASSETS_CDN      = 'https://assets.grudge-studio.com';
const WORKER_API      = 'https://objectstore.grudge-studio.com';
const GAME_API        = 'https://api.grudge-studio.com';
const INFO_HUB        = 'https://info.grudge-studio.com';
const CRAFTING_APP    = 'https://grudge-crafting.puter.site';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_FETCH_RETRIES = 2;

const CORE_FALLBACK = {
  races: {
    human: { id: 'human', name: 'Human', faction: 'crusade', bonuses: { Strength: 2, Vitality: 2 } },
    barbarian: { id: 'barbarian', name: 'Barbarian', faction: 'crusade', bonuses: { Strength: 3, Endurance: 2 } },
    elf: { id: 'elf', name: 'Elf', faction: 'fabled', bonuses: { Dexterity: 3, Wisdom: 1 } },
    dwarf: { id: 'dwarf', name: 'Dwarf', faction: 'fabled', bonuses: { Vitality: 3, Strength: 1 } },
    orc: { id: 'orc', name: 'Orc', faction: 'legion', bonuses: { Strength: 3, Endurance: 3 } },
    undead: { id: 'undead', name: 'Undead', faction: 'legion', bonuses: { Intellect: 2, Endurance: 3 } },
  },
  classes: {
    warrior: {
      id: 'warrior', name: 'Warrior', emoji: '⚔',
      description: 'Frontline melee combatant.',
      weaponTypes: ['sword', 'axe', 'hammer', 'spear', 'shield'],
      startingAttributes: { Strength: 3, Vitality: 2, Endurance: 2 },
    },
    ranger: {
      id: 'ranger', name: 'Ranger', emoji: '🏹',
      description: 'Mobile ranged specialist.',
      weaponTypes: ['bow', 'spear'],
      startingAttributes: { Dexterity: 3, Agility: 2, Wisdom: 1 },
    },
    mage: {
      id: 'mage', name: 'Mage', emoji: '🔮',
      description: 'Arcane caster with burst damage.',
      weaponTypes: ['staff'],
      startingAttributes: { Intellect: 3, Wisdom: 2, Tactics: 1 },
    },
    worge: {
      id: 'worge', name: 'Worge', emoji: '🐺',
      description: 'Ferocious shapeshifting bruiser.',
      weaponTypes: ['sword', 'axe', 'hammer'],
      startingAttributes: { Strength: 2, Agility: 2, Endurance: 2 },
    },
  },
  factions: {
    crusade: { id: 'crusade', name: 'Crusade' },
    fabled: { id: 'fabled', name: 'Fabled' },
    legion: { id: 'legion', name: 'Legion' },
  },
  attributes: {
    Strength: { id: 'Strength', name: 'Strength' },
    Intellect: { id: 'Intellect', name: 'Intellect' },
    Vitality: { id: 'Vitality', name: 'Vitality' },
    Dexterity: { id: 'Dexterity', name: 'Dexterity' },
    Endurance: { id: 'Endurance', name: 'Endurance' },
    Wisdom: { id: 'Wisdom', name: 'Wisdom' },
    Agility: { id: 'Agility', name: 'Agility' },
    Tactics: { id: 'Tactics', name: 'Tactics' },
  },
};

// ── Cache ────────────────────────────────────────────────────────────────────

const _cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function _fetchJsonWithTimeout(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function _getCoreFallback(key) {
  switch (key) {
    case 'races': return { races: CORE_FALLBACK.races };
    case 'classes': return { classes: CORE_FALLBACK.classes };
    case 'factions': return { factions: CORE_FALLBACK.factions };
    case 'attributes': return { attributes: CORE_FALLBACK.attributes };
    default: return null;
  }
}

async function _cachedFetch(key, url, opts = {}) {
  const { fallback = null } = opts;
  const now = Date.now();
  if (_cache[key] && (now - _cache[key].ts) < CACHE_TTL) {
    return _cache[key].data;
  }

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      const data = await _fetchJsonWithTimeout(url);
      _cache[key] = { data, ts: now };
      return data;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_FETCH_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 250));
      }
    }
  }

  console.warn(`[GrudgeSDK] Fetch failed for ${key} after ${MAX_FETCH_RETRIES} attempts:`, lastErr?.message || 'unknown error');
  if (_cache[key]) return _cache[key].data;
  return fallback;
}

function _mergeMaps(fallback, remote) {
  return { ...(fallback || {}), ...(remote || {}) };
}

function _safeMap(apiData, key) {
  const remoteMap = apiData?.[key] || apiData || {};
  return _mergeMaps(CORE_FALLBACK[key], remoteMap);
}

function _safeList(apiData) {
  if (Array.isArray(apiData)) return apiData;
  if (!apiData || typeof apiData !== 'object') return [];
  return Object.values(apiData);
}

function _safeObject(apiData) {
  if (!apiData || typeof apiData !== 'object') return {};
  return apiData;
}

// ── Public API

export const GrudgeSDK = {

  /** Fetch all 6 races with factions, bonuses, lore */
  async fetchRaces() {
    return _cachedFetch('races', `${OBJECTSTORE_API}/races.json`, { fallback: _getCoreFallback('races') });
  },

  /** Fetch all 4 classes with abilities, weapon types, starting attrs */
  async fetchClasses() {
    return _cachedFetch('classes', `${OBJECTSTORE_API}/classes.json`, { fallback: _getCoreFallback('classes') });
  },

  /** Fetch 8 attribute definitions (Strength, Intellect, etc.) */
  async fetchAttributes() {
    return _cachedFetch('attributes', `${OBJECTSTORE_API}/attributes.json`, { fallback: _getCoreFallback('attributes') });
  },

  /** Fetch faction data (Crusade, Legion, Fabled) */
  async fetchFactions() {
    return _cachedFetch('factions', `${OBJECTSTORE_API}/factions.json`, { fallback: _getCoreFallback('factions') });
  },

  /** Fetch weapon data */
  async fetchWeapons() {
    return _cachedFetch('weapons', `${OBJECTSTORE_API}/weapons.json`);
  },

  /** Fetch armor data */
  async fetchArmor() {
    return _cachedFetch('armor', `${OBJECTSTORE_API}/armor.json`);
  },

  // ── Master data (920+ items, 220 recipes, 254 materials, artifacts) ────────────

  /** Fetch all tier-expanded items with GRUDGE UUIDs */
  async fetchMasterItems() {
    return _cachedFetch('masterItems', `${OBJECTSTORE_API}/master-items.json`);
  },

  /** Fetch craft recipes with material links */
  async fetchMasterRecipes() {
    return _cachedFetch('masterRecipes', `${OBJECTSTORE_API}/master-recipes.json`);
  },

  /** Fetch crafting materials */
  async fetchMasterMaterials() {
    return _cachedFetch('masterMaterials', `${OBJECTSTORE_API}/master-materials.json`);
  },

  /** Fetch artifact catalog with discovery blocks */
  async fetchMasterArtifacts() {
    return _cachedFetch('masterArtifacts', `${OBJECTSTORE_API}/master-artifacts.json`);
  },

  /** Fetch combined UUID->entity index */
  async fetchMasterRegistry() {
    return _cachedFetch('masterRegistry', `${OBJECTSTORE_API}/master-registry.json`);
  },

  /** Fetch 8 attributes + 37 derived stats */
  async fetchMasterAttributes() {
    return _cachedFetch('masterAttributes', `${OBJECTSTORE_API}/master-attributes.json`);
  },
  /** Worker API — weapon skills for a weapon type */
  async fetchWeaponSkills(weaponType) {
    return _cachedFetch(`ws_${weaponType}`, `${WORKER_API}/v1/weapon-skills/${weaponType}`);
  },

  // ── Info hub data (alternate endpoint, same data) ─────────────────────

  /** Fetch from info hub data endpoint */
  async fetchInfoData(file) {
    return _cachedFetch(`info_${file}`, `${INFO_HUB}/data/${file}`);
  },
  /** Build CDN asset URL */
  assetUrl(path) {
    return `${ASSETS_CDN}${path.startsWith('/') ? path : '/' + path}`;
  },

  /** Game API URL builder */
  apiUrl(path) {
    return `${GAME_API}${path.startsWith('/') ? path : '/' + path}`;
  },

  /** Crafting app URL (grudge-crafting.puter.site) */
  craftingUrl() { return CRAFTING_APP; },

  /** Info hub URL (info.grudge-studio.com) */
  infoUrl(path = '') { return `${INFO_HUB}${path}`; },
  /** Prefetch core data (call on app init) */
  async prefetch() {
    const [races, classes, attrs, factions] = await Promise.allSettled([
      this.fetchRaces(),
      this.fetchClasses(),
      this.fetchAttributes(),
      this.fetchFactions(),
    ]);
    console.log('[GrudgeSDK] Prefetched:',
      races.status === 'fulfilled' ? 'races ✓' : 'races ✗',
      classes.status === 'fulfilled' ? 'classes ✓' : 'classes ✗',
      attrs.status === 'fulfilled' ? 'attrs ✓' : 'attrs ✗',
      factions.status === 'fulfilled' ? 'factions ✓' : 'factions ✗',
    );
    return {
      races: races.value ?? _getCoreFallback('races'),
      classes: classes.value ?? _getCoreFallback('classes'),
      attributes: attrs.value ?? _getCoreFallback('attributes'),
      factions: factions.value ?? _getCoreFallback('factions'),
    };
  },

  // ── Helpers: extract typed data from API responses ────────────────────────

  /** Get race map from API response: { human: {...}, elf: {...}, ... } */
  getRacesMap(apiData) {
    return _safeMap(apiData, 'races');
  },

  /** Get classes map from API response: { warrior: {...}, mage: {...}, ... } */
  getClassesMap(apiData) {
    return _safeMap(apiData, 'classes');
  },

  /** Get factions map from API response: { crusade: {...}, ... } */
  getFactionsMap(apiData) {
    return _safeMap(apiData, 'factions');
  },

  /** Get abilities array for a class from API response */
  getClassAbilities(classData) {
    return _safeList(classData?.abilities);
  },

  /** Get weapon types allowed for a class */
  getClassWeaponTypes(classData) {
    return _safeList(classData?.weaponTypes);
  },

  getCoreFallback() {
    return {
      races: _getCoreFallback('races'),
      classes: _getCoreFallback('classes'),
      attributes: _getCoreFallback('attributes'),
      factions: _getCoreFallback('factions'),
    };
  },
};

// ── Animation catalog (GLB files — converted from original FBX packs) ───────

export const ANIM_CATALOG = {
  // Base (shared across all classes)
  base: {
    label: 'Base',
    path: './assets/glb/anims/base/',
    anims: {
      idle:       { file: 'idle.glb',        label: 'Idle',        loop: true },
      combatIdle: { file: 'combat_idle.glb', label: 'Combat Idle', loop: true },
      combatRun:  { file: 'combat_run.glb',  label: 'Run',         loop: true },
      attack1:    { file: 'attack1.glb',     label: 'Attack 1',    loop: false },
      attack2:    { file: 'attack2.glb',     label: 'Attack 2',    loop: false },
      attack3:    { file: 'attack3.glb',     label: 'Attack 3',    loop: false },
      death:      { file: 'death.glb',       label: 'Death',       loop: false },
      hit:        { file: 'hit.glb',         label: 'Hit React',   loop: false },
      block:      { file: 'block.glb',       label: 'Block',       loop: true },
    },
  },

  // Pro Sword & Shield (Warrior)
  sword_shield: {
    label: 'Sword & Shield',
    path: './assets/glb/anims/sword_shield/',
    anims: {
      ss_idle:        { file: 'sword_and_shield_idle.glb',        label: 'SS Idle',     loop: true },
      ss_run:         { file: 'sword_and_shield_run.glb',         label: 'SS Run',      loop: true },
      ss_walk:        { file: 'sword_and_shield_walk.glb',        label: 'SS Walk',     loop: true },
      ss_slash1:      { file: 'sword_and_shield_slash.glb',       label: 'Slash 1',     loop: false },
      ss_slash2:      { file: 'sword_and_shield_slash__2_.glb',   label: 'Slash 2',     loop: false },
      ss_slash3:      { file: 'sword_and_shield_slash__3_.glb',   label: 'Slash 3',     loop: false },
      ss_slash4:      { file: 'sword_and_shield_slash__4_.glb',   label: 'Slash 4',     loop: false },
      ss_slash5:      { file: 'sword_and_shield_slash__5_.glb',   label: 'Slash 5',     loop: false },
      ss_attack3:     { file: 'sword_and_shield_attack__3_.glb',  label: 'Heavy Atk 1', loop: false },
      ss_attack4:     { file: 'sword_and_shield_attack__4_.glb',  label: 'Heavy Atk 2', loop: false },
      ss_block:       { file: 'sword_and_shield_block.glb',       label: 'SS Block',    loop: true },
      ss_blockIdle:   { file: 'sword_and_shield_block_idle.glb',  label: 'Block Idle',  loop: true },
      ss_kick:        { file: 'sword_and_shield_kick.glb',        label: 'Kick',        loop: false },
      ss_jump:        { file: 'sword_and_shield_jump.glb',        label: 'Jump',        loop: false },
      ss_death:       { file: 'sword_and_shield_death.glb',       label: 'SS Death',    loop: false },
      ss_crouch:      { file: 'sword_and_shield_crouch.glb',      label: 'Crouch',      loop: false },
      ss_crouchIdle:  { file: 'sword_and_shield_crouch_idle.glb', label: 'Crouch Idle', loop: true },
      ss_powerUp:     { file: 'sword_and_shield_power_up.glb',    label: 'Power Up',    loop: false },
      ss_casting:     { file: 'sword_and_shield_casting.glb',     label: 'Casting',     loop: false },
      ss_drawSword:   { file: 'draw_sword_1.glb',                 label: 'Draw Sword',  loop: false },
      ss_sheathSword: { file: 'sheath_sword_1.glb',               label: 'Sheath',      loop: false },
      ss_strafe:      { file: 'sword_and_shield_strafe.glb',      label: 'Strafe L',    loop: true },
      ss_strafe2:     { file: 'sword_and_shield_strafe__2_.glb',  label: 'Strafe R',    loop: true },
      ss_turn180:     { file: 'sword_and_shield_180_turn.glb',    label: '180 Turn',    loop: false },
    },
  },

  // Pro Longbow (Ranger)
  longbow: {
    label: 'Longbow',
    path: './assets/glb/anims/longbow/',
    anims: {
      bow_idle:       { file: 'standing_idle_01.glb',                    label: 'Bow Idle',    loop: true },
      bow_runFwd:     { file: 'standing_run_forward.glb',                label: 'Bow Run',     loop: true },
      bow_walkFwd:    { file: 'standing_walk_forward.glb',               label: 'Bow Walk',    loop: true },
      bow_aimOverdraw:{ file: 'standing_aim_overdraw.glb',               label: 'Aim',         loop: false },
      bow_aimRecoil:  { file: 'standing_aim_recoil.glb',                 label: 'Fire',        loop: false },
      bow_drawArrow:  { file: 'standing_draw_arrow.glb',                 label: 'Draw Arrow',  loop: false },
      bow_equip:      { file: 'standing_equip_bow.glb',                  label: 'Equip Bow',   loop: false },
      bow_disarm:     { file: 'standing_disarm_bow.glb',                 label: 'Disarm',      loop: false },
      bow_block:      { file: 'standing_block.glb',                      label: 'Bow Block',   loop: true },
      bow_dodgeFwd:   { file: 'standing_dodge_forward.glb',              label: 'Dodge Fwd',   loop: false },
      bow_dodgeBack:  { file: 'standing_dodge_backward.glb',             label: 'Dodge Back',  loop: false },
      bow_dodgeLeft:  { file: 'standing_dodge_left.glb',                 label: 'Dodge Left',  loop: false },
      bow_dodgeRight: { file: 'standing_dodge_right.glb',                label: 'Dodge Right', loop: false },
      bow_diveFwd:    { file: 'standing_dive_forward.glb',               label: 'Dive',        loop: false },
      bow_kick:       { file: 'standing_melee_kick.glb',                 label: 'Melee Kick',  loop: false },
      bow_punch:      { file: 'standing_melee_punch.glb',                label: 'Melee Punch', loop: false },
      bow_deathBack:  { file: 'standing_death_backward_01.glb',          label: 'Bow Death',   loop: false },
      bow_deathFwd:   { file: 'standing_death_forward_01.glb',           label: 'Death Fwd',   loop: false },
      bow_turnLeft:   { file: 'standing_turn_90_left.glb',               label: 'Turn L',      loop: false },
      bow_turnRight:  { file: 'standing_turn_90_right.glb',              label: 'Turn R',      loop: false },
      bow_fallLoop:   { file: 'fall_a_loop.glb',                         label: 'Fall',        loop: true },
      bow_fallLand:   { file: 'fall_a_land_to_standing_idle_01.glb',     label: 'Land',        loop: false },
    },
  },

  // Pro Magic (Mage)
  magic: {
    label: 'Magic',
    path: './assets/glb/anims/magic/',
    anims: {
      mag_idle:       { file: 'standing_idle.glb',                       label: 'Magic Idle',  loop: true },
      mag_runFwd:     { file: 'Standing_Run_Forward.glb',                label: 'M Run',       loop: true },
      mag_sprint:     { file: 'Standing_Sprint_Forward.glb',             label: 'Sprint',      loop: true },
      mag_walkFwd:    { file: 'Standing_Walk_Forward.glb',               label: 'M Walk',      loop: true },
      mag_jump:       { file: 'Standing_Jump.glb',                       label: 'Jump',        loop: false },
      mag_turnLeft:   { file: 'Standing_Turn_Left_90.glb',               label: 'M Turn L',    loop: false },
      mag_turnRight:  { file: 'Standing_Turn_Right_90.glb',              label: 'M Turn R',    loop: false },
      mag_1hCast:     { file: 'standing_1H_cast_spell_01.glb',           label: '1H Cast',     loop: false },
      mag_1hAttack1:  { file: 'Standing_1H_Magic_Attack_01.glb',         label: '1H Attack',   loop: false },
      mag_1hAttack2:  { file: 'Standing_1H_Magic_Attack_02.glb',         label: '1H Atk 2',    loop: false },
      mag_1hAttack3:  { file: 'Standing_1H_Magic_Attack_03.glb',         label: '1H Atk 3',    loop: false },
      mag_2hCast:     { file: 'Standing_2H_Cast_Spell_01.glb',           label: '2H Cast',     loop: false },
      mag_2hArea1:    { file: 'Standing_2H_Magic_Area_Attack_01.glb',    label: 'AoE 1',       loop: false },
      mag_2hArea2:    { file: 'Standing_2H_Magic_Area_Attack_02.glb',    label: 'AoE 2',       loop: false },
      mag_2hAttack1:  { file: 'Standing_2H_Magic_Attack_01.glb',         label: '2H Atk 1',    loop: false },
      mag_2hAttack2:  { file: 'Standing_2H_Magic_Attack_02.glb',         label: '2H Atk 2',    loop: false },
      mag_2hAttack3:  { file: 'Standing_2H_Magic_Attack_03.glb',         label: '2H Atk 3',    loop: false },
      mag_2hAttack4:  { file: 'Standing_2H_Magic_Attack_04.glb',         label: '2H Atk 4',    loop: false },
      mag_2hAttack5:  { file: 'Standing_2H_Magic_Attack_05.glb',         label: '2H Atk 5',    loop: false },
      mag_blockIdle:  { file: 'Standing_Block_Idle.glb',                 label: 'M Block',     loop: true },
      mag_blockReact: { file: 'Standing_Block_React_Large.glb',          label: 'Block React', loop: false },
      mag_deathBack:  { file: 'Standing_React_Death_Backward.glb',       label: 'M Death',     loop: false },
      mag_deathFwd:   { file: 'Standing_React_Death_Forward.glb',        label: 'Death Fwd',   loop: false },
      mag_reactFront: { file: 'Standing_React_Large_From_Front.glb',     label: 'React Hit',   loop: false },
      mag_crouchIdle: { file: 'Crouch_Idle.glb',                         label: 'Crouch',      loop: true },
      mag_crouchWalk: { file: 'Crouch_Walk_Forward.glb',                 label: 'Crouch Walk', loop: true },
    },
  },
};

/** Class → animation pack mapping */
export const CLASS_ANIM_MAP = {
  warrior: 'sword_shield',
  ranger:  'longbow',
  mage:    'magic',
  worge:   'sword_shield',  // Worge uses melee base, forms TBD
};

/** Get all animation entries for a class (base + class pack) */
export function getAnimsForClass(classId) {
  const baseAnims = ANIM_CATALOG.base.anims;
  const packKey = CLASS_ANIM_MAP[classId] || 'sword_shield';
  const classAnims = ANIM_CATALOG[packKey]?.anims || {};
  return { ...baseAnims, ...classAnims };
}

/** Flat list of all animation entries across all packs (for the picker) */
export function getAllAnims() {
  const all = {};
  for (const [packKey, pack] of Object.entries(ANIM_CATALOG)) {
    for (const [animKey, anim] of Object.entries(pack.anims)) {
      all[animKey] = { ...anim, pack: packKey, packLabel: pack.label, fullPath: pack.path + anim.file };
    }
  }
  return all;
}
