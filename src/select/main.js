/**
 * main.js — Grudge Warlords Character Selection (Three.js WebGPU)
 *
 * Loads all 6 race FBX models, 4 class configs, equipment slot system,
 * and 3 weapon animation packs + 9 base animations.
 * WebGPU renderer with WebGL2 fallback.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — Races, Classes, Equipment, Animations
// ═══════════════════════════════════════════════════════════════════════════════

const FACTIONS = {
  crusade: { name: 'Crusade', color: '#c8a04e', races: ['human', 'barbarian'] },
  fabled:  { name: 'Fabled',  color: '#7ec8e3', races: ['elf', 'dwarf'] },
  legion:  { name: 'Legion',  color: '#8b2020', races: ['orc', 'undead'] },
};

const RACES = {
  human: {
    name: 'Human', faction: 'crusade', prefix: 'WK_', color: '#4a90d9',
    modelPath: './assets/characters/races/human/WK_Characters_customizable.FBX',
    stats: { str: 14, dex: 12, int: 12, vit: 14, wis: 11, lck: 11, cha: 13, end: 13 },
    description: 'Balanced warriors of the Crusade. Masters of sword and shield combat.',
  },
  barbarian: {
    name: 'Barbarian', faction: 'crusade', prefix: 'BRB_', color: '#c0392b',
    modelPath: './assets/characters/races/barbarian/BRB_Characters_customizable.FBX',
    stats: { str: 18, dex: 13, int: 8, vit: 16, wis: 8, lck: 10, cha: 9, end: 18 },
    description: 'Ferocious berserkers. Unmatched raw strength and endurance.',
  },
  elf: {
    name: 'Elf', faction: 'fabled', prefix: 'ELF_', color: '#27ae60',
    modelPath: './assets/characters/races/elf/ELF_Characters_customizable.FBX',
    stats: { str: 10, dex: 18, int: 15, vit: 10, wis: 14, lck: 14, cha: 12, end: 7 },
    description: 'Swift archers and mages of the Fabled. Unrivaled agility and arcane skill.',
  },
  dwarf: {
    name: 'Dwarf', faction: 'fabled', prefix: 'DWF_', color: '#8e44ad',
    modelPath: './assets/characters/races/dwarf/DWF_Characters_customizable.FBX',
    stats: { str: 15, dex: 9, int: 13, vit: 18, wis: 14, lck: 12, cha: 9, end: 10 },
    description: 'Stout craftsmen and engineers. Exceptional vitality and wisdom.',
  },
  orc: {
    name: 'Orc', faction: 'legion', prefix: 'ORC_', color: '#2ecc71',
    modelPath: './assets/characters/races/orc/ORC_Characters_Customizable.FBX',
    stats: { str: 19, dex: 10, int: 8, vit: 17, wis: 7, lck: 9, cha: 8, end: 20 },
    description: 'Brutal warlords of the Legion. Overpowering strength and unstoppable endurance.',
  },
  undead: {
    name: 'Undead', faction: 'legion', prefix: 'UD_', color: '#7f8c8d',
    modelPath: './assets/characters/races/undead/UD_Characters_customizable.FBX',
    stats: { str: 12, dex: 11, int: 16, vit: 8, wis: 16, lck: 10, cha: 6, end: 21 },
    description: 'Deathbound legions. High intelligence and endurance beyond mortality.',
  },
};
const RACE_ORDER = ['human', 'barbarian', 'elf', 'dwarf', 'orc', 'undead'];

// ── Classes ──────────────────────────────────────────────────────────────────

const CLASSES = {
  warrior: {
    name: 'Warrior', icon: '⚔️', role: 'Tank / Melee DPS',
    allowedWeapons: new Set(['sword', 'axe', 'hammer', 'pick', 'spear', 'shield']),
    animPack: 'sword_shield',
    statBonus: { str: 2, vit: 2, end: 1 },
    description: 'Masters of close combat. Shields, swords, and 2H weapons.',
  },
  ranger: {
    name: 'Ranger', icon: '🏹', role: 'Ranged DPS',
    allowedWeapons: new Set(['bow', 'spear', 'sword']),
    animPack: 'longbow',
    statBonus: { dex: 3, lck: 1, cha: 1 },
    description: 'Swift archers. Bows, crossbows, daggers, and spears.',
  },
  mage: {
    name: 'Mage', icon: '🔮', role: 'Caster / Healer',
    allowedWeapons: new Set(['staff', 'shield']),
    animPack: 'magic',
    statBonus: { int: 3, wis: 2 },
    description: 'Wielders of arcane power. Staffs, tomes, and off-hand relics.',
  },
  worge: {
    name: 'Worge', icon: '🐺', role: 'Shapeshifter',
    allowedWeapons: new Set(['staff', 'spear', 'bow', 'hammer', 'axe']),
    animPack: 'sword_shield',
    statBonus: { str: 1, dex: 1, vit: 1, end: 1, wis: 1 },
    description: 'Three forms — Bear, Raptor, Bird. Hybrid combat and magic.',
  },
};

// ── Equipment slot regex patterns (strip race prefix first) ─────────────────

const SLOT_PATTERNS = [
  { slot: 'body',      re: /^Units_Body_([A-Z])$/i,           group: 'armor' },
  { slot: 'arms',      re: /^Units_Arms_([A-Z])$/i,           group: 'armor' },
  { slot: 'legs',      re: /^Units_Legs_([A-Z])$/i,           group: 'armor' },
  { slot: 'head',      re: /^Units_head_([A-Z])$/i,           group: 'armor' },
  { slot: 'shoulders', re: /^Units_shoulderpads_([A-Z])$/i,   group: 'armor' },
  { slot: 'sword',     re: /^Units_sword_([A-Z])$/i,          group: 'weapon' },
  { slot: 'axe',       re: /^Units_axe_([A-Z])$/i,            group: 'weapon' },
  { slot: 'hammer',    re: /^Units_hammer_([A-Z])$/i,         group: 'weapon' },
  { slot: 'pick',      re: /^Units_pick$/i,                   group: 'weapon',  noVariant: true },
  { slot: 'spear',     re: /^Units_spear$/i,                  group: 'weapon',  noVariant: true },
  { slot: 'bow',       re: /^Units_Bow$/i,                    group: 'weapon',  noVariant: true },
  { slot: 'staff',     re: /^Units_staff_([A-Z])$/i,          group: 'weapon' },
  { slot: 'shield',    re: /^Units_shield_([A-Z])$/i,         group: 'shield' },
  { slot: 'bag',       re: /^Xtra_bag$/i,                     group: 'utility', noVariant: true },
  { slot: 'wood',      re: /^Xtra_wood$/i,                    group: 'utility', noVariant: true },
  { slot: 'quiver',    re: /^Xtra_quiver$/i,                  group: 'utility', noVariant: true },
];

const SLOT_UI = [
  // group label, then [slot, displayName] entries
  ['ARMOR',   [['body','Body Armor'],['arms','Arm Guards'],['legs','Leg Guards'],['head','Helmet'],['shoulders','Shoulders']]],
  ['WEAPONS', [['sword','Sword'],['axe','Axe'],['hammer','Hammer'],['pick','Pick'],['spear','Spear'],['bow','Bow'],['staff','Staff']]],
  ['SHIELD',  [['shield','Shield']]],
  ['UTILITY', [['bag','Backpack'],['wood','Wood'],['quiver','Quiver']]],
];

// ── Animation pack catalogs ─────────────────────────────────────────────────

const BASE_ANIMS = {
  idle:       './assets/characters/races/animations/idle.fbx',
  combatIdle: './assets/characters/races/animations/combat_idle.fbx',
  combatRun:  './assets/characters/races/animations/combat_run.fbx',
  attack1:    './assets/characters/races/animations/attack1.fbx',
  attack2:    './assets/characters/races/animations/attack2.fbx',
  attack3:    './assets/characters/races/animations/attack3.fbx',
  death:      './assets/characters/races/animations/death.fbx',
  hit:        './assets/characters/races/animations/hit.fbx',
  block:      './assets/characters/races/animations/block.fbx',
};

const LONGBOW_PATH = './assets/Pro Longbow Pack/';
const LONGBOW_ANIMS = {
  bow_idle:           'standing idle 01.fbx',
  bow_idle2:          'standing idle 02 looking.fbx',
  bow_idle3:          'standing idle 03 examine.fbx',
  bow_unarmedIdle:    'unarmed idle 01.fbx',
  bow_runFwd:         'standing run forward.fbx',
  bow_runBack:        'standing run back.fbx',
  bow_runLeft:        'standing run left.fbx',
  bow_runRight:       'standing run right.fbx',
  bow_runStop:        'standing run forward stop.fbx',
  bow_walkFwd:        'standing walk forward.fbx',
  bow_walkBack:       'standing walk back.fbx',
  bow_walkLeft:       'standing walk left.fbx',
  bow_walkRight:      'standing walk right.fbx',
  bow_aimOverdraw:    'standing aim overdraw.fbx',
  bow_aimRecoil:      'standing aim recoil.fbx',
  bow_aimWalkFwd:     'standing aim walk forward.fbx',
  bow_aimWalkBack:    'standing aim walk back.fbx',
  bow_aimWalkLeft:    'standing aim walk left.fbx',
  bow_aimWalkRight:   'standing aim walk right.fbx',
  bow_drawArrow:      'standing draw arrow.fbx',
  bow_equip:          'standing equip bow.fbx',
  bow_disarm:         'standing disarm bow.fbx',
  bow_block:          'standing block.fbx',
  bow_dodgeFwd:       'standing dodge forward.fbx',
  bow_dodgeBack:      'standing dodge backward.fbx',
  bow_dodgeLeft:      'standing dodge left.fbx',
  bow_dodgeRight:     'standing dodge right.fbx',
  bow_diveFwd:        'standing dive forward.fbx',
  bow_deathBack:      'standing death backward 01.fbx',
  bow_deathFwd:       'standing death forward 01.fbx',
  bow_kick:           'standing melee kick.fbx',
  bow_punch:          'standing melee punch.fbx',
  bow_reactSmall:     'standing react small from front.fbx',
  bow_reactHeadshot:  'standing react small from headshot.fbx',
  bow_turnLeft:       'standing turn 90 left.fbx',
  bow_turnRight:      'standing turn 90 right.fbx',
  bow_fallLoop:       'fall a loop.fbx',
  bow_fallLandRun:    'fall a land to run forward.fbx',
  bow_fallLandIdle:   'fall a land to standing idle 01.fbx',
};

const SWORD_PATH = './assets/Pro Sword and Shield Pack/';
const SWORD_ANIMS = {
  ss_idle:            'sword and shield idle.fbx',
  ss_idle2:           'sword and shield idle (3).fbx',
  ss_run:             'sword and shield run.fbx',
  ss_run2:            'sword and shield run (2).fbx',
  ss_walk:            'sword and shield walk.fbx',
  ss_walk2:           'sword and shield walk (2).fbx',
  ss_slash1:          'sword and shield slash.fbx',
  ss_slash2:          'sword and shield slash (2).fbx',
  ss_slash3:          'sword and shield slash (3).fbx',
  ss_slash4:          'sword and shield slash (4).fbx',
  ss_slash5:          'sword and shield slash (5).fbx',
  ss_attack3:         'sword and shield attack (3).fbx',
  ss_attack4:         'sword and shield attack (4).fbx',
  ss_block:           'sword and shield block.fbx',
  ss_block2:          'sword and shield block (2).fbx',
  ss_blockIdle:       'sword and shield block idle.fbx',
  ss_casting:         'sword and shield casting.fbx',
  ss_casting2:        'sword and shield casting (2).fbx',
  ss_crouchIdle:      'sword and shield crouch idle.fbx',
  ss_crouch:          'sword and shield crouch.fbx',
  ss_crouchBlock:     'sword and shield crouch block.fbx',
  ss_crouchBlock2:    'sword and shield crouch block (2).fbx',
  ss_crouchBlockIdle: 'sword and shield crouch block idle.fbx',
  ss_crouching:       'sword and shield crouching.fbx',
  ss_crouching2:      'sword and shield crouching (2).fbx',
  ss_crouching3:      'sword and shield crouching (3).fbx',
  ss_death:           'sword and shield death.fbx',
  ss_death2:          'sword and shield death (2).fbx',
  ss_impact:          'sword and shield impact (2).fbx',
  ss_impact2:         'sword and shield impact (3).fbx',
  ss_jump:            'sword and shield jump.fbx',
  ss_kick:            'sword and shield kick.fbx',
  ss_powerUp:         'sword and shield power up.fbx',
  ss_strafe:          'sword and shield strafe.fbx',
  ss_strafe2:         'sword and shield strafe (2).fbx',
  ss_strafe3:         'sword and shield strafe (3).fbx',
  ss_strafe4:         'sword and shield strafe (4).fbx',
  ss_turn:            'sword and shield turn.fbx',
  ss_turn2:           'sword and shield turn (2).fbx',
  ss_turn180:         'sword and shield 180 turn.fbx',
  ss_turn180_2:       'sword and shield 180 turn (2).fbx',
  ss_drawSword:       'draw sword 1.fbx',
  ss_drawSword2:      'draw sword 2.fbx',
  ss_sheathSword:     'sheath sword 1.fbx',
  ss_sheathSword2:    'sheath sword 2.fbx',
};

const MAGIC_PATH = './assets/Pro Magic Pack/';
const MAGIC_ANIMS = {
  mag_idle:           'standing idle.fbx',
  mag_idle2:          'standing idle 02.fbx',
  mag_idle3:          'Standing Idle 03.fbx',
  mag_runFwd:         'Standing Run Forward.fbx',
  mag_runBack:        'Standing Run Back.fbx',
  mag_runLeft:        'Standing Run Left.fbx',
  mag_runRight:       'Standing Run Right.fbx',
  mag_sprint:         'Standing Sprint Forward.fbx',
  mag_walkFwd:        'Standing Walk Forward.fbx',
  mag_walkLeft:       'Standing Walk Left.fbx',
  mag_walkRight:      'Standing Walk Right.fbx',
  mag_jump:           'Standing Jump.fbx',
  mag_jumpRun:        'Standing Jump Running.fbx',
  mag_jumpLand:       'Standing Jump Running Landing.fbx',
  mag_land:           'Standing Land To Standing Idle.fbx',
  mag_turnLeft:       'Standing Turn Left 90.fbx',
  mag_turnRight:      'Standing Turn Right 90.fbx',
  mag_1hCast:         'standing 1H cast spell 01.fbx',
  mag_1hAttack1:      'Standing 1H Magic Attack 01.fbx',
  mag_1hAttack2:      'Standing 1H Magic Attack 02.fbx',
  mag_1hAttack3:      'Standing 1H Magic Attack 03.fbx',
  mag_2hCast:         'Standing 2H Cast Spell 01.fbx',
  mag_2hArea1:        'Standing 2H Magic Area Attack 01.fbx',
  mag_2hArea2:        'Standing 2H Magic Area Attack 02.fbx',
  mag_2hAttack1:      'Standing 2H Magic Attack 01.fbx',
  mag_2hAttack2:      'Standing 2H Magic Attack 02.fbx',
  mag_2hAttack3:      'Standing 2H Magic Attack 03.fbx',
  mag_2hAttack4:      'Standing 2H Magic Attack 04.fbx',
  mag_2hAttack5:      'Standing 2H Magic Attack 05.fbx',
  mag_blockStart:     'Standing Block Start.fbx',
  mag_blockIdle:      'Standing Block Idle.fbx',
  mag_blockEnd:       'Standing Block End.fbx',
  mag_blockReact:     'Standing Block React Large.fbx',
  mag_deathBack:      'Standing React Death Backward.fbx',
  mag_deathFwd:       'Standing React Death Forward.fbx',
  mag_deathLeft:      'Standing React Death Left.fbx',
  mag_deathRight:     'Standing React Death Right.fbx',
  mag_reactLgFront:   'Standing React Large From Front.fbx',
  mag_reactLgLeft:    'Standing React Large From Left.fbx',
  mag_reactLgRight:   'Standing React Large From Right.fbx',
  mag_reactSmBack:    'Standing React Small From Back.fbx',
  mag_reactSmFront:   'Standing React Small From Front.fbx',
  mag_reactSmLeft:    'Standing React Small From Left.fbx',
  mag_reactSmRight:   'Standing React Small From Right.fbx',
  mag_crouchIdle:     'Crouch Idle.fbx',
  mag_crouchStand:    'Crouch To Standing Idle.fbx',
  mag_crouchTurnL:    'Crouch Turn Left 90.fbx',
  mag_crouchTurnR:    'Crouch Turn Right 90.fbx',
  mag_crouchWalkFwd:  'Crouch Walk Forward.fbx',
  mag_crouchWalkBack: 'Crouch Walk Back.fbx',
  mag_crouchWalkL:    'Crouch Walk Left.fbx',
  mag_crouchWalkR:    'Crouch Walk Right.fbx',
};

// Map class animPack key → { basePath, anims }
const CLASS_ANIM_PACKS = {
  sword_shield: { basePath: SWORD_PATH, anims: SWORD_ANIMS },
  longbow:      { basePath: LONGBOW_PATH, anims: LONGBOW_ANIMS },
  magic:        { basePath: MAGIC_PATH, anims: MAGIC_ANIMS },
};

// Friendly names for animation buttons
const ANIM_DISPLAY = {
  // Base
  idle: 'Idle', combatIdle: 'Combat Idle', combatRun: 'Run',
  attack1: 'Attack 1', attack2: 'Attack 2', attack3: 'Attack 3',
  block: 'Block', hit: 'Hit React', death: 'Death',
  // Sword & Shield
  ss_idle: 'SS Idle', ss_slash1: 'Slash 1', ss_slash2: 'Slash 2', ss_slash3: 'Slash 3',
  ss_block: 'SS Block', ss_kick: 'Kick', ss_death: 'SS Death',
  ss_run: 'SS Run', ss_crouch: 'Crouch', ss_jump: 'Jump',
  ss_drawSword: 'Draw Sword', ss_sheathSword: 'Sheath',
  ss_strafe: 'Strafe L', ss_strafe2: 'Strafe R', ss_powerUp: 'Power Up',
  ss_casting: 'Casting', ss_turn180: '180 Turn',
  // Longbow
  bow_idle: 'Bow Idle', bow_drawArrow: 'Draw Arrow', bow_aimOverdraw: 'Aim',
  bow_aimRecoil: 'Fire', bow_equip: 'Equip Bow', bow_disarm: 'Disarm',
  bow_dodgeFwd: 'Dodge Fwd', bow_dodgeBack: 'Dodge Back',
  bow_kick: 'Melee Kick', bow_punch: 'Melee Punch',
  bow_runFwd: 'Bow Run', bow_deathBack: 'Bow Death',
  bow_block: 'Bow Block', bow_diveFwd: 'Dive',
  bow_fallLoop: 'Fall', bow_turnLeft: 'Turn L', bow_turnRight: 'Turn R',
  // Magic
  mag_idle: 'Magic Idle', mag_1hCast: '1H Cast', mag_1hAttack1: '1H Attack',
  mag_2hCast: '2H Cast', mag_2hArea1: 'AoE 1', mag_2hArea2: 'AoE 2',
  mag_2hAttack1: '2H Atk 1', mag_2hAttack2: '2H Atk 2',
  mag_blockIdle: 'M Block', mag_deathBack: 'M Death',
  mag_sprint: 'Sprint', mag_jump: 'Jump', mag_crouchIdle: 'Crouch',
  mag_runFwd: 'M Run', mag_turnLeft: 'M Turn L', mag_turnRight: 'M Turn R',
};

// Default equipment presets per race
const DEFAULT_PRESETS = {
  human:     { body:'B', arms:'A', legs:'A', head:'B', shoulders:'A', sword:'A', shield:'A' },
  barbarian: { body:'C', arms:'B', legs:'B', head:'A', axe:'A' },
  elf:       { body:'A', arms:'A', legs:'A', head:'C', bow:'default' },
  dwarf:     { body:'D', arms:'C', legs:'B', head:'D', shoulders:'B', hammer:'A', shield:'B' },
  orc:       { body:'E', arms:'D', legs:'C', head:'E', axe:'B' },
  undead:    { body:'B', arms:'A', legs:'A', head:'F', staff:'A' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// EQUIPMENT MANAGER (Three.js)
// ═══════════════════════════════════════════════════════════════════════════════

class EquipmentManager {
  constructor(prefix) {
    this.prefix = prefix;
    this.slots = {};        // slot → { variant → Object3D }
    this.equipped = {};     // slot → variant
    this._allMeshes = [];
  }

  catalog(root) {
    this.slots = {};
    this._allMeshes = [];
    this.equipped = {};

    root.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return;
      const name = child.name;
      const stripped = name.startsWith(this.prefix)
        ? name.slice(this.prefix.length) : name;

      for (const def of SLOT_PATTERNS) {
        const match = stripped.match(def.re);
        if (!match) continue;
        const variant = def.noVariant ? 'default' : (match[1] || 'default').toUpperCase();
        if (!this.slots[def.slot]) this.slots[def.slot] = {};
        this.slots[def.slot][variant] = child;
        child.userData._equipSlot = def.slot;
        child.userData._equipGroup = def.group;
        this._allMeshes.push(child);
        child.visible = false;
        break;
      }
    });

    return this.getSlotSummary();
  }

  equip(slot, variant) {
    const variants = this.slots[slot];
    if (!variants) return false;
    for (const [v, mesh] of Object.entries(variants)) {
      mesh.visible = (v === variant);
    }
    this.equipped[slot] = variant;
    return true;
  }

  unequip(slot) {
    const variants = this.slots[slot];
    if (!variants) return;
    for (const mesh of Object.values(variants)) mesh.visible = false;
    delete this.equipped[slot];
  }

  equipWeapon(slot, variant = 'default') {
    // Hide all weapons first
    for (const mesh of this._allMeshes) {
      if (mesh.userData._equipGroup === 'weapon') mesh.visible = false;
    }
    for (const s of ['sword','axe','hammer','pick','spear','bow','staff']) {
      delete this.equipped[s];
    }
    return this.equip(slot, variant);
  }

  applyPreset(preset) {
    // Hide everything first
    for (const mesh of this._allMeshes) mesh.visible = false;
    this.equipped = {};

    for (const [slot, variant] of Object.entries(preset)) {
      this.equip(slot, variant);
    }
  }

  getSlotSummary() {
    const out = {};
    for (const [slot, variants] of Object.entries(this.slots)) {
      out[slot] = { variants: Object.keys(variants).sort(), equipped: this.equipped[slot] || null };
    }
    return out;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// THREE.JS SCENE
// ═══════════════════════════════════════════════════════════════════════════════

let renderer, scene, camera, controls, clock;
let fbxLoader;
let currentModel = null;
let currentMixer = null;
let currentEquipMgr = null;
let currentActions = {};    // key → THREE.AnimationAction
let playingAction = null;
let rendererType = 'webgl';
let turntableActive = true;

// State
let activeRace = 'human';
let activeClass = 'warrior';
let activeFaction = 'crusade';

async function initScene() {
  const canvas = document.getElementById('three-canvas');
  const viewport = document.getElementById('viewport');

  updateLoading(10, 'Creating renderer…');

  // ── Renderer (WebGPU → WebGL fallback) ──
  if (navigator.gpu) {
    try {
      const mod = await import('three/addons/renderers/webgpu/WebGPURenderer.js');
      const WebGPURenderer = mod.default || mod.WebGPURenderer;
      renderer = new WebGPURenderer({ canvas, antialias: true });
      await renderer.init();
      rendererType = 'webgpu';
    } catch (e) {
      console.warn('WebGPU unavailable, using WebGL:', e.message);
    }
  }
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererType = 'webgl';
  }

  document.getElementById('renderer-badge').textContent =
    rendererType === 'webgpu' ? '⚡ WebGPU' : '🖥️ WebGL';

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // ── Scene ──
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080a12);
  scene.fog = new THREE.FogExp2(0x080a12, 0.08);

  // ── Camera ──
  const aspect = viewport.clientWidth / viewport.clientHeight;
  camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
  camera.position.set(0, 1.2, 4.5);
  camera.lookAt(0, 0.8, 0);

  // ── Controls ──
  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.8, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.enablePan = false;
  controls.update();

  // Stop turntable when user interacts
  controls.addEventListener('start', () => { turntableActive = false; });

  // ── Lighting ──
  const ambient = new THREE.AmbientLight(0x222244, 0.6);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffeedd, 1.8);
  keyLight.position.set(3, 4, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 15;
  keyLight.shadow.camera.left = -3;
  keyLight.shadow.camera.right = 3;
  keyLight.shadow.camera.top = 4;
  keyLight.shadow.camera.bottom = -1;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x4488ff, 0.7);
  rimLight.position.set(-3, 2, -4);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xc8a951, 0.35);
  fillLight.position.set(-4, 1, 3);
  scene.add(fillLight);

  // ── Ground plane ──
  const groundGeo = new THREE.CircleGeometry(3, 48);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c16, roughness: 0.9, metalness: 0.1,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ── Ground ring decoration ──
  const ringGeo = new THREE.RingGeometry(2.0, 2.05, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc8a951, transparent: true, opacity: 0.15 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);

  // ── Loader ──
  fbxLoader = new FBXLoader();
  clock = new THREE.Clock();

  // ── Resize ──
  function onResize() {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  onResize();

  // ── Render loop ──
  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    if (currentMixer) currentMixer.update(dt);
    if (turntableActive && currentModel) {
      currentModel.rotation.y += dt * 0.3;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARACTER LOADING
// ═══════════════════════════════════════════════════════════════════════════════

const modelCache = {};   // raceId → { model, equipMgr, skeleton }
const animCache = {};    // key → THREE.AnimationClip

async function loadRace(raceId) {
  updateLoading(40, `Loading ${RACES[raceId].name}…`);

  // Dispose current
  if (currentModel) {
    scene.remove(currentModel);
    if (currentMixer) currentMixer.stopAllAction();
    currentMixer = null;
    currentActions = {};
    playingAction = null;
  }

  // Check cache
  if (modelCache[raceId]) {
    const cached = modelCache[raceId];
    scene.add(cached.model);
    currentModel = cached.model;
    currentEquipMgr = cached.equipMgr;
    currentMixer = new THREE.AnimationMixer(cached.model);
    currentModel.rotation.y = Math.PI;
    turntableActive = true;
    await loadBaseAnimations();
    return;
  }

  const race = RACES[raceId];
  try {
    const fbx = await fbxLoader.loadAsync(race.modelPath);

    // Scale/position to match Bip001 skeleton standard
    fbx.scale.setScalar(0.018);
    fbx.position.y = 0;
    fbx.rotation.y = Math.PI;

    // Shadows
    fbx.traverse((child) => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Fix material for WebGL/WebGPU compatibility
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => {
            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          });
        }
      }
    });

    // Equipment
    const equipMgr = new EquipmentManager(race.prefix);
    equipMgr.catalog(fbx);
    equipMgr.applyPreset(DEFAULT_PRESETS[raceId] || { body: 'A', legs: 'A' });

    // Cache
    modelCache[raceId] = { model: fbx, equipMgr };

    scene.add(fbx);
    currentModel = fbx;
    currentEquipMgr = equipMgr;
    currentMixer = new THREE.AnimationMixer(fbx);
    turntableActive = true;

    await loadBaseAnimations();
  } catch (err) {
    console.error(`Failed to load ${raceId}:`, err);
    updateLoading(100, `Error loading ${race.name}`);
  }
}

async function loadBaseAnimations() {
  updateLoading(60, 'Loading base animations…');
  const entries = Object.entries(BASE_ANIMS);
  let loaded = 0;

  await Promise.allSettled(entries.map(async ([key, path]) => {
    if (animCache[key]) {
      currentActions[key] = currentMixer.clipAction(animCache[key]);
      loaded++;
      return;
    }
    try {
      const animFbx = await fbxLoader.loadAsync(path);
      if (animFbx.animations.length > 0) {
        const clip = animFbx.animations[0];
        clip.name = key;
        animCache[key] = clip;
        currentActions[key] = currentMixer.clipAction(clip);
      }
    } catch (e) {
      console.warn(`Anim "${key}" failed:`, e.message);
    }
    loaded++;
    updateLoading(60 + (loaded / entries.length) * 15, `Base anims: ${loaded}/${entries.length}`);
  }));

  // Auto-play idle
  playAnim('idle', true);
}

async function loadClassAnimations(classId) {
  const cls = CLASSES[classId];
  const packKey = cls.animPack;
  const pack = CLASS_ANIM_PACKS[packKey];
  if (!pack) return;

  updateLoading(80, `Loading ${cls.name} animations…`);

  const entries = Object.entries(pack.anims);
  let loaded = 0;

  await Promise.allSettled(entries.map(async ([key, file]) => {
    const fullPath = pack.basePath + file;
    if (animCache[key]) {
      if (currentMixer) currentActions[key] = currentMixer.clipAction(animCache[key]);
      loaded++;
      return;
    }
    try {
      const animFbx = await fbxLoader.loadAsync(fullPath);
      if (animFbx.animations.length > 0) {
        const clip = animFbx.animations[0];
        clip.name = key;
        animCache[key] = clip;
        if (currentMixer) currentActions[key] = currentMixer.clipAction(clip);
      }
    } catch (e) {
      console.warn(`Class anim "${key}" failed:`, e.message);
    }
    loaded++;
    const pct = 80 + (loaded / entries.length) * 15;
    updateLoading(pct, `${cls.name} anims: ${loaded}/${entries.length}`);
  }));
}

function playAnim(key, loop = true) {
  const action = currentActions[key];
  if (!action) return;

  if (playingAction && playingAction !== action) {
    action.reset().fadeIn(0.2).play();
    playingAction.fadeOut(0.2);
  } else {
    action.reset().play();
  }

  if (!loop) {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
  } else {
    action.setLoop(THREE.LoopRepeat);
  }

  playingAction = action;

  // Highlight UI
  document.querySelectorAll('.anim-btn').forEach(b => b.classList.remove('playing'));
  const btn = document.querySelector(`.anim-btn[data-key="${key}"]`);
  if (btn) btn.classList.add('playing');
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI BUILDING
// ═══════════════════════════════════════════════════════════════════════════════

function buildUI() {
  buildFactionTabs();
  buildRaceGrid();
  buildClassGrid();
  buildStats();
  buildEquipPanel();
  buildAnimButtons();
  wireEnterWorld();
  updateRaceInfo();
}

// ── Faction Tabs ─────────────────────────────────────────────────────────────

function buildFactionTabs() {
  const container = document.getElementById('faction-tabs');
  container.innerHTML = '';

  for (const [fId, fac] of Object.entries(FACTIONS)) {
    const tab = document.createElement('button');
    tab.className = 'faction-tab' + (fId === activeFaction ? ' active' : '');
    tab.textContent = fac.name.toUpperCase();
    tab.dataset.faction = fId;
    tab.style.setProperty('--tab-color', fac.color);
    tab.addEventListener('click', () => selectFaction(fId));
    container.appendChild(tab);
  }
}

function selectFaction(fId) {
  activeFaction = fId;
  document.querySelectorAll('.faction-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.faction === fId));
  // Auto-select first race in faction
  const firstRace = FACTIONS[fId].races[0];
  selectRace(firstRace);
}

// ── Race Grid ────────────────────────────────────────────────────────────────

function buildRaceGrid() {
  const container = document.getElementById('race-grid');
  container.innerHTML = '';

  for (const raceId of RACE_ORDER) {
    const race = RACES[raceId];
    const card = document.createElement('div');
    card.className = 'race-card' + (raceId === activeRace ? ' active' : '');
    card.style.setProperty('--race-color', race.color);
    card.dataset.race = raceId;
    card.innerHTML = `
      <div class="race-name">${race.name}</div>
      <div class="race-faction">${FACTIONS[race.faction].name}</div>
    `;
    card.addEventListener('click', () => selectRace(raceId));
    container.appendChild(card);
  }
}

async function selectRace(raceId) {
  if (activeRace === raceId && currentModel) return;
  activeRace = raceId;
  activeFaction = RACES[raceId].faction;

  // Update UI highlights
  document.querySelectorAll('.race-card').forEach(c =>
    c.classList.toggle('active', c.dataset.race === raceId));
  document.querySelectorAll('.faction-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.faction === activeFaction));

  updateRaceInfo();
  updateStats();

  await loadRace(raceId);
  buildEquipPanel();
  await loadClassAnimations(activeClass);
  buildAnimButtons();
  updateLoading(100, 'Ready');
  setTimeout(hideLoading, 300);
}

function updateRaceInfo() {
  const race = RACES[activeRace];
  const desc = document.getElementById('race-desc');
  desc.textContent = race.description;
}

// ── Class Grid ───────────────────────────────────────────────────────────────

function buildClassGrid() {
  const container = document.getElementById('class-grid');
  container.innerHTML = '';

  for (const [cId, cls] of Object.entries(CLASSES)) {
    const card = document.createElement('div');
    card.className = 'class-card' + (cId === activeClass ? ' active' : '');
    card.dataset.cls = cId;
    card.innerHTML = `
      <div class="class-icon">${cls.icon}</div>
      <div class="class-name">${cls.name}</div>
      <div class="class-role">${cls.role}</div>
    `;
    card.addEventListener('click', () => selectClass(cId));
    container.appendChild(card);
  }
}

async function selectClass(classId) {
  activeClass = classId;
  document.querySelectorAll('.class-card').forEach(c =>
    c.classList.toggle('active', c.dataset.cls === classId));
  updateStats();
  buildEquipPanel(); // Refresh weapon availability
  await loadClassAnimations(classId);
  buildAnimButtons();
}

// ── Stats ────────────────────────────────────────────────────────────────────

const ATTR_KEYS = ['str','dex','int','vit','wis','lck','cha','end'];
const ATTR_LABELS = { str:'STR', dex:'DEX', int:'INT', vit:'VIT', wis:'WIS', lck:'LCK', cha:'CHA', end:'END' };
let statFills = {};
let statVals = {};

function buildStats() {
  const container = document.getElementById('stats-container');
  container.innerHTML = '';
  statFills = {};
  statVals = {};

  for (const key of ATTR_KEYS) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <span class="stat-label">${ATTR_LABELS[key]}</span>
      <div class="stat-track"><div class="stat-fill" id="sf-${key}"></div></div>
      <span class="stat-val" id="sv-${key}">0</span>
    `;
    container.appendChild(row);
    statFills[key] = row.querySelector(`#sf-${key}`);
    statVals[key] = row.querySelector(`#sv-${key}`);
  }
  updateStats();
}

function updateStats() {
  const race = RACES[activeRace];
  const cls = CLASSES[activeClass];
  const MAX = 25;
  for (const key of ATTR_KEYS) {
    const base = race.stats[key] || 0;
    const bonus = cls.statBonus[key] || 0;
    const total = base + bonus;
    statFills[key].style.width = `${Math.min((total / MAX) * 100, 100)}%`;
    statVals[key].textContent = String(total);
  }
}

// ── Equipment Panel ──────────────────────────────────────────────────────────

function buildEquipPanel() {
  const container = document.getElementById('equip-container');
  container.innerHTML = '';

  if (!currentEquipMgr) return;
  const summary = currentEquipMgr.getSlotSummary();
  const cls = CLASSES[activeClass];

  for (const [groupLabel, slots] of SLOT_UI) {
    let groupHasContent = false;

    const groupDiv = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'equip-group-label';
    label.textContent = groupLabel;
    groupDiv.appendChild(label);

    for (const [slot, displayName] of slots) {
      const info = summary[slot];
      if (!info || info.variants.length === 0) continue;
      groupHasContent = true;

      const isWeapon = ['sword','axe','hammer','pick','spear','bow','staff'].includes(slot);
      const isLocked = isWeapon && !cls.allowedWeapons.has(slot);

      const row = document.createElement('div');
      row.className = 'equip-row';

      const slotLabel = document.createElement('span');
      slotLabel.className = 'equip-slot-label';
      slotLabel.textContent = displayName + (isLocked ? ' 🔒' : '');
      if (isLocked) slotLabel.style.opacity = '0.4';
      row.appendChild(slotLabel);

      const variantsDiv = document.createElement('div');
      variantsDiv.className = 'equip-variants';

      // "None" button for weapons/shields/utility
      if (isWeapon || slot === 'shield' || ['bag','wood','quiver'].includes(slot)) {
        const noneBtn = document.createElement('button');
        noneBtn.className = 'equip-btn' + (!info.equipped ? ' active' : '');
        noneBtn.textContent = '—';
        if (isLocked) {
          noneBtn.classList.add('locked');
          noneBtn.disabled = true;
        }
        noneBtn.addEventListener('click', () => {
          if (isLocked) return;
          if (isWeapon) {
            currentEquipMgr.equipWeapon(slot); // hides all weapons
            currentEquipMgr.unequip(slot);
          } else {
            currentEquipMgr.unequip(slot);
          }
          buildEquipPanel();
        });
        variantsDiv.appendChild(noneBtn);
      }

      for (const v of info.variants) {
        const btn = document.createElement('button');
        btn.className = 'equip-btn' + (info.equipped === v ? ' active' : '');
        btn.textContent = v === 'default' ? '✦' : v;

        if (isLocked) {
          btn.classList.add('locked');
          btn.disabled = true;
        }

        btn.addEventListener('click', () => {
          if (isLocked) return;
          if (isWeapon) {
            currentEquipMgr.equipWeapon(slot, v);
          } else {
            currentEquipMgr.equip(slot, v);
          }
          buildEquipPanel();
        });
        variantsDiv.appendChild(btn);
      }

      row.appendChild(variantsDiv);
      groupDiv.appendChild(row);
    }

    if (groupHasContent) container.appendChild(groupDiv);
  }
}

// ── Animation Buttons ────────────────────────────────────────────────────────

function buildAnimButtons() {
  const container = document.getElementById('anim-grid');
  container.innerHTML = '';

  // Determine which anim keys to show
  const baseKeys = Object.keys(BASE_ANIMS);
  const cls = CLASSES[activeClass];
  const pack = CLASS_ANIM_PACKS[cls.animPack];
  const classKeys = pack ? Object.keys(pack.anims) : [];

  // Base anims
  for (const key of baseKeys) {
    addAnimBtn(container, key, ANIM_DISPLAY[key] || key);
  }

  // Separator
  if (classKeys.length > 0) {
    const sep = document.createElement('div');
    sep.style.cssText = 'width:100%;height:1px;background:rgba(200,169,81,0.1);margin:4px 0;';
    container.appendChild(sep);
  }

  // Class-specific anims (only show ones with display names to keep it manageable)
  for (const key of classKeys) {
    if (ANIM_DISPLAY[key]) {
      addAnimBtn(container, key, ANIM_DISPLAY[key]);
    }
  }
}

function addAnimBtn(container, key, label) {
  const btn = document.createElement('button');
  btn.className = 'anim-btn';
  btn.dataset.key = key;
  btn.textContent = label;
  const isLoop = ['idle','combatIdle','combatRun','ss_idle','ss_run','bow_idle',
    'bow_runFwd','mag_idle','mag_runFwd','mag_sprint','ss_walk','ss_blockIdle',
    'mag_crouchIdle','ss_crouchIdle','bow_aimWalkFwd'].includes(key);
  btn.addEventListener('click', () => playAnim(key, isLoop));
  container.appendChild(btn);
}

// ── Enter World ──────────────────────────────────────────────────────────────

function wireEnterWorld() {
  document.getElementById('enter-world-btn').addEventListener('click', () => {
    const params = new URLSearchParams({
      race: activeRace,
      class: activeClass,
      equip: JSON.stringify(currentEquipMgr?.equipped || {}),
    });
    window.location.href = `./index.html?${params.toString()}`;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING OVERLAY
// ═══════════════════════════════════════════════════════════════════════════════

function updateLoading(pct, msg) {
  const fill = document.getElementById('loader-fill');
  const status = document.getElementById('loading-status');
  if (fill) fill.style.width = `${Math.min(pct, 100)}%`;
  if (status) status.textContent = msg;
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════

(async () => {
  updateLoading(5, 'Initializing…');

  await initScene();
  updateLoading(20, 'Building UI…');

  buildUI();
  updateLoading(30, 'Loading character…');

  await loadRace(activeRace);
  await loadClassAnimations(activeClass);
  buildAnimButtons();

  updateLoading(100, 'Ready');
  setTimeout(hideLoading, 400);
})();
