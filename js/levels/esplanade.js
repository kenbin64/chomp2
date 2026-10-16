// esplanade.js
// The Esplanade. Wally has the run of the Cairns Esplanade boardwalk: up and
// down it, and off the side into the ocean for a swim. The picnic groups along
// the city side throw lunch when he is in the sweet spot and bolt if he crowds
// them. Bins, benches, pelicans and fig branches are in the way, joggers come
// and go, and there are stingers in the water. Feed out every group, fill the
// feed-o-meter. Then the second half: a dive off the boardwalk to the reef,
// where Wally has an air meter instead of food, gathers pearls, and goes into
// the coral cave's maze for the pirate chest (reef-rules.js, reef-scene.js).

import * as THREE from 'three';
import { Wally } from '../wally.js';
import { Food, randomKind, kennysToast } from '../food.js';
import { Input } from '../input.js';
import { Bubbles, pickLine } from '../bubbles.js';
import { Effects, CRUMBS } from '../fx.js';
import { loadModels, dress } from '../models.js';
import { usePalmCrown } from '../palms.js';
import { createPost } from '../post.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, LIVES, REVIVE_ENERGY, inRedZone } from '../rules.js';
import { FULL } from '../quests.js';
import { HumanoidPoser } from '../rig.js';
import { jellyModel } from '../hazards.js';
import { completeArea, readProgress, starsFor, POSTCARDS } from '../progress.js';
import { PATH, generateCourse, hits, runScore, STARS } from './esplanade-rules.js';
import { buildEsplanade, obstacleModel, mangoModel } from './esplanade-scene.js';
import { Clusters } from '../clusters.js';
import { makeMaze, collide, inMaze, airStep, AIR, SWIM_Y, SURFACE_Y, SEABED_Y } from './reef-rules.js';
import { buildReef, clamWithPearl, MAZE, DIVE, BOUNDS } from './reef-scene.js';
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
let poolOpen = () => false;              // set below, once the game state exists
const landGround = {
  stand(x, z, feetY) {
    if (inPool(x, z)) return { y: POOL_WATER - 0.45, surface: 'water' };
    if (inSea(x, z)) return { y: -0.45, surface: 'water' };
    if (feetY < G - 0.35) return { y: -0.45, surface: 'water' };     // in the water right against the boardwalk
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
usePalmCrown(models.get('palm-crown'));                // Ken's palm crown on the built trunks
const world = buildEsplanade(scene, quality);
const maze = makeMaze(MAZE.cols, MAZE.rows, Number(params.get('seed')) || 7);
const reef = buildReef(scene, quality, { maze, jellyGltf: models.get('jellyfish') });
const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));
{
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
const course = generateCourse(Number(params.get('seed')) || 7);
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
for (let z = 60; z < PATH.finish - 20; z += 28 + (z % 17)) {
  const m = jellyModel(); const x = -PATH.half - 2 - (z % 9);
  m.position.set(x, -0.15, z); scene.add(m); jellies.push({ m, x, z, phase: z, cool: 0 });
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
input.onMute = () => toast_('Sound ' + (sound.toggleMute() ? 'off' : 'on'), 'info');

let progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
const game = {
  running: false, paused: false, done: false, countdown: 0, time: 0,
  energy: ENERGY_MAX, lives: LIVES, nap: 0, stun: 0, boost: 0, kennyCool: 8, kennyUsed: false,
  points: 0, foodPoints: 0, mangoes: 0, caught: 0, stumbles: 0, streak: 0, hungry: 0, scared: 0,
  groupsDone: 0, groupsTotal: 0, ready: false,
  // The dive: where he is ('land', then 'reef'), how deep, air, pearls, the chest and the clam.
  phase: 'land', depth: SURFACE_Y, wantDepth: SURFACE_Y, air: AIR.max, pearls: 0,
  chest: false, doorShut: false, inCave: false, faint: 0, hint: 0, foursWas: false,
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

// ---- The dive ---------------------------------------------------------------------
// Where to go down: a glowing ring and a buoy on the sea, shown once he is ready.
const diveMarker = new THREE.Group();
{
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.6, 2.4, 2.6) }));
  ring.rotation.x = Math.PI / 2; diveMarker.add(ring);
  const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff6b35, roughness: 0.4 }));
  buoy.position.set(2.4, 0.15, 0); diveMarker.add(buoy);
  diveMarker.position.set(DIVE.x, 0.05, DIVE.z); diveMarker.visible = false; scene.add(diveMarker);
}
// Under water he swims at the depth the level sets (game.depth), along the
// reef, stopped by the cave's walls and by the giant clam while it is shut.
const doorBox = () => ({ x0: reef.mouth.x - 0.8, x1: reef.mouth.x + 0.8, z0: reef.mouth.z - 2.7, z1: reef.mouth.z + 2.7 });
const reefGround = {
  stand: () => ({ y: game.depth, surface: 'water' }),
  move(x, z, nx, nz) {
    nx = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, nx)); nz = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, nz));
    if (game.depth > -2.5) return { x: nx, z: nz };                         // floating at the top: over the cave roof is fine
    return collide(x, z, nx, nz, game.doorShut ? [...reef.boxes, doorBox()] : reef.boxes, 0.7);
  },
  foodAt: () => SEABED_Y,
  isWater: () => true,
  start: () => ({ x: DIVE.x, y: SWIM_Y, z: DIVE.z }),
};
// Kenny paddles out on a float with his jar of Vegemite when Wally runs out of air.
const kennyFloat = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.22, 10, 28), new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.5 }));
kennyFloat.rotation.x = Math.PI / 2; kennyFloat.visible = false; scene.add(kennyFloat);
const vegemite = kennysJar(jarLabelTexture()); vegemite.visible = false; scene.add(vegemite);
const caveLight = new THREE.PointLight(0x9feeff, 0, 16, 1.6); scene.add(caveLight);

// What the scene looks like above the water, under it, and in the cave.
const aboveFog = scene.fog, aboveBackground = scene.background;
const skyMesh = scene.children.find(o => o.isMesh && o.geometry.type === 'SphereGeometry');
const underFog = new THREE.FogExp2(0x0d5d78, 0.034), caveFog = new THREE.FogExp2(0x0a3140, 0.05);
const underColour = new THREE.Color(0x0b5470), caveColour = new THREE.Color(0x061f26);
let underNow = null;
function looksUnder(under, inCave) {
  const key = under ? (inCave ? 'cave' : 'reef') : 'above';
  if (key === underNow) return;
  underNow = key;
  scene.fog = under ? (inCave ? caveFog : underFog) : aboveFog;
  scene.background = under ? (inCave ? caveColour : underColour) : aboveBackground;
  if (skyMesh) skyMesh.visible = !under;
  world.ring.visible = !under;
  reef.roof.visible = !inCave;                       // from inside, look down into the maze
}

function startDive() {
  game.phase = 'reef'; game.depth = SURFACE_Y; game.wantDepth = SWIM_Y;
  setGround(reefGround);
  reef.root.visible = true; diveMarker.visible = false;
  wally.pos.set(DIVE.x, SURFACE_Y, DIVE.z); wally.vel.set(0, 0, 0);
  sound.play.splash(); fx.splash(wally.pos, 30);
  bubbles.say(wally.root, 'Deep breath... down we go!', 3.4);
  toast_('Find the coral cave! Space: swim up for air. F: dive', 'info');
  $('track').hidden = true;
}

// One frame under (or floating on) the water over the reef.
function reefStep(dt, t, k) {
  const atTop = game.depth > -1.2;
  game.inCave = inMaze(maze, wally.pos.x, wally.pos.z, MAZE.ox, MAZE.oz, MAZE.size) && !atTop;
  game.hint -= dt;

  // Space: up for air (not from inside the cave: there is rock overhead). F: back down.
  const foursPressed = k.fours && !game.foursWas; game.foursWas = k.fours;
  if (game.faint <= 0) {
    if (k.jump && !atTop) {
      if (game.inCave) { if (game.hint <= 0) { toast_('Rock overhead! Find a bubble vent or swim out', 'bad'); game.hint = 3; } }
      else game.wantDepth = SURFACE_Y;
    }
    if (foursPressed && atTop) game.wantDepth = SWIM_Y;
  }
  game.depth += Math.sign(game.wantDepth - game.depth) * Math.min(Math.abs(game.wantDepth - game.depth), 5 * dt);

  const control = game.faint > 0 || game.done ? { forward: 0, right: 0, jump: false, fours: false } : { ...k, jump: false, fours: false };
  wally.update(dt, control, cam.yaw, game.stun > 0 ? 0.4 : 1);
  reef.update(t, dt);

  // Air: up top it fills, in a vent it fills, anywhere else it runs down.
  const inVent = !atTop && reef.vents.some(v => Math.hypot(wally.pos.x - v.x, wally.pos.z - v.z) < v.r);
  if (!game.done && game.faint <= 0) game.air = airStep(game.air, game.depth > -1.0 ? 'surface' : inVent ? 'vent' : 'under', dt);
  if (inVent && game.air < AIR.max - 1 && game.hint <= 0) { toast_('Bubbles! Air filling up', 'good'); game.hint = 4; }

  // Pearls.
  for (const p of reef.pearls) {
    if (p.taken || atTop) continue;
    if (Math.hypot(wally.pos.x - p.x, wally.pos.z - p.z) < 1.6) {
      p.taken = true; p.mesh.userData.pearl.visible = false; game.pearls++; game.points += 5;
      sound.play.goal(); fx.burst(p.mesh.position.clone().setY(SWIM_Y), [0xffffff, 0xffd6f0], 10);
      toast_(`A pearl! ${game.pearls} now`, 'good');
    }
  }

  // Box jellyfish: a sting knocks the air out of him.
  for (const j of reef.jellies) {
    j.cool = Math.max(0, j.cool - dt);
    if (j.cool > 0 || atTop) continue;
    if (Math.hypot(wally.pos.x - j.m.position.x, wally.pos.z - j.m.position.z) < 1.5 && Math.abs(game.depth - j.m.position.y) < 2.5) {
      j.cool = 2; game.air = Math.max(0, game.air - AIR.sting); game.stun = 0.6;
      wally.knock(j.m.position.x, j.m.position.z); fx.shake(0.4, 0.3); sound.play.sting();
      toast_('Box jelly! Lost some air', 'bad');
    }
  }

  // The chest: open it, take the Golden Mango, and the clam behind him shuts.
  const ch = reef.chest;
  if (!game.chest && game.inCave && Math.hypot(wally.pos.x - ch.x, wally.pos.z - ch.z) < 2.2) {
    game.chest = true; ch.opened = true; ch.mango.visible = true;
    game.mangoes++; game.points += 30; wally.cheer = 1.2;
    sound.play.powerup(); fx.burst(new THREE.Vector3(ch.x, SEABED_Y + 1.5, ch.z), [0xffd700, 0xffb51f, 0xffffff], 24);
    bubbles.say(wally.root, 'Pirate treasure! Crikey!', 3.4);
    setTimeout(() => { game.doorShut = true; sound.play.land(); fx.shake(0.5, 0.4); toast_('The giant clam snapped shut! Only a pearl will open it', 'bad'); }, 1400);
  }
  // The giant clam: a pearl in it opens the way out.
  const toClam = Math.hypot(wally.pos.x - reef.mouth.x, wally.pos.z - reef.mouth.z);
  if (game.doorShut && toClam < 3.2) {
    if (game.pearls > 0) {
      game.pearls--; game.doorShut = false; sound.play.goal();
      toast_('In goes a pearl... the clam opens!', 'good'); bubbles.say(wally.root, 'Worth every pearl!', 3.2);
    } else if (game.hint <= 0) { toast_('No pearls left! Search the cave for one', 'bad'); game.hint = 4; }
  }
  const want = game.doorShut ? 0 : 1;
  reef.clam.set(reef.clam.openness + (want - reef.clam.openness) * Math.min(1, dt * 3));

  // Out with the treasure and up for air: that is the level.
  if (game.chest && !game.done && game.depth > -1.0 && !inMaze(maze, wally.pos.x, wally.pos.z, MAZE.ox, MAZE.oz, MAZE.size, 1)) {
    game.done = true; wally.cheer = 1.5; bubbles.say(wally.root, 'Treasure and pearls! What a day!', 3.4);
    setTimeout(() => finish(true), 2400);
  }

  // Out of air: a life gone, and Kenny paddles out with the Vegemite.
  if (game.faint > 0) {
    game.faint -= dt;
    kennyFloat.position.set(wally.pos.x + 1.6, 0.05, wally.pos.z + 0.6);
    kennyMesh.position.set(kennyFloat.position.x, -0.25, kennyFloat.position.z); kennyMesh.rotation.y = -Math.PI / 2;
    vegemite.position.set(wally.pos.x + 0.6, 0.6 + Math.sin(t * 4) * 0.1, wally.pos.z + 0.3); vegemite.rotation.y += dt * 3;
    if (kennyPoser && kennyPoser.ok) kennyPoser.pose({ time: t, cheer: 1, napping: false });
    if (game.faint <= 0) {
      game.air = AIR.max; kennyFloat.visible = vegemite.visible = kennyMesh.visible = false;
      wally.setNapping(false); sound.play.powerup();
      toast_("Kenny's Vegemite! Full of beans. F to dive", 'good'); bubbles.say(wally.root, 'Thanks, Kenny! Back down I go!', 3.4);
    }
  } else if (game.air <= 0 && !game.done) {
    game.lives--; sound.play.lose();
    if (game.lives <= 0) { finish(false, 'air'); return; }
    // Out of the cave if he was in it, then up to the top where Kenny can reach him.
    if (game.inCave) wally.pos.set(reef.mouth.x + 4, game.depth, reef.mouth.z);
    game.wantDepth = SURFACE_Y; game.faint = 3.2; wally.setNapping(true);
    kennyFloat.visible = vegemite.visible = kennyMesh.visible = true;
    toast_(`Out of air! ${game.lives} left. Here comes Kenny`, 'bad');
    bubbles.say(kennyMesh, 'Hang on, Wally! Vegemite!', 2.6);
  }

  // How it looks: under water or above, in the cave or out, and a lamp in the dark.
  looksUnder(camera.position.y < -0.2, game.inCave);
  caveLight.intensity = game.inCave ? 14 : 0;
  caveLight.position.set(wally.pos.x, game.depth + 2.5, wally.pos.z);
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
window.chomp.reef = reef; window.chomp.maze = maze; window.chomp.camera = camera; window.chomp.scene = scene;

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
  if (game.phase === 'reef') { reefStep(dt, t, k); drawHud(); return; }
  game.kennyCool -= dt; game.hungry -= dt;
  const napping = game.nap > 0;
  let pace = speedFactor(game.energy) * (game.stun > 0 ? 0.4 : 1) * (game.boost > 0 ? 1.3 : 1);
  const control = napping || game.done ? { forward: 0, right: 0, jump: false, fours: false } : k;
  for (const e of wally.update(dt, control, cam.yaw, pace)) {
    if (e === 'jump') sound.play.jump(); else if (e === 'land') sound.play.land();
    else if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 30); }
  }
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (!game.done && game.boost <= 0 && !napping) game.energy -= energyDrain(wally.mode, moving) * dt;

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
    j.m.position.set(j.x + Math.sin(j.phase * 0.4) * 1.5, -0.15 + Math.sin(j.phase * 1.6) * 0.1, j.z);
    if (wally.surface === 'water' && j.cool <= 0 && Math.hypot(wally.pos.x - j.m.position.x, wally.pos.z - j.z) < 1.3) {
      j.cool = 2; game.energy -= 12; game.streak = 0; wally.knock(j.m.position.x, j.z); fx.shake(0.4, 0.3);
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
      game.ready = true; diveMarker.visible = true; sound.play.powerup();
      toast_('Every group fed and a full tank! Dive at the bubbles to find the coral cave', 'info');
      bubbles.say(wally.root, "There's treasure out there. I can feel it!", 3.4);
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
      if (Math.random() < 0.3) bubbles.say(wally.root, pickLine('wallyCatch'), 3.4);
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

  // Running out: a nap costs a life.
  if (game.nap > 0) {
    game.nap -= dt;
    if (game.nap <= 0) { wally.setNapping(false); game.energy = REVIVE_ENERGY; bubbles.say(wally.root, 'Right, back into it!', 3.4); }
  } else if (game.energy <= 0 && !game.done) {
    game.lives--; sound.play.lose();
    if (game.lives <= 0) { finish(false); return; }
    game.nap = 2.5; wally.setNapping(true); toast_(`Out of puff! ${game.lives} left`, 'bad');
  }

  // The dive: the way on, once the job is done.
  if (game.ready && wally.surface === 'water' && Math.hypot(wally.pos.x - DIVE.x, wally.pos.z - DIVE.z) < 3) startDive();
  else if (game.ready && wally.pos.z > POOL_Z - 1 && game.hintCool <= 0) {
    game.hintCool = 6; toast_('The treasure is under the sea! Dive at the bubbles', 'info');
  } else if (!game.ready && wally.pos.z > POOL_Z - 1 && game.hintCool <= 0) {
    game.hintCool = 6; toast_('Not yet! Feed out every group and fill up first', 'info');
  }
  diveMarker.rotation.y += dt * 0.6;
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
  if (game.phase === 'reef' && game.depth < -1.2) {
    // Under water: the camera stays under the surface and above the seabed,
    // and in the cave it looks down into the maze (the roof is hidden there).
    // Steep and close, so it looks down into the maze yet stays under the surface.
    if (game.inCave) { cam.pitch += (1.1 - cam.pitch) * Math.min(1, dt * 3); cam.dist += (6.5 - cam.dist) * Math.min(1, dt * 3); }
    camera.position.set(camTarget.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
    camera.position.y = Math.min(-0.9, Math.max(SEABED_Y + 1, camera.position.y));      // never up through the surface
  } else if (camera.position.y < 0.8) camera.position.y = 0.8;
  camera.lookAt(camTarget);
  const jolt = fx.shakeOffset(dt); if (jolt) camera.position.add(jolt);
  world.ring.position.x = camera.position.x; world.ring.position.z = camera.position.z;   // the horizon stays on the horizon
  world.sun.position.set(wally.pos.x - 60, 70, wally.pos.z - 40); world.sun.target.position.copy(wally.pos);
}

// ---- Screens -------------------------------------------------------------------------
function drawHud() {
  $('score').textContent = game.points.toLocaleString();
  $('mangoes').textContent = game.mangoes;
  const diving = game.phase === 'reef';
  $('pearls').textContent = game.pearls;
  $('feed').classList.toggle('air', diving);
  $('meter-label').textContent = diving ? 'Air' : 'Feed-o-meter';
  $('red-note').textContent = diving ? 'Low on air! Swim up (Space) or find a bubble vent' : 'In the red! Look out for Kenny and his jar!';
  $('energy-fill').style.width = `${Math.max(0, diving ? game.air / AIR.max * 100 : game.energy)}%`;
  $('feed').classList.toggle('red', diving ? game.air < 25 : inRedZone(game.energy));
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  $('veg').hidden = game.boost <= 0;
  $('track-wally').style.left = `${Math.min(100, Math.max(0, wally.pos.z / PATH.finish * 100))}%`;
  $('job').textContent = diving
    ? (game.chest ? (game.doorShut ? 'Put a pearl in the giant clam to get out!' : 'Out of the cave and up for air!') : 'Find the pirate chest in the coral cave')
    : game.ready ? 'Dive at the bubbles out to sea!' : game.groupsDone >= game.groupsTotal ? 'Now fill the feed-o-meter' : `Groups fed out ${game.groupsDone}/${game.groupsTotal}`;
}

function start() {
  sound.start();
  $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true;
  cam.yaw = Math.PI;                    // start behind him, looking down the boardwalk
  bubbles.say(wally.root, "G'day! Lunch on the Esplanade!", 3.4, 3);
}

function setPaused(p) { if (!game.running) return; game.paused = p; $('paused').hidden = !p; }

function finish(won, why = '') {
  game.running = false;
  $('hud').hidden = true; $('touch').hidden = true;
  const s = runScore({ food: game.foodPoints, mangoes: game.mangoes, energyLeft: game.energy, stumbles: game.stumbles, finished: won, pearls: game.pearls, chest: game.chest });
  const stars = won ? starsFor(s.total, STARS) : 0;
  if (won) {
    progress = completeArea(progress, 'esplanade', { score: s.total, stars, mangoes: game.mangoes, pearls: game.pearls });
    try { localStorage.setItem('chomp-progress', JSON.stringify(progress)); } catch { /* not saved */ }
  }
  $('result-title').textContent = won ? 'Found the pirate treasure!' : why === 'hungry' ? 'Still peckish!' : why === 'air' ? 'Out of air!' : 'Out of puff';
  $('result-why').textContent = why === 'hungry' ? `Wally made it, but his feed-o-meter isn't full. He needs a full tank (${FULL}%) to head on.` : '';
  $('result-stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Tucker caught', `${game.caught} (${s.food})`], ['Golden Mangoes', `${game.mangoes} (${s.mangoes})`], ['Pearls', `${game.pearls} (${s.pearls})`], ['Pirate chest', s.chest], ['Finish bonus', s.finishBonus], ['No-bump bonus', s.clean], ['Total', s.total]]) {
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
  followCamera(dt);
  fpsWatch(dt);
  post.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play') || bot) start();
// ?dive: straight to the reef, for trying the cave without replaying the boardwalk.
if (params.has('dive')) { if (!game.running) start(); game.ready = true; game.pearls = Number(params.get('pearls') || 3); startDive(); }
