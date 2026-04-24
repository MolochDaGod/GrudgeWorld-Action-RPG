/**
 * mixamoBoneMap.js
 * Maps Mixamo rig bone names → Grudge Bip001 (3ds Max biped) bone names.
 *
 * Use this with gltf-transform retarget() or Three.js SkeletonUtils.retargetClip()
 * to bake Mixamo animations onto the 6 Grudge race FBX characters.
 *
 * Mixamo bone naming: "mixamorig:Hips"
 * Bip001 bone naming: "Bip001 Pelvis"
 */

export const MIXAMO_TO_BIP001 = {
  // ── Core / Spine ─────────────────────────────────────────────────────────
  "mixamorig:Hips":           "Bip001 Pelvis",
  "mixamorig:Spine":          "Bip001 Spine",
  "mixamorig:Spine1":         "Bip001 Spine1",
  "mixamorig:Spine2":         "Bip001 Spine2",
  "mixamorig:Neck":           "Bip001 Neck",
  "mixamorig:Head":           "Bip001 Head",

  // ── Left Arm ──────────────────────────────────────────────────────────────
  "mixamorig:LeftShoulder":   "Bip001 L Clavicle",
  "mixamorig:LeftArm":        "Bip001 L UpperArm",
  "mixamorig:LeftForeArm":    "Bip001 L Forearm",
  "mixamorig:LeftHand":       "Bip001 L Hand",

  // ── Right Arm ─────────────────────────────────────────────────────────────
  "mixamorig:RightShoulder":  "Bip001 R Clavicle",
  "mixamorig:RightArm":       "Bip001 R UpperArm",
  "mixamorig:RightForeArm":   "Bip001 R Forearm",
  "mixamorig:RightHand":      "Bip001 R Hand",

  // ── Left Leg ──────────────────────────────────────────────────────────────
  "mixamorig:LeftUpLeg":      "Bip001 L Thigh",
  "mixamorig:LeftLeg":        "Bip001 L Calf",
  "mixamorig:LeftFoot":       "Bip001 L Foot",
  "mixamorig:LeftToeBase":    "Bip001 L Toe0",

  // ── Right Leg ─────────────────────────────────────────────────────────────
  "mixamorig:RightUpLeg":     "Bip001 R Thigh",
  "mixamorig:RightLeg":       "Bip001 R Calf",
  "mixamorig:RightFoot":      "Bip001 R Foot",
  "mixamorig:RightToeBase":   "Bip001 R Toe0",

  // ── Fingers (optional — use if your FBX includes finger bones) ────────────
  "mixamorig:LeftHandThumb1":  "Bip001 L Finger0",
  "mixamorig:LeftHandThumb2":  "Bip001 L Finger01",
  "mixamorig:LeftHandIndex1":  "Bip001 L Finger1",
  "mixamorig:LeftHandIndex2":  "Bip001 L Finger11",
  "mixamorig:LeftHandMiddle1": "Bip001 L Finger2",
  "mixamorig:LeftHandMiddle2": "Bip001 L Finger21",
  "mixamorig:RightHandThumb1": "Bip001 R Finger0",
  "mixamorig:RightHandThumb2": "Bip001 R Finger01",
  "mixamorig:RightHandIndex1": "Bip001 R Finger1",
  "mixamorig:RightHandIndex2": "Bip001 R Finger11",
  "mixamorig:RightHandMiddle1":"Bip001 R Finger2",
  "mixamorig:RightHandMiddle2":"Bip001 R Finger21",
};

/** Reverse map: Bip001 → Mixamo (useful for exporting back) */
export const BIP001_TO_MIXAMO = Object.fromEntries(
  Object.entries(MIXAMO_TO_BIP001).map(([k, v]) => [v, k])
);
