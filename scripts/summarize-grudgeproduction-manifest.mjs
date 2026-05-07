import { readFileSync } from "fs";

const src = readFileSync("scripts/grudgeproduction_manifest.txt", "utf8")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const fbx = src.filter((p) => /\.fbx$/i.test(p));
const tga = src.filter((p) => /\.tga$/i.test(p));
const sheets = src.filter((p) => /\.(csv|xlsx)$/i.test(p));

function normalizePath(p) {
  return p.replace(/\\/g, "/");
}

function topDirs(paths, depth = 8, limit = 30) {
  const counts = new Map();
  for (const raw of paths) {
    const p = normalizePath(raw);
    const parts = p.split("/");
    const key = parts.slice(0, Math.min(parts.length - 1, depth)).join("/");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function keywordMatches(paths, keywords) {
  return paths
    .filter((p) => {
      const n = normalizePath(p).toLowerCase();
      return keywords.some((k) => n.includes(k));
    })
    .slice(0, 200);
}

console.log("FBX count:", fbx.length);
console.log("TGA count:", tga.length);
console.log("Sheet count:", sheets.length);
console.log("\nTop FBX dirs:");
for (const [k, v] of topDirs(fbx)) console.log(v.toString().padStart(4), k);

console.log("\nLikely race/mount/siege FBX hits:");
const likely = keywordMatches(fbx, [
  "race",
  "mount",
  "horse",
  "wolf",
  "boar",
  "siege",
  "catapult",
  "ballista",
  "cannon",
  "orc",
  "elf",
  "dwarf",
  "human",
  "undead",
  "barbarian",
]);
for (const p of likely) console.log(p);

console.log("\nLikely texture TGAs (race/unit keywords):");
const tex = keywordMatches(tga, [
  "wk_",
  "brb_",
  "elf_",
  "dwf_",
  "orc_",
  "ud_",
  "unit",
  "race",
  "mount",
  "siege",
  "catapult",
  "ballista",
]);
for (const p of tex) console.log(p);

console.log("\nSheets:");
for (const s of sheets) console.log(s);
