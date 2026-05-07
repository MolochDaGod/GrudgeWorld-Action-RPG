# Grudge Warlords — Project Rules

## Identity
- Project: **Grudge Warlords** — 3D Action RPG by **Racalvin The Pirate King** at Grudge Studio
- Engine: **Babylon.js** (WebGL, no build step, ES modules via `<script type="module">`)
- Live: https://grudgeworld-action-rpg.onrender.com/
- Repo: https://github.com/MolochDaGod/GrudgeWorld-Action-RPG

## Rendering Pipeline — Single Source of Truth

**Every character in the game goes through ONE function: `loadRaceCharacter()` in `src/character/raceHero.js`.**

No scene should ever:
- Create character meshes directly
- Load GLB models outside of `raceHero.js`
- Apply materials to character meshes outside the pipeline
- Use the old `hero.js` or `HumanBaseMesh` — these are deleted

The pipeline:
1. Load race GLB → `assets/glb/characters/races/{race}.glb`
2. Load external texture + normal → `assets/textures/races/{race}/texture.png` + `normal.png`
3. Classify each mesh by part type → `classifyMeshPart()` in `GrudgeFactionRegistry.js`
4. Create `PBRMaterial` per mesh with slot-appropriate roughness/metalness from `SLOT_PBR_PROPS`
5. Equipment catalog → `GrudgeEquipmentManager` using `SLOT_PATTERNS` (handles both `Units_Body_A` and `body_A` naming)
6. Apply class build → `ARMOR_PRESETS[race][armorType]` for mesh variants + `CLASS_WEAPON_PRESETS[race][class]` for weapons
7. Scale + ground in **local space** (detach parent → compute bounds → reattach)
8. Load + retarget animations

### Mesh Variants ARE Different Armor
Body_A, Body_B, Body_C etc. are **different 3D models** (plate, leather, robes) — not material swaps. Class switching must change the visible mesh variant via `applyClassBuild()`.

### Class Builds
| Class | Armor Type | PBR Profile |
|-------|-----------|-------------|
| Warrior | `metal` | roughness 0.30-0.42, metalness 1.0 |
| Ranger | `leather` | roughness 0.55-0.72, metalness 0.0 |
| Mage | `cloth` | roughness 0.85-0.95, metalness 0.0 |
| Worge | `leather` | same as ranger |

## Scene Architecture

### Character Creator (F4)
Uses a **dedicated `BABYLON.Engine`** on its own `<canvas id="cc-preview-canvas">` inside the left panel. The main engine gets an empty dark scene. This ensures:
- Character framing is independent of the game viewport
- Camera, lighting, and platform are self-contained
- Equipment switching updates only the preview scene

### Gameplay Scenes (F1 outdoor, F2 inn, F3 builder)
All use `loadPlayerCharacter()` from `PlayerCharacter.js` which:
- Reads `CHAR_SELECT.race`, `.class`, `.equip` from the global
- Calls `loadRaceCharacter()` with the selected `classId`
- Offsets `hero.position.y = -capsuleHalfHeight` for the physics capsule
- Builds the animation bridge (`BreathingIdle`, `Running`, `Attack`, etc.)

### SceneManager
- Disposes the active scene before loading a new one
- Navigation: `SCENE_MANAGER.navigateTo(key)`
- Hotkeys: F1=outdoor, F2=inn, F3=builder, F4=character_create

## Resource Management — No Leaks

### On Character Dispose (`RaceCharacter.dispose()`)
1. Stop all animation groups
2. **Dispose** all animation groups (not just stop)
3. Dispose materials (matched by `raceId_` prefix, don't dispose shared textures)
4. Dispose meshes
5. Dispose skeleton

### On Class Switch
Dispose previous class animation groups **before** loading new ones.

### On Race Switch
Dispose class anims first (they reference the old skeleton), then dispose the race character.

## Naming Conventions

### Mesh Names (from Toon RTS GLBs)
- `{PREFIX}_{SlotPattern}` — e.g. `WK_Units_Body_B`, `BRB_body_C`
- Barbarian uses NO `Units_` prefix; all others do
- `SLOT_PATTERNS` use `(?:Units_)?` to match both

### Material Names
- `{raceId}_{meshName}_mat` — enables cleanup by prefix

### Animation Group Names
- Base anims: `idle`, `combatIdle`, `combatRun`, `attack1`–`attack3`, `death`, `hit`, `block`
- Class packs: `ss_idle`, `bow_idle`, `mag_idle`, etc.

## Data Sources

### Grudge SDK (`src/lib/grudgeSDK.js`)
- **Primary**: `https://assets.grudge-studio.com/api/v1/` (R2 CDN)
- **Worker API**: `https://objectstore.grudge-studio.com` (D1)
- **Fallback**: `https://molochdagod.github.io/ObjectStore/api/v1/` (GitHub Pages)
- 5-minute in-memory cache with retry

### Puter.js Integration
- Auth: puter login → creates Grudge ID
- AI: `puter.ai.chat()` for agents, NPC dialogue, mission generation
- Storage: `puter.kv` / `puter.fs` for player data (NOT localStorage)
- Frontend branding: show Grudge logo, not puter logo

## Babylon.js Patterns

### PBR Materials
- Always set `directIntensity`, `specularIntensity`, `environmentIntensity` on character materials — PBR renders black without IBL
- Use `PBRMaterial`, not `StandardMaterial`, for characters
- `backFaceCulling = true`, `forceIrradianceInFragment = true`

### Vector3 API
- Use `copyFromFloats(x, y, z)` — works in ALL Babylon versions
- Do NOT use `setAll()` — may not exist in older builds

### Texture Loading
- `invertY = false` for GLB textures (they use glTF convention)
- `gammaSpace = true` for albedo textures
- `anisotropicFilteringLevel = 8`
- Cache textures in a module-level `Map` to avoid reloading

### Skeleton Handling
- Pick the skeleton with the most joints (`reduce` over `result.skeletons`)
- Root motion suppression on `Bip001`, `RootNode`, or `Bip001 Pelvis`
- Lock position only, NOT rotation (Bip001 has critical bind-pose rotation)

### Bounding Box
- Always use **visible-mesh-only** bounds for grounding
- Detach from parent before computing bounds, reattach after
- This prevents physics capsule world position from corrupting local grounding

## File Organization

```
.gruda/              Project rules (this file)
assets/
  glb/characters/    6 race GLBs
  glb/anims/         170+ animation GLBs (base, sword_shield, longbow, magic, extras)
  glb/vfx/           VFX mesh models (fireball, ice lance, potion)
  textures/races/    Per-race texture.png + normal.png
  textures/lighting/ environment.env, skybox
src/
  character/
    PlayerCharacter.js    Unified loader for gameplay scenes
    raceHero.js           THE rendering pipeline — single source of truth
    GrudgeFactionRegistry.js  Races, slots, presets, PBR tables, mesh classification
    GrudgeEquipmentManager.js  Slot-based mesh visibility
  scene/
    SceneManager.js       Scene orchestrator
    scenes/               One file per scene (outdoor, inn, builder, character_create)
  combat/                 Spells, effects, weapon skills
  lib/grudgeSDK.js        ObjectStore API client
  utils/                  Camera, HUD, VFX, physics, movement
  ui/                     Panels (target frame, settings, admin)
  styles/                 CSS (characterCreator.css)
```

## Git Practices
- Single branch: `main`
- Push with `--no-verify` (Git LFS hook present but LFS not installed)
- Render auto-deploys from `main` in ~2 minutes
- Co-author: `Co-Authored-By: Oz <oz-agent@warp.dev>`

## What NOT to Do
- Do NOT use `localStorage` for player data — use puter or backend
- Do NOT create character meshes outside `raceHero.js`
- Do NOT leave animation groups or materials undisposed on character switch
- Do NOT use `Vector3.setAll()` — use `copyFromFloats()`
- Do NOT use the old `hero.js` or `HumanBaseMesh` path — it's deleted
- Do NOT make the character creator use the main canvas — it has its own engine
- Do NOT hardcode `groundOffset: -1.1` — grounding is computed dynamically
