// skyrail.js
// The Skyrail (Ken, 2026-10-19): the ride from the valley station near Cairns up
// over the rainforest canopy to Kuranda. "It must be breathtaking, as the real one
// is." A cinematic of about a minute: the gondola leaves the valley station, glides
// up the range just above the canopy with the coast and the Coral Sea opening out
// behind, crosses the Barron Gorge with the falls at its head, and comes into
// Kuranda. Played the first time Wally heads for Kuranda (the map sends him here),
// skippable, and then on to the village (kuranda.html). Watch it again any time
// at skyrail.html.
//
// The land is one height function (height below): the coastal plain and the sea
// at the valley end (x < 0), the range rising, the plateau at Kuranda (x = L), and
// the Barron Gorge crossing the line near the top, Ken's falls model at its head.
// Distances are compressed so the ride takes a minute, not the real fifteen or so.

import * as THREE from 'three';
import { loadModels, ModelSkin } from '../models.js';
import { createPost } from '../post.js';
import { pickQuality, isTouchDevice, pixelRatioFor } from '../quality.js';
import * as sound from '../sound.js';
import { loadRealism } from '../realism.js';
import { L, TOP, GORGE, height, buildRange } from './range-land.js';
import { addSky, addLights } from '../world.js';
import { readProgress, outfitModel } from '../progress.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const NEXT = params.get('next') || 'kuranda.html';
const touch = isTouchDevice();
const quality = pickQuality();

// ---- Stage --------------------------------------------------------------------------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality)); renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 6000);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const light = touch || quality.name === 'low';
const models = await loadModels(['wally', 'wally-explorer', 'kenny'], { light });
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light });
let skyDome = null;
if (realism && realism.sky) { scene.background = realism.sky.background; scene.environment = realism.sky.environment; scene.environmentIntensity = 0.6; }
else skyDome = addSky(scene);
const sun = addLights(scene, quality); scene.add(sun.target);
scene.fog = new THREE.Fog(0xcfd8d6, 450, 3600);              // a soft late-afternoon haze, near the sky's own colour, the far ranges soft
const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));

// ---- The land (range-land.js, shared with the Kuranda train) ---------------------------------
const land = buildRange(scene, { quality, light, sun, clear: (x, z) => x > L - 40 && x < L + 110 && Math.abs(z) < 60 });   // the top station's clearing
const trees = land.trees;

// ---- The line: towers, two cables, the stations ---------------------------------------------
const steelMat = new THREE.MeshStandardMaterial({ color: 0x5f6b62, metalness: 0.6, roughness: 0.45 });
const TOWERS = [40, 230, 420, 610, 790, 960, 1130, 1290, 1500, 1640];
const towerTop = x => height(x, 0) + (x > 1250 && x < 1550 ? 70 : 48);
function tower(x) {
  const base = height(x, 0), h = towerTop(x) - base, g = new THREE.Group();
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {        // four legs, leaning in
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 6), steelMat);
    leg.position.set(dx * 0.6, h / 2, dz * 0.6); leg.rotation.set(-dz * 0.03, 0, dx * 0.03); g.add(leg);
  }
  for (let y = h * 0.18; y < h; y += h * 0.18) { const brace = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 3.4), steelMat); brace.position.y = y; g.add(brace); }
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 14), steelMat); arm.position.y = h; g.add(arm);
  g.position.set(x, base, 0); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
}
TOWERS.forEach(tower);
// The cable's path: tower top to tower top, sagging between, from station to station.
const STATIONS = { bottom: { x: -12, y: height(-12, 0) + 8 }, top: { x: L + 40, y: height(L + 40, 0) + 8 } };
const ends = [[STATIONS.bottom.x, STATIONS.bottom.y], ...TOWERS.map(x => [x, towerTop(x)]), [STATIONS.top.x, STATIONS.top.y]];
const cablePts = [];
for (let i = 0; i < ends.length - 1; i++) {
  const [x0, y0] = ends[i], [x1, y1] = ends[i + 1], span = x1 - x0;
  for (let k = 0; k < 12; k++) { const u = k / 12; cablePts.push(new THREE.Vector3(x0 + span * u, y0 + (y1 - y0) * u - span * 0.035 * 4 * u * (1 - u), 0)); }
}
cablePts.push(new THREE.Vector3(...ends[ends.length - 1], 0));
const cable = new THREE.CatmullRomCurve3(cablePts);
for (const z of [-6, 6]) {
  const line = new THREE.Mesh(new THREE.TubeGeometry(cable, 600, 0.12, 5), steelMat);
  line.position.z = z; scene.add(line);
}
function station({ x, y }, roof) {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 30), new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.9 })); deck.position.y = -7; g.add(deck);
  const top = new THREE.Mesh(new THREE.ConeGeometry(26, 9, 4), new THREE.MeshStandardMaterial({ color: roof, roughness: 0.6 })); top.rotation.y = Math.PI / 4; top.position.y = 6; top.scale.set(1, 1, 0.75); g.add(top);
  for (const [px, pz] of [[-14, -12], [14, -12], [-14, 12], [14, 12]]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 12, 8), steelMat); post.position.set(px, -1, pz); g.add(post); }
  const ground = height(x, 0); const plinth = new THREE.Mesh(new THREE.BoxGeometry(34, Math.max(1, y - 8 - ground), 30), new THREE.MeshStandardMaterial({ color: 0x7c766c })); plinth.position.y = -8 - Math.max(1, y - 8 - ground) / 2; g.add(plinth);
  g.position.set(x, y, 0); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
}
station(STATIONS.bottom, 0x2f6e4f); station(STATIONS.top, 0x8a5a3a);

// ---- The gondolas: Wally's, and the others gliding up and down ------------------------------
const HANG = 4.2;                                  // from the cable down to the middle of a cabin
function gondola(withWally) {
  const g = new THREE.Group(), cabin = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x1f6b45, roughness: 0.4, metalness: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe4ee, roughness: 0.05, transmission: 0.7, transparent: true, opacity: 0.35, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 2.6), paint); floor.position.y = -1.1; cabin.add(floor);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.5, 2.7), new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.7, roughness: 0.3 })); roof.position.y = 1.15; cabin.add(roof);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.7, 2.5), glass); windows.position.y = 0.1; cabin.add(windows);
  for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), paint); post.position.set(x, 0.1, z); cabin.add(post); }
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, HANG - 1.3, 0.18), steelMat); arm.position.y = 1.3 + (HANG - 1.3) / 2; cabin.add(arm);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.5), steelMat); grip.position.y = HANG; cabin.add(grip);
  if (withWally) {
    const progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
    const wg = models.get(outfitModel(progress)) || models.get('wally');
    if (wg) { const w = new ModelSkin(wg, { height: 1.55 }); w.root.position.set(0.35, -0.65, 0); w.root.rotation.y = Math.PI / 2; cabin.add(w.root); }
    const kg = models.get('kenny');
    if (kg) { const k = new ModelSkin(kg, { height: 0.7 }); k.root.position.set(-0.55, -0.65, 0.4); k.root.rotation.y = Math.PI / 2; cabin.add(k.root); }
  }
  cabin.position.y = -HANG; g.add(cabin);
  g.traverse(o => { if (o.isMesh && o.material !== glass) o.castShadow = true; });
  scene.add(g);
  return g;
}
const LENGTH = cable.getLength();
const others = [];
for (let i = 0; i < 16; i++) others.push({ g: gondola(false), s: i / 16, dir: i % 2 ? 1 : -1 });
const ride = gondola(true);
// Where a gondola is: u along the cable (0 to 1), on the up line (+6) or down (-6).
function placeOn(g, u, z, t) {
  const p = cable.getPointAt(Math.min(1, Math.max(0, u)));
  g.position.set(p.x, p.y, z);
  g.rotation.z = Math.sin(t * 0.9 + u * 40) * 0.02;                    // a gentle sway
}

// ---- The cinematic --------------------------------------------------------------------------
// The gondola's place along the line over time, easing out of the station and into the top.
const DURATION = 64, LEAVE = 4, ARRIVE = 58;
const rideU = t => { const k = Math.min(1, Math.max(0, (t - LEAVE) / (ARRIVE - LEAVE))); return k * k * (3 - 2 * k); };
const FALLS_LOOK = new THREE.Vector3(GORGE.x, TOP - 80, GORGE.head + 150);
// The shots, each a camera position and a point to look at, from the gondola's
// place (gp), its way forward (fw) and the time. Captions name the place.
const SHOTS = [
  { at: 0,  caption: 'Skyrail: from the valley to Kuranda', cam: () => ({ pos: new THREE.Vector3(-70, STATIONS.bottom.y + 6, 46), look: new THREE.Vector3(160, STATIONS.bottom.y + 40, 0) }) },
  { at: 9,  caption: 'Over the rainforest canopy', cam: (gp, fw) => ({ pos: gp.clone().addScaledVector(fw, -30).add(new THREE.Vector3(0, 6, 22)), look: gp.clone().addScaledVector(fw, 40).add(new THREE.Vector3(0, -6, 0)) }) },
  { at: 21, caption: 'Looking back to the Coral Sea', cam: (gp) => ({ pos: gp.clone().add(new THREE.Vector3(1.6, -HANG + 0.4, 6)), look: new THREE.Vector3(-900, 0, 60) }) },
  { at: 31, caption: '', cam: (gp, fw) => ({ pos: gp.clone().add(new THREE.Vector3(-40, 50, 170)), look: gp.clone().addScaledVector(fw, 60) }) },
  { at: 43, caption: 'The Barron Gorge', cam: () => ({ pos: new THREE.Vector3(GORGE.x + 170, TOP + 140, 300), look: new THREE.Vector3(GORGE.x - 20, TOP - 90, GORGE.head + 160) }) },   // high and wide, up the gorge to the falls; the gondola crosses small against it
  { at: 53, caption: 'Kuranda', cam: () => ({ pos: new THREE.Vector3(STATIONS.top.x + 80, STATIONS.top.y + 22, 52), look: new THREE.Vector3(STATIONS.top.x - 60, STATIONS.top.y - 2, 0) }) },
];
const BLEND = 2.2;                                 // seconds to swing from one shot to the next
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let t = 0, playing = false, captionNow = null;

function shotAt(i, gp, fw) { return SHOTS[i].cam(gp, fw); }
function frameCamera() {
  const u = rideU(t), gp = cable.getPointAt(u).setZ(6), fw = cable.getTangentAt(Math.min(0.999, Math.max(0.001, u))).normalize();
  let i = 0; while (i < SHOTS.length - 1 && t >= SHOTS[i + 1].at) i++;
  const a = shotAt(i, gp, fw);
  const into = t - SHOTS[i].at;
  if (i > 0 && into < BLEND) {                                         // swing smoothly out of the last shot
    const b = shotAt(i - 1, gp, fw), k = into / BLEND, e = k * k * (3 - 2 * k);
    camPos.copy(b.pos).lerp(a.pos, e); camLook.copy(b.look).lerp(a.look, e);
  } else { camPos.copy(a.pos); camLook.copy(a.look); }
  camera.position.copy(camPos); camera.lookAt(camLook);
  // The caption of the shot, faded in and out.
  const cap = SHOTS[i].caption, el = $('cine-caption');
  if (cap !== captionNow) { captionNow = cap; el.textContent = cap; el.hidden = !cap; el.classList.add('fade'); requestAnimationFrame(() => el.classList.remove('fade')); }
  return { u, gp };
}

function finish() {
  try { localStorage.setItem('chomp-skyrail-seen', '1'); } catch { /* shown again next time */ }
  location.href = NEXT;
}
function start() {
  sound.start(); sound.startMusic('theme');
  $('title').hidden = true; playing = true; t = 0;
}
$('ride').onclick = start;
$('skip').onclick = e => { e.preventDefault(); finish(); };
addEventListener('keydown', e => { if (playing && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) finish(); });
canvas.addEventListener('pointerdown', () => { if (playing) finish(); });
if (params.has('play')) start();

// ---- Loop -----------------------------------------------------------------------------------
let last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing) { t += dt; if (t >= DURATION) { playing = false; finish(); } }
  const { u, gp } = frameCamera();
  placeOn(ride, u, 6, now / 1000);
  for (const o of others) { o.s = (o.s + dt * 0.006 * o.dir + 1) % 1; placeOn(o.g, o.s, o.dir > 0 ? 6 : -6, now / 1000 + o.s * 9); }
  if (!playing && !$('title').hidden) { t = Math.min(t + dt * 0.4, 3); }              // behind the title: the station, the gondola waiting
  trees.update(now / 1000);
  if (land.fallsTex) land.fallsTex.offset.y -= dt * 0.8;           // the falls pour
  if (skyDome) skyDome.position.copy(camera.position);
  sun.position.copy(gp).add(new THREE.Vector3(260, 150, -200)); sun.target.position.copy(gp);   // late afternoon, low over the range
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90; sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90; sun.shadow.camera.far = 700; sun.shadow.camera.updateProjectionMatrix();
  post.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.chomp = { scene, camera, cable, height, get t() { return t; }, set t(v) { t = v; }, start };
