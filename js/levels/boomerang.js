// boomerang.js
// The boomerang throw, a Kuranda adventure (Ken, 2026-10-18): Wally throws at
// targets (things, never animals) and catches it as it comes back round. A
// lesson first time: where to aim, when to let go, what the release angle
// does and how to catch. The flight is in boomerang-rules.js (tested).
//
// Controls: Left / Right aim, Up / Down release angle, hold Space and let go
// with the power bar in the green, C (or a click) to catch.

import * as THREE from 'three';
import { installVR, inVR } from '../vr.js';
import { Wally } from '../wally.js';
import { loadModels } from '../models.js';
import { createPost } from '../post.js';
import { pickQuality, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { installMap } from '../mapmodal.js';
import { loadRealism, surfaceMaterial } from '../realism.js';
import { Trees } from '../trees.js';
import { Grass } from '../grass.js';
import { addSky, addLights } from '../world.js';
import { readProgress, saveProgress, outfitModel, wearing, activityOpen } from '../progress.js';
import { dressOutfit } from '../outfit.js';
import { installBook } from '../book.js';
import { flight, positionAt, landsAt, hits, catchable, throwPoints, IDEAL_ANGLE, ANGLE_RANGE, THROWS } from './boomerang-rules.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
const FROM = { x: 0, y: 1.6, z: 0 };

// ---- Stage ----------------------------------------------------------------------------
const quality = pickQuality();
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality)); renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

setGround({ stand: () => ({ y: 0, surface: 'land' }), move: (x, z) => ({ x, z }), foodAt: () => 0, isWater: () => false, start: () => ({ x: 0, y: 0, z: 0 }) });
const models = await loadModels(['wally', 'wally-explorer'], { light: touch || quality.name === 'low' });
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light: touch || quality.name === 'low' });

addSky(scene);
const sun = addLights(scene, quality); scene.add(sun.target);
if (realism && realism.sky) { scene.background = realism.sky.background; scene.environment = realism.sky.environment; scene.environmentIntensity = 0.6; }
const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));

// The throwing ground: a mown clearing ringed by rainforest.
const lawn = surfaceMaterial(realism, 'grass', 40, 40, { color: 0xc8d4b8 }) || new THREE.MeshStandardMaterial({ color: 0x5f8f42 });
const field = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), lawn); field.rotation.x = -Math.PI / 2; field.receiveShadow = true; scene.add(field);
const grass = new Grass(scene, { x0: -50, x1: 50, z0: -50, z1: 20, heightAt: () => 0, tufts: quality.name === 'high' ? 14000 : 6000, density: (x, z) => Math.hypot(x, z + 8) < 22 ? 0.25 : 1.2 });
const trees = new Trees(scene, { light: quality.name === 'low' });
for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2 + Math.random() * 0.05, r = 34 + Math.random() * 20; trees.add(i % 3 ? 'umbrella' : 'eucalyptus', Math.cos(a) * r, 0, Math.sin(a) * r - 8, 10 + Math.random() * 8); }
trees.build();

// ---- Targets: things only (Ken: no animals) -------------------------------------------------
const std = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
function post_(x, z, h) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, h, 8), std(0x6e4a2c)); p.position.set(x, h / 2, z); p.castShadow = true; scene.add(p); }
const targets = [];
function addTarget(kind, x, z) {
  let mesh, y, r;
  if (kind === 'tin') { post_(x, z, 1.4); mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 18), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.8, roughness: 0.3 })); y = 1.58; r = 0.3; }
  else if (kind === 'bottle') { post_(x, z, 1.2); mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.5, 14), new THREE.MeshStandardMaterial({ color: 0x3a8f5a, roughness: 0.1, transparent: true, opacity: 0.8 })); y = 1.45; r = 0.28; }
  else if (kind === 'melon') { post_(x, z, 0.9); mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), std(0x2f7a3a)); y = 1.2; r = 0.35; mesh.scale.y = 0.85; }
  else if (kind === 'bell') {
    for (const s of [-1, 1]) post_(x + s * 0.7, z, 2.6);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), std(0x6e4a2c)); beam.position.set(x, 2.6, z); scene.add(beam);
    mesh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.42, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xd4a52c, metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide })); y = 2.2; r = 0.36;
  } else {                                                    // a painted target board
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    ['#d8452f', '#f6efe0', '#d8452f', '#f6efe0', '#ffd23a'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(64, 64, 62 - i * 12, 0, Math.PI * 2); g.fill(); });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 28), [std(0x6e4a2c), new THREE.MeshStandardMaterial({ map: tex }), new THREE.MeshStandardMaterial({ map: tex })]);
    mesh.rotation.x = Math.PI / 2; post_(x, z, 1.3); y = 1.6; r = 0.55;
  }
  mesh.position.set(x, y, z); mesh.castShadow = true; scene.add(mesh);
  targets.push({ kind, x, y, z, r, mesh, down: false, t: 0 });
}
// Spread round the left-curving loops that throws make, near and far.
function layTargets() {
  for (const t of targets) scene.remove(t.mesh);
  targets.length = 0;
  const kinds = ['tin', 'bottle', 'melon', 'bell', 'board', 'tin', 'bottle', 'melon'];
  for (let i = 0; i < kinds.length; i++) {
    const f = flight(FROM, (Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 0.8, IDEAL_ANGLE);
    const p = positionAt(f, 0.18 + Math.random() * 0.6);
    addTarget(kinds[i], p.x + (Math.random() - 0.5) * 1.5, p.z + (Math.random() - 0.5) * 1.5);
  }
}
layTargets();

// ---- The boomerang: polished timber, two arms, a red band ------------------------------------
const boom = new THREE.Group();
{
  const shape = new THREE.Shape();
  shape.moveTo(-0.38, 0.05); shape.quadraticCurveTo(0, 0.2, 0.38, 0.05); shape.lineTo(0.36, -0.03); shape.quadraticCurveTo(0, 0.1, -0.36, -0.03); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
  geo.center(); geo.rotateX(Math.PI / 2);
  const wood = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.35 }));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.12), new THREE.MeshStandardMaterial({ color: 0xc23b2b, roughness: 0.4 })); band.position.set(0.2, 0, 0);
  const band2 = band.clone(); band2.position.x = -0.2;
  boom.add(wood, band, band2); boom.traverse(o => { if (o.isMesh) o.castShadow = true; });
  boom.scale.setScalar(1.6);
}
scene.add(boom);
// The path the guide draws in the lesson and the first throws: a dotted line.
const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }), 60);
dots.userData.noAO = true; scene.add(dots);

// ---- Wally ----------------------------------------------------------------------------------
const wally = new Wally(scene);
const progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
wally.useModel(models.get(outfitModel(progress)) || models.get('wally'));
if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(progress, 'wally'));
wally.pos.set(0, 0, 0.6); wally.facing = Math.PI;

// ---- Game -----------------------------------------------------------------------------------
const game = { running: false, state: 'aim', aim: 0, angle: IDEAL_ANGLE, power: 0, charging: false, chargeT: 0, f: null, u: 0, throws: THROWS,
  score: 0, hits: 0, catches: 0, thisHits: [], wait: 0, guide: true, keys: new Set(), caught: false };
window.chomp = { game, wally, targets };

function toast(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text; $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 1800); while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

addEventListener('keydown', e => {
  if (!game.running) return;
  game.keys.add(e.key);
  if (e.key === ' ' && game.state === 'aim' && !game.charging) { game.charging = true; game.chargeT = 0; e.preventDefault(); }
  if ((e.key === 'c' || e.key === 'C') && game.state === 'flying') tryCatch();
});
addEventListener('keyup', e => {
  game.keys.delete(e.key);
  if (e.key === ' ' && game.charging) { game.charging = false; release(); }
});
canvas.addEventListener('pointerdown', () => { if (game.running && game.state === 'flying') tryCatch(); });

function release() {
  game.f = flight(FROM, game.aim, game.power, game.angle);
  game.thisHits = hits(game.f, targets.filter(t => !t.down));
  game.u = 0; game.state = 'flying'; game.caught = false; game.throws--;
  sound.play.leap();
}
function tryCatch() {
  if (game.caught) return;
  const hands = { x: wally.pos.x, y: 1.6, z: wally.pos.z };
  if (catchable(game.f, game.u, hands)) { game.caught = true; finishThrow(true); }
  else if (game.u < 0.85) toast('Too early! Wait till it comes back round', 'bad');
}
function finishThrow(caught) {
  const n = game.thisHits.length;
  game.hits += n; if (caught) game.catches++;
  const pts = throwPoints(n, caught); game.score += pts;
  if (caught) { sound.play.powerup(); toast(n ? `Caught it, and ${n} hit! +${pts}` : `Beauty, caught it! +${pts}`, 'good'); wally.cheer = 1.2; }
  else { sound.play.plop(); toast(n ? `${n} hit, but it got away (+${pts})` : landsAt(game.f) !== null ? 'Too low: it dropped short. Throw higher' : 'It sailed past: throw a bit lower', 'bad'); }
  game.state = 'wait'; game.wait = 1.6;
}

function step(dt) {
  if (game.state === 'aim') {
    if (game.keys.has('ArrowLeft')) game.aim = Math.max(-1.1, game.aim - dt * 0.9);
    if (game.keys.has('ArrowRight')) game.aim = Math.min(1.1, game.aim + dt * 0.9);
    if (game.keys.has('ArrowUp')) game.angle = Math.min(ANGLE_RANGE[1], game.angle + dt * 12);
    if (game.keys.has('ArrowDown')) game.angle = Math.max(ANGLE_RANGE[0], game.angle - dt * 12);
    if (game.charging) { game.chargeT += dt; game.power = 0.5 - 0.5 * Math.cos(game.chargeT * 2.4); }       // the bar sweeps up and down until he lets go
    boom.position.set(wally.pos.x + 0.6, 1.9, wally.pos.z - 0.2); boom.rotation.set(0, game.aim, 0.3);
    // The guide's dotted line (during the lesson's practice throws).
    const f = flight(FROM, game.aim, game.charging ? game.power : 0.55, game.angle);
    for (let i = 0; i < 60; i++) { const p = positionAt(f, i / 59); dots.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)); }
    dots.instanceMatrix.needsUpdate = true; dots.visible = game.guide;
  } else if (game.state === 'flying') {
    dots.visible = false;
    game.u += dt / game.f.T;
    const end = landsAt(game.f);
    const p = positionAt(game.f, Math.min(game.u, end ?? 1));
    boom.position.set(p.x, p.y, p.z); boom.rotation.y += dt * 28;
    // Knock over the targets as it passes them.
    for (const t of targets) if (!t.down && Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z) < t.r + 0.35) { t.down = true; t.t = 0; sound.play.goal(); }
    const hands = { x: wally.pos.x, y: 1.6, z: wally.pos.z };
    $('catch-ring').hidden = !catchable(game.f, Math.min(1, game.u), hands);
    if ((end !== null && game.u >= end) || game.u >= 1.08) { $('catch-ring').hidden = true; finishThrow(false); }
  } else if (game.state === 'wait') {
    game.wait -= dt;
    if (game.wait <= 0) {
      if (game.throws <= 0) return end();
      game.state = 'aim'; game.power = 0; if (game.throws <= THROWS - 2) game.guide = false;
    }
  }
  // Targets that have been hit topple and fall.
  for (const t of targets) if (t.down && t.t < 1) { t.t = Math.min(1, t.t + dt * 2); t.mesh.position.y = t.y - t.t * t.t * (t.y - 0.15); t.mesh.rotation.z = t.t * 1.4; }
  wally.facing = Math.PI - game.aim;
  wally.update(dt, { forward: 0, right: 0, jump: false, fours: false, turn: 0, turnKeys: 0, tilt: 0, zoom: 0 }, 0, 1);
}

function end() {
  game.running = false; $('hud').hidden = true;
  const tokens = game.catches + Math.floor(game.hits / 2);   // Golden Mangoes won
  const p = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
  saveProgress({ ...p, mangoes: (p.mangoes || 0) + tokens, boomerangBest: Math.max(p.boomerangBest || 0, game.score) });
  sound.fanfare();
  $('result-title').textContent = game.catches >= 3 ? 'A natural, mate!' : game.catches ? 'Getting the hang of it!' : 'Keep practising!';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Targets knocked over', game.hits], ['Catches', `${game.catches} of ${THROWS}`], ['Score', game.score], ['Golden Mangoes earned', tokens]]) {
    const li = document.createElement('li'); li.innerHTML = '<span></span><b></b>'; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  $('result').hidden = false;
}

function drawHud() {
  $('score').textContent = game.score; $('throws').textContent = game.throws;
  $('power-fill').style.width = `${Math.round(game.power * 100)}%`;
  $('angle-needle').style.transform = `rotate(${-game.angle}deg)`; $('angle-num').textContent = `${Math.round(game.angle)}°`;
}

// ---- The lesson (Ken: show how to throw, release, angle and catch) ----------------------------
const LESSON = [
  { title: 'Aim to the right', pic: 'aim', text: 'A boomerang thrown right-handed curves round to the LEFT and comes back. So aim a little to the right of the target you want: the dotted line shows its path. Left and Right turn your aim.' },
  { title: 'Wind up and let go', pic: 'power', text: 'Hold Space: the power bar sweeps up and down. Let go when it is in the green. More power makes a bigger loop that reaches the far targets.' },
  { title: 'The release angle', pic: 'angle', text: 'Up and Down tilt the throw. About 15 degrees brings it right back to your hand. Too low and it drops short; too high and it climbs and sails over your head.' },
  { title: 'Catching it', pic: 'catch', text: 'As it comes back round, the yellow Catch ring shows round Wally. Press C (or click) then: a sandwich catch, one hand above and one below. Too early and it is still out on its loop.' },
];
let lessonAt = 0;
function showLesson(i) {
  lessonAt = i; const L = LESSON[i];
  $('tut-step').textContent = `${i + 1} of ${LESSON.length}`; $('tut-title').textContent = L.title; $('tut-text').textContent = L.text;
  $('tut-picture').className = `tut-picture tut-${L.pic}`;
  $('tut-next').textContent = i === LESSON.length - 1 ? 'Have a go!' : 'Next';
  $('tutorial').hidden = false; $('title').hidden = true;
}
$('tut-next').onclick = () => { if (lessonAt < LESSON.length - 1) showLesson(lessonAt + 1); else start(); };
$('tut-skip').onclick = () => start();
$('lesson').onclick = () => showLesson(0);

function start() {
  try { localStorage.setItem('chomp-boomerang-lesson', '1'); } catch { /* fine */ }
  sound.start();
  $('tutorial').hidden = true; $('title').hidden = true; $('result').hidden = true; $('hud').hidden = false;
  Object.assign(game, { running: true, state: 'aim', throws: THROWS, score: 0, hits: 0, catches: 0, guide: true, aim: 0, angle: IDEAL_ANGLE, power: 0 });
  layTargets();
}
$('play').onclick = () => { let seen = null; try { seen = localStorage.getItem('chomp-boomerang-lesson'); } catch { /* fine */ } seen ? start() : showLesson(0); };
$('again').onclick = start;

// Only once the stars have opened it (or ?all, for testing).
if (!activityOpen(progress, 'boomerang') && !params.has('all')) {
  $('title').querySelector('p:not(.area)').textContent = 'The boomerang lesson opens with more stars. Earn stars across the trip and come back!';
  $('play').hidden = true;
}
installMap({ pause: () => {} });
installBook({ pause: () => {} });

// ---- Loop -----------------------------------------------------------------------------------
let last = performance.now(), t = 0;
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  if (game.running) { step(dt); drawHud(); }
  // Camera: behind and above Wally, looking out over the ground; it follows a throw a little.
  const look = game.state === 'flying' ? boom.position.clone().multiplyScalar(0.35) : new THREE.Vector3(Math.sin(game.aim) * 6, 1.5, -Math.cos(game.aim) * 6);
  camera.position.lerp(new THREE.Vector3(-Math.sin(game.aim) * 7, 4.2, 7 + Math.cos(game.aim) * 0), 0.08);
  camera.lookAt(look);
  trees.update(t); grass.update(t);
  post.render();
  if (!inVR()) requestAnimationFrame(frame);   // in a VR headset, the headset sets the pace (vr.js)
}
installVR({ renderer, scene, camera, frame });   // a VR headset, if there is one (vr.js)
requestAnimationFrame(frame);
if (params.has('play')) start();
