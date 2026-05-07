import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';

const SOURCE_ROOT = 'C:/Users/nugye/Desktop/grudgeproduction/grudgenew/FRESH GRUDGE/Assets';
const OUT_ROOT = 'assets/source/grudgeproduction_fresh';

const COPY_DIRS = [
  'Toon_RTS/WesternKingdoms',
  'Toon_RTS/Barbarians',
  'Toon_RTS/Elves',
  'Toon_RTS/Dwarves',
  'Toon_RTS/Orcs',
  'Toon_RTS/Undead',
  '!MAP Assets/Low Poly Castle Siege Pack/Components/Meshes',
  'uMMORPG/Models/Entities/(Public Domain) Horse',
  'Casual RPG Monster - 26 Wolf/Models/Generic'
];

const KEEP_EXT = new Set(['.fbx', '.tga', '.png', '.jpg', '.jpeg', '.csv', '.xlsx', '.txt', '.md']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    const ext = extname(entry).toLowerCase();
    if (KEEP_EXT.has(ext)) out.push(full);
  }
  return out;
}

function copyFilteredDir(srcDir, destDir) {
  const files = walk(srcDir);
  for (const srcFile of files) {
    const rel = relative(srcDir, srcFile);
    const dstFile = join(destDir, rel);
    mkdirSync(dirname(dstFile), { recursive: true });
    cpSync(srcFile, dstFile, { force: true });
  }
  return files.length;
}

function main() {
  if (!existsSync(SOURCE_ROOT)) {
    throw new Error(`Source root not found: ${SOURCE_ROOT}`);
  }

  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });

  const report = [];
  let total = 0;

  for (const relDir of COPY_DIRS) {
    const src = join(SOURCE_ROOT, relDir);
    const dst = join(OUT_ROOT, relDir);
    if (!existsSync(src)) {
      report.push({ relDir, count: 0, exists: false, error: 'missing source' });
      continue;
    }
    try {
      const count = copyFilteredDir(src, dst);
      total += count;
      report.push({ relDir, count, exists: true, error: null });
    } catch (err) {
      report.push({ relDir, count: 0, exists: true, error: String(err?.message || err) });
    }
  }

  const lines = [];
  lines.push('# Fresh Source Import Report');
  lines.push('');
  lines.push(`Source: ${SOURCE_ROOT}`);
  lines.push(`Destination: ${OUT_ROOT}`);
  lines.push(`Files copied: ${total}`);
  lines.push('');
  for (const item of report) {
    if (!item.exists) {
      lines.push(`- ${item.relDir}: MISSING SOURCE`);
      continue;
    }
    if (item.error) {
      lines.push(`- ${item.relDir}: ERROR (${item.error})`);
      continue;
    }
    lines.push(`- ${item.relDir}: ${item.count}`);
  }
  lines.push('');
  lines.push('This import intentionally excludes Unity Library/package-cache content.');

  writeFileSync('scripts/fresh-import-report.md', lines.join('\n'));
  console.log(`Imported ${total} files into ${OUT_ROOT}`);
}

main();
