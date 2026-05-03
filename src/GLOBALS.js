let DEBUG = false;

let SCENE_MANAGER = {};

let PLAYER = {};
let DUMMY = {};

var DMGPOP = {};

let HPBAR = {};

let VFX = {};

let SHADERS = {};


let GRID = {};


let MESH_LIBRARY = {};
// Contains:
//   'Plants'
//     'Grass'
//     'Tree'
//   'Buildings'
//     'BuildingType'
//     'Wall'
//     'Roof'

// array of 9 grids, to load in dynamically around the player
let GRIDS;

let TOOLS;

let targetBaseOnCameraView = true; // if false target based on character rotation
// use touch joystick for mobile options

let DYNAMIC_CAMERA = false;
// Used for game controller on pc and shows joystick on mobile.
// Emulates KOA smooth camera follow effect  
let ON_MOBILE = true
let CANVASES = []; //One canvas For Game, one for Mobile Input Detection

// todo move this from global. used for mobile input
let inputMap = {};


let FAST_RELOAD = false; //Enable for fast development, disable for prod 

// Character selection from select.html
let CHAR_SELECT = (() => {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      race:  p.get('race')  || 'human',
      class: p.get('class') || 'warrior',
      equip: p.has('equip') ? JSON.parse(p.get('equip')) : null,
    };
  } catch (_) {
    return { race: 'human', class: 'warrior', equip: null };
  }
})();

// Graphics Settings
let WEBGPU = false; //otherwise use WebGL
