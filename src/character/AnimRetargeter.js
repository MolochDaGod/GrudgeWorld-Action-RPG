/**
 * AnimRetargeter.js
 * Browser-side Mixamo → Bip001 animation retargeter for Three.js.
 *
 * Uses THREE.SkeletonUtils.retargetClip() — the native Three.js retargeter.
 * Drop a Mixamo GLB onto the canvas → animations are live on the character.
 *
 * Usage:
 *   import * as THREE from 'three';
 *   import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
 *
 *   const retargeter = new AnimRetargeter(scene, renderer);
 *   await retargeter.loadSource('mixamo_running.glb');
 *   const actions = retargeter.retargetOnto(characterObject3D, mixer);
 *   actions[0].action.play();
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { MIXAMO_TO_BIP001 } from "./equips/mixamoBoneMap.js";

export class AnimRetargeter {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;
    this._loader = new GLTFLoader();
    this._srcClips = []; // THREE.AnimationClip[] from source GLB
    this._srcRootObj = null; // source scene Object3D (hidden, provides skeleton)
  }

  // ── Load Mixamo animation GLB ──────────────────────────────────────────────
  /**
   * @param {string} url  Blob URL or path to Mixamo GLB
   * @returns {string[]}  list of clip names loaded
   */
  async loadSource(url) {
    const gltf = await this._loader.loadAsync(url);

    // Remove previously loaded source
    if (this._srcRootObj) {
      this._scene.remove(this._srcRootObj);
    }

    this._srcRootObj = gltf.scene;
    this._srcRootObj.visible = false; // skeleton only — hide geometry
    this._scene.add(this._srcRootObj);

    this._srcClips = gltf.animations;

    console.log(
      `[AnimRetargeter] Loaded ${this._srcClips.length} clips: - AnimRetargeter.js:53`,
      this._srcClips.map((c) => c.name),
    );
    return this._srcClips.map((c) => c.name);
  }

  // ── Retarget all loaded clips onto a target character ──────────────────────
  /**
   * @param {THREE.Object3D} targetObject  Grudge character root Object3D
   * @param {THREE.AnimationMixer} mixer   The character's AnimationMixer
   * @param {string[]} [clipNames]         Which clips to retarget (default: all)
   * @returns {{ name: string, action: THREE.AnimationAction }[]}
   */
  retargetOnto(targetObject, mixer, clipNames = null) {
    if (!this._srcClips.length || !this._srcRootObj) {
      console.error(
        "[AnimRetargeter] No source loaded  call loadSource() first - AnimRetargeter.js:67",
      );
      return [];
    }

    // retargetClip maps bone names via the `names` option: { sourceName: targetName }
    const retargetOptions = {
      hip: "Bip001 Pelvis", // root/hip bone name on the TARGET skeleton
      names: MIXAMO_TO_BIP001, // { 'mixamorig:Hips': 'Bip001 Pelvis', ... }
    };

    const toProcess = clipNames
      ? this._srcClips.filter((c) => clipNames.includes(c.name))
      : this._srcClips;

    const actions = [];

    for (const clip of toProcess) {
      try {
        // SkeletonUtils.retargetClip(targetRoot, sourceRoot, clip, options)
        const retargeted = SkeletonUtils.retargetClip(
          targetObject,
          this._srcRootObj,
          clip,
          retargetOptions,
        );
        retargeted.name = clip.name; // keep original name for lookup
        const action = mixer.clipAction(retargeted);
        actions.push({ name: clip.name, action });
        console.log(
          `[AnimRetargeter] Retargeted "${clip.name}" - AnimRetargeter.js:95`,
        );
      } catch (e) {
        console.warn(
          `[AnimRetargeter] Failed to retarget "${clip.name}": - AnimRetargeter.js:97`,
          e.message,
        );
      }
    }

    if (actions.length === 0) {
      console.warn(
        "[AnimRetargeter] No clips retargeted  check MIXAMO_TO_BIP001 map matches your skeleton - AnimRetargeter.js:102",
      );
    }

    return actions;
  }

  // ── Dispose ───────────────────────────────────────────────────────────────
  dispose() {
    if (this._srcRootObj) {
      this._scene.remove(this._srcRootObj);
      this._srcRootObj = null;
    }
    this._srcClips = [];
  }

  // ── Debug: print all bone names on an Object3D to console ────────────────
  static listBones(object) {
    const bones = [];
    object.traverse((obj) => {
      if (obj.isBone || obj.isSkinnedMesh)
        bones.push(`${obj.type}: ${obj.name}`);
    });
    console.table(bones);
    return bones;
  }
}
