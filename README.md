# Grudge Warlords — 3D Action RPG

A Babylon.js browser-based action RPG featuring 6 playable races, 4 classes, real-time combat, and a full character creation system. Built by **Racalvin The Pirate King** at Grudge Studio.

## Play Now

**[▶ Play Live](https://grudgeworld-action-rpg.onrender.com/)** — no install, runs in your browser.

## Features

- **6 Races** — Human, Barbarian, Elf, Dwarf, Orc, Undead — each with unique Toon RTS models, textures, and equipment variants
- **4 Classes** — Warrior (metal plate + sword & shield), Ranger (leather + bow), Mage (cloth robes + staff), Worge (leather + axe/hammer/mace)
- **Character Creator** (F4) — full-screen overlay with 3D preview, race/class selection, equipment cycling, weapon-based skills panel, animation preview
- **Open World** (F1) — terrain, enemies, physics, combat, water, post-processing
- **Inn** (F2) — interior tavern scene with GI lighting
- **Builder** (F3) — procedural world editor with dungeon building kit
- **170+ Animations** — sword & shield, longbow, magic, emotes, dances, jumps
- **Spell System** — 15+ spells with VFX (slash, lightning, plasma burst, ground crater, projectiles)
- **Per-Slot PBR Materials** — metal/leather/cloth roughness and metalness matched to the reference pipeline
- **Grudge SDK** — live game data from R2 CDN (920+ items, 220 recipes, 8 attributes, weapon skills)

## Scenes

| Hotkey | Scene | Description |
|--------|-------|-------------|
| F4 | Character Create | Default landing — race, class, equipment, skills, animations |
| F1 | Outdoor | Open world — terrain, enemies, combat, water |
| F2 | Inn | Interior tavern with GI lighting |
| F3 | Builder | Procedural world editor |

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Q / E | Strafe |
| Space | Jump |
| Ctrl | Roll / Dodge |
| F | Sprint |
| LMB | Attack combo |
| Tab | Cycle target |
| RMB | Aim mode |
| 1–5, R | Spells |
| C | Main panel |
| Escape | Settings |
| P | Admin panel |

All keybinds are remappable via Settings (Escape) and persist to localStorage.

## Character Pipeline

Single rendering path for all scenes — `loadRaceCharacter()` in `raceHero.js`:

1. Load race GLB model
2. Load external texture atlas + normal map (per race)
3. Classify each mesh by slot (head, body, arms, legs, weapons, shields)
4. Create PBRMaterial per mesh with slot-appropriate roughness/metalness
5. Apply class build — swap armor meshes (plate/leather/cloth) + weapon
6. Scale to target height using visible-mesh-only bounding box
7. Ground model at local y=0, face camera
8. Load and retarget animations to skeleton

### Class Builds

| Class | Armor | Weapon | Shield |
|-------|-------|--------|--------|
| Warrior | Metal (plate) | Sword | Yes |
| Ranger | Leather | Bow | No |
| Mage | Cloth (robes) | Staff | No |
| Worge | Leather | Axe/Hammer/Mace | No |

Each class uses different body/arms/legs mesh variants per race — not just material swaps.

### 6 Races

| Race | Prefix | Faction | Model |
|------|--------|---------|-------|
| Human | WK_ | Crusade | human.glb |
| Barbarian | BRB_ | Crusade | barbarian.glb |
| Elf | ELF_ | Fabled | elf.glb |
| Dwarf | DWF_ | Fabled | dwarf.glb |
| Orc | ORC_ | Legion | orc.glb |
| Undead | UD_ | Legion | undead.glb |

## Run Locally

```bash
git clone https://github.com/MolochDaGod/GrudgeWorld-Action-RPG.git
```

Serve the repo root with any static server (e.g. `npx serve .` or VS Code Live Server), then open `index.html`. No build step needed — save a file and refresh.

## Links

- **Live**: https://grudgeworld-action-rpg.onrender.com/
- **Repo**: https://github.com/MolochDaGod/GrudgeWorld-Action-RPG
- **Grudge Studio**: https://grudge-studio.com
- **Crafting Hub**: https://grudge-crafting.puter.site/
- **Info Hub**: https://info.grudge-studio.com/
- **ObjectStore API**: https://assets.grudge-studio.com/api/v1/

## Deployment

Render static site — auto-deploys from `main` branch in ~2 minutes. No build step.

```
git push origin main  →  Render detects change  →  serves static files
```

## Tech Stack

- **Engine**: Babylon.js (WebGL)
- **Physics**: Havok
- **Data**: Cloudflare R2 CDN + D1 Worker API
- **Hosting**: Render (static site)
- **Assets**: Toon RTS character pack (6 races × 42–50 meshes each)

## Created by

**Racalvin The Pirate King** — Grudge Studio
