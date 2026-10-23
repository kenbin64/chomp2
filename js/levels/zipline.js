// zipline.js
// Ride the Gorge: the Barron Falls zip line (Ken, 2026-10-18). Down the gorge
// past the falls, swinging and tucking to collect what hangs along the line,
// ducking the branches, braking in the brake zone to land on the far platform.
// The ride is in zipline-rules.js (tested). One ticket a ride.

import { startRun, addPoints, bankRun } from '../points.js';
import { installVR, inVR } from '../vr.js';
import * as THREE from 'three';
import { Wally } from '../wally.js';
import { loadModels } from '../models.js';
import { createPost } from '../post.js';
import { pickQuality, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { installMap } from '../mapmodal.js';
import { installShop, openShop } from '../shopmodal.js';
import { installBook, bookFound } from '../book.js';
import { loadRealism, surfaceMaterial } from '../realism.js';
import { Trees } from '../trees.js';
import { addSky, addLights } from '../world.js';
import { DayNight } from '../daynight.js';
import { readProgress, saveProgress, outfitModel, wearing, activityOpen, ticketsFor, useTicket, bankFinds, PROGRESS_CHANGED } from '../progress.js';
import { giveGear, ABILITIES } from '../book-rules.js';
import { dressOutfit } from '../outfit.js';
import { goldPiece, mangoMaker } from '../pickups.js';
import * as Trip from '../trip-rules.js';
import { foundTalisman } from '../revisit.js';
import { openSceptre } from '../sceptre-card.js';
import { LINES, cableY, ride, landing, layout, reaches, hitsBranch, score, HANG, SWAY, TUCK, DANGLE, BRAKE_ZONE } from './zipline-rules.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
const load = () => readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());

// ---- Stage ----------------------------------------------------------------------------
const quality = pickQuality();
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality)); renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
setGround({ stand: () => ({ y: 0, surface: 'land' }), move: (x, z) => ({ x, z }), foodAt: () => 0, isWater: () => false, start: () => ({ x: 0, y: 0, z: 0 }) });

const models = await loadModels(['wally', 'wally-explorer', 'mango', 'barron-falls'], { light: touch || quality.name === 'low' });
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light: touch || quality.name === 'low' });
addSky(scene);
const sun = addLights(scene, quality); scene.add(sun.target);
if (realism && realism.sky) { scene.background = realism.sky.background; scene.environment = realism.sky.environment; scene.environmentIntensity = 0.55; }
scene.fog = new THREE.Fog(0xcfe2e8, 120, 700);
const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));
const daynight = new DayNight(scene, { sun });

// ---- The gorge: cliffs, river, rainforest, the falls --------------------------------------
const LONGEST = 340;
const FALLS_Z = 30;                                   // the head wall at the foot of the falls, behind the start platform (the line runs toward -z)
const RIM = 82;                                       // the cliff tops
const rock = surfaceMaterial(realism, 'rock', 30, 8) || new THREE.MeshStandardMaterial({ color: 0x6a5e52, roughness: 0.95 });
const rockMoss = rock.clone(); rockMoss.vertexColors = true;
for (const side of [-1, 1]) {
  const geo = new THREE.PlaneGeometry(LONGEST + 300, 90, 80, 24);       // reaching upstream past the falls (z up to +200)
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {                                 // rough, leaning rock walls
    const u = p.getX(i), v = p.getY(i);
    p.setZ(i, Math.sin(u * 0.07) * 4 + Math.sin(u * 0.23 + v * 0.1) * 2 + Math.sin(v * 0.4 + u * 0.05) * 1.5 + (v + 45) * 0.12);
  }
  geo.computeVertexNormals();
  // Moss and ferns over the rock (Ken: the gorge is rocky and rainforest-lush):
  // green where the wall leans back and in streaks running down it.
  const col = [];
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getY(i);
    const moss = Math.max(0, Math.sin(u * 0.11 + Math.sin(v * 0.07) * 2) * 0.6 + Math.sin(u * 0.37 + v * 0.05) * 0.4 + (v < -20 ? 0.3 : 0));
    const k = Math.min(1, moss);
    col.push(1 - 0.55 * k, 1 - 0.15 * k, 1 - 0.6 * k);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const wall = new THREE.Mesh(geo, rockMoss); wall.receiveShadow = true;
  wall.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  wall.position.set(side * 34, 40, -LONGEST / 2 + 50); scene.add(wall);
}
// ---- The river (Ken: his falls model is the reference) -------------------------------------
// Below the falls the Barron runs brown-green in the wet, churned white wherever
// it breaks over rock. The water moves: streaks and ripples (the photographic
// layer's water normals) slide downstream every frame (flowRiver).
const RIVER_Z = -LONGEST / 2 + 50, RIVER_LEN = LONGEST + 300;          // the same stretch as the walls, upstream past the falls
const flowTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(70,62,44,${0.05 + Math.random() * 0.18})`; g.fillRect(Math.random() * 128, Math.random() * 512, 1 + Math.random() * 2, 8 + Math.random() * 40); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 24); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const waterNormals = new THREE.TextureLoader().load('assets/water/waternormals.jpg');
waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping; waterNormals.repeat.set(6, 60);
{
  const geo = new THREE.PlaneGeometry(80, RIVER_LEN, 16, 120), p = geo.attributes.position, col = [];
  const white = new THREE.Color(0xe6e1d4), brown = new THREE.Color(0x4a4532), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = RIVER_Z - p.getY(i);                     // the plane lies flat: its y runs down the gorge
    const below = Math.min(1, Math.max(0, (FALLS_Z - 30 - z) / 60));   // 0 just below the falls, 1 well downstream
    const rapids = 0.25 * Math.max(0, Math.sin(z * 0.05 + Math.sin(x * 0.2) * 1.5));   // lighter bands where it runs fast
    c.copy(white).lerp(brown, Math.min(1, below * (1 - rapids)));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const river = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: flowTex, normalMap: waterNormals, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.3, metalness: 0, envMapIntensity: 0.5 }));
  river.rotation.x = -Math.PI / 2; river.position.set(0, 0, RIVER_Z); river.receiveShadow = true; scene.add(river);
}
function flowRiver(dt) { flowTex.offset.y -= dt * 0.6; waterNormals.offset.y -= dt * 0.3; }
const trees = new Trees(scene, { light: quality.name === 'low' });
for (let i = 0; i < 220; i++) { const side = i % 2 ? 1 : -1, x = side * (38 + Math.random() * 60), z = 160 - Math.random() * (LONGEST + 260); trees.add(['umbrella', 'eucalyptus', 'umbrella', 'palm'][i % 4], x, 80 + Math.random() * 6, z, 12 + Math.random() * 10); }
// Trees and palms growing out of the cliff faces on ledges, all the way down,
// and a thick rim of forest along the top.
for (let i = 0; i < 520; i++) {
  const side = i % 2 ? 1 : -1, y = 4 + Math.random() * 74, z = 150 - Math.random() * (LONGEST + 240);
  const x = side * (30.5 - (y + 45 - 40) * 0.12 * 0.4 + Math.random() * 2.5);       // just in from the wall's face at that height
  trees.add(Math.random() < 0.65 ? 'umbrella' : 'palm', x, y, z, 6 + Math.random() * 9);
}
for (let i = 0; i < 160; i++) { const side = i % 2 ? 1 : -1; trees.add(['umbrella', 'eucalyptus', 'umbrella'][i % 3], side * (34 + Math.random() * 8), 80, 160 - Math.random() * (LONGEST + 260), 14 + Math.random() * 10); }
trees.build();
// Boulders in the river and along its banks, like the model's: chunky granite with
// the edges worn round, moss on top, darker where they are wet. Four shapes, so no
// two look alike. Each one in the stream has a soft collar of white water and a
// white streak trailing downstream. All drawn in a few batches (instanced).
{
  function boulderGeometry(seed) {
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.multiplyScalar(1 + 0.22 * Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed * 1.7) + 0.12 * Math.sin(v.z * 5.3 + seed * 2.3));
      v.y *= 0.62; if (v.y < -0.15) v.y = -0.15 + (v.y + 0.15) * 0.3;   // a flatter underside, sitting in the water
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const n = g.attributes.normal, col = [];
    for (let i = 0; i < p.count; i++) {
      const up = n.getY(i), y = p.getY(i);
      if (up > 0.55) col.push(0.62, 0.78, 0.48);                         // moss on top
      else if (y < 0) col.push(0.55, 0.55, 0.55);                       // wet and dark at the waterline
      else col.push(1, 1, 1);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }
  const stone = rock.clone(); stone.vertexColors = true; stone.color = new THREE.Color(0x9a958c);
  // How see-through the foam is, drawn in greys (three.js reads an alpha map's
  // brightness): white where the foam is thick, black where there is none.
  const fade = (radial) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
    if (radial) { const r = g.createRadialGradient(64, 64, 10, 64, 64, 64); r.addColorStop(0, '#fff'); r.addColorStop(0.5, '#aaa'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }
    else for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {   // bright at the rock end (the picture's bottom row: upstream), fading down the streak and to its sides
      const along = y / 128, across = Math.max(0, 1 - Math.abs(x - 64) / 64), v = Math.round(255 * along * along * across);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1); }
    return new THREE.CanvasTexture(c); };
  const foamMat = (radial) => new THREE.MeshStandardMaterial({ color: 0xf4f1ea, map: flowTex, alphaMap: fade(radial), transparent: true, depthWrite: false, roughness: 0.5 });
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const KINDS = 4, PER = 40;
  const meshes = Array.from({ length: KINDS }, (_, k) => new THREE.InstancedMesh(boulderGeometry(k * 2.7 + 1), stone, PER));
  const collars = new THREE.InstancedMesh(flat, foamMat(true), KINDS * PER), streaks = new THREE.InstancedMesh(flat, foamMat(false), KINDS * PER);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), up = new THREE.Vector3(0, 1, 0);
  let foam = 0;
  meshes.forEach((mesh, k) => {
    for (let i = 0; i < PER; i++) {
      const bank = Math.random() < 0.4;
      const z = FALLS_Z - 8 - (LONGEST + 60) * Math.pow(Math.random(), 1.7);   // more rocks (rapids) near the falls
      const x = bank ? (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 8) : (Math.random() - 0.5) * 48;
      const near = z > FALLS_Z - 80 ? 1.4 : 1;
      const r = (bank ? 2 + Math.random() * 4 : 1 + Math.random() * 3.5) * near;
      q.setFromEuler(e.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3));
      mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, r * 0.32, z), q, new THREE.Vector3(r, r, r * (1 + Math.random() * 0.4))));
      if (!bank) {
        q.setFromAxisAngle(up, 0);
        collars.setMatrixAt(foam, m.compose(new THREE.Vector3(x, 0.07, z), q, new THREE.Vector3(r * 2.8, 1, r * 2.8)));
        streaks.setMatrixAt(foam, m.compose(new THREE.Vector3(x, 0.06, z - r * 3), q, new THREE.Vector3(r * 1.6, 1, r * 6)));   // trailing downstream (-z)
        foam++;
      }
    }
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  });
  collars.count = streaks.count = foam;
  for (const f of [collars, streaks]) { f.userData.noAO = true; scene.add(f); }
}
// The cliff tops: rainforest floor.
for (const side of [-1, 1]) { const top = new THREE.Mesh(new THREE.PlaneGeometry(200, LONGEST + 300), new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 1 })); top.rotation.x = -Math.PI / 2; top.position.set(side * 134, 82, -LONGEST / 2 + 50); scene.add(top); }
// Barron Falls, at the head of the gorge (Ken, 2026-10-19, from his photos of the
// falls in the wet): the line starts at the lookout beside the falls and runs
// downstream, away from them, toward the lowlands. A rock wall closes the gorge
// behind the start; the river pours over it in three tiers onto rock ledges, a
// thin second fall drops down a cleft on the right, and white water and mist
// rise from the base. Wet-season water is cream and tan, not white.
const fallTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  for (let x = 0; x < 64; x++) for (let y = 0; y < 256; y += 2) {
    const v = Math.random(), r = 214 + v * 38, gr = 200 + v * 40, b = 168 + v * 50;          // churned, sediment-coloured water
    g.fillStyle = `rgba(${r | 0},${gr | 0},${b | 0},${0.6 + Math.random() * 0.4})`; g.fillRect(x, y, 1, 2 + Math.random() * 10);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 2); return t; })();
const waterMat = new THREE.MeshStandardMaterial({ map: fallTex, vertexColors: true, transparent: true, roughness: 0.35, emissive: 0x2e2a22, depthWrite: false, side: THREE.DoubleSide });
// One sheet of falling water: `width` across, from y0 down to y1, curving out over its lip.
function fallSheet(width, y0, y1, x, z, ribs = 0.4) {
  const h = y0 - y1, geo = new THREE.PlaneGeometry(width, h, 20, 16), p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), u = (p.getY(i) + h / 2) / h;                  // 0 at the foot, 1 at the lip
    p.setZ(i, Math.pow(u, 3) * h * 0.12 + Math.sin(px * ribs) * 0.6);   // out over the lip (the sheet is turned, so +z here is down the gorge), ribbed
    col.push(1, 1, 1, Math.max(0, 1 - Math.pow(Math.abs(px) / (width / 2), 4)));   // thinning out at the sides
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, waterMat); m.rotation.y = Math.PI; m.position.set(x, (y0 + y1) / 2, z); m.userData.noAO = true; scene.add(m);
  return m;
}
// The rock wall across the head of the gorge, from below the river up to `top`,
// in steps: each ledge listed in `ledges` ([height, how far it stands out]) and
// everything below it stands further out, under the main falls only; the cleft
// on the right stays a straight drop.
function headWall(top, ledges) {
  const h = top + 4, geo = new THREE.PlaneGeometry(76, h, 40, 36), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), y = p.getY(i) + h / 2 - 4;                    // world height of this point
    let step = 0; for (const [at, out] of ledges) if (y < at) step = Math.max(step, out);
    step *= Math.max(0, Math.min(1, (20 - Math.abs(u)) / 4));
    p.setZ(i, step + Math.sin(u * 0.3 + y * 0.2) * 1.2 + Math.sin(u * 0.9) * 0.5);
  }
  geo.computeVertexNormals();
  const wall = new THREE.Mesh(geo, rock); wall.rotation.y = Math.PI; wall.position.set(0, h / 2 - 4, FALLS_Z); wall.receiveShadow = true; scene.add(wall);
}
function riverAbove(y, z) {                         // the river running in from upstream, over the lip
  const above = new THREE.Mesh(new THREE.PlaneGeometry(70, 110), new THREE.MeshStandardMaterial({ map: fallTex, color: 0xd8c8a8, roughness: 0.3 }));
  above.rotation.x = -Math.PI / 2; above.position.set(0, y, z + 55); scene.add(above);
}
const fallsGltf = models.get('barron-falls');
if (fallsGltf) {
  // Ken's Meshy model of the falls in the wet (models/barron-falls.glb): a block
  // of landscape with the cascade running down its length. Its top is at its -z
  // end, so it is turned round to send the water down the gorge. It is measured,
  // not placed by fixed numbers, so a remade model drops straight in: a little
  // wider than the gorge (its cut sides sit inside the walls), its top well below the
  // rim (set into the gorge, as at the real falls), its foot at the head wall. The wall below it, the last drop to the
  // river and the river above it are built here to carry it on.
  const m = fallsGltf.scene.clone(true);
  m.rotation.y = Math.PI;
  m.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(m);
  m.scale.setScalar(80 / (box.max.x - box.min.x));
  m.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(m);
  m.position.set(-(box.min.x + box.max.x) / 2, RIM - 32 - box.max.y, FALLS_Z + 1 - box.min.z);   // set down into the gorge, the walls rising above it
  m.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(m);
  // How high the water is where it leaves the model's foot: the highest point near that end.
  let footTop = box.min.y; const v = new THREE.Vector3();
  m.traverse(o => {
    if (!o.isMesh) return;
    o.receiveShadow = true; o.castShadow = true;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 5) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.z < box.min.z + 6 && Math.abs(v.x) < 30) footTop = Math.max(footTop, v.y); }
  });
  scene.add(m);
  headWall(footTop, [[footTop * 0.5, 6]]);
  fallSheet(30, footTop, footTop * 0.5, -2, FALLS_Z - 2.5);
  fallSheet(26, footTop * 0.5, 0, -2, FALLS_Z - 8.5, 0.6);
  riverAbove(box.max.y - 2, box.max.z);
} else {
  // No model: the falls built here, in three tiers onto rock ledges, with a thin
  // second fall down the cleft on the right. Each sheet stands just in front of
  // its own ledge (the wall's face is FALLS_Z minus the step).
  headWall(RIM + 6, [[60, 3], [36, 6], [14, 9]]);
  riverAbove(RIM - 0.4, FALLS_Z);
  fallSheet(34, RIM, 60, -4, FALLS_Z - 2.5);
  fallSheet(16, 60, 36, -10, FALLS_Z - 5.5); fallSheet(12, 60, 36, 7, FALLS_Z - 5.5);
  fallSheet(28, 36, 0, -2, FALLS_Z - 12, 0.6);
  fallSheet(3, RIM - 6, 0, 26, FALLS_Z - 2.5, 1.2);
}
// The churned white water where it lands, fading out softly into the river.
const poolFade = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const pool = new THREE.Mesh(new THREE.CircleGeometry(30, 40), new THREE.MeshStandardMaterial({ color: 0xf0ebe0, map: fallTex, alphaMap: poolFade, transparent: true, opacity: 0.85, roughness: 0.4, depthWrite: false }));
pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.08, FALLS_Z - 14); pool.userData.noAO = true; scene.add(pool);
// Mist rising from the base of the falls and drifting down the gorge.
const MIST = 140;
const mist = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(Float32Array.from({ length: MIST * 3 }, (_, i) => i % 3 === 0 ? (Math.random() - 0.5) * 56 : i % 3 === 1 ? Math.random() * 50 : FALLS_Z - 6 - Math.random() * 40), 3)),
  new THREE.PointsMaterial({ color: 0xffffff, size: 26, transparent: true, opacity: 0.12, depthWrite: false, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() }));
mist.userData.noAO = true; scene.add(mist);
function driftMist(dt) {
  const p = mist.geometry.attributes.position;
  for (let i = 0; i < MIST; i++) {
    let y = p.getY(i) + dt * (2 + (i % 5)), z = p.getZ(i) - dt * 1.5;   // up, and drifting downstream
    if (y > 55 || z < FALLS_Z - 70) { y = Math.random() * 4; z = FALLS_Z - 6 - Math.random() * 12; }
    p.setY(i, y); p.setZ(i, z);
  }
  p.needsUpdate = true;
}

// ---- The line: cable, platforms, things hanging along it, branches ------------------------
let line = null, lay = null, cable = null, things = [], branches = [], lights = [];
const lineGroup = new THREE.Group(); scene.add(lineGroup);
const wood = new THREE.MeshStandardMaterial({ color: 0x7a5536, roughness: 0.85 }), steel = new THREE.MeshStandardMaterial({ color: 0x8a8f95, metalness: 0.8, roughness: 0.3 });
// A token: a thin card with the word on both faces (a box, so the back reads the
// right way round as it spins, which a two-sided flat card does not).
function tokenMesh() { const c = document.createElement('canvas'); c.width = 128; c.height = 80; const g = c.getContext('2d'); g.fillStyle = '#ffd166'; g.fillRect(0, 0, 128, 80); g.fillStyle = '#102030'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('TOKEN', 64, 52);
  const face = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), emissive: 0x332200 }), edge = new THREE.MeshStandardMaterial({ color: 0xffd166 });
  return new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.44, 0.03), [edge, edge, edge, edge, face, face]); }
// The soft glow behind each thing on the line (a sprite needs a soft round picture, or it shows as a square).
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function crateMesh() { const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0x9a6b3c })); return m; }
const makeMango = mangoMaker(models.get('mango'));
function at(s, side = 0, height = 0) { return new THREE.Vector3(side, cableY(line, s) - HANG + height, -s * line.length); }

function buildLine(id) {
  lineGroup.clear(); things = []; branches = []; lights = [];
  line = LINES[id]; lay = layout(line, Math.floor(Math.random() * 1e6) + 1);
  const pts = Array.from({ length: 80 }, (_, i) => { const s = i / 79; return new THREE.Vector3(0, cableY(line, s), -s * line.length); });
  cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.05, 6), steel); lineGroup.add(cable);
  // Platforms at each end, and the red safety pad at the far one.
  const top = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 8), wood); top.position.set(0, line.top - HANG - 1.6, 4); lineGroup.add(top);
  const end = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 10), wood); end.position.set(0, line.bottom - HANG - 1.6, -line.length - 3); lineGroup.add(end);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 1.2), new THREE.MeshStandardMaterial({ color: 0xd8452f, roughness: 0.9 })); pad.position.set(0, line.bottom - HANG, -line.length - 4); lineGroup.add(pad);
  for (const p of [top, end]) for (const x of [-3.6, 3.6]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, p.position.y, 8), wood); leg.position.set(x, p.position.y / 2, p.position.z); lineGroup.add(leg); }
  // What hangs along the line, each on a short string from the cable.
  for (const it of lay.items) {
    const mesh = it.kind === 'mango' ? makeMango() : it.kind === 'gold' ? goldPiece() : it.kind === 'token' ? tokenMesh() : crateMesh();
    const p = at(it.s, it.side, it.height); mesh.position.copy(p); mesh.scale.multiplyScalar(2); lineGroup.add(mesh);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff2b0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); glint.scale.setScalar(1.1); glint.position.copy(p); glint.userData.noAO = true; lineGroup.add(glint); mesh.userData.glint = glint;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, cableY(line, it.s) - p.y, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    string.position.set(p.x * 0.5, (cableY(line, it.s) + p.y) / 2, p.z); string.rotation.z = Math.atan2(p.x, cableY(line, it.s) - p.y); lineGroup.add(string);
    things.push({ ...it, mesh, got: false });
  }
  // Branches reaching in from the cliffs at body height.
  for (const b of lay.branches) {
    const g = new THREE.Group(); const p = at(b.s, 0, 0);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 26, 6), new THREE.MeshStandardMaterial({ color: 0x5a3d26 })); limb.rotation.z = Math.PI / 2; limb.position.x = b.side * 13; g.add(limb);
    for (let k = 0; k < 12; k++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3f7a35 })); leaf.position.set(b.side * (1 + k * 1.8), (Math.random() - 0.3) * 0.8, (Math.random() - 0.5) * 1.2); leaf.scale.y = 0.6; g.add(leaf); }
    g.position.set(0, p.y, p.z); lineGroup.add(g); branches.push({ ...b, hit: false, group: g });
  }
  // The night line is strung with fairy lights.
  if (line.night) for (let s = 0; s < 1; s += 12 / line.length) { const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd28a })); bulb.position.set(0, cableY(line, s) - 0.25, -s * line.length); bulb.userData.noAO = true; lineGroup.add(bulb); lights.push(bulb); }
  daynight.frozen = line.night ? 1 : 0;
}

// ---- Wally on the trolley -----------------------------------------------------------------
const wally = new Wally(scene);
let progress = load();
addEventListener(PROGRESS_CHANGED, () => { progress = load(); drawTitle(); });
wally.useModel(models.get(outfitModel(progress)) || models.get('wally'));
if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(progress, 'wally'));
const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.6), new THREE.MeshStandardMaterial({ color: 0xd8452f, metalness: 0.4 })); scene.add(trolley);
const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), new THREE.MeshStandardMaterial({ color: 0x222222 })); scene.add(strap);

// ---- The ride -------------------------------------------------------------------------------
const game = { running: false, state: null, side: 0, sideV: 0, height: 0, keys: new Set(), got: { mango: 0, gold: 0, token: 0, gear: 0 }, branchesHit: 0, land: null, crawl: false, end: 0, chosen: 'practice' };
window.chomp = { game, wally, finish: () => finish() };
function toast(text, kind = 'good') { const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text; $('toasts').appendChild(el); setTimeout(() => el.remove(), 1800); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }
addEventListener('keydown', e => { game.keys.add(e.key); if (e.key === ' ') e.preventDefault(); });
addEventListener('keyup', e => game.keys.delete(e.key));

// ?story: the zip line at the end of Kuranda, on the way of the story (free, no stars needed, it
// starts at once, and the landing wins the water talisman and goes on to Mossman Gorge).
const story = params.has('story');
function start() {
  const r = params.has('free') || story ? { ok: true, progress: load() } : useTicket(load(), 'zipline');
  if (!r.ok) { toast('You need a zip line ticket: Buy a ticket', 'bad'); return; }
  saveProgress(r.progress);
  buildLine(game.chosen);
  Object.assign(game, { running: true, state: { s: 0, v: 3, started: true }, side: 0, sideV: 0, height: 0, got: { mango: 0, gold: 0, token: 0, gear: 0 }, branchesHit: 0, land: null, crawl: false });
  $('title').hidden = true; $('result').hidden = true; $('hud').hidden = false;
  $('z-line').textContent = line.name;
  sound.start(); sound.play.leap();
}

function step(dt) {
  const st = game.state;
  // Swinging side to side (with a little swing to it), tucking and dangling.
  const want = game.keys.has('ArrowLeft') ? -SWAY : game.keys.has('ArrowRight') ? SWAY : 0;
  game.sideV += ((want - game.side) * 9 - game.sideV * 4) * dt; game.side = Math.max(-SWAY, Math.min(SWAY, game.side + game.sideV * dt));
  const hWant = game.keys.has('ArrowUp') ? TUCK : game.keys.has('ArrowDown') ? -DANGLE : 0;
  game.height += (hWant - game.height) * Math.min(1, dt * 8);
  if (game.crawl) { st.v = 1.1; st.s = Math.min(1, st.s + st.v * dt / line.length); if (st.s >= 1) finish(); }
  else {
    ride(st, line, dt, game.keys.has(' '));
    const land = landing(st, line);
    if (land) {
      game.land = land;
      if (land === 'short') { game.crawl = true; toast('Stopped short: hand over hand to the platform', 'info'); }
      else { if (land === 'pad') { sound.play.land(); toast('Whump! Into the safety pad', 'info'); } else { sound.play.powerup(); toast('A perfect landing!', 'good'); } finish(); }
    }
  }
  // Collecting, and branches.
  for (const t of things) if (!t.got && Math.abs(t.s - st.s) * line.length < 0.8 && reaches(t, game.side, game.height)) {
    t.got = true; t.mesh.visible = false; if (t.mesh.userData.glint) t.mesh.userData.glint.visible = false; game.got[t.kind]++; sound.play.goal();
  }
  for (const b of branches) if (!b.hit && Math.abs(b.s - st.s) * line.length < 0.7 && hitsBranch(b, game.side, game.height)) {
    b.hit = true; game.branchesHit++; st.v *= 0.75; sound.play.stolen(); toast('Ouch, a branch! Tuck up (Up)', 'bad');
  }
  $('z-brake-hint').hidden = !((1 - st.s) * line.length < BRAKE_ZONE && !game.crawl && st.s < 1);
}

// ---- The cinematic intro (Ken, 2026-10-19) -----------------------------------------------
// The falls from high above, a sweep in past them, a turn down the gorge, and down
// behind Wally on the launch platform, with captions naming the place and the ride.
// Plays by itself on the first visit; "Watch the intro" replays it; any key, click
// or tap skips it. The camera follows two smooth curves (where it is, where it
// looks) through the shots below, `at` seconds apart.
const SHOTS = [
  { at: 0,  pos: [0, 108, -150],  look: [0, 38, FALLS_Z + 40], caption: 'Barron Falls' },   // high above the middle of the gorge
  { at: 4,  pos: [-10, 62, -45],  look: [0, 34, FALLS_Z + 50], caption: 'Kuranda, Far North Queensland' },
  { at: 7,  pos: [8, 56, -2],     look: [0, 40, FALLS_Z + 30] },
  { at: 9.5, pos: [4, 52, -22],   look: [0, 26, -220],         caption: 'The Barron Gorge, Djabugay country' },
  { at: 12, pos: null,            look: null,                  caption: 'Ride the Gorge: the zip line' },   // behind Wally, filled in when it plays
  { at: 14, pos: null,            look: null },
];
const cine = { active: false, t: 0, pos: null, look: null, caption: '' };
function playIntro() {
  if (!line) return;
  const behind = [2.6, cableY(line, 0) - 1.2, 7.5], ahead = [0, cableY(line, 0.1) - HANG - 1, -0.1 * line.length];
  const pts = SHOTS.map(s => new THREE.Vector3(...(s.pos || behind))), looks = SHOTS.map(s => new THREE.Vector3(...(s.look || ahead)));
  Object.assign(cine, { active: true, t: 0, pos: new THREE.CatmullRomCurve3(pts), look: new THREE.CatmullRomCurve3(looks), caption: '' });
  $('title').hidden = true;
  try { localStorage.setItem('chomp-zipline-intro', '1'); } catch { /* not remembered */ }
}
function endIntro() {
  if (!cine.active) return;
  cine.active = false; $('cine-caption').hidden = true;
  if (!game.running) $('title').hidden = false;
}
function stepIntro(dt) {
  if (!cine.active) return;
  cine.t += dt;
  const end = SHOTS[SHOTS.length - 1].at;
  if (cine.t >= end) { endIntro(); return; }
  // Where along the curves: shots are evenly spaced points on them, reached at their times.
  let k = 0; while (k < SHOTS.length - 2 && cine.t > SHOTS[k + 1].at) k++;
  const f = (cine.t - SHOTS[k].at) / (SHOTS[k + 1].at - SHOTS[k].at), ease = f * f * (3 - 2 * f);
  const u = (k + ease) / (SHOTS.length - 1);
  camera.position.copy(cine.pos.getPoint(u)); camLook.copy(cine.look.getPoint(u)); camera.lookAt(camLook);
  // The caption of the latest shot that has one, faded out near the next.
  let cap = ''; for (const s of SHOTS) if (s.at <= cine.t && s.caption) cap = s.caption;
  const el = $('cine-caption');
  if (cap !== cine.caption) { cine.caption = cap; el.textContent = cap; el.hidden = !cap; el.classList.add('fade'); requestAnimationFrame(() => el.classList.remove('fade')); }
}
for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, () => { if (cine.active) endIntro(); });

const camLook = new THREE.Vector3(0, 30, FALLS_Z + 40);   // where the camera is looking, eased so it swings rather than snaps
function place(t) {
  const st = game.state || { s: 0 };
  if (!line) return;
  const cy = cableY(line, st.s), z = -st.s * line.length;
  trolley.position.set(0, cy - 0.15, z);
  const body = new THREE.Vector3(game.side, cy - HANG + game.height, z);
  strap.position.set(game.side / 2, cy - 0.15 - (HANG - 1.2) / 2, z); strap.scale.y = HANG - 1.2; strap.rotation.z = Math.atan2(game.side, HANG - 1.2);
  // Wally hangs from the strap: his hands up at the trolley, body swinging below.
  wally.root.position.set(body.x, body.y - 1.4, z); wally.root.rotation.set(-0.05, Math.PI, -game.side * 0.25);
  if (wally.skin) { wally.skin.play('climbacross', { alternatives: ['climb', 'idle'] }); }
  // Camera. On the title screen: down the gorge, looking back up it at the falls
  // (like Ken's photo from the lookout). Riding: behind him, a little above,
  // looking down the line, downstream. It swings between the two.
  const onTitle = !game.running && !$('title').hidden;
  const ahead = Math.min(1, st.s + 30 / line.length);
  const want = onTitle ? new THREE.Vector3(14, 54, -62) : new THREE.Vector3(2.6 + game.side * 0.3, cy - 1.2, z + 7.5);   // riding: beside and just below the cable
  const look = onTitle ? new THREE.Vector3(0, 30, FALLS_Z + 40) : new THREE.Vector3(0, cableY(line, ahead) - HANG - 1, -ahead * line.length);
  camera.position.lerp(want, onTitle ? 0.05 : 0.15);
  camLook.lerp(look, onTitle ? 0.05 : 0.2);
  camera.lookAt(camLook);
  if (cine.active) stepIntro(0);                     // the intro, when playing, has the camera
  for (const th of things) if (!th.got) th.mesh.rotation.y += 0.03;
  for (const b of lights) b.material.color.setHSL(0.11, 1, 0.6 + 0.15 * Math.sin(t * 4 + b.position.z));
}

function finish() {
  game.running = false; $('hud').hidden = true; $('z-brake-hint').hidden = true;
  const pts = score(game.got, game.branchesHit, game.land);
  let p = bankFinds(load(), { mangoes: game.got.mango, coins: game.got.gold });
  const tokens = game.got.token + (game.land === 'perfect' ? 2 : 0);
  p = { ...p, mangoes: (p.mangoes || 0) + tokens, ziplineBest: { ...(p.ziplineBest || {}), [game.chosen]: Math.max((p.ziplineBest || {})[game.chosen] || 0, pts) } };
  const gearWon = [];
  for (let i = 0; i < game.got.gear; i++) { const a = ABILITIES[Math.floor(Math.random() * ABILITIES.length)]; p = giveGear(p, a.id); gearWon.push(a); }
  saveProgress(p);
  for (const a of gearWon) bookFound(a.id);
  if (game.got.mango) bookFound('mango'); if (game.got.gold) bookFound('gold'); if (tokens) bookFound('token');
  sound.fanfare();
  $('result-title').textContent = game.land === 'perfect' ? 'Nailed the landing!' : game.land === 'pad' ? 'Whump! Into the pad' : 'Made it, hand over hand!';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Golden Mangoes', game.got.mango + game.got.gold + tokens], ['Gear found', gearWon.map(a => a.name).join(', ') || 'none'],
                            ['Branches hit', game.branchesHit], ['Landing', { perfect: 'Perfect (+100)', pad: 'Safety pad (+20)', short: 'Short' }[game.land]], ['Score', pts], ['Best on this line', p.ziplineBest[game.chosen]]]) {
    const li = document.createElement('li'); li.innerHTML = '<span></span><b></b>'; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  if (story) { storyEnd(); return; }
  $('result').hidden = false;
  drawTitle();
}
// The landing at the foot of Barron Falls: the water talisman, and Kuranda complete (its run, saved
// when Wally left the village with the air talisman, is finished here), then on to Mossman Gorge.
function storyEnd() {
  let p = load(); if (!p.trip) p.trip = Trip.tripFor(p);
  const hadWater = Trip.have(p.trip, 'talisman-water');
  let run = null; try { run = JSON.parse(localStorage.getItem('chomp-kuranda-run') || 'null'); } catch { /* none */ }
  const attempt = Trip.gain(run || Trip.startAttempt(p.trip, 'kuranda', { force: true }), 'talisman-water');
  const done = Trip.completeAttempt(p.trip, Trip.have(p.trip, 'talisman-air') || (run && run.pending['talisman-air']) ? attempt : Trip.gain(attempt, 'talisman-air'), { objectiveMet: true });
  if (done.ok) { p.trip = done.trip; startRun('kuranda', { carry: true }); addPoints('talisman'); bankRun(); }   // the run begun in Kuranda village, banked here
  saveProgress(p); try { localStorage.removeItem('chomp-kuranda-run'); } catch { /* fine */ }
  if (hadWater) foundTalisman('talisman-water', toast); else openSceptre('talisman-water');   // new: the card with water set in its place
  setTimeout(() => { const f = document.getElementById('cine-caption'); if (f) { f.textContent = 'On to Mossman Gorge'; f.hidden = false; } setTimeout(() => { location.href = 'mossman.html'; }, 1800); }, 4200);
}

function drawHud() {
  const st = game.state;
  $('score').textContent = score(game.got, game.branchesHit, null);
  $('z-mango').textContent = game.got.mango; $('z-gold').textContent = game.got.gold; $('z-token').textContent = game.got.token;
  $('z-speed').textContent = `${Math.round(st.v * 3.6)} km/h`;
  $('z-wally').style.left = `${st.s * 100}%`;
}

// ---- The title: pick a line ------------------------------------------------------------------
function drawTitle() {
  const box = $('z-lines'); box.innerHTML = '';
  for (const [id, L] of Object.entries(LINES)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = `zip-line-btn${game.chosen === id ? ' on' : ''}`;
    b.textContent = L.name + ((progress.ziplineBest || {})[id] ? ` (best ${progress.ziplineBest[id]})` : '');
    b.onclick = () => { game.chosen = id; drawTitle(); }; box.append(b);
  }
  const n = ticketsFor(progress, 'zipline');
  $('z-tickets').textContent = params.has('free') ? 'Free rides (testing)' : n ? `Zip line tickets: ${n} (one a ride)` : 'You need a zip line ticket: 25 Golden Mangoes in Outfits, under Gear and tickets.';
  $('ride').disabled = !n && !params.has('free');
}
$('ride').onclick = start; $('again').onclick = () => { $('result').hidden = true; $('title').hidden = false; drawTitle(); };
$('z-buy').onclick = () => openShop();
$('z-intro').onclick = e => { e.stopPropagation(); playIntro(); };
if (!activityOpen(progress, 'zipline') && !params.has('all') && !story) {
  $('title').querySelector('p:not(.area)').textContent = 'The zip line opens with more stars. Earn stars across the trip and come back!';
  $('ride').hidden = true;
}
installMap({ pause: () => {} }); installShop({ pause: () => {} }); installBook({ pause: () => {} });
buildLine('practice'); drawTitle();
if (story) setTimeout(start, 600);
else if (!params.has('play') && (() => { try { return !localStorage.getItem('chomp-zipline-intro'); } catch { return true; } })()) playIntro();   // the first visit

// ---- Loop -----------------------------------------------------------------------------------
let last = performance.now(), t = 0;
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  if (game.running) { step(dt); drawHud(); }
  place(t);
  if (cine.active) stepIntro(dt);
  if (wally.skin) wally.skin.update(dt);
  fallTex.offset.y -= dt * 0.9;
  flowRiver(dt);
  driftMist(dt);
  daynight.update(dt, camera);
  sun.position.set(camera.position.x - 60, 120, camera.position.z - 40); sun.target.position.copy(camera.position);
  post.render();
  if (!inVR()) requestAnimationFrame(frame);   // in a VR headset, the headset sets the pace (vr.js)
}
installVR({ renderer, scene, camera, frame });   // a VR headset, if there is one (vr.js)
requestAnimationFrame(frame);
if (params.has('play')) { game.chosen = params.get('line') || 'practice'; start(); }
