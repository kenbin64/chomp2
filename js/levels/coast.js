// coast.js
// Up the coast to the Daintree (Ken, 2026-10-21; MASTER.md section 6, the rescue). Played: Wally,
// holding the sceptre high, leads the crocs of Croc Park north along the coast, past Palm Cove and
// Port Douglas, to the mouth of the Daintree River. Boats come alongside and the passengers throw
// him food, since he is still part human (Ken); the feed-o-meter and Kenny's jar as everywhere.
// Rules: coast-rules.js (the coast, the boats) and rescue-rules.js (the crocs' line), both tested.

import { startRun, addPoints, bankRun, installScore } from '../points.js';
import * as THREE from 'three';
import { LENGTH, MOUTH_Z, BEACH, LANE, SURFACE_DROP, PLACES, shoreX, placeAt, swimStep, reachedMouth, BOATS, boatTarget, boatStep, inThrowRange } from './coast-rules.js';
import { SPACING, addToTrail, placeInLine, follow } from './rescue-rules.js';
import { Wally } from '../wally.js';
import { Food, randomKind, useJarModel, kennysJar } from '../food.js';
import { Input, steering, easeBehind } from '../input.js';
import { Bubbles, pickLine } from '../bubbles.js';
import { Effects, CRUMBS } from '../fx.js';
import { loadModels, dress, ModelSkin, MODEL_FILES } from '../models.js';
import { createPost } from '../post.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import { addSky, addLights, addRanges } from '../world.js';
import { applySky, loadRealism } from '../realism.js';
import { Trees } from '../trees.js';
import { peopleModels } from '../tourists.js';
import { HumanoidPoser } from '../rig.js';
import { jarLabelTexture } from '../textures.js';
import { readProgress, outfitModel, wearing } from '../progress.js';
import { dressOutfit } from '../outfit.js';
import * as sound from '../sound.js';
import { installGear, snorkelling, drainFactor } from '../gear.js';
import { installBook, openBook } from '../book.js';
import { makeSceptre, ALL_TALISMANS, holdHigh } from '../sceptre-model.js';
import { areaIntro, courseShots, orbitShots } from '../area-intro.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, LIVES, REVIVE_ENERGY, inRedZone, aimOffset } from '../rules.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');

// ---- Stage --------------------------------------------------------------------------
let quality = pickQuality();
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality)); renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1600);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 72 : 58; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const fpsWatch = watchFrameRate(quality, lower => { quality = lower; renderer.setPixelRatio(pixelRatioFor(lower)); resize(); });
// Entering: a fly-over down the coast with its name (Ken).
const intro = areaIntro({ id: 'coast', name: 'Up the Coast', place: 'Cairns to the Daintree', focus: on => fpsWatch.focus(on),
  shots: () => courseShots({ from: { x: shoreX(260) - 14, z: 260 }, to: { x: wally.pos.x, z: wally.pos.z - 12 }, y: 0, height: 45, side: -26 }) });

const models = await loadModels([...MODEL_FILES, 'talisman-sun', 'talisman-moon', 'talisman-air', 'talisman-earth', 'talisman-fire', 'sceptre-hero', 'river-boat'], { light: touch || quality.name === 'low' });
useJarModel(models.get('jar'));
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light: touch || quality.name === 'low' });
const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));

// ---- The coast ---------------------------------------------------------------------------------
const Z0 = -80, Z1 = MOUTH_Z + 160;
let seed = 23; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
addSky(scene);
const sun = addLights(scene, quality); scene.add(sun.target);
if (realism && realism.sky) { applySky(scene, realism, sun, scene.children.find(o => o.isMesh && o.geometry.type === 'SphereGeometry')); scene.environmentIntensity = 0.55; }
if (scene.fog) { scene.fog.near = 120; scene.fog.far = 700; }
const ranges = addRanges(scene, new THREE.Color(0x7aa098), sun.position.clone().normalize(), { sink: 0, turn: Math.PI / 2 });   // the ranges behind the coast, to the west
// The land: up from the water's edge, the sand, then green rising to the hills behind.
const landHeight = (x, z) => { const d = x - shoreX(z); return d < 0 ? -2 - Math.min(4, -d * 0.1) : d < BEACH ? d * 0.12 : BEACH * 0.12 + (d - BEACH) * 0.05 + Math.max(0, d - 40) * 0.25; };
{
  const geo = new THREE.PlaneGeometry(420, Z1 - Z0, 140, 260); geo.rotateX(-Math.PI / 2); geo.translate(150, 0, (Z0 + Z1) / 2);
  const p = geo.attributes.position, col = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = x - shoreX(z); p.setY(i, landHeight(x, z));
    if (d < 0) c.set(0xc9b88a); else if (d < BEACH + 1) c.set(0xd9c79a); else c.set(0x4f7f38).lerp(new THREE.Color(0x2f5a28), Math.min(1, (d - BEACH) / 60));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); land.receiveShadow = true; scene.add(land);
}
// The sea: blue-green, glassy ripples, out to the horizon.
const ripple = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const a = Math.sin(x / 256 * Math.PI * 8 + Math.sin(y / 256 * Math.PI * 4) * 1.4), b = Math.cos(y / 256 * Math.PI * 10 + Math.sin(x / 256 * Math.PI * 2) * 2); const i = (y * 256 + x) * 4; img.data[i] = 128 + a * 40; img.data[i + 1] = 128 + b * 40; img.data[i + 2] = 255; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); return t;
})();
const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshPhysicalMaterial({ color: 0x14606e, roughness: 0.25, metalness: 0.05, normalMap: ripple, normalScale: new THREE.Vector2(0.3, 0.3), transparent: true, opacity: 0.92, clearcoat: 0.3 }));
sea.rotation.x = -Math.PI / 2; sea.position.set(-400, 0, (Z0 + Z1) / 2); sea.userData.noAO = true; scene.add(sea);
// Trees: palms along the beach, the rainforest behind, thick mangroves at the river mouth.
const trees = new Trees(scene, { light: quality.name === 'low' });
for (let z = Z0; z < Z1; z += 5 + rnd() * 5) { const x = shoreX(z) + BEACH + 1 + rnd() * 6; trees.add('palm', x, landHeight(x, z), z, 9 + rnd() * 5); }
for (let z = Z0; z < Z1; z += 12) for (let k = 0; k < 3; k++) { const x = shoreX(z) + 22 + k * 13 + rnd() * 4; trees.add(z > MOUTH_Z - 90 ? 'rainforest' : (rnd() < 0.5 ? 'rainforest' : 'umbrella'), x, landHeight(x, z) - 0.6, z + rnd() * 4, 15 + rnd() * 4); }
trees.build();
// The towns as they pass: low white and pastel buildings behind the beach (Palm Cove, Port Douglas).
for (const [zc, n] of [[PLACES[1][0] + 30, 9], [PLACES[2][0] + 40, 14]]) {
  const cols = [0xf4efe4, 0xe9e3d0, 0xdff0ea, 0xf2e3d0];
  for (let k = 0; k < n; k++) {
    const z = zc + (k - n / 2) * 9, x = shoreX(z) + 16 + rnd() * 10, h = 4 + rnd() * 5;
    const b = new THREE.Mesh(new THREE.BoxGeometry(6 + rnd() * 4, h, 6 + rnd() * 3), new THREE.MeshStandardMaterial({ color: cols[k % 4], roughness: 0.8 }));
    b.position.set(x, landHeight(x, z) + h / 2, z); b.castShadow = true; scene.add(b);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 2, 4), new THREE.MeshStandardMaterial({ color: k % 3 ? 0x9a4a3a : 0x5a6a72, roughness: 0.7 })); roof.rotation.y = Math.PI / 4; roof.position.set(x, landHeight(x, z) + h + 1, z); scene.add(roof);
  }
}
// The river mouth: the river comes out between mangroves at the end.
{
  const r = new THREE.Mesh(new THREE.PlaneGeometry(40, 160), new THREE.MeshStandardMaterial({ color: 0x3c5a3a, roughness: 0.2 }));
  r.rotation.x = -Math.PI / 2; r.rotation.z = 0.5; r.position.set(shoreX(MOUTH_Z) + 40, 0.05, MOUTH_Z + 50); scene.add(r);
}

// ---- The ground: always the sea, between the beach and the lane --------------------------------
setGround({
  stand: () => ({ y: -SURFACE_DROP, surface: 'water' }),
  move: (x, z, nx, nz) => swimStep(x, z, nx, nz),
  foodAt: () => 0, isWater: () => true,
  start: () => ({ x: shoreX(0) - 10, y: -SURFACE_DROP, z: 0 }),
});

// ---- Wally, the sceptre, Kenny, food ------------------------------------------------------------
const wally = new Wally(scene);
const progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
wally.useModel(models.get(outfitModel(progress)) || models.get('wally'));
if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(progress, 'wally'));
wally.pos.set(shoreX(0) - 10, -SURFACE_DROP, 0); wally.facing = 0; wally.root.position.copy(wally.pos);
const sceptreSet = makeSceptre(models, { height: 1.5, held: ALL_TALISMANS });   // all six talismans in place, shining; the sceptre glows (sceptre-model.js)
const sceptre = (() => { const g = new THREE.Group(); sceptreSet.group.position.y = 0.45; g.add(sceptreSet.group); g.userData.light = new THREE.PointLight(0xffe2a0, 0, 1);   /* kept for old code that sets it; not added to the scene: the sceptre lights itself */ scene.add(g); return g; })();
let hand = null; if (wally.skin) wally.skin.root.traverse(o => { if (o.isBone && /RightHand$/.test(o.name)) hand = o; });
function holdSceptre(t) {
  holdHigh(wally, sceptre);                                          // high in his right hand, steady (sceptre-model.js)
}
const food = new Food(scene); food.useModels(models);
const bubbles = new Bubbles(scene, touch ? 3 : 4);
const fx = new Effects(scene, food);
const kennyMesh = new THREE.Group(); kennyMesh.visible = false; scene.add(kennyMesh);
let kennyPoser = null;
{ const skin = dress(kennyMesh, models.get('kenny'), { height: 1.3 }); if (skin && skin.clips.size) kennyPoser = new HumanoidPoser(skin.root); if (skin) dressOutfit(skin.root, 'kenny', wearing(progress, 'kenny')); }   // his vest from the markets, in every area
const vegemite = kennysJar(jarLabelTexture()); vegemite.visible = false; scene.add(vegemite);

// ---- The crocs: the line from Croc Park, following him ---------------------------------------------
const crocGltf = models.get('croc-regular') || models.get('croc');
const crocs = Array.from({ length: 10 }, (_, i) => {
  const holder = new THREE.Group(); scene.add(holder); let skin = null;
  if (crocGltf) { skin = new ModelSkin(crocGltf, { length: 3.4 }); skin.root.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; }); holder.add(skin.root); skin.play('swim', { alternatives: ['idle'] }); }
  return { x: wally.pos.x + (i % 2 ? 1 : -1), z: wally.pos.z - SPACING * (i + 1), heading: 0, holder, skin };
});
const trail = [];
for (let z = wally.pos.z - SPACING * 12; z <= wally.pos.z; z += 0.4) trail.unshift({ x: wally.pos.x, z });

// ---- The boats alongside, passengers throwing (Ken) -----------------------------------------------
const cast = peopleModels(models);
const boats = BOATS.map((b, bi) => {
  const root = new THREE.Group(); scene.add(root);
  const gl = models.get('river-boat');
  if (gl) { const m = gl.scene.clone(true), box = new THREE.Box3().setFromObject(m); m.scale.setScalar(10 / box.getSize(new THREE.Vector3()).x); const b2 = new THREE.Box3().setFromObject(m); m.position.y = -0.45 - b2.min.y; m.rotation.y = Math.PI / 2; m.traverse(o => { if (o.isMesh) o.castShadow = true; }); root.add(m); }
  const people = [];
  for (let k = 0; k < 4; k++) {
    const gltf = cast[(bi * 4 + k) % Math.max(1, cast.length)]; if (!gltf) break;
    const tall = gltf.userData.tall, h = Array.isArray(tall) ? (tall[0] + tall[1]) / 2 : 1.72;
    const g = new THREE.Group(), skin = new ModelSkin(gltf, { height: h }); g.add(skin.root); root.add(g);
    g.position.set(1.05, 0.55, -3 + k * 2); g.rotation.y = Math.PI / 2;       // the side toward the shore, where Wally swims
    people.push({ g, skin, cool: 1 + Math.random() * 3, throwing: 0, avoid: gltf.userData.avoid });
  }
  const t = boatTarget(b, wally.pos.x, wally.pos.z);
  root.position.set(t.x - 30, 0, t.z - 50);
  return { ...b, root, people, p: { x: t.x - 30, z: t.z - 50, heading: 0 } };
});
function passengerThrow(p) {
  const hand = p.g.localToWorld(new THREE.Vector3(0, 1.45, 0.35));
  const flight = 1.1 + Math.random() * 0.5, a = Math.random() * Math.PI * 2, r = aimOffset(Math.random, 1.6);
  const target = new THREE.Vector3(wally.pos.x + wally.vel.x * flight * 1.2 + Math.cos(a) * r, wally.pos.y + 1.4, wally.pos.z + wally.vel.z * flight * 1.2 + Math.sin(a) * r);   // leading him well: he is swimming on
  food.throw(randomKind(p.avoid), hand, launchVelocity(hand, target, flight));
}

// ---- State, words -------------------------------------------------------------------------------
const input = new Input(canvas, touch ? { stick: $('stick'), knob: $('knob'), jump: $('t-jump'), fours: $('t-fours'), pause: $('t-pause'), cam: $('t-cam') } : null);
input.onPause = () => setPaused(!game.paused);
const game = { running: false, paused: false, done: false, energy: ENERGY_MAX, lives: LIVES, faint: 0, points: 0, caught: 0, streak: 0, place: '' };
window.chomp = { game, wally, crocs, boats, scene, camera };
function toast(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 2000);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}
function caption(text) { const el = $('cine-caption'); el.textContent = text; el.hidden = !text; el.classList.add('fade'); requestAnimationFrame(() => el.classList.remove('fade')); }

// ---- One frame -----------------------------------------------------------------------------------
const cam = { yaw: Math.PI, pitch: 0.4, dist: 15, manual: 0 };
function step(dt, t) {
  const k = input.read();
  if (k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0) cam.manual = 1.2;
  cam.yaw += k.turn + k.turnKeys * dt * 2; cam.pitch = Math.min(1.35, Math.max(0.05, cam.pitch + k.tilt));
  const control = game.faint > 0 || game.done ? { forward: 0, right: 0, jump: false, fours: false, turn: 0, turnKeys: 0, tilt: 0, zoom: 0 } : k;
  for (const e of wally.update(dt, control, cam.yaw, speedFactor(game.energy))) if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 20); }
  holdSceptre();
  addToTrail(trail, wally.pos.x, wally.pos.z, (crocs.length + 2) * SPACING);
  crocs.forEach((c, i) => { const want = placeInLine(trail, i + 1); if (want) { const f = follow(c, want, dt); c.x = f.x; c.z = f.z; c.heading = f.heading; } c.holder.position.set(c.x, -0.15, c.z); c.holder.rotation.y = c.heading; if (c.skin) c.skin.update(dt); });

  // The boats keep alongside; their passengers throw when he is in reach.
  for (const b of boats) {
    b.p = boatStep(b.p, boatTarget(b, wally.pos.x, wally.pos.z), dt);
    b.root.position.set(b.p.x, Math.sin(t * 1.3 + b.ahead) * 0.08, b.p.z); b.root.rotation.y = b.p.heading ?? 0;
    const near = inThrowRange(b.p.x, b.p.z, wally.pos.x, wally.pos.z);
    for (const p of b.people) {
      p.cool -= dt;
      if (p.throwing > 0) { p.throwing -= dt; if (p.throwing <= 0.4 && !p.thrown) { p.thrown = true; passengerThrow(p); } }
      else if (near && p.cool <= 0 && !game.done) { p.throwing = 0.75; p.thrown = false; p.cool = 2.5 + Math.random() * 3; p.skin.play('throw', { once: true, fit: 0.6, alternatives: ['idle'] }); if (Math.random() < 0.2) bubbles.say(p.g, pickLine('touristThrow'), 2.2); }
      if (p.throwing <= 0) p.skin.play(near ? 'wave' : 'idle', { alternatives: ['idle'] });
      p.skin.update(dt);
    }
  }

  // Energy, Kenny.
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (!game.done && game.faint <= 0) game.energy -= energyDrain(wally.mode, moving, 'park') * drainFactor() * dt;   // a long swim: the gentlest drain
  if (game.energy <= 0 && game.faint <= 0 && !game.done) outOfPuff();
  if (game.faint > 0) rescueStep(dt, t);

  // Food.
  const { dissolved } = food.update(dt, t);
  for (const it of dissolved) game.streak = 0;
  const mouth = wally.mouthPosition(); let closest = Infinity;
  for (const it of [...food.items]) {
    const p = it.mesh.position, d = it.landed && !wally.airborne ? Math.hypot(p.x - mouth.x, p.z - mouth.z) + (mouth.y - p.y > 3.2 ? 99 : 0) : p.distanceTo(mouth);
    if (d < 1.5) {
      fx.burst(p, CRUMBS[it.kind] || [0xffffff]); food.take(it, 'eaten'); wally.chomp(); sound.play.chomp();
      game.streak++; game.caught++;
      const how = it.landed ? 'ground' : (wally.airborne ? 'leap' : 'air'), pts = catchPoints(how, game.streak, false); addPoints(how);
      game.points += pts; game.energy = Math.min(ENERGY_MAX, game.energy + FOODS[it.kind].energy);
      toast(`+${pts} ${how === 'air' ? 'In the air!' : it.name}`);
    } else closest = Math.min(closest, d);
  }
  wally.jawWant = closest < 4.5 ? 0.75 : 0.12;

  // The places as they pass, and the river mouth.
  const here = placeAt(wally.pos.z);
  if (here !== game.place) { game.place = here; caption(here); setTimeout(() => { if (game.place === here) caption(''); }, 3200); if (here === 'Palm Cove') bubbles.say(wally.root, 'Palm Cove! Keep up, fellas!', 2.8); if (here === 'Port Douglas') bubbles.say(wally.root, 'Port Douglas. Not far now!', 2.8); }
  if (!game.done && reachedMouth(wally.pos.z)) {
    game.done = true; wally.cheer = 1.2; bubbles.say(wally.root, 'The Daintree! Up the river to the boat, everyone!', 3.4);
    setTimeout(finish, 2600);
  }
  drawHud();
}
function outOfPuff() {
  game.lives--; sound.play.lose();
  if (game.lives <= 0) { game.done = true; finish(false); return; }
  game.faint = 3.2; wally.setNapping(true); kennyMesh.visible = vegemite.visible = true;
  toast(`Out of puff! ${game.lives} left. Here comes Kenny`, 'bad'); bubbles.say(kennyMesh, "Hang on, Wally! Comin'!", 2.6);
}
function rescueStep(dt, t) {
  game.faint -= dt;
  kennyMesh.position.set(wally.pos.x + 1.4, 0.05, wally.pos.z + 0.4); kennyMesh.rotation.y = -Math.PI / 2;
  vegemite.position.set(wally.pos.x + 0.6, wally.pos.y + 0.6 + Math.sin(t * 4) * 0.1, wally.pos.z + 0.3); vegemite.rotation.y += dt * 3;
  if (kennyPoser && kennyPoser.ok) kennyPoser.pose({ time: t, cheer: 1, napping: false });
  if (game.faint <= 0) { game.energy = Math.max(game.energy, REVIVE_ENERGY); kennyMesh.visible = vegemite.visible = false; wally.setNapping(false); sound.play.powerup(); toast("Kenny's jar! Back on your feet", 'good'); }
}
const camTarget = new THREE.Vector3();
function followCamera(dt) {
  camTarget.lerp(wally.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), Math.min(1, dt * 6));
  cam.manual = Math.max(0, cam.manual - dt);
  if (game.running && cam.manual <= 0) { if (steering()) cam.yaw = easeBehind(cam.yaw, wally.facing, dt); else { const dx = camera.position.x - camTarget.x, dz = camera.position.z - camTarget.z; if (dx * dx + dz * dz > 0.01) cam.yaw = Math.atan2(dx, dz); } }
  const cp = Math.cos(cam.pitch);
  camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
  camera.position.y = Math.max(camera.position.y, 1); camera.lookAt(camTarget);
  if (window.chomp.camHold) window.chomp.camHold(camera);
}
function drawHud() {
  $('score').textContent = game.points.toLocaleString(); $('caught').textContent = game.caught;
  $('energy-fill').style.width = `${Math.max(0, game.energy)}%`; $('feed').classList.toggle('red', inRedZone(game.energy));
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  $('job').textContent = `Lead the crocs up the coast to the Daintree (${Math.max(0, Math.round(MOUTH_Z - wally.pos.z))} m to go)`;
}
// On to the next stage of the journey by itself: a fade to black, its name, and it carries on.
function carryOn(page, title) {
  const f = document.getElementById('fade'), c = document.getElementById('cine-caption');
  if (c) { c.textContent = title; c.hidden = false; }
  if (f) f.classList.add('on');
  setTimeout(() => { location.href = page; }, 2200);
}
function finish(won = true) {
  game.running = false; $('hud').hidden = true; $('touch').hidden = true; caption('');
  if (won && !params.has('stay')) { carryOn('push.html?go', 'The Great Push'); return; }
  $('result-title').textContent = won ? 'The mouth of the Daintree River' : 'Out of puff';
  $('result-why').textContent = won ? 'All ten crocs made it up the coast. Next: up the river to the boat on the sandbar, and the push.' : 'Kenny can only bring his jar three times. Try the swim again.';
  $('result').hidden = false; window.chomp.result = { won };
  if (won) { $('again').textContent = 'The Great Push'; $('again').onclick = () => { location.href = 'push.html'; }; }
}
function start() { if (intro.due()) { $('title').hidden = true; sound.start(); intro.play(camera, begin); return; } begin(); }
function begin() { sound.start(); sound.startMusic('reef'); $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch; game.running = true; startRun('finale', { carry: true }); bubbles.say(wally.root, 'North to the Daintree, fellas! Follow the sceptre!', 3.4, 2); }
function setPaused(p) { if (!game.running) return; game.paused = p; $('paused').hidden = !p; }
$('play').onclick = start; $('resume').onclick = () => setPaused(false); $('again').onclick = () => location.reload();

// ---- Loop -----------------------------------------------------------------------------------------
camTarget.copy(wally.pos).add(new THREE.Vector3(0, 1.3, 0));
let t = 0, last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  if (game.running && !game.paused) step(dt, t); else holdSceptre();
  bubbles.update(dt); fx.update(dt, t); trees.update(t);
  ripple.offset.set(t * 0.004, t * 0.009);
  if (ranges && ranges.userData.follow) ranges.userData.follow(camera);
  sun.position.copy(wally.pos).add(new THREE.Vector3(-60, 120, -50)); sun.target.position.copy(wally.pos);
  sceptreSet.update(t); followCamera(dt); intro.update(dt, camera); fpsWatch(dt);
  post.render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play') || params.has('go')) start();   // ?go: arriving in the middle of the story, straight in (the fly-over still plays)
installBook({ pause: on => { if (game.running) game.paused = on; } });
installGear({ scene, wally, food, mouth: () => wally.mouthPosition(), hasAir: false, toast: (t, k) => toast(t, k), openBook: () => openBook('wally'), running: () => game.running && !game.paused, pause: on => { if (game.running) game.paused = on; } });   // the carried items work here too (gear.js)
installScore({ pause: on => { if (game.running) game.paused = on; } });   // the points and the Scoreboard (points.js)
