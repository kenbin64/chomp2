// zipline.js
// Ride the Gorge: the Barron Falls zip line (Ken, 2026-10-18). Down the gorge
// past the falls, swinging and tucking to collect what hangs along the line,
// ducking the branches, braking in the brake zone to land on the far platform.
// The ride is in zipline-rules.js (tested). One ticket a ride.

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

const models = await loadModels(['wally', 'wally-explorer', 'mango'], { light: touch || quality.name === 'low' });
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
const rock = surfaceMaterial(realism, 'rock', 30, 8) || new THREE.MeshStandardMaterial({ color: 0x6a5e52, roughness: 0.95 });
const rockMoss = rock.clone(); rockMoss.vertexColors = true;
for (const side of [-1, 1]) {
  const geo = new THREE.PlaneGeometry(LONGEST + 200, 90, 80, 24);
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
  wall.position.set(side * 34, 40, -LONGEST / 2); scene.add(wall);
}
const river = new THREE.Mesh(new THREE.PlaneGeometry(80, LONGEST + 300), new THREE.MeshStandardMaterial({ color: 0x3f5f4a, roughness: 0.2, metalness: 0.1 })   /* the Barron: deep green-brown */);
river.rotation.x = -Math.PI / 2; river.position.set(0, 0, -LONGEST / 2); scene.add(river);
const trees = new Trees(scene, { light: quality.name === 'low' });
for (let i = 0; i < 220; i++) { const side = i % 2 ? 1 : -1, x = side * (38 + Math.random() * 60), z = 60 - Math.random() * (LONGEST + 160); trees.add(['umbrella', 'eucalyptus', 'umbrella', 'palm'][i % 4], x, 80 + Math.random() * 6, z, 12 + Math.random() * 10); }
// Trees and palms growing out of the cliff faces on ledges, all the way down,
// and a thick rim of forest along the top.
for (let i = 0; i < 520; i++) {
  const side = i % 2 ? 1 : -1, y = 4 + Math.random() * 74, z = 50 - Math.random() * (LONGEST + 140);
  const x = side * (30.5 - (y + 45 - 40) * 0.12 * 0.4 + Math.random() * 2.5);       // just in from the wall's face at that height
  trees.add(Math.random() < 0.65 ? 'umbrella' : 'palm', x, y, z, 6 + Math.random() * 9);
}
for (let i = 0; i < 160; i++) { const side = i % 2 ? 1 : -1; trees.add(['umbrella', 'eucalyptus', 'umbrella'][i % 3], side * (34 + Math.random() * 8), 80, 60 - Math.random() * (LONGEST + 160), 14 + Math.random() * 10); }
trees.build();
// Boulders in the river and along its banks, white water round them.
{
  const stone = new THREE.MeshStandardMaterial({ color: 0x7a7266, roughness: 0.9 });
  const foam = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.4, depthWrite: false });
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const n = 90, rocks = new THREE.InstancedMesh(geo, stone, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const bank = Math.random() < 0.55, x = bank ? (Math.random() < 0.5 ? -1 : 1) * (24 + Math.random() * 9) : (Math.random() - 0.5) * 40, z = 40 - Math.random() * (LONGEST + 100);
    const r = 1 + Math.random() * 3.5;
    q.setFromEuler(e.set(Math.random(), Math.random() * 6, Math.random()));
    m.compose(new THREE.Vector3(x, r * 0.35, z), q, new THREE.Vector3(r, r * 0.7, r * 1.2)); rocks.setMatrixAt(i, m);
    if (!bank) { const f = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r * 1.6, 20), foam); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.06, z); scene.add(f); }
  }
  rocks.castShadow = true; rocks.receiveShadow = true; scene.add(rocks);
}
// The cliff tops: rainforest floor.
for (const side of [-1, 1]) { const top = new THREE.Mesh(new THREE.PlaneGeometry(200, LONGEST + 300), new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 1 })); top.rotation.x = -Math.PI / 2; top.position.set(side * 134, 82, -LONGEST / 2); scene.add(top); }
// Barron Falls: a wide fall of white water down the far wall, beside the middle of the line.
const fallTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  for (let x = 0; x < 64; x++) for (let y = 0; y < 256; y += 2) { const v = 190 + Math.random() * 65; g.fillStyle = `rgba(${v},${v + 5},${v + 8},${0.55 + Math.random() * 0.45})`; g.fillRect(x, y, 1, 2 + Math.random() * 10); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 2); return t; })();
const fallGeo = new THREE.PlaneGeometry(46, 82, 24, 24);
{ const p = fallGeo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), u = (y + 41) / 82;                 // 0 at the pool, 1 at the lip
    p.setZ(i, Math.pow(u, 3) * 9 + Math.sin(x * 0.4) * 0.8);              // curving out over the lip, ribbed
    const edge = 1 - Math.pow(Math.abs(x) / 23, 3);                       // thinning out at the sides
    col.push(1, 1, 1, Math.max(0, edge));
  }
  fallGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); fallGeo.computeVertexNormals(); }
const falls = new THREE.Mesh(fallGeo, new THREE.MeshStandardMaterial({ map: fallTex, vertexColors: true, transparent: true, opacity: 0.9, roughness: 0.3, emissive: 0x2a3436, depthWrite: false, side: THREE.DoubleSide }));
falls.position.set(-26, 41, -LONGEST * 0.5); falls.rotation.y = Math.PI / 2 - 0.75; scene.add(falls);   // turned toward the rider coming down the line
const pool = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshStandardMaterial({ color: 0xe8f4f4, transparent: true, opacity: 0.6, roughness: 0.4 })); pool.rotation.x = -Math.PI / 2; pool.position.set(-22, 0.05, -LONGEST * 0.5 + 4); scene.add(pool);   // white water where it lands
const mist = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(Float32Array.from({ length: 900 }, (_, i) => i % 3 === 0 ? -30 + Math.random() * 30 : i % 3 === 1 ? Math.random() * 30 : -LONGEST * 0.5 + (Math.random() - 0.5) * 50), 3)),
  new THREE.PointsMaterial({ color: 0xffffff, size: 3, transparent: true, opacity: 0.4, depthWrite: false, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() }));
mist.userData.noAO = true; scene.add(mist);

// ---- The line: cable, platforms, things hanging along it, branches ------------------------
let line = null, lay = null, cable = null, things = [], branches = [], lights = [];
const lineGroup = new THREE.Group(); scene.add(lineGroup);
const wood = new THREE.MeshStandardMaterial({ color: 0x7a5536, roughness: 0.85 }), steel = new THREE.MeshStandardMaterial({ color: 0x8a8f95, metalness: 0.8, roughness: 0.3 });
function tokenMesh() { const c = document.createElement('canvas'); c.width = 128; c.height = 80; const g = c.getContext('2d'); g.fillStyle = '#ffd166'; g.fillRect(0, 0, 128, 80); g.fillStyle = '#102030'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('TOKEN', 64, 52);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.44), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide, emissive: 0x332200 })); return m; }
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
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); glint.scale.setScalar(1.1); glint.position.copy(p); glint.userData.noAO = true; lineGroup.add(glint); mesh.userData.glint = glint;
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
window.chomp = { game, wally };
function toast(text, kind = 'good') { const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text; $('toasts').appendChild(el); setTimeout(() => el.remove(), 1800); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }
addEventListener('keydown', e => { game.keys.add(e.key); if (e.key === ' ') e.preventDefault(); });
addEventListener('keyup', e => game.keys.delete(e.key));

function start() {
  const r = params.has('free') ? { ok: true, progress: load() } : useTicket(load(), 'zipline');
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
  // Camera: behind him, a little above, looking down the line.
  const ahead = Math.min(1, st.s + 30 / line.length);
  camera.position.lerp(new THREE.Vector3(2.6 + game.side * 0.3, cy - 1.2, z + 7.5), 0.15);   // beside and just below the cable
  camera.lookAt(new THREE.Vector3(0, cableY(line, ahead) - HANG - 1, -ahead * line.length));
  for (const th of things) if (!th.got) th.mesh.rotation.y += 0.03;
  for (const b of lights) b.material.color.setHSL(0.11, 1, 0.6 + 0.15 * Math.sin(t * 4 + b.position.z));
}

function finish() {
  game.running = false; $('hud').hidden = true; $('z-brake-hint').hidden = true;
  const pts = score(game.got, game.branchesHit, game.land);
  let p = bankFinds(load(), { mangoes: game.got.mango, coins: game.got.gold });
  const tokens = game.got.token + (game.land === 'perfect' ? 2 : 0);
  p = { ...p, tokens: (p.tokens || 0) + tokens, ziplineBest: { ...(p.ziplineBest || {}), [game.chosen]: Math.max((p.ziplineBest || {})[game.chosen] || 0, pts) } };
  const gearWon = [];
  for (let i = 0; i < game.got.gear; i++) { const a = ABILITIES[Math.floor(Math.random() * ABILITIES.length)]; p = giveGear(p, a.id); gearWon.push(a); }
  saveProgress(p);
  for (const a of gearWon) bookFound(a.id);
  if (game.got.mango) bookFound('mango'); if (game.got.gold) bookFound('gold'); if (tokens) bookFound('token');
  sound.fanfare();
  $('result-title').textContent = game.land === 'perfect' ? 'Nailed the landing!' : game.land === 'pad' ? 'Whump! Into the pad' : 'Made it, hand over hand!';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Golden Mangoes', game.got.mango], ['Gold pieces', game.got.gold], ['Tourist Tokens', tokens], ['Gear found', gearWon.map(a => a.name).join(', ') || 'none'],
                            ['Branches hit', game.branchesHit], ['Landing', { perfect: 'Perfect (+100)', pad: 'Safety pad (+20)', short: 'Short' }[game.land]], ['Score', pts], ['Best on this line', p.ziplineBest[game.chosen]]]) {
    const li = document.createElement('li'); li.innerHTML = '<span></span><b></b>'; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  $('result').hidden = false;
  drawTitle();
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
if (!activityOpen(progress, 'zipline') && !params.has('all')) {
  $('title').querySelector('p:not(.area)').textContent = 'The zip line opens with more stars. Earn stars across the trip and come back!';
  $('ride').hidden = true;
}
installMap({ pause: () => {} }); installShop({ pause: () => {} }); installBook({ pause: () => {} });
buildLine('practice'); drawTitle();

// ---- Loop -----------------------------------------------------------------------------------
let last = performance.now(), t = 0;
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  if (game.running) { step(dt); drawHud(); }
  place(t);
  if (wally.skin) wally.skin.update(dt);
  fallTex.offset.y -= dt * 0.9;
  daynight.update(dt, camera);
  sun.position.set(camera.position.x - 60, 120, camera.position.z - 40); sun.target.position.copy(camera.position);
  post.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play')) { game.chosen = params.get('line') || 'practice'; start(); }
