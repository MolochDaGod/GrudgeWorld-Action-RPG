import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const FBX2GLTF = 'C:/Users/nugye/npm-global/node_modules/fbx2gltf/bin/Windows_NT/FBX2glTF.exe';
const SRC = 'assets/source/grudgeproduction_fresh';
const OUT = 'assets/glb/fresh';

const raceModels = {
  human: 'Toon_RTS/WesternKingdoms/models/WK_Characters_customizable.FBX',
  barbarian: 'Toon_RTS/Barbarians/models/BRB_Characters_customizable.FBX',
  elf: 'Toon_RTS/Elves/models/ELF_Characters_customizable.FBX',
  dwarf: 'Toon_RTS/Dwarves/models/DWF_Characters_customizable.FBX',
  orc: 'Toon_RTS/Orcs/models/ORC_Characters_Customizable.FBX',
  undead: 'Toon_RTS/Undead/models/UD_Characters_customizable.FBX'
};

function slug(name) {
  return name
    .replace(/\.fbx$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

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

function convert(inputPath, outputGlbPath) {
  mkdirSync(dirname(outputGlbPath), { recursive: true });
  const outputStem = outputGlbPath.replace(/\.glb$/i, '');
  const res = spawnSync(FBX2GLTF, ['--binary', '--input', inputPath, '--output', outputStem], {
    stdio: 'pipe',
    timeout: 120000,
    killSignal: 'SIGKILL'
  });
  const timedOut = !!res.error && res.error.code === 'ETIMEDOUT';
  const ok = !timedOut && res.status === 0 && existsSync(`${outputStem}.glb`);
  return {
    ok,
    timedOut,
    status: res.status,
    stderr: String(res.stderr || ''),
    stdout: String(res.stdout || ''),
    inputPath,
    outputGlbPath: `${outputStem}.glb`
  };
}

function main() {
  if (!existsSync(FBX2GLTF)) throw new Error(`FBX2glTF not found at ${FBX2GLTF}`);

  const tasks = [];

  for (const [race, rel] of Object.entries(raceModels)) {
    tasks.push({
      kind: 'race',
      inPath: join(SRC, rel),
      outPath: join(OUT, 'characters', 'races', `${race}.glb`)
    });
  }

  const mountsAndSiege = walk(join(SRC, 'Toon_RTS'))
    .filter((p) => /cavalry|catapult|boltthrower/i.test(p))
    .concat(
      walk(join(SRC, '!MAP Assets/Low Poly Castle Siege Pack/Components/Meshes')).filter((p) => /ballista|catapult|ram|siege_tower|trebuchet/i.test(p)),
      walk(join(SRC, 'uMMORPG/Models/Entities/(Public Domain) Horse')),
      walk(join(SRC, 'Casual RPG Monster - 26 Wolf/Models/Generic'))
    );

  const seen = new Set();
  for (const src of mountsAndSiege) {
    const key = src.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const name = slug(basename(src));
    const bucket = /catapult|ballista|ram|siege_tower|trebuchet/i.test(src) ? 'siege' : 'mounts';
    tasks.push({ kind: bucket, inPath: src, outPath: join(OUT, bucket, `${name}.glb`) });
  }

  const report = [];
  let okCount = 0;

  for (const task of tasks) {
    if (!existsSync(task.inPath)) {
      report.push({ ...task, ok: false, missing: true });
      continue;
    }
    const result = convert(task.inPath, task.outPath);
    report.push({ ...task, ...result, missing: false });
    if (result.ok) okCount++;
  }

  const lines = [];
  lines.push('# Fresh FBX -> GLB Conversion Report');
  lines.push('');
  lines.push(`Source root: ${SRC}`);
  lines.push(`Output root: ${OUT}`);
  lines.push(`Converted: ${okCount}/${tasks.length}`);
  lines.push('');
  for (const item of report) {
    const status = item.ok
      ? 'OK'
      : (item.missing ? 'MISSING' : (item.timedOut ? 'TIMEOUT' : `FAIL(${item.status})`));
    lines.push(`- [${item.kind}] ${status}: ${item.inPath} -> ${item.outPath}`);
  }

  writeFileSync('scripts/fresh-convert-report.md', lines.join('\n'));
  console.log(`Converted ${okCount}/${tasks.length}. Report: scripts/fresh-convert-report.md`);
}

main();
