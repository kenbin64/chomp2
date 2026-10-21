// mossman.js
// Mossman Gorge (Ken, 2026-10-20; MASTER.md). Wally works his way down the
// Mossman River: clear swimming holes stepping down the gorge, joined by smooth
// rock slicks he slides down from one hole into the next. Visitors sit on the
// granite round each hole and throw food (the sweet-spot rule, as everywhere).
// The key lies on the bottom of one hole; the chest with the opal, the earth
// talisman, on the bottom of the last. Then out by the track at the bottom.
//
// The gorge's rules are in mossman-rules.js (tested), the look in mossman-scene.js.

import { startRun, addPoints, bankRun } from '../points.js';
import { foundTalisman } from '../revisit.js';
import { installGear, snorkelling, drainFactor } from '../gear.js';
import { installBook, openBook } from '../book.js';
import * as THREE from 'three';
import * as Trip from '../trip-rules.js';
import { POOLS, KEY_POOL, CHEST_POOL, SLIDE_HALF, SLIDE_SPEED, START, FINISH_Z, riverX, groundAt, insideGorge, bottomSpot, canReach, groupSpots, slideAt } from './mossman-rules.js';
import { buildMossman } from './mossman-scene.js';
import { Wally } from '../wally.js';
import { Food, kindFor, useJarModel } from '../food.js';
import { Input, steering, easeBehind } from '../input.js';
import { Bubbles, pickLine, chatty } from '../bubbles.js';
import { Effects, CRUMBS } from '../fx.js';
import { loadModels, dress, MODEL_FILES } from '../models.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { areaIntro, courseShots, orbitShots } from '../area-intro.js';
import { installMap, recordVisit, markRetry } from '../mapmodal.js';
import { showTip } from '../tips.js';
import { chestModel } from '../chest.js';
import { kennysJar } from '../food.js';
import { jarLabelTexture } from '../textures.js';
import { HumanoidPoser } from '../rig.js';
import { Clusters } from '../clusters.js';
import { peopleModels } from '../tourists.js';
import { gateKey } from '../parktreasure.js';
import { airStep, AIR } from './reef-rules.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, LIVES, REVIVE_ENERGY, inRedZone, aimOffset } from '../rules.js';
import { completeArea, readProgress, saveProgress, outfitModel, wearing, starsFor } from '../progress.js';
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
const entry = Trip.canEnter(progress.trip, 'mossman'), testingAll = params.has('all');
let attempt = Trip.startAttempt(progress.trip, 'mossman', { force: true }); startRun('mossman');

// ---- The ground: the gorge's rules, plus boulders that stop him ----------------------
const dive = { under: false, depth: 0 };     // depth: how far below the floating line he is (0 floating)
let solids = [];
setGround({
  stand(x, z, feetY) {
    const g = groundAt(x, z, false);
    if (g.surface === 'water') return { y: g.y - dive.depth, surface: 'water' };
    if (g.surface === 'slide') return { y: g.y, surface: 'deck' };            // smooth rock: he slides on it
    for (const s of solids) if (Math.hypot(x - s.x, z - s.z) < s.r && feetY >= s.top - 0.4) return { y: s.top, surface: 'rock' };
    return { y: g.y, surface: 'land' };
  },
  move(x, z, nx, nz, y) {
    const blocked = (px, pz) => !insideGorge(px, pz) || solids.some(s => Math.hypot(px - s.x, pz - s.z) < s.r + 0.4 && y < s.top - 0.4);
    if (!blocked(nx, nz)) return { x: nx, z: nz };
    // Against the bank he slides along it, toward the river's line, instead of stopping dead
    // (holding forward used to pin him on the outside of a bend).
    const step = Math.hypot(nx - x, nz - z);
    if (step > 0) {                                                  // toward the river's line first, then the other way (round a boulder)
      const dx = nx - x, dz = nz - z, px = -dz, pz = dx;             // the sideways direction
      const k = Math.sign(px * (riverX(nz) - nx)) || 1;
      for (const sgn of [k, -k]) if (!blocked(x + dx * 0.7 + px * sgn * 0.7, z + dz * 0.7 + pz * sgn * 0.7)) return { x: x + dx * 0.7 + px * sgn * 0.7, z: z + dz * 0.7 + pz * sgn * 0.7 };
    }
    if (!blocked(nx, z)) return { x: nx, z };
    if (!blocked(x, nz)) return { x, z: nz };
    return { x, z };
  },
  foodAt: (x, z) => { const g = groundAt(x, z); return g.surface === 'water' ? POOLS[g.pool].level : g.y; },
  isWater: (x, z) => groundAt(x, z).surface === 'water',
  start: () => ({ x: riverX(START.z) + START.x, y: groundAt(riverX(START.z), START.z).y, z: START.z }),
});

// ---- Stage --------------------------------------------------------------------------
let quality = pickQuality();
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality));
renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1200);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 72 : 58; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const fpsWatch = watchFrameRate(quality, lower => { quality = lower; renderer.setPixelRatio(pixelRatioFor(lower)); resize(); });
// The first visit: up the gorge from the last hole, over the slides, down to Wally at the top.
const intro = areaIntro({
  id: 'mossman', name: 'Mossman Gorge', place: 'Swimming holes and rock slides', focus: on => fpsWatch.focus(on),
  shots: () => { const last = POOLS[POOLS.length - 1];
    return courseShots({ from: { x: riverX(last.z), z: last.z }, to: { x: wally.pos.x, z: wally.pos.z + 8 }, y: (x, z) => groundAt(x, z).y, height: 34, side: 12 }); },
});

const models = await loadModels([...MODEL_FILES, 'talisman-earth'], { light: touch || quality.name === 'low' });   // and Ken's opal, the earth talisman
useJarModel(models.get('jar'));
const realism = await loadRealism(renderer, { light: touch || quality.name === 'low' });
const world = buildMossman(scene, quality, realism);
solids = world.solids;
// Light from the sky, as in the park.
{ const env = new THREE.Scene(); env.add(new THREE.Mesh(new THREE.SphereGeometry(10), new THREE.MeshBasicMaterial({ color: 0xbfe0d8, side: THREE.BackSide })));
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(env, 0.04).texture; scene.environmentIntensity = 0.7; pmrem.dispose(); }

// ---- Wally, Kenny, food, people ------------------------------------------------------
const wally = new Wally(scene);
wally.facing = 0;
wally.useModel(models.get(outfitModel(progress)) || models.get('wally'));
if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(progress, 'wally'));
const food = new Food(scene); food.useModels(models);
const bubbles = new Bubbles(scene, touch ? 3 : 4);
const fx = new Effects(scene, food);
const heightAt = (x, z) => groundAt(x, z).y;
const clusters = new Clusters(scene, heightAt, bubbles);
for (const s of groupSpots()) clusters.add({ x: s.x, z: s.z, size: 2 + Math.floor(Math.random() * 3), food: 6 + Math.floor(Math.random() * 3), rate: 0.6 });
clusters.useModels(peopleModels(models));

const kennyMesh = new THREE.Group(); kennyMesh.visible = false; scene.add(kennyMesh);
let kennyPoser = null;
{ const skin = dress(kennyMesh, models.get('kenny'), { height: 1.3 }); if (skin && skin.clips.size) kennyPoser = new HumanoidPoser(skin.root); if (skin) dressOutfit(skin.root, 'kenny', wearing(progress, 'kenny')); }   // his vest from the markets, in every area
const vegemite = kennysJar(jarLabelTexture()); vegemite.visible = false; scene.add(vegemite);

// ---- The key, and the chest with the opal ------------------------------------------------
const keySpot = bottomSpot(KEY_POOL, 1), chestSpot = bottomSpot(CHEST_POOL, -1);
const key = (() => {
  const g = new THREE.Group(), k = models.get('park-key');
  const m = k ? k.scene.clone(true) : gateKey();
  if (k) { const b = new THREE.Box3().setFromObject(m); m.scale.setScalar(0.7 / Math.max(...b.getSize(new THREE.Vector3()).toArray())); }
  g.add(m); const glow = new THREE.PointLight(0xffd36a, 5, 6); glow.position.y = 0.5; g.add(glow);
  g.position.set(keySpot.x, keySpot.y + 0.3, keySpot.z); scene.add(g); return g;
})();
// The opal: Ken's earth talisman when it is made; until then a glowing opal stand-in.
function opal() {
  const t = models.get('talisman-earth');
  if (t) { const m = t.scene.clone(true), b = new THREE.Box3().setFromObject(m); m.scale.setScalar(0.7 / Math.max(...b.getSize(new THREE.Vector3()).toArray())); return m; }
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.8, sheen: 1, sheenColor: new THREE.Color(0xff8ad8), emissive: 0x335577, emissiveIntensity: 0.4 }));
  m.scale.set(1, 0.7, 1.25); return m;
}
const chest = (() => {
  const c = chestModel(opal());
  c.group.position.set(chestSpot.x, chestSpot.y, chestSpot.z); c.group.scale.setScalar(1.2); scene.add(c.group);
  return { ...c, open: 0 };
})();

// ---- State -----------------------------------------------------------------------------------
const input = new Input(canvas, touch ? { stick: $('stick'), knob: $('knob'), jump: $('t-jump'), fours: $('t-fours'), pause: $('t-pause'), cam: $('t-cam') } : null);
input.onPause = () => setPaused(!game.paused);
input.onMute = () => toast_('Sound ' + (sound.toggleMute() ? 'off' : 'on'), 'info');
for (const [id, flag] of [['b-dive', 'diveQueued'], ['b-up', 'upQueued']]) $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); game[flag] = true; });
const game = {
  running: false, paused: false, done: false, time: 0, energy: ENERGY_MAX, lives: LIVES, faint: 0,
  air: AIR.max, points: 0, caught: 0, streak: 0, hasKey: false, talisman: false, foursWas: false, diveQueued: false, upQueued: false, hint: 0, slides: 0,
};
game.hasKey = Trip.have(progress.trip, 'mossman-key');
game.talisman = game.hadOpal = Trip.have(progress.trip, 'talisman-earth');   // back again: the opal is sealed already (the way out is open); the chest gives a prize
game.tripDrain = Trip.drainFactor(progress.trip, 'mossman', attempt.level);
window.chomp = { game, wally, scene, camera, clusters, keySpot, chestSpot, dive };

function toast_(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 1800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

// Visitors throw where he will be (the same rule as everywhere).
function throwFrom(hand, cluster, gentle, thrower) {
  const flight = gentle ? 0.8 : 1.2 + Math.random() * 0.5;
  const a = Math.random() * Math.PI * 2, r = aimOffset(Math.random, gentle ? 0.4 : 2);
  const tx = wally.pos.x + wally.vel.x * flight * 0.85 + Math.cos(a) * r, tz = wally.pos.z + wally.vel.z * flight * 0.85 + Math.sin(a) * r;
  return food.throw(kindFor(thrower), hand, launchVelocity(hand, new THREE.Vector3(tx, wally.pos.y + 1.6, tz), flight));
}

// ---- One frame ---------------------------------------------------------------------------------
const cam = { yaw: Math.PI, pitch: 0.55, dist: 10, manual: 0, still: 0 };

function step(dt, t) {
  const k = input.read();
  game.time += dt;
  if (k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0) cam.manual = 1.2;
  cam.yaw += k.turn + k.turnKeys * dt * 2;
  cam.pitch = Math.min(1.35, Math.max(0.05, cam.pitch + k.tilt));
  cam.dist = Math.min(20, Math.max(4, cam.dist + k.zoom));

  // In a hole: Shift dives, Space comes back up.
  const here = groundAt(wally.pos.x, wally.pos.z);
  const inHole = here.surface === 'water';
  const foursPressed = k.fours && !game.foursWas; game.foursWas = k.fours;
  if (inHole && game.faint <= 0) {
    if ((foursPressed || game.diveQueued) && !dive.under) { dive.under = true; if (!game.diveTip) { game.diveTip = true; bubbles.say(wally.root, 'Down I go! Clear as glass down here.', 3); } }
    else if (dive.under && (k.jump || game.upQueued)) dive.under = false;
  }
  if (!inHole) dive.under = false;
  game.diveQueued = game.upQueued = false;
  const want = dive.under ? 2.15 : 0;                          // DIVE_DROP less SURFACE_DROP
  dive.depth += Math.sign(want - dive.depth) * Math.min(Math.abs(want - dive.depth), 3 * dt);
  $('dive-buttons').hidden = !inHole || game.done; $('b-dive').disabled = dive.under; $('b-up').disabled = !dive.under;
  if (inHole && !game.holeTip) { game.holeTip = true; showTip('mossman-dive', 'In a swimming hole, Shift (or Dive) goes under and Space (or Up) comes back up. The water is clear: look on the bottom for the key and the chest.'); }

  const control = game.faint > 0 || game.done ? { forward: 0, right: 0, jump: false, fours: false, turn: 0, turnKeys: 0, tilt: 0, zoom: 0 } : (dive.under ? { ...k, jump: false } : k);
  for (const e of wally.update(dt, control, cam.yaw, speedFactor(game.energy))) {
    if (e === 'jump') sound.play.jump(); else if (e === 'land') sound.play.land();
    else if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 26); }
  }
  // On a rock slide: the water carries him down it; he can steer from side to side.
  const s = slideAt(wally.pos.x, wally.pos.z);
  if (s && !wally.airborne && game.faint <= 0) {
    wally.pos.z += SLIDE_SPEED * dt;
    const cx = riverX(wally.pos.z); wally.pos.x = Math.max(cx - SLIDE_HALF + 0.3, Math.min(cx + SLIDE_HALF - 0.3, wally.pos.x));
    wally.pos.y = groundAt(wally.pos.x, wally.pos.z).y; wally.root.position.copy(wally.pos);
    wally.facing = 0; wally.root.rotation.y = 0; wally.cheer = 0.3;
    if (!game.onSlide) { game.onSlide = true; game.slides++; sound.play.leap(); if (game.slides === 1) bubbles.say(wally.root, 'Wheee! Crikey, what a ride!', 3); else if (chatty()) bubbles.say(wally.root, 'Whoo-hoo!', 2); }
  } else game.onSlide = false;

  // Air under water.
  if (!game.done && game.faint <= 0) game.air = airStep(game.air, dive.depth > 0.6 ? 'under' : 'surface', dive.depth > 0.6 && snorkelling() ? 0 : dt);   // the Snorkel: air stays full
  if (game.air <= 0 && game.faint <= 0) { dive.under = false; outOfPuff('Out of air!'); }

  // Energy.
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (!game.done && game.faint <= 0) game.energy -= energyDrain(wally.mode, moving, 'mossman') * game.tripDrain * drainFactor() * dt;   // vitamins halve it
  if (game.energy <= 0 && game.faint <= 0 && !game.done) outOfPuff('Out of puff!');
  if (game.faint > 0) rescueStep(dt, t);

  // Visitors and food.
  const events = game.done ? [] : clusters.update(dt, t, wally.pos, throwFrom);
  for (const e of events) {
    if (e.type === 'throw' && Math.random() < 0.3) bubbles.say(e.thrower.g, pickLine('touristThrow'), 2.3);
    if (e.type === 'flee') toast_('Too close! They ran off with their lunch', 'bad');
  }
  const { dissolved } = food.update(dt, t);
  for (const it of dissolved) game.streak = 0;
  const mouth = wally.mouthPosition(); let closest = Infinity;
  for (const it of [...food.items]) {
    const p = it.mesh.position;
    const d = it.landed && !wally.airborne ? Math.hypot(p.x - mouth.x, p.z - mouth.z) + (mouth.y - p.y > 3.2 ? 99 : 0) : p.distanceTo(mouth);
    if (d < 1.4) {
      clusters.cheer(it.cluster); fx.burst(p, CRUMBS[it.kind] || [0xffffff]); food.take(it, 'eaten'); wally.chomp(); sound.play.chomp();
      game.streak++; game.caught++;
      const how = it.landed ? 'ground' : (wally.airborne ? 'leap' : 'air'), pts = catchPoints(how, game.streak, false);
      game.points += pts; addPoints(how); game.energy = Math.min(ENERGY_MAX, game.energy + FOODS[it.kind].energy);
      toast_(`+${pts} ${how === 'air' ? 'In the air!' : it.name}`);
    } else closest = Math.min(closest, d);
  }
  wally.jawWant = closest < 4.5 ? 0.75 : 0.12;

  // The key, and the chest with the opal.
  key.rotation.y += dt * 1.5;
  if (!game.hasKey && canReach(wally.pos.x, wally.pos.z, dive.depth > 1.2, keySpot.x, keySpot.z)) {
    game.hasKey = true; key.visible = false; attempt = Trip.gain(attempt, 'mossman-key'); addPoints('pickup');
    game.points += 100; sound.play.powerup(); toast_('A key! Now find what it opens', 'good'); bubbles.say(wally.root, "A key, right on the bottom! What's it for?", 3.4);
  }
  if (!game.chestOpen && canReach(wally.pos.x, wally.pos.z, dive.depth > 1.2, chestSpot.x, chestSpot.z)) {
    if (game.hasKey) {
      game.chestOpen = true; game.talisman = true; attempt = Trip.gain(attempt, 'talisman-earth'); game.points += 300; addPoints('talisman');
      setTimeout(() => foundTalisman('talisman-earth', toast_), 1600);          // new: the sceptre card; already sealed: a random useful prize (revisit.js)
      sound.play.powerup(); wally.cheer = 1.2; fx.burst(new THREE.Vector3(chestSpot.x, chestSpot.y + 1, chestSpot.z), [0xb8e6ff, 0xff9ad8, 0xffffff], 40);
      if (!game.hadOpal) { toast_('The opal, the earth talisman!', 'good'); bubbles.say(wally.root, 'Crikey, the opal! Earth for the sceptre!', 3.6); }
      else bubbles.say(wally.root, 'Something new in the chest this time!', 3);
    } else if ((game.hint -= dt) <= 0) { game.hint = 5; toast_('Locked. The key is somewhere on the bottom of another hole', 'info'); }
  }
  if (game.chestOpen && chest.open < 1) chest.open = Math.min(1, chest.open + dt * 1.2);
  chest.lid.rotation.x = -chest.open * 1.9; chest.glow.intensity = chest.open * 8 + 1;
  if (chest.mango) { chest.mango.visible = true; chest.mango.rotation.y += dt * 1.5; chest.mango.position.y = 0.9 + chest.open * 0.8; }

  // Out by the track at the bottom, once the opal is his.
  if (!game.done && wally.pos.z > FINISH_Z) {
    if (game.talisman) { game.done = true; wally.cheer = 1.2; bubbles.say(wally.root, 'Ripper! On to the Daintree!', 3.4); setTimeout(() => finish(true), 2200); }
    else if ((game.hint -= dt) <= 0) { game.hint = 5; toast_('Not yet: the opal is in the chest on the bottom of the last hole', 'info'); }
  }
  if (game.energy < 25 && (game.hungry = (game.hungry || 0) - dt) <= 0) { bubbles.say(wally.root, pickLine('wallyHungry'), 3); game.hungry = 10; }
  drawHud();
}

function outOfPuff(why) {
  game.lives--; sound.play.lose();
  if (game.lives <= 0) { finish(false); return; }
  game.faint = 3.2; wally.setNapping(true); kennyMesh.visible = vegemite.visible = true;
  toast_(`${why} ${game.lives} left. Here comes Kenny`, 'bad'); bubbles.say(kennyMesh, "Hang on, Wally! Comin'!", 2.6);
}
function rescueStep(dt, t) {
  game.faint -= dt;
  kennyMesh.position.set(wally.pos.x + 1.4, Math.max(wally.pos.y, groundAt(wally.pos.x + 1.4, wally.pos.z).y), wally.pos.z + 0.4); kennyMesh.rotation.y = -Math.PI / 2;
  vegemite.position.set(wally.pos.x + 0.6, wally.pos.y + 0.6 + Math.sin(t * 4) * 0.1, wally.pos.z + 0.3); vegemite.rotation.y += dt * 3;
  if (kennyPoser && kennyPoser.ok) kennyPoser.pose({ time: t, cheer: 1, napping: false });
  if (game.faint <= 0) {
    game.energy = Math.max(game.energy, REVIVE_ENERGY); game.air = AIR.max;
    kennyMesh.visible = vegemite.visible = false; wally.setNapping(false); sound.play.powerup();
    toast_("Kenny's jar! Back on your feet", 'good'); bubbles.say(wally.root, pickLine('wallyToast'), 3);
  }
}

// ---- Camera: behind him, above the water ---------------------------------------------------------
const camTarget = new THREE.Vector3();
function followCamera(dt) {
  camTarget.lerp(wally.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), Math.min(1, dt * 6));
  cam.manual = Math.max(0, cam.manual - dt);
  if (game.running && cam.manual <= 0) {
    if (steering()) cam.yaw = easeBehind(cam.yaw, wally.facing, dt);
    else { const dx = camera.position.x - camTarget.x, dz = camera.position.z - camTarget.z; if (dx * dx + dz * dz > 0.01) cam.yaw = Math.atan2(dx, dz); }
  }
  const pitch = dive.depth > 1 ? Math.max(cam.pitch, 0.9) : cam.pitch;      // looking down into the clear water when he dives
  const cp = Math.cos(pitch);
  camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
  const floor = groundAt(camera.position.x, camera.position.z).y + 1;
  if (camera.position.y < floor) camera.position.y = floor;
  camera.lookAt(camTarget);
  const jolt = fx.shakeOffset(dt); if (jolt) camera.position.add(jolt);
}

// ---- Screens ---------------------------------------------------------------------------------------
function drawHud() {
  $('score').textContent = game.points.toLocaleString();
  $('caught').textContent = game.caught;
  const diving = dive.depth > 0.6 || game.air < AIR.max - 0.5;
  $('meter-label').textContent = diving ? 'Air' : 'Feed-o-meter';
  $('red-note').textContent = diving ? 'Low on air! Come up (Space)' : 'In the red! Catch some food, or Kenny brings his jar';
  $('energy-fill').style.width = `${Math.max(0, diving ? game.air / AIR.max * 100 : game.energy)}%`;
  $('feed').classList.toggle('red', diving ? game.air < 25 : inRedZone(game.energy));
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  $('job').textContent = game.talisman ? 'The opal! Out by the track at the bottom of the gorge'
    : game.hasKey ? 'Now the chest: on the bottom of the last hole' : 'Find the key on the bottom of one of the holes';
}

function start() {
  if (!entry.ok && !testingAll) { toast_('Mossman Gorge opens with the air and water talismans from Kuranda', 'bad'); return; }
  recordVisit('mossman');
  // The first time here: the fly-over first, with the frame-rate check running
  // (quality.js) so the detail is right before he moves. Then play begins.
  if (intro.due()) { $('title').hidden = true; sound.start(); intro.play(camera, begin); return; }
  begin();
}
function begin() {
  sound.start(); sound.startMusic('esplanade');
  $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true;
  bubbles.say(wally.root, "Mossman Gorge! Look at that water, clear as anything.", 3.6, 2);
}
function setPaused(p) { if (!game.running) return; game.paused = p; $('paused').hidden = !p; }

const STARS = [300, 550, 800];                                   // a first guess, to tune in play
function finish(won) {
  game.running = false;
  $('hud').hidden = true; $('touch').hidden = true; $('dive-buttons').hidden = true;
  const total = game.points + (won ? Math.round(game.energy * 2) + game.lives * 50 : 0);
  const stars = won ? starsFor(total, STARS) : 0;
  progress = loadSave(); if (!progress.trip) progress.trip = Trip.tripFor(progress);
  if (won) {
    sound.fanfare();
    const done = Trip.completeAttempt(progress.trip, attempt, { objectiveMet: true });
    if (done.ok) { progress.trip = done.trip; bankRun({ stars }); }
    progress = completeArea(progress, 'mossman', { score: total, stars });
  } else progress.trip = Trip.failAttempt(progress.trip, attempt).trip;
  saveProgress(progress);
  $('result-title').textContent = won ? 'The opal!' : 'Out of puff';
  $('result-why').textContent = won ? 'The earth talisman for the sceptre. On to the Daintree.' : 'Kenny can only bring his jar three times in a place.';
  markRetry(won, 'Mossman Gorge');
  $('result-stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Food caught', game.caught], ['Rock slides', game.slides], ['Total', total]]) {
    const li = document.createElement('li'); li.innerHTML = '<span></span><b></b>'; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  $('result').hidden = false;
  window.chomp.result = { won, total, stars };
}

$('play').onclick = start;
$('resume').onclick = () => setPaused(false);
$('again').onclick = () => location.reload();
addEventListener('visibilitychange', () => { if (document.hidden && game.running) setPaused(true); });

// ---- Loop -----------------------------------------------------------------------------------------
{ const p = setGroundStart(); wally.pos.copy(p); wally.root.position.copy(p); }
function setGroundStart() { const x = riverX(START.z) + START.x; return new THREE.Vector3(x, groundAt(x, START.z).y, START.z); }
camTarget.copy(wally.pos).add(new THREE.Vector3(0, 1.5, 0));
camera.position.set(camTarget.x, camTarget.y + 5, camTarget.z - 9);
let t = 0, last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  if (game.running && !game.paused) step(dt, t);
  bubbles.update(dt); fx.update(dt, t);
  world.update(t, camera);
  followCamera(dt);
  intro.update(dt, camera);                       // the first-visit fly-over, when it plays
  fpsWatch(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play')) start();
installMap({ pause: on => { if (game.running) game.paused = on; } });
installBook({ pause: on => { if (game.running) game.paused = on; } });
installGear({ scene, wally, food, mouth: () => wally.mouthPosition(), hasAir: true, underWater: () => dive.depth > 0.6, toast: (t, k) => toast_(t, k), openBook: () => openBook('wally'), running: () => game.running && !game.paused, pause: on => { if (game.running) game.paused = on; } });   // the carried items work here too (gear.js)
