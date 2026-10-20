// cane.js
// The sugar cane fields (Ken, 2026-10-20; MASTER.md). Out of Croc Park at dusk,
// Wally hides in the cane. He has the machete from the park gate: walking into
// standing cane swings it and clears the cell, so he beats down his own path.
// Cutting knocks down pieces of sugar cane, and some lie about already; he eats
// them to keep his energy up, before the cane toads and the fruit bats get
// them. Toads have poison skin: touching one costs him. Burning cane he can
// never go into, and the fire can never reach him (tension, not danger). In the
// clearing in the middle stands the chest with the fire talisman, which takes
// him on to the Esplanade.
//
// The field's rules are in cane-rules.js (tested), the look in cane-scene.js.

import * as THREE from 'three';
import * as Trip from '../trip-rules.js';
import { CANE, makeField, cellToWorld, worldToCell, walkable, cuttable, cut, startCell, middle, cutsNeeded } from './cane-rules.js';
import { buildCane } from './cane-scene.js';
import { Wally } from '../wally.js';
import { Input, steering, easeBehind } from '../input.js';
import { Bubbles, pickLine } from '../bubbles.js';
import { Effects } from '../fx.js';
import { loadModels, dress } from '../models.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { installMap, recordVisit, markRetry } from '../mapmodal.js';
import { showTip } from '../tips.js';
import { chestModel } from '../chest.js';
import { kennysJar } from '../food.js';
import { jarLabelTexture } from '../textures.js';
import { HumanoidPoser } from '../rig.js';
import { FlyingFoxes, CaneToads } from '../hazards.js';
import { ENERGY_MAX, energyDrain, speedFactor, LIVES, REVIVE_ENERGY, inRedZone } from '../rules.js';
import { completeArea, readProgress, saveProgress, outfitModel, wearing, starsFor } from '../progress.js';
import { dressOutfit } from '../outfit.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');
const loadSave = () => readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());

// ---- The trip (trip-rules.js) -----------------------------------------------------
let progress = loadSave();
if (!progress.trip) { progress.trip = Trip.tripFor(progress); saveProgress(progress); }
const entry = Trip.canEnter(progress.trip, 'cane'), testingAll = params.has('all');
let attempt = Trip.startAttempt(progress.trip, 'cane', { force: true });

// ---- The field --------------------------------------------------------------------
// A new field every visit; ?seed=N gives a fixed one, for testing.
let field = makeField(Number(params.get('seed')) || 1 + Math.floor(Math.random() * 2147483000), attempt.level);
let blockedBy = null;                // the cane cell Wally is pushing into this frame (to cut)
setGround({
  stand: () => ({ y: 0, surface: 'land' }),
  // He walks on cut ground only. Pushing into cane is noted (the machete does the
  // rest); fire and the edge simply stop him. Each axis is tried on its own, so
  // he slides along a wall of cane instead of sticking to it.
  move(x, z, nx, nz) {
    const ok = (px, pz) => { const c = worldToCell(px, pz); return walkable(field, c.i, c.j); };
    const note = (px, pz) => { const c = worldToCell(px, pz); if (cuttable(field, c.i, c.j)) blockedBy = c; };
    if (ok(nx, nz)) return { x: nx, z: nz };
    note(nx, nz);
    if (ok(nx, z)) return { x: nx, z };
    if (ok(x, nz)) return { x, z: nz };
    return { x, z };
  },
  foodAt: () => 0,
  isWater: () => false,
  start: () => { const w = cellToWorld(startCell().i, startCell().j); return { x: w.x, y: 0, z: w.z }; },
});

// ---- Stage --------------------------------------------------------------------------
let quality = pickQuality();
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality));
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2000);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 72 : 58;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const fpsWatch = watchFrameRate(quality, lower => { quality = lower; renderer.setPixelRatio(pixelRatioFor(lower)); resize(); });

const models = await loadModels(['wally', 'wally-explorer', 'kenny', 'toad', 'flyingfox', 'jar',
  'cane-tile', 'cane-ground', 'cane-piece', 'machete', 'talisman-fire'], { light: touch || quality.name === 'low' });
const world = buildCane(scene, renderer, quality, models, field);

// ---- Wally, with the machete ----------------------------------------------------------
const wally = new Wally(scene);
wally.facing = 0;                                          // facing north, into the field
wally.useModel(models.get(outfitModel(progress)) || models.get('wally'));
if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(progress, 'wally'));
const machete = (() => {
  const holder = new THREE.Group();
  const gltf = models.get('machete');
  const blade = gltf ? gltf.scene.clone(true) : new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.02), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8 }));
  if (gltf) {
    const box = new THREE.Box3().setFromObject(blade), size = box.getSize(new THREE.Vector3());
    blade.scale.setScalar(1.05 / Math.max(size.x, size.y, size.z));     // a cane knife is about 60 cm; bigger here, to read at dusk
    blade.rotation.z = -Math.PI / 4;                                     // the model lies on the diagonal: hook up, handle down
    blade.position.y = 0.38;                                             // the handle at the holder (his hand)
    blade.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0x6a5030); } });   // catches the firelight
  }
  holder.add(blade);
  // In his right hand: it goes where the hand goes. Its angle is set each frame in
  // Wally's own terms (pose, below), so it does not depend on how the hand bone
  // happens to be turned in the rig.
  const bones = {};
  if (wally.skin) wally.skin.root.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const hand = bones.RightHand || null;
  if (hand) {
    wally.root.updateMatrixWorld(true);
    hand.add(holder); holder.scale.setScalar(1 / hand.getWorldScale(new THREE.Vector3()).x);
  } else { wally.root.add(holder); holder.position.set(-0.62, 0.95, 0.15); }
  return { holder, hand, arm: bones.RightArm || null, forearm: bones.RightForeArm || null };
})();

// The chop, after the animation has posed him each frame. swing: 0 at rest, then
// 0..1 through one chop: the arm comes up and back over the shoulder, then down
// and forward through the cane. Turns are about Wally's own side-to-side axis,
// worked out in the world and handed to each bone, so the rig's axes do not matter.
const _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _side = new THREE.Vector3();
function turnBone(bone, axis, angle) {
  if (!bone) return;
  // If nothing re-posed this bone since our last turn (no clip moves it), start
  // again from where it was before that turn, so turns never pile up frame on frame.
  const u = bone.userData;
  if (u.turned && bone.quaternion.equals(u.turned)) bone.quaternion.copy(u.before);
  u.before = (u.before || new THREE.Quaternion()).copy(bone.quaternion);
  if (!angle) { u.turned = null; return; }
  bone.parent.updateWorldMatrix(true, false);
  bone.updateWorldMatrix(false, false);
  _qa.setFromAxisAngle(axis, angle).multiply(bone.getWorldQuaternion(_q));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(_qp).invert().multiply(_qa));
  u.turned = (u.turned || new THREE.Quaternion()).copy(bone.quaternion);
}
function poseMachete(swing) {
  const rootQ = wally.root.getWorldQuaternion(new THREE.Quaternion());
  _side.set(1, 0, 0).applyQuaternion(rootQ);
  // Up over the shoulder (first half), down through the cane (second half).
  const up = swing > 0 ? Math.sin(Math.min(1, swing / 0.45) * Math.PI / 2) * (swing < 0.45 ? 1 : 1 - (swing - 0.45) / 0.55) : 0;
  turnBone(machete.arm, _side, -2.3 * up);                   // the arm raised forward and up
  turnBone(machete.forearm, _side, -0.6 * up);               // the elbow bent, the knife back over the shoulder
  // The blade: held tip-up and a little forward at rest; back over the shoulder at
  // the top of the chop; forward and down at the end of it.
  // (Negative tips it forward, the same way the arm turns forward.)
  const bladeTilt = swing > 0 ? (swing < 0.45 ? 2.0 * (swing / 0.45) : 2.0 - 3.6 * ((swing - 0.45) / 0.55)) : 0;   // upright at rest
  const want = rootQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bladeTilt));
  if (machete.hand) {
    machete.hand.updateWorldMatrix(true, false);
    machete.holder.quaternion.copy(machete.hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want));
  } else machete.holder.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), bladeTilt);
}
const bubbles = new Bubbles(scene, touch ? 3 : 4);
const fx = new Effects(scene, { items: [] });

// ---- Pieces of sugar cane ----------------------------------------------------------------
const pieceGltf = models.get('cane-piece');
function pieceModel() {
  if (pieceGltf) {
    const m = pieceGltf.scene.clone(true), box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
    m.scale.setScalar(0.7 / Math.max(size.x, size.y, size.z));
    const g = new THREE.Group(); g.add(m); return g;
  }
  return new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0xc8b04a }));
}
// Each piece looks like food to the toads and bats (hazards.js): where it rests,
// landed, and claimed when one of them is after it.
const pieces = [];
function addPiece(i, j) {
  const w = cellToWorld(i, j), mesh = pieceModel();
  const x = w.x + (Math.random() - 0.5) * 0.8, z = w.z + (Math.random() - 0.5) * 0.8;
  mesh.position.set(x, 0.25, z); mesh.rotation.y = Math.random() * 3; scene.add(mesh);
  // A soft glow, so a piece shows in the dusk.
  const glow = new THREE.PointLight(0xffe39a, 0.8, 3); glow.position.set(0, 0.5, 0); mesh.add(glow);
  const p = { mesh, i, j, rest: new THREE.Vector3(x, 0.25, z), landed: true, floating: false, claimed: false, taken: false, name: 'sugar cane' };
  pieces.push(p); return p;
}
for (const { i, j } of field.lying) addPiece(i, j);
// The thieves see the pieces as a food manager: items, where each will be, where it lands.
const looseCane = {
  get items() { return pieces.filter(p => !p.taken && walkable(field, p.i, p.j)); },   // only on open ground
  predict: it => it.mesh.position.clone(),
  landing: it => it.rest,
};
function takePiece(p) { p.taken = true; scene.remove(p.mesh); }

// ---- The thieves: cane toads on the ground, fruit bats from the air ------------------
const randomOpenCell = () => {
  for (let k = 0; k < 400; k++) {
    const i = Math.floor(Math.random() * CANE.size), j = Math.floor(Math.random() * CANE.size);
    if (walkable(field, i, j) && Math.hypot(i - startCell().i, j - startCell().j) > 3) return cellToWorld(i, j);
  }
  return cellToWorld(middle(), middle());
};
const toads = new CaneToads(scene, attempt.level === 'easy' ? 3 : attempt.level === 'hard' ? 6 : 4, {
  heightAt: () => 0,
  isWater: (x, z) => { const c = worldToCell(x, z); return !walkable(field, c.i, c.j); },   // they keep to open ground
  home: randomOpenCell,
});
toads.useModel(models.get('toad'));
const bats = new FlyingFoxes(scene, quality.name === 'low' ? 2 : 3);
bats.useModel(models.get('flyingfox'));

// ---- The chest with the fire talisman, in the clearing ---------------------------------
const chest = (() => {
  const t = models.get('talisman-fire');
  let prize = null;
  if (t) {
    prize = t.scene.clone(true);
    const box = new THREE.Box3().setFromObject(prize), size = box.getSize(new THREE.Vector3());
    prize.scale.setScalar(0.7 / Math.max(size.x, size.y, size.z));
  }
  const c = chestModel(prize);
  const w = cellToWorld(middle(), middle());
  c.group.position.set(w.x, 0, w.z); c.group.scale.setScalar(1.3);
  scene.add(c.group);
  return { ...c, open: 0, x: w.x, z: w.z };
})();

// ---- Kenny and his jar --------------------------------------------------------------------
const kennyMesh = new THREE.Group(); kennyMesh.visible = false; scene.add(kennyMesh);
let kennyPoser = null;
{ const skin = dress(kennyMesh, models.get('kenny'), { height: 1.3 }); if (skin && skin.clips.size) kennyPoser = new HumanoidPoser(skin.root); }
const vegemite = kennysJar(jarLabelTexture()); vegemite.visible = false; scene.add(vegemite);

// ---- State --------------------------------------------------------------------------------
const input = new Input(canvas, touch ? { stick: $('stick'), knob: $('knob'), jump: $('t-jump'), fours: $('t-fours'), pause: $('t-pause'), cam: $('t-cam') } : null);
input.onPause = () => setPaused(!game.paused);
input.onMute = () => toast_('Sound ' + (sound.toggleMute() ? 'off' : 'on'), 'info');
const game = {
  running: false, paused: false, done: false, time: 0,
  energy: ENERGY_MAX, lives: LIVES, faint: 0, stun: 0,
  points: 0, eaten: 0, cuts: 0, lost: 0, stings: 0, swing: 0, swingCell: null, talisman: false,
  toadCool: 0, hint: 0,
};
game.tripDrain = Trip.drainFactor(progress.trip, 'cane', attempt.level);
const cutsToMiddle = cutsNeeded(field);
window.chomp = { game, wally, field: () => field, pieces, scene, camera, machete, poseMachete };

function toast_(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 1800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

// ---- One frame ------------------------------------------------------------------------------
// Above Wally, looking down over the cane (3.4 m) into the path he is cutting,
// and following behind him through the field (Ken, 2026-10-20).
const cam = { yaw: Math.PI, pitch: 1.0, dist: 11, manual: 0, recenter: false, side: 'behind', still: 0 };
const SWING = 0.32;                                          // seconds for one swing of the machete

function step(dt, t) {
  const k = input.read();
  game.time += dt;
  if (k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0) { cam.manual = 1.2; cam.recenter = false; }
  if (k.recenter) { cam.side = cam.side === 'behind' ? 'front' : 'behind'; cam.recenter = true; }
  cam.yaw += k.turn + k.turnKeys * dt * 2;
  cam.pitch = Math.min(1.35, Math.max(0.05, cam.pitch + k.tilt));
  cam.dist = Math.min(18, Math.max(4, cam.dist + k.zoom));
  game.stun = Math.max(0, game.stun - dt);

  // Moving: he stops at standing cane; pushing into it swings the machete.
  blockedBy = null;
  const control = game.faint > 0 || game.done ? { forward: 0, right: 0, jump: false, fours: false } : k;
  for (const e of wally.update(dt, control, cam.yaw, speedFactor(game.energy) * (game.stun > 0 ? 0.4 : 1))) {
    if (e === 'jump') sound.play.jump(); else if (e === 'land') sound.play.land();
  }
  if (blockedBy && game.swing <= 0 && game.faint <= 0) { game.swing = SWING; game.swingCell = blockedBy; }
  if (game.swing > 0) {
    game.swing -= dt;
    const u = 1 - Math.max(0, game.swing) / SWING;
    game.chop = u;                                           // how far through the chop (poseMachete)
    if (game.swing <= 0 && game.swingCell) {
      const { i, j } = game.swingCell, r = cut(field, i, j);
      if (r.cut) {
        field = r.field; game.cuts++; game.points += 2;
        world.arrange(field, ...wallyCell(), true);
        const w = cellToWorld(i, j);
        sound.play.land(); fx.burst(new THREE.Vector3(w.x, 1.2, w.z), [0x9fbf5a, 0xd8c070, 0x6f8a3a], 10);   // chopped leaves
        if (r.piece) addPiece(i, j);
        if (game.cuts === 1) showTip('cane-cut', 'Walk into the cane to cut a path with the machete. Cutting knocks down pieces of sugar cane: eat them to keep your energy up.');
      }
      for (const p of pieces) if (p.i === i && p.j === j) p.rest.y = 0.25;   // pieces in that cell are out in the open now
      game.swingCell = null;
    }
  } else game.chop = 0;

  // Energy: it runs down, slower on easy (trip-rules.js).
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (!game.done && game.faint <= 0) game.energy -= energyDrain(wally.mode, moving, 'cane') * game.tripDrain * dt;

  // Eating cane: walk over a piece in the open.
  for (const p of pieces) {
    if (p.taken) continue;
    p.mesh.rotation.y += dt * 1.5;
    if (!walkable(field, p.i, p.j)) continue;                // still inside standing cane
    if (Math.hypot(p.mesh.position.x - wally.pos.x, p.mesh.position.z - wally.pos.z) < 1.1 && game.faint <= 0) {
      takePiece(p); game.eaten++; game.points += 10;
      game.energy = Math.min(ENERGY_MAX, game.energy + CANE.pieceEnergy);
      wally.chomp('ground'); sound.play.chomp();
      toast_('+10 Sugar cane!'); if (game.eaten === 1) bubbles.say(wally.root, 'Sweet as! Real sugar cane!', 3);
    }
  }

  // The thieves.
  for (const it of toads.update(dt, looseCane)) { takePiece(it); game.lost++; sound.play.stolen(); toast_('A cane toad got it!', 'bad'); }
  for (const it of bats.update(dt, t, looseCane, attempt.level === 'hard' ? 0.5 : 0.3, wally.pos)) {
    it.taken = true; game.lost++; sound.play.stolen(); toast_('A fruit bat nicked it!', 'bad');
    if (Math.random() < 0.5) bubbles.say(wally.root, pickLine('wallyStolen'), 3);
  }
  // Toads have poison skin: touching one costs him (never more than that).
  game.toadCool -= dt;
  for (const td of toads.list) {
    if (game.toadCool > 0 || game.faint > 0) break;
    if (Math.hypot(td.pos.x - wally.pos.x, td.pos.z - wally.pos.z) < 0.8) {
      game.toadCool = 1.5; game.stings++; game.energy -= 10; game.stun = 0.6;
      wally.knock(td.pos.x, td.pos.z); fx.shake(0.3, 0.25); sound.play.sting();
      toast_('Cane toad! Poison skin, ouch!', 'bad'); bubbles.say(wally.root, 'Yuck! Keep away from me, toad!', 3);
      showTip('cane-toad', 'Cane toads have poison skin: touching one costs you energy. Go round them.');
    }
  }

  // Out of puff: a life gone, and Kenny comes with his jar (three times in a place).
  if (game.faint > 0) rescueStep(dt, t);
  else if (game.energy <= 0 && !game.done) {
    game.lives--; sound.play.lose();
    if (game.lives <= 0) { finish(false); return; }
    game.faint = 3.2; wally.setNapping(true); kennyMesh.visible = vegemite.visible = true;
    toast_(`Out of puff! ${game.lives} left. Here comes Kenny`, 'bad');
    bubbles.say(kennyMesh, "Hang on, Wally! Comin'!", 2.6);
  }

  // The chest in the clearing: the fire talisman.
  if (!game.talisman && Math.hypot(wally.pos.x - chest.x, wally.pos.z - chest.z) < 2.4) {
    game.talisman = true; game.points += 300; attempt = Trip.gain(attempt, 'talisman-fire');
    sound.play.powerup(); wally.cheer = 1.2; fx.burst(new THREE.Vector3(chest.x, 1.5, chest.z), [0xff6a1a, 0xffc04a, 0xffffff], 40);
    toast_('The fire talisman!', 'good'); bubbles.say(wally.root, 'Crikey! The fire talisman! One for the sceptre!', 3.6);
    game.done = true; setTimeout(() => finish(true), 3000);
  }
  if (game.talisman && chest.open < 1) chest.open = Math.min(1, chest.open + dt * 1.2);
  chest.lid.rotation.x = -chest.open * 1.9; chest.glow.intensity = chest.open * 8 + 1.5;
  if (chest.mango) { chest.mango.visible = true; chest.mango.rotation.y += dt * 1.5; chest.mango.position.y = 1.0 + chest.open * 0.9; }

  if (game.energy < 25 && (game.hint -= dt) <= 0) { bubbles.say(wally.root, pickLine('wallyHungry'), 3); game.hint = 10; }
  world.arrange(field, ...wallyCell());
  drawHud();
}

function wallyCell() { const c = worldToCell(wally.pos.x, wally.pos.z); return [c.i, c.j]; }

function rescueStep(dt, t) {
  game.faint -= dt;
  kennyMesh.position.set(wally.pos.x + 1.4, 0, wally.pos.z + 0.4); kennyMesh.rotation.y = -Math.PI / 2;
  vegemite.position.set(wally.pos.x + 0.6, 0.6 + Math.sin(t * 4) * 0.1, wally.pos.z + 0.3); vegemite.rotation.y += dt * 3;
  if (kennyPoser && kennyPoser.ok) kennyPoser.pose({ time: t, cheer: 1, napping: false });
  if (game.faint <= 0) {
    game.energy = Math.max(game.energy, REVIVE_ENERGY);
    kennyMesh.visible = vegemite.visible = false; wally.setNapping(false); sound.play.powerup();
    toast_("Kenny's jar! Back on your feet", 'good'); bubbles.say(wally.root, pickLine('wallyToast'), 3);
  }
}

// ---- Camera: on a leash behind him, lower than in the open, to look along the paths --------
const camTarget = new THREE.Vector3();
function followCamera(dt) {
  if (window.chomp.camHold) { window.chomp.camHold(camera); return; }   // testing: a fixed camera
  camTarget.lerp(wally.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), Math.min(1, dt * 6));
  cam.manual = Math.max(0, cam.manual - dt);
  if (game.running) {
    const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.3;
    cam.still = moving ? 0 : cam.still + dt;
    if (cam.recenter) {
      const want = wally.facing + (cam.side === 'behind' ? Math.PI : 0);
      const d = Math.atan2(Math.sin(want - cam.yaw), Math.cos(want - cam.yaw));
      cam.yaw += d * Math.min(1, dt * 6); if (Math.abs(d) < 0.02) cam.recenter = false;
    } else if (cam.manual <= 0) {
      // On a leash: the camera is towed behind him wherever he walks, so it follows
      // him along the paths he cuts. (Turning it to his heading instead fights the
      // steering, which is relative to the camera, and sends him in circles.)
      const dx = camera.position.x - camTarget.x, dz = camera.position.z - camTarget.z;
      // Steering (the default): the camera swings round behind him as he turns.
      if (steering()) cam.yaw = easeBehind(cam.yaw, wally.facing, dt);
      else if (dx * dx + dz * dz > 0.01) cam.yaw = Math.atan2(dx, dz);
    }
  }
  const cp = Math.cos(cam.pitch);
  camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
  if (camera.position.y < 1.2) camera.position.y = 1.2;
  camera.lookAt(camTarget);
  const jolt = fx.shakeOffset(dt); if (jolt) camera.position.add(jolt);
}

// ---- Screens ---------------------------------------------------------------------------------
function drawHud() {
  $('score').textContent = game.points.toLocaleString();
  $('cane').textContent = game.eaten;
  $('energy-fill').style.width = `${Math.max(0, game.energy)}%`;
  $('feed').classList.toggle('red', inRedZone(game.energy));
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  const d = Math.round(Math.hypot(wally.pos.x - chest.x, wally.pos.z - chest.z));
  $('job').textContent = game.talisman ? 'The fire talisman! On to the Esplanade' : `The fire talisman is in the middle of the field: ${d} m`;
}

function start() {
  if (!entry.ok && !testingAll) { toast_('The cane fields need the machete from the Croc Park gate', 'bad'); return; }
  recordVisit('cane');
  sound.start(); sound.startMusic('cane');
  $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true;
  bubbles.say(wally.root, 'Struth, it\'s thick in here. Good thing I\'ve got the machete!', 3.6, 2);
  showTip('cane-fire', 'Where the cane is burning you cannot go, but the fire can never reach you. Find a way round to the middle.');
}

function setPaused(p) { if (!game.running) return; game.paused = p; $('paused').hidden = !p; }

const STARS = [400, 650, 900];                               // first guess, to be tuned in play
function finish(won) {
  game.running = false;
  $('hud').hidden = true; $('touch').hidden = true;
  const total = game.points + (won ? Math.round(game.energy * 2) + game.lives * 50 : 0);
  const stars = won ? starsFor(total, STARS) : 0;
  progress = loadSave();
  if (!progress.trip) progress.trip = Trip.tripFor(progress);
  if (won) {
    sound.fanfare();
    const done = Trip.completeAttempt(progress.trip, attempt, { objectiveMet: true });
    if (done.ok) progress.trip = done.trip;
    progress = completeArea(progress, 'cane', { score: total, stars });
  } else progress.trip = Trip.failAttempt(progress.trip, attempt).trip;   // nothing from this attempt is kept
  saveProgress(progress);
  $('result-title').textContent = won ? 'The fire talisman!' : 'Out of puff';
  $('result-why').textContent = won ? 'One talisman for the sceptre. On to the Esplanade.' : 'Kenny can only bring his jar three times in a place. Try the field again.';
  markRetry(won, 'the cane fields');
  $('result-stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Sugar cane eaten', game.eaten], ['Cane cut', `${game.cuts} (at least ${cutsToMiddle} needed)`], ['Lost to toads and bats', game.lost], ['Total', total]]) {
    const li = document.createElement('li'); li.innerHTML = '<span></span><b></b>'; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  $('result').hidden = false;
  window.chomp.result = { won, total, stars };
}

$('play').onclick = start;
$('resume').onclick = () => setPaused(false);
$('again').onclick = () => location.reload();
addEventListener('visibilitychange', () => { if (document.hidden && game.running) setPaused(true); });

// ---- Loop -------------------------------------------------------------------------------------
world.arrange(field, ...wallyCell(), true);
// The camera starts behind him, south of the field, looking in (not from the
// origin, which is the middle of the field).
camTarget.copy(wally.pos).add(new THREE.Vector3(0, 1.5, 0));
camera.position.set(camTarget.x, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z - Math.cos(cam.pitch) * cam.dist);
let t = 0, last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  if (game.running && !game.paused) step(dt, t);
  bubbles.update(dt); fx.update(dt, t);
  world.update(t, wally.pos);
  poseMachete(game.chop || 0);
  followCamera(dt);
  fpsWatch(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play')) start();
installMap({ pause: on => { if (game.running) game.paused = on; } });
