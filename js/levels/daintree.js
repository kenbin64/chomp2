// daintree.js
// The Daintree River (Ken, 2026-10-20; MASTER.md section 6, the finale's fourth version).
//   1. Played: the tour boat (the riverboat seen earlier in the trip) cruises down the
//      river; Wally swims alongside and the passengers feed him. Wild crocs watch from
//      the banks.
//   2. A cutscene: the boat runs aground on a sandbar. Wild crocs come up round it; the
//      passengers call "Help us, Wally!" Wally remembers that the King lives in the
//      Daintree rainforest, and that he must take the sceptre to him.
//   3. Next to build: the rainforest (vines, paw paws), the King, the rescue, the ending.
//
// The river's rules are in daintree-rules.js (tested), the look in daintree-scene.js.

import * as THREE from 'three';
import * as Trip from '../trip-rules.js';
import { HALF, START_Z, BOAT_START_Z, BOAT_LENGTH, AGROUND_Z, SANDBAR, CROC, riverX, boatX, groundAt, insideRiver, boatStep, aground, inThrowRange, crocSpots, crocsRoundBoat, crocStep, crocBites, afterBite } from './daintree-rules.js';
import { buildDaintree } from './daintree-scene.js';
import { Wally } from '../wally.js';
import { Food, randomKind, useJarModel } from '../food.js';
import { Input, steering, easeBehind } from '../input.js';
import { Bubbles, pickLine } from '../bubbles.js';
import { Effects, CRUMBS } from '../fx.js';
import { loadModels, dress, ModelSkin, MODEL_FILES } from '../models.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { areaIntro, courseShots } from '../area-intro.js';
import { installMap, recordVisit, markRetry } from '../mapmodal.js';
import { kennysJar } from '../food.js';
import { jarLabelTexture } from '../textures.js';
import { HumanoidPoser } from '../rig.js';
import { peopleModels } from '../tourists.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, LIVES, REVIVE_ENERGY, inRedZone, aimOffset } from '../rules.js';
import { readProgress, saveProgress, outfitModel, wearing } from '../progress.js';
import { dressOutfit } from '../outfit.js';
import { loadRealism } from '../realism.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');
const loadSave = () => readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());

// ---- The trip (trip-rules.js) ------------------------------------------------------
let progress = loadSave();
if (!progress.trip) { progress.trip = Trip.tripFor(progress); saveProgress(progress); }
const entry = Trip.canEnter(progress.trip, 'daintree'), testingAll = params.has('all');

// ---- The ground: the river's rules, and the boat, which he cannot swim through --------
const boat = { z: BOAT_START_Z, root: null };
function inBoat(x, z) {
  // The hull's footprint, along the river: 10 m by 3.6 m round the boat's centre.
  const bx = boatX(boat.z), dz = z - boat.z, dx = x - bx;
  const h = boatHeading(boat.z), ax = Math.sin(h), az = Math.cos(h);       // along the boat
  const along = dx * ax + dz * az, side = dx * az - dz * ax;
  return Math.abs(along) < BOAT_LENGTH / 2 + 0.4 && Math.abs(side) < 2.2;
}
setGround({
  stand(x, z) { const g = groundAt(x, z); return { y: g.y, surface: g.surface === 'water' ? 'water' : 'land' }; },
  move(x, z, nx, nz) {
    const blocked = (px, pz) => !insideRiver(px, pz) || inBoat(px, pz);
    if (!blocked(nx, nz)) return { x: nx, z: nz };
    if (!blocked(nx, z)) return { x: nx, z };
    if (!blocked(x, nz)) return { x, z: nz };
    return { x, z };
  },
  foodAt: (x, z) => { const g = groundAt(x, z); return g.surface === 'water' ? 0 : g.y; },
  isWater: (x, z) => groundAt(x, z).surface === 'water',
  start: () => ({ x: riverX(START_Z) - 2, y: groundAt(riverX(START_Z) - 2, START_Z).y, z: START_Z }),
});
// The boat's heading along the river at z (radians, 0 = +z, turning toward +x).
function boatHeading(z) { return Math.atan2(boatX(z + 1) - boatX(z - 1), 2); }

// ---- Stage --------------------------------------------------------------------------
let quality = pickQuality();
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality));
renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1400);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 72 : 58; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const fpsWatch = watchFrameRate(quality, lower => { quality = lower; renderer.setPixelRatio(pixelRatioFor(lower)); resize(); });
// The first visit: up the river from the sandbar, past the boat, down to Wally.
const intro = areaIntro({
  id: 'daintree', name: 'The Daintree River', place: 'Mangroves, rainforest and crocs', focus: on => fpsWatch.focus(on),
  shots: () => courseShots({ from: { x: riverX(SANDBAR.z), z: SANDBAR.z }, to: { x: wally.pos.x, z: wally.pos.z - 10 }, y: 0, height: 40, side: 22 }),
});

const models = await loadModels([...MODEL_FILES, 'river-boat'], { light: touch || quality.name === 'low' });   // and Ken's riverboat
useJarModel(models.get('jar'));
const realism = await loadRealism(renderer, { light: touch || quality.name === 'low' });
const world = buildDaintree(scene, quality, realism);

// ---- Wally, Kenny, food ----------------------------------------------------------------
const wally = new Wally(scene);
wally.facing = 0;
wally.useModel(models.get(outfitModel(progress)) || models.get('wally'));
if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(progress, 'wally'));
const food = new Food(scene); food.useModels(models);
const bubbles = new Bubbles(scene, touch ? 3 : 4);
const fx = new Effects(scene, food);
const kennyMesh = new THREE.Group(); kennyMesh.visible = false; scene.add(kennyMesh);
let kennyPoser = null;
{ const skin = dress(kennyMesh, models.get('kenny'), { height: 1.3 }); if (skin && skin.clips.size) kennyPoser = new HumanoidPoser(skin.root); }
const vegemite = kennysJar(jarLabelTexture()); vegemite.visible = false; scene.add(vegemite);

// A person or croc in a holder: fitting a model lifts its own root so it stands on y = 0,
// so it is the holder that is placed and turned.
function holder(skin) { const g = new THREE.Group(); g.add(skin.root); return { g, skin }; }

// ---- The tour boat and its passengers -----------------------------------------------------
// The boat's model is its long way along x; the deck root carries it unscaled, so the
// passengers on it are their own size.
const DECK_Y = 0.55;                                              // the deck's height above the water
boat.root = new THREE.Group(); scene.add(boat.root);
{
  const gltf = models.get('river-boat');
  if (gltf) {
    const m = gltf.scene.clone(true), box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
    m.scale.setScalar(BOAT_LENGTH / size.x);
    const b2 = new THREE.Box3().setFromObject(m);
    m.position.y = -0.45 - b2.min.y;                              // the hull sits a little down in the water
    m.rotation.y = Math.PI / 2;                                   // its length along the river, bow forward (+z), the outboard at the stern
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    boat.root.add(m);
  } else {                                                        // without the model: a plain hull and canopy
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, BOAT_LENGTH), new THREE.MeshStandardMaterial({ color: 0xf2f2ee })); hull.position.y = 0.05; boat.root.add(hull);
  }
}
const passengers = (() => {
  const cast = peopleModels(models).slice(0, 8), out = [];
  cast.forEach((gltf, i) => {
    const tall = gltf.userData.tall, h = Array.isArray(tall) ? (tall[0] + tall[1]) / 2 : 1.72;
    const p = holder(new ModelSkin(gltf, { height: h }));
    const side = i % 2 ? 1 : -1, along = -3.6 + Math.floor(i / 2) * 2.4;
    p.g.position.set(side * 1.05, DECK_Y, along); p.g.rotation.y = side * Math.PI / 2;   // facing out over the rail
    boat.root.add(p.g);
    out.push({ ...p, side, cool: 1 + Math.random() * 3, throwing: 0, avoid: gltf.userData.avoid, nervous: false });
  });
  return out;
})();

// ---- Wild crocs: along the banks, and later round the stuck boat ------------------------------
const crocGltf = models.get('croc-regular');
function makeCroc(x, z, facing) {
  if (!crocGltf) return null;
  const c = holder(new ModelSkin(crocGltf, { length: 3.6 }));
  c.skin.root.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });
  c.g.position.set(x, -0.35, z); c.g.rotation.y = facing; scene.add(c.g);
  c.skin.play('Swim', { alternatives: ['Idle'] });
  return c;
}
// The wild crocs wait at the bank; as Wally swims past they slide in and chase him (Ken:
// added danger). Their moves are crocStep in daintree-rules.js (tested).
const bankCrocs = crocSpots().map(s => { const c = makeCroc(s.x, s.z, s.side > 0 ? -Math.PI / 2 : Math.PI / 2); return c && { ...c, home: s, sway: Math.random() * 10, s: { x: s.x, z: s.z, state: 'bank', t: 0, heading: s.side > 0 ? -Math.PI / 2 : Math.PI / 2 } }; }).filter(Boolean);
const ringCrocs = crocsRoundBoat().map(s => { const c = makeCroc(s.x, s.z - 30, 0); if (c) c.g.visible = false; return c && { ...c, to: s }; }).filter(Boolean);

// ---- State -----------------------------------------------------------------------------------
const input = new Input(canvas, touch ? { stick: $('stick'), knob: $('knob'), jump: $('t-jump'), fours: $('t-fours'), pause: $('t-pause'), cam: $('t-cam') } : null);
input.onPause = () => setPaused(!game.paused);
input.onMute = () => toast_('Sound ' + (sound.toggleMute() ? 'off' : 'on'), 'info');
const game = { running: false, paused: false, done: false, time: 0, energy: ENERGY_MAX, lives: LIVES, faint: 0, points: 0, caught: 0, streak: 0, behind: 0, scene: null, stun: 0, bites: 0, stolen: 0, crocTip: false };
game.tripDrain = Trip.drainFactor(progress.trip, 'daintree', Trip.attemptLevel(progress.trip, 'daintree').level);
window.chomp = { game, wally, scene, camera, boat, passengers };

function toast_(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 1800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

// A passenger throws to where Wally will be (the same rule as everywhere).
function passengerThrow(p) {
  const hand = p.g.localToWorld(new THREE.Vector3(0, 1.45, 0.35));
  const flight = 1.1 + Math.random() * 0.5, a = Math.random() * Math.PI * 2, r = aimOffset(Math.random, 1.6);
  const target = new THREE.Vector3(wally.pos.x + wally.vel.x * flight * 0.85 + Math.cos(a) * r, wally.pos.y + 1.4, wally.pos.z + wally.vel.z * flight * 0.85 + Math.sin(a) * r);
  food.throw(randomKind(p.avoid), hand, launchVelocity(hand, target, flight));
}
function passengersStep(dt, t) {
  const local = boat.root.worldToLocal(wally.pos.clone());          // which side of the boat he is on
  const near = inThrowRange(wally.pos.x, wally.pos.z, boat.z);
  for (const p of passengers) {
    if (game.scene) { p.skin.play('nervous', { alternatives: ['idle'] }); p.skin.update(dt); continue; }
    p.cool -= dt;
    const mySide = Math.sign(local.x) === p.side;
    if (p.throwing > 0) { p.throwing -= dt; if (p.throwing <= 0.4 && !p.thrown) { p.thrown = true; passengerThrow(p); } }
    else if (near && mySide && p.cool <= 0 && !game.done) {
      p.throwing = 0.75; p.thrown = false; p.cool = 2.2 + Math.random() * 2.5;
      p.skin.play('throw', { once: true, fit: 0.6, alternatives: ['idle'] });
      if (Math.random() < 0.25) bubbles.say(p.g, pickLine('touristThrow'), 2.2);
    }
    if (p.throwing <= 0) p.skin.play(mySide && near ? 'wave' : 'idle', { alternatives: ['idle'] });
    p.skin.update(dt);
  }
}

// ---- One frame ---------------------------------------------------------------------------------
const cam = { yaw: Math.PI, pitch: 0.42, dist: 11, manual: 0 };

function placeBoat() {
  boat.root.position.set(boatX(boat.z), 0, boat.z);
  boat.root.rotation.y = boatHeading(boat.z);
}

function step(dt, t) {
  const k = input.read();
  game.time += dt;
  if (k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0) cam.manual = 1.2;
  cam.yaw += k.turn + k.turnKeys * dt * 2;
  cam.pitch = Math.min(1.35, Math.max(0.05, cam.pitch + k.tilt));
  cam.dist = Math.min(22, Math.max(4, cam.dist + k.zoom));

  game.stun = Math.max(0, game.stun - dt);
  const control = game.faint > 0 || game.done || game.stun > 0 ? { forward: 0, right: 0, jump: false, fours: false, turn: 0, turnKeys: 0, tilt: 0, zoom: 0 } : k;
  for (const e of wally.update(dt, control, cam.yaw, speedFactor(game.energy))) {
    if (e === 'jump') sound.play.jump(); else if (e === 'land') sound.play.land();
    else if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 26); }
  }

  // The boat cruises on, slowing if he falls behind; then it runs aground.
  const lead = boat.z - wally.pos.z;
  boat.z = boatStep(boat.z, lead, dt); placeBoat();
  if (lead > 24 && (game.behind -= dt) <= 0) { game.behind = 6; toast_('Keep up with the boat! That is where the tucker is', 'info'); }
  if (aground(boat.z) && !game.scene) startSandbar();

  crocsStep(dt);

  // Energy.
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (!game.done && game.faint <= 0) game.energy -= energyDrain(wally.mode, moving, 'daintree') * game.tripDrain * dt;
  if (game.energy <= 0 && game.faint <= 0 && !game.done) outOfPuff('Out of puff!');
  if (game.faint > 0) rescueStep(dt, t);

  // Food.
  const { dissolved } = food.update(dt, t);
  for (const it of dissolved) game.streak = 0;
  const mouth = wally.mouthPosition(); let closest = Infinity;
  for (const it of [...food.items]) {
    const p = it.mesh.position;
    const d = it.landed && !wally.airborne ? Math.hypot(p.x - mouth.x, p.z - mouth.z) + (mouth.y - p.y > 3.2 ? 99 : 0) : p.distanceTo(mouth);
    if (d < 1.5) {
      fx.burst(p, CRUMBS[it.kind] || [0xffffff]); food.take(it, 'eaten'); wally.chomp(); sound.play.chomp();
      game.streak++; game.caught++;
      const how = it.landed ? 'ground' : (wally.airborne ? 'leap' : 'air'), pts = catchPoints(how, game.streak, false);
      game.points += pts; game.energy = Math.min(ENERGY_MAX, game.energy + FOODS[it.kind].energy);
      toast_(`+${pts} ${how === 'air' ? 'In the air!' : it.name}`);
    } else closest = Math.min(closest, d);
  }
  wally.jawWant = closest < 4.5 ? 0.75 : 0.12;
  if (game.energy < 25 && (game.hungry = (game.hungry || 0) - dt) <= 0) { bubbles.say(wally.root, pickLine('wallyHungry'), 3); game.hungry = 10; }
  drawHud();
}

// The wild crocs: chase, lunge, bite, back off; and snap up food that lands near them.
function crocsStep(dt) {
  for (const c of bankCrocs) {
    const was = c.s.state;
    c.s = crocStep(c.s, wally.pos.x, wally.pos.z, dt);
    if (was === 'bank' && c.s.state === 'chase') {
      sound.play.splash(); fx.splash(new THREE.Vector3(c.s.x, 0, c.s.z), 14);
      if (!game.crocTip) { game.crocTip = true; toast_('A wild croc is after you! Keep moving, and grab the food before they do', 'bad'); bubbles.say(wally.root, 'Uh oh. These fellas are not tame!', 3); }
    }
    c.g.position.set(c.s.x, -0.35, c.s.z); c.g.rotation.y = c.s.heading;
    c.skin.play(c.s.state === 'bank' ? 'Idle' : 'Swim', { speed: c.s.state === 'lunge' ? 2 : 1, alternatives: ['Swim'] });
    if (game.faint <= 0 && game.stun <= 0 && crocBites(c.s, wally.pos.x, wally.pos.z)) {
      c.s = afterBite(c.s); game.bites++; game.stun = 1;
      game.energy = Math.max(1, game.energy - CROC.biteFeed); game.streak = 0;
      const dx = wally.pos.x - c.s.x, dz = wally.pos.z - c.s.z, d = Math.hypot(dx, dz) || 1;
      wally.vel.x = dx / d * 7; wally.vel.z = dz / d * 7;            // knocked away from it
      sound.play.lose(); fx.shake && fx.shake(0.4);
      toast_(`Chomped by a wild croc! -${CROC.biteFeed} feed`, 'bad'); bubbles.say(wally.root, 'Oi! Crikey, that one bit me!', 2.6);
    }
    // Food that lands near a croc is gone.
    for (const it of [...food.items]) if (it.landed && Math.hypot(it.mesh.position.x - c.s.x, it.mesh.position.z - c.s.z) < CROC.steal) {
      food.take(it, 'gone'); game.stolen++; if (game.stolen % 3 === 1) toast_('A croc snapped it up first!', 'info');
    }
  }
}

function outOfPuff(why) {
  game.lives--; sound.play.lose();
  if (game.lives <= 0) { finish(false); return; }
  game.faint = 3.2; wally.setNapping(true); kennyMesh.visible = vegemite.visible = true;
  toast_(`${why} ${game.lives} left. Here comes Kenny`, 'bad'); bubbles.say(kennyMesh, "Hang on, Wally! Comin'!", 2.6);
}
function rescueStep(dt, t) {
  game.faint -= dt;
  kennyMesh.position.set(wally.pos.x + 1.4, Math.max(0.05, wally.pos.y), wally.pos.z + 0.4); kennyMesh.rotation.y = -Math.PI / 2;
  vegemite.position.set(wally.pos.x + 0.6, wally.pos.y + 0.6 + Math.sin(t * 4) * 0.1, wally.pos.z + 0.3); vegemite.rotation.y += dt * 3;
  if (kennyPoser && kennyPoser.ok) kennyPoser.pose({ time: t, cheer: 1, napping: false });
  if (game.faint <= 0) {
    game.energy = Math.max(game.energy, REVIVE_ENERGY);
    kennyMesh.visible = vegemite.visible = false; wally.setNapping(false); sound.play.powerup();
    toast_("Kenny's jar! Back on your feet", 'good'); bubbles.say(wally.root, pickLine('wallyToast'), 3);
  }
}

// ---- The sandbar: a cutscene ---------------------------------------------------------------------
// Ken's lines and moments (MASTER.md, fourth version, step 2). [time, who, words].
const SANDBAR_LINES = [
  [0.4, 'A passenger', "Whoa! We've hit something! We're stuck on a sandbar!"],
  [4.6, 'A passenger', 'Crocs! Wild crocs, all round us! Help us, Wally!'],
  [8.8, 'Wally', 'Crikey... the King! He lives in the Daintree rainforest.'],
  [12.6, 'Wally', "The sceptre! I've got to take it to him. Hang on, everyone, I'll be back!"],
];
const SANDBAR_END = 16.8;
function startSandbar() {
  game.scene = { t: 0, line: -1 }; game.done = true;
  food.items.slice().forEach(it => food.take(it, 'gone'));
  $('hud').hidden = true; $('scene-skip').hidden = false;
  fx.shake && fx.shake(0.6); sound.play.land();
  for (const c of ringCrocs) c.g.visible = true;
  for (const c of bankCrocs) c.g.visible = false;               // the chasers give way to the crocs round the boat
  // Wally, near the boat on the open side, facing it.
  const wx = boatX(AGROUND_Z) - 7, wz = AGROUND_Z - 2;
  wally.pos.set(wx, groundAt(wx, wz).y, wz); wally.root.position.copy(wally.pos); wally.vel.set(0, 0, 0);
}
function sandbarStep(dt) {
  const s = game.scene; s.t += dt;
  while (s.line + 1 < SANDBAR_LINES.length && s.t >= SANDBAR_LINES[s.line + 1][0]) { s.line++; caption(SANDBAR_LINES[s.line][1], SANDBAR_LINES[s.line][2]); }
  // The crocs glide in from out on the river to ring the boat.
  const u = Math.min(1, Math.max(0, (s.t - 2.2) / 4));
  for (const c of ringCrocs) {
    c.g.position.set(c.to.x, -0.35, c.to.z - 30 * (1 - u));
    c.g.rotation.y = Math.atan2(boatX(AGROUND_Z) - c.g.position.x, AGROUND_Z - c.g.position.z);
    c.skin.play(u < 1 ? 'Swim' : 'Idle', { alternatives: ['Swim'] }); c.skin.update(dt);
  }
  // The shots: the boat lurching onto the sand; up high over the boat as the crocs come;
  // then Wally, as he remembers.
  const bx = boatX(AGROUND_Z), bz = AGROUND_Z, look = new THREE.Vector3();
  if (s.t < 2.4) { camera.position.set(bx - 9, 3, bz - 10); look.set(bx, 1, bz + 2); }
  else if (s.t < 8.6) { const e = (s.t - 2.4) / 6.2; camera.position.set(bx - 16 + e * 4, 13 - e * 3, bz - 16 + e * 3); look.set(bx, 0.5, bz); }
  else { camera.position.set(wally.pos.x - 3.5, 1.6, wally.pos.z - 4.5); look.set(wally.pos.x + 1, 1.2, wally.pos.z + 3); wally.facing = boatHeading(bz) + 0.6; }
  camera.lookAt(look);
  if (s.t > 8.8 && s.t < 9) wally.cheer = 0.4;
  wally.update(dt, { forward: 0, right: 0, jump: false, fours: false }, cam.yaw, 1);   // floating, not standing on the water
  if (s.t >= SANDBAR_END) endSandbar();
}
function endSandbar() {
  if (!game.scene || game.scene.over) return;
  game.scene.over = true; caption('', ''); $('scene-skip').hidden = true;
  finish(true);
}
function caption(who, text) {
  const c = $('scene-caption'); c.hidden = !text; if (!text) return;
  c.querySelector('b').textContent = `${who}:`; c.querySelector('span').textContent = text;
}
$('scene-skip').onclick = e => { e.stopPropagation(); endSandbar(); };
addEventListener('keydown', e => { if (game.scene && !game.scene.over && ['Enter', 'Escape', ' '].includes(e.key) && !e.repeat) { e.preventDefault(); endSandbar(); } });

// ---- Camera: behind him, low over the water -------------------------------------------------------
const camTarget = new THREE.Vector3();
function followCamera(dt) {
  camTarget.lerp(wally.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), Math.min(1, dt * 6));
  cam.manual = Math.max(0, cam.manual - dt);
  if (game.running && cam.manual <= 0) {
    if (steering()) cam.yaw = easeBehind(cam.yaw, wally.facing, dt);
    else { const dx = camera.position.x - camTarget.x, dz = camera.position.z - camTarget.z; if (dx * dx + dz * dz > 0.01) cam.yaw = Math.atan2(dx, dz); }
  }
  const cp = Math.cos(cam.pitch);
  camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
  camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z).y + 1);
  camera.lookAt(camTarget);
  const jolt = fx.shakeOffset(dt); if (jolt) camera.position.add(jolt);
}

// ---- Screens ---------------------------------------------------------------------------------------
function drawHud() {
  $('score').textContent = game.points.toLocaleString();
  $('caught').textContent = game.caught;
  $('energy-fill').style.width = `${Math.max(0, game.energy)}%`;
  $('feed').classList.toggle('red', inRedZone(game.energy));
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  const togo = Math.max(0, Math.round(AGROUND_Z - boat.z));
  $('job').textContent = `Swim with the tour boat and catch what they throw (${togo} m down the river)`;
}

function start() {
  if (!entry.ok && !testingAll) { toast_('The Daintree opens with all six talismans in the sceptre', 'bad'); return; }
  recordVisit('daintree');
  if (intro.due()) { $('title').hidden = true; sound.start(); intro.play(camera, begin); return; }
  begin();
}
function begin() {
  sound.start(); sound.startMusic('esplanade');
  $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true;
  bubbles.say(wally.root, "The Daintree! The oldest rainforest there is. And a tour boat full of lunch!", 3.8, 2);
}
function setPaused(p) { if (!game.running) return; game.paused = p; $('paused').hidden = !p; }

function finish(won) {
  game.running = false;
  $('hud').hidden = true; $('touch').hidden = true;
  $('result-title').textContent = won ? 'Into the rainforest!' : 'Out of puff';
  $('result-why').textContent = won ? 'The boat is stuck and the crocs are all round it. Wally has to take the sceptre to the King. (The rainforest and the King: next to build.)' : 'Kenny can only bring his jar three times in a place.';
  markRetry(won, 'the Daintree River');
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Food caught', game.caught], ['Croc bites', game.bites], ['Snapped up by crocs', game.stolen], ['Points', game.points]]) {
    const li = document.createElement('li'); li.innerHTML = '<span></span><b></b>'; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  $('result').hidden = false;
  window.chomp.result = { won, points: game.points };
}

$('play').onclick = start;
$('resume').onclick = () => setPaused(false);
$('again').onclick = () => location.reload();
addEventListener('visibilitychange', () => { if (document.hidden && game.running) setPaused(true); });

// ---- Loop -----------------------------------------------------------------------------------------
{ const x = riverX(START_Z) - 2; wally.pos.set(x, groundAt(x, START_Z).y, START_Z); wally.root.position.copy(wally.pos); }
placeBoat();
camTarget.copy(wally.pos).add(new THREE.Vector3(0, 1.3, 0));
camera.position.set(camTarget.x, camTarget.y + 5, camTarget.z - 10);
let t = 0, last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  if (game.running && !game.paused && !game.scene) step(dt, t);
  if (game.scene && !game.scene.over && !game.paused) sandbarStep(dt);
  if (game.running || game.scene) passengersStep(dt, t);
  else for (const p of passengers) { p.skin.play('idle'); p.skin.update(dt); }
  for (const c of bankCrocs) c.skin.update(dt);                   // their moves are in step (crocsStep)
  bubbles.update(dt); fx.update(dt, t);
  world.update(t, camera);
  if (!game.scene) followCamera(dt);
  intro.update(dt, camera);
  fpsWatch(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play')) start();
installMap({ pause: on => { if (game.running) game.paused = on; } });
