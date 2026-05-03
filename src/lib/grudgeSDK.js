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
 */

// ── Endpoints ────────────────────────────────────────────────────────────────

const OBJECTSTORE_API = 'https://molochdagod.github.io/ObjectStore/api/v1';
const ASSETS_CDN      = 'https://assets.grudge-studio.com';
const WORKER_API      = 'https://objectstore.grudge-studio.com';
const GAME_API        = 'https://api.grudge-studio.com';
const INFO_HUB        = 'https://info.grudge-studio.com';
const CRAFTING_APP    = 'https://grudge-crafting.puter.site';

// ── Cache ────────────────────────────────────────────────────────────────────

const _cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function _cachedFetch(key, url) {
  const now = Date.now();
  if (_cache[key] && (now - _cache[key].ts) < CACHE_TTL) {
    return _cache[key].data;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _cache[key] = { data, ts: now };
    return data;
  } catch (err) {
    console.warn(`[GrudgeSDK] Fetch failed for ${key}:`, err.message);
    // Return stale cache if available
    if (_cache[key]) return _cache[key].data;
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export const GrudgeSDK = {

  /** Fetch all 6 races with factions, bonuses, lore */
  async fetchRaces() {
    return _cachedFetch('races', `${OBJECTSTORE_API}/races.json`);
  },

  /** Fetch all 4 classes with abilities, weapon types, starting attrs */
  async fetchClasses() {
    return _cachedFetch('classes', `${OBJECTSTORE_API}/classes.json`);
  },

  /** Fetch 8 attribute definitions (Strength, Intellect, etc.) */
  async fetchAttributes() {
    return _cachedFetch('attributes', `${OBJECTSTORE_API}/attributes.json`);
  },

  /** Fetch faction data (Crusade, Legion, Fabled) */
  async fetchFactions() {
    return _cachedFetch('factions', `${OBJECTSTORE_API}/factions.json`);
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
      races: races.value ?? null,
      classes: classes.value ?? null,
      attributes: attrs.value ?? null,
      factions: factions.value ?? null,
    };
  },

  // ── Helpers: extract typed data from API responses ────────────────────────

  /** Get race map from API response: { human: {...}, elf: {...}, ... } */
  getRacesMap(apiData) {
    return apiData?.races || {};
  },

  /** Get classes map from API response: { warrior: {...}, mage: {...}, ... } */
  getClassesMap(apiData) {
    return apiData?.classes || {};
  },

  /** Get factions map from API response: { crusade: {...}, ... } */
  getFactionsMap(apiData) {
    return apiData?.factions || {};
  },

  /** Get abilities array for a class from API response */
  getClassAbilities(classData) {
    return classData?.abilities || [];
  },

  /** Get weapon types allowed for a class */
  getClassWeaponTypes(classData) {
    return classData?.weaponTypes || [];
  },
};

// ── Animation catalog (local — these are FBX files in the repo) ─────────────

export const ANIM_CATALOG = {
  // Base (shared across all classes)
  base: {
    label: 'Base',
    path: './assets/characters/races/animations/',
    anims: {
      idle:       { file: 'idle.fbx',        label: 'Idle',        loop: true },
      combatIdle: { file: 'combat_idle.fbx', label: 'Combat Idle', loop: true },
      combatRun:  { file: 'combat_run.fbx',  label: 'Run',         loop: true },
      attack1:    { file: 'attack1.fbx',     label: 'Attack 1',    loop: false },
      attack2:    { file: 'attack2.fbx',     label: 'Attack 2',    loop: false },
      attack3:    { file: 'attack3.fbx',     label: 'Attack 3',    loop: false },
      death:      { file: 'death.fbx',       label: 'Death',       loop: false },
      hit:        { file: 'hit.fbx',         label: 'Hit React',   loop: false },
      block:      { file: 'block.fbx',       label: 'Block',       loop: true },
    },
  },

  // Pro Sword & Shield (Warrior)
  sword_shield: {
    label: 'Sword & Shield',
    path: './assets/Pro Sword and Shield Pack/',
    anims: {
      ss_idle:        { file: 'sword and shield idle.fbx',        label: 'SS Idle',     loop: true },
      ss_run:         { file: 'sword and shield run.fbx',         label: 'SS Run',      loop: true },
      ss_walk:        { file: 'sword and shield walk.fbx',        label: 'SS Walk',     loop: true },
      ss_slash1:      { file: 'sword and shield slash.fbx',       label: 'Slash 1',     loop: false },
      ss_slash2:      { file: 'sword and shield slash (2).fbx',   label: 'Slash 2',     loop: false },
      ss_slash3:      { file: 'sword and shield slash (3).fbx',   label: 'Slash 3',     loop: false },
      ss_slash4:      { file: 'sword and shield slash (4).fbx',   label: 'Slash 4',     loop: false },
      ss_slash5:      { file: 'sword and shield slash (5).fbx',   label: 'Slash 5',     loop: false },
      ss_attack3:     { file: 'sword and shield attack (3).fbx',  label: 'Heavy Atk 1', loop: false },
      ss_attack4:     { file: 'sword and shield attack (4).fbx',  label: 'Heavy Atk 2', loop: false },
      ss_block:       { file: 'sword and shield block.fbx',       label: 'SS Block',    loop: true },
      ss_blockIdle:   { file: 'sword and shield block idle.fbx',  label: 'Block Idle',  loop: true },
      ss_kick:        { file: 'sword and shield kick.fbx',        label: 'Kick',        loop: false },
      ss_jump:        { file: 'sword and shield jump.fbx',        label: 'Jump',        loop: false },
      ss_death:       { file: 'sword and shield death.fbx',       label: 'SS Death',    loop: false },
      ss_crouch:      { file: 'sword and shield crouch.fbx',      label: 'Crouch',      loop: false },
      ss_crouchIdle:  { file: 'sword and shield crouch idle.fbx', label: 'Crouch Idle', loop: true },
      ss_powerUp:     { file: 'sword and shield power up.fbx',    label: 'Power Up',    loop: false },
      ss_casting:     { file: 'sword and shield casting.fbx',     label: 'Casting',     loop: false },
      ss_drawSword:   { file: 'draw sword 1.fbx',                 label: 'Draw Sword',  loop: false },
      ss_sheathSword: { file: 'sheath sword 1.fbx',               label: 'Sheath',      loop: false },
      ss_strafe:      { file: 'sword and shield strafe.fbx',      label: 'Strafe L',    loop: true },
      ss_strafe2:     { file: 'sword and shield strafe (2).fbx',  label: 'Strafe R',    loop: true },
      ss_turn180:     { file: 'sword and shield 180 turn.fbx',    label: '180 Turn',    loop: false },
    },
  },

  // Pro Longbow (Ranger)
  longbow: {
    label: 'Longbow',
    path: './assets/Pro Longbow Pack/',
    anims: {
      bow_idle:       { file: 'standing idle 01.fbx',              label: 'Bow Idle',    loop: true },
      bow_runFwd:     { file: 'standing run forward.fbx',          label: 'Bow Run',     loop: true },
      bow_walkFwd:    { file: 'standing walk forward.fbx',         label: 'Bow Walk',    loop: true },
      bow_aimOverdraw:{ file: 'standing aim overdraw.fbx',         label: 'Aim',         loop: false },
      bow_aimRecoil:  { file: 'standing aim recoil.fbx',           label: 'Fire',        loop: false },
      bow_drawArrow:  { file: 'standing draw arrow.fbx',           label: 'Draw Arrow',  loop: false },
      bow_equip:      { file: 'standing equip bow.fbx',            label: 'Equip Bow',   loop: false },
      bow_disarm:     { file: 'standing disarm bow.fbx',           label: 'Disarm',      loop: false },
      bow_block:      { file: 'standing block.fbx',                label: 'Bow Block',   loop: true },
      bow_dodgeFwd:   { file: 'standing dodge forward.fbx',        label: 'Dodge Fwd',   loop: false },
      bow_dodgeBack:  { file: 'standing dodge backward.fbx',       label: 'Dodge Back',  loop: false },
      bow_dodgeLeft:  { file: 'standing dodge left.fbx',           label: 'Dodge Left',  loop: false },
      bow_dodgeRight: { file: 'standing dodge right.fbx',          label: 'Dodge Right', loop: false },
      bow_diveFwd:    { file: 'standing dive forward.fbx',         label: 'Dive',        loop: false },
      bow_kick:       { file: 'standing melee kick.fbx',           label: 'Melee Kick',  loop: false },
      bow_punch:      { file: 'standing melee punch.fbx',          label: 'Melee Punch', loop: false },
      bow_deathBack:  { file: 'standing death backward 01.fbx',    label: 'Bow Death',   loop: false },
      bow_deathFwd:   { file: 'standing death forward 01.fbx',     label: 'Death Fwd',   loop: false },
      bow_turnLeft:   { file: 'standing turn 90 left.fbx',         label: 'Turn L',      loop: false },
      bow_turnRight:  { file: 'standing turn 90 right.fbx',        label: 'Turn R',      loop: false },
      bow_fallLoop:   { file: 'fall a loop.fbx',                   label: 'Fall',        loop: true },
      bow_fallLand:   { file: 'fall a land to standing idle 01.fbx',label:'Land',         loop: false },
    },
  },

  // Pro Magic (Mage)
  magic: {
    label: 'Magic',
    path: './assets/Pro Magic Pack/',
    anims: {
      mag_idle:       { file: 'standing idle.fbx',                       label: 'Magic Idle',  loop: true },
      mag_runFwd:     { file: 'Standing Run Forward.fbx',                label: 'M Run',       loop: true },
      mag_sprint:     { file: 'Standing Sprint Forward.fbx',             label: 'Sprint',      loop: true },
      mag_walkFwd:    { file: 'Standing Walk Forward.fbx',               label: 'M Walk',      loop: true },
      mag_jump:       { file: 'Standing Jump.fbx',                       label: 'Jump',        loop: false },
      mag_turnLeft:   { file: 'Standing Turn Left 90.fbx',               label: 'M Turn L',    loop: false },
      mag_turnRight:  { file: 'Standing Turn Right 90.fbx',              label: 'M Turn R',    loop: false },
      mag_1hCast:     { file: 'standing 1H cast spell 01.fbx',           label: '1H Cast',     loop: false },
      mag_1hAttack1:  { file: 'Standing 1H Magic Attack 01.fbx',         label: '1H Attack',   loop: false },
      mag_1hAttack2:  { file: 'Standing 1H Magic Attack 02.fbx',         label: '1H Atk 2',    loop: false },
      mag_1hAttack3:  { file: 'Standing 1H Magic Attack 03.fbx',         label: '1H Atk 3',    loop: false },
      mag_2hCast:     { file: 'Standing 2H Cast Spell 01.fbx',           label: '2H Cast',     loop: false },
      mag_2hArea1:    { file: 'Standing 2H Magic Area Attack 01.fbx',    label: 'AoE 1',       loop: false },
      mag_2hArea2:    { file: 'Standing 2H Magic Area Attack 02.fbx',    label: 'AoE 2',       loop: false },
      mag_2hAttack1:  { file: 'Standing 2H Magic Attack 01.fbx',         label: '2H Atk 1',    loop: false },
      mag_2hAttack2:  { file: 'Standing 2H Magic Attack 02.fbx',         label: '2H Atk 2',    loop: false },
      mag_2hAttack3:  { file: 'Standing 2H Magic Attack 03.fbx',         label: '2H Atk 3',    loop: false },
      mag_2hAttack4:  { file: 'Standing 2H Magic Attack 04.fbx',         label: '2H Atk 4',    loop: false },
      mag_2hAttack5:  { file: 'Standing 2H Magic Attack 05.fbx',         label: '2H Atk 5',    loop: false },
      mag_blockIdle:  { file: 'Standing Block Idle.fbx',                 label: 'M Block',     loop: true },
      mag_blockReact: { file: 'Standing Block React Large.fbx',          label: 'Block React', loop: false },
      mag_deathBack:  { file: 'Standing React Death Backward.fbx',       label: 'M Death',     loop: false },
      mag_deathFwd:   { file: 'Standing React Death Forward.fbx',        label: 'Death Fwd',   loop: false },
      mag_reactFront: { file: 'Standing React Large From Front.fbx',     label: 'React Hit',   loop: false },
      mag_crouchIdle: { file: 'Crouch Idle.fbx',                         label: 'Crouch',      loop: true },
      mag_crouchWalk: { file: 'Crouch Walk Forward.fbx',                 label: 'Crouch Walk', loop: true },
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
