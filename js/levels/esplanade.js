// esplanade.js
// The Esplanade. Wally has the run of the Cairns Esplanade boardwalk: up and
// down it, and off the side into the ocean for a swim. The picnic groups along
// the city side throw lunch when he is in the sweet spot and bolt if he crowds
// them. Bins, benches, pelicans and fig branches are in the way, joggers come
// and go, and there are stingers in the water. Feed out every group, fill the
// feed-o-meter, and the Lagoon pool at the end is the way on. Fed-out groups
// leave pearls, which carry on to the Great Barrier Reef. In the sea he can
// swim under water (air meter) and crawl back up onto the boardwalk.

import { guideArrow, nearest } from '../guide-arrow.js';
import { installVR, inVR } from '../vr.js';
import { createEyes } from '../eyes.js';
import { carried } from '../carried.js';
import { startRun, addPoints, bankRun, failRun } from '../points.js';
import { foundTalisman } from '../revisit.js';
import { fitText } from '../signtext.js';
import { installGear, snorkelling, drainFactor } from '../gear.js';
import { showTip } from '../tips.js';
import * as Trip from '../trip-rules.js';
import { chestModel } from '../chest.js';
import * as THREE from 'three';
import { Wally } from '../wally.js';
import { Food, kindFor, kennysToast, useJarModel, useToastModel } from '../food.js';
import { Input, steering, easeBehind, lazyBehind } from '../input.js';
import { Bubbles, reaction, pickLine, chatty } from '../bubbles.js';
import { Effects, CRUMBS } from '../fx.js';
import { loadModels, dress, ModelSkin } from '../models.js';
import { usePalmCrown } from '../palms.js';
import { createPost } from '../post.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { areaIntro, courseShots } from '../area-intro.js';
import { installMap, recordVisit, markRetry } from '../mapmodal.js';
import { installShop } from '../shopmodal.js';
import { showLeaderboard } from '../leaderboard.js';
import { dressOutfit } from '../outfit.js';
import { loadRealism } from '../realism.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, LIVES, REVIVE_ENERGY, inRedZone, aimOffset } from '../rules.js';
import { FULL } from '../quests.js';
import { HumanoidPoser } from '../rig.js';
import { dressedJelly } from '../hazards.js';
import { completeArea, readProgress, starsFor, POSTCARDS, wearing, outfitModel, openPier, PROGRESS_CHANGED, saveProgress } from '../progress.js';
import { installBook, bookEvent, HiddenFinds, openBook } from '../book.js';
import { startTrading, tradeStep } from '../trade.js';
import { startQuest, questStep } from '../sidequest.js';
import { DayNight } from '../daynight.js';
import { StreetLamps } from '../lamps.js';
import { PATH, generateCourse, hits, runScore, STARS, MANGO_SET_BONUS, SPUR, onSpur } from './esplanade-rules.js';
import { buildEsplanade, obstacleModel, mangoModel, useMangoModel } from './esplanade-scene.js';
import { Clusters } from '../clusters.js';
import { peopleModels } from '../tourists.js';
import { airStep, AIR } from './reef-rules.js';
import { clamWithPearl } from './reef-scene.js';
import { kennysJar } from '../food.js';
import { jarLabelTexture } from '../textures.js';
import { toast as toast_ } from '../toast.js';

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
// Swimming under the sea beside the boardwalk: Shift goes under, Space comes up.
// The sea's own ground reads seaDive, so it is declared before the ground.
const SEA_FLOOR = -5.5, SEA_SWIM = -2.6, SEA_TOP = -0.45;
const seaDive = { under: false, depth: SEA_TOP };
let poolOpen = () => false;              // set below, once the game state exists
let pierOpen = () => false;              // the pier: open once paid for in mangoes (set below)
const landGround = {
  stand(x, z, feetY) {
    if (inPool(x, z)) return { y: POOL_WATER - 0.45, surface: 'water' };
    if (onSpur(x, z) && pierOpen() && feetY >= G - 0.35) return { y: G, surface: 'deck' };   // out on the pier
    if (inSea(x, z)) return { y: seaDive.depth, surface: 'water' };
    if (feetY < G - 0.35) return { y: seaDive.depth, surface: 'water' };   // in the water right against the boardwalk
    return { y: G, surface: Math.abs(x) <= PATH.half ? 'deck' : 'land' };
  },
  move(x, z, nx, nz, y) {
    if (inPool(nx, nz) && !poolOpen()) nz = Math.min(nz, POOL_Z + 0.5);       // the Lagoon opens when the job is done
    // The pier: shut, there is no way on (gate from the walk, piles from the sea);
    // open, its deck is walked like the boardwalk.
    if (onSpur(nx, nz) && !onSpur(x, z) && !pierOpen()) return { x, z };
    if (onSpur(x, z) && pierOpen() && y >= G - 0.35) {
      const sx = Math.max(-PATH.half - SPUR.length + 0.4, Math.min(PATH.half - 0.4, nx));
      const sz = sx < -PATH.half ? Math.max(SPUR.z - SPUR.half + 0.35, Math.min(SPUR.z + SPUR.half - 0.35, nz)) : nz;
      return { x: sx, z: sz };
    }
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

// The Wally model to use: his own, or the model of a complete outfit he is wearing.
function wallyModelName() {
  return outfitModel(readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()));
}
const wally = new Wally(scene);
// The first visit: back along the boardwalk from past the pier, down to Wally at the start.
const intro = areaIntro({
  id: 'esplanade', name: 'The Esplanade', place: 'Cairns, on the waterfront', focus: on => fpsWatch.focus(on),
  shots: () => courseShots({ from: { x: 0, z: 280 }, to: { x: wally.pos.x, z: wally.pos.z - 10 }, y: PATH.ground, height: 44, side: 26 }),
});
wally.facing = 0;                                     // facing down the boardwalk
wally.useModel(models.get(wallyModelName()) || models.get('wally'));   // a garment outfit has its own fitted Wally model
{ const p0 = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
  if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(p0, 'wally')); }   // clothes from the Kuranda markets
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
// The joggers are Ken's people, running (Ken, 2026-10-21: they were the early stand-in figures). Adults
// only, each at a height in their own range; the simple figure stays only if no people models loaded.
{
  const runners = peopleModels(models).filter(g => (g.userData.tall || [1.6])[0] >= 1.5);
  obstacles.filter(o => o.kind === 'jogger').forEach((o, i) => {
    if (!runners.length) return;
    const gltf = runners[(i * 7 + 3) % runners.length], [lo, hi] = gltf.userData.tall || [1.65, 1.8];
    const skin = new ModelSkin(gltf, { height: lo + Math.random() * (hi - lo) });
    if (!skin.has('run') && !skin.has('walk')) return;
    const P = o.mesh.userData.person; if (P) o.mesh.remove(P.g);
    o.mesh.userData.person = null; o.mesh.userData.skin = skin; o.mesh.add(skin.root);
    skin.play('run', { alternatives: ['walk'] });
  });
}
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
clusters.useModels(peopleModels(models));   // Ken's people

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
  if (kennySkin) dressOutfit(kennySkin.root, 'kenny', wearing(readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()), 'kenny'));   // his vest from the markets
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
// The on-screen Dive and Up buttons (the same as Shift and Space under water).
for (const [id, flag] of [['b-dive', 'diveQueued'], ['b-up', 'upQueued']]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); game[flag] = true; });
}
input.onMute = () => toast_('Sound ' + (sound.toggleMute() ? 'off' : 'on'), 'info');

let progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
// The trip's rules (trip-rules.js): the gate key from Croc Park to come in the
// first time (?all opens it, for testing); this go's level sets the mango target,
// the pier price and the meter speed.
if (!progress.trip) { progress.trip = Trip.tripFor(progress); saveProgress(progress); }
const entry = Trip.canEnter(progress.trip, 'esplanade'), testingAll = params.has('all');
let attempt = Trip.startAttempt(progress.trip, 'esplanade', { force: true }); startRun('esplanade', { level: attempt.level });
const arrow = guideArrow({ show: attempt.visit === 1 });
const PIER_MANGOES = 8;                              // the pier's full price (each go's price is a share of it)
// This go's level: the mango target for the chest (a share of this course's
// mangoes, rounded up) and the pier price (the same share of its full price).
const mangoTarget = Trip.target(mangoes.length, attempt.level);
const pierPrice = Trip.target(PIER_MANGOES, attempt.level);
addEventListener(PROGRESS_CHANGED, () => { progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); });   // the book, trades and shops write it too
const game = {
  running: false, paused: false, done: false, countdown: 0, time: 0,
  energy: ENERGY_MAX, lives: LIVES, nap: 0, stun: 0, boost: 0, kennyCool: 8, kennyUsed: false,
  points: 0, foodPoints: 0, mangoes: 0, caught: 0, stumbles: 0, streak: 0, hungry: 0, scared: 0,
  groupsDone: 0, groupsTotal: 0, ready: false,
  // In the sea: air while under water, Kenny's rescue, crawling out. Pearls from fed-out groups.
  air: AIR.max, pearls: 0, faint: 0, hint: 0, foursWas: false, climb: 0, upQueued: false, diveQueued: false,
};
window.chomp = { game, wally, food };

// Day and night, and street lamps along the promenade (Ken, 2026-10-18).
const daynight = new DayNight(scene, { sun: world.sun });
const lamps = new StreetLamps(scene, models.get('streetlamp'),
  [...Array.from({ length: Math.floor((PATH.finish - 6) / 16) + 1 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (PATH.half - 0.3), y: PATH.ground, z: 6 + i * 16, rot: i % 2 ? -Math.PI / 2 : Math.PI / 2 })),
   ...[12, 24, 33].map((d, i) => ({ x: -PATH.half - d, y: PATH.ground, z: SPUR.z + (i % 2 ? 1 : -1) * (SPUR.half - 0.15) }))],
  { real: quality.name === 'high' ? 8 : quality.name === 'medium' ? 6 : 4 });
Object.assign(window.chomp, { daynight, lamps });
// Hidden finds (Ken): in the grass on the city side and out on the pier; three a visit.
const hiddenFinds = new HiddenFinds(scene, [
  ...Array.from({ length: 12 }, (_, i) => ({ x: PATH.half + 2 + (i % 3) * 1.8, y: G, z: 20 + i * 36 })),
  { x: -PATH.half - SPUR.length + 1.5, y: G, z: SPUR.z },
]);
window.chomp.hiddenFinds = hiddenFinds;
// Friendly traders (Ken): some picnic groups offer a trade instead of running off.
clusters.enableTraders(0.25);
startTrading({ land: 'esplanade', run: () => ({ mangoes: game.mangoes, pearls: game.pearls }), setRun: r => { game.mangoes = r.mangoes; game.pearls = r.pearls; },
  // Nothing is saved mid-run (trip-rules.js): leaving partway ends the attempt.
  feed: () => { game.energy = ENERGY_MAX; }, say: (c, text) => bubbles.say(c.people[0].g, text, 2.4), toast: text => toast_(text, 'good') });
// A sidequest (Ken): one picnic group has lost something along the waterfront.
startQuest({ land: 'esplanade', scene, clusters,
  spot(where, giver) {
    if (where === 'lampTop') { const ls = lamps.spots.filter(s => Math.abs(s.x) < PATH.half && Math.abs(s.z - giver.root.position.z) < 120); const l = ls[Math.floor(Math.random() * ls.length)] || lamps.spots[0]; return { x: l.x, y: G + 3.4, z: l.z }; }
    if (where === 'pierEnd') return { x: -PATH.half - SPUR.length + 1.5, y: G + 0.45, z: SPUR.z };
    return { x: -PATH.half - 7, y: -0.1, z: giver.root.position.z + 6 };            // floating out past the wall
  },
  feed: () => { game.energy = ENERGY_MAX; }, say: (c, text) => bubbles.say(c ? c.people[0].g : wally.root, text, c ? 2.4 : 3.4), toast: text => toast_(text, 'info') });

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

// ---- The pier (Ken, 2026-10-18) ----------------------------------------------------
// A timber jetty out over the sea from the middle of the timber section. Its
// gate opens once, for pierPrice Golden Mangoes (the
// second land needs what the first gave); pearls lie out along it.
const pier = (() => {
  const g = new THREE.Group(); scene.add(g);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8f6a45, roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: 0x5e4630, roughness: 0.9 });
  const L = SPUR.length, x0 = -PATH.half, xm = x0 - L / 2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.25, SPUR.half * 2), wood); deck.position.set(xm, G - 0.125, SPUR.z); deck.receiveShadow = deck.castShadow = true; g.add(deck);
  for (let i = 0; i < L / 0.6; i++) {                                   // the gaps between the boards
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, SPUR.half * 2), dark); seam.position.set(x0 - 0.3 - i * 0.6, G + 0.005, SPUR.z); g.add(seam);
  }
  const pile = new THREE.CylinderGeometry(0.16, 0.18, G + 5.5, 10);
  for (let x = x0 - 2; x > x0 - L; x -= 3.5) for (const s of [-1, 1]) { const p = new THREE.Mesh(pile, dark); p.position.set(x, (G - 5.5) / 2, SPUR.z + s * (SPUR.half - 0.2)); g.add(p); }
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.08), dark); rail.position.set(xm, G + 0.95, SPUR.z + s * (SPUR.half - 0.05)); g.add(rail);
    for (let x = x0 - 0.5; x > x0 - L; x -= 2.5) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), dark); post.position.set(x, G + 0.5, SPUR.z + s * (SPUR.half - 0.05)); g.add(post); }
  }
  // The gate, two leaves that swing open, and its sign.
  const leaves = [-1, 1].map(s => {
    const hinge = new THREE.Group(); hinge.position.set(x0 - 0.15, G, SPUR.z + s * SPUR.half); g.add(hinge);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, SPUR.half), wood); leaf.position.set(0, 0.6, -s * SPUR.half / 2); hinge.add(leaf);
    return { hinge, s };
  });
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const cx = c.getContext('2d'); cx.fillStyle = '#2f5d50'; cx.fillRect(0, 0, 512, 256); cx.fillStyle = '#fff4d6'; cx.textAlign = 'center';
  fitText(cx, 'The Pier', 256, 95, 460, 64, 'bold {size}px "Trebuchet MS", sans-serif');
  fitText(cx, `Open: ${pierPrice} Golden Mangoes`, 256, 170, 470, 40, '{size}px "Trebuchet MS", sans-serif');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  sign.position.set(x0 + 0.2, G + 2.0, SPUR.z + SPUR.half + 0.4); sign.rotation.y = Math.PI / 2; g.add(sign);
  const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.1), dark); signPost.position.set(x0 + 0.2, G + 1, SPUR.z + SPUR.half + 0.4); g.add(signPost);
  let open = 0, pearlsOut = false;
  return {
    get open() { return progress.pier; },
    // Pearls along the pier, once it is open (one set each visit).
    lay() {
      if (pearlsOut) return; pearlsOut = true;
      for (const d of [10, 20, 31]) {
        const mesh = clamWithPearl(); const x = x0 - d, z = SPUR.z + (d % 2 ? 0.5 : -0.5);
        mesh.position.set(x, G, z); mesh.scale.setScalar(1.4); scene.add(mesh); landPearls.push({ mesh, x, z, taken: false });
      }
    },
    update(dt) {
      const want = progress.pier ? 1 : 0;
      open += Math.sign(want - open) * Math.min(Math.abs(want - open), dt * 1.5);
      for (const L of leaves) L.hinge.rotation.y = L.s * open * 1.6;
    },
  };
})();
pierOpen = () => progress.pier;
if (progress.pier) pier.lay();
let pierHint = 0;
function pierGate(dt) {
  pier.update(dt);
  pierHint -= dt;
  const atGate = wally.pos.x < -PATH.half + 1.4 && Math.abs(wally.pos.z - SPUR.z) < 2.2 && wally.pos.y > G - 0.4;
  if (!atGate || progress.pier || game.pierOpen || pierHint > 0) return;
  pierHint = 4;
  // Opened on this attempt, like a trade: paid with the mangoes he has, those banked and those found on this run
  // (Ken, 2026-10-30: Croc Park has none now), only if the Esplanade is completed; a failed attempt closes it again.
  const has = (progress.mangoes || 0) + game.mangoes;
  if (has >= pierPrice) {
    game.pierOpen = true;
    toast_(`The pier is open! (${pierPrice} Golden Mangoes)`, 'good'); sound.play.powerup(); bookEvent('pier');
    bubbles.say(wally.root, 'Ripper! Pearls out on the pier!', 3.4);
    pier.lay();
  } else toast_(`The pier opens for ${pierPrice} Golden Mangoes (you have ${has})`, 'info');
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
function throwFrom(hand, cluster = null, gentle = false, thrower = null) {
  const flight = gentle ? 0.8 : 1.3 + Math.random() * 0.5;   // up close: a short handout
  // Aimed where he will be (Ken: toward Wally, all reachable), mostly close to him.
  const a = Math.random() * Math.PI * 2, r = aimOffset(Math.random, gentle ? 0.4 : 2.2);
  const tz = wally.pos.z + wally.vel.z * flight * 0.85 + Math.sin(a) * r;
  const tx = Math.max(-PATH.half + 0.8, Math.min(PATH.half - 0.8, wally.pos.x + wally.vel.x * flight * 0.85 + Math.cos(a) * r));
  const ty = G + 2 + (!gentle && Math.random() < 0.3 ? 1.2 : 0);
  return food.throw(kindFor(thrower), hand, launchVelocity(hand, new THREE.Vector3(tx, ty, tz), flight));
}

// ---- One frame --------------------------------------------------------------------
const bot = params.has('bot') ? makeBot() : null;
game.groupsTotal = clusters.list.length;
poolOpen = () => game.ready && game.hasBigMango;

// This go's meter speed (trip-rules.js).
game.tripDrain = Trip.drainFactor(progress.trip, 'esplanade', attempt.level);
if (Trip.have(progress.trip, 'golden-mango')) carried.add('golden-mango', { id: 'giant-mango' });   // for the Croc King (the park, main.js)
game.hasBigMango = Trip.have(progress.trip, 'big-golden-mango');     // on a return visit he has it already
if (game.hasBigMango) carried.add('mango', { id: 'big-mango', label: 'Big Golden Mango' });

// The chest by the Lagoon (Ken, 2026-10-18): it holds the Big Golden Mango, the
// Esplanade's main item, and opens when Wally has the target of Golden Mangoes.
const bigChest = (() => {
  const prize = mangoModel(); prize.scale.multiplyScalar(2.4);
  const c = chestModel(prize);
  c.group.position.set(2.4, G, POOL_Z - 5); c.group.rotation.y = -Math.PI / 2; c.group.scale.setScalar(1.3);
  scene.add(c.group);
  return { ...c, open: game.hasBigMango ? 1 : 0, hint: 0 };
})();
function bigMangoChest(dt) {
  const c = bigChest;
  if (!game.hasBigMango && Math.hypot(wally.pos.x - c.group.position.x, wally.pos.z - c.group.position.z) < 2.6) {
    if (game.mangoes >= mangoTarget) {
      // Until the Esplanade's own key and chest are built (Ken, 2026-10-20: key, then the chest with the
      // talisman), this chest holds the sun talisman as well as the Big Golden Mango (a trade item).
      attempt = Trip.gain(Trip.gain(attempt, 'big-golden-mango'), 'talisman-sun'); game.hasBigMango = true; carried.add('mango', { id: 'big-mango', label: 'Big Golden Mango' }); addPoints('talisman');    // kept when the Esplanade is completed
      setTimeout(() => foundTalisman('talisman-sun', toast_), 1600);          // new: the sceptre card; already sealed: a random useful prize (revisit.js)
      game.points += 150; sound.play.powerup(); fx.burst(c.group.position, [0xffb51f, 0xffe066, 0xffffff], 34);
      toast_('The Big Golden Mango! The reef will need it', 'good'); bubbles.say(wally.root, 'Crikey, look at the size of it!', 3.4);
    } else if ((c.hint -= dt) <= 0) {
      c.hint = 5; toast_(`The chest opens for ${mangoTarget} Golden Mangoes: you have ${game.mangoes}`, 'info');
    }
  }
  if (game.hasBigMango && c.open < 1) c.open = Math.min(1, c.open + dt * 1.5);
  c.lid.rotation.x = -c.open * 1.9; c.glow.intensity = c.open * 6; c.mango.visible = c.open > 0;
  if (c.mango.visible) { c.mango.rotation.y += dt * 2; c.mango.position.y = 1.2 + c.open * 0.6; }
}

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
  // In the sea: Shift goes under, Space comes back up (no croc leap while under).
  const foursPressed = k.fours && !game.foursWas; game.foursWas = k.fours;
  const inTheSea = wally.surface === 'water' && inSea(wally.pos.x, wally.pos.z);
  if (game.faint <= 0 && !napping && !game.done) {
    // Shift dives, Space comes up (as in every level), or the on-screen buttons.
    const dive = foursPressed || game.diveQueued, up = k.jump || game.upQueued;
    if (inTheSea && dive && !seaDive.under) { seaDive.under = true; bubbles.say(wally.root, 'Down I go!', 2); }
    else if (seaDive.under && up) seaDive.under = false;
  }
  game.diveQueued = game.upQueued = false;
  // The Dive / Up buttons show whenever he is in the sea.
  $('dive-buttons').hidden = !inTheSea || game.done;
  $('b-dive').disabled = seaDive.under; $('b-up').disabled = !seaDive.under;
  if (!inTheSea && wally.surface !== 'water') seaDive.under = false;
  sound.underwaterMusic(seaDive.under);              // the music goes soft and muffled under water
  if (inTheSea && !game.seaTip) { game.seaTip = true; if (!showTip('sea', 'In the sea, Shift (or Dive) goes under and Space (or Up) comes back up. Swim to the boardwalk edge and push toward it to climb out.')) toast_('Shift to dive under, Space to come up. Swim to the boardwalk edge to climb out', 'info'); }
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
  if (!game.done && game.faint <= 0) game.air = airStep(game.air, seaDive.depth < -1.0 ? 'under' : 'surface', snorkelling() ? 0 : dt);   // the Snorkel (gear.js): air stays full
  if (game.faint > 0) rescueStep(dt, t);
  else if (game.air <= 0 && !game.done) { seaDive.under = false; if (!outOfAir()) return; }
  looksUnder(camera.position.y < -0.2);
  if (seaCeiling.visible) { seaCeiling.position.x = camera.position.x; seaCeiling.position.z = camera.position.z; }
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (!game.done && game.boost <= 0 && !napping) game.energy -= energyDrain(wally.mode, moving, 'esplanade') * drainFactor() * game.tripDrain * dt;   // vitamins (gear.js) halve it

  // Obstacles
  for (const o of obstacles) {
    if (o.kind === 'jogger') {
      o.dir = o.dir || -1;
      o.z += o.dir * 2.6 * dt;
      if (o.z < -5 || o.z > PATH.finish - 5) { o.dir *= -1; o.mesh.rotation.y = o.dir > 0 ? 0 : Math.PI; o.hit = false; }
      o.mesh.position.z = o.z;
      if (o.mesh.userData.skin) o.mesh.userData.skin.update(dt);       // Ken's people, running
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
      sound.play.sting(); toast_('Box jelly! Ouch!', 'bad'); if (reaction(3000)) bubbles.say(wally.root, pickLine('wallySting'), 3.4);   // a sting always gets a word, unless he has only just spoken
    }
  }

  // Mangoes
  for (const m of mangoes) {
    if (m.taken) continue;
    m.mesh.rotation.y += dt * 3; m.mesh.position.y = m.y + Math.sin(t * 3 + m.z) * 0.08;
    if (Math.abs(m.z - wally.pos.z) < 1.4 && Math.abs(m.x - wally.pos.x) < 1.1 && Math.abs(m.y - (wally.pos.y + 1.2)) < 1.4) {
      m.taken = true; scene.remove(m.mesh); game.mangoes++; game.points += 1; addPoints('pickup'); sound.play.goal(); bookEvent('mango');
      fx.burst(m.mesh.position, [0xffb51f, 0xffe066], 8);
      if (game.mangoes === mangoes.length) {                      // the full set: Ken's bonus, one star's worth
        game.points += MANGO_SET_BONUS; fx.burst(wally.pos, [0xffb51f, 0xffe066, 0xffffff], 30);
        toast_(`Every Golden Mango! +${MANGO_SET_BONUS}`, 'good'); bubbles.say(wally.root, 'Crikey! The whole set!', 3.4);
      }
    }
  }

  // People at the shelters throw as he comes by, unless he scares them off.
  const clusterEvents = game.done ? [] : clusters.update(dt, t, wally.pos, throwFrom);
  tradeStep(clusterEvents, wally.pos);
  questStep(dt, t, clusterEvents, wally.pos);
  for (const e of clusterEvents) {
    if (e.type === 'throw') showTip('sweet-spot', 'Visitors throw food when Wally is close, but not too close. Catch it before it lands: in the air is worth the most.');
    if (e.type === 'throw' && Math.random() < 0.35) bubbles.say(e.thrower.g, pickLine('touristThrow'), 2.3);
    if (e.type === 'flee') { game.scared++; toast_('Too close! They ran off with their lunch', 'bad'); if (reaction()) bubbles.say(wally.root, pickLine('wallyFlee'), 3.4); }
    if ((e.type === 'flee' || e.type === 'empty') && !e.cluster.counted) {
      e.cluster.counted = true; game.groupsDone++;
      if (e.type === 'empty') dropPearl(e.cluster);          // fed out to the last bite: a pearl for Wally
    }
  }
  pierGate(dt);
  for (const f of hiddenFinds.update(dt, t, wally.pos)) { toast_(f.text, 'good'); sound.play.powerup(); }
  for (const p of landPearls) {
    if (p.taken) continue;
    p.mesh.userData.pearl.position.y = 0.16 + Math.sin(t * 3 + p.z) * 0.05;
    if (Math.abs(p.z - wally.pos.z) < 1.4 && Math.abs(p.x - wally.pos.x) < 1.4 && wally.pos.y > G - 0.5) {
      p.taken = true; scene.remove(p.mesh); game.pearls++; game.points += 5; addPoints('pickup'); sound.play.goal();
      fx.burst(p.mesh.position, [0xffffff, 0xffd6f0], 10); toast_(`A pearl! ${game.pearls} now`, 'good'); bookEvent('pearl');
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
      fx.burst(p, CRUMBS[it.kind] || [0xffffff]); food.take(it, 'eaten'); wally.chomp(); eyes.chomp(); sound.play.chomp(); fx.shake(0.1, 0.1);
      game.streak++; game.caught++;
      if (daynight.night > 0.6) bookEvent('nightCatch');
      const how = it.landed ? 'ground' : (wally.airborne ? 'leap' : 'air');
      const pts = catchPoints(how, game.streak, game.boost > 0); game.foodPoints += pts; game.points += pts; addPoints(how);
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
    toast_(`Out of puff! ${game.lives} left. Here comes Kenny`, 'bad'); if (reaction()) bubbles.say(wally.root, pickLine('wallyTired'), 3);
    bubbles.say(kennyMesh, "Hang on, Wally! Comin'!", 2.6);
  }

  bigMangoChest(dt);
  {                                                                // where to go next, first visit (guide-arrow.js)
    const cp = bigChest.group.position, hungry = clusters.active.filter(c => !c.fled && c.food > 0).map(c => c.root.position);
    const mango = nearest(mangoes.filter(m => !m.taken).map(m => m.mesh.position), wally.pos), group = nearest(hungry, wally.pos);
    arrow.update(game.done ? null
      : game.hasBigMango && game.ready ? { x: 0, z: POOL_Z + 2, label: 'The Lagoon' }
      : !game.hasBigMango && game.mangoes >= mangoTarget ? { x: cp.x, z: cp.z, label: 'The chest' }
      : group ? { x: group.x, z: group.z, label: 'Hungry visitors' }
      : !game.hasBigMango && mango ? { x: mango.x, z: mango.z, label: 'Golden Mango' }
      : { x: cp.x, z: cp.z, label: 'The chest' }, wally.pos, cam.yaw);
  }
  // The Lagoon: the way on, once the job is done and the Big Golden Mango found.
  if (!game.done && game.ready && !game.hasBigMango && wally.pos.z > POOL_Z - 1 && game.hintCool <= 0) {
    game.hintCool = 6; toast_(`The chest by the Lagoon first: it opens for ${mangoTarget} Golden Mangoes (you have ${game.mangoes})`, 'info');
  } else if (!game.done && game.ready && game.hasBigMango && wally.pos.z >= POOL_Z + 2) {
    game.done = true; wally.cheer = 1.2; bubbles.say(wally.root, 'Last one in is a rotten egg!', 3.4);
    setTimeout(() => finish(true), 2200);
  } else if (!game.ready && wally.pos.z > POOL_Z - 1 && game.hintCool <= 0) {
    game.hintCool = 6; toast_('Not yet! Feed out every group and fill up first', 'info');
  }
  game.hintCool = (game.hintCool || 0) - dt;
  drawHud();
}

function stumble(o) {
  o.hit = true; game.stumbles++; game.streak = 0; bookEvent('bump');
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
const eyes = createEyes({ camera, wally, cam, canvas });   // in the water, his own view
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
      // Steering (the default): the camera swings round behind him as he turns.
      if (steering()) cam.yaw = easeBehind(cam.yaw, wally.facing, dt);
      else cam.yaw = lazyBehind(cam.yaw, wally, dt);
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
  eyes.step(dt, game.running && !inVR() && wally.surface === 'water' && game.faint <= 0, seaDive.depth < -1.0);
  const jolt = fx.shakeOffset(dt); if (jolt) camera.position.add(jolt);
  world.ring.position.x = camera.position.x; world.ring.position.z = camera.position.z;   // the horizon stays on the horizon
  if (world.ranges) world.ranges.userData.follow(camera);   // parallax: the near hills slide past the far ones
  world.sun.position.set(wally.pos.x - 60, 70, wally.pos.z - 40); world.sun.target.position.copy(wally.pos);
}

// ---- Screens -------------------------------------------------------------------------
function drawHud() {
  $('score').textContent = game.points.toLocaleString();
  $('mangoes').textContent = game.hasBigMango ? `${game.mangoes} \u2713` : `${game.mangoes}/${mangoTarget}`;
  const diving = seaDive.depth < -1.0 || game.air < AIR.max - 0.5;
  $('pearls').textContent = game.pearls;
  $('feed').classList.toggle('air', diving);
  $('meter-label').textContent = diving ? 'Air' : 'Feed-o-meter';
  $('red-note').textContent = diving ? 'Low on air! Swim up (Space) or find a bubble vent' : 'In the red! Look out for Kenny and his jar!';
  $('energy-fill').style.width = `${Math.max(0, diving ? game.air / AIR.max * 100 : game.energy)}%`;
  $('feed').classList.toggle('red', diving ? game.air < 25 : inRedZone(game.energy));
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  $('veg').hidden = game.boost <= 0;
  $('track-wally').style.left = `${Math.min(100, Math.max(0, wally.pos.z / PATH.finish * 100))}%`;
  $('job').textContent = game.ready ? (game.hasBigMango ? 'Head for the Lagoon!' : `Golden Mangoes for the chest: ${game.mangoes}/${mangoTarget}`) : game.groupsDone >= game.groupsTotal ? 'Now fill the feed-o-meter' : `Groups fed out ${game.groupsDone}/${game.groupsTotal}`;
}

function start() {
  if (!entry.ok && !testingAll) { toast_('The Esplanade opens with the gate key from Croc Park', 'bad'); return; }
  recordVisit('esplanade');
  // The first time here: the fly-over first, with the frame-rate check running
  // (quality.js) so the detail is right before he moves. Then play begins.
  if (intro.due()) { $('title').hidden = true; sound.start(); intro.play(camera, begin); return; }
  begin();
}
function begin() {
  showTip('big-mango', `Collect Golden Mangoes along the walk. The chest at the Lagoon opens for ${mangoTarget} of them, and holds the Big Golden Mango the reef will need.`);
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
  if (won) bookEvent('finish');
  if (won) {
    let a = Trip.gain(Trip.gain(attempt, 'golden-mango', game.mangoes), 'pearl', game.pearls);
    const done = Trip.completeAttempt(progress.trip, a, { objectiveMet: true });
    if (done.ok) { progress.trip = done.trip; bankRun({ stars }); }
    progress = completeArea(progress, 'esplanade', { score: s.total, stars, mangoes: game.mangoes, pearls: game.pearls });
    if (game.pierOpen && !progress.pier) progress = openPier(progress, pierPrice).progress;   // paid for now, this run's mangoes banked first
  } else { progress.trip = Trip.failAttempt(progress.trip, attempt).trip; failRun(); }   // nothing from this run is kept, points included (points.js)   // nothing from this attempt is kept (trip-rules.js)
  try { localStorage.setItem('chomp-progress', JSON.stringify(progress)); } catch { /* not saved */ }
  $('result-title').textContent = won ? 'Made it to the Lagoon!' : why === 'hungry' ? 'Still peckish!' : why === 'air' ? 'Out of air!' : 'Out of puff';
  $('result-why').textContent = why === 'hungry' ? `Wally made it, but his feed-o-meter isn't full. He needs a full tank (${FULL}%) to head on.` : '';
  markRetry(won, 'the Esplanade');
  $('result-stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Tucker caught', `${game.caught} (${s.food})`], ['Golden Mangoes', `${game.mangoes}/${mangoes.length} (${s.mangoes})`], ['All mangoes bonus', s.mangoSet], ['Pearls', `${game.pearls} (${s.pearls})`], ['Finish bonus', s.finishBonus], ['No-bump bonus', s.clean], ['Total', s.total]]) {
    const li = document.createElement('li'); li.innerHTML = `<span></span><b></b>`; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  $('postcard').hidden = !won;
  $('postcard-text').textContent = POSTCARDS.esplanade;
  $('result').hidden = false;
  showLeaderboard($('board'), 'esplanade', won ? s.total : 0, won ? stars : 0);   // finished runs go on the board; the top ten either way
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
  intro.update(dt, camera);                       // the first-visit fly-over, when it plays
  { const night = daynight.update(game.paused ? 0 : dt, camera); lamps.update(dt, night, wally.pos); }
  fpsWatch(dt);
  post.render();
  if (!inVR()) requestAnimationFrame(frame);   // in a VR headset, the headset sets the pace (vr.js)
}
installVR({ renderer, scene, camera, frame });   // a VR headset, if there is one (vr.js)
requestAnimationFrame(frame);
if (params.has('play') || params.has('go') || bot) start();   // ?go: Play on the title screen, or the story, brought him here: straight in

// The map, from anywhere (mapmodal.js): the Map button or Tab. Play pauses while it is open.
installMap({ pause: on => { if (game.running) game.paused = on; } });
installShop({ pause: on => { if (game.running) game.paused = on; } });
installBook({ here: 'esplanade', pause: on => { if (game.running) game.paused = on; } });
installGear({ scene, wally, food, mouth: () => wally.mouthPosition(), hasAir: true, underWater: () => seaDive.depth < -1.0, toast: (t, k) => toast_(t, k), openBook: () => openBook('wally'), running: () => game.running && !game.paused, pause: on => { if (game.running) game.paused = on; } });
window.chompStartHere = () => { if (!game.running) start(); };
window.chompDress = () => {
  const p = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
  wally.changeModel(models.get(outfitModel(p)) || models.get('wally'));     // a whole-model outfit goes on now
  if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(p, 'wally'));
};
