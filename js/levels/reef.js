// reef.js
// Level 3: The Great Barrier Reef, off Green Island. Wally starts on the jetty,
// dives in, and under water has no food, only air. A glowing guide fish leads
// him through the coral maze on the reef to the coral cave, where the old
// pirate chest waits in the furthest cell. Taking it makes the giant clam at
// the cave mouth snap shut; only a pearl opens it. Out with the treasure and up
// to the surface wins. Pearls carry over from the Esplanade (progress.pearls).
// Rules: reef-rules.js (tested). Scenery under water: reef-scene.js.

import { startRun, addPoints, bankRun, failRun } from '../points.js';
import { foundTalisman } from '../revisit.js';
import { fitText } from '../signtext.js';
import { installGear, snorkelling } from '../gear.js';
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Wally } from '../wally.js';
import { Input, steering, easeBehind } from '../input.js';
import { Bubbles, reaction, pickLine } from '../bubbles.js';
import { Effects } from '../fx.js';
import { loadModels, dress, MODEL_FILES } from '../models.js';
import { usePalmCrown, buildPalm, palmStand } from '../palms.js';
import { Trees } from '../trees.js';
import { loadRealism, applySky, surfaceMaterial } from '../realism.js';
import { createPost } from '../post.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { areaIntro, courseShots, orbitShots } from '../area-intro.js';
import { installMap, recordVisit, markRetry } from '../mapmodal.js';
import { installShop, openShop } from '../shopmodal.js';
import { showLeaderboard } from '../leaderboard.js';
import { dressOutfit } from '../outfit.js';
import { LIVES } from '../rules.js';
import { HumanoidPoser } from '../rig.js';
import { kennysJar, useJarModel } from '../food.js';
import { jarLabelTexture } from '../textures.js';
import { readProgress, completeArea, starsFor, POSTCARDS, wearing, WARDROBE, outfitModel, PROGRESS_CHANGED, saveProgress } from '../progress.js';
import * as Trip from '../trip-rules.js';
import { showTip } from '../tips.js';
import { makeMaze, makeReefMaze, mazePath, cellAt, cellCentre, collide, inMaze, airStep, AIR,
         SWIM_Y, SURFACE_Y, SEABED_Y, reefRunScore, REEF_STARS, PEARL_POINTS, CHEST_POINTS,
         LANES, LANE_NAMES, TREASURES, nextDepth, treasureSpots, canCollect, canTouchStarfish, clamCell } from './reef-rules.js';
import { buildReef, buildTreasures, MAZE, OUTER, DIVE, BOUNDS, buildGiantClam } from './reef-scene.js';
import { installBook, bookEvent, ability, HiddenFinds, openBook } from '../book.js';
import { DayNight } from '../daynight.js';
import { StreetLamps } from '../lamps.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');

// ---- Green Island and the jetty (metres; the sea surface is 0) ---------------------
const ISLAND = { x: 34, z: 419.5, r: 16 };          // a sand cay, east of the reef
const JETTY = { x0: -3, x1: 22, z: 419.5, half: 1.6, y: 1.2 };
const onJetty = (x, z) => x >= JETTY.x0 && x <= JETTY.x1 && Math.abs(z - JETTY.z) <= JETTY.half;
// The cay's sand: a low dome, above the water out to its rim, then shelving off.
const sandHeight = (x, z) => 0.7 * (1 - (Math.hypot(x - ISLAND.x, z - ISLAND.z) / ISLAND.r) ** 2) - 0.1;

// ---- Stage ---------------------------------------------------------------------
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
scene.background = new THREE.Color(0x8fc8e8);
scene.fog = new THREE.Fog(0xbfdcef, 160, 620);
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 72 : 58;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const fpsWatch = watchFrameRate(quality, lower => { quality = lower; renderer.setPixelRatio(pixelRatioFor(lower)); resize(); });
// The first visit: round the reef from high up, the island and the maze below, down to the jetty.
const intro = areaIntro({
  id: 'reef', name: 'The Great Barrier Reef', place: 'Out from Cairns', focus: on => fpsWatch.focus(on),
  shots: () => { const c = { x: (BOUNDS.x0 + BOUNDS.x1) / 2, z: (BOUNDS.z0 + BOUNDS.z1) / 2 }, end = Math.atan2(wally.pos.x - c.x, wally.pos.z - c.z);
    return orbitShots({ centre: { x: c.x, y: 0, z: c.z }, radius: 75, height: 50, low: 16, a0: end - Math.PI * 1.3, a1: end }); },
});

const light = touch || quality.name === 'low';
const models = await loadModels([...MODEL_FILES, 'clam-top', 'clam-bottom', 'pearl-key'], { light });
useJarModel(models.get('jar'));                    // Ken's jar for Kenny's rescue, when present
usePalmCrown(models.get('palm-crown'));
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light });

// Sun and sky.
scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6b5a3a, 0.5));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
sun.position.set(-60, 70, 380); sun.target.position.set(-30, 0, 420);
sun.castShadow = quality.shadows; sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 10, far: 260 });
scene.add(sun, sun.target);
const photoSky = applySky(scene, realism, sun, null);
if (!photoSky) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.Scene().add(new THREE.Mesh(new THREE.SphereGeometry(10), new THREE.MeshBasicMaterial({ color: 0x9fd0ef, side: THREE.BackSide }))), 0.04).texture;
  pmrem.dispose();
}
const sunOffset = sun.position.clone().sub(sun.target.position);

// The sea: real reflective water when the pictures are there, plain otherwise.
let water, waterTime = null;
if (realism && realism.waterNormals && quality.name !== 'low') {
  water = new Water(new THREE.PlaneGeometry(1400, 1400), {
    textureWidth: quality.name === 'high' ? 512 : 256, textureHeight: quality.name === 'high' ? 512 : 256,
    waterNormals: realism.waterNormals, sunDirection: sun.position.clone().sub(sun.target.position).normalize(),
    sunColor: 0xfff1d6, waterColor: 0x1c8a92, distortionScale: 1.8, fog: true,
  });
  water.material.uniforms.size.value = 3;
  waterTime = water.material.uniforms.time;
} else {
  water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshPhongMaterial({ color: 0x23a7b8, specular: 0xffffff, shininess: 80, transparent: true, opacity: 0.9 }));
}
water.rotation.x = -Math.PI / 2; water.position.set(-40, 0, 420);
water.userData.noAO = true;                          // not in the shading pass (it would draw the reflection again)
// The reflection redraws the whole reef: only while the camera is above the sea,
// where the reflection can be seen (under water the surface is seen from below).
if (water.onBeforeRender) {
  const mirror = water.onBeforeRender.bind(water);
  // And the reef under the surface is left out of the reflection (a reflection
  // shows what is above the water, never what is under it).
  water.onBeforeRender = (renderer, sc, cam, ...rest) => {
    if (cam.position.y <= 0) return;
    const under = typeof reef !== 'undefined' && reef.root.visible ? reef.root : null;
    if (under) under.visible = false;
    mirror(renderer, sc, cam, ...rest);
    if (under) under.visible = true;
  };
}
scene.add(water);

// Green Island: a sand cay with palms, and the jetty out to the dive spot.
const islandTrees = new Trees(scene, { light });
{
  const g = new THREE.CircleGeometry(ISLAND.r + 4, 64, 0, Math.PI * 2); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, sandHeight(p.getX(i) + ISLAND.x, p.getZ(i) + ISLAND.z));
  g.computeVertexNormals();
  const sand = surfaceMaterial(realism, 'sand', 6, 6) || new THREE.MeshStandardMaterial({ color: 0xe7d7a8, roughness: 1 });
  const cay = new THREE.Mesh(g, sand); cay.position.set(ISLAND.x, 0, ISLAND.z); cay.receiveShadow = true; scene.add(cay);
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Ken's palms (trees.js) on the cay, a few umbrella trees in the middle.
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, d = 3 + rnd() * 9;
    for (const t of palmStand(ISLAND.x + Math.cos(a) * d, ISLAND.z + Math.sin(a) * d, rnd, { minH: 6, maxH: 11 })) {
      if (onJetty(t.x, t.z) || Math.hypot(t.x - ISLAND.x, t.z - ISLAND.z) > ISLAND.r - 2) continue;
      islandTrees.add('palm', t.x, sandHeight(t.x, t.z), t.z, t.height + 2);
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * 4;
    const x = ISLAND.x + Math.cos(a) * d, z = ISLAND.z + Math.sin(a) * d;
    if (!onJetty(x, z)) islandTrees.add('umbrella', x, sandHeight(x, z), z, 6 + rnd() * 3);
  }
  islandTrees.build();
  // The jetty: boards across it, posts and rails, piles down into the water.
  const deckMat = surfaceMaterial(realism, 'planks', (JETTY.x1 - JETTY.x0) / 1.2, JETTY.half * 2 / 1.2, { rotate: true }) || new THREE.MeshStandardMaterial({ color: 0x9c7650, roughness: 0.9 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(JETTY.x1 - JETTY.x0, 0.22, JETTY.half * 2), deckMat);
  deck.position.set((JETTY.x0 + JETTY.x1) / 2, JETTY.y - 0.11, JETTY.z); deck.castShadow = deck.receiveShadow = true; scene.add(deck);
  const wood = new THREE.MeshStandardMaterial({ color: 0x5e4630, roughness: 0.9 });
  const pile = new THREE.CylinderGeometry(0.15, 0.17, JETTY.y + 4, 10);
  for (let x = JETTY.x0 + 0.3; x <= JETTY.x1; x += 3) for (const side of [-1, 1]) {
    const pl = new THREE.Mesh(pile, wood); pl.position.set(x, (JETTY.y - 4) / 2, JETTY.z + side * (JETTY.half - 0.15)); pl.castShadow = true; scene.add(pl);
  }
  const rail = new THREE.MeshStandardMaterial({ color: 0xa8a294, roughness: 0.9 });   // sun-bleached timber (pure white glared in the sun)
  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(JETTY.x1 - JETTY.x0 - 4, 0.08, 0.1), rail);
    r.position.set((JETTY.x0 + 4 + JETTY.x1) / 2, JETTY.y + 0.95, JETTY.z + side * (JETTY.half - 0.05)); scene.add(r);
  }
  // A sign at the end of the jetty, pointing out to the reef.
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g2 = c.getContext('2d');
  g2.fillStyle = '#1d5f73'; g2.fillRect(0, 0, 512, 160); g2.fillStyle = '#fff6d8'; g2.textAlign = 'center';
  fitText(g2, 'Reef dive', 256, 70, 470, 50, 'bold {size}px "Trebuchet MS", sans-serif'); fitText(g2, 'Coral cave this way', 256, 125, 470, 32, '{size}px "Trebuchet MS", sans-serif');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.set(JETTY.x0 + 1.6, JETTY.y + 1.8, JETTY.z + JETTY.half - 0.1); sign.rotation.y = Math.PI; scene.add(sign);   // facing back up the jetty, so it reads the right way round
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), wood); post.position.set(JETTY.x0 + 1.6, JETTY.y + 0.9, JETTY.z + JETTY.half - 0.1); scene.add(post);
}

// The reef below: the coral maze, the cave and everything in it.
// A new maze every dive (Ken: never the same twice, or people just memorise it).
// ?seed=N still gives a fixed one, for testing.
const seed = Number(params.get('seed')) || 1 + Math.floor(Math.random() * 2147483000);
const maze = makeMaze(MAZE.cols, MAZE.rows, seed);
const outer = makeReefMaze(OUTER.cols, OUTER.rows, seed + 4);
const reef = buildReef(scene, quality, { maze, outer, jellyGltf: models.get('jellyfish'), coralGltf: models.get('coral') });
// Reef treasures (Ken): starfish, cowries and conch shells along both mazes'
// corridors at the three depths, never in a pearl's cell.
const pearlCellsOf = (m, o) => reef.pearls.map(p => cellAt(m, p.x, p.z, o.ox, o.oz, o.size)).filter(Boolean);
const treasures = buildTreasures(reef.root, models.get('seashell') || null, [
  ...treasureSpots(outer, 14, seed + 11, pearlCellsOf(outer, OUTER)).map(t => ({ kind: t.kind, ...cellCentre(outer, t.cell, OUTER.ox, OUTER.oz, OUTER.size) })),
  ...treasureSpots(maze, 18, seed + 17, pearlCellsOf(maze, MAZE)).map(t => ({ kind: t.kind, ...cellCentre(maze, t.cell, MAZE.ox, MAZE.oz, MAZE.size) })),
]);
reef.root.visible = true;

const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));

// ---- Characters ------------------------------------------------------------------
// The Wally model to use: his own, or the model of a complete outfit he is wearing.
function wallyModelName() {
  return outfitModel(readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()));
}
const wally = new Wally(scene);
wally.useModel(models.get(wallyModelName()) || models.get('wally'));   // a garment outfit has its own fitted Wally model
{ const p0 = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
  if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(p0, 'wally')); }   // clothes from the Kuranda markets
const bubbles = new Bubbles(scene, touch ? 3 : 4);
const fx = new Effects(scene, { items: [] });

// Kenny waits on the jetty, and paddles out on a float with Vegemite when Wally runs out of air.
const kennyMesh = new THREE.Group(); scene.add(kennyMesh);
let kennyPoser = null;
{
  const skin = dress(kennyMesh, models.get('kenny'), { height: 1.3 });
  if (skin) dressOutfit(skin.root, 'kenny', wearing(readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()), 'kenny'));   // his vest from the markets
  if (skin && skin.clips.size) kennyPoser = new HumanoidPoser(skin.root);
  if (!skin) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 18), new THREE.MeshStandardMaterial({ color: 0x9a9a9e }));
    body.position.y = 0.55; kennyMesh.add(body);
  }
}
const kennyHome = new THREE.Vector3(JETTY.x0 + 3, JETTY.y, JETTY.z - 0.6);
kennyMesh.position.copy(kennyHome); kennyMesh.rotation.y = -Math.PI / 2;
const kennyFloat = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.22, 10, 28), new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.5 }));
kennyFloat.rotation.x = Math.PI / 2; kennyFloat.visible = false; scene.add(kennyFloat);
const vegemite = kennysJar(jarLabelTexture()); vegemite.visible = false; scene.add(vegemite);

// The guide fish: small, golden and glowing, it swims the way through the coral
// maze to the cave and waits whenever Wally falls behind.
const guide = new THREE.Group();
{
  const glow = new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0xffa31a, emissiveIntensity: 1.6, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), glow); body.scale.set(0.55, 0.8, 1.4); guide.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), glow); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.48; guide.add(tail);
  guide.userData.tail = tail;
  const halo = new THREE.PointLight(0xffc24a, 4, 7, 1.5); guide.add(halo);
  guide.position.set(DIVE.x - 2, SWIM_Y, DIVE.z); scene.add(guide);
}

// The cave lamp: a soft light on Wally in the dark.
const caveLight = new THREE.PointLight(0x9feeff, 0, 16, 1.6); scene.add(caveLight);

// ---- State --------------------------------------------------------------------------
let progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
addEventListener(PROGRESS_CHANGED, () => { progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); });   // the book, trades and shops write it too
const banked = params.has('pearls') ? Number(params.get('pearls')) : (progress.pearls || 0);
const game = {
  running: false, paused: false, done: false, time: 0,
  lives: LIVES, air: AIR.max, depth: SURFACE_Y, wantDepth: SURFACE_Y,
  pearls: banked, found: 0, spent: 0, points: 0, mangoes: 0, treasure: 0, treasures: 0, shells: 0,
  chest: false, inCave: false, faint: 0, stun: 0, hint: 0,
  foursWas: false, diveQueued: false, upQueued: false, climb: 0, guideSaid: false,
};

// The trip's rules (trip-rules.js): the Big Golden Mango to come in the first
// time (?all opens it, for testing); this dive's level sets how fast air runs out.
if (!progress.trip) { progress.trip = Trip.tripFor(progress); saveProgress(progress); }
const entry = Trip.canEnter(progress.trip, 'reef'), testingAll = params.has('all');
let attempt = Trip.startAttempt(progress.trip, 'reef', { force: true }); startRun('reef', { level: attempt.level });
game.tripDrain = Trip.drainFactor(progress.trip, 'reef', attempt.level);
game.hasPearlKey = Trip.have(progress.trip, 'pearl-key');           // on a return dive he has it already
game.keyRise = 9;

// The giant clam (Ken's model) in a dead end of the coral maze on the open reef,
// shut until it is paid; the pearl key inside rises out when it opens.
const clam = (() => {
  const cell = clamCell(outer, pearlCellsOf(outer, OUTER));
  const at = cellCentre(outer, cell, OUTER.ox, OUTER.oz, OUTER.size);
  const model = buildGiantClam(models.get('clam-top'), models.get('clam-bottom'));
  model.group.position.set(at.x, SEABED_Y, at.z); model.set(game.hasPearlKey ? 1 : 0);
  reef.root.add(model.group);
  let key = null;
  const kg = models.get('pearl-key');
  if (kg) { key = kg.scene.clone(true); const b = new THREE.Box3().setFromObject(key), s = 1.2 / Math.max(b.max.y - b.min.y, b.max.x - b.min.x); key.scale.setScalar(s); key.position.set(at.x, SEABED_Y + 0.8, at.z); key.visible = false; reef.root.add(key); }
  return { x: at.x, z: at.z, model, key };
})();
window.chomp = { game, wally, reef, maze, outer, camera, scene, treasures, MAZE, clam };

// Day and night, and lamps on the jetty and the cay (Ken, 2026-10-18).
const daynight = new DayNight(scene, { sun });
const lamps = new StreetLamps(scene, models.get('streetlamp'), [
  ...Array.from({ length: Math.floor((JETTY.x1 - JETTY.x0 - 2) / 8) + 1 }, (_, i) => ({ x: JETTY.x0 + 1 + i * 8, y: JETTY.y, z: JETTY.z + (i % 2 ? 1 : -1) * (JETTY.half - 0.12), rot: i % 2 ? Math.PI : 0 })),
  ...[0.5, 2.6, 4.4].map(a => { const x = ISLAND.x + Math.cos(a) * 8, z = ISLAND.z + Math.sin(a) * 8; return { x, y: Math.max(0, sandHeight(x, z)), z }; }),
], { real: quality.name === 'high' ? 8 : quality.name === 'medium' ? 6 : 4 });
Object.assign(window.chomp, { daynight, lamps });
// Hidden finds (Ken): about the sand cay and at the end of the jetty; three a visit.
const hiddenFinds = new HiddenFinds(scene, [
  ...Array.from({ length: 7 }, (_, i) => { const a = i / 7 * Math.PI * 2, x = ISLAND.x + Math.cos(a) * 9, z = ISLAND.z + Math.sin(a) * 9; return { x, y: Math.max(0, sandHeight(x, z)), z }; }),
  { x: JETTY.x0 + 0.6, y: JETTY.y, z: JETTY.z },
]);
window.chomp.hiddenFinds = hiddenFinds;

function toast_(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 1800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

// ---- The ground: jetty, island, and the water above and below the reef -------------
setGround({
  stand(x, z, feetY) {
    if (onJetty(x, z) && feetY >= JETTY.y - 0.4) return { y: JETTY.y, surface: 'deck' };
    const sand = sandHeight(x, z);
    if (sand > -0.05) return { y: Math.max(0, sand), surface: 'land' };
    return { y: game.depth, surface: 'water' };
  },
  move(x, z, nx, nz, y) {
    nx = Math.max(BOUNDS.x0, Math.min(ISLAND.x + ISLAND.r, nx)); nz = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, nz));
    // From the water the jetty's sides are walls: swim to it and push to climb out (see step).
    if (y < JETTY.y - 0.4 && onJetty(nx, nz)) return { x, z };
    // The coral maze is walled at every depth (its walls reach almost to the surface);
    // the cave only below its roof.
    let boxes = reef.outerBoxes;
    if (game.depth < -2.5) boxes = boxes.concat(reef.boxes);
    return collide(x, z, nx, nz, boxes, 0.7);
  },
  foodAt: () => SEABED_Y,
  isWater: (x, z) => sandHeight(x, z) <= -0.05 && !onJetty(x, z),
  start: () => ({ x: JETTY.x0 + 1, y: JETTY.y, z: JETTY.z }),
});
wally.pos.set(JETTY.x0 + 1.2, JETTY.y, JETTY.z); wally.facing = -Math.PI / 2;

// ---- Controls --------------------------------------------------------------------------
const input = new Input(canvas, touch ? { stick: $('stick'), knob: $('knob'), jump: $('t-jump'), fours: $('t-fours'), pause: $('t-pause'), cam: $('t-cam') } : null);
input.onPause = () => setPaused(!game.paused);
input.onMute = () => toast_('Sound ' + (sound.toggleMute() ? 'off' : 'on'), 'info');
for (const [id, flag] of [['b-dive', 'diveQueued'], ['b-up', 'upQueued']]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); game[flag] = true; });
}
const cam = { yaw: Math.PI / 2, pitch: 0.3, dist: 10, manual: 0 };
window.chomp.cam = cam;

// ---- Under-water look -------------------------------------------------------------------
const aboveFog = scene.fog, aboveBackground = scene.background;
const underFog = new THREE.FogExp2(0x0d5d78, 0.032), caveFog = new THREE.FogExp2(0x0a3140, 0.05);
const underColour = new THREE.Color(0x0b5470), caveColour = new THREE.Color(0x061f26);
let lookNow = null;
function looks(under, inCave) {
  const key = under ? (inCave ? 'cave' : 'reef') : 'above';
  if (key === lookNow) return;
  lookNow = key;
  scene.fog = under ? (inCave ? caveFog : underFog) : aboveFog;
  scene.background = under ? (inCave ? caveColour : underColour) : aboveBackground;
  water.visible = !under;                            // from below, the reef's own shimmering surface shows
  reef.roof.visible = !inCave;
}

// ---- The guide fish's route ------------------------------------------------------------
// Waypoints: in at the coral maze's entrance, along the way through, out of the
// west gap and to the cave mouth. Wally's own cell decides where along it to start.
const outerCentre = c => cellCentre(outer, c, OUTER.ox, OUTER.oz, OUTER.size);
const entrancePoint = { x: OUTER.ox + OUTER.cols * OUTER.size + 3, z: outerCentre(outer.entrance).z };
const mouthPoint = { x: reef.mouth.x + 2.2, z: reef.mouth.z };
function guideRoute() {
  const here = cellAt(outer, wally.pos.x, wally.pos.z, OUTER.ox, OUTER.oz, OUTER.size);
  const cells = mazePath(outer, here || outer.entrance, outer.exit).map(outerCentre);
  return (here ? [] : [entrancePoint]).concat(cells, [{ x: OUTER.ox - 1, z: mouthPoint.z }, mouthPoint]);
}
let route = guideRoute(), routeCell = null;
function guideStep(dt, t) {
  const underNow = game.depth < -2;
  guide.visible = underNow && !game.inCave;
  if (!guide.visible) return;
  const here = cellAt(outer, wally.pos.x, wally.pos.z, OUTER.ox, OUTER.oz, OUTER.size);
  const key = here ? `${here.c},${here.r}` : 'out';
  if (key !== routeCell) { routeCell = key; route = guideRoute(); }
  // The fish keeps a couple of waypoints ahead of Wally, and waits if he falls behind.
  const ahead = route[Math.min(route.length - 1, here ? 1 : 0)];
  const far = Math.hypot(guide.position.x - wally.pos.x, guide.position.z - wally.pos.z) > 9;
  const want = far ? new THREE.Vector3(guide.position.x, SWIM_Y + 0.6, guide.position.z) : new THREE.Vector3(ahead.x, SWIM_Y + 0.6, ahead.z);
  const step = want.clone().sub(guide.position); const len = step.length();
  if (len > 0.05) { guide.position.addScaledVector(step, Math.min(1, (6 * dt) / len)); guide.rotation.y = Math.atan2(step.x, step.z); }
  if (far) guide.position.y = SWIM_Y + 0.6 + Math.sin(t * 3) * 0.25;               // bobbing, waiting
  guide.userData.tail.rotation.y = Math.sin(t * 14) * 0.5;
  if (!game.guideSaid && Math.hypot(wally.pos.x - DIVE.x, wally.pos.z - DIVE.z) < 12) {
    game.guideSaid = true; bubbles.say(guide, 'This way to the cave!', 3);
  }
}

// ---- The arrow: where to go next ------------------------------------------------------------
function arrowStep() {
  let target = null, label = '';
  if (!game.chest && !game.inCave) { target = mouthPoint; label = 'Coral cave'; }
  else if (!game.chest && game.inCave) { target = reef.chest; label = 'Treasure'; }   // a compass, straight at it: the way there is still to be found
  else if (game.chest && game.inCave) { target = mouthPoint; label = 'Way out'; }
  const el = $('arrow');
  if (!target || game.done) { el.hidden = true; return; }
  el.hidden = false;
  const dx = target.x - wally.pos.x, dz = target.z - wally.pos.z, d = Math.hypot(dx, dz);
  // Into the camera's frame: forward is away from the camera, right is to its right.
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
  el.querySelector('.tip').style.transform = `rotate(${ang - Math.PI / 2}rad)`;      // the glyph points right at rest
  $('arrow-text').textContent = `${label} ${Math.round(d)} m`;
}

// ---- Kenny's rescue ----------------------------------------------------------------------
function outOfAir() {
  game.lives--; sound.play.lose();
  if (game.lives <= 0) { finish(false, 'air'); return false; }
  if (game.inCave) wally.pos.set(reef.mouth.x + 4, game.depth, reef.mouth.z);
  game.wantDepth = SURFACE_Y; game.faint = 3.2; wally.setNapping(true);
  kennyFloat.visible = vegemite.visible = true;
  toast_(`Out of air! ${game.lives} left. Here comes Kenny`, 'bad'); bookEvent('outOfAir'); if (reaction()) bubbles.say(wally.root, pickLine('wallyAir'), 3);
  bubbles.say(kennyMesh, "Hang on, Wally! Here's me jar!", 2.6);
  return true;
}
function rescueStep(dt, t) {
  game.faint -= dt;
  kennyFloat.position.set(wally.pos.x + 1.6, 0.05, wally.pos.z + 0.6);
  kennyMesh.position.set(kennyFloat.position.x, -0.25, kennyFloat.position.z);
  vegemite.position.set(wally.pos.x + 0.6, 0.6 + Math.sin(t * 4) * 0.1, wally.pos.z + 0.3); vegemite.rotation.y += dt * 3;
  if (game.faint <= 0) {
    game.air = AIR.max; kennyFloat.visible = vegemite.visible = false;
    kennyMesh.position.copy(kennyHome);
    wally.setNapping(false); sound.play.powerup();
    toast_("Kenny's jar! Full of beans. Dive when you're ready", 'good'); bubbles.say(wally.root, 'Thanks, Kenny! Back down I go!', 3.4);
  }
}

// ---- One frame -------------------------------------------------------------------------------
const climbFrom = new THREE.Vector3(), climbTo = new THREE.Vector3();
function step(dt, t) {
  const k = input.read();
  game.time += dt; game.hint -= dt; game.stun = Math.max(0, game.stun - dt);
  if (k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0) cam.manual = 1.2;
  cam.yaw += k.turn + k.turnKeys * dt * 2;
  cam.pitch = Math.min(1.35, Math.max(-0.15, cam.pitch + k.tilt));
  cam.dist = Math.min(22, Math.max(5, cam.dist + k.zoom));

  const inWater = wally.surface === 'water';
  const atTop = game.depth > -1.2;
  sound.underwaterMusic(!atTop);                    // the music goes soft and muffled under water
  game.inCave = !atTop && inMaze(maze, wally.pos.x, wally.pos.z, MAZE.ox, MAZE.oz, MAZE.size);

  // Dive with Shift, come up with Space (as in every level), or the on-screen
  // buttons. Not up from inside the cave: rock overhead.
  const foursPressed = k.fours && !game.foursWas; game.foursWas = k.fours;
  if (inWater) showTip('reef-dive', 'Shift (or Dive) takes Wally one level deeper, Space (or Up) one level up. Watch the air meter: bubble vents fill it again.');
  const dive = foursPressed || game.diveQueued;
  const up = (inWater && k.jump) || game.upQueued;                // in the reef's water there is no jumping: Space is up
  game.diveQueued = game.upQueued = false;
  // Three depths under water (Ken): Shift one deeper, Space one up; from
  // the top depth, up is the surface (but not inside the cave: rock overhead).
  if (game.faint <= 0 && !game.done && inWater) {
    if (dive) game.wantDepth = nextDepth(game.wantDepth, 1);
    if (up && !atTop) {
      const to = nextDepth(game.wantDepth, -1, !game.inCave);
      if (to === game.wantDepth && game.inCave) { if (game.hint <= 0) { toast_('Rock overhead! Find a bubble vent or swim out', 'bad'); game.hint = 3; if (reaction()) bubbles.say(wally.root, pickLine('wallyBump'), 3.4); } }
      game.wantDepth = to;
    }
  }
  if (!inWater) game.wantDepth = SURFACE_Y;
  game.depth += Math.sign(game.wantDepth - game.depth) * Math.min(Math.abs(game.wantDepth - game.depth), 5 * dt);
  $('dive-buttons').hidden = !inWater || game.done;
  $('b-dive').disabled = game.wantDepth <= LANES[LANES.length - 1] + 0.01; $('b-up').disabled = atTop;

  // Moving: no croc leap while under water; climbing out onto the jetty from the water.
  // In the reef's water there is no jumping at all (Ken): he swims at the
  // surface or dives. On the jetty and the island he can still jump.
  const control = game.faint > 0 || game.done ? { forward: 0, right: 0, jump: false, fours: false }
    : inWater ? { ...k, jump: false, fours: false } : { ...k, fours: false };
  if (game.climb > 0) {
    game.climb -= dt;
    const u = 1 - Math.max(0, game.climb) / 0.6, e = u * u * (3 - 2 * u);
    wally.pos.set(climbFrom.x + (climbTo.x - climbFrom.x) * e, climbFrom.y + (climbTo.y - climbFrom.y) * Math.min(1, e * 1.4) + Math.sin(u * Math.PI) * 0.35, climbFrom.z + (climbTo.z - climbFrom.z) * e);
    wally.root.position.copy(wally.pos);
    if (game.climb <= 0) { wally.pos.copy(climbTo); wally.vel.set(0, 0, 0); wally.vy = 0; wally.grounded = true; wally.surface = 'deck'; }
  } else {
    // Which way he is pushing: with the keyboard, straight ahead while Up is held;
    // with the phone stick, relative to the camera.
    const wantX = control.steer ? Math.sin(wally.facing) * (control.forward > 0 ? 1 : 0) : -Math.sin(cam.yaw) * control.forward + Math.cos(cam.yaw) * control.right;
    const wantZ = control.steer ? Math.cos(wally.facing) * (control.forward > 0 ? 1 : 0) : -Math.cos(cam.yaw) * control.forward - Math.sin(cam.yaw) * control.right;
    const nearJetty = wally.pos.x >= JETTY.x0 - 1.2 && wally.pos.x <= JETTY.x1 && Math.abs(wally.pos.z - JETTY.z) <= JETTY.half + 1.2;
    if (inWater && atTop && nearJetty && Math.hypot(wantX, wantZ) > 0.35) {
      // Pushing toward the jetty from beside it or off its end: haul up onto the deck.
      const tx = Math.max(JETTY.x0 + 0.6, Math.min(JETTY.x1 - 0.5, wally.pos.x)), tz = JETTY.z;
      const toward = (tx - wally.pos.x) * wantX + (tz - wally.pos.z) * wantZ;
      if (toward > 0.2) {
        climbFrom.copy(wally.pos); climbTo.set(tx + (wally.pos.x < JETTY.x0 ? 0.4 : 0), JETTY.y, tz);
        game.climb = 0.6; sound.play.jump(); fx.splash(wally.pos, 14);
      }
    }
    if (game.climb <= 0) {
      for (const e of wally.update(dt, control, cam.yaw, game.stun > 0 ? 0.4 : 1)) {
        if (e === 'jump') sound.play.jump(); else if (e === 'land') sound.play.land();
        else if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 30); }
      }
    }
  }
  reef.update(t, dt);
  if (waterTime) waterTime.value = t * 0.55;

  // Air: at the top it fills, in a vent it fills, anywhere else under water it runs down.
  const inVent = !atTop && reef.vents.some(v => Math.hypot(wally.pos.x - v.x, wally.pos.z - v.z) < v.r);
  if (!game.done && game.faint <= 0) { const mode = game.depth > -1.0 ? 'surface' : inVent ? 'vent' : 'under'; game.air = airStep(game.air, mode, mode === 'under' && snorkelling() ? 0 : mode === 'under' ? dt * game.tripDrain : dt); }   // the trip's difficulty sets how fast air runs out   // the Snorkel (gear.js): air stays full
  if (inVent && game.air < AIR.max - 1 && game.hint <= 0) { toast_('Bubbles! Air filling up', 'good'); game.hint = 4; }

  // Pearls.
  for (const f of hiddenFinds.update(dt, t, wally.pos)) { toast_(f.text, 'good'); sound.play.powerup(); }
  for (const p of reef.pearls) {
    if (p.taken || atTop) continue;
    if (Math.hypot(wally.pos.x - p.x, wally.pos.z - p.z) < 1.6) {
      p.taken = true; p.mesh.userData.pearl.visible = false; game.pearls++; game.found++; game.points += PEARL_POINTS; addPoints('pickup');
      sound.play.goal(); fx.burst(p.mesh.position.clone().setY(SWIM_Y), [0xffffff, 0xffd6f0], 10);
      toast_(`A pearl! ${game.pearls} now`, 'good'); bookEvent('pearl');
    }
  }
  // Reef treasures: picked up by swimming through one at its depth.
  for (const tr of treasures) {
    if (tr.taken) continue;
    tr.phase += dt;
    if (tr.rests) {
      // A starfish (Ken): on the seabed, touched, never taken. A touch makes it glow, once a dive.
      if (tr.touched) { const k = 1 + Math.sin(tr.phase * 4) * 0.08; tr.thing.scale.setScalar(k); tr.thing.material.emissiveIntensity = 1.6; }
      if (!tr.touched && !atTop && canTouchStarfish(wally.pos.x, wally.pos.z, game.depth, tr.x, tr.z)) {
        const T = TREASURES[tr.kind]; tr.touched = true;
        game.treasure += T.points; game.treasures++; game.points += T.points; bookEvent('starfish'); addPoints('pickup');
        sound.play.goal(); fx.burst(tr.mesh.position.clone(), [0xff9a5a, 0xffd0a0], 10);
        toast_(`A starfish! It glows where Wally touched it (+${T.points})`, 'good');
      }
      continue;
    }
    tr.thing.rotation.y += dt * 1.6;
    tr.mesh.position.y = tr.y + Math.sin(tr.phase * 2) * 0.12;
    if (!atTop && canCollect(wally.pos.x, wally.pos.z, game.depth, tr.x, tr.z, tr.y)) {
      const T = TREASURES[tr.kind];
      tr.taken = true; tr.mesh.visible = false;
      game.treasure += T.points; game.treasures++; game.points += T.points; addPoints('pickup');
      if (tr.kind === 'shell' || tr.kind === 'conch') { game.shells++; bookEvent('shell'); }   // seashells: sold to the Kuranda market vendor for gold
      if (tr.kind === 'conch') bookEvent('conch');
      sound.play.goal(); fx.burst(tr.mesh.position.clone(), tr.kind === 'conch' ? [0xffc8a0, 0xffffff] : tr.kind === 'shell' ? [0xfff0d0, 0xffffff] : [0xff9a5a, 0xffd0a0], 10);
      toast_(`+${T.points} ${T.name}!`, 'good');
    }
  }
  // Box jellyfish: a sting knocks the air out of him.
  for (const j of reef.jellies) {
    j.cool = Math.max(0, j.cool - dt);
    if (j.cool > 0 || atTop) continue;
    if (Math.hypot(wally.pos.x - j.m.position.x, wally.pos.z - j.m.position.z) < 1.5 && Math.abs(game.depth - j.m.position.y) < 1.1) {   // only at its own depth: change depth to slip past
      j.cool = 2; game.air = Math.max(0, game.air - AIR.sting); game.stun = 0.6; bookEvent('hurt');
      wally.knock(j.m.position.x, j.m.position.z); fx.shake(0.4, 0.3); sound.play.sting();
      toast_('Box jelly! Lost some air', 'bad'); if (reaction()) bubbles.say(wally.root, pickLine('wallySting'), 3.4);
    }
  }
  // The giant clam (Ken): in a dead end of the coral maze. Paid the Big Golden
  // Mango from the Esplanade, it opens and gives up the pearl key (a trade,
  // undone if this attempt fails: the mango came from another area).
  if (!game.hasPearlKey && !atTop && Math.hypot(wally.pos.x - clam.x, wally.pos.z - clam.z) < 3.4) {
    const t = Trip.trade(progress.trip, attempt, { item: 'big-golden-mango', n: 1 }, { item: 'pearl-key', n: 1 });
    if (t.ok) {
      attempt = t.attempt; game.hasPearlKey = true; game.keyRise = 0; bookEvent('clam');
      sound.play.powerup(); fx.burst(new THREE.Vector3(clam.x, SEABED_Y + 1.5, clam.z), [0xffffff, 0xffd6f0, 0xffd166], 26);
      toast_('The giant clam takes the Big Golden Mango... and opens. The pearl key!', 'good');
      bubbles.say(wally.root, 'A key made of pearl! Now for that chest!', 3.4);
    } else if (game.hint <= 0) { toast_('The giant clam is shut tight. It wants the Big Golden Mango from the Esplanade', 'info'); game.hint = 5; }
  }
  clam.model.set(clam.model.openness + ((game.hasPearlKey ? 1 : 0) - clam.model.openness) * Math.min(1, dt * 2));
  if (clam.key) { clam.key.visible = game.hasPearlKey && game.keyRise < 2.5; if (clam.key.visible) { game.keyRise += dt; clam.key.position.y = SEABED_Y + 0.8 + Math.min(1.6, game.keyRise); clam.key.rotation.y += dt * 2; } }
  // The pirate chest, at the end of the cave maze: locked until he has the pearl key.
  const ch = reef.chest;
  if (!game.chest && game.inCave && Math.hypot(wally.pos.x - ch.x, wally.pos.z - ch.z) < 2.2) {
    if (game.hasPearlKey) {
      game.chest = true; ch.opened = true; ch.mango.visible = true; bookEvent('chest');
      attempt = Trip.gain(Trip.gain(attempt, 'talisman-moon'), 'skyrail-pass'); addPoints('talisman');   // the moon talisman and the ride up; kept when the reef is completed
      setTimeout(() => foundTalisman('talisman-moon', toast_), 1600);          // new: the sceptre card; already sealed: a random useful prize (revisit.js)
      game.points += CHEST_POINTS; wally.cheer = 1.2;
      sound.play.powerup(); fx.burst(new THREE.Vector3(ch.x, SEABED_Y + 1.5, ch.z), [0xffd700, 0xffb51f, 0xffffff], 24);
      toast_('The pearl key fits! The Skyrail pass, the way up to Kuranda', 'good');
      bubbles.say(wally.root, 'Pirate treasure! Crikey!', 3.4);
    } else if (game.hint <= 0) { toast_('Locked! The giant clam in the coral maze has the key', 'info'); game.hint = 5; }
  }

  // Out with the treasure and up for air: that is the level.
  if (game.chest && !game.done && game.depth > -1.0 && !inMaze(maze, wally.pos.x, wally.pos.z, MAZE.ox, MAZE.oz, MAZE.size, 1)) {
    game.done = true; wally.cheer = 1.5; bubbles.say(wally.root, 'Treasure and pearls! What a day!', 3.4);
    setTimeout(() => finish(true), 2400);
  }

  // Out of air: a life gone, and Kenny paddles out with the Vegemite.
  if (game.faint > 0) rescueStep(dt, t);
  else if (game.air <= 0 && !game.done) { if (!outOfAir()) return; }
  if (kennyPoser && kennyPoser.ok) kennyPoser.pose({ time: t, cheer: game.faint > 0 ? 1 : 0.3, napping: false });

  guideStep(dt, t);
  arrowStep();
  looks(camera.position.y < -0.2, game.inCave);
  caveLight.intensity = game.inCave ? 14 : 0;
  caveLight.position.set(wally.pos.x, game.depth + 2.5, wally.pos.z);
  drawHud();
}

// ---- Camera ------------------------------------------------------------------------------
const camTarget = new THREE.Vector3();
function followCamera(dt) {
  camTarget.lerp(wally.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), Math.min(1, dt * 6));
  cam.manual = Math.max(0, cam.manual - dt);
  if (game.running && cam.manual <= 0) {                // on a leash behind him
    const dx = camera.position.x - camTarget.x, dz = camera.position.z - camTarget.z;
    // Steering (the default): the camera swings round behind him as he turns.
    if (steering()) cam.yaw = easeBehind(cam.yaw, wally.facing, dt);
    else if (dx * dx + dz * dz > 0.01) cam.yaw = Math.atan2(dx, dz);
  }
  const under = game.depth < -1.2;
  // In a maze, look down into it from steep and close, staying under the surface.
  const inAMaze = under && (game.inCave || inMaze(outer, wally.pos.x, wally.pos.z, OUTER.ox, OUTER.oz, OUTER.size));
  // Nearly straight down, so the corridors show instead of the walls beside him.
  if (inAMaze) { cam.pitch += (1.38 - cam.pitch) * Math.min(1, dt * 3); cam.dist += (7.5 - cam.dist) * Math.min(1, dt * 3); }
  const cp = Math.cos(cam.pitch);
  camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
  if (under) camera.position.y = Math.min(-0.9, Math.max(SEABED_Y + 0.8, camera.position.y));
  else if (camera.position.y < 0.8) camera.position.y = 0.8;
  camera.lookAt(camTarget);
  const jolt = fx.shakeOffset(dt); if (jolt) camera.position.add(jolt);
  sun.target.position.copy(wally.pos); sun.position.copy(wally.pos).add(sunOffset);
}

// ---- Screens ----------------------------------------------------------------------------
function drawHud() {
  $('score').textContent = game.points.toLocaleString();
  $('mangoes').textContent = game.mangoes;
  $('pearls').textContent = game.pearls;
  $('energy-fill').style.width = `${Math.max(0, game.air / AIR.max * 100)}%`;
  $('feed').classList.toggle('red', game.air < 25);
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  $('job').textContent = game.chest ? 'Out of the cave and up for air!'
    : !game.hasPearlKey ? (game.depth > -1.2 ? 'Dive! Find the giant clam in the coral maze' : 'Find the giant clam in a dead end of the coral maze')
    : game.inCave ? 'Find the pirate chest in the cave' : 'Follow the guide fish to the coral cave';
  // Under water, which depth he is at, and the treasures found (shells, starfish, conches).
  if (game.depth < -1.2) {
    const i = LANES.reduce((b, y, k) => Math.abs(y - game.depth) < Math.abs(LANES[b] - game.depth) ? k : b, 0);
    $('job').textContent += ` · Depth: ${LANE_NAMES[i]} · Treasures: ${game.treasures}/${treasures.length}`;
  }
}

function start() {
  if (!entry.ok && !testingAll) { toast_('The reef opens with the Big Golden Mango from the Esplanade', 'bad'); return; }
  recordVisit('reef');
  // The first time here: the fly-over first, with the frame-rate check running
  // (quality.js) so the detail is right before he moves. Then play begins.
  if (intro.due()) { $('title').hidden = true; sound.start(); intro.play(camera, begin); return; }
  begin();
}
function begin() {
  showTip('clam', 'A giant clam waits in a dead end of the coral maze. Bring it the Big Golden Mango and it gives up the pearl key; the key opens the pirate chest in the cave.');
  sound.start(); sound.startMusic('reef');
  $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true;
  bubbles.say(wally.root, game.hasPearlKey ? "G'day! I've got the pearl key. Let's find that chest!" : "G'day! Somewhere down there is a giant clam...", 3.6, 3);
}

function setPaused(p) { if (!game.running) return; game.paused = p; $('paused').hidden = !p; }

function finish(won, why = '') {
  game.running = false;
  $('hud').hidden = true; $('touch').hidden = true; $('dive-buttons').hidden = true; $('arrow').hidden = true;
  const s = reefRunScore({ found: game.found, chest: game.chest, airLeft: game.air, finished: won, treasure: game.treasure });
  const stars = won ? starsFor(s.total, REEF_STARS) : 0;
  if (won) sound.fanfare();                         // Wally's theme hook: well done, mate
  {
    // Keep only on completion (trip-rules.js): pearls and shells found, the pearl
    // key and the Skyrail pass; the Big Golden Mango is spent. A failed dive keeps
    // nothing, and the Big Golden Mango (from the Esplanade) is still his.
    if (won) {
      bookEvent('finish');
      const done = Trip.completeAttempt(progress.trip, Trip.gain(Trip.gain(attempt, 'pearl', game.found), 'seashell', game.shells), { objectiveMet: true });
      if (done.ok) { progress.trip = done.trip; bankRun({ stars }); }
      progress = completeArea(progress, 'reef', { score: s.total, stars, mangoes: game.mangoes, pearls: game.found, shells: game.shells });
    } else { progress.trip = Trip.failAttempt(progress.trip, attempt).trip; failRun(); }   // nothing from this run is kept, points included (points.js)
    try { localStorage.setItem('chomp-progress', JSON.stringify(progress)); } catch { /* not saved */ }
  }
  $('result-title').textContent = won ? 'Found the pirate treasure!' : why === 'air' ? 'Out of air!' : 'Not this time';
  $('result-why').textContent = won ? '' : 'Kenny can only bring his jar so many times. Swim up for air sooner, and use the bubble vents.';
  markRetry(won, 'the reef');
  $('result-stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Pearls found', `${game.found} (${s.pearls})`], ['Reef treasures', `${game.treasures}/${treasures.length} (${s.treasure})`], ['Seashells (for the Kuranda markets)', game.shells], ['Pearl key from the giant clam', game.hasPearlKey ? 'yes' : 'no'], ['Pirate chest', s.chest], ['Air left bonus', s.finishBonus], ['Total', s.total]]) {
    const li = document.createElement('li'); li.innerHTML = '<span></span><b></b>'; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  $('postcard').hidden = !won;
  $('postcard-text').textContent = POSTCARDS.reef;
  $('result').hidden = false;
  showLeaderboard($('board'), 'reef', won ? s.total : 0, won ? stars : 0);   // finished runs go on the board; the top ten either way
  window.chomp.result = { won, ...s, stars, found: game.found, spent: game.spent };
}

$('play').onclick = start;
$('resume').onclick = () => setPaused(false);
$('again').onclick = () => location.reload();
addEventListener('visibilitychange', () => { if (document.hidden && game.running) setPaused(true); });

// ---- Loop ----------------------------------------------------------------------------------
let t = 0, last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  if (game.running && !game.paused) step(dt, t);
  bubbles.update(dt); fx.update(dt, t);
  islandTrees.update(t);                            // the breeze in the palms
  followCamera(dt);
  intro.update(dt, camera);                       // the first-visit fly-over, when it plays
  { const night = daynight.update(game.paused ? 0 : dt, camera); lamps.update(dt, night, wally.pos); }
  fpsWatch(dt);
  post.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play')) start();

// The map, from anywhere (mapmodal.js): the Map button or Tab. Play pauses while it is open.
installMap({ pause: on => { if (game.running) game.paused = on; } });
installShop({ pause: on => { if (game.running) game.paused = on; } });
installBook({ here: 'reef', pause: on => { if (game.running) game.paused = on; } });
installGear({ scene, wally, hasAir: true, noFeed: true, underWater: () => game.depth < -1.0, toast: (t, k) => toast_(t, k), openBook: () => openBook('wally'), running: () => game.running && !game.paused, pause: on => { if (game.running) game.paused = on; } });
window.chompStartHere = () => { if (!game.running) start(); };
window.chompDress = () => {
  const p = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
  wally.changeModel(models.get(outfitModel(p)) || models.get('wally'));     // a whole-model outfit goes on now
  if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(p, 'wally'));
};
