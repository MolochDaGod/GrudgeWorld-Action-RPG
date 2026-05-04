# Grudge Warlords — 3D Action RPG

## Links
- **Live**: https://grudgeworld-action-rpg.onrender.com/
- **Repo**: https://github.com/MolochDaGod/GrudgeWorld-Action-RPG
- **Crafting Hub**: https://grudge-crafting.puter.site/
- **Info Hub**: https://info.grudge-studio.com/
- **ObjectStore API**: https://molochdagod.github.io/ObjectStore/api/v1/

## Deployment
Render static site — auto-deploys from `main` branch in ~2 minutes. No build step.

```
git push origin main  →  Render detects change  →  serves static files from repo root
```

## Scenes

| Hotkey | Scene | Description |
|--------|-------|-------------|
| F4 | Character Create | Default landing. Race/class/equipment selection with real ObjectStore data. |
| F1 | Outdoor | Open world with terrain, enemies, combat, water, post-processing. |
| F2 | Inn | Interior tavern scene. |
| F3 | Builder | Procedural world editor with dungeon kit. |

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Q / E | Strafe |
| Space | Jump |
| Ctrl | Roll / Dodge |
| F | Sprint toggle |
| LMB | Attack combo |
| 1 | Thunderball (target required) |
| 2 | Triple Orb AOE |
| 3 | Dash / Charge at target |
| 4 | Spell cast at target |
| 5 | Heavy swing (target required) |
| R | Fireball (target required) |
| Tab | Cycle enemy target |
| RMB | Aim mode |
| X | Shoulder swap |
| F5 | FPS camera toggle |
| C | Main panel |
| Escape | Settings (keybind remapping) |
| P | Admin panel (Object Storage browser) |

All keybinds are remappable via the Settings panel (Escape) and persist to localStorage.

## Character System

`PlayerCharacter.js` is the single entry point for all scenes:
```js
const pc = await loadPlayerCharacter(scene, parentNode);
const { hero, skeleton, anim, raceName, factionColor } = pc;
```

- Reads `CHAR_SELECT.race` / `.class` / `.equip` from character creation
- Loads race GLB from `assets/glb/characters/races/`
- Builds animation bridge mapping race anims to movement.js names
- Hot-swaps jump/roll/block GLBs asynchronously
- No fallback to old HumanBaseMesh — race GLB is the only path

### 6 Races (Toon_RTS)
| Race | Prefix | Faction | GLB |
|------|--------|---------|-----|
| Human | WK_ | Crusade | human.glb |
| Barbarian | BRB_ | Crusade | barbarian.glb |
| Elf | ELF_ | Fabled | elf.glb |
| Dwarf | DWF_ | Fabled | dwarf.glb |
| Orc | ORC_ | Legion | orc.glb |
| Undead | UD_ | Legion | undead.glb |

### Equipment Slots
Body (A–E), Arms (A–D), Legs (A–C), Head (A–I), Shoulders (A–B), Sword (A–B), Axe (A–B), Hammer (A–B), Pick, Spear, Bow, Staff (A–C), Shield (A–D), Backpack, Wood, Quiver.

## Animations (171 GLBs)

| Pack | Count | Path |
|------|-------|------|
| Base | 9 | `assets/glb/anims/base/` |
| Sword & Shield | 45 | `assets/glb/anims/sword_shield/` |
| Longbow | 39 | `assets/glb/anims/longbow/` |
| Magic | 52 | `assets/glb/anims/magic/` |
| Warrior Packs | 13 | `assets/glb/anims/warrior_packs/` |
| Extras | 7 | `assets/glb/anims/extras/` |

Convert new FBX files: `powershell -File scripts/convert-fbx-to-glb.ps1`

## Grudge SDK

`src/lib/grudgeSDK.js` — cached fetch client for all ObjectStore endpoints:

| Method | Data |
|--------|------|
| `fetchRaces()` | 6 races with factions, bonuses, lore |
| `fetchClasses()` | 4 classes with abilities, weapon types |
| `fetchAttributes()` | 8 attributes |
| `fetchFactions()` | 3 factions |
| `fetchMasterItems()` | 920+ items with GRUDGE UUIDs |
| `fetchMasterRecipes()` | 220 crafting recipes |
| `fetchMasterMaterials()` | 254 materials |
| `fetchMasterArtifacts()` | Artifact catalog |
| `fetchMasterAttributes()` | 8 attrs + 37 derived stats |
| `fetchWeaponSkills(type)` | Weapon skills via Worker API |

## UI Panels

| Panel | File | Trigger |
|-------|------|---------|
| Player HUD | `src/utils/HUD.js` | Always visible (top-left) |
| Target Frame | `src/ui/TargetFrame.js` | Tab-select enemy (top-center) |
| Settings | `src/ui/SettingsPanel.js` | Escape key |
| Admin | `src/ui/AdminPanel.js` | P key |
| Keybind Manager | `src/utils/KeybindManager.js` | Used by Settings panel |
| Hotbar | `src/utils/Hotbar.js` | Bottom toolbar |

## File Structure

```
assets/
  glb/
    characters/races/    6 race GLBs
    anims/base/          9 base animation GLBs
    anims/sword_shield/  45 sword & shield GLBs
    anims/longbow/       39 longbow GLBs
    anims/magic/         52 magic GLBs
    anims/warrior_packs/ 13 warrior pack GLBs
    anims/extras/        7 extra GLBs
    effects/             effect model GLBs
src/
  character/
    PlayerCharacter.js   Unified character loader
    raceHero.js          Race GLB loading + equipment + retargeting
    GrudgeEquipmentManager.js  Slot-based equipment visibility
    GrudgeFactionRegistry.js   Race/anim/slot data
    CharacterStateMachine.js   FSM with 12 states
  scene/
    SceneManager.js      Scene orchestrator (F1–F4)
    scenes/outdoor.js    Main gameplay scene
    scenes/character_create.js  Character creation (F4)
    scenes/builder.js    World editor
    scenes/inn.js        Tavern interior
  ui/
    TargetFrame.js       Enemy target HUD
    SettingsPanel.js     Settings + keybind remapping
    AdminPanel.js        Object Storage browser
  lib/
    grudgeSDK.js         ObjectStore API client
  utils/
    HUD.js               Player health/stamina HUD
    KeybindManager.js    Rebindable keybinds + hotbar
    GrudgeCamera.js      TPS/FPS camera
    vfx.js               Spell visual effects
  combat/
    SPELLS.js            Spell definitions
    spell.js             Spell base classes
  movement.js            Character movement + input
scripts/
  convert-fbx-to-glb.ps1  Batch FBX→GLB converter
```
