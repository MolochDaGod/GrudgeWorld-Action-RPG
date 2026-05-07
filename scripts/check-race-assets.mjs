import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const racesDir = path.join(repoRoot, "assets", "glb", "characters", "races");
const expected = ["human", "barbarian", "elf", "dwarf", "orc", "undead"];

function readGlbJson(glbPath) {
  const buf = fs.readFileSync(glbPath);
  if (buf.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`Invalid GLB header in ${glbPath}`);
  }

  const jsonChunkLength = buf.readUInt32LE(12);
  const jsonChunkType = buf.readUInt32LE(16);
  if (jsonChunkType !== 0x4e4f534a) {
    throw new Error(`First GLB chunk is not JSON in ${glbPath}`);
  }

  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonChunkLength;
  return JSON.parse(buf.toString("utf8", jsonStart, jsonEnd));
}

function isLikelyPlaceholderImageUri(uri) {
  if (!uri || typeof uri !== "string") return false;
  return uri.startsWith(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABC",
  );
}

function validateRace(raceId) {
  const file = path.join(racesDir, `${raceId}.glb`);
  if (!fs.existsSync(file)) {
    return { raceId, ok: false, problems: [`Missing file: ${file}`] };
  }

  const gltf = readGlbJson(file);
  const problems = [];

  const meshes = gltf.meshes || [];
  const materials = gltf.materials || [];
  const images = gltf.images || [];

  if (meshes.length === 0) problems.push("No meshes found.");
  if (materials.length === 0) problems.push("No materials found.");
  if (images.length === 0) {
    problems.push("No images found in GLB (likely untextured export).");
  }

  for (const img of images) {
    if (isLikelyPlaceholderImageUri(img.uri)) {
      problems.push(
        "Found 1x1 placeholder image in GLB. Re-export with real textures embedded.",
      );
      break;
    }
  }

  return { raceId, ok: problems.length === 0, problems };
}

let hasErrors = false;
const results = expected.map(validateRace);

for (const result of results) {
  if (result.ok) {
    console.log(`OK: ${result.raceId}`);
    continue;
  }

  hasErrors = true;
  console.error(`FAIL: ${result.raceId}`);
  for (const p of result.problems) {
    console.error(`  - ${p}`);
  }
}

if (hasErrors) {
  console.error("\nRace asset validation failed.");
  process.exit(1);
}

console.log("\nRace asset validation passed.");
