# Grudge Warlords — 3D Action RPG

Babylon.js action RPG featuring the 6 Grudge Warlords race characters with full equipment, animation, and class systems.

**Live:** https://grudgeworld-action-rpg.onrender.com/

## Scenes

| Key | Hotkey | Description |
|-----|--------|-------------|
| `character_create` | F4 | Character creation — race/class picker, equipment preview, animation tester |
| `outdoor` | F1 | Open-world terrain with enemies, physics, combat |
| `inn` | F2 | Interior tavern scene |
| `builder` | F3 | Procedural world builder / level editor |

Append `?scene=character_test` for the standalone race viewer (press 1–6 to switch races).

## 6 Race Characters

All characters use the **Toon_RTS** asset pack (Bip001 skeleton, 18 bones). Each race has:

- **Mesh-only GLB** (~250–440KB) at `assets/glb/characters/races/{race}.glb`
- **External textures** (~5MB each) at `assets/textures/races/{race}/texture.png` + `normal.png`
- **Per-race equipment slots** auto-cataloged via prefix-based regex patterns

| Race | Prefix | Height | Faction | Meshes |
|------|--------|--------|---------|--------|
| Human | `WK_` | 1.85m | Crusade | 42 |
| Barbarian | `BRB_` | 1.95m | Crusade | 47 |
| Elf | `ELF_` | 1.80m | Fabled | 47 |
| Dwarf | `DWF_` | 1.60m | Fabled | 48 |
| Orc | `ORC_` | 2.00m | Legion | 48 |
| Undead | `UD_` | 1.90m | Legion | 50 |

### Character Pipeline

```
GLB load → external texture/normal → PBR material per mesh → equipment catalog
→ class preset (armor type + weapon) → scale to targetHeight → animation system
```

Key files:
- `src/character/raceHero.js` — character loading, scaling, skeleton merge, animation
- `src/character/GrudgeFactionRegistry.js` — race definitions, slot patterns, class presets
- `src/character/GrudgeEquipmentManager.js` — equipment visibility, preset application
- `src/character/AnimController.js` — unified animation registry, smooth cross-fade blending
- `src/character/PlayerCharacter.js` — scene integration, movement bridge

### Skeleton Architecture

The Toon_RTS FBX→GLB conversion splits each race model into **16–31 per-part skins** (legs skin = 6 joints, body skin = 14 joints, arms skin = 6 joints). No single skin has all 18 Bip001 bones. `raceHero.js` merges bones from all skins into one skeleton so animation retargeting reaches every bone including R/L Hand (weapon attachment).

### Equipment Slots

Slot patterns in `SLOT_PATTERNS` (case-insensitive, prefix-stripped):
- **Armor:** body (A–H), arms (A–E), legs (A–D), head (A–P), shoulders (A–F)
- **Weapons:** sword, axe, hammer, mace, pick, spear, lance, bow, staff, dagger
- **Defense:** shield (A–D)
- **Extras:** bag, wood, quiver

### Class Builds

| Class | Armor | Default Weapon | Shield |
|-------|-------|---------------|--------|
| Warrior | Metal (plate) | Sword + Shield | Yes |
| Ranger | Leather | Bow | No |
| Mage Priest | Cloth | Staff | No |
| Worge | Leather | Axe | No |

## Animation System

- **Base pack** (9 anims): idle, combatIdle, combatRun, attack1–3, death, hit, block
- **Extras** (40+ anims): sword combos, magic casts, jumps, dances, emotes
- **Weapon packs**: sword+shield, longbow, magic, warrior packs
- **Retargeting**: 3-stage bone lookup (exact → normalized → alias table) handles Mixamo ↔ Bip001

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Q/E | Strafe |
| Space | Jump |
| Ctrl | Roll |
| F | Sprint |
| LMB | Attack combo |
| 3 | Dash to target |
| 1/2/4/5/R | Spells |
| Tab | Target enemy |
| RMB | Aim |
| C | Character panel |
| X | Shoulder view |
| F5 | FPS camera |
| F1–F4 | Switch scenes |

## Development

Static site — no build step. Serve from the project root:

```bash
npx serve . -p 3000 --cors
```

Deployed on Render with auto-deploy from `main` branch.

### Asset Pipeline

Race GLBs are mesh-only (no embedded textures). External PNG textures are loaded at runtime by `raceHero.js`. The old `inject_textures.py` is deprecated.

To reconvert from source FBX:
```bash
node scripts/convert-fresh-fbx-to-glb.mjs
```

To inspect a GLB:
```bash
node scripts/inspect-glb.mjs
```

## Recent Fixes

### Equipment Persistence on Class Switch
`applyPreset()` now explicitly unequips all weapons, shields, shoulders, and extras before equipping the new class preset. Previously, switching classes (e.g. Warrior→Worge) left stale shields visible.

### Root-Motion Pelvis Collapse
Root-motion suppression now preserves the Bip001 rest-pose Y position (pelvis height). Previously it zeroed all 3 axes every frame, collapsing the character flat to the ground.

### Skeleton Bone Merge
Bones from all per-part skins are merged into one skeleton. Previously, the largest single skin (16 bones) was used, missing R/L Hand bones needed for weapon animations.

### GLB Slim-Down
Replaced 3 bloated race GLBs (7–8MB each with embedded TGA textures) with mesh-only fresh versions (250–440KB). Total character download: 24.7MB → 2.1MB.
