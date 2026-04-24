g the#!/usr/bin/env node
/**
 * retarget-anim.mjs
 * CLI tool: retargets a Mixamo GLB animation onto a Grudge Bip001 character.
 *
 * Usage:
 *   node retarget-anim.mjs \
 *     --source  mixamo_running.glb   \
 *     --target  human_character.glb  \
 *     --output  human_running.glb    \
 *     --name    "Running"
 *
 * Requirements:
 *   npm install @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions
 *
 * Workflow:
 *   1. Download your Grudge race FBX, convert to GLB via:
 *        fbx2gltf --input WK_Human.fbx --output human_character.glb
 *   2. Download animation from Mixamo as FBX (no skin), convert:
 *        fbx2gltf --input HipHopDancing.fbx --output mixamo_dancing.glb
 *   3. Run this script to produce human_dancing.glb
 *   4. Load result in Babylon.js with SceneLoader.ImportMeshAsync
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { retarget, prune } from '@gltf-transform/functions';
import { parseArgs } from 'node:util';

// ── Mixamo → Bip001 bone map ─────────────────────────────────────────────────
const MIXAMO_TO_BIP001 = {
  "mixamorig:Hips":            "Bip001 Pelvis",
  "mixamorig:Spine":           "Bip001 Spine",
  "mixamorig:Spine1":          "Bip001 Spine1",
  "mixamorig:Spine2":          "Bip001 Spine2",
  "mixamorig:Neck":            "Bip001 Neck",
  "mixamorig:Head":            "Bip001 Head",
  "mixamorig:LeftShoulder":    "Bip001 L Clavicle",
  "mixamorig:LeftArm":         "Bip001 L UpperArm",
  "mixamorig:LeftForeArm":     "Bip001 L Forearm",
  "mixamorig:LeftHand":        "Bip001 L Hand",
  "mixamorig:RightShoulder":   "Bip001 R Clavicle",
  "mixamorig:RightArm":        "Bip001 R UpperArm",
  "mixamorig:RightForeArm":    "Bip001 R Forearm",
  "mixamorig:RightHand":       "Bip001 R Hand",
  "mixamorig:LeftUpLeg":       "Bip001 L Thigh",
  "mixamorig:LeftLeg":         "Bip001 L Calf",
  "mixamorig:LeftFoot":        "Bip001 L Foot",
  "mixamorig:LeftToeBase":     "Bip001 L Toe0",
  "mixamorig:RightUpLeg":      "Bip001 R Thigh",
  "mixamorig:RightLeg":        "Bip001 R Calf",
  "mixamorig:RightFoot":       "Bip001 R Foot",
  "mixamorig:RightToeBase":    "Bip001 R Toe0",
};

// ── Parse CLI args ────────────────────────────────────────────────────────────
const { values } = parseArgs({
  options: {
    source: { type: 'string' },   // Mixamo animation GLB
    target: { type: 'string' },   // Grudge character GLB (T-pose base)
    output: { type: 'string' },   // Output path
    name:   { type: 'string', default: 'Retargeted' }, // Clip name
  },
});

if (!values.source || !values.target || !values.output) {
  console.error('Usage: node  source anim.glb target char.glb output out.glb [name "ClipName"] - retarget-anim.mjs:67');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// ── Load both documents ───────────────────────────────────────────────────────
console.log(`Loading source: ${values.source} - retarget-anim.mjs:74`);
const srcDoc = await io.read(values.source);  // Mixamo anim

console.log(`Loading target: ${values.target} - retarget-anim.mjs:77`);
const dstDoc = await io.read(values.target);  // Grudge character

// ── Retarget animations from source onto target skeleton ──────────────────────
// retarget() copies animation tracks, remapping bone names via the provided map.
await dstDoc.transform(
  retarget(srcDoc, {
    // Map source (Mixamo) bone names → target (Bip001) bone names
    boneMap: MIXAMO_TO_BIP001,
    // Preserve rest pose from target character (don't use Mixamo T-pose)
    useTargetRestPose: true,
    // Name the new clip
    names: [values.name],
  }),
  prune(), // remove unused buffers from source that got merged
);

// ── Write output ──────────────────────────────────────────────────────────────
await io.write(values.output, dstDoc);
console.log(`Done → ${values.output} - retarget-anim.mjs:96`);
console.log('Load in Babylon.js with SceneLoader.ImportMeshAsync - retarget-anim.mjs:97');
