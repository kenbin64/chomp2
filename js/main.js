// main.js
// Croc Park: sets up the scene and runs the game loop. Each frame it reads the
// controls, moves Wally, has the tourists throw, flies the food, checks what
// was caught, missed or stolen, and keeps the quest and the screen up to date.

import * as THREE from 'three';
import { buildWorld, GATE } from './world.js';
import { Wally } from './wally.js';
import { Food, randomKind, useJarModel } from './food.js';
import { Tourists } from './tourists.js';
import { Kenny } from './kenny.js';
import { Crocs } from './crocs.js';
import { Jellies, FlyingFoxes, Pelicans, CaneToads } from './hazards.js';
import { Clusters } from './clusters.js';
import { Input } from './input.js';
import { Bubbles, pickLine, chatty } from './bubbles.js';
import { Effects, CRUMBS } from './fx.js';
import { loadModels } from './models.js';
import { createPost } from './post.js';
import { loadRealism } from './realism.js';
import { usePalmCrown } from './palms.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from './quality.js';
import { createQuest, nextArea, markVisited, AREAS, PARK_GROUPS, FULL } from './quests.js';
import { readProgress, completeArea, isOpen, starsFor, POSTCARDS, OPEN_ALL, ACTIVITIES, totalStars, activityOpen } from './progress.js';
import * as sound from './sound.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, difficulty,
         clampToPark, terrainHeight, onDeck, LIVES, REVIVE_ENERGY, inRedZone,
         positionAt, foodSurface, lagoonDistance, PARK_EDGE, deckHeight, isWater, LAGOON, CLUSTER } from './rules.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');

// ---- Renderer, scene, camera ----------------------------------------------

let quality = pickQuality();
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality));
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;    // the soft, filmic look
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 68 : 55;          // phones held upright see more
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// Ken's models and backdrop pictures, where they exist; stand-ins otherwise.
const models = await loadModels(undefined, { light: touch || quality.name === 'low' });
useJarModel(models.get('jar'));                    // Ken's jar for Kenny's rescue, when present
const backdrops = await loadBackdrops();
async function loadBackdrops() {
  const out = {};
  const tex = new THREE.TextureLoader();
  let present = null;
  try { present = await (await fetch('backdrops/index.json')).json(); } catch { /* no index: ask for each */ }
  for (const [key, file] of [['ring', 'park-ring.png'], ['sky', 'park-sky.jpg']]) {
    if (Array.isArray(present) && !present.includes(file)) continue;
    try { if ((await fetch(`backdrops/${file}`, { method: 'HEAD' })).ok) out[key] = await tex.loadAsync(`backdrops/${file}`); } catch { /* use the painted one */ }
  }
  return out;
}

// The photographic sky and scanned surfaces, where present (assets/, see realism.js).
// ?real=0 turns it off, to compare with the painted look.
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light: touch || quality.name === 'low' });
usePalmCrown(models.get('palm-crown'));                // Ken's palm crown on the built trunks
const world = buildWorld(scene, quality, models, backdrops, realism);
const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));

// Light from the sky itself: soft fill and gentle reflections on every surface,
// the way the gallery is lit, instead of flat colour from a single lamp.
// The photographed sky already did this from the real HDR (world.photo).
if (!world.photo) {
  const env = new THREE.Scene();
  env.add(world.sky.clone());
  const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
  sunGlow.position.copy(world.sun.position).normalize().multiplyScalar(300);
  env.add(sunGlow);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.04).texture;
  scene.environmentIntensity = 0.8;
  pmrem.dispose();
}
const wally = new Wally(scene);
const food = new Food(scene);
const tourists = new Tourists(scene, quality.tourists);
const kenny = new Kenny(scene);
const crocs = new Crocs(scene, 3);
const jellies = new Jellies(scene, quality.jellies);
const bats = new FlyingFoxes(scene, quality.bats);
const pelicans = new Pelicans(scene, quality.name === 'low' ? 1 : 2);
const bubbles = new Bubbles(scene, touch ? 3 : 5);
const fx = new Effects(scene, food);

// Groups of people around the park, each with a limited supply of food: the
// only source of tucker. Wally has to get close enough for them to throw, but
// not so close they run off.
const standHeight = (x, z) => onDeck(x, z) ? deckHeight(x) : Math.max(0, terrainHeight(x, z));
const clusters = new Clusters(scene, standHeight, bubbles);
pelicans.hotspots = () => clusters.active.map(c => c.root.position);   // pelicans loiter near people eating
const CLUSTER_SPOTS = [120, 60, 200, 330, 250, 160, 290].map(deg => {
  const a = deg * Math.PI / 180;
  return { x: Math.cos(a) * LAGOON.rx * 1.22, z: Math.sin(a) * LAGOON.rz * 1.22 };
}).concat([{ x: -14, z: 2 }, { x: 16, z: 2 }]);             // and two on the boardwalk
function spawnCluster(opts = {}) {
  const taken = clusters.active.map(c => c.root.position);
  const free = CLUSTER_SPOTS.filter(s => taken.every(p => Math.hypot(p.x - s.x, p.z - s.z) > 8)
                                     && Math.hypot(s.x - wally.pos.x, s.z - wally.pos.z) > CLUSTER.near + 6);
  if (!free.length) return null;
  const s = opts.spot || free[Math.floor(Math.random() * free.length)];
  return clusters.add({ x: s.x, z: s.z, size: 2 + Math.floor(Math.random() * 3), food: 6 + Math.floor(Math.random() * 4), ...opts });
}
clusters.add({ x: CLUSTER_SPOTS[0].x, z: CLUSTER_SPOTS[0].z, size: 3, food: 7 });   // a family near the start, to learn on
for (let i = 0; i < 3; i++) spawnCluster();

const toads = new CaneToads(scene, quality.name === 'low' ? 3 : 5, {
  heightAt: (x, z) => Math.max(0, terrainHeight(x, z)),
  isWater: (x, z) => isWater(x, z),
  home: () => { const a = Math.random() * Math.PI * 2, d = 1.12 + Math.random() * 0.2; return { x: Math.cos(a) * LAGOON.rx * d, z: Math.sin(a) * LAGOON.rz * d }; },
});

// Dress everyone in Ken's models where a file exists.
wally.useModel(models.get('wally'));
kenny.useModel(models.get('kenny'));
crocs.useModel(models.get('croc'));
pelicans.useModel(models.get('pelican'));
toads.useModel(models.get('toad'));
bats.useModel(models.get('flyingfox'));
jellies.useModel(models.get('jellyfish'));
tourists.useModels(Array.from({ length: 10 }, (_, i) => models.get(`tourist-${i + 1}`)).filter(Boolean));
food.useModels(models);

// Drop graphics a level if the frame rate stays low.
const fpsWatch = watchFrameRate(quality, (lower, fps) => {
  quality = lower;
  renderer.setPixelRatio(pixelRatioFor(lower));
  if (renderer.shadowMap.enabled !== lower.shadows) {
    renderer.shadowMap.enabled = lower.shadows; world.sun.castShadow = lower.shadows;
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }
  resize();
  console.info(`Graphics lowered to ${lower.name} (${fps.toFixed(0)} fps)`);
});

// ---- Controls ---------------------------------------------------------------

const input = new Input(canvas, touch ? { stick: $('stick'), knob: $('knob'), jump: $('t-jump'), fours: $('t-fours'), pause: $('t-pause'), cam: $('t-cam') } : null);
input.onPause = () => setPaused(!game.paused);
input.onMute = () => toast(sound.toggleMute() ? 'Sound off' : 'Sound on', 'info');

// ---- Game state ---------------------------------------------------------------

let best = 0, visited = [];
try {
  best = Number(localStorage.getItem('chomp-best')) || 0;
  visited = JSON.parse(localStorage.getItem('chomp-visited') || '[]');
} catch { /* private mode: nothing saved, every visit counts as the first */ }

const game = {
  running: false, paused: false, time: 0, score: 0, energy: ENERGY_MAX, streak: 0,
  boost: 0, throwIn: 2, stingCool: 0, frenzyIn: -1, quest: createQuest(),
  catches: 0, misses: 0, stolen: 0, hungryCool: 0, lives: LIVES, nap: 0, intro: 0, newGroupIn: 25, groupsArrived: 4, tourGroup: false, scared: 0, warnedOnce: false,
  by: { bat: 0, pelican: 0, toad: 0, jelly: 0, croc: 0 },      // who took the food, for balancing
};
window.chomp = { game, wally, food, quality: () => quality };   // for testing in the browser console
addEventListener('load', () => { window.chomp.cam = cam; window.chomp.clusters = clusters; window.chomp.kenny = kenny; window.chomp.pelicans = pelicans; window.chomp.jellies = jellies; window.chomp.toads = toads; });

// The camera follows Wally on a leash, the way Ocarina of Time follows Link:
// run sideways and it swings round behind him, run toward it and it backs off.
// Dragging (or Q / E) takes over for a moment. C swings it round to his front,
// to see his face as he runs toward the player, and again to behind him.
// Standing still, it drifts to a three-quarter view of his face.
const cam = { yaw: 0, pitch: 0.36, dist: 11, target: new THREE.Vector3(), manual: 0, recenter: false, side: 'behind', still: 0 };

// ---- Messages ---------------------------------------------------------------

function toast(text, kind = 'good') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 1800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

function drawQuest() {
  const q = game.quest;
  $('quest-title').textContent = q.title;
  $('goals').innerHTML = '';
  for (const g of q.goals) {
    const li = document.createElement('li');
    li.className = g.have >= g.need ? 'done' : '';
    li.innerHTML = `<span></span><span>${Math.min(g.have, g.need)}/${g.need}</span>`;
    li.firstChild.textContent = g.text;
    $('goals').appendChild(li);
  }
  if (q.goalsDone() && q.stage === 'goals') {
    const li = document.createElement('li');
    li.innerHTML = '<span>Now fill the feed-o-meter</span><span></span>';
    $('goals').appendChild(li);
  }
  $('frenzy').hidden = true;
  if (q.stage === 'gate') $('quest-title').textContent = 'Gate open: run the boardwalk to it';
}

let lastHud = '';
function drawHud() {
  $('score').textContent = game.score.toLocaleString();
  $('streak').textContent = game.streak >= 2 ? `${game.streak} in a row` : '';
  $('energy-fill').style.width = `${Math.max(0, game.energy)}%`;
  $('feed').classList.toggle('red', inRedZone(game.energy));
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  $('veg').hidden = game.boost <= 0;
  const q = game.quest;
  if (q.stage === 'challenge') {
    $('frenzy-count').textContent = `${q.challenge.have}/${q.challenge.need}`;
    $('frenzy-time').textContent = `${Math.ceil(q.challenge.left)}s`;
  }
  const sig = q.stage + q.goals.map(g => g.have).join() + (q.goalsDone() ? 'd' : '');
  if (sig !== lastHud) { lastHud = sig; drawQuest(); }
}

// ---- Throwing -----------------------------------------------------------------

// Where to aim: near Wally, a little ahead of him, sometimes high so he has to
// jump or leap for it. Startled tourists throw straight at him.
function throwFood(hand, aimed) {
  const d = difficulty(game.time);
  const frenzy = game.quest.stage === 'challenge';
  const flight = d.flight * (aimed ? 0.85 : 1);
  const mouth = wally.mouthPosition();
  const spread = aimed ? 1.2 : d.spread;            // people aim at him: their food is limited
  const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
  let x = mouth.x + wally.vel.x * flight * 0.5 + Math.cos(a) * r;
  let z = mouth.z + wally.vel.z * flight * 0.5 + Math.sin(a) * r;
  ({ x, z } = clampToPark(x, z));
  let y = mouth.y + (Math.random() < 0.2 ? 1.2 + Math.random() * 1.6 : Math.random() * 0.6 - 0.2);
  if (wally.surface === 'water' && Math.random() < 0.25) y = 2.5 + Math.random() * 1.5;   // one for a croc leap
  // Food keeps going past the aim point as it falls, so check where it will
  // really land and pull the aim in until that is inside the park.
  const time = frenzy ? flight * 0.85 : flight;
  let v, target;
  for (let pull = 1; pull > 0.3; pull -= 0.1) {
    target = new THREE.Vector3(x * pull, Math.max(y, terrainHeight(x * pull, z * pull) + 0.6), z * pull);
    v = launchVelocity(hand, target, time);
    const land = landingOf(hand, v);
    if (!land || lagoonDistance(land.x, land.z) <= PARK_EDGE - 0.05) break;
  }
  return food.throw(randomKind(), hand, v);
}

function landingOf(from, v) {
  for (let t = 0.05; t < 6; t += 0.05) {
    const p = positionAt(from, v, t);
    if (p.y <= foodSurface(p.x, p.z, p.y + 0.5)) return p;
  }
  return null;
}

function updateClusters(dt, t) {
  for (const e of clusters.update(dt, t, wally.pos, (hand) => throwFood(hand, true))) {
    if (e.type === 'throw' && Math.random() < 0.25) bubbles.say(e.thrower.g, pickLine('touristThrow'), 2.3);
    if (e.type === 'nervous' && !game.warnedOnce) { game.warnedOnce = true; toast('Too close! Back off a bit or they will run', 'bad'); }
    if (e.type === 'flee') { game.scared++; toast(e.cluster.food > 0 ? `They ran off with ${e.cluster.food} bits of tucker!` : 'They ran off!', 'bad'); }
    if (e.type === 'empty') toast('That lot are all out of food', 'info');
    if ((e.type === 'flee' || e.type === 'empty') && !e.cluster.counted) {
      e.cluster.counted = true;                                    // fed out or run off: either way, that group is done
      for (const g of game.quest.record('groupDone')) { toast(`Done: ${g.text}`, 'info'); sound.play.goal(); }
    }
  }
  // The park's visitors for the day: four to start, three more turn up, and
  // when all seven are done a tour group arrives on the boardwalk.
  game.newGroupIn -= dt;
  const live = clusters.active.filter(c => !c.counted).length;
  if (game.groupsArrived < PARK_GROUPS - 1 && (game.newGroupIn <= 0 || live === 0)) {
    if (spawnCluster()) { game.groupsArrived++; toast('More visitors have arrived!', 'info'); }
    game.newGroupIn = 25;
  } else if (!game.tourGroup && game.groupsArrived >= PARK_GROUPS - 1 && live === 0) {
    game.tourGroup = true;
    clusters.add({ x: 0, z: 2, size: 6, food: 16, rate: 0.5 });
    toast("A tour group's here! The last lot for today", 'info'); sound.play.goal();
  }
}

// Anything left to eat: food in the air or on the ground, groups with food, or groups still to come.
function foodLeft() {
  return food.items.length > 0 || clusters.active.some(c => !c.fled && c.food > 0) || game.groupsArrived < PARK_GROUPS - 1 || !game.tourGroup;
}

// ---- Catching and losing food ---------------------------------------------------

function caught(item) {
  clusters.cheer(item.cluster);                    // the group that threw it cheers
  fx.burst(item.mesh.position, CRUMBS[item.kind] || [0xffffff]);
  fx.shake(0.12, 0.12);
  food.take(item, 'eaten');
  const how = item.landed ? 'ground' : (wally.airborne ? 'leap' : 'air');
  wally.chomp(how);
  sound.play.chomp();
  game.streak++; game.catches++;
  const pts = catchPoints(how, game.streak, game.boost > 0);
  game.score += pts;
  game.energy = Math.min(ENERGY_MAX, game.energy + FOODS[item.kind].energy);
  toast(`+${pts} ${how === 'leap' ? 'Jumping catch!' : how === 'air' ? 'In the air!' : item.name}`);
  const leapt = wally.airborne && wally.fromWater;
  if (chatty(leapt ? 0.9 : 0.6)) bubbles.say(wally.root, pickLine(leapt || how === 'leap' ? 'wallyLeap' : 'wallyCatch'), 3.6);
  const q = game.quest;
  const done = [...q.record('catch')];
  if (leapt) done.push(...q.record('leapCatch'));
  if (game.streak === 8) done.push(...q.record('streak8'));
  for (const g of done) { toast(`Done: ${g.text}`, 'info'); sound.play.goal(); }
}

function lost(item, text) {
  if (game.streak >= 3) toast(text, 'bad');
  game.streak = 0;
}

function checkCatches() {
  const mouth = wally.mouthPosition();
  const reach = 1.25 * (game.boost > 0 ? 1.5 : 1);
  let closest = Infinity;
  for (const it of [...food.items]) {
    const p = it.mesh.position;
    // In the air: the mouth has to meet it. On the ground or floating: he
    // scoops it up when his mouth passes over it and he is not in mid-jump.
    const d = it.landed && !wally.airborne
      ? Math.hypot(p.x - mouth.x, p.z - mouth.z) + (mouth.y - p.y > 3.2 ? 99 : 0)
      : p.distanceTo(mouth);
    if (d < reach) caught(it);
    else closest = Math.min(closest, d);
  }
  wally.jawWant = closest < 4.5 ? 0.75 : 0.12;     // open wide when food is coming
}

// ---- Quest flow -----------------------------------------------------------------

// Ken's rule for every scene: feed out every group, then have the meter full.
function updateQuest(dt) {
  const q = game.quest;
  const r = q.checkFull(game.energy, foodLeft());
  if (r === 'gate') { toast('Every group fed and a full tank! The gate is open', 'info'); sound.play.powerup(); }
  if (r === 'hungry') { finish(false, 'hungry'); return; }

  const atGate = Math.abs(wally.pos.x - GATE.x) < 1.2 && Math.abs(wally.pos.z - GATE.z) < 2 && onDeck(wally.pos.x, wally.pos.z);
  if (q.gateOpen() && atGate && q.leave()) finish(true);
}

// ---- One frame ------------------------------------------------------------------

const bot = params.has('bot') ? makeBot() : null;

function step(dt, t) {
  if (game.intro > 0) { introStep(dt); return; }
  const k = input.read();
  if (bot) Object.assign(k, bot());
  if (game.nap > 0) Object.assign(k, { forward: 0, right: 0, jump: false, fours: false });
  const turning = k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0;
  if (turning) { cam.manual = 1.2; cam.recenter = false; }
  if (k.recenter) { cam.side = cam.side === 'behind' ? 'front' : 'behind'; cam.recenter = true; }
  cam.yaw += k.turn + k.turnKeys * dt * 2;
  cam.pitch = Math.min(1.35, Math.max(-0.15, cam.pitch + k.tilt));   // from just below him to nearly overhead
  cam.dist = Math.min(22, Math.max(5, cam.dist + k.zoom));

  game.time += dt;
  game.boost = Math.max(0, game.boost - dt);
  game.stingCool = Math.max(0, game.stingCool - dt);
  const pace = speedFactor(game.energy) * (game.boost > 0 ? 1.35 : 1);

  for (const e of wally.update(dt, k, cam.yaw, pace)) {
    if (e === 'leap') { sound.play.leap(); fx.splash(wally.pos, 22); } else if (e === 'jump') sound.play.jump();
    else if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 26); fx.shake(0.2, 0.15); } else if (e === 'land') sound.play.land();
  }
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (game.boost <= 0 && game.nap <= 0) game.energy -= energyDrain(wally.mode, moving) * dt;
  if (game.nap > 0) napping(dt);

  tourists.update(dt, wally.pos);                // strollers on the boardwalk: scenery, no food
  updateClusters(dt, t);

  const { landed, dissolved } = food.update(dt, t);
  for (const it of landed) { if (it.floating) { sound.play.plop(); fx.splash(it.rest, 8); } }
  for (const it of dissolved) { game.misses++; lost(it, 'Too late, it dissolved!'); }
  const eagerness = 0.1;                         // how keen the flying foxes are
  for (const it of bats.update(dt, t, food, eagerness, wally.pos)) {
    food.take(it, 'carried'); game.stolen++; game.by.bat++; sound.play.stolen();
    lost(it, `A flying fox nicked the ${it.name}!`);
    if (Math.random() < 0.5) bubbles.say(wally.root, pickLine('wallyStolen'), 3.6);
    if (game.streak === 0) toast('Flying fox!', 'bad');
  }
  for (const it of pelicans.update(dt, food, wally.pos)) {
    food.take(it, 'eaten'); game.stolen++; game.by.pelican++; sound.play.stolen();
    toast(`A pelican scooped the ${it.name}!`, 'bad'); game.streak = 0;
  }
  for (const it of toads.update(dt, food)) {
    food.take(it, 'eaten'); game.stolen++; game.by.toad++; sound.play.stolen();
    lost(it, `A cane toad swallowed the ${it.name}!`);
  }
  for (const it of jellies.grab(food)) {
    food.take(it, 'eaten'); game.stolen++; game.by.jelly++; sound.play.plop();
    lost(it, 'A jelly got it!');
  }
  for (const { croc, item } of crocs.update(dt, food, wally)) {
    food.take(item, 'eaten'); game.stolen++; game.by.croc++; sound.play.stolen();
    toast(`${croc.name} got the ${item.name}!`, 'bad'); game.streak = 0;
    if (Math.random() < 0.5) bubbles.say(wally.root, pickLine('wallyStolen'), 3.6);
  }
  checkCatches();

  const sting = jellies.update(dt, t, wally.pos, wally.surface === 'water');
  if (sting && game.stingCool <= 0) {
    game.stingCool = 1.5; game.energy -= 15; game.streak = 0;
    wally.knock(sting.pos.x, sting.pos.z);
    fx.shake(0.45, 0.3);
    sound.play.sting(); toast('Box jelly! Ouch!', 'bad');
    bubbles.say(wally.root, pickLine('wallySting'), 3.6);
  }

  const k2 = kenny.update(dt, wally.pos, game.energy);
  if (k2 === 'revived') revive();
  if (k2 === 'coming') { toast('Kenny is on his way with his jar!', 'info'); bubbles.say(kenny.mesh, pickLine('kennyComing'), 1.9); }
  if (k2 === 'dropped') { toast('Kenny is holding out his jar. Get to him!', 'info'); bubbles.say(kenny.mesh, pickLine('kennyJar'), 1.9); }
  if (k2 === 'eaten') {
    const close = inRedZone(game.energy);
    game.energy = ENERGY_MAX; game.boost = 12;
    sound.play.powerup(); toast(close ? 'Just in time! Full tank!' : 'Full tank!', 'good');
    bubbles.say(wally.root, pickLine('wallyToast'), 3.6);
    for (const g of game.quest.record('toast')) { toast(`Done: ${g.text}`, 'info'); sound.play.goal(); }
  }

  game.hungryCool -= dt;
  if (game.energy < 25 && game.hungryCool <= 0) { bubbles.say(wally.root, pickLine('wallyHungry'), 3.6); game.hungryCool = 12; }

  updateQuest(dt);
  if (game.energy <= 0 && game.nap <= 0) loseLife();
}

// Out of tucker: Wally flops down for a nap and it costs a life. Kenny's toast
// in the red zone is what saves him from this.
function loseLife() {
  game.lives--; game.energy = 0; game.streak = 0;
  sound.play.lose();
  if (game.lives <= 0) { finish(false); return; }
  // Down he goes, and he stays down until Kenny brings his jar (Ken's rule).
  game.nap = 1;
  wally.setNapping(true);
  kenny.reviveWally();
  toast(`Wally's knackered! ${game.lives} ${game.lives === 1 ? 'life' : 'lives'} left. Here comes Kenny!`, 'bad');
  bubbles.say(wally.root, 'Need a quick kip...', 2.6, 2.8);
  bubbles.say(kenny.mesh, "Hang on, Wally! Comin'!", 2.4);
}

// While he is down, nothing happens until Kenny's jar arrives ('revived' below).
function napping(dt) {}

function revive() {
  game.nap = 0; game.energy = REVIVE_ENERGY;
  wally.setNapping(false);
  sound.play.powerup();
  bubbles.say(wally.root, pickLine('wallyToast'), 3.6);
}

// First visit to an area: the camera sweeps over it while its name comes up,
// then settles behind Wally. Any key or tap skips it.
const INTRO_SECONDS = 7;
function playIntro(area) {
  game.intro = INTRO_SECONDS;
  $('intro-name').textContent = area.name;
  $('intro-place').textContent = area.place || '';
  $('intro').hidden = false;
  $('hud').hidden = true; $('touch').hidden = true;
  const skip = () => { if (game.intro > 0.6) game.intro = 0.6; };
  addEventListener('keydown', skip, { once: true });
  addEventListener('pointerdown', skip, { once: true });
}

function introStep(dt) {
  input.read();                                        // ignore controls during the fly-over
  game.intro -= dt;
  const p = 1 - Math.max(0, game.intro) / INTRO_SECONDS;
  const ease = p * p * (3 - 2 * p);
  cam.yaw = -1.6 + ease * 1.6;                       // swing round to behind Wally
  cam.pitch = 1.0 - ease * 0.64;                     // from high above down to normal
  cam.dist = 55 - ease * 44;
  if (game.intro <= 0) {
    $('intro').hidden = true;
    $('hud').hidden = false; $('touch').hidden = !touch;
    bubbles.say(wally.root, pickLine('wallyHello'), 3.6, 3);
  }
}

function followCamera(dt) {
  const goal = wally.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
  cam.target.lerp(goal, Math.min(1, dt * 6));
  cam.manual = Math.max(0, cam.manual - dt);
  if (game.running && game.intro <= 0) {
    const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.3;
    cam.still = moving ? 0 : cam.still + dt;
    if (cam.recenter) {
      // Swing to directly behind him, or round to his front.
      const want = wally.facing + (cam.side === 'behind' ? Math.PI : 0);
      const d = Math.atan2(Math.sin(want - cam.yaw), Math.cos(want - cam.yaw));
      cam.yaw += d * Math.min(1, dt * 6);
      if (Math.abs(d) < 0.02) cam.recenter = false;
    } else if (cam.manual <= 0 && cam.still > 2.5 && !wally.airborne) {
      // Standing about: drift round to a three-quarter view of his face.
      const want = wally.facing + 0.7;
      const d = Math.atan2(Math.sin(want - cam.yaw), Math.cos(want - cam.yaw));
      cam.yaw += d * Math.min(1, dt * 0.8);
    } else if (cam.manual <= 0) {
      // The leash: keep the camera where it was and let Wally pull it round.
      const dx = camera.position.x - cam.target.x, dz = camera.position.z - cam.target.z;
      if (dx * dx + dz * dz > 0.01) cam.yaw = Math.atan2(dx, dz);
    }
  }
  const cp = Math.cos(cam.pitch);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist,
                      cam.target.y + Math.sin(cam.pitch) * cam.dist,
                      cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
  const floor = Math.max(0, terrainHeight(camera.position.x, camera.position.z)) + 0.8;
  if (camera.position.y < floor) camera.position.y = floor;
  camera.lookAt(cam.target);
  const jolt = fx.shakeOffset(dt);
  if (jolt) camera.position.add(jolt);
}

// ---- Start, pause, end ------------------------------------------------------------

function start() {
  sound.start(); sound.startMusic('park'); sound.moodMusic('park');
  $('title').hidden = true; $('over').hidden = true; $('win').hidden = true;
  $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true; game.paused = false;
  drawQuest();
  const v = markVisited(visited, 'park');
  visited = v.visited;
  try { localStorage.setItem('chomp-visited', JSON.stringify(visited)); } catch { /* not saved */ }
  if (v.first && !bot) playIntro(AREAS[0]);
  else bubbles.say(wally.root, pickLine('wallyHello'), 3.6, 3);
}

function setPaused(p) {
  if (!game.running) return;
  game.paused = p;
  $('paused').hidden = !p;
  $('quality-name').textContent = quality.name;
}

function finish(won, why = '') {
  game.running = false;
  if (game.score > best) { best = game.score; try { localStorage.setItem('chomp-best', String(best)); } catch { /* not saved */ } }
  $('hud').hidden = true; $('touch').hidden = true;
  if (won) sound.fanfare();                         // Wally's theme hook: well done, mate
  if (won) {
    const stars = starsFor(game.score, PARK_STARS);
    progress = completeArea(progress, 'park', { score: game.score, stars });
    try { localStorage.setItem('chomp-progress', JSON.stringify(progress)); } catch { /* not saved */ }
    $('win-score').textContent = game.score.toLocaleString();
    $('win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('win-postcard').textContent = POSTCARDS.park;
    $('next-area').textContent = nextArea('park').name;
    $('win').hidden = false;
  } else {
    sound.play.lose();
    if (why === 'hungry') {
      $('over').querySelector('h1').textContent = 'Still peckish!';
      $('over').querySelector('p').textContent = `Every group is done, but Wally's feed-o-meter isn't full. He needs a full tank (${FULL}%) to head off. Scare fewer people off and beat the thieves to the food.`;
    }
    $('final-score').textContent = game.score.toLocaleString();
    $('best').textContent = `Best: ${best.toLocaleString()}`;
    $('over').hidden = false;
  }
}

function restart() { location.reload(); }   // simplest clean reset of every creature and timer

// ---- The map of Wally's Big Trip ------------------------------------------------------
// Every area, its stars, and whether it is open yet. The park is played here;
// other areas are their own pages.
const PAGES = { park: null, esplanade: 'esplanade.html', reef: 'reef.html' };
let progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
const PARK_STARS = [40, 70, 100];               // park score for one, two and three stars

function showMap() {
  $('title').hidden = true; $('win').hidden = true; $('over').hidden = true;
  const grid = $('map-grid'); grid.innerHTML = '';
  for (const a of AREAS) {
    const open = (OPEN_ALL && !params.has('locked') && a.ready) || isOpen(progress, a.id);
    const b = document.createElement('button');
    b.type = 'button'; b.className = `map-area ${open ? 'open' : 'locked'}`;
    const stars = progress.stars[a.id] || 0;
    b.innerHTML = '<b></b><small></small><span class="goal"></span><span class="s"></span>';
    b.children[0].textContent = a.name;
    b.children[1].textContent = !a.ready ? 'Coming soon' : open ? (a.place || '') : 'Finish the area before to open';
    b.children[2].textContent = a.ready ? a.objective || '' : '';       // what to do there
    b.children[3].textContent = a.ready ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
    if (open) b.onclick = () => { if (PAGES[a.id]) location.href = PAGES[a.id]; else { $('map').hidden = true; start(); } };
    grid.appendChild(b);
  }
  // The adventures stars open (Ken, 2026-10-17), shown so players see what they are working toward.
  const have = totalStars(progress);
  $('map-stars').textContent = `★ ${have}`;
  const acts = $('map-acts'); acts.innerHTML = '';
  for (const a of ACTIVITIES) {
    const area = AREAS.find(x => x.id === a.area);
    const open = activityOpen(progress, a.id);
    const d = document.createElement('div');
    d.className = `map-act ${open ? 'open' : ''}`;
    d.innerHTML = '<b></b><small></small><span class="need"></span>';
    d.children[0].textContent = `${a.name} · ${area ? area.name : ''}`;
    d.children[1].textContent = a.about;
    d.children[2].textContent = open ? 'Open!' : !area || !area.ready ? (a.stars ? `★ ${a.stars} needed · coming soon` : 'Coming soon')
      : a.stars > have ? `★ ${a.stars} needed (${a.stars - have} to go)` : `Reach ${area.name} to open`;
    acts.appendChild(d);
  }
  $('map-mangoes').textContent = `Golden Mangoes: ${progress.mangoes} · Pearls: ${progress.pearls || 0}`;
  $('map-postcards').textContent = `Postcards: ${progress.postcards.length} of ${AREAS.length}`;
  $('map').hidden = false;
}

$('play').onclick = () => { sound.start(); sound.startMusic('theme'); sound.moodMusic('theme'); showMap(); };
$('to-map').onclick = () => location.href = 'index.html?map';
$('resume').onclick = () => setPaused(false);
$('again').onclick = restart; $('again2').onclick = e => { e.preventDefault(); location.href = 'index.html?play'; };
addEventListener('visibilitychange', () => { if (document.hidden && game.running) setPaused(true); });

// ---- Test pilot (?bot) ---------------------------------------------------------------
// Steers Wally toward the food that will come down closest to him, and jumps
// when it is overhead. Used to check that the game can actually be played.

function makeBot() {
  setInterval(() => {
    document.title = `BOT t=${game.time.toFixed(0)} score=${game.score} catches=${game.catches} misses=${game.misses} stolen=${game.stolen} energy=${game.energy.toFixed(0)} stage=${game.quest.stage} goals=${game.quest.goals.map(g => g.have).join('/')} q=${quality.name} running=${game.running}`;
  }, 500);
  return function steer() {
    // For each piece, find where it comes down through Wally's mouth height and
    // head for the one he can reach soonest. Jump if it will pass well above him.
    const mouthY = wally.mouthPosition().y;
    let best = null, bestScore = Infinity, high = false;
    for (const it of food.items) {
      for (let ahead = 0; ahead < 3; ahead += 0.05) {
        const p = food.predict(it, ahead);
        const falling = it.v.y - 9.8 * (it.t + ahead) < 0;
        if (falling && p.y <= mouthY + 0.3) {
          const d = Math.hypot(p.x - wally.pos.x, p.z - wally.pos.z);
          const score = d / 6 - ahead;           // can he get there in time?
          if (score < bestScore) { best = p; bestScore = score; high = false; }
          break;
        }
        if (ahead > 0.3 && p.y > mouthY + 1.5 && Math.hypot(p.x - wally.pos.x, p.z - wally.pos.z) < 1.2) high = true;
      }
    }
    if (!best) {
      // Nothing coming: go to the nearest group with food and stop in the green
      // ring, close enough for them to throw but not close enough to scare them.
      const groups = clusters.active.filter(c => !c.fled && c.food > 0);
      if (!groups.length) return { forward: 0, right: 0, jump: false };
      const g = groups.sort((a, b) => a.root.position.distanceTo(wally.pos) - b.root.position.distanceTo(wally.pos))[0].root.position;
      const dx = g.x - wally.pos.x, dz = g.z - wally.pos.z, d = Math.hypot(dx, dz) || 1;
      const sweet = (CLUSTER.near + CLUSTER.far) / 2;
      const dir = d > sweet + 1 ? 1 : d < CLUSTER.near + 2 ? -1 : 0;     // in, out, or hold
      best = { x: wally.pos.x + dx / d * dir, z: wally.pos.z + dz / d * dir, y: 0 };
      if (dir === 0) return { forward: 0, right: 0, jump: false };
    }
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const dx = best.x - wally.pos.x, dz = best.z - wally.pos.z, len = Math.hypot(dx, dz);
    if (len < 0.4) return { forward: 0, right: 0, jump: high };
    const k = Math.min(1, len / 1.5) / len;
    return { forward: (dx * fx + dz * fz) * k, right: (dx * rx + dz * rz) * k, jump: high };
  };
}

// ---- Loop --------------------------------------------------------------------------------

let t = 0, last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);   // capped so a stall never teleports anything
  last = now;
  t += dt;
  if (game.running && !game.paused) { step(dt, t); drawHud(); }
  world.update(t, dt, game.quest.gateOpen());
  bubbles.update(dt);
  fx.update(dt, t);
  if (!game.running && !game.paused) { cam.yaw += dt * 0.08; }     // slow turn behind the title screen
  followCamera(dt);
  fpsWatch(dt);
  post.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play') || bot) start();
else if (params.has('map')) showMap();
