// models.js
// Loads Ken's character and prop models (.glb files in /models) when they exist.
// Every creature in the game is built from simple shapes first; when a matching
// model file is present it is shown instead, scaled to size, and its animations
// are played by name. A missing file is not an error: the stand-in stays.
//
// File names and animation names are listed in MODELS.md.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { rimAll, contactShadow } from './look.js';

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('./js/addons/libs/draco/');
loader.setDRACOLoader(draco);          // models exported with Draco compression load too

// Every model file the game knows about.
export const MODEL_FILES = [
  'wally', 'wally-explorer', 'kenny', 'croc', 'pelican', 'flyingfox', 'jellyfish', 'toad', 'toast',
  ...Array.from({ length: 24 }, (_, i) => `tourist-${i + 1}`),
  'food-fries', 'food-pizza', 'food-taco', 'food-hotdog', 'food-shrimp',
  'food-chicken', 'food-hoagie', 'food-hamburger', 'food-steak',
  'palm-1', 'palm-2', 'palm-crown', 'boat', 'jar', 'mango', 'seashell', 'coral',
];

// Load whichever files exist. Returns a Map of name -> loaded glTF.
// Files are asked for all at once; ones that are not there are skipped quietly.
// light: true on phones and low graphics, which then use name-phone.glb where it exists.
export async function loadModels(names = MODEL_FILES, { light = false } = {}) {
  const found = new Map();
  let present = null;
  // models/index.json lists the files that exist (the local server makes it on
  // the fly; a deploy writes it). With it, missing files are never asked for.
  try {
    const list = await (await fetch('models/index.json')).json();
    if (Array.isArray(list)) { present = list; names = names.filter(n => list.includes(`${n}.glb`)); }
  } catch { /* no index: ask for each file */ }
  await Promise.all(names.map(async name => {
    const phoneCopy = `${name}-phone.glb`;
    const url = light && present && present.includes(phoneCopy) ? `models/${phoneCopy}` : `models/${name}.glb`;
    try {
      if (!present) {                                        // no index: ask first, quietly
        const head = await fetch(url, { method: 'HEAD' });
        if (!head.ok) return;
      }
      found.set(name, await loader.loadAsync(url));
    } catch (e) {
      console.warn(`Model ${url} could not be loaded:`, e.message);
    }
  }));
  // Animations saved as separate files, one per move: wally@run.glb gives Wally a
  // clip called 'run'. They share the model's skeleton, so they play on it as-is.
  if (present) await Promise.all(present.map(async file => {
    const m = file.match(/^(.+)@(.+)\.glb$/);
    if (!m || !found.has(m[1])) return;
    try {
      const extra = await loader.loadAsync(`models/${file}`);
      extra.animations.forEach((clip, i) => {
        clip.name = extra.animations.length === 1 ? m[2] : `${m[2]}${i ? '_' + i : ''}`;
        found.get(m[1]).animations.push(clip);
      });
    } catch (e) { console.warn(`Animation ${file} could not be loaded:`, e.message); }
  }));
  if (found.size) console.info(`Loaded models: ${[...found.keys()].join(', ')}`);
  return found;
}

// A placed copy of a model: scaled to a height, standing on its origin, facing
// forward, with its animations ready to play by name.
export class ModelSkin {
  // fit: { height } for things that stand, { length } for things measured nose to tail.
  constructor(gltf, fit = {}) {
    this.root = cloneSkinned(gltf.scene);       // skinned models need a proper copy, not a shallow one
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (fit.height) fitToHeight(this.root, fit.height);
    if (fit.length) fitToLength(this.root, fit.length);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = new Map(gltf.animations.map(c => [c.name.toLowerCase(), c]));
    this.current = null;
    this.jaw = findBone(this.root, /jaw/i);
  }

  // The clip for a move, by exact name or by a name containing it, so Meshy's
  // 'Running', 'Jump_Run' and 'Swim_Forward' answer to 'run', 'jump' and 'swim'.
  // Rest-pose clips (a few frames long) never count.
  find(name) {
    if (this.clips.has(name)) return this.clips.get(name);
    for (const [key, clip] of this.clips) if (key.includes(name) && clip.duration > 0.2) return clip;
    return null;
  }

  has(name) { return !!this.find(name); }

  // Cross-fade to an animation by name. Falls back through `alternatives`
  // (for example 'run_fours' -> 'run'). Returns false if the model has none of them.
  // speed: playback rate; fit: seconds the clip should take (overrides speed).
  play(name, { once = false, fade = 0.2, alternatives = [], speed = 1, fit = 0 } = {}) {
    const clip = [name, ...alternatives].map(n => this.find(n)).find(Boolean);
    if (!clip) return false;
    const action = this.mixer.clipAction(clip);
    action.timeScale = fit ? clip.duration / fit : speed;
    if (clip === this.currentClip) return true;
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = once;
    action.fadeIn(fade).play();
    if (this.currentClip) this.mixer.clipAction(this.currentClip).fadeOut(fade);
    this.currentClip = clip; this.current = clip.name;
    return true;
  }

  // Let go of every clip, so the bones can be moved by code instead.
  stop(fade = 0.2) {
    if (this.currentClip) this.mixer.clipAction(this.currentClip).fadeOut(fade);
    this.currentClip = null; this.current = null;
  }

  // Play a short move on top of whatever is playing, once: Wally's Chomp and
  // Grab only move his head, jaw and arms, so they ride over running, jumping or
  // swimming. The clip is made additive (measured from its first frame, which is
  // his rest or arms-down pose), so it adds its motion instead of replacing.
  overlay(name, { speed = 1 } = {}) {
    const clip = this.find(name);
    if (!clip) return false;
    this.additive = this.additive || new Map();
    let add = this.additive.get(clip);
    if (!add) {
      add = THREE.AnimationUtils.makeClipAdditive(clip.clone());
      this.additive.set(clip, add);
    }
    const action = this.mixer.clipAction(add);
    action.blendMode = THREE.AdditiveAnimationBlendMode;
    action.setLoop(THREE.LoopOnce, 1);
    action.timeScale = speed;
    action.reset().play();
    return true;
  }

  update(dt) { this.mixer.update(dt); }
}

// Measures a model as it really appears. A rigged (animated) model is measured
// by its skeleton: the shape of a skinned mesh cannot be read reliably before it
// has been drawn, but its bones can. The head bone sits a little below the top
// of the head, so the box is stretched upward by a tenth to cover it.
// A plain model is measured by its shape.
function measure(object) {
  object.updateWorldMatrix(true, true);
  const bones = new THREE.Box3(), v = new THREE.Vector3();
  object.traverse(o => { if (o.isBone) bones.expandByPoint(o.getWorldPosition(v)); });
  if (!bones.isEmpty() && bones.max.y - bones.min.y > 1e-6) {
    bones.max.y += (bones.max.y - bones.min.y) * 0.1;
    return bones;
  }
  return new THREE.Box3().setFromObject(object, true);
}

// Scale so the model is `height` metres tall and its lowest point sits on y = 0.
export function fitToHeight(object, height) {
  const size = measure(object).getSize(new THREE.Vector3());
  if (size.y > 0) object.scale.multiplyScalar(height / size.y);
  object.position.y -= measure(object).min.y;
}

// Scale so the model is `length` metres from front to back, resting on y = 0.
function fitToLength(object, length) {
  const size = measure(object).getSize(new THREE.Vector3());
  if (size.z > 0) object.scale.multiplyScalar(length / size.z);
  object.position.y -= measure(object).min.y;
}

// Scale so the model's longest side is `size` metres, centred on its origin (for food and small props).
export function fitToSize(object, size) {
  const dims = measure(object).getSize(new THREE.Vector3());
  const longest = Math.max(dims.x, dims.y, dims.z);
  if (longest > 0) object.scale.multiplyScalar(size / longest);
  object.position.sub(measure(object).getCenter(new THREE.Vector3()));
}

function findBone(object, pattern) {
  let found = null;
  object.traverse(o => { if (!found && o.isBone && pattern.test(o.name)) found = o; });
  return found;
}

// Put a model on a creature: hide its stand-in shapes, add the model in their
// place. Returns the ModelSkin, or null when there is no model for it.
export function dress(group, gltf, fit, lift = 0) {
  if (!gltf) return null;
  hideStandIn(group);
  const skin = new ModelSkin(gltf, fit);
  skin.root.position.y += lift;
  rimAll(skin.root, { strength: 0.18 });            // the bright edge that lifts a character off the background
  group.add(skin.root);
  if (fit.height) group.add(contactShadow(fit.height * 0.22, 0.3));   // grounded even without real shadows
  return skin;
}

// Hide the built-from-shapes stand-in but keep it working: its invisible parts
// still mark positions the game uses, such as where Wally's mouth is.
export function hideStandIn(group, keep = []) {
  group.traverse(o => { if (o.isMesh && !keep.includes(o)) o.visible = false; });
}
