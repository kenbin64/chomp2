// main.js
// Croc Park: sets up the scene and runs the game loop. Each frame it reads the
// controls, moves Wally, has the tourists throw, flies the food, checks what
// was caught, missed or stolen, and keeps the quest and the screen up to date.

import { installGear, snorkelling, drainFactor } from './gear.js';
import { showTip } from './tips.js';
import * as THREE from 'three';
import { buildWorld, GATE } from './world.js';
import { Wally } from './wally.js';
import { Food, randomKind, useJarModel } from './food.js';
import { Tourists, peopleModels, Cast } from './tourists.js';
import { Kenny } from './kenny.js';
import { Crocs } from './crocs.js';
import { Jellies, FlyingFoxes, Pelicans, CaneToads } from './hazards.js';
import { Clusters } from './clusters.js';
import { LagoonTreasure, gateKey } from './parktreasure.js';
import { PARK_TREASURE, swimDepth } from './treasure-rules.js';
import * as Trip from './trip-rules.js';
import { chooseDifficulty } from './difficulty-ui.js';
import { createOpening, openingDue, resetOpening } from './opening.js';
import { addSwimSway, tickSwim } from './swim.js';
import { setGround, parkGround } from './ground.js';
import { DayNight } from './daynight.js';
import { StreetLamps } from './lamps.js';
import { Pickups, mangoMaker } from './pickups.js';
import { installBook, bookEvent, ability, HiddenFinds, openBook } from './book.js';
import { startTrading, tradeStep } from './trade.js';
import { startQuest, questStep } from './sidequest.js';
import { Input } from './input.js';
import { Bubbles, pickLine, chatty } from './bubbles.js';
import { Effects, CRUMBS } from './fx.js';
import { loadModels } from './models.js';
import { createPost } from './post.js';
import { loadRealism } from './realism.js';
import { usePalmCrown } from './palms.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from './quality.js';
import { createQuest, nextArea, markVisited, AREAS, PARK_GROUPS, FULL } from './quests.js';
import { readProgress, completeArea, isOpen, starsFor, POSTCARDS, ACTIVITIES, totalStars, activityOpen, entryNeeds, wearing, WARDROBE, outfitModel, findTreasure, bankFinds, PROGRESS_CHANGED, saveProgress } from './progress.js';
import { dressOutfit } from './outfit.js';
import { showLeaderboard } from './leaderboard.js';
import { installMap, openMap, recordVisit, markRetry } from './mapmodal.js';
import { installShop, openShop } from './shopmodal.js';
import * as sound from './sound.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, difficulty,
         clampToPark, terrainHeight, onDeck, LIVES, REVIVE_ENERGY, inRedZone,
         positionAt, foodSurface, lagoonDistance, PARK_EDGE, deckHeight, isWater, LAGOON, CLUSTER, BOARDWALK, ROCKS, aimOffset } from './rules.js';

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
// The Wally model to use: his own, or the model of a complete outfit he is wearing.
function wallyModelName() {
  return outfitModel(readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()));
}
const wally = new Wally(scene);
const food = new Food(scene);
const tourists = new Tourists(scene, quality.tourists);
const kenny = new Kenny(scene);
const crocs = new Crocs(scene, 3, { guard: true });           // and one guarding the lagoon's treasure chest
const jellies = new Jellies(scene, quality.jellies, { deep: 2 });   // two drifting up and down round the chest
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
wally.useModel(models.get(wallyModelName()) || models.get('wally'));   // a garment outfit has its own fitted Wally model
kenny.useModel(models.get('kenny'));
// The clothes they own from the Kuranda markets (outfit.js).
{ const p0 = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
  if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(p0, 'wally'));
  if (kenny.skin) dressOutfit(kenny.skin.root, 'kenny', wearing(p0, 'kenny')); }
// The other crocs: Ken's regular croc (the one Wally was), its tail swaying as it swims.
const regularCroc = models.get('croc') || models.get('croc-regular');
crocs.useModel(regularCroc);
// (Rigged now, tools/blender-rig-croc.py: it swims with its own Swim move; the shader sway only without one.)
if (regularCroc && !models.get('croc') && !regularCroc.animations.length) for (const c of crocs.list) if (c.skin) addSwimSway(c.skin.root);
pelicans.useModel(models.get('pelican'));
toads.useModel(models.get('toad'));
bats.useModel(models.get('flyingfox'));
jellies.useModel(models.get('jellyfish'));
// One cast for the whole park: no character twice (Ken). Groups first, strollers get the rest.
const cast = new Cast(peopleModels(models));
clusters.useModels(cast);
// Friendly traders (Ken): some groups offer a trade instead of running off.
clusters.enableTraders(0.25);
// Nothing is saved mid-run (trip-rules.js): leaving partway ends the attempt.
startTrading({ land: 'park', run: () => ({ mangoes: game.mangoes }), setRun: r => { game.mangoes = r.mangoes; drawQuest(); },
  feed: () => { game.energy = ENERGY_MAX; }, say: (c, text) => bubbles.say(c.people[0].g, text, 2.4), toast: text => toast(text, 'good') });
// A sidequest (Ken): one group has lost something; where it ends up in the park.
startQuest({ land: 'park', scene, clusters,
  spot(where) {
    if (where === 'lagoonBottom') { const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 7, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.6; return { x, y: terrainHeight(x, z) + 0.35, z }; }
    if (where === 'boulderTop') { const r = [...ROCKS].sort((a, b) => b.top - a.top)[Math.floor(Math.random() * 2)]; return { x: r.x, y: r.top + 0.5, z: r.z }; }
    const x = (Math.random() * 2 - 1) * 30; return { x, y: deckHeight(x) + 0.45, z: BOARDWALK.z + (Math.random() - 0.5) };
  },
  feed: () => { game.energy = ENERGY_MAX; }, say: (c, text) => bubbles.say(c ? c.people[0].g : wally.root, text, c ? 2.4 : 3.4), toast: text => toast(text, 'info') });
tourists.useModels(cast);
food.useModels(models);
// The chest on the lagoon bottom: a bonus of Golden Mangoes. (The key to the gate
// comes from feeding every group: Ken's storyboard, 2026-10-20.)
const treasure = new LagoonTreasure(scene, models.get('mango'));
// How the game begins (opening.js, Ken's storyboard): as an ordinary croc, the sceptre, the change, the sign, Kenny.
const opening = createOpening({ scene, models, wally, kenny, clusters, bubbles, fx, world, sound, toast: (t, k) => toast(t, k),
  underWater: () => game.depth < PARK_TREASURE.surfaceY - 0.6 });
whenLoaded(() => { window.chomp.camera = camera; window.chomp.opening = opening; window.chomp.parkKey = parkKey; window.chomp.machete = machete; window.chomp.GATE = GATE; });

// Day and night (Ken): now and then it gets dark, the moon comes up over the
// northern sky as it does from Cairns, and the street lamps round the lagoon
// light the park. Lamps stand on the bank about every 12 m, clear of the
// boardwalk and the gate.
const daynight = new DayNight(scene, { sun: world.sun });
function parkLampSpots() {
  const spots = [], d = 1.27, steps = 400;
  let run = 0, px = null, pz = null;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2, x = Math.cos(a) * LAGOON.rx * d, z = Math.sin(a) * LAGOON.rz * d;
    if (px !== null) run += Math.hypot(x - px, z - pz);
    px = x; pz = z;
    if (run < 12) continue;
    if (onDeck(x, z) || Math.abs(z - GATE.z) < 3 && Math.abs(x - GATE.x) < 4 || isWater(x, z)) continue;
    run = 0;
    spots.push({ x, y: Math.max(0, terrainHeight(x, z)), z, rot: -a });
  }
  // Along the boardwalk too (Ken): on the rail line, sides taking turns, rising with the deck.
  const B = BOARDWALK;
  let side = 1;
  for (let x = B.x0 + 4; x <= B.x1 - 4; x += 12) {
    if (Math.abs(x - GATE.x) < 4) continue;
    spots.push({ x, y: deckHeight(x), z: B.z + side * (B.width / 2 - 0.12), rot: side > 0 ? Math.PI : 0 });
    side = -side;
  }
  return spots;
}
// Golden Mangoes about the park (Ken: the first land gives the mangoes the
// second needs). A new spread every visit: on the bank, on top of the
// boulders, and up above the boardwalk where he has to jump for them.
function parkMangoSpots() {
  const spots = [], rnd = Math.random;
  const rocks = [...ROCKS].sort(() => rnd() - 0.5).slice(0, 2);
  for (const r of rocks) spots.push({ x: r.x, y: r.top + 1.3, z: r.z });             // up on a boulder: climb or jump for it
  for (let i = 0; i < 2; i++) { const x = (rnd() * 2 - 1) * 20; spots.push({ x, y: deckHeight(x) + 3, z: BOARDWALK.z }); }   // out of reach unless he jumps
  while (spots.length < 8) {
    const a = rnd() * Math.PI * 2, d = 1.12 + rnd() * 0.18, x = Math.cos(a) * LAGOON.rx * d, z = Math.sin(a) * LAGOON.rz * d;
    if (onDeck(x, z) || isWater(x, z) || spots.some(s => Math.hypot(s.x - x, s.z - z) < 8)) continue;
    spots.push({ x, y: Math.max(0, terrainHeight(x, z)) + 0.7, z });
  }
  return spots;
}
const parkMangoes = new Pickups(scene, parkMangoSpots(), mangoMaker(models.get('mango')));
// Hidden finds (Ken): tucked by the fence, behind boulders and under the palms;
// three of these places each visit, unseen till Wally is close.
const hidden = new HiddenFinds(scene, [
  ...Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2 + 0.3, x = Math.cos(a) * LAGOON.rx * 1.33, z = Math.sin(a) * LAGOON.rz * 1.33; return { x, y: Math.max(0, terrainHeight(x, z)), z }; }),
  ...ROCKS.map(r => { const x = r.x + r.r + 0.6, z = r.z; return { x, y: Math.max(0, terrainHeight(x, z)), z }; }),
].filter(s => !onDeck(s.x, s.z) && !isWater(s.x, s.z)));
const lamps = new StreetLamps(scene, models.get('streetlamp'), parkLampSpots(), { real: quality.name === 'high' ? 8 : quality.name === 'medium' ? 6 : 4 });

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
for (const [id, flag] of [['b-dive', 'diveQueued'], ['b-up', 'upQueued']]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); game[flag] = true; });
}
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
  // Diving for the lagoon treasure: how deep he is, where he is heading, and the keys.
  depth: PARK_TREASURE.surfaceY, wantDepth: PARK_TREASURE.surfaceY, clear: 0, foursWas: false, ctrlShiftWas: false,
  diveQueued: false, upQueued: false, hasKey: false, tripDrain: 1, biteCool: 0, treasureHint: 0, diveHint: false, mangoes: 0,
  kennyCall: 0, kennyTold: false,       // Ken: under half, Wally can go to Kenny for a scoop
};

// Under the water the lagoon's own ground: at the surface as always, or down
// at the depth he has dived to (never into the bed).
setGround({
  stand(x, z, feetY, floatY, fromBelow) {
    const s = parkGround.stand(x, z, feetY, floatY, fromBelow);
    if (s.surface === 'water' && game.depth < PARK_TREASURE.surfaceY - 0.02) return { y: swimDepth(game.depth, terrainHeight(x, z)), surface: 'water' };
    return s;
  },
});
window.chomp = { game, wally, food, quality: () => quality };   // for testing in the browser console
function whenLoaded(fn) { if (document.readyState === 'complete') setTimeout(fn); else addEventListener('load', fn); }
whenLoaded(() => { window.chomp.quest = () => window.__quest; window.chomp.hidden = hidden; window.chomp.parkMangoes = parkMangoes; window.chomp.daynight = daynight; window.chomp.lamps = lamps; window.chomp.tourists = tourists; window.chomp.treasure = treasure; window.chomp.crocs = crocs; window.chomp.cam = cam; window.chomp.clusters = clusters; window.chomp.kenny = kenny; window.chomp.pelicans = pelicans; window.chomp.jellies = jellies; window.chomp.toads = toads; });

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
  if (parkMangoes) {
    const li = document.createElement('li');
    li.className = 'extra' + (parkMangoes.found === parkMangoes.total ? ' done' : '');
    li.innerHTML = '<span>Golden Mangoes (for the pier)</span><span></span>';
    li.lastChild.textContent = `${parkMangoes.found}/${parkMangoes.total}`;
    $('goals').appendChild(li);
  }
  if (treasure) {
    const li = document.createElement('li');
    li.className = 'extra' + (treasure.opened ? ' done' : '');
    li.innerHTML = '<span>Treasure (lagoon chest: dive!)</span><span></span>';
    li.lastChild.textContent = treasure.opened ? 'found' : `${treasure.found}/${treasure.total}`;
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
function throwFood(hand, aimed, gentle = false) {
  const d = difficulty(game.time);
  const frenzy = game.quest.stage === 'challenge';
  const flight = gentle ? 0.75 : d.flight * (aimed ? 0.85 : 1);     // a handout up close is a short lob
  const mouth = wally.mouthPosition();
  const spread = gentle ? 0.35 : aimed ? 1.2 : d.spread;            // people aim at him: their food is limited
  const a = Math.random() * Math.PI * 2, r = aimOffset(Math.random, spread);
  // Aimed where he will be when it comes down (a little short of a full lead, so he still moves for it).
  let x = mouth.x + wally.vel.x * flight * 0.85 + Math.cos(a) * r;
  let z = mouth.z + wally.vel.z * flight * 0.85 + Math.sin(a) * r;
  ({ x, z } = clampToPark(x, z));
  let y = mouth.y + (gentle ? 0 : Math.random() < 0.2 ? 1.2 + Math.random() * 1.6 : Math.random() * 0.6 - 0.2);
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
  const clusterEvents = clusters.update(dt, t, wally.pos, (hand, c, gentle) => throwFood(hand, true, gentle));
  tradeStep(clusterEvents, wally.pos);
  questStep(dt, t, clusterEvents, wally.pos);
  for (const e of clusterEvents) {
    if (e.type === 'throw') showTip('sweet-spot', 'Visitors throw food when Wally is close, but not too close. Catch it before it lands: in the air is worth the most.');
    if (e.type === 'throw' && Math.random() < 0.25) bubbles.say(e.thrower.g, pickLine('touristThrow'), 2.3);
    if (e.type === 'nervous' && !game.warnedOnce) { game.warnedOnce = true; if (!showTip('too-close', 'Too close! The visitors are getting nervous. Back off a little, or they run off with their food.')) toast('Too close! Back off a bit or they will run', 'bad'); }
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
  if (daynight.night > 0.6) bookEvent('nightCatch');
  if (game.streak === 8) bookEvent('streak8');
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

  // Every group fed (Ken's storyboard): the key to the park turns up beside him.
  if (q.goalsDone() && !game.hasKey && !parkKey.out) parkKey.drop();
  parkKey.update(dt);

  const atGate = Math.abs(wally.pos.x - GATE.x) < 1.2 && Math.abs(wally.pos.z - GATE.z) < 2 && onDeck(wally.pos.x, wally.pos.z);
  // Out through the gate: the objective met and the key in hand (trip-rules.js).
  // The lock opens and the machete is there for the cane fields; picking it up is the way out.
  if (q.gateOpen() && atGate && game.hasKey && !machete.out) machete.show();
  else if (q.gateOpen() && atGate && !game.hasKey && game.time > (game.keyHintAt || 0)) {
    game.keyHintAt = game.time + 6; toast("The gate's locked! Feed every group and the key is yours", 'info'); bubbles.say(wally.root, 'Locked! I need that key.', 3);
  }
  if (machete.out && machete.update(dt) && q.leave()) finish(true);
}

// The key to the park (models/park-key.glb), glowing on the ground near Wally once
// every group is fed; walking over it picks it up.
const parkKey = (() => {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const k = models.get('park-key');
  const m = k ? k.scene.clone(true) : gateKey();
  if (k) { const b = new THREE.Box3().setFromObject(m); m.scale.setScalar(0.7 / Math.max(...b.getSize(new THREE.Vector3()).toArray())); m.rotation.x = -Math.PI / 2.4; }
  g.add(m); const glow = new THREE.PointLight(0xffd36a, 4, 5); glow.position.y = 0.6; g.add(glow);
  return {
    out: false, at: g.position,                        // at: where it lies (for testing)
    drop() {
      this.out = true; g.visible = true;
      const spot = kenny.dropSpotNear(wally.pos);
      g.position.set(spot.x, Math.max(0, terrainHeight(spot.x, spot.z)) + 0.5, spot.z);
      toast("Every group fed! There's the key to the park", 'good'); sound.play.goal();
      bubbles.say(wally.root, 'Crikey, the key to the park!', 3.4);
    },
    update(dt) {
      if (!this.out || game.hasKey) return;
      g.rotation.y += dt * 2; g.position.y += Math.sin(game.time * 3) * dt * 0.2;
      if (Math.hypot(g.position.x - wally.pos.x, g.position.z - wally.pos.z) < 1.4) {
        game.hasKey = true; g.visible = false; attempt = Trip.gain(attempt, 'park-key');
        game.score += 200; sound.play.powerup(); toast('The key! Fill up, then out the gate', 'good');
        bubbles.say(wally.root, 'Got it! Now, out the gate.', 3.4); drawQuest();
      }
    },
  };
})();

// The machete (models/machete.glb), there at the gate once it is unlocked: what the
// cane fields will need (trip-rules.js: what Croc Park opens).
const machete = (() => {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const k = models.get('machete');
  const m = k ? k.scene.clone(true) : new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.03), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.8 }));
  if (k) { const b = new THREE.Box3().setFromObject(m); m.scale.setScalar(0.9 / Math.max(...b.getSize(new THREE.Vector3()).toArray())); }
  g.add(m); const glow = new THREE.PointLight(0xfff0c0, 3, 4); glow.position.y = 0.6; g.add(glow);
  return {
    out: false, at: g.position,
    show() {
      this.out = true; g.visible = true;
      g.position.set(GATE.x - Math.sign(GATE.x || 1) * 1.4, deckHeight(GATE.x) + 0.6, GATE.z);
      toast('The gate is open! And something left by the gate...', 'good'); sound.play.goal();
      bubbles.say(wally.root, "A machete! That'll get me through the cane.", 3.4);
    },
    // True once he has picked it up.
    update(dt) {
      g.rotation.y += dt * 1.5;
      return Math.hypot(g.position.x - wally.pos.x, g.position.z - wally.pos.z) < 1.3;
    },
  };
})();

// ---- One frame ------------------------------------------------------------------

const bot = params.has('bot') ? makeBot() : null;

function step(dt, t) {
  if (opening.active) { openingStep(dt, t); return; }
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

  diveStep(dt, k);
  for (const e of wally.update(dt, k, cam.yaw, pace)) {
    if (e === 'leap') { sound.play.leap(); fx.splash(wally.pos, 22); } else if (e === 'jump') sound.play.jump();
    else if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 26); fx.shake(0.2, 0.15); } else if (e === 'land') sound.play.land();
  }
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (game.boost <= 0 && game.nap <= 0) game.energy -= energyDrain(wally.mode, moving, 'park') * drainFactor() * game.tripDrain * dt;   // vitamins (gear.js) halve it; the trip's difficulty sets the speed
  if (game.nap > 0) napping(dt);

  tourists.update(dt, wally.pos);                // strollers on the boardwalk: scenery, no food
  updateClusters(dt, t);

  const { landed, dissolved } = food.update(dt, t);
  for (const it of landed) { if (it.floating) { sound.play.plop(); fx.splash(it.rest, 8); } }
  for (const it of dissolved) { game.misses++; lost(it, 'Too late, it dissolved!'); }
  const eagerness = 0.1;                         // how keen the flying foxes are
  for (const it of bats.update(dt, t, food, eagerness, wally.pos)) {
    food.take(it, 'carried'); game.stolen++; game.by.bat++; sound.play.stolen(); thiefTip();
    lost(it, `A flying fox nicked the ${it.name}!`);
    if (Math.random() < 0.5) bubbles.say(wally.root, pickLine('wallyStolen'), 3.6);
    if (game.streak === 0) toast('Flying fox!', 'bad');
  }
  for (const it of pelicans.update(dt, food, wally.pos)) {
    food.take(it, 'eaten'); game.stolen++; game.by.pelican++; sound.play.stolen(); thiefTip();
    toast(`A pelican scooped the ${it.name}!`, 'bad'); game.streak = 0;
  }
  for (const it of toads.update(dt, food)) {
    food.take(it, 'eaten'); game.stolen++; game.by.toad++; sound.play.stolen(); thiefTip();
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

  const sting = jellies.update(dt, t, wally.pos, wally.surface === 'water', wally.pos.y);
  if (sting && game.stingCool <= 0) {
    game.stingCool = 1.5; game.energy -= 15; game.streak = 0; bookEvent('hurt');
    game.wantDepth = PARK_TREASURE.surfaceY;                     // stung under water: back up he goes
    wally.knock(sting.pos.x, sting.pos.z);
    fx.shake(0.45, 0.3);
    sound.play.sting(); toast('Box jelly! Ouch!', 'bad');
    bubbles.say(wally.root, pickLine('wallySting'), 3.6);
  }

  treasureStep(dt, t);
  for (const f of hidden.update(dt, t, wally.pos)) { toast(f.text, 'good'); sound.play.powerup(); }
  for (const m of parkMangoes.update(dt, t, wally.pos)) {
    bookEvent('mango');
    game.mangoes++; game.score += 10; sound.play.goal(); fx.burst(m.mesh.position, [0xffc21a, 0xfff1a0], 10);
    toast(`A Golden Mango! ${parkMangoes.found}/${parkMangoes.total}`, 'good');
    if (parkMangoes.found === parkMangoes.total) bubbles.say(wally.root, "Every mango in the park! Bonza!", 3.4);
    drawQuest();
  }

  const k2 = kenny.update(dt, wally.pos, game.energy);
  if (k2 === 'revived') revive();
  if (k2 === 'coming') { toast('Kenny is on his way with his jar!', 'info'); bubbles.say(kenny.mesh, pickLine('kennyComing'), 1.9); }
  if (k2 === 'asked') { toast('Kenny\'s got you: grab the jar!', 'info'); bubbles.say(kenny.mesh, pickLine('kennyJar'), 1.9); }
  // Under half: a nudge that Kenny can help, and Kenny calling him over now and then.
  game.kennyCall -= dt;
  if (kenny.ready(game.energy) && game.nap <= 0 && game.kennyCall <= 0) {
    game.kennyCall = 20;
    if (!game.kennyTold) { game.kennyTold = true; if (!showTip('kenny', 'Running low? Find Kenny the Koala: a scoop from his jar fills Wally back up.')) toast('Under half? Find Kenny for a scoop from his jar', 'info'); }
    bubbles.say(kenny.mesh, 'Over here, Wally! Got your jar!', 1.9);
  }
  if (k2 === 'dropped') { toast('Kenny is holding out his jar. Get to him!', 'info'); bubbles.say(kenny.mesh, pickLine('kennyJar'), 1.9); }
  if (k2 === 'eaten') {
    bookEvent('jar');
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

// ---- The lagoon treasure (Ken, 2026-10-18) -----------------------------------------
// In the water Shift dives to the bottom and Space comes up (as in every level),
// or the Dive and Up buttons (B and A on a controller). No croc leap from down there. While he is under,
// the water clears so the player can see him, and the camera looks down more.
// The first time a thief gets to the food first.
function thiefTip() { showTip('thieves', 'Pelicans, flying foxes and cane toads steal the food. Get to it before they do!'); }

function diveStep(dt, k) {
  const T = PARK_TREASURE, inWater = wally.surface === 'water';
  const foursPressed = k.fours && !game.foursWas; game.foursWas = k.fours;
  const underNow = game.depth < T.surfaceY - 0.3;                   // under, Space comes up; at the top it is still the croc leap
  const dive = foursPressed || game.diveQueued, up = (underNow && k.jump) || game.upQueued;
  game.diveQueued = game.upQueued = false;
  if (inWater && game.nap <= 0) {
    if (dive) game.wantDepth = T.diveY;
    if (up) game.wantDepth = T.surfaceY;
    if (!game.diveHint && game.time > 3) { game.diveHint = true; if (!showTip('dive', 'In the water, Shift (or Dive) goes under and Space (or Up) comes back up. Wally can hold his breath for a while.')) toast('Shift dives, Space comes up', 'info'); }
  }
  if (!inWater || game.nap > 0) game.wantDepth = T.surfaceY;
  game.depth += Math.sign(game.wantDepth - game.depth) * Math.min(Math.abs(game.wantDepth - game.depth), 2.5 * dt);
  const under = game.depth < T.surfaceY - 0.3;
  if (under) k.jump = false;
  game.clear += ((under ? 1 : 0) - game.clear) * Math.min(1, dt * 3);
  if (world.waterClear) world.waterClear(game.clear);
  if (under && cam.manual <= 0) cam.pitch += (Math.max(cam.pitch, 0.8) - cam.pitch) * Math.min(1, dt * 2);
  if (sound.underwaterMusic) sound.underwaterMusic(under);
  $('dive-buttons').hidden = !inWater || !game.running;
  $('b-dive').disabled = game.wantDepth <= T.diveY + 0.01; $('b-up').disabled = !under;
}

function treasureStep(dt, t) {
  game.biteCool = Math.max(0, game.biteCool - dt);
  const biter = crocs.bites(wally);
  if (biter && game.biteCool <= 0) {
    game.biteCool = 2; biter.lunge = 0.5; bookEvent('hurt');
    game.energy -= 15; game.streak = 0; game.wantDepth = PARK_TREASURE.surfaceY;
    wally.knock(biter.pos.x, biter.pos.z); fx.shake(0.5, 0.3);
    sound.play.sting(); toast(`${biter.name} snapped at you! Up you go`, 'bad');
    bubbles.say(wally.root, 'Strewth! Back off, mate!', 3.6);
  }
  for (const e of treasure.update(dt, t, wally.pos.x, wally.pos.z, wally.pos.y)) {
    if (e.type === 'found') {
      bookEvent('lostThing');
      sound.play.goal(); game.score += 50;
      const left = treasure.total - treasure.found;
      toast(left ? `Found: ${e.thing.name}! ${left} more down here` : `Found: ${e.thing.name}! That's the lot: now the chest`, 'good');
      if (!left) bubbles.say(wally.root, "Crikey, that's everything! Now for that chest!", 3.6);
      drawQuest();
    } else if (e.type === 'open') {
      bookEvent('chest');
      game.mangoes += 10; game.score += 500; sound.play.powerup();
      toast('Treasure! Ten Golden Mangoes', 'good');
      bubbles.say(wally.root, 'Ten Golden Mangoes! Ripper!', 3.6);
      drawQuest();
    }
  }
  // A nudge toward it, a little while in, if he has not found anything yet.
  game.treasureHint -= dt;
  if (game.time > 40 && treasure.found === 0 && game.treasureHint <= 0) {
    game.treasureHint = 60;
    bubbles.say(wally.root, "Hang on, what's bubbling up in the middle of the lagoon?", 3.6);
  }
}

// The opening (opening.js): the player steers the croc while it looks for the
// sceptre; after that the scenes play and nothing else happens. No food yet, no
// meter running down; the visitors watch.
function openingStep(dt, t) {
  const k = input.read();
  if (k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0) { cam.manual = 1.2; cam.recenter = false; }
  cam.yaw += k.turn + k.turnKeys * dt * 2;
  cam.pitch = Math.min(1.35, Math.max(-0.15, cam.pitch + k.tilt));
  cam.dist = Math.min(22, Math.max(5, cam.dist + k.zoom));
  const steering = opening.step(dt, t);
  const still = { forward: 0, right: 0, jump: false, fours: false, turn: 0, turnKeys: 0, tilt: 0, zoom: 0 };
  if (steering) diveStep(dt, k); else { game.wantDepth = PARK_TREASURE.surfaceY; diveStep(dt, still); }
  if (opening.phase === 'intro') $('dive-buttons').hidden = true;      // not during the cinematic
  const was = wally.pos.clone();
  for (const e of wally.update(dt, steering ? { ...k, jump: false } : still, cam.yaw, 1)) {
    if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 20); }
  }
  // As a croc he stays in the water (the model has no legs to walk with yet).
  if (steering && !isWater(wally.pos.x, wally.pos.z)) { wally.pos.x = was.x; wally.pos.z = was.z; wally.root.position.x = was.x; wally.root.position.z = was.z; }
  clusters.idle(dt);
  tourists.update(dt, wally.pos);
  crocs.update(dt, food, wally);
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
  clusters.idle(dt);                                   // the visitors are already watching, not frozen
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
  const shot = opening.active && opening.shot();
  // The opening's cinematic can look at something other than Wally (the park, the sign).
  const goal = shot && shot.target ? shot.target : wally.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
  cam.target.lerp(goal, Math.min(1, dt * (shot && shot.target ? 2.5 : 6)));
  cam.manual = Math.max(0, cam.manual - dt);
  if (shot && shot.exact) {
    // The cinematic: the camera exactly where the shot says, for one smooth curve.
    cam.target.copy(goal); cam.yaw = shot.yaw; cam.pitch = shot.pitch; cam.dist = shot.dist;
  } else if (shot) {
    // A scene of the opening: the camera eases to its framing of Wally.
    const d = Math.atan2(Math.sin(shot.yaw - cam.yaw), Math.cos(shot.yaw - cam.yaw)), e = Math.min(1, dt * 2.5);
    cam.yaw += d * e; cam.pitch += (shot.pitch - cam.pitch) * e; cam.dist += (shot.dist - cam.dist) * e;
  } else if (game.running && game.intro <= 0) {
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

// The trip (trip-rules.js): made when a new trip starts (the difficulty choice),
// or carried over from a save made before the rules.
function ensureTrip(level = 'intermediate') {
  if (progress.trip) return;
  progress.trip = progress.postcards.length || Object.keys(progress.stars).length ? Trip.tripFromProgress(progress) : Trip.freshTrip(level);
  if (!progress.trip.completed.length) resetOpening();           // a brand-new trip starts at the very beginning
  saveProgress(progress);
}

function start() {
  ensureTrip();
  attempt = Trip.startAttempt(progress.trip, 'park');
  game.hasKey = Trip.have(progress.trip, 'park-key') || Trip.have(progress.trip, 'gate-key');   // on a return visit he has it already (gate-key: saves from before)
  game.tripDrain = Trip.drainFactor(progress.trip, 'park', attempt.level);
  sound.start(); sound.startMusic('park'); sound.moodMusic('park');
  $('title').hidden = true; $('over').hidden = true; $('win').hidden = true;
  $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true; game.paused = false;
  drawQuest();
  recordVisit('park');
  const v = markVisited(visited, 'park');
  visited = v.visited;
  try { localStorage.setItem('chomp-visited', JSON.stringify(visited)); } catch { /* not saved */ }
  if (openingDue(progress.trip, params) && !bot) {
    opening.begin(() => { lastHud = ''; drawQuest(); bubbles.say(wally.root, "Right! Let's find that key.", 3.6, 3); });
  } else {
    opening.carry();                                   // he has the sceptre already: on his back
    if (v.first && !bot) playIntro(AREAS[0]);
    else bubbles.say(wally.root, pickLine('wallyHello'), 3.6, 3);
  }
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
    bookEvent('finish');
    const stars = starsFor(game.score, PARK_STARS);
    // Opening the gate gives the machete for the cane fields (trip-rules.js: what the park opens).
    const done = Trip.completeAttempt(progress.trip, Trip.gain(Trip.gain(attempt, 'golden-mango', game.mangoes), 'machete'), { objectiveMet: true });
    if (done.ok) progress.trip = done.trip;
    progress = completeArea(progress, 'park', { score: game.score, stars, mangoes: game.mangoes });
    try { localStorage.setItem('chomp-progress', JSON.stringify(progress)); } catch { /* not saved */ }
    $('win-score').textContent = game.score.toLocaleString();
    $('win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('win-postcard').textContent = POSTCARDS.park;
    $('next-area').textContent = nextArea('park').name;
    $('win').hidden = false;
    showLeaderboard($('win-board'), 'park', game.score, stars);   // post the score, show the top ten
  } else {
    sound.play.lose();
    progress.trip = Trip.failAttempt(progress.trip, attempt).trip;       // nothing from this attempt is kept (trip-rules.js)
    try { localStorage.setItem('chomp-progress', JSON.stringify(progress)); } catch { /* not saved */ }
    if (why === 'hungry') {
      $('over').querySelector('h1').textContent = 'Still peckish!';
      $('over').querySelector('p').textContent = `Every group is done, but Wally's feed-o-meter isn't full. He needs a full tank (${FULL}%) to head off. Scare fewer people off and beat the thieves to the food.`;
    }
    markRetry(false, 'Croc Park');
    $('final-score').textContent = game.score.toLocaleString();
    $('best').textContent = `Best: ${best.toLocaleString()}`;
    $('over').hidden = false;
    showLeaderboard($('over-board'), 'park', 0);                  // the top ten (only finished runs go on the board)
  }
}

function restart() { location.reload(); }   // simplest clean reset of every creature and timer

// ---- The map of Wally's Big Trip ------------------------------------------------------
// Every area, its stars, and whether it is open yet. The park is played here;
// other areas are their own pages.
const PAGES = { park: null, esplanade: 'esplanade.html', reef: 'reef.html', kuranda: 'kuranda.html' };
let progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
let attempt = null;                                 // this go at the park (trip-rules.js)
addEventListener(PROGRESS_CHANGED, () => { progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); });   // the book, trades and shops write it too
const PARK_STARS = [40, 70, 100];               // park score for one, two and three stars

function showMap() {
  $('title').hidden = true; $('win').hidden = true; $('over').hidden = true;
  openMap();
}

// The opener: How to play opens the instructions over the art; Got it closes them.
$('how').onclick = () => { $('how-card').hidden = false; };
$('how-close').onclick = () => { $('how-card').hidden = true; };
$('credits').onclick = () => { $('credits-card').hidden = false; };
// Ken's promo trailer (the brand name on the jar covered with a V: tools/cover-label-keys.py).
// It plays muted in a small window on the opening screen (not on phones, or when
// the player's device asks for reduced motion); clicking it, or Trailer, plays
// the whole thing with sound.
const peek = $('trailer-peek'), peekVideo = peek.querySelector('video');
const stillOnly = matchMedia('(prefers-reduced-motion: reduce)').matches || touch;
if (!stillOnly) peekVideo.play().catch(() => {});
function openTrailer() { peekVideo.pause(); $('trailer-box').hidden = false; const v = $('trailer-video'); v.muted = false; v.volume = 1; v.currentTime = 0; v.play().catch(() => {}); }
$('trailer').onclick = openTrailer; peek.onclick = openTrailer;
$('trailer-close').onclick = () => { const v = $('trailer-video'); v.pause(); $('trailer-box').hidden = true; if (!stillOnly) peekVideo.play().catch(() => {}); };
$('credits-close').onclick = () => { $('credits-card').hidden = true; };
$('play').onclick = async () => {
  sound.start(); sound.startMusic('theme'); sound.moodMusic('theme');
  if (!progress.trip && !progress.postcards.length && !Object.keys(progress.stars).length) ensureTrip(await chooseDifficulty());
  showMap();
};
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
  if (game.running && !game.paused) { step(dt, t); if (!opening.active) drawHud(); }
  tickSwim(t);
  world.update(t, dt, game.quest.gateOpen() && game.hasKey);
  bubbles.update(dt);
  fx.update(dt, t);
  if (!game.running && !game.paused) { cam.yaw += dt * 0.08; }     // slow turn behind the title screen
  followCamera(dt);
  const night = daynight.update(game.paused ? 0 : dt, camera);
  lamps.update(dt, night, wally.pos);
  fpsWatch(dt);
  post.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play') || bot) start();
else if (params.has('map')) showMap();

// The map, from anywhere (mapmodal.js): the Map button or Tab. Play pauses while it is open.
installMap({ pause: on => { if (game.running) game.paused = on; } });
installShop({ pause: on => { if (game.running) game.paused = on; } });
installBook({ here: 'park', pause: on => { if (game.running) game.paused = on; } });
installGear({ scene, wally, food, mouth: () => wally.mouthPosition(), hasAir: false, toast: (t, k) => toast(t, k), openBook: () => openBook('wally'), running: () => game.running && !game.paused, pause: on => { if (game.running) game.paused = on; } });
window.chompStartHere = () => { if (!game.running) { $('title').hidden = true; $('win').hidden = true; $('over').hidden = true; start(); } };
window.chompDress = () => {
  const p = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
  wally.changeModel(models.get(outfitModel(p)) || models.get('wally'));     // a whole-model outfit goes on now
  if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(p, 'wally'));
  if (kenny.skin) dressOutfit(kenny.skin.root, 'kenny', wearing(p, 'kenny'));
};
