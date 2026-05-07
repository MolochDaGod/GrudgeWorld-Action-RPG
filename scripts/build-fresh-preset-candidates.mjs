import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = 'assets/source/grudgeproduction_fresh/Toon_RTS';
const OUT_JSON = 'assets/source/grudgeproduction_fresh/preset-candidates.json';
const OUT_CSV = 'assets/source/grudgeproduction_fresh/preset-candidates.csv';

const raceDirs = {
  human: 'WesternKingdoms',
  barbarian: 'Barbarians',
  elf: 'Elves',
  dwarf: 'Dwarves',
  orc: 'Orcs',
  undead: 'Undead'
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (/\.fbx$/i.test(entry)) out.push(full);
  }
  return out;
}

function detectType(name) {
  const n = name.toLowerCase();
  if (n.includes('sword')) return 'sword';
  if (n.includes('axe')) return 'axe';
  if (n.includes('hammer')) return 'hammer';
  if (n.includes('spear')) return 'spear';
  if (n.includes('bow')) return 'bow';
  if (n.includes('staff')) return 'staff';
  if (n.includes('shield')) return 'shield';
  return null;
}

const out = { generatedAt: new Date().toISOString(), races: {} };
const rows = ['race,slot,variant,sourceFile'];

for (const [raceId, raceFolder] of Object.entries(raceDirs)) {
  const equipRoot = join(SRC, raceFolder, 'models');
  const files = walk(equipRoot).filter((p) => /equipment|extra models|extra_models/i.test(p));

  const slots = {
    sword: [], axe: [], hammer: [], spear: [], bow: [], staff: [], shield: []
  };

  for (const file of files) {
    const fileName = basename(file);
    const type = detectType(fileName);
    if (!type) continue;
    const m = fileName.match(/_([A-F])\.(fbx)$/i);
    const variant = m ? m[1].toUpperCase() : 'A';
    const rec = { variant, source: file.replace(/\\/g, '/') };
    if (!slots[type].some((x) => x.source === rec.source)) slots[type].push(rec);
  }

  for (const slot of Object.keys(slots)) {
    slots[slot].sort((a, b) => a.variant.localeCompare(b.variant));
    for (const it of slots[slot]) {
      rows.push(`${raceId},${slot},${it.variant},${it.source}`);
    }
  }

  const firstWeapon = ['sword', 'axe', 'hammer', 'spear', 'bow', 'staff'].find((s) => slots[s].length > 0);
  out.races[raceId] = {
    starterPresetSuggestion: {
      body: 'A',
      arms: 'A',
      legs: 'A',
      head: 'A',
      weapon: firstWeapon ? { type: firstWeapon, variant: slots[firstWeapon][0].variant } : null,
      shield: slots.shield[0]?.variant || null
    },
    available: slots
  };
}

writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
writeFileSync(OUT_CSV, rows.join('\n'));
console.log(`Wrote ${OUT_JSON} and ${OUT_CSV}`);
