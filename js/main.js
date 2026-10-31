// main.js
// Croc Park: sets up the scene and runs the game loop. Each frame it reads the
// controls, moves Wally, has the tourists throw, flies the food, checks what
// was caught, missed or stolen, and keeps the quest and the screen up to date.

import { isApp } from './menu.js';
import { installVR, inVR } from './vr.js';
import { guideArrow, nearest } from './guide-arrow.js';
import { startRun, addPoints, bankRun, failRun } from './points.js';
import { installGear, drainFactor } from './gear.js';
import { showTip } from './tips.js';
import * as THREE from 'three';
import { buildWorld, GATE } from './world.js';
import { Wally } from './wally.js';
import { Food, kindFor, useJarModel } from './food.js';
import { Tourists, peopleModels, Cast } from './tourists.js';
import { Kenny } from './kenny.js';
import { Crocs } from './crocs.js';
import { Jellies, FlyingFoxes, Pelicans, CaneToads } from './hazards.js';
import { Clusters } from './clusters.js';
import { LagoonTreasure, gateKey } from './parktreasure.js';
import { PARK_TREASURE, swimDepth } from './treasure-rules.js';
import * as Trip from './trip-rules.js';
import { createOpening, openingDue, resetOpening } from './opening.js';
import { addSwimSway, tickSwim } from './swim.js';
import { setGround, parkGround, addSolid, setParkMode, getParkMode } from './ground.js';
import { DayNight } from './daynight.js';
import { StreetLamps } from './lamps.js';
import { installBook, bookEvent, HiddenFinds, openBook } from './book.js';
import { startQuest, questStep } from './sidequest.js';
import { Input, steering, lazyBehind } from './input.js';
import { Bubbles, reaction, pickLine, chatty } from './bubbles.js';
import { Effects, CRUMBS } from './fx.js';
import { loadModels, MODEL_FILES, PARK_MODEL_FILES } from './models.js';
import { createPost } from './post.js';
import { createEyes } from './eyes.js';
import { createEscapeScene } from './escape-scene.js';
import { MANGO_NEED, MANGO_ENERGY, GIVE_REACH, mangoSpots, giantChestSpot, escapeStage, nextGateNeed } from './escape-rules.js';
import { chestModel } from './chest.js';
import { carried } from './carried.js';
import { readSeconds } from './read-time.js';
import { Pickups, mangoMaker } from './pickups.js';
import { BANK_Y } from './rules.js';
import { GATE_POST } from './chase-rules.js';
import { loadRealism } from './realism.js';
import { usePalmCrown } from './palms.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from './quality.js';
import { createQuest, escapeQuest, nextArea, markVisited, AREAS, PARK_GROUPS, FULL } from './quests.js';
import { parkEase, thievesAllowed, ARRIVAL_LINES } from './park-ease.js';
import { readProgress, completeArea, starsFor, POSTCARDS, wearing, outfitModel, PROGRESS_CHANGED, saveProgress } from './progress.js';
import { dressOutfit } from './outfit.js';
import { showLeaderboard } from './leaderboard.js';
import { installMap, openMap, recordVisit, markRetry, mapActive, pageFor } from './mapmodal.js';
import { installShop } from './shopmodal.js';
import * as sound from './sound.js';
import { aimTurn, aimSlow } from './aim-rules.js';
import { installCameraButton, toggleCamera } from './audio-ui.js';
import { settings } from './settings.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, difficulty,
         clampToPark, terrainHeight, onDeck, LIVES, REVIVE_ENERGY, inRedZone,
         positionAt, foodSurface, lagoonDistance, PARK_EDGE, deckHeight, isWater, LAGOON, CLUSTER, BOARDWALK, ROCKS, aimOffset, PATH, fencePoint } from './rules.js';
import { kioskSpots } from './park-path.js';
import { fenceOffset } from './rules.js';
import { Catcher } from './chase.js';
import { focusOn } from './see-through.js';
import { clearOfSections } from './park-sections.js';
import { EXIT, EXIT_SPOT, OUT_DRAIN, OUT_MARGIN } from './chase-rules.js';

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
// Every object's place in the world is worked out once a frame, in the game loop (frame), not by three.js
// at each of the frame's several drawings (the water's reflection, the picture, the shading pass): nothing
// moves between them, and the scene has about 3,000 objects (measured 2026-10-26).
scene.matrixWorldAutoUpdate = false;
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 68 : 55;          // phones held upright see more
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// Ken's models and backdrop pictures, where they exist; stand-ins otherwise.
const models = await loadModels([...MODEL_FILES, ...PARK_MODEL_FILES], { light: touch || quality.name === 'low' });
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
// The croc catcher (chase.js, Ken 2026-10-29): he walks the path, and chases Wally once he is out of the gate.
const catcher = new Catcher(scene, models.get('croc-wrangler'));
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
// They stand on the visitors' path at the fence (Ken, 2026-10-29: people belong outside the croc fence, not
// on the bank). From the fence Wally is 3.8 to 4.5 m from them: close enough to make them nervous, never
// close enough to make them bolt on the spot.
const CLUSTER_SPOTS = [120, 60, 200, 330, 250, 160, 290, 38, 76].map(deg => fencePoint(deg * Math.PI / 180, PATH.stand)).concat([{ x: -14, z: 2 }, { x: 16, z: 2 }]);             // and two on the boardwalk
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
startQuest({ land: 'park', scene, clusters,
  spot(where) {
    if (where === 'lagoonBottom') { const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 7, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.6; return { x, y: terrainHeight(x, z) + 0.35, z }; }
    if (where === 'boulderTop') { const r = [...ROCKS].sort((a, b) => b.top - a.top)[Math.floor(Math.random() * 2)]; return { x: r.x, y: r.top + 0.5, z: r.z }; }
    const x = (Math.random() * 2 - 1) * 30; return { x, y: deckHeight(x) + 0.45, z: BOARDWALK.z + (Math.random() - 0.5) };
  },
  feed: () => { game.energy = ENERGY_MAX; }, say: (c, text) => bubbles.say(c ? c.people[0].g : wally.root, text, c ? 2.4 : 3.4), toast: text => toast(text, 'info') });
// Strollers get only people the groups are not wearing; a group arriving later
// takes a stroller's person if nobody else is free (no one twice in view, Ken).
tourists.useModels(cast, clusters.worn());
clusters.othersUsed = () => tourists.worn();
clusters.borrow = () => tourists.release();
food.useModels(models);
// The chest on the lagoon bottom holds the key to the park (Ken, 2026-10-30), which rises out of it when it opens.
const chestKey = (() => {
  const k = models.get('park-key');
  if (!k) return gateKey();
  const m = k.scene.clone(true), b = new THREE.Box3().setFromObject(m);
  m.scale.setScalar(0.7 / Math.max(...b.getSize(new THREE.Vector3()).toArray()));
  return m;
})();
const treasure = new LagoonTreasure(scene, null, chestKey);
// How the game begins (opening.js, Ken's storyboard): as an ordinary croc, the sceptre, the change, the sign, Kenny.
const opening = createOpening({ scene, models, wally, kenny, clusters, bubbles, fx, world, sound, toast: (t, k) => toast(t, k),
  underWater: () => game.depth < PARK_TREASURE.surfaceY - 0.6 });
whenLoaded(() => { window.chomp.camera = camera; window.chomp.opening = opening; window.chomp.machete = machete; window.chomp.GATE = GATE; });

// Day and night (Ken): now and then it gets dark, the moon comes up over the
// northern sky as it does from Cairns, and the street lamps round the lagoon
// light the park. Lamps stand on the bank about every 12 m, clear of the
// boardwalk and the gate.
const daynight = new DayNight(scene, { sun: world.sun });
// The lamps light the visitors' path, on its outer edge (Ken, 2026-10-29), clear of the kiosks.
function parkLampSpots() {
  const spots = [], steps = 400, kiosks = kioskSpots();
  let run = 0, px = null, pz = null;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2, { x, z } = fencePoint(a, PATH.outer + 0.3);
    if (px !== null) run += Math.hypot(x - px, z - pz);
    px = x; pz = z;
    if (run < 12) continue;
    if (Math.abs(z - BOARDWALK.z) < BOARDWALK.width / 2 + 1 || kiosks.some(k => Math.hypot(k.x - x, k.z - z) < 5) || !clearOfSections(x, z)) continue;
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
// Hidden finds (Ken): tucked by the fence, behind boulders and under the palms;
// three of these places each visit, unseen till Wally is close.
const hidden = new HiddenFinds(scene, [
  ...Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2 + 0.3, x = Math.cos(a) * LAGOON.rx * 1.33, z = Math.sin(a) * LAGOON.rz * 1.33; return { x, y: Math.max(0, terrainHeight(x, z)), z }; }),
  ...ROCKS.map(r => { const x = r.x + r.r + 0.6, z = r.z; return { x, y: Math.max(0, terrainHeight(x, z)), z }; }),
].filter(s => !onDeck(s.x, s.z) && !isWater(s.x, s.z)));
const lampSpots = parkLampSpots();
for (const s of lampSpots) if (!onDeck(s.x, s.z)) addSolid(s.x, s.z, 0.2);     // the posts are solid (on the deck they stand at the rail)
const lamps = new StreetLamps(scene, models.get('streetlamp'), lampSpots, { real: quality.name === 'high' ? 8 : quality.name === 'medium' ? 6 : 4 });

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
// The camera, auto or manual (audio-ui.js): a button beside the speaker, V on the keyboard, or the pause settings.
installCameraButton();
input.onCamera = () => { toggleCamera(); toast(settings.camera === 'manual' ? 'Camera: manual (Q and E turn it)' : 'Camera: auto', 'info'); };

// ---- Game state ---------------------------------------------------------------

let best = 0, visited = [];
try {
  best = Number(localStorage.getItem('chomp-best')) || 0;
  visited = JSON.parse(localStorage.getItem('chomp-visited') || '[]');
} catch { /* private mode: nothing saved, every visit counts as the first */ }

const game = {
  running: false, paused: false, time: 0, score: 0, energy: ENERGY_MAX, streak: 0,
  boost: 0, throwIn: 2, stingCool: 0, frenzyIn: -1, quest: createQuest(),
  catches: 0, misses: 0, stolen: 0, hungryCool: 0, lives: LIVES, nap: 0, intro: 0, newGroupIn: 25, groupsArrived: 4, tourGroup: false, parkGroups: PARK_GROUPS, throwPace: 1, scared: 0, warnedOnce: false,
  by: { bat: 0, pelican: 0, toad: 0, jelly: 0, croc: 0 },      // who took the food, for balancing
  // Diving for the lagoon treasure: how deep he is, where he is heading, and the keys.
  depth: PARK_TREASURE.surfaceY, wantDepth: PARK_TREASURE.surfaceY, clear: 0, foursWas: false, ctrlShiftWas: false,
  diveQueued: false, upQueued: false, hasKey: false, tripDrain: 1, biteCool: 0, treasureHint: 0, diveHint: false,
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
window.chomp = { game, wally, food, catcher, scene, renderer, quality: () => quality };   // for testing in the browser console
function whenLoaded(fn) { if (document.readyState === 'complete') setTimeout(fn); else addEventListener('load', fn); }
whenLoaded(() => { window.chomp.quest = () => window.__quest; window.chomp.hidden = hidden; window.chomp.daynight = daynight; window.chomp.lamps = lamps; window.chomp.tourists = tourists; window.chomp.treasure = treasure; window.chomp.crocs = crocs; window.chomp.cam = cam; window.chomp.clusters = clusters; window.chomp.kenny = kenny; window.chomp.pelicans = pelicans; window.chomp.jellies = jellies; window.chomp.toads = toads; });

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
  setTimeout(() => el.remove(), Math.max(1800, readSeconds(text) * 1000));
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
  if (q.goalsDone() && q.stage === 'goals' && q.needsFull()) {
    const li = document.createElement('li');
    li.innerHTML = '<span>Now fill the feed-o-meter</span><span></span>';
    $('goals').appendChild(li);
  }
  $('frenzy').hidden = true;
  if (q.stage === 'gate') $('quest-title').textContent = game.out ? 'Boss: get away from the croc wrangler. Run for the cane fields!' : 'You have the key: out the gate on the boardwalk';
  if (escape.on) {
    const next = nextGateNeed(escape.found), stage = escapeStage(escape.found, escape.giant, escape.given);
    $('quest-title').textContent = escape.given ? 'The gate is open: to the cane field!' : escape.giant ? 'Find the wrangler: show him the mango' : game.out ? 'Escape! The wrangler is after you' : 'Caught! Back out the gate';
    $('goals').innerHTML = '';
    for (const [text, right, done] of [
      ['Mangoes', `${Math.min(escape.found, MANGO_NEED)}/${MANGO_NEED}`, stage !== 'mangoes'],
      [next ? `Next gate opens at ${next}` : 'All the gates are open', '', !next],
      ['Open the chest', escape.giant ? '1/1' : '0/1', escape.giant],
      ['Show it to the wrangler', escape.given ? '1/1' : '0/1', escape.given],
      ['Through the final gate to the cane field', '', false],
    ]) {
      const li = document.createElement('li'); li.className = done ? 'done' : '';
      li.innerHTML = '<span></span><span></span>'; li.firstChild.textContent = text; li.lastChild.textContent = right;
      $('goals').appendChild(li);
    }
  }
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
function throwFood(hand, aimed, gentle = false, thrower = null) {
  const d = difficulty(game.time * game.throwPace);             // slower on the first visit (park-ease.js)
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
  return food.throw(kindFor(thrower), hand, v);              // only food this person would carry
}

function landingOf(from, v) {
  for (let t = 0.05; t < 6; t += 0.05) {
    const p = positionAt(from, v, t);
    if (p.y <= foodSurface(p.x, p.z, p.y + 0.5)) return p;
  }
  return null;
}

function updateClusters(dt, t) {
  const clusterEvents = clusters.update(dt, t, wally.pos, (hand, c, gentle, thrower) => throwFood(hand, true, gentle, thrower));
  questStep(dt, t, clusterEvents, wally.pos);
  stageThieves();
  for (const e of clusterEvents) {
    if (e.type === 'throw') showTip('sweet-spot', 'Visitors throw food when Wally is close, but not too close. Catch it before it lands: in the air is worth the most.');
    if (e.type === 'throw' && Math.random() < 0.25) bubbles.say(e.thrower.g, pickLine('touristThrow'), 2.3);
    if (e.type === 'nervous' && !game.warnedOnce) { game.warnedOnce = true; if (!showTip('too-close', 'Too close! The visitors are getting nervous. Back off a little, or they run off with their food.')) toast('Too close! Back off a bit or they will run', 'bad'); }
    if (e.type === 'flee') { game.scared++; toast(e.cluster.food > 0 ? `They ran off with ${e.cluster.food} bits of tucker!` : 'They ran off!', 'bad'); if (reaction()) bubbles.say(wally.root, pickLine('wallyFlee'), 3.4); }
    if (e.type === 'empty') toast('That lot are all out of food', 'info');
    if ((e.type === 'flee' || e.type === 'empty') && !e.cluster.counted) {
      e.cluster.counted = true;                                    // fed out or run off: either way, that group is done
      game.groupsDone++;                                           // the thieves arrive as this goes up (stageThieves)
    }
  }
  // The park's visitors for the day: four to start, three more turn up, and
  // when all seven are done a tour group arrives on the boardwalk.
  game.newGroupIn -= dt;
  const live = clusters.active.filter(c => !c.counted).length;
  // After the tour group they keep coming for as long as he is here: he has to be able to stay fed (Ken, 2026-10-30).
  if ((game.groupsArrived < game.parkGroups - 1 || game.tourGroup) && (live === 0 || (game.newGroupIn <= 0 && live < 4))) {
    if (spawnCluster()) { game.groupsArrived++; toast('More visitors have arrived!', 'info'); }
    game.newGroupIn = 25;
  } else if (!game.tourGroup && game.groupsArrived >= game.parkGroups - 1 && live === 0) {
    game.tourGroup = true;
    clusters.add({ x: 0, z: 2, size: 6, food: 16, rate: 0.5 });
    toast("A tour group's here, with plenty of tucker!", 'info'); sound.play.goal();
  }
}

// Anything left to eat: food in the air or on the ground, groups with food, or groups still to come.
function foodLeft() {
  return food.items.length > 0 || clusters.active.some(c => !c.fled && c.food > 0) || game.groupsArrived < game.parkGroups - 1 || !game.tourGroup;
}

// ---- Catching and losing food ---------------------------------------------------

function caught(item) {
  clusters.cheer(item.cluster);                    // the group that threw it cheers
  fx.burst(item.mesh.position, CRUMBS[item.kind] || [0xffffff]);
  fx.shake(0.12, 0.12);
  food.take(item, 'eaten');
  const how = item.landed ? 'ground' : (wally.airborne ? 'leap' : 'air');
  wally.chomp(how);
  sound.play.chomp(); eyes.chomp();
  game.streak++; game.catches++;
  if (daynight.night > 0.6) bookEvent('nightCatch');
  if (game.streak === 8) bookEvent('streak8');
  const pts = catchPoints(how, game.streak, game.boost > 0);
  game.score += pts; addPoints(how);   // the trip's points (points.js): ground 1, air 2, leap 3
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
  if (r === 'gate' && !game.hadKey) { toast('Now out the gate on the boardwalk!', 'info'); sound.play.powerup(); }
  if (r === 'hungry') { finish(false, 'hungry'); return; }

  const atGate = Math.abs(wally.pos.x - GATE.x) < 1.2 && Math.abs(wally.pos.z - GATE.z) < 2 && onDeck(wally.pos.x, wally.pos.z);
  const gateOpen = q.gateOpen() || game.chaseTest;
  // Out through the gate (Ken, 2026-10-29): the objective met and the key in hand (trip-rules.js), the lock
  // opens onto the park's grounds. The machete for the cane fields waits at the way out, over the far side;
  // picking it up is the way out. Once he is past the croc fence the catcher comes running (chase.js).
  if (gateOpen && atGate && game.hasKey && getParkMode() === 'park') {
    setParkMode('gate');
    carried.use('key');                                              // the key has done its job
    if (!machete.out) machete.show(EXIT_SPOT);
  } else if (atGate && !game.hasKey && game.time > (game.keyHintAt || 0)) {
    game.keyHintAt = game.time + 6; toast("The gate's locked! The key is in the chest, on the bottom of the lagoon", 'info'); bubbles.say(wally.root, 'Locked! I need that key.', 3);
  }
  if (getParkMode() === 'gate' && fenceOffset(wally.pos.x, wally.pos.z) > OUT_MARGIN) breakOut();
  if (machete.out && machete.update(dt)) {
    if (escape.on && !escape.given && !game.chaseTest) { if (game.time > (game.keyHintAt || 0)) { game.keyHintAt = game.time + 5; toast('The final gate is locked. Only the wrangler has the key!', 'bad'); bubbles.say(wally.root, 'Locked! The wrangler has that key.', 2.6); } }
    else if (q.leave() || game.chaseTest) finish(true);
  }
  if (escape.on) escapeStep(dt, game.time);
  if (game.hasKey && !game.kennyTold && !game.chaseTest && wally.surface !== 'water' && !wally.airborne && getParkMode() === 'park') kennyTells();
  // Where to go next, on the first visit (guide-arrow.js): food when he is low; otherwise the next lost thing, the
  // chest, the gate, the way out.
  const hungry = clusters.active.filter(c => !c.fled && c.food > 0).map(c => c.root.position);
  arrow.update(escape.on && game.out ? escapeArrow()
    : machete.out ? { x: machete.at.x, z: machete.at.z, label: game.out ? 'The way out' : 'The gate' }
    : game.hasKey ? { x: GATE.x, z: GATE.z, label: 'The gate' }
    : (game.energy < 35 && hungry.length) ? (n => ({ x: n.x, z: n.z, label: 'Hungry visitors' }))(nearest(hungry, wally.pos))
    : (treasure.found < treasure.total) ? (n => ({ x: n.x, z: n.z, label: 'Something lost: dive!' }))(nearest(treasure.things.filter(x => !x.taken), wally.pos))
    : { x: treasure.chest.group.position.x, z: treasure.chest.group.position.z, label: 'The chest: dive!' }, wally.pos, cam.yaw);
}

// The boss of Croc Park is the croc wrangler (Ken, 2026-10-30): the banner as the chase begins.
function bossBanner() {
  const b = document.createElement('div'); b.className = 'boss-banner';
  b.innerHTML = '<small>Boss</small>The Croc Wrangler<span>Find the way out before he catches you</span>';
  document.body.append(b); setTimeout(() => b.remove(), 3400);
}
// The race (Ken, 2026-10-30; escape-rules.js has the rules). Nothing of it is out until he breaks out; he keeps what he
// has found if he is caught.
const HEAD_START = 1.5, PRIZE_ON_SHOW = 3;
const escapeScene = createEscapeScene(camera);
// The King's Golden Mango, a crown jewel: the same mango, in solid gold, with a glow of its own.
function crownJewel() {
  const m = mangoMaker(models.get('mango'))();
  m.traverse(o => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: 0xffc926, metalness: 0.85, roughness: 0.22, emissive: 0x6a4300, emissiveIntensity: 0.7 }); });
  return m;
}
const escape = {
  on: false, found: 0, giant: false, mangoes: null, chest: null, open: 0, chestAt: giantChestSpot(), hintAt: 0,
  begin() {
    this.on = true; this.found = 0; this.giant = false; this.given = false; this.open = 0; this.shown = 0;
    world.finalGate.show();
    this.mangoes = new Pickups(scene, mangoSpots().map(p => ({ x: p.x, y: BANK_Y + p.up + 1, z: p.z })), mangoMaker(models.get('mango')), { size: 1.7, glint: 2.2, reach: 1.5 });
    if (!this.chest) {
      const holder = new THREE.Group(); holder.add(crownJewel());     // (chestModel sets the size of what it is given: a holder keeps the model's own fit)
      this.chest = chestModel(holder);
      const g = this.chest.group; g.position.set(this.chestAt.x, BANK_Y, this.chestAt.z); g.rotation.y = this.chestAt.rot; g.scale.setScalar(1.4); scene.add(g);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 7, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 3.5; beam.userData.noAO = true; g.add(beam);
      addSolid(this.chestAt.x, this.chestAt.z, 0.9);
    }
    this.chest.group.visible = true; this.chest.lid.rotation.x = 0; this.chest.mango.visible = false; this.chest.glow.intensity = 0;
    world.gateBars.set(0);
    if (!machete.out) machete.show(EXIT_SPOT);
  },
  // A new run: all of it gone again.
  clear() {
    this.on = false; this.found = 0; this.giant = false; this.given = false;
    if (world.finalGate) world.finalGate.hide();
    if (this.mangoes) { for (const p of this.mangoes.list) { scene.remove(p.mesh, p.shine); p.shine.material.dispose(); } this.mangoes = null; }
    if (this.chest) this.chest.group.visible = false;
  },
};
window.chomp.escape = escape; window.chomp.escapeScene = escapeScene;
function escapeArrow() {
  const stage = escapeStage(escape.found, escape.giant, escape.given);
  if (stage === 'exit') return { x: machete.at.x, z: machete.at.z, label: 'The final gate' };
  if (stage === 'give') return { x: catcher.pos.x, z: catcher.pos.z, label: 'The wrangler: show him the mango' };
  if (stage === 'chest') return { x: escape.chestAt.x, z: escape.chestAt.z, label: 'The chest!' };
  const left = escape.mangoes.list.filter(p => !p.taken);
  const n = nearest(left.map(p => p.mesh.position), wally.pos);
  return n ? { x: n.x, z: n.z, label: 'A mango' } : null;
}
function escapeStep(dt, t) {
  for (const m of escape.mangoes.update(dt, t, wally.pos)) {
    escape.found++; game.score += 10; game.energy = Math.min(ENERGY_MAX, game.energy + MANGO_ENERGY); addPoints('pickup');
    sound.play.goal(); fx.burst(m.mesh.position, [0xffc21a, 0xfff1a0], 12); lastHud = ''; drawQuest();
    const opened = world.gateBars.set(escape.found);
    if (opened) { toast(`${escape.found} mangoes: a gate opens!`, 'good'); sound.play.powerup(); catcher.forget(); }
    if (escape.found === MANGO_NEED) { toast('All the gates are open! Find the chest!', 'good'); bubbles.say(wally.root, 'Now, where is that chest?', 3); }
  }
  const c = escape.chest, near = Math.hypot(wally.pos.x - escape.chestAt.x, wally.pos.z - escape.chestAt.z) < 2.6;
  if (near && !escape.giant) {
    if (escape.found >= MANGO_NEED) {
      escape.giant = true; carried.add('golden-mango', { id: 'giant-mango' }); lastHud = ''; drawQuest(); sound.play.goal(); fx.burst(c.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), [0xffc21a, 0xfff1a0, 0xff8a30], 40);
      toast("The King's Golden Mango! Show it to the wrangler!", 'good'); bubbles.say(wally.root, 'He needs to see this.', 3);
    } else if (t > escape.hintAt) { escape.hintAt = t + 4; toast(`Locked until all the gates are open: ${MANGO_NEED - escape.found} more mangoes`, 'bad'); }
  }
  if (escape.giant && escape.open < 1) { escape.open = Math.min(1, escape.open + dt * 1.5); c.lid.rotation.x = -escape.open * 1.9; c.glow.intensity = escape.open * 6; c.mango.visible = true; }
  if (c.mango.visible) { c.mango.rotation.y += dt * 2; c.mango.position.y = 1.2 + escape.open * 0.9 + Math.sin(t * 2) * 0.12; escape.shown = (escape.shown || 0) + dt; if (escape.shown > PRIZE_ON_SHOW) c.mango.visible = false; }
}

// Back on land with the key, Kenny tells him what comes next (Ken, 2026-10-30).
function kennyTells() {
  game.kennyTold = true;
  wally.vel.set(0, 0, 0);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z), f = wally.facing;
  kenny.pos.set(wally.pos.x + Math.sin(f) * 2.1 + Math.cos(f) * 0.5, wally.pos.y, wally.pos.z + Math.cos(f) * 2.1 - Math.sin(f) * 0.5);
  kenny.mesh.position.copy(kenny.pos); kenny.mesh.visible = true; kenny.state = 'sit'; kenny.timer = 40;
  kenny.mesh.rotation.y = Math.atan2(wally.pos.x - kenny.pos.x, wally.pos.z - kenny.pos.z);
  wally.root.rotation.y = wally.facing;
  const mid = wally.pos.clone().lerp(kenny.pos, 0.5).add(V3(0, 1.1, 0)), sx = Math.cos(f), sz = -Math.sin(f);
  // The camera on the side with nothing big in the way: a boulder hid them both, when he came ashore beside one.
  const blockedAt = side => ROCKS.some(r => { for (let d = 1; d <= 7; d++) if (Math.hypot(mid.x + sx * side * d - r.x, mid.z + sz * side * d - r.z) < r.r + 0.8) return true; return false; });
  const clear = !blockedAt(1) ? 1 : -1;
  const talk = (a, b) => ({ from: V3(mid.x + sx * clear * Math.abs(a), mid.y + 0.6, mid.z + sz * clear * Math.abs(a)), to: V3(mid.x + sx * clear * Math.abs(b), mid.y + 0.4, mid.z + sz * clear * Math.abs(b)), lookFrom: mid, lookTo: mid });
  const bridge = V3(GATE.x, deckHeight(GATE.x) + 1.5, GATE.z);
  escapeScene.play([
    { s: 3.6, who: 'Kenny', line: "Good on ya, Wally! Now cross the bridge to the park.", ...talk(6, 5) },
    { s: 4.2, who: 'Kenny', line: 'Watch out! The park will be alerted the moment you leave the croc enclosure.', from: V3(GATE.x - 12, bridge.y + 3, GATE.z + 9), to: V3(GATE.x - 8, bridge.y + 1.5, GATE.z + 7), lookFrom: bridge, lookTo: bridge },
    { s: 4.2, who: 'Kenny', line: 'Dodge the croc wrangler while you collect mangoes. Mangoes unlock the gates.', ...talk(-5, -6) },
    { s: 4, who: 'Kenny', line: "Once all the gates are open, find the chest. Inside is the Golden Mango, one of the Croc King's crown jewels.", ...talk(-6, -4.5) },
    { s: 4.4, who: 'Kenny', line: "Show it to the wrangler. He'll know what it means, and unlock the final gate to the cane field.", ...talk(4.5, 5.5) },
    { s: 3.4, who: 'Kenny', line: 'But if he catches you first, you end up back in the croc enclosure!', ...talk(5.5, 3.6) },
  ], () => { $('hud').hidden = false; $('touch').hidden = !touch; kenny.timer = 1.5; bubbles.say(wally.root, "Right! Over the bridge.", 3); }, { siren: false });
  $('hud').hidden = true; $('touch').hidden = true;
}

// The golden mango shown to the wrangler (Ken, 2026-10-30): only a croc summoned by the Croc King could get it, so he
// is not bribed, he understands. Wally keeps it with the sceptre until he first meets the King, in the Daintree; and the
// wrangler unlocks the final gate.
// It rides on his back beside the sceptre from now on.
let goldenOnBack = null;
function wearGoldenMango() {
  if (goldenOnBack) { goldenOnBack.visible = true; return; }
  goldenOnBack = crownJewel(); goldenOnBack.scale.multiplyScalar(1.2);
  goldenOnBack.position.set(-0.22, 1.2, -0.42); wally.root.add(goldenOnBack);
}
function giveMango() {
  escape.given = true; lastHud = ''; drawQuest();
  attempt = Trip.gain(attempt, 'kings-golden-mango');
  wearGoldenMango();
  wally.vel.set(0, 0, 0); sound.play.goal(); game.score += 500; catcher.state.mode = 'search'; catcher.state.helper = true; catcher.state.last = { x: catcher.state.x, z: catcher.state.z }; catcher.state.hold = 0;
  catcher.state.heading = Math.atan2(wally.pos.x - catcher.pos.x, wally.pos.z - catcher.pos.z);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z), him = catcher.pos.clone().add(V3(0, 1.5, 0)), dx = him.x - wally.pos.x, dz = him.z - wally.pos.z, d = Math.hypot(dx, dz) || 1, sx = dz / d, sz = -dx / d;
  const mid = him.clone().lerp(wally.pos.clone().add(V3(0, 1.5, 0)), 0.5), gate = V3(EXIT.x, BANK_Y + 1.4, EXIT.z), o = Math.hypot(EXIT.x, EXIT.z), inX = -EXIT.x / o, inZ = -EXIT.z / o;
  const close = { from: V3(mid.x + sx * 7.5, mid.y + 0.5, mid.z + sz * 7.5), to: V3(mid.x + sx * 6, mid.y + 0.2, mid.z + sz * 6), lookFrom: mid, lookTo: mid };
  escapeScene.play([
    { s: 3.6, who: 'Croc Wrangler', line: "Crikey! The King's Golden Mango! Only a croc summoned by the Croc King could get that.", ...close },
    { s: 3.6, who: 'Croc Wrangler', line: 'It is one of his crown jewels. Bring it to him in the Daintree, as a token of bravery.', ...close },
    { s: 3, who: 'Croc Wrangler', line: "You've proved yourself, mate. Keep it with the sceptre. Come on, I'll unlock the final gate!", ...close },
    { s: 2.6, line: 'The final gate is open. The cane field awaits!', cue: () => { world.finalGate.open(); sound.play.powerup(); }, from: V3(gate.x + inX * 11, gate.y + 2, gate.z + inZ * 11), to: V3(gate.x + inX * 7, gate.y + 0.8, gate.z + inZ * 7), lookFrom: gate, lookTo: gate },
    { s: 3.6, who: 'Croc Wrangler', line: "I'm letting you out into the cane fields. No one will pursue you in there.", ...close },
    { s: 3.6, who: 'Croc Wrangler', line: 'Look for a chest. It holds an item to help you complete your journey.', ...close },
    { s: 4, who: 'Croc Wrangler', line: 'But look out for the cane toads, and eat the fallen sugar cane, or you will lose your puff!', ...close },
  ], () => { $('hud').hidden = false; $('touch').hidden = !touch; catcher.helps({ x: EXIT_SPOT.x + inX * 3 + inZ * 3.5, z: EXIT_SPOT.z + inZ * 3 - inX * 3.5 }); bubbles.say(catcher.g, 'This way, mate!', 2.6); bubbles.say(wally.root, 'Ta, mate! Cane fields, here I come!', 3); }, { siren: false });
  $('hud').hidden = true; $('touch').hidden = true;
}

// Out past the croc fence: the grounds are his now, and the catcher heard the gate.
function breakOut() {
  setParkMode('outside'); game.out = true; lastHud = '';
  wally.vel.set(0, 0, 0);
  if (escape.on) {                                                  // caught, and out again: he is on Wally's heels
    drawQuest(); catcher.alertAgain(wally.pos, game.caught || 0); sound.play.whistle();
    bubbles.say(catcher.g, 'Oh no you don\'t!', 2.2);
    return;
  }
  escape.begin();
  drawQuest();
  // The cut scene, then the race. Everything is set up as the shots need it, and the wrangler starts once it ends.
  catcher.alert(wally.pos, 1e9);
  const eye = wally.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), post = catcher.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  escapeScene.play([
    { s: 2.6, big: true, line: 'CROC ESCAPE!', cue: () => sound.play.whistle(), from: V3(eye.x + 4, eye.y + 0.4, eye.z + 6), to: V3(eye.x + 7, eye.y + 1, eye.z + 3), lookFrom: eye, lookTo: eye },
    { s: 3.2, who: 'Croc Wrangler', line: "Oi! A croc's out! I'm right behind him!", cue: () => { sound.play.whistle(); catcher.state.heading = -Math.PI / 2; }, from: V3(post.x - 5, post.y + 0.3, post.z + 3.5), to: V3(post.x - 2.8, post.y, post.z + 2), lookFrom: post, lookTo: post },
    { s: 3.6, line: 'The park locks down. Mangoes unlock the gates: dodge him and collect them!', cue: () => { world.lockdown(true); catcher.forget(); tourists.clearOfWalls(); }, from: V3(34, 44, 66), to: V3(-14, 42, 66), lookFrom: V3(6, 0, 8), lookTo: V3(-8, 0, 14) },
    { s: 1.4, big: true, line: 'RUN!', from: V3(eye.x - 9, eye.y + 3, eye.z), to: V3(eye.x - 5, eye.y + 1.4, eye.z), lookFrom: eye, lookTo: eye },
  ], () => {
    $('hud').hidden = false; $('touch').hidden = !touch;
    catcher.alert(wally.pos, HEAD_START);
    bossBanner();
    bubbles.say(catcher.g, 'Oi! Come back here!', 2.6);
  });
  $('hud').hidden = true; $('touch').hidden = true;
  if (game.chaseTest) escapeScene.end();                            // (the test shortcut goes straight to the race)
}
// The catcher every frame: spotting Wally, losing him, catching him. Caught, Wally is put back inside the
// gate without losing a life (Ken), the gate still open, and the catcher walks back to his post.
function chaseStep(dt) {
  // With the golden mango, meeting him is what Wally wants: he sees it, and understands. After that he is on Wally's side.
  if (escape.on && escape.giant && !escape.given && game.out && Math.hypot(wally.pos.x - catcher.pos.x, wally.pos.z - catcher.pos.z) < GIVE_REACH) { giveMango(); return; }
  const e = catcher.update(dt, { x: wally.pos.x, z: wally.pos.z, out: game.out && !escape.given, high: wally.pos.y > BANK_Y + 1 });
  if (e === 'spotted') { sound.play.whistle(); bubbles.say(catcher.g, pickLine('catcherSpotted'), 2.2); }
  else if (e === 'lost' && game.out && !escape.given) bubbles.say(wally.root, 'Phew! Lost him.', 2.2);
  else if (e === 'caught') {
    game.out = false; setParkMode('gate'); game.caught = (game.caught || 0) + 1; lastHud = ''; drawQuest();
    wally.pos.set(GATE.x - 3, deckHeight(GATE.x - 3), GATE.z); wally.vel.set(0, 0, 0); wally.vy = 0; wally.facing = Math.PI / 2;
    catcher.reset();
    sound.play.lose();
    toast('The wrangler got you! Back in the sanctuary. You keep your mangoes: out the gate again!', 'bad');
    bubbles.say(wally.root, 'Strewth! Again!', 2.6);
  }
}

// The machete (models/machete.glb), there at the gate once it is unlocked: what the
// cane fields will need (trip-rules.js: what Croc Park opens).
const machete = (() => {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const k = models.get('machete');
  const m = k ? k.scene.clone(true) : new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.03), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.8 }));
  if (k) { const b = new THREE.Box3().setFromObject(m); m.scale.setScalar(1.7 / Math.max(...b.getSize(new THREE.Vector3()).toArray())); }   // big enough to see from the camera (Ken: it was tiny)
  g.add(m); const glow = new THREE.PointLight(0xfff0c0, 6, 7); glow.position.y = 0.8; g.add(glow);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 3; beam.userData.noAO = true; g.add(beam);                     // a column of light over it, to spot it from across the park
  return {
    out: false, at: g.position,
    // at: where it lies (the way out to the cane, chase-rules.js EXIT_SPOT); left out, by the gate.
    show(at = null) {
      this.out = true; g.visible = true;
      if (at) g.position.set(at.x, Math.max(0, terrainHeight(at.x, at.z)) + 0.6, at.z);
      else g.position.set(GATE.x - Math.sign(GATE.x || 1) * 1.4, deckHeight(GATE.x) + 0.6, GATE.z);
      if (at) { toast("The gate's open! Get out, and find the way to the cane fields", 'good'); sound.play.goal(); bubbles.say(wally.root, "I'm off to the cane fields!", 3.4); }
      else { toast('The gate is open! And something left by the gate...', 'good'); sound.play.goal(); bubbles.say(wally.root, "A machete! That'll get me through the cane.", 3.4); }
    },
    // True once he has picked it up.
    update(dt) {
      g.rotation.y += dt * 1.5;
      return Math.hypot(g.position.x - wally.pos.x, g.position.z - wally.pos.z) < 1.3;
    },
  };
})();

// ---- One frame ------------------------------------------------------------------

let arrow = guideArrow({ show: false });                       // set for the attempt when play starts
// Where each falling piece of food will come down to Wally's mouth height, for the aim help (aim-rules.js).
function landings() {
  const mouthY = wally.mouthPosition().y, out = [];
  for (const it of food.items) {
    for (let ahead = 0; ahead < 2.5; ahead += 0.05) {
      if (it.v.y - 9.8 * (it.t + ahead) >= 0) continue;            // still going up
      const p = food.predict(it, ahead);
      if (p.y <= mouthY + 0.3) { out.push({ x: p.x, z: p.z }); break; }
    }
  }
  return out;
}
const bot = params.has('bot') ? makeBot() : null;

function step(dt, t) {
  if (opening.active) { openingStep(dt, t); return; }
  if (game.intro > 0) { introStep(dt); return; }
  if (escapeScene.active) { input.read(); clusters.idle(dt); escapeScene.step(dt); if (kenny.skin) { kenny.skin.play('wave', { alternatives: ['idle'] }); kenny.skin.update(dt); } catcher.update(dt, { x: wally.pos.x, z: wally.pos.z, out: false }); return; }
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
  // Aim help on the keyboard (aim-rules.js): the turn slows as he comes onto nearby food, and while he runs his
  // heading leans gently toward food close ahead.
  if (k.steer) {
    const land = landings();
    k.right *= aimSlow({ pos: wally.pos, facing: wally.facing, turning: k.right, landings: land });
    if (k.forward > 0) k.aim = (k.aim || 0) + aimTurn({ pos: wally.pos, facing: wally.facing, running: true, landings: land, dt });
  }
  for (const e of wally.update(dt, k, cam.yaw, pace)) {
    if (e === 'leap') { sound.play.leap(); fx.splash(wally.pos, 22); } else if (e === 'jump') sound.play.jump();
    else if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 26); fx.shake(0.2, 0.15); } else if (e === 'land') sound.play.land();
  }
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (game.boost <= 0 && game.nap <= 0) game.energy -= energyDrain(wally.mode, moving, 'park') * drainFactor() * game.tripDrain * (game.out ? OUT_DRAIN : 1) * dt;   // vitamins (gear.js) halve it; the trip's difficulty sets the speed
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
    if (game.streak === 0) toast('Flying fox!', 'bad'); if (reaction()) bubbles.say(wally.root, pickLine('wallyBat'), 3.4);
  }
  for (const it of pelicans.update(dt, food, wally.pos)) {
    food.take(it, 'eaten'); game.stolen++; game.by.pelican++; sound.play.stolen(); thiefTip();
    toast(`A pelican scooped the ${it.name}!`, 'bad'); game.streak = 0; if (reaction()) bubbles.say(wally.root, pickLine('wallyBird'), 3.4);
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
    toast(`${croc.name} got the ${item.name}!`, 'bad'); game.streak = 0; if (reaction()) bubbles.say(wally.root, pickLine('wallyCroc'), 3.4);
    if (Math.random() < 0.5) bubbles.say(wally.root, pickLine('wallyStolen'), 3.6);
  }
  checkCatches();

  const sting = jellies.update(dt, t, wally.pos, wally.surface === 'water', wally.pos.y);
  if (sting && game.stingCool <= 0) {
    game.stingCool = 1.5; game.energy -= 15; game.streak = 0; bookEvent('hurt');
    game.wantDepth = PARK_TREASURE.surfaceY;                     // stung under water: back up he goes
    wally.knock(sting.pos.x, sting.pos.z);
    fx.shake(0.45, 0.3);
    sound.play.sting(); toast('Box jelly! Ouch!', 'bad'); if (reaction()) bubbles.say(wally.root, pickLine('wallySting'), 3.4);
    bubbles.say(wally.root, pickLine('wallySting'), 3.6);
  }

  treasureStep(dt, t);
  for (const f of hidden.update(dt, t, wally.pos)) { toast(f.text, 'good'); sound.play.powerup(); }

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
  chaseStep(dt);
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
    sound.play.sting(); toast(`${biter.name} snapped at you! Up you go`, 'bad'); if (reaction()) bubbles.say(wally.root, pickLine('wallyBite'), 3.4);
    bubbles.say(wally.root, 'Strewth! Back off, mate!', 3.6);
  }
  for (const e of treasure.update(dt, t, wally.pos.x, wally.pos.z, wally.pos.y)) {
    if (e.type === 'found') {
      bookEvent('lostThing');
      game.quest.record('lostThing');
      sound.play.goal(); game.score += 50;
      const left = treasure.total - treasure.found;
      toast(left ? `Found: ${e.thing.name}! ${left} more down here` : `Found: ${e.thing.name}! That's the lot: now the chest`, 'good');
      if (!left) bubbles.say(wally.root, "Crikey, that's everything! Now for that chest!", 3.6);
      drawQuest();
    } else if (e.type === 'open') {
      bookEvent('chest');
      game.score += 500; sound.play.powerup();
      game.quest.record('chestOpened');
      if (!game.hasKey) { game.hasKey = true; carried.add('key', { label: 'Park key' }); attempt = Trip.gain(attempt, 'park-key'); addPoints('pickup'); toast('The key to the park!', 'good'); bubbles.say(wally.root, 'Got it! Now, out the gate.', 3.6); }
      drawQuest();
    }
  }
  // A nudge toward it, soon after he starts, if he has not found anything yet.
  game.treasureHint -= dt;
  if (game.time > 12 && treasure.found === 0 && !game.hasKey && game.treasureHint <= 0) {
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
  // The first task: the on-screen arrow points to the sceptre too, with how far.
  if (arrow) arrow.update(opening.phase === 'croc' ? { x: opening.sceptreAt.x, z: opening.sceptreAt.z, label: 'The sceptre (dive down)' } : null, wally.pos, cam.yaw);
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
  toast(`Wally's knackered! ${game.lives} ${game.lives === 1 ? 'life' : 'lives'} left. Here comes Kenny!`, 'bad'); if (reaction()) bubbles.say(wally.root, pickLine('wallyTired'), 3);
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

// In the water the view is his own (eyes.js). Not in a VR headset, where the headset is the camera, nor while Kenny revives him.
const CROC_ON_SHOW = 5;
const eyes = createEyes({ camera, wally, cam, canvas });
window.chomp.eyes = eyes;
function diveView(dt) {
  // At the start of the game (Ken, 2026-10-30) he is a regular croc, and has to be seen as one: the cinematic has the
  // camera, then he is on show a few seconds before the view becomes his own (at once, if he dives).
  const under = game.depth < PARK_TREASURE.surfaceY - 0.6;
  const shown = !opening.active || (opening.phase === 'croc' && (opening.phaseTime > CROC_ON_SHOW || under));
  eyes.step(dt, game.running && !inVR() && shown && wally.surface === 'water' && game.nap <= 0, under);
}
const CAM_ZONE = 0.6;     // radians (about 35 degrees) he may turn either way before the camera turns with him
function followCamera(dt) {
  if (escapeScene.active) { eyes.off(); escapeScene.place(); focusOn(camera, wally.pos.x, wally.pos.y + 1.2, wally.pos.z); return; }
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
    } else if (cam.manual <= 0 && cam.still > 2.5 && !wally.airborne && settings.camera !== 'manual') {
      // Standing about: drift round to a three-quarter view of his face.
      const want = wally.facing + 0.7;
      const d = Math.atan2(Math.sin(want - cam.yaw), Math.cos(want - cam.yaw));
      cam.yaw += d * Math.min(1, dt * 0.8);
    } else if (cam.manual <= 0) {
      // The leash: keep the camera where it was and let Wally pull it round.
      const dx = camera.position.x - cam.target.x, dz = camera.position.z - cam.target.z;
      // Steering (the default): the camera swings round behind him as he turns.
      // A calm camera (Ken, 2026-10-26: swinging with every wiggle can make people sick). It always follows
      // where he is, so he stays on screen, but it only turns once he heads well off to one side (more than
      // CAM_ZONE from straight away from it), and then gently, just enough to bring him back inside.
      if (settings.camera === 'manual') { /* the manual camera turns only when the player turns it */ }
      else if (steering()) {
        const behind = wally.facing + Math.PI, off = Math.atan2(Math.sin(behind - cam.yaw), Math.cos(behind - cam.yaw));
        if (Math.abs(off) > CAM_ZONE) cam.yaw += (off - Math.sign(off) * CAM_ZONE) * Math.min(1, dt * 2);
      }
      else cam.yaw = lazyBehind(cam.yaw, wally, dt);
    }
  }
  const cp = Math.cos(cam.pitch);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist,
                      cam.target.y + Math.sin(cam.pitch) * cam.dist,
                      cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
  const floor = Math.max(0, terrainHeight(camera.position.x, camera.position.z)) + 0.8;
  if (camera.position.y < floor) camera.position.y = floor;
  camera.lookAt(cam.target);
  diveView(dt);
  const jolt = fx.shakeOffset(dt);
  if (jolt) camera.position.add(jolt);
  focusOn(camera, wally.pos.x, wally.pos.y + 1.2, wally.pos.z);   // the bridge dissolves if it is in the way of him (see-through.js)
}

// ---- Start, pause, end ------------------------------------------------------------

// The food thieves on the gentle first visit (park-ease.js): each kind's list is cut to how many
// have turned up, by how many groups Wally has fed out, and the rest wait out of sight. The croc
// guarding the treasure is always there. On a return visit they are all there from the start.
let ease = parkEase(2);
const thiefSets = { pelican: pelicans, bat: bats, toad: toads, croc: crocs };
const thiefAll = Object.fromEntries(Object.entries(thiefSets).map(([k, s]) => [k, s.list.slice()]));
const thiefShown = {};
function stageThieves() {
  const done = game.groupsDone || 0;
  for (const [kind, set] of Object.entries(thiefSets)) {
    const all = thiefAll[kind].filter(x => !x.guard), guards = thiefAll[kind].filter(x => x.guard);
    const n = thievesAllowed(kind, done, all.length, ease.first);
    if (thiefShown[kind] === n) continue;
    if (thiefShown[kind] !== undefined && n > thiefShown[kind]) toast(ARRIVAL_LINES[kind], 'info');
    thiefShown[kind] = n;
    set.list = [...all.slice(0, n), ...guards];
    for (const x of thiefAll[kind]) (x.mesh || x.parts.g).visible = set.list.includes(x);
  }
}

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
  attempt = Trip.startAttempt(progress.trip, 'park'); startRun('park', { level: attempt.level });
  arrow = guideArrow({ show: attempt.visit === 1 });          // where to go next, on the first visit
  carried.clear(); if (goldenOnBack) goldenOnBack.visible = false; game.kennyTold = false; game.caught = 0; game.out = false; setParkMode('park'); world.lockdown(false); escape.clear(); catcher.forget(); catcher.reset(); game.groupsDone = 0;
  game.quest = createQuest(escapeQuest());
  game.hasKey = Trip.have(progress.trip, 'park-key') || Trip.have(progress.trip, 'gate-key');   // on a return visit he has it already (gate-key: saves from before)
  game.hadKey = game.hasKey;                                   // come back with the key: nothing to find, the gate is his
  if (game.hadKey) { for (const g of game.quest.goals) for (let i = 0; i < g.need; i++) game.quest.record(g.event); }
  game.tripDrain = Trip.drainFactor(progress.trip, 'park', attempt.level);
  // The first visit starts gentle and builds (park-ease.js); a return visit plays as the trip says.
  ease = parkEase(attempt.visit);
  if (ease.first) {
    game.tripDrain = Math.min(game.tripDrain, ease.drain);
    game.parkGroups = ease.groups;
    game.throwPace = ease.throwPace; clusters.calm = ease.calm; clusters.panic = ease.panic;
  }
  stageThieves();
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
    if (!game.caught) bookEvent('bossClean');                   // got away from the wrangler without being caught once
    const done = Trip.completeAttempt(progress.trip, Trip.gain(attempt, 'machete'), { objectiveMet: true });
    if (done.ok) { progress.trip = done.trip; bankRun({ stars }); }
    progress = completeArea(progress, 'park', { score: game.score, stars });
    try { localStorage.setItem('chomp-progress', JSON.stringify(progress)); } catch { /* not saved */ }
    $('win-score').textContent = game.score.toLocaleString();
    $('win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('win-postcard').textContent = POSTCARDS.park;
    $('next-area').textContent = nextArea('park').name;
    markRetry(true, 'Croc Park', 'win');                         // completed: continue, redo, save, new game
    $('win').hidden = false;
    showLeaderboard($('win-board'), 'park', game.score, stars);   // post the score, show the top ten
  } else {
    sound.play.lose();
    progress.trip = Trip.failAttempt(progress.trip, attempt).trip;       // nothing from this attempt is kept (trip-rules.js)
    failRun();                                                         // nothing from this run is kept, points included (points.js)
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

// The map over the park before any play (index.html?map, 'Back to the map'). Closed without picking a
// place (the X, outside it, Back to the game), what it covered comes back: the title screen to press
// Play on (Ken, 2026-10-21: closing it with the X left the camera circling and no Wally).
let underMap = [];
function showMap() {
  underMap = ['title', 'win', 'over'].filter(id => !$(id).hidden);
  $('title').hidden = true; $('win').hidden = true; $('over').hidden = true;
  openMap();
}
window.chompMapClosed = () => {
  if (game.running) return;
  for (const id of underMap.length ? underMap : ['title']) $(id).hidden = false;
  underMap = [];
};

// The opener: How to play opens the instructions over the art; Got it closes them.
$('how').onclick = () => { location.href = 'how-to-play.html'; };   // its own page (Ken: not a pop-up)
// The version playing, on the title screen (Ken, 2026-10-21), so a tester can say which one: written by
// each publish (version.json); on this computer there is none, and nothing shows.
fetch('version.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(v => { if (v && v.number) $('title-version').textContent = v.number.includes('beta') ? `Beta · version ${v.number}` : `Version ${v.number}`; }).catch(() => {});
// The front screen is the title, with its one Play button (Ken, 2026-10-21: the landing page only got in
// the way). Installed as an app, it leaves out the trailer and the install button.
if (isApp()) document.body.classList.add('as-app');
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
// Play goes straight into the game (Ken, 2026-10-21: two or three buttons before play was too many).
// A new game: the difficulty is chosen beside Play (Intermediate unless changed), then Croc Park
// begins. A trip under way: on to the next place not yet completed. The map is still on its button.
const newGame = () => !progress.trip && !progress.postcards.length && !Object.keys(progress.stars).length;
let pickedLevel = 'intermediate';
if (newGame()) $('pick-level').hidden = false;
for (const b of $('pick-level').querySelectorAll('button')) b.onclick = () => {
  pickedLevel = b.dataset.level;
  for (const o of $('pick-level').querySelectorAll('button')) { o.classList.toggle('on', o === b); o.setAttribute('aria-checked', String(o === b)); }
};
function nextStop() {
  let visited = []; try { visited = JSON.parse(localStorage.getItem('chomp-visited') || '[]'); } catch { /* none yet */ }
  const done = (progress.trip && progress.trip.completed) || [];
  return AREAS.find(a => a.ready && !done.includes(a.id) && mapActive(progress, visited, a.id));
}
$('play').onclick = () => {
  sound.start(); sound.startMusic('theme'); sound.moodMusic('theme');
  if (newGame()) ensureTrip(pickedLevel);
  const next = nextStop();
  if (!next || next.id === 'park') { $('title').hidden = true; start(); return; }
  const page = pageFor(next.id);
  location.href = page + (page.includes('?') ? '&go' : '?go');
};
$('to-map').onclick = () => location.href = 'index.html?map';
$('resume').onclick = () => setPaused(false);
$('again').onclick = restart;
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
  world.update(t, dt, game.quest.gateOpen() && game.hasKey, camera);
  bubbles.update(dt);
  fx.update(dt, t);
  if (!game.running && !game.paused) { cam.yaw += dt * 0.08; }     // slow turn behind the title screen
  followCamera(dt);
  const night = daynight.update(game.paused ? 0 : dt, camera);
  lamps.update(dt, night, wally.pos);
  fpsWatch.focus(opening.phase === 'intro');      // the spiral is the test (Ken): smooth, or the detail comes down
  fpsWatch(dt);
  // Once a frame: every object's place, then the water's reflection, then the picture (world.js says why).
  scene.updateMatrixWorld();
  if (inVR()) world.reflectInside(); else world.reflectFirst(renderer, camera);
  post.render();
  if (!inVR()) requestAnimationFrame(frame);   // in a VR headset, the headset sets the pace (vr.js)
}
installVR({ renderer, scene, camera, frame });   // a VR headset, if there is one (vr.js)
requestAnimationFrame(frame);
if (params.has('play') || bot) start();
else if (params.has('map')) showMap();
// Testing the chase (index.html?play&chase&noopening): Wally starts on the boardwalk just past the gate with
// the key, as if every group were fed, and steps out into the grounds.
if (params.has('chase') && game.running) {
  game.chaseTest = true; game.hasKey = true; setParkMode('gate'); machete.show(EXIT_SPOT);
  wally.pos.set(GATE.x + 8, deckHeight(GATE.x + 8), GATE.z); wally.facing = Math.PI / 2;
}

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
