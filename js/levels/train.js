// train.js
// The Kuranda Scenic Railway (Ken, 2026-10-21; MASTER.md section 6, the rescue): a cinematic
// of about thirty seconds, a few short shots at different places, as Ken asked. Wally (with the
// sceptre at full power) takes the historic train from Kuranda down the range to Cairns, on his
// way to Croc Park to bring out the crocs:
//   Kuranda Railway Station (Ken's photo: red corrugated roof with dormers and finials, cream
//   walls, the curved awning over the platform, ferns), Barron Falls from the line (Ken's falls
//   model), the Stoney Creek bridge (the curved steel trestle beside the falls, Ken's photo), the
//   train curving round Robb's Monument (Ken's photo), then down to Cairns and on to Croc Park.
// The line is train-rules.js (tested); the land is shared with the Skyrail (range-land.js).
// The train: a blue and yellow locomotive, maroon carriages with a cream window band (Ken's photos).

import * as THREE from 'three';
import { installVR, inVR } from '../vr.js';
import { loadModels, ModelSkin } from '../models.js';
import { createPost } from '../post.js';
import { pickQuality, isTouchDevice, pixelRatioFor } from '../quality.js';
import * as sound from '../sound.js';
import { loadRealism } from '../realism.js';
import { Trees } from '../trees.js';
import { addSky, addLights } from '../world.js';
import { readProgress, outfitModel, wearing } from '../progress.js';
import { dressOutfit } from '../outfit.js';
import { GORGE, height, buildRange } from './range-land.js';
import { ROUTE, FALLS_STOP, buildLine, runs, stoneyCreek, at } from './train-rules.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const NEXT = params.get('next') || 'rescue.html?go';           // Croc Park, to bring out the crocs
const touch = isTouchDevice();
const quality = pickQuality();
const light = touch || quality.name === 'low';

// ---- Stage --------------------------------------------------------------------------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality)); renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 6000);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const models = await loadModels(['wally', 'wally-explorer', 'kenny'], { light });
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light });
let skyDome = null;
if (realism && realism.sky) { scene.background = realism.sky.background; scene.environment = realism.sky.environment; scene.environmentIntensity = 0.6; }
else skyDome = addSky(scene);
const sun = addLights(scene, quality); scene.add(sun.target);
scene.fog = new THREE.Fog(0xcfd8d6, 450, 3600);
const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));

// ---- The line, and the land cut to it -------------------------------------------------------
const line = buildLine();
const RUNS = runs(line);
// Which line point is nearest a spot: a grid of the line's points, 25 m cells.
const CELL = 25, grid = new Map();
line.forEach((p, i) => { const k = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`; (grid.get(k) || grid.set(k, []).get(k)).push(i); });
function nearest(x, z) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); let best = -1, bd = Infinity;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const i of grid.get(`${cx + a},${cz + b}`) || []) {
    const d = Math.hypot(line[i].x - x, line[i].z - z); if (d < bd) { bd = d; best = i; }
  }
  return { i: best, d: bd };
}
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// The ground drawn along the line: cut down (or built up) to the rails in the open, left alone
// over the bridges (the gully shows under them) and over the tunnels (the hill stays whole).
// Barron Falls: from the line it is seen across the gorge, a white cascade with a plume of mist
// (the shared land's distant falls, as from the Skyrail). Ken's close-up model needs a gorge set
// built round it (as at the zip line); fitting it into this coarse land left its cut sides showing.
const FALLS = { z0: GORGE.head + 10 };
FALLS.cx = GORGE.x + Math.sin((FALLS.z0 + 50) * 0.006) * 28; FALLS.lip = height(FALLS.cx, FALLS.z0) - 4;
function shape(x, z, h) {
  const n = nearest(x, z);
  if (n.i < 0 || n.d > 20) return h;
  const p = line[n.i];
  if (p.kind !== 'open') return h;
  return h + (p.y - 0.45 - h) * (1 - smooth(5, 18, n.d));
}
// The stations' clearings, and the line itself, are kept free of trees.
const START = line[0], END = line[line.length - 1];
const clear = (x, z) => { const n = nearest(x, z); return (n.i >= 0 && n.d < 9 && line[n.i].kind !== 'tunnel') || Math.hypot(x - START.x, z - START.z) < 70 || Math.hypot(x - END.x, z - END.z) < 50 ; };
const land = buildRange(scene, { quality, light, sun, clear, shape, detail: quality.name === 'low' ? 1.3 : 1.6 });
sun.color.set(0xffe2b8); sun.intensity = 2.8;                    // morning light for the trip down

// ---- The track: ballast, sleepers and rails; steel trestles on the bridges; stone portals ------
const ballastMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 1 });
const railMat = new THREE.MeshStandardMaterial({ color: 0x7c7c80, metalness: 0.8, roughness: 0.35 });
const steelMat = new THREE.MeshStandardMaterial({ color: 0x55606a, metalness: 0.5, roughness: 0.5 });
const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.9 });
const side = i => { const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return { x: dz / l, z: -dx / l }; };
// A ribbon along the line from offset a to offset b, h above the rails' bed, over the samples kept.
function ribbon(a, b, h, keep, mat) {
  const pos = [], idx = [];
  let prev = -1;
  line.forEach((p, i) => {
    if (!keep(p)) { prev = -1; return; }
    const n = side(i), v = pos.length / 3;
    pos.push(p.x + n.x * a, p.y + h, p.z + n.z * a, p.x + n.x * b, p.y + h, p.z + n.z * b);
    if (prev >= 0) idx.push(prev, prev + 1, v, prev + 1, v + 1, v);
    prev = v;
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
}
ribbon(-2.3, 2.3, -0.05, p => p.kind === 'open', ballastMat);
ribbon(-1.6, 1.6, -0.25, p => p.kind === 'bridge', steelMat);           // the bridge deck
for (const o of [-1.6, 1.6]) { ribbon(o - 0.04, o + 0.04, 1.1, p => p.kind === 'bridge', railMat); }   // the handrails
{ // The deck's girders: a deep steel side under each edge.
  for (const o of [-1.5, 1.5]) {
    const pos = [], idx = []; let prev = -1;
    line.forEach((p, i) => { if (p.kind !== 'bridge') { prev = -1; return; } const n = side(i), v = pos.length / 3; pos.push(p.x + n.x * o, p.y - 0.25, p.z + n.z * o, p.x + n.x * o, p.y - 1.6, p.z + n.z * o); if (prev >= 0) idx.push(prev, v, prev + 1, prev + 1, v, v + 1); prev = v; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const mat = steelMat.clone(); mat.side = THREE.DoubleSide; scene.add(new THREE.Mesh(g, mat));
  }
}
for (const o of [-0.53, 0.53]) { ribbon(o - 0.05, o + 0.05, 0.18, () => true, railMat); }   // narrow gauge, 1067 mm
{
  const spots = []; let next = 0;
  line.forEach((p, i) => { if (p.s >= next && p.kind !== 'tunnel') { spots.push(i); next = p.s + 0.9; } });
  // Sleepers only near the cameras' spots would be enough, but they are cheap instanced boxes.
  const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.14, 0.24), sleeperMat, spots.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  spots.forEach((i, k) => { const p = line[i], n = side(i); E.set(0, Math.atan2(n.x, n.z) + Math.PI / 2, 0); Q.setFromEuler(E); M.compose(new THREE.Vector3(p.x, p.y + 0.08, p.z), Q, new THREE.Vector3(1, 1, 1)); sl.setMatrixAt(k, M); });
  sl.receiveShadow = true; scene.add(sl);
}
// Bridges: a steel trestle tower every few metres, down to the ground, braced.
for (const r of RUNS.filter(r => r.kind === 'bridge')) {
  let next = line[r.from].s;
  for (let i = r.from; i <= r.to; i++) {
    const p = line[i]; if (p.s < next) continue; next = p.s + 11;
    const drop = p.y - 0.3 - p.ground; if (drop < 2) continue;
    const g = new THREE.Group(), n = side(i);
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const spread = 1.4 + drop * 0.06;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, drop, 6), steelMat);
      leg.position.set(u * spread * 0.75, -drop / 2, v * 0.9); leg.rotation.z = -u * 0.06; g.add(leg);
    }
    for (let y = -drop + 3; y < -1; y += 4) { const brace = new THREE.Mesh(new THREE.BoxGeometry(2.6 + (-y) * 0.1, 0.12, 0.12), steelMat); brace.position.y = y; g.add(brace); const x2 = brace.clone(); x2.rotation.z = 0.6; g.add(x2); }
    g.position.set(p.x, p.y - 0.3, p.z); g.rotation.y = Math.atan2(n.x, n.z); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
  }
}
// Tunnel portals: a stone face with an arched opening, at each end of each tunnel.
const stone = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#8c8475'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 24) for (let x = (y / 24) % 2 ? -20 : 0; x < 256; x += 40) { g.fillStyle = `rgb(${120 + Math.random() * 30},${112 + Math.random() * 28},${98 + Math.random() * 22})`; g.fillRect(x + 2, y + 2, 36, 20); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
function portal(i, facing) {
  const shapeA = new THREE.Shape(); shapeA.moveTo(-6, 0); shapeA.lineTo(6, 0); shapeA.lineTo(6, 9); shapeA.lineTo(-6, 9); shapeA.closePath();
  const hole = new THREE.Path(); hole.moveTo(-2.4, 0); hole.lineTo(-2.4, 3.6); hole.absarc(0, 3.6, 2.4, Math.PI, 0, true); hole.lineTo(2.4, 0); hole.closePath(); shapeA.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shapeA, { depth: 1.2, bevelEnabled: false }); geo.translate(0, 0, -0.6);
  const map = stone.clone(); map.needsUpdate = true; map.repeat.set(0.25, 0.25);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: 0.95 }));
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 6), new THREE.MeshBasicMaterial({ color: 0x050505 })); dark.position.set(0, 3, -0.7); m.add(dark);
  const p = line[i], a = at(line, p.s + facing * 2);
  m.position.set(p.x, p.y - 0.2, p.z); m.lookAt(a.x, p.y - 0.2, a.z); m.castShadow = true; scene.add(m);
}
for (const r of RUNS.filter(r => r.kind === 'tunnel')) { portal(r.from, 1); portal(r.to, -1); }

// ---- The Stoney Creek bridge's falls (Ken's photo): a cascade down the hillside beside the bridge --
// It pours down the slope above the line on the uphill side and on under the bridge into the gully,
// laid on the land itself (no separate cliff), with spray where it lands.
const fallTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  for (let x = 0; x < 64; x++) for (let y = 0; y < 256; y += 2) { const v = 215 + Math.random() * 40; g.fillStyle = `rgba(${v},${v},${v - 6},${0.5 + Math.random() * 0.5})`; g.fillRect(x, y, 1, 2 + Math.random() * 10); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); return t;
})();
const SC = stoneyCreek(line), scMid = Math.round((SC.from + SC.to) / 2);
{
  const p = line[scMid], n = side(scMid);
  const up = height(p.x + n.x * 25, p.z + n.z * 25) > height(p.x - n.x * 25, p.z - n.z * 25) ? 1 : -1;
  SC.up = up;
  // A strip of water from 45 m up the slope, down through the bridge, to 25 m beyond into the gully,
  // each point on the land (a little above it), 7 m wide.
  const pos = [], idx = [], uv = [];
  for (let k = 0; k <= 30; k++) {
    const d = 45 - k * (70 / 30), x = p.x + n.x * up * d, z = p.z + n.z * up * d, y = height(x, z) + 0.6;
    for (const w of [-3.5, 3.5]) { const ax = -n.z * w, az = n.x * w; pos.push(x + ax, y, z + az); uv.push(w < 0 ? 0 : 1, k / 30 * 4); }
    if (k) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: fallTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, emissive: 0x3a3a38, roughness: 0.35 })));
  const mc = document.createElement('canvas'); mc.width = mc.height = 64; const mg = mc.getContext('2d'), r = mg.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); mg.fillStyle = r; mg.fillRect(0, 0, 64, 64);
  const mt = new THREE.CanvasTexture(mc), lx = p.x - n.x * up * 25, lz = p.z - n.z * up * 25;
  for (let k = 0; k < 6; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, opacity: 0.35, depthWrite: false })); sp.position.set(lx, height(lx, lz) + 2 + k * 2, lz); sp.scale.setScalar(10 + k * 3); scene.add(sp); }
}
// ---- Robb's Monument: the rock pillar the line curves round (Ken's photo) ------------------------
const ROBB = (() => {
  const open = RUNS.filter(r => r.kind === 'open' && r.from > SC.to && line[r.to].s - line[r.from].s > 70);
  const r = open[0] || RUNS.find(x => x.kind === 'open' && x.from > 50);
  const i = Math.round((r.from + r.to) / 2), p = line[i], n = side(i);
  const pillarGeo = new THREE.CylinderGeometry(2.2, 3.4, 14, 9, 4); const pp = pillarGeo.attributes.position;
  for (let k = 0; k < pp.count; k++) { const j = 0.8 + Math.random() * 0.4; pp.setX(k, pp.getX(k) * j); pp.setZ(k, pp.getZ(k) * j); }
  pillarGeo.computeVertexNormals();
  const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshStandardMaterial({ map: stone, color: 0x9a9284, roughness: 1, flatShading: true }));
  pillar.position.set(p.x + n.x * 3.4, p.y + 6, p.z + n.z * 3.4); pillar.castShadow = true; scene.add(pillar);
  return { i, s: p.s };
})();

// ---- Downtown Cairns (Ken): where the train pulls in. A low tropical city between the line's end and
// Palms along the Esplanade (the waterfront) and down the streets.
const cityPalms = new Trees(scene, { light });
for (let x = -320; x < -150; x += 22) for (let z = -225; z < 90; z += 11) { if (Math.random() < 0.55) cityPalms.add(Math.random() < 0.5 ? 'umbrella' : 'palm', x + 8 + Math.random() * 4, height(x, z), z + Math.random() * 3, 7 + Math.random() * 4); }   // street trees: Cairns is green
for (let z = -230; z < 90; z += 7) { const x = -380 + Math.sin(z * 0.004) * 60 + Math.sin(z * 0.011) * 18 + 30 + Math.random() * 4; cityPalms.add('palm', x, height(x, z), z, 10 + Math.random() * 4); }
cityPalms.build();

// ---- Kuranda Railway Station (Ken's photo), and the platform at Cairns -------------------------
function heading(i) { const a = line[Math.max(0, i - 2)], b = line[Math.min(line.length - 1, i + 2)]; return Math.atan2(b.x - a.x, b.z - a.z); }
function station(i, big) {
  const p = line[i], n = side(i), g = new THREE.Group(), y = p.y;
  // Red corrugated iron (Ken's photo): fine light and dark ridges.
  const ridges = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 8; const r = c.getContext('2d');
    for (let x = 0; x < 64; x++) { const k = 0.5 + 0.5 * Math.sin(x / 64 * Math.PI * 2 * 4); r.fillStyle = `rgb(${140 + k * 55},${36 + k * 20},${30 + k * 14})`; r.fillRect(x, 0, 1, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 1); return t; })();   // finer ridges, like real corrugated iron
  const red = new THREE.MeshStandardMaterial({ map: ridges, color: 0xc8a8a0, roughness: 0.62, metalness: 0.25 });   // a deeper, weathered tin red
  const cream = new THREE.MeshStandardMaterial({ color: 0xefe6cf, roughness: 0.85 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.7 });
  const len = big ? 56 : 30;
  // Gravel round the station and between the tracks.
  const gravelTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const r = c.getContext('2d'); r.fillStyle = '#9b9384'; r.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 2500; k++) { const v = 110 + Math.random() * 90; r.fillStyle = `rgb(${v},${v - 6},${v - 16})`; r.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 18); return t; })();
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(big ? 40 : 20, len + 30), new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 1 }));
  yard.rotation.x = -Math.PI / 2; yard.position.set(big ? 8 : 3, 0.06, 0); g.add(yard);
  // The platform: concrete with a yellow line along the edge.
  const plat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, len), new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.95 })); plat.position.set(3.9, 0.45, 0); g.add(plat);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, len), new THREE.MeshStandardMaterial({ color: 0xf2c418 })); edge.position.set(1.85, 0.91, 0); g.add(edge);
  if (big) {
    // The building: cream walls, a red corrugated roof with dormers and finials.
    const body = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 38), cream); body.position.set(11, 2.9, 0); g.add(body);
    const roofShape = new THREE.Shape(); roofShape.moveTo(-5.4, 0); roofShape.lineTo(5.4, 0); roofShape.lineTo(1.2, 3.6); roofShape.lineTo(-1.2, 3.6); roofShape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 40, bevelEnabled: false }), red); roof.position.set(11, 4.9, -20); g.add(roof);
    for (const z of [-12, 0, 12]) {
      const dShape = new THREE.Shape(); dShape.moveTo(-1.6, 0); dShape.lineTo(1.6, 0); dShape.lineTo(0, 1.6); dShape.closePath();
      const dormer = new THREE.Mesh(new THREE.ExtrudeGeometry(dShape, { depth: 2.6, bevelEnabled: false }), red); dormer.rotation.y = -Math.PI / 2; dormer.position.set(8.2, 6.6, z - 1.6 + 1.6); g.add(dormer);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 8), red); fin.position.set(11, 9.3, z); g.add(fin);
    }
    // The curved awning over the platform, on white posts.
    // A quarter round along the platform: high over the building side, curving down toward the track.
    const awning = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, len - 6, 20, 1, true, Math.PI * 0.55, Math.PI * 0.6), red.clone());
    awning.material.side = THREE.DoubleSide; awning.rotation.x = Math.PI / 2; awning.position.set(5.6, 2.2, 0); g.add(awning);
    for (let z = -len / 2 + 5; z < len / 2 - 4; z += 6) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.6, 8), white); post.position.set(3.2, 2.7, z); g.add(post); }
    // The sign, and the ferns and gardens along the platform.
    const c = document.createElement('canvas'); c.width = 512; c.height = 80; const sg = c.getContext('2d');
    sg.fillStyle = '#f6f3ea'; sg.fillRect(0, 0, 512, 80); sg.fillStyle = '#1d1d1d'; sg.font = 'bold 40px "Trebuchet MS", sans-serif'; sg.textAlign = 'center'; sg.fillText('KURANDA RAILWAY STATION', 256, 54);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.1), new THREE.MeshStandardMaterial({ map: t })); sign.position.set(6.95, 4.3, 14); sign.rotation.y = -Math.PI / 2; g.add(sign);
    // Ken: a very pretty station. Hanging baskets all along the eaves, ferns and flowers trailing
    // down from them; a lacy timber valance under the awning; gardens, benches and lamps.
    const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7d2a, roughness: 0.8, side: THREE.DoubleSide });
    const leaf2 = new THREE.MeshStandardMaterial({ color: 0x5c9a34, roughness: 0.8, side: THREE.DoubleSide });
    const bloom = ['#e84a8a', '#f5d23a', '#ff7a3a', '#ffffff', '#c25ad8'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    const wicker = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.9 });
    const chain = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.6, roughness: 0.5 });
    let seed = 13; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // A trailing fern frond: a stem with paired leaflets getting smaller to the tip, on a clear background.
    const frondTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
      x.strokeStyle = '#2f5a1e'; x.lineWidth = 3; x.beginPath(); x.moveTo(32, 0); x.quadraticCurveTo(36, 128, 30, 256); x.stroke();
      for (let k = 0; k < 22; k++) { const yy = 8 + k * 11, w = 26 * (1 - k / 24), g2 = 70 + (k % 3) * 18;
        x.fillStyle = `rgb(${50 + k},${110 + g2 / 3},${38})`;
        for (const sgn of [-1, 1]) { x.beginPath(); x.ellipse(32 + sgn * w * 0.55, yy, w * 0.55, 4.2, sgn * 0.5, 0, Math.PI * 2); x.fill(); } }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const frond = new THREE.MeshStandardMaterial({ map: frondTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8 });
    function basket(x, y, z) {
      const b = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), wicker); pot.rotation.x = Math.PI; b.add(pot);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), chain); line.position.y = 0.38; b.add(line);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), rnd() < 0.5 ? leaf : leaf2); top.scale.set(1, 0.45, 1); top.position.y = 0.05; b.add(top);
      for (let k = 0; k < 14; k++) {                             // fern fronds spilling over the rim and trailing down
        const a = k / 14 * Math.PI * 2 + rnd() * 0.3, len = 0.7 + rnd() * 1.1;
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.32, len), frond);
        f.geometry.translate(0, -len / 2, 0);
        f.position.set(Math.cos(a) * 0.26, 0.1, Math.sin(a) * 0.26); f.rotation.order = 'YXZ'; f.rotation.y = -a + Math.PI / 2; f.rotation.x = -0.35 - rnd() * 0.3;   // out over the rim, then down
        b.add(f);
      }
      for (let k = 0; k < 6; k++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), bloom[Math.floor(rnd() * bloom.length)]); const a = rnd() * 6.3; fl.position.set(Math.cos(a) * 0.3, 0.1 - rnd() * 0.5, Math.sin(a) * 0.3); b.add(fl); }
      b.position.set(x, y, z); g.add(b);
    }
    for (let z = -len / 2 + 4; z < len / 2 - 3; z += 3) basket(3.0, 3.35, z);            // under the awning's edge, along the platform
    for (let z = -17; z < 18; z += 3.2) basket(6.85, 4.0, z);                            // along the building's eaves
    // The valance: a lacy timber fringe hanging from the awning's edge.
    const lace = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#f6f3ea';
      for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 32, 0); x.lineTo(i * 32 + 32, 20); x.arc(i * 32 + 16, 20, 16, 0, Math.PI, false); x.closePath(); x.fill(); x.clearRect(i * 32 + 12, 6, 8, 8); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set((len - 6) / 2, 1); return t; })();
    const val = new THREE.Mesh(new THREE.PlaneGeometry(len - 6, 0.5), new THREE.MeshStandardMaterial({ map: lace, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 }));
    val.rotation.y = Math.PI / 2; val.position.set(2.7, 3.75, 0); g.add(val);
    // Garden beds of ferns and flowers along the building, benches and lamps on the platform.
    for (let z = -16; z < 17; z += 4) {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 3), new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 1 })); bed.position.set(6.6, 1.05, z); g.add(bed);
      for (let k = 0; k < 6; k++) { const bush = new THREE.Mesh(new THREE.SphereGeometry(0.3 + rnd() * 0.2, 8, 6), rnd() < 0.5 ? leaf : leaf2); bush.position.set(6.5 + (rnd() - 0.5) * 0.6, 1.4, z + (k - 2.5) * 0.5); g.add(bush); }
      for (let k = 0; k < 5; k++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), bloom[Math.floor(rnd() * bloom.length)]); fl.position.set(6.4 + (rnd() - 0.5) * 0.7, 1.65, z + (rnd() - 0.5) * 2.6); g.add(fl); }
    }
    const benchWood = new THREE.MeshStandardMaterial({ color: 0x6e4a2c, roughness: 0.8 }), iron = new THREE.MeshStandardMaterial({ color: 0x1f3a2a, metalness: 0.5, roughness: 0.5 });
    for (const z of [-12, 0, 12]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.8), benchWood); seat.position.set(5.6, 1.35, z); g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.8), benchWood); back.position.set(5.85, 1.65, z); g.add(back);
      for (const dz of [-0.8, 0.8]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.06), iron); leg.position.set(5.6, 1.12, z + dz); g.add(leg); }
    }
    for (const z of [-20, -6, 6, 20]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 8), iron); post.position.set(4.6, 2.5, z); g.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd88a, emissiveIntensity: 0.6 })); lamp.position.set(4.6, 4.2, z); g.add(lamp);
    }
    const fern = new THREE.MeshStandardMaterial({ color: 0x4f8a2c, roughness: 0.8, side: THREE.DoubleSide });
    for (let z = -len / 2 + 3; z < len / 2; z += 3.2) for (let k = 0; k < 7; k++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.6), fern); f.position.set(6.6, 1.5, z + (k - 3) * 0.12); f.rotation.set(0.7, k * 0.9, 0); g.add(f);
    }
  } else {
    const shelter = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 14), red); shelter.position.set(4.2, 4, 0); g.add(shelter);
    for (const z of [-6, 6]) for (const x of [2.6, 5.8]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8), white); post.position.set(x, 2.4, z); g.add(post); }
  }
  g.position.set(p.x, y - 0.45, p.z); g.rotation.y = heading(i);
  if (n.x * Math.cos(heading(i)) - n.z * Math.sin(heading(i)) < 0) g.scale.x = -1;   // the platform on the line's right
  if (big) window.__platSide = g.scale.x < 0 ? -1 : 1;            // the platform's side, for the camera (local +x is the platform; flipped or not)
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
}
const STATION_I = line.findIndex(p => p.s > 28);
station(STATION_I, true);
station(line.findIndex(p => p.s > END.s - 20), false);

// ---- The train: a blue and yellow locomotive and maroon carriages (Ken's photos) -------------
function carriageTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#6a1c1c'; g.fillRect(0, 0, 1024, 256);                       // maroon
  g.fillStyle = '#eadfc3'; g.fillRect(0, 56, 1024, 86);                        // the cream window band
  g.fillStyle = '#c9a24a'; g.fillRect(0, 150, 1024, 6);                        // a gold line
  for (let x = 30; x < 1000; x += 64) { g.fillStyle = '#22262a'; g.fillRect(x, 66, 46, 66); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 4, 70, 14, 58); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function locoTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#1e4f93'; g.fillRect(0, 0, 1024, 256);                       // blue
  g.fillStyle = '#f2c418'; g.fillRect(0, 170, 1024, 26);                       // a yellow stripe along the side
  for (let x = 80; x < 950; x += 110) { g.fillStyle = '#163a6c'; g.fillRect(x, 50, 70, 60); }   // grilles
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const CAR = 13, GAP = 0.7, LOCO = 14.5;
const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a6e62, roughness: 0.6 });
const bogieMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.7 });
function car(len, tex, endColor, nose) {
  const g = new THREE.Group();
  const sideMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }), endMat = new THREE.MeshStandardMaterial({ color: endColor, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.6, len), [sideMat, sideMat, roofMat, bogieMat, endMat, endMat]); body.position.y = 2.2; g.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, len, 16, 1, false, -Math.PI / 2 + 0.35, Math.PI - 0.7), roofMat); roof.rotation.x = Math.PI / 2; roof.scale.set(1, 1, 0.45); roof.position.y = 3.35; g.add(roof);
  for (const z of [-len / 2 + 2.2, len / 2 - 2.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 2.6), bogieMat); b.position.set(0, 0.6, z); g.add(b); }
  if (nose) {                                                                  // the locomotive's cab end: yellow, with windows
    const front = new THREE.Mesh(new THREE.BoxGeometry(2.72, 2.62, 0.2), new THREE.MeshStandardMaterial({ color: 0xf2c418, roughness: 0.5 })); front.position.set(0, 2.2, len / 2 + 0.05); g.add(front);
    for (const x of [-0.6, 0.6]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.1 })); w.position.set(x, 2.9, len / 2 + 0.16); g.add(w); }
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), new THREE.MeshBasicMaterial({ color: 0xfff3c0 })); lamp.position.set(0, 3.45, len / 2 + 0.17); g.add(lamp);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g); return g;
}
const train = [{ g: car(LOCO, locoTexture(), 0x1e4f93, true), len: LOCO }];
const ctex = carriageTexture();
for (let k = 0; k < 8; k++) train.push({ g: car(CAR, ctex, 0x6a1c1c, false), len: CAR });
// Wally and Kenny on the open end platform of the first carriage, watching the view.
{
  const progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
  const wg = models.get(outfitModel(progress)) || models.get('wally');
  if (wg) { const w = new ModelSkin(wg, { height: 1.6 }); dressOutfit(w.root, 'wally', wearing(progress, 'wally')); w.root.position.set(0.7, 0.9, CAR / 2 + 0.2); w.root.rotation.y = Math.PI / 2; train[1].g.add(w.root); }
  const kg = models.get('kenny');
  if (kg) { const k = new ModelSkin(kg, { height: 0.75 }); dressOutfit(k.root, 'kenny', wearing(progress, 'kenny')); k.root.position.set(-0.6, 0.9, CAR / 2 + 0.25); k.root.rotation.y = Math.PI / 2; train[1].g.add(k.root); }
}
// Put the train on the line with its front at distance s.
function placeTrain(s) {
  let back = s;
  for (const c of train) {
    const a = at(line, back), b = at(line, back - c.len);
    c.g.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    c.g.lookAt(a.x, (a.y + b.y) / 2 + (a.y - b.y) / 2, a.z);
    back -= c.len + GAP;
  }
}

// ---- The cinematic: about thirty seconds, a few places (Ken) -----------------------------------
const sAt = i => line[i].s;
const fallsI = (() => { const [fx, fz] = ROUTE[FALLS_STOP]; let best = 0, bd = Infinity; line.forEach((p, i) => { const d = Math.hypot(p.x - fx, p.z - fz); if (d < bd) { bd = d; best = i; } }); return best; })();
const SPEED = 9;                                     // metres a second through each shot
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SHOTS = [
  { at: 0, s0: sAt(STATION_I) + 20, speed: 0.6, caption: 'Kuranda Railway Station',
    // Low and close across the line, along the platform: the hanging baskets, the awning, the roof.
    cam: (h, i) => { const p = line[STATION_I], n = side(STATION_I), a = line[Math.min(line.length - 1, STATION_I + 14)], dx = a.x - p.x, dz = a.z - p.z, d = Math.hypot(dx, dz) || 1;
      const ps = window.__platSide ?? 1;                         // which side of the line the platform is on (set below)
      return { pos: V(p.x + n.x * ps * 3.3 - dx / d * 26, p.y + 3.0, p.z + n.z * ps * 3.3 - dz / d * 26), look: V(p.x + n.x * ps * 6.5 - dx / d * 4, p.y + 3.2, p.z + n.z * ps * 6.5 - dz / d * 4) }; } },   // on the platform, looking along it
  { at: 6.5, s0: sAt(fallsI) - 30, caption: 'Barron Falls',
    // Above the train at the Barron Falls stop, looking down the gorge to the falls and their mist.
    // High over the canopy beside the line, looking straight down the gorge at the cascade (where the
    // shared land draws it: GORGE.head + 120, half way down the drop), the train passing below.
    cam: h => { const foot = height(GORGE.x, GORGE.head + 260), mid = (FALLS.lip + 4 + foot) / 2;
      return { pos: V(GORGE.x - 45, FALLS.lip + 55, GORGE.head - 255), look: V(GORGE.x, mid - 10, GORGE.head + 140) }; } },
  { at: 13, s0: line[SC.from].s + 30, caption: 'The Stoney Creek bridge',
    // From well outside the bridge's curve (it swings round a loop of the line), a little above
    // the deck: the whole curved trestle, the train on it, the falls beside.
    // Side on, from the downhill side (the gully opens out below), above the canopy.
    cam: () => { const p = line[scMid], n = side(scMid), cx = p.x - n.x * SC.up * 105, cz = p.z - n.z * SC.up * 105;
      return { pos: V(cx, Math.max(p.y + 12, height(cx, cz) + 26), cz), look: V(p.x, p.y - 4, p.z) }; } },
  { at: 20, s0: ROBB.s - 18, caption: 'Down the range',
    cam: () => { const p = line[ROBB.i], n = side(ROBB.i); return { pos: V(p.x + n.x * 30 + 8, p.y + 26, p.z + n.z * 30 - 8), look: V(p.x, p.y + 3, p.z) }; } },
  { at: 25.5, s0: END.s - 140, caption: 'Cairns',
    // From over the sea, looking back at the city with the ranges rising behind it, the train coming in.
    cam: () => ({ pos: V(-470, 70, -150), look: V(-200, 30, -40) }) },
];
const DURATION = 30;
let t = 0, playing = false, captionNow = null;
function shotIndex() { let i = 0; while (i < SHOTS.length - 1 && t >= SHOTS[i + 1].at) i++; return i; }
function frameShot() {
  const i = shotIndex(), sh = SHOTS[i], into = t - sh.at;
  const s = sh.s0 + into * SPEED * (sh.speed ?? 1);
  placeTrain(s);
  const head = at(line, s), c = sh.cam(head, i);
  camera.position.copy(c.pos); camera.lookAt(c.look);
  if (window.chomp && window.chomp.camHold) window.chomp.camHold(camera);   // testing: a fixed camera
  if (sh.caption !== captionNow) { captionNow = sh.caption; const el = $('cine-caption'); el.textContent = sh.caption; el.hidden = !sh.caption; el.classList.add('fade'); requestAnimationFrame(() => el.classList.remove('fade')); }
  // A quick fade through black at each cut.
  const nextAt = i < SHOTS.length - 1 ? SHOTS[i + 1].at : DURATION;
  $('fade').classList.toggle('on', (into < 0.25 && i > 0) || nextAt - t < 0.35);
  return head;
}
function finish() {
  $('fade').classList.add('on'); $('cine-caption').textContent = 'Croc Park'; $('cine-caption').hidden = false;
  try { localStorage.setItem('chomp-train-seen', '1'); } catch { /* fine */ }
  setTimeout(() => { location.href = NEXT; }, 900);
}
function start() { sound.start(); sound.startMusic('theme'); $('title').hidden = true; playing = true; t = 0; }
$('ride').onclick = start;
$('skip').onclick = e => { e.preventDefault(); finish(); };
addEventListener('keydown', e => { if (playing && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) { playing = false; finish(); } });
canvas.addEventListener('pointerdown', () => { if (playing) { playing = false; finish(); } });
if (params.has('play')) start();

// ---- Loop -----------------------------------------------------------------------------------
let last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing) { t += dt; if (t >= DURATION) { playing = false; finish(); } }
  const head = frameShot();
  land.trees.update(now / 1000); cityPalms.update(now / 1000);
  fallTex.offset.y -= dt * 0.9;
  if (land.fallsTex) land.fallsTex.offset.y -= dt * 0.8;          // the distant falls pour
  if (skyDome) skyDome.position.copy(camera.position);
  sun.position.set(head.x - 200, head.y + 260, head.z - 120); sun.target.position.set(head.x, head.y, head.z);
  sun.shadow.camera.left = -80; sun.shadow.camera.right = 80; sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80; sun.shadow.camera.far = 700; sun.shadow.camera.updateProjectionMatrix();
  post.render();
  if (!inVR()) requestAnimationFrame(frame);   // in a VR headset, the headset sets the pace (vr.js)
}
installVR({ renderer, scene, camera, frame });   // a VR headset, if there is one (vr.js)
requestAnimationFrame(frame);
window.chomp = { scene, camera, line, train, SC, shape, FALLS, height, get t() { return t; }, set t(v) { t = v; }, start, SHOTS };
