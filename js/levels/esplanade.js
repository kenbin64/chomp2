// esplanade.js
// The Esplanade. Wally has the run of the Cairns Esplanade boardwalk: up and
// down it, and off the side into the ocean for a swim. The picnic groups along
// the city side throw lunch when he is in the sweet spot and bolt if he crowds
// them. Bins, benches, pelicans and fig branches are in the way, joggers come
// and go, and there are stingers in the water. Feed out every group, fill the
// feed-o-meter, and the Lagoon pool at the end is the way on. Fed-out groups
// leave pearls, which carry on to the Great Barrier Reef. In the sea he can
// swim under water (air meter) and crawl back up onto the boardwalk.

import * as THREE from 'three';
import { Wally } from '../wally.js';
import { Food, randomKind, kennysToast, useJarModel, useToastModel } from '../food.js';
import { Input } from '../input.js';
import { Bubbles, pickLine, chatty } from '../bubbles.js';
import { Effects, CRUMBS } from '../fx.js';
import { loadModels, dress } from '../models.js';
import { usePalmCrown } from '../palms.js';
import { createPost } from '../post.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { loadRealism } from '../realism.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, LIVES, REVIVE_ENERGY, inRedZone } from '../rules.js';
import { FULL } from '../quests.js';
import { HumanoidPoser } from '../rig.js';
import { jellyModel, dressedJelly } from '../hazards.js';
import { completeArea, readProgress, starsFor, POSTCARDS, bankFinds } from '../progress.js';
import { PATH, generateCourse, hits, runScore, STARS, MANGO_SET_BONUS } from './esplanade-rules.js';
import { buildEsplanade, obstacleModel, mangoModel, useMangoModel } from './esplanade-scene.js';
import { Clusters } from '../clusters.js';
import { airStep, AIR } from './reef-rules.js';
import { clamWithPearl } from './reef-scene.js';
import { kennysJar } from '../food.js';
import { jarLabelTexture } from '../textures.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');
const G = PATH.ground;
const POOL_Z = PATH.finish + 4;

// ---- The ground of this level ----------------------------------------------
// The boardwalk (|x| <= half) at height G, the ocean beside it (x < -half) with
// its surface at 0, the city side level with the deck, and the Lagoon pool at
// the end, its water a little below the deck.
const inPool = (x, z) => z > POOL_Z + 1 && z < POOL_Z + 31 && Math.abs(x) < 12.5;
const inSea = (x, z) => x < -PATH.half && !inPool(x, z);
const POOL_WATER = G - 0.3;
// Swimming under the sea beside the boardwalk: Shift goes under, Ctrl+Shift comes up.
// The sea's own ground reads seaDive, so it is declared before the ground.
const SEA_FLOOR = -5.5, SEA_SWIM = -2.6, SEA_TOP = -0.45;
const seaDive = { under: false, depth: SEA_TOP };
let poolOpen = () => false;              // set below, once the game state exists
const landGround = {
  stand(x, z, feetY) {
    if (inPool(x, z)) return { y: POOL_WATER - 0.45, surface: 'water' };
    if (inSea(x, z)) return { y: seaDive.depth, surface: 'water' };
    if (feetY < G - 0.35) return { y: seaDive.depth, surface: 'water' };   // in the water right against the boardwalk
    return { y: G, surface: Math.abs(x) <= PATH.half ? 'deck' : 'land' };
  },
  move(x, z, nx, nz, y) {
    if (inPool(nx, nz) && !poolOpen()) nz = Math.min(nz, POOL_Z + 0.5);       // the Lagoon opens when the job is done
    if (inPool(nx, nz)) return { x: Math.max(-12, Math.min(12, nx)), z: Math.min(nz, POOL_Z + 28) };
    let tx = Math.min(PATH.half - 0.4, Math.max(-40, nx));            // the city side is the picnickers'; the sea goes on
    if (y < G - 0.35 && tx > -PATH.half - 0.3) tx = -PATH.half - 0.3;  // from the water the boardwalk edge is a wall: leap up
    return { x: tx, z: Math.max(-12, Math.min(nz, POOL_Z + 28)) };
  },
  foodAt: (x, z) => inPool(x, z) ? POOL_WATER : inSea(x, z) ? 0 : G,
  isWater: (x, z) => inPool(x, z) || inSea(x, z),
  start: () => ({ x: 0, y: G, z: 0 }),
};
setGround(landGround);

// ---- Stage ----------------------------------------------------------------
let quality = pickQuality();
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality));
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 72 : 58;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const fpsWatch = watchFrameRate(quality, lower => {
  quality = lower; renderer.setPixelRatio(pixelRatioFor(lower));
  if (renderer.shadowMap.enabled !== lower.shadows) { renderer.shadowMap.enabled = lower.shadows; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
  resize();
});

const models = await loadModels(undefined, { light: touch || quality.name === 'low' });
useJarModel(models.get('jar'));                    // Ken's jar for Kenny's rescue, when present
useToastModel(models.get('toast'));                // and his toast power-up
useMangoModel(models.get('mango'));                // Ken's mango for the Golden Mangoes
usePalmCrown(models.get('palm-crown'));                // Ken's palm crown on the built trunks
// The photographed surfaces and ripple picture (realism.js), as in the park; ?real=0 turns them off.
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light: touch || quality.name === 'low' });
const world = buildEsplanade(scene, quality, {}, realism);
const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));
if (!scene.environment) {   // the photographed sky already lights the scene when it is present
  const env = new THREE.Scene();
  const sky = scene.children.find(o => o.isMesh && o.geometry.type === 'SphereGeometry');
  if (sky) env.add(sky.clone());
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.04).texture; scene.environmentIntensity = 0.8; pmrem.dispose();
}

const wally = new Wally(scene);
wally.facing = 0;                                     // facing down the boardwalk
wally.useModel(models.get('wally'));
const food = new Food(scene); food.useModels(models);
const bubbles = new Bubbles(scene, touch ? 3 : 4);
const fx = new Effects(scene, food);

// The course: obstacles, mangoes, picnic shelters with people throwing food.
// A new course every visit (Ken: never the same twice). ?seed=N gives a fixed one, for testing.
const course = generateCourse(Number(params.get('seed')) || 1 + Math.floor(Math.random() * 2147483000));
const obstacles = course.obstacles.map(o => {
  const mesh = obstacleModel(o.kind);
  mesh.position.set(o.x, G, o.z);
  if (o.kind === 'jogger') mesh.rotation.y = Math.PI;                 // running back up the promenade
  if (o.kind === 'pelican') mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);
  return { ...o, mesh, hit: false, phase: Math.random() * 6 };
});
const mangoes = course.mangoes.map(m => {
  const mesh = mangoModel(); mesh.position.set(m.x, m.y, m.z); scene.add(mesh);
  return { ...m, mesh, taken: false };
});
// Each picnic shelter has a group with a little food. The same rule as the park:
// run past in the middle and they throw; hug their side and they bolt.
const clusters = new Clusters(scene, () => G, bubbles);
for (const s of course.shelters) {
  world.shelter(s.z);
  clusters.add({ x: PATH.half + 3.4, z: s.z, size: 2 + (s.z % 3 === 0 ? 1 : 0), food: 5, rate: 0.55 });
}
// A last group just before the Lagoon, so he can top up for the finish.
world.shelter(PATH.finish - 12);
clusters.add({ x: PATH.half + 3.4, z: PATH.finish - 12, size: 3, food: 7, rate: 0.45 });

// Box jellyfish drifting in the sea beside the boardwalk: it is stinger season.
const jellies = [];
for (let z = 40, i = 0; z < PATH.finish - 20; z += 18 + (z % 13), i++) {
  const m = dressedJelly(models.get('jellyfish')); const x = -PATH.half - 2 - (z % 11);
  // Every other one drifts deep, where Wally meets it swimming under water.
  const y = i % 2 ? -2.4 : -0.15;
  m.position.set(x, y, z); scene.add(m); jellies.push({ m, x, z, y, phase: z, cool: 0 });
}

// Kenny turns up at the side of the path, ahead, when Wally is in the red.
const kennyMesh = new THREE.Group(); scene.add(kennyMesh); kennyMesh.visible = false;
let kennyPoser = null;
{
  const k = models.get('kenny');
  const kennySkin = dress(kennyMesh, k, { height: 1.3 });
  if (kennySkin && kennySkin.clips.size) kennyPoser = new HumanoidPoser(kennySkin.root);   // waving, with his jar out
  if (!kennySkin) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 18), new THREE.MeshStandardMaterial({ color: 0x9a9a9e }));
    body.position.y = 0.55; body.scale.y = 1.15; kennyMesh.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 18), body.material); head.position.y = 1.15; kennyMesh.add(head);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), body.material); ear.position.set(s * 0.38, 1.35, 0); kennyMesh.add(ear); }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.3 })); nose.position.set(0, 1.1, 0.33); nose.scale.y = 1.3; kennyMesh.add(nose);
  }
}
let toast = null;

// ---- Controls and state -------------------------------------------------------
const input = new Input(canvas, touch ? { stick: $('stick'), knob: $('knob'), jump: $('t-jump'), fours: $('t-fours'), pause: $('t-pause'), cam: $('t-cam') } : null);
input.onPause = () => setPaused(!game.paused);
// The on-screen Dive and Up buttons (the same as Shift and Ctrl+Shift under water).
for (const [id, flag] of [['b-dive', 'diveQueued'], ['b-up', 'upQueued']]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); game[flag] = true; });
}
input.onMute = () => toast_('Sound ' + (sound.toggleMute() ? 'off' : 'on'), 'info');

let progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
const game = {
  running: false, paused: false, done: false, countdown: 0, time: 0,
  energy: ENERGY_MAX, lives: LIVES, nap: 0, stun: 0, boost: 0, kennyCool: 8, kennyUsed: false,
  points: 0, foodPoints: 0, mangoes: 0, caught: 0, stumbles: 0, streak: 0, hungry: 0, scared: 0,
  groupsDone: 0, groupsTotal: 0, ready: false,
  // In the sea: air while under water, Kenny's rescue, crawling out. Pearls from fed-out groups.
  air: AIR.max, pearls: 0, faint: 0, hint: 0, foursWas: false, climb: 0, upQueued: false, diveQueued: false,
};
window.chomp = { game, wally, food };

function toast_(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 1800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

// ---- Pearls on the boardwalk ------------------------------------------------------
// A group fed out to the last bite leaves a pearl behind (not a group he scared
// off). Pearls start on this level and run through the game: the more he has,
// the better his chances in the cave, where only a pearl opens the giant clam.
const landPearls = [];
function dropPearl(cluster) {
  const mesh = clamWithPearl();
  const z = cluster.root.position.z, x = PATH.half - 1.3;
  mesh.position.set(x, G, z); mesh.scale.setScalar(1.4);
  scene.add(mesh); landPearls.push({ mesh, x, z, taken: false });
  toast_('They left you a pearl!', 'info');
}

// Crawling out of the sea onto the boardwalk: from where he was to the deck's edge.
const climbFrom = new THREE.Vector3(), climbTo = new THREE.Vector3();
// Kenny paddles out on a float with his jar of Vegemite when Wally runs out of air.
const kennyFloat = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.22, 10, 28), new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.5 }));
kennyFloat.rotation.x = Math.PI / 2; kennyFloat.visible = false; scene.add(kennyFloat);
const vegemite = kennysJar(jarLabelTexture()); vegemite.visible = false; scene.add(vegemite);

// What the scene looks like above the water, under it, and in the cave.
const aboveFog = scene.fog, aboveBackground = scene.background;
const skyMesh = scene.children.find(o => o.isMesh && o.geometry.type === 'SphereGeometry');
const underFog = new THREE.FogExp2(0x0d5d78, 0.034);
const underColour = new THREE.Color(0x0b5470);
let underNow = null;
// The underside of the sea, seen from below beside the boardwalk.
const seaCeiling = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshBasicMaterial({ color: 0x8fe8f5, transparent: true, opacity: 0.88, side: THREE.DoubleSide, fog: false, depthWrite: false }));
seaCeiling.rotation.x = Math.PI / 2; seaCeiling.position.y = -0.06; seaCeiling.visible = false; scene.add(seaCeiling);
function looksUnder(under) {
  const key = under ? 'sea' : 'above';
  if (key === underNow) return;
  underNow = key;
  scene.fog = under ? underFog : aboveFog;
  scene.background = under ? underColour : aboveBackground;
  if (skyMesh) skyMesh.visible = !under;
  world.ring.visible = !under && !world.ring.userData.off;
  if (world.ranges) world.ranges.visible = !under;
  seaCeiling.visible = under;
}

// Out of air anywhere: a life gone and Kenny on his way. False when it was the last life.
function outOfAir() {
  game.lives--; sound.play.lose();
  if (game.lives <= 0) { finish(false, 'air'); return false; }
  game.faint = 3.2; wally.setNapping(true);
  kennyFloat.visible = vegemite.visible = kennyMesh.visible = true;
  toast_(`Out of air! ${game.lives} left. Here comes Kenny`, 'bad');
  bubbles.say(kennyMesh, "Hang on, Wally! Here's me jar!", 2.6);
  return true;
}
// Kenny on his float beside Wally, holding out the Vegemite, until Wally is revived.
function rescueStep(dt, t) {
  game.faint -= dt;
  // On the water he paddles up on his float; on land he simply stands beside Wally.
  const afloat = kennyFloat.visible, base = afloat ? 0 : wally.pos.y;
  kennyFloat.position.set(wally.pos.x + 1.6, 0.05, wally.pos.z + 0.6);
  kennyMesh.position.set(kennyFloat.position.x, afloat ? -0.25 : base, kennyFloat.position.z); kennyMesh.rotation.y = -Math.PI / 2;
  vegemite.position.set(wally.pos.x + 0.6, base + 0.6 + Math.sin(t * 4) * 0.1, wally.pos.z + 0.3); vegemite.rotation.y += dt * 3;
  if (kennyPoser && kennyPoser.ok) kennyPoser.pose({ time: t, cheer: 1, napping: false });
  if (game.faint <= 0) {
    const wasAir = game.air < AIR.max * 0.5;
    game.air = AIR.max; game.energy = Math.max(game.energy, REVIVE_ENERGY);
    kennyFloat.visible = vegemite.visible = kennyMesh.visible = false;
    wally.setNapping(false); sound.play.powerup();
    if (wasAir) { toast_("Kenny's jar! Full of beans. Shift (Fours) to dive", 'good'); bubbles.say(wally.root, 'Thanks, Kenny! Back down I go!', 3.4); }
    else { toast_("Kenny's jar! Back on your feet", 'good'); bubbles.say(wally.root, pickLine('wallyToast'), 3.4); }
  }
}

// ---- Throwing from the shelters -------------------------------------------------
// People at a shelter throw as Wally comes past, aiming where he will be.
function throwFrom(hand) {
  const flight = 1.3 + Math.random() * 0.5;
  const speed = Math.max(3, Math.hypot(wally.vel.x, wally.vel.z));
  const tz = wally.pos.z + speed * flight + (Math.random() - 0.5) * 3;
  const tx = (Math.random() * 2 - 1) * (PATH.half - 1);
  const ty = G + 2 + (Math.random() < 0.3 ? 1.2 : 0);
  return food.throw(randomKind(), hand, launchVelocity(hand, new THREE.Vector3(tx, ty, tz), flight));
}

// ---- One frame --------------------------------------------------------------------
const bot = params.has('bot') ? makeBot() : null;
game.groupsTotal = clusters.list.length;
poolOpen = () => game.ready;

// The follow camera, as in the park: on a leash behind him, C swings it round.
const cam = { yaw: 0, pitch: 0.35, dist: 11, manual: 0, recenter: false, side: 'behind', still: 0 };
window.chomp.cam = cam;                                  // for testing in the browser console
window.chomp.camera = camera; window.chomp.scene = scene;

function step(dt, t) {
  const k = input.read();
  game.time += dt;
  if (bot) Object.assign(k, bot());
  if (k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0) { cam.manual = 1.2; cam.recenter = false; }
  if (k.recenter) { cam.side = cam.side === 'behind' ? 'front' : 'behind'; cam.recenter = true; }
  cam.yaw += k.turn + k.turnKeys * dt * 2;
  cam.pitch = Math.min(1.35, Math.max(-0.15, cam.pitch + k.tilt));
  cam.dist = Math.min(22, Math.max(5, cam.dist + k.zoom));

  game.stun = Math.max(0, game.stun - dt); game.boost = Math.max(0, game.boost - dt);
  if (game.climb > 0) seaDive.under = false;
  game.kennyCool -= dt; game.hungry -= dt;
  const napping = game.nap > 0;
  let pace = speedFactor(game.energy) * (game.stun > 0 ? 0.4 : 1) * (game.boost > 0 ? 1.3 : 1);
  // In the sea: Shift goes under, Ctrl+Shift comes back up (no croc leap while under).
  const foursPressed = k.fours && !game.foursWas; game.foursWas = k.fours;
  const inTheSea = wally.surface === 'water' && inSea(wally.pos.x, wally.pos.z);
  if (game.faint <= 0 && !napping && !game.done) {
    // Shift dives, Ctrl+Shift comes up (Ken's keys, as on the reef); Space and
    // the on-screen buttons still work too.
    const ctrlShift = k.fours && k.ctrl, ctrlShiftPressed = ctrlShift && !game.ctrlShiftWas; game.ctrlShiftWas = ctrlShift;
    const dive = (foursPressed && !k.ctrl) || game.diveQueued, up = ctrlShiftPressed || k.jump || game.upQueued;
    if (inTheSea && dive && !seaDive.under) { seaDive.under = true; bubbles.say(wally.root, 'Down I go!', 2); }
    else if (seaDive.under && up) seaDive.under = false;
  }
  game.diveQueued = game.upQueued = false;
  // The Dive / Up buttons show whenever he is in the sea.
  $('dive-buttons').hidden = !inTheSea || game.done;
  $('b-dive').disabled = seaDive.under; $('b-up').disabled = !seaDive.under;
  if (!inTheSea && wally.surface !== 'water') seaDive.under = false;
  sound.underwaterMusic(seaDive.under);              // the music goes soft and muffled under water
  if (inTheSea && !game.seaTip) { game.seaTip = true; toast_('Shift (Fours) to dive under. Swim to the boardwalk edge to climb out', 'info'); }
  const wantSea = seaDive.under ? SEA_SWIM : SEA_TOP;
  seaDive.depth += Math.sign(wantSea - seaDive.depth) * Math.min(Math.abs(wantSea - seaDive.depth), 4 * dt);
  const control = napping || game.done || game.faint > 0 ? { forward: 0, right: 0, jump: false, fours: false }
    : seaDive.under || seaDive.depth < SEA_TOP - 0.2 ? { ...k, jump: false } : k;
  // Crawling out: at the boardwalk's edge, pushing toward it, he hauls himself up.
  // Which way he is pushing: keyboard, straight ahead while Up is held; phone stick, relative to the camera.
  const wantX = control.steer ? Math.sin(wally.facing) * (control.forward > 0 ? 1 : 0) : -Math.sin(cam.yaw) * control.forward + Math.cos(cam.yaw) * control.right;
  if (game.climb > 0) {
    game.climb -= dt;
    const u = 1 - Math.max(0, game.climb) / 0.6, e = u * u * (3 - 2 * u);
    wally.pos.set(climbFrom.x + (climbTo.x - climbFrom.x) * e, climbFrom.y + (climbTo.y - climbFrom.y) * Math.min(1, e * 1.4) + Math.sin(u * Math.PI) * 0.35, climbFrom.z);
    wally.root.position.copy(wally.pos);
    if (game.climb <= 0) { wally.pos.copy(climbTo); wally.vel.set(0, 0, 0); wally.vy = 0; wally.grounded = true; wally.surface = 'deck'; }
  } else {
    if (wally.surface === 'water' && !seaDive.under && seaDive.depth > SEA_TOP - 0.2 && wally.pos.x > -PATH.half - 1.2 && wantX > 0.35 && !inPool(wally.pos.x, wally.pos.z)) {
      climbFrom.copy(wally.pos); climbTo.set(-PATH.half + 0.8, G, wally.pos.z); game.climb = 0.6;
      sound.play.jump(); fx.splash(wally.pos, 14);
    }
    for (const e of wally.update(dt, control, cam.yaw, pace)) {
      if (e === 'jump') sound.play.jump(); else if (e === 'land') sound.play.land();
      else if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 30); }
    }
  }
  // Air: it runs down under the water and fills again at the top.
  if (!game.done && game.faint <= 0) game.air = airStep(game.air, seaDive.depth < -1.0 ? 'under' : 'surface', dt);
  if (game.faint > 0) rescueStep(dt, t);
  else if (game.air <= 0 && !game.done) { seaDive.under = false; if (!outOfAir()) return; }
  looksUnder(camera.position.y < -0.2);
  if (seaCeiling.visible) { seaCeiling.position.x = camera.position.x; seaCeiling.position.z = camera.position.z; }
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (!game.done && game.boost <= 0 && !napping) game.energy -= energyDrain(wally.mode, moving, 'esplanade') * dt;

  // Obstacles
  for (const o of obstacles) {
    if (o.kind === 'jogger') {
      o.dir = o.dir || -1;
      o.z += o.dir * 2.6 * dt;
      if (o.z < -5 || o.z > PATH.finish - 5) { o.dir *= -1; o.mesh.rotation.y = o.dir > 0 ? 0 : Math.PI; o.hit = false; }
      o.mesh.position.z = o.z;
      const P = o.mesh.userData.person; o.phase += dt * 9;
      if (P) { P.legs[0].rotation.x = Math.sin(o.phase) * 0.8; P.legs[1].rotation.x = -Math.sin(o.phase) * 0.8; P.arms[0].rotation.x = -Math.sin(o.phase) * 0.7; P.arms[1].rotation.x = Math.sin(o.phase) * 0.7; }
    }
    if (o.kind === 'pelican' && o.flee) { o.mesh.position.y += dt * 4; o.mesh.position.x -= dt * 6; }
    if (o.hit && o.kind !== 'jogger') { if (Math.abs(o.z - wally.pos.z) > 3) o.hit = false; else continue; }
    if (game.done || Math.abs(o.z - wally.pos.z) > 3) continue;
    if (hits(o, wally.pos.x, wally.pos.z, wally.pos.y, wally.mode)) stumble(o);
  }

  // Jellyfish drift; swimming into one stings.
  for (const j of jellies) {
    j.phase += dt; j.cool = Math.max(0, j.cool - dt);
    j.m.position.set(j.x + Math.sin(j.phase * 0.4) * 1.5, j.y + Math.sin(j.phase * 1.6) * 0.1, j.z);
    const pulse = Math.sin(j.phase * 3) * 0.5 + 0.5; j.m.scale.set(1 + pulse * 0.08, 1 - pulse * 0.08, 1 + pulse * 0.08);
    // It stings when he is at its depth: surface ones at the surface, deep ones under water.
    const level = Math.abs(wally.pos.y - j.y) < 1.4;
    if (wally.surface === 'water' && level && j.cool <= 0 && Math.hypot(wally.pos.x - j.m.position.x, wally.pos.z - j.z) < 1.3) {
      j.cool = 2; game.energy -= 12; game.streak = 0; wally.knock(j.m.position.x, j.z); fx.shake(0.4, 0.3);
      if (seaDive.under) game.air = Math.max(0, game.air - AIR.sting);
      sound.play.sting(); toast_('Box jelly! Ouch!', 'bad'); bubbles.say(wally.root, pickLine('wallySting'), 3.4);
    }
  }

  // Mangoes
  for (const m of mangoes) {
    if (m.taken) continue;
    m.mesh.rotation.y += dt * 3; m.mesh.position.y = m.y + Math.sin(t * 3 + m.z) * 0.08;
    if (Math.abs(m.z - wally.pos.z) < 1.4 && Math.abs(m.x - wally.pos.x) < 1.1 && Math.abs(m.y - (wally.pos.y + 1.2)) < 1.4) {
      m.taken = true; scene.remove(m.mesh); game.mangoes++; game.points += 1; sound.play.goal();
      fx.burst(m.mesh.position, [0xffb51f, 0xffe066], 8);
      if (game.mangoes === mangoes.length) {                      // the full set: Ken's bonus, one star's worth
        game.points += MANGO_SET_BONUS; fx.burst(wally.pos, [0xffb51f, 0xffe066, 0xffffff], 30);
        toast_(`Every Golden Mango! +${MANGO_SET_BONUS}`, 'good'); bubbles.say(wally.root, 'Crikey! The whole set!', 3.4);
      }
    }
  }

  // People at the shelters throw as he comes by, unless he scares them off.
  if (!game.done) for (const e of clusters.update(dt, t, wally.pos, throwFrom)) {
    if (e.type === 'throw' && Math.random() < 0.35) bubbles.say(e.thrower.g, pickLine('touristThrow'), 2.3);
    if (e.type === 'flee') { game.scared++; toast_('Too close! They ran off with their lunch', 'bad'); }
    if ((e.type === 'flee' || e.type === 'empty') && !e.cluster.counted) {
      e.cluster.counted = true; game.groupsDone++;
      if (e.type === 'empty') dropPearl(e.cluster);          // fed out to the last bite: a pearl for Wally
    }
  }
  for (const p of landPearls) {
    if (p.taken) continue;
    p.mesh.userData.pearl.position.y = 0.16 + Math.sin(t * 3 + p.z) * 0.05;
    if (Math.abs(p.z - wally.pos.z) < 1.4 && Math.abs(p.x - wally.pos.x) < 1.4 && wally.pos.y > G - 0.5) {
      p.taken = true; scene.remove(p.mesh); game.pearls++; game.points += 5; sound.play.goal();
      fx.burst(p.mesh.position, [0xffffff, 0xffd6f0], 10); toast_(`A pearl! ${game.pearls} now`, 'good');
    }
  }
  // Ken's rule: every group fed out, then a full tank, then on to the Lagoon.
  if (!game.ready && game.groupsDone >= game.groupsTotal) {
    if (game.energy >= FULL) {
      game.ready = true; sound.play.powerup();
      toast_('Every group fed and a full tank! Head for the Lagoon', 'info');
    }
    else if (!food.items.length && !(toast)) { finish(false, 'hungry'); return; }
  }

  // Food: catch in the air, or scoop up off the path.
  const { dissolved } = food.update(dt, t);
  for (const it of dissolved) { if (game.streak >= 3) toast_('Missed one!', 'bad'); game.streak = 0; }
  const mouth = wally.mouthPosition();
  let closest = Infinity;
  for (const it of [...food.items]) {
    const p = it.mesh.position;
    const d = it.landed && !wally.airborne ? Math.hypot(p.x - mouth.x, p.z - mouth.z) + (mouth.y - p.y > 3.2 ? 99 : 0) : p.distanceTo(mouth);
    if (d < 1.4 * (game.boost > 0 ? 1.4 : 1)) {
      clusters.cheer(it.cluster);
      fx.burst(p, CRUMBS[it.kind] || [0xffffff]); food.take(it, 'eaten'); wally.chomp(); sound.play.chomp(); fx.shake(0.1, 0.1);
      game.streak++; game.caught++;
      const how = it.landed ? 'ground' : (wally.airborne ? 'leap' : 'air');
      const pts = catchPoints(how, game.streak, game.boost > 0); game.foodPoints += pts; game.points += pts;
      game.energy = Math.min(ENERGY_MAX, game.energy + FOODS[it.kind].energy);
      toast_(`+${pts} ${how === 'leap' ? 'Jumping catch!' : how === 'air' ? 'In the air!' : it.name}`);
      if (chatty()) bubbles.say(wally.root, pickLine('wallyCatch'), 3.4);
    } else closest = Math.min(closest, d);
  }
  wally.jawWant = closest < 4.5 ? 0.75 : 0.12;

  // Kenny and his toast, when Wally is flagging.
  if (inRedZone(game.energy) && !toast && game.kennyCool <= 0 && !game.kennyUsed && !game.done) {
    game.kennyUsed = true;                       // Kenny can revive him once per level
    const z = wally.pos.z + 32, x = (Math.random() * 2 - 1) * (PATH.half - 1.2);
    toast = { mesh: kennysToast(), x, z }; toast.mesh.position.set(x, G + 0.6, z); scene.add(toast.mesh);
    kennyMesh.position.set(PATH.half + 1.2, G, z); kennyMesh.rotation.y = -Math.PI / 2; kennyMesh.visible = true;
    bubbles.say(kennyMesh, pickLine('kennyDropped'), 1.9);
    toast_("Kenny's put some toast on the path!", 'info'); game.kennyCool = 20;
  }
  if (toast) {
    toast.mesh.rotation.y += dt * 2;
    if (Math.abs(toast.z - wally.pos.z) < 1.3 && Math.abs(toast.x - wally.pos.x) < 1.3) {
      scene.remove(toast.mesh); toast = null;
      game.energy = ENERGY_MAX; game.boost = 8; sound.play.powerup(); toast_('Toast power!', 'good');
      bubbles.say(wally.root, pickLine('wallyToast'), 3.4);
    } else if (toast.z < wally.pos.z - 4) { scene.remove(toast.mesh); toast = null; }
  }
  if (kennyMesh.visible && kennyMesh.position.z < wally.pos.z - 15) kennyMesh.visible = false;
  if (kennyMesh.visible) {
    kennyMesh.position.y = G + Math.abs(Math.sin(t * 8)) * 0.12;
    if (kennyPoser && kennyPoser.ok) kennyPoser.pose({ time: t, cheer: 1, napping: false });
  }

  if (game.energy < 25 && game.hungry <= 0) { bubbles.say(wally.root, pickLine('wallyHungry'), 3.4); game.hungry = 10; }

  // Running out of puff costs a life, and Wally stays down until Kenny brings
  // his jar (Ken's rule), the same rescue as running out of air.
  if (game.energy <= 0 && !game.done && game.faint <= 0) {
    game.lives--; sound.play.lose();
    if (game.lives <= 0) { finish(false); return; }
    game.faint = 3.2; wally.setNapping(true);
    kennyFloat.visible = wally.mode === 'swim';
    vegemite.visible = kennyMesh.visible = true;
    toast_(`Out of puff! ${game.lives} left. Here comes Kenny`, 'bad');
    bubbles.say(kennyMesh, "Hang on, Wally! Comin'!", 2.6);
  }

  // The Lagoon: the way on, once the job is done.
  if (!game.done && game.ready && wally.pos.z >= POOL_Z + 2) {
    game.done = true; wally.cheer = 1.2; bubbles.say(wally.root, 'Last one in is a rotten egg!', 3.4);
    setTimeout(() => finish(true), 2200);
  } else if (!game.ready && wally.pos.z > POOL_Z - 1 && game.hintCool <= 0) {
    game.hintCool = 6; toast_('Not yet! Feed out every group and fill up first', 'info');
  }
  game.hintCool = (game.hintCool || 0) - dt;
  drawHud();
}

function stumble(o) {
  o.hit = true; game.stumbles++; game.streak = 0;
  game.energy -= 8; game.stun = 0.7;
  fx.shake(0.35, 0.25); sound.play.land();
  wally.vel.multiplyScalar(0.3);
  if (o.kind === 'pelican') { o.flee = true; bubbles.say(wally.root, 'Sorry, mate!', 3.4); }
  else if (o.kind === 'jogger') bubbles.say(o.mesh, 'Oi! Watch it, croc!', 2.2);
  else bubbles.say(wally.root, pickLine('wallyBump'), 3.4);
  toast_(o.kind === 'branch' ? 'Duck! (Shift / Fours)' : 'Whoops!', 'bad');
}

// ---- Camera: on a leash behind him, as in the park ----------------------------------
const camTarget = new THREE.Vector3();
function followCamera(dt) {
  camTarget.lerp(wally.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), Math.min(1, dt * 6));
  cam.manual = Math.max(0, cam.manual - dt);
  if (game.running) {
    const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.3;
    cam.still = moving ? 0 : cam.still + dt;
    if (cam.recenter) {
      const want = wally.facing + (cam.side === 'behind' ? Math.PI : 0);
      const d = Math.atan2(Math.sin(want - cam.yaw), Math.cos(want - cam.yaw));
      cam.yaw += d * Math.min(1, dt * 6); if (Math.abs(d) < 0.02) cam.recenter = false;
    } else if (cam.manual <= 0 && cam.still > 2.5 && !wally.airborne) {
      const want = wally.facing + 0.7, d = Math.atan2(Math.sin(want - cam.yaw), Math.cos(want - cam.yaw));
      cam.yaw += d * Math.min(1, dt * 0.8);
    } else if (cam.manual <= 0) {
      const dx = camera.position.x - camTarget.x, dz = camera.position.z - camTarget.z;
      if (dx * dx + dz * dz > 0.01) cam.yaw = Math.atan2(dx, dz);
    }
  }
  const cp = Math.cos(cam.pitch);
  camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
  if (seaDive.depth < -1.0) {
    // Under water: the camera stays under the surface and above the sea floor.
    camera.position.set(camTarget.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
    camera.position.y = Math.min(-0.9, Math.max(SEA_FLOOR + 0.8, camera.position.y));   // never up through the surface
  } else if (camera.position.y < 0.8) camera.position.y = 0.8;
  camera.lookAt(camTarget);
  const jolt = fx.shakeOffset(dt); if (jolt) camera.position.add(jolt);
  world.ring.position.x = camera.position.x; world.ring.position.z = camera.position.z;   // the horizon stays on the horizon
  if (world.ranges) { world.ranges.position.x = camera.position.x; world.ranges.position.z = camera.position.z; }
  world.sun.position.set(wally.pos.x - 60, 70, wally.pos.z - 40); world.sun.target.position.copy(wally.pos);
}

// ---- Screens -------------------------------------------------------------------------
function drawHud() {
  $('score').textContent = game.points.toLocaleString();
  $('mangoes').textContent = `${game.mangoes}/${mangoes.length}`;
  const diving = seaDive.depth < -1.0 || game.air < AIR.max - 0.5;
  $('pearls').textContent = game.pearls;
  $('feed').classList.toggle('air', diving);
  $('meter-label').textContent = diving ? 'Air' : 'Feed-o-meter';
  $('red-note').textContent = diving ? 'Low on air! Swim up (Ctrl+Shift) or find a bubble vent' : 'In the red! Look out for Kenny and his jar!';
  $('energy-fill').style.width = `${Math.max(0, diving ? game.air / AIR.max * 100 : game.energy)}%`;
  $('feed').classList.toggle('red', diving ? game.air < 25 : inRedZone(game.energy));
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  $('veg').hidden = game.boost <= 0;
  $('track-wally').style.left = `${Math.min(100, Math.max(0, wally.pos.z / PATH.finish * 100))}%`;
  $('job').textContent = game.ready ? 'Head for the Lagoon!' : game.groupsDone >= game.groupsTotal ? 'Now fill the feed-o-meter' : `Groups fed out ${game.groupsDone}/${game.groupsTotal}`;
}

function start() {
  sound.start(); sound.startMusic('esplanade');
  $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true;
  cam.yaw = Math.PI;                    // start behind him, looking down the boardwalk
  bubbles.say(wally.root, "G'day! Lunch on the Esplanade!", 3.4, 3);
}

function setPaused(p) { if (!game.running) return; game.paused = p; $('paused').hidden = !p; }

function finish(won, why = '') {
  game.running = false;
  $('hud').hidden = true; $('touch').hidden = true;
  const s = runScore({ food: game.foodPoints, mangoes: game.mangoes, mangoSet: game.mangoes === mangoes.length, energyLeft: game.energy, stumbles: game.stumbles, finished: won, pearls: game.pearls });
  const stars = won ? starsFor(s.total, STARS) : 0;
  if (won) sound.fanfare();                         // Wally's theme hook: well done, mate
  if (won) progress = completeArea(progress, 'esplanade', { score: s.total, stars, mangoes: game.mangoes, pearls: game.pearls });
  else progress = bankFinds(progress, { mangoes: game.mangoes, pearls: game.pearls });   // Ken: keep what was found, finished or not
  try { localStorage.setItem('chomp-progress', JSON.stringify(progress)); } catch { /* not saved */ }
  $('result-title').textContent = won ? 'Made it to the Lagoon!' : why === 'hungry' ? 'Still peckish!' : why === 'air' ? 'Out of air!' : 'Out of puff';
  $('result-why').textContent = why === 'hungry' ? `Wally made it, but his feed-o-meter isn't full. He needs a full tank (${FULL}%) to head on.` : '';
  $('result-stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Tucker caught', `${game.caught} (${s.food})`], ['Golden Mangoes', `${game.mangoes}/${mangoes.length} (${s.mangoes})`], ['All mangoes bonus', s.mangoSet], ['Pearls', `${game.pearls} (${s.pearls})`], ['Finish bonus', s.finishBonus], ['No-bump bonus', s.clean], ['Total', s.total]]) {
    const li = document.createElement('li'); li.innerHTML = `<span></span><b></b>`; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  $('postcard').hidden = !won;
  $('postcard-text').textContent = POSTCARDS.esplanade;
  $('result').hidden = false;
  window.chomp.result = { won, ...s, stars };
}

$('play').onclick = start;
$('resume').onclick = () => setPaused(false);
$('again').onclick = () => location.reload();
addEventListener('visibilitychange', () => { if (document.hidden && game.running) setPaused(true); });

// ---- Test pilot (?bot): goes for food, holds groups in the sweet spot, jumps and ducks
function makeBot() {
  return function steer() {
    const me = wally.pos;
    let goal = null, jump = false, fours = false;
    const coming = food.items.map(it => food.landing(it)).filter(Boolean).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
    if (coming && Math.hypot(coming.x - me.x, coming.z - me.z) < 14) goal = coming;
    if (!goal) {
      const live = clusters.list.filter(c => !c.counted && !c.fled && c.food > 0).sort((a, b) => Math.abs(a.root.position.z - me.z) - Math.abs(b.root.position.z - me.z))[0];
      if (live) goal = { x: -1.5, z: live.root.position.z };                   // across the boardwalk from them: the sweet spot
      else if (game.ready) goal = { x: 0, z: POOL_Z + 6 };
      else if (toast) goal = { x: toast.x, z: toast.z };
    }
    if (!goal) return { forward: 0, right: 0, jump: false, fours: false, turn: 0, turnKeys: 0, tilt: 0, zoom: 0 };
    for (const o of obstacles) {
      const d = Math.hypot(o.x - me.x, o.z - me.z);
      if (o.kind === 'branch' && Math.abs(o.z - me.z) < 3) fours = true;
      else if (d < 2 && o.kind !== 'jogger') jump = true;
    }
    const dx = goal.x - me.x, dz = goal.z - me.z, len = Math.hypot(dx, dz);
    if (len < 0.6) return { forward: 0, right: 0, jump: false, fours, turn: 0, turnKeys: 0, tilt: 0, zoom: 0 };
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const k = Math.min(1, len / 1.5) / len;
    return { forward: (dx * fx + dz * fz) * k, right: (dx * rx + dz * rz) * k, jump, fours, turn: 0, turnKeys: 0, tilt: 0, zoom: 0 };
  };
}

// ---- Loop ------------------------------------------------------------------------------
let t = 0, last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  if (game.running && !game.paused) step(dt, t);
  bubbles.update(dt); fx.update(dt, t);
  if (world.trees) world.trees.update(t);          // the breeze in the trees
  world.sea.userData.ripple(t); world.sea.userData.grass.update(t);   // waves, and the breeze in the grass
  followCamera(dt);
  fpsWatch(dt);
  post.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play') || bot) start();

