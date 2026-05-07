import { readFileSync } from "fs";

function inspectGlb(path) {
  const buf = readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));

  // Bip001 / RootNode info
  const bip = (gltf.nodes || []).find(
    (n) => n.name === "Bip001" || n.name === "mixamorigHips",
  );
  if (bip)
    console.log(
      "Root bone:",
      bip.name,
      "scale:",
      JSON.stringify(bip.scale),
      "translation:",
      JSON.stringify(bip.translation?.map((v) => +v.toFixed(4))),
    );

  // Aggregate Y bounds across ALL VEC3 accessors
  let minY = Infinity,
    maxY = -Infinity;
  let minX = Infinity,
    maxX = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const a of gltf.accessors || []) {
    if (a.type === "VEC3" && a.min && a.max) {
      if (a.min[0] < minX) minX = a.min[0];
      if (a.max[0] > maxX) maxX = a.max[0];
      if (a.min[1] < minY) minY = a.min[1];
      if (a.max[1] > maxY) maxY = a.max[1];
      if (a.min[2] < minZ) minZ = a.min[2];
      if (a.max[2] > maxZ) maxZ = a.max[2];
    }
  }
  console.log("Aggregate accessor bounds:");
  console.log(
    "  X:",
    minX.toFixed(4),
    "→",
    maxX.toFixed(4),
    "  width:",
    (maxX - minX).toFixed(4),
  );
  console.log(
    "  Y:",
    minY.toFixed(4),
    "→",
    maxY.toFixed(4),
    "  height:",
    (maxY - minY).toFixed(4),
  );
  console.log(
    "  Z:",
    minZ.toFixed(4),
    "→",
    maxZ.toFixed(4),
    "  depth:",
    (maxZ - minZ).toFixed(4),
  );

  // Mesh node world translations
  const meshNodes = (gltf.nodes || []).filter((n) => n.mesh != null);
  if (meshNodes.length) {
    let my1 = Infinity,
      my2 = -Infinity;
    meshNodes.forEach((n) => {
      const y = n.translation ? n.translation[1] : 0;
      if (y < my1) my1 = y;
      if (y > my2) my2 = y;
    });
    console.log(
      `Mesh nodes: ${meshNodes.length}, Y translation range: ${my1.toFixed(4)} → ${my2.toFixed(4)}`,
    );
  }
  console.log(
    "Skins:",
    gltf.skins?.length,
    "  Animations:",
    gltf.animations?.length,
  );
  console.log("");
}

for (const race of ["human", "barbarian", "elf", "dwarf", "orc", "undead"]) {
  console.log(`=== ${race} ===`);
  try {
    inspectGlb(`assets/glb/characters/races/${race}.glb`);
  } catch (e) {
    console.log("ERROR:", e.message);
  }
}
