// rescue.js
// Back in Croc Park (Ken, 2026-10-21; MASTER.md section 6, the rescue). Wally, holding the King's
// sceptre high at full power, calls out every croc in the park: walk up to one and the sceptre
// calls it into the line following him. With all of them called, the fence opens on the harbour
// side and he leads them across the sand into the sea, the people in the park cheering them out
// (Ken). Then, next to build: up the coast to the Daintree, and the push.
// The rules are rescue-rules.js (tested); the park is world.js's.

import * as THREE from 'three';
import { buildWorld, drawnHeight } from '../world.js';
import { Wally } from '../wally.js';
import { Input, steering, easeBehind } from '../input.js';
import { Bubbles } from '../bubbles.js';
import { Effects } from '../fx.js';
import { loadModels, ModelSkin, MODEL_FILES } from '../models.js';
import { createPost } from '../post.js';
import { loadRealism } from '../realism.js';
import { usePalmCrown } from '../palms.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround, parkGround } from '../ground.js';
import { peopleModels } from '../tourists.js';
import { readProgress, outfitModel, wearing } from '../progress.js';
import { dressOutfit } from '../outfit.js';
import * as sound from '../sound.js';
import { LAGOON, terrainHeight, isWater, WATER_Y, BOARDWALK, deckHeight } from '../rules.js';
import { CALL, GAP, FENCE, SEA_Z, startingCrocs, fenceDistance, inGap, onShore, inSea, addToTrail, placeInLine, follow, allCalled, SPACING } from './rescue-rules.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');

// ---- Stage --------------------------------------------------------------------------
let quality = pickQuality();
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality)); renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 68 : 55; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const fpsWatch = watchFrameRate(quality, lower => { quality = lower; renderer.setPixelRatio(pixelRatioFor(lower)); resize(); });

const models = await loadModels([...MODEL_FILES, 'sceptre-hero'], { light: touch || quality.name === 'low' });
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light: touch || quality.name === 'low' });
usePalmCrown(models.get('palm-crown'));
const GAP_ANGLE = (GAP.half + 0.6) / FENCE.rx;                     // the fence's opening, half its angle
const world = buildWorld(scene, quality, models, {}, realism, { fenceGap: GAP_ANGLE });
const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));
if (!world.photo) {
  const env = new THREE.Scene(); env.add(world.sky.clone());
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(env, 0.04).texture; scene.environmentIntensity = 0.8; pmrem.dispose();
}

// ---- The ground: the park as always; once the fence is open, the gap, the sand and the sea --
const game = { running: false, open: false, done: false, time: 0, called: 0, cheer: 0, finale: 0, hint: 0 };
const outside = (x, z) => z < 0 && fenceDistance(x, z) > 0.98;
const seaFloat = WATER_Y - 0.45;
setGround({
  stand(x, z, feetY, floatY, fromBelow) {
    if (!outside(x, z)) return parkGround.stand(x, z, feetY, floatY, fromBelow);
    const h = drawnHeight(x, z);
    return h < -0.3 ? { y: seaFloat, surface: 'water' } : { y: h, surface: 'land' };
  },
  move(x, z, nx, nz, y) {
    if (game.open && (inGap(nx, nz) || onShore(nx, nz))) return { x: nx, z: nz };
    if (outside(x, z) && game.open) return { x, z };                 // on the shore, stopped at its edges
    return parkGround.move(x, z, nx, nz, y);
  },
  isWater: (x, z) => (outside(x, z) ? drawnHeight(x, z) < -0.3 : isWater(x, z)),
});
const groundY = (x, z) => outside(x, z) ? Math.max(drawnHeight(x, z), seaFloat) : (isWater(x, z) ? WATER_Y - 0.3 : terrainHeight(x, z));
const wet = (x, z) => outside(x, z) ? drawnHeight(x, z) < -0.3 : isWater(x, z);

// ---- Wally, holding the sceptre high (Ken) ----------------------------------------------
const wally = new Wally(scene);
const progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
wally.useModel(models.get(outfitModel(progress)) || models.get('wally'));
if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(progress, 'wally'));
wally.pos.set(0, terrainHeight(0, 21), 21); wally.facing = Math.PI; wally.root.position.copy(wally.pos);
const sceptre = (() => {
  const g = new THREE.Group(), gl = models.get('sceptre-hero') || models.get('sceptre');
  if (gl) { const m = gl.scene.clone(true), b = new THREE.Box3().setFromObject(m); m.scale.setScalar(1.5 / b.getSize(new THREE.Vector3()).y); const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()); m.position.sub(c); m.position.y += 0.45; g.add(m); }
  const light = new THREE.PointLight(0xffe2a0, 6, 12); light.position.y = 1.1; g.add(light); g.userData.light = light;
  scene.add(g); return g;
})();
let hand = null;
if (wally.skin) wally.skin.root.traverse(o => { if (o.isBone && /RightHand$/.test(o.name)) hand = o; });
const handPos = new THREE.Vector3();
function holdSceptre(t) {
  // His right arm raised (on top of whatever move is playing), the sceptre upright in his hand.
  if (wally.poser && wally.poser.ok) { wally.poser.tilt('RightArm', 0, 0, -1.25); wally.poser.tilt('RightForeArm', 0, 0, -0.3); }
  wally.skin && wally.skin.root.updateMatrixWorld(true);
  if (hand) hand.getWorldPosition(handPos); else handPos.copy(wally.pos).add(new THREE.Vector3(0.5, 2.4, 0));
  sceptre.position.copy(handPos); sceptre.rotation.set(0, wally.facing, 0);
  const flash = Math.max(0, game.flash || 0);
  sceptre.userData.light.intensity = 5 + Math.sin(t * 3) * 1.2 + flash * 60;
  game.flash = flash - 0.03;
}

// ---- The crocs -------------------------------------------------------------------------------
const NAMES = ['Big Kev', 'Dazza', 'Mick', 'Trev', 'Shane', 'Gazza', 'Robbo', 'Davo', 'Bluey', 'Macca'];
const crocGltf = models.get('croc-regular') || models.get('croc');
const crocs = startingCrocs().map((s, i) => {
  const holder = new THREE.Group(); scene.add(holder);
  let skin = null;
  if (crocGltf) { skin = new ModelSkin(crocGltf, { length: 3.4 }); skin.root.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; }); holder.add(skin.root); }
  return { ...s, name: NAMES[i], heading: Math.random() * 6, called: false, order: 0, holder, skin, wander: Math.random() * 10 };
});
const trail = [];

// ---- The people in the park, watching; cheering as he leads them out (Ken) -----------------
const crowd = (() => {
  const cast = peopleModels(models), spots = [];
  for (let k = 0; k < 9; k++) { const a = 0.4 + k * 0.62; spots.push({ x: Math.cos(a) * FENCE.rx * 1.12, z: Math.sin(a) * FENCE.rz * 1.12 }); }   // outside the fence, all round
  for (const x of [-22, -12, 12, 22]) spots.push({ x, z: BOARDWALK.z, deck: true });                 // on the boardwalk
  for (const x of [-18, -10, 10, 18]) spots.push({ x, z: -FENCE.rz - 8, beach: true });               // and down on the sand, either side of the gap
  return spots.map((s, i) => {
    const gltf = cast[i % cast.length]; if (!gltf) return null;
    const tall = gltf.userData.tall, h = Array.isArray(tall) ? (tall[0] + tall[1]) / 2 : 1.72;
    const g = new THREE.Group(), skin = new ModelSkin(gltf, { height: h }); g.add(skin.root); scene.add(g);
    const y = s.deck ? deckHeight(s.x) : s.beach ? drawnHeight(s.x, s.z) : Math.max(0, terrainHeight(s.x, s.z));
    g.position.set(s.x, y, s.z); g.rotation.y = Math.atan2(-s.x, -s.z + (s.beach ? -20 : 0));   // facing in toward the lagoon (or the gap)
    return { g, skin, phase: Math.random() * 4 };
  }).filter(Boolean);
})();

// ---- The gate in the gap: two leaves that swing open in a flash of light ---------------------
const gate = (() => {
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5532, roughness: 0.85 }), leaves = [];
  const z = -FENCE.rz, y = terrainHeight(0, z);
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(s * GAP.half, y, z); scene.add(hinge);
    const leaf = new THREE.Group(); leaf.position.x = -s * GAP.half / 2; hinge.add(leaf);
    for (const h of [0.55, 1.1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(GAP.half, 0.1, 0.08), wood); r.position.y = h; leaf.add(r); }
    for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.25, 0.08), wood); p.position.set(-GAP.half / 2 + 0.2 + k * (GAP.half - 0.4) / 3, 0.62, 0); leaf.add(p); }
    leaves.push({ hinge, s });
  }
  return { leaves, open: 0 };
})();

// ---- Controls, words, camera ----------------------------------------------------------------
const input = new Input(canvas, touch ? { stick: $('stick'), knob: $('knob'), jump: $('t-jump'), fours: $('t-fours'), pause: $('t-pause'), cam: $('t-cam') } : null);
const bubbles = new Bubbles(scene, touch ? 3 : 4);
const fx = new Effects(scene, { items: [] });               // no food here: nothing is thrown
function toast(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 2200);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}
const cam = { yaw: Math.PI, pitch: 0.42, dist: 12, manual: 0 };
const camTarget = new THREE.Vector3();
function followCamera(dt) {
  camTarget.lerp(wally.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), Math.min(1, dt * 6));
  cam.manual = Math.max(0, cam.manual - dt);
  if (game.running && cam.manual <= 0) {
    if (steering()) cam.yaw = easeBehind(cam.yaw, wally.facing, dt);
    else { const dx = camera.position.x - camTarget.x, dz = camera.position.z - camTarget.z; if (dx * dx + dz * dz > 0.01) cam.yaw = Math.atan2(dx, dz); }
  }
  const dist = cam.dist + Math.min(8, game.called * 0.6);              // backing off as the line grows, to see it
  const cp = Math.cos(cam.pitch);
  camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * dist, camTarget.y + Math.sin(cam.pitch) * dist, camTarget.z + Math.cos(cam.yaw) * cp * dist);
  camera.position.y = Math.max(camera.position.y, groundY(camera.position.x, camera.position.z) + 1.2);
  camera.lookAt(camTarget);
  if (window.chomp && window.chomp.camHold) window.chomp.camHold(camera);
}

// ---- One frame -----------------------------------------------------------------------------------
function step(dt, t) {
  const k = input.read();
  game.time += dt;
  if (k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0) cam.manual = 1.2;
  cam.yaw += k.turn + k.turnKeys * dt * 2;
  cam.pitch = Math.min(1.35, Math.max(0.05, cam.pitch + k.tilt));
  const control = game.finale > 0 ? { forward: 0, right: 0, jump: false, fours: false, turn: 0, turnKeys: 0, tilt: 0, zoom: 0 } : k;
  for (const e of wally.update(dt, control, cam.yaw, 1)) { if (e === 'splash') { sound.play.splash(); fx.splash(wally.pos, 20); } }
  holdSceptre(t);
  addToTrail(trail, wally.pos.x, wally.pos.z, (crocs.length + 1) * SPACING);

  // Calling: the sceptre calls any croc he comes close to.
  for (const c of crocs) {
    if (c.called || Math.hypot(c.x - wally.pos.x, c.z - wally.pos.z) > CALL) continue;
    c.called = true; c.order = ++game.called; game.flash = 1; sound.play.powerup();
    toast(`${c.name} follows the sceptre! ${game.called} of ${crocs.length}`, 'good');
    if (game.called === 1) bubbles.say(wally.root, "That's it, mate. Follow me!", 2.6);
    if (allCalled(crocs)) openGate();
  }
  // Moving: called crocs follow in the line; the others cruise the lagoon or bask.
  for (const c of crocs) {
    let moving = false;
    if (c.called) {
      const want = placeInLine(trail, c.order);
      if (want) { const f = follow(c, want, dt); c.x = f.x; c.z = f.z; c.heading = f.heading; moving = f.moving; }
    } else if (c.place === 'lagoon') {
      c.wander += dt * 0.15; const tx = Math.cos(c.wander) * LAGOON.rx * 0.5, tz = Math.sin(c.wander * 1.3) * LAGOON.rz * 0.45;
      const f = follow(c, { x: c.x + (tx - c.x) * 0.02, z: c.z + (tz - c.z) * 0.02 }, dt * 0.2); c.x = f.x; c.z = f.z; c.heading = f.heading; moving = true;
    }
    c.holder.position.set(c.x, groundY(c.x, c.z), c.z); c.holder.rotation.y = c.heading;
    if (c.skin) { c.skin.play(wet(c.x, c.z) ? 'swim' : moving ? 'walk' : 'idle', { alternatives: ['swim', 'idle'] }); c.skin.update(dt); }
  }
  // The gate swings open; the people cheer as the line heads out (Ken).
  if (game.open && gate.open < 1) { gate.open = Math.min(1, gate.open + dt * 0.8); for (const l of gate.leaves) l.hinge.rotation.y = l.s * gate.open * 1.9; }
  const leaving = game.open && crocs.some(c => c.called && (inGap(c.x, c.z) || outside(c.x, c.z)));
  for (const p of crowd) {
    p.skin.play(leaving || game.finale > 0 ? 'cheer' : game.called ? 'wave' : 'idle', { alternatives: ['idle'] });
    p.skin.update(dt);
  }
  if (leaving && !game.cheered) { game.cheered = true; bubbles.say(crowd[crowd.length - 1].g, 'Go on, you good things!', 3); bubbles.say(crowd[2].g, 'Hooray! Off you go!', 3); }
  // All in the sea: the finale.
  // Out in the sea, the whole line through the fence behind him: they all swim out together.
  if (game.open && !game.finale && wally.pos.z < SEA_Z - 12 && crocs.every(c => outside(c.x, c.z))) startFinale();
  if (game.finale > 0) finaleStep(dt);
  if (!game.open && (game.hint -= dt) <= 0 && game.time > 8) { game.hint = 9; const left = crocs.filter(c => !c.called).length; if (left) toast(`${left} still to call. Walk up close to each croc`, 'info'); }
  drawHud();
}
function openGate() {
  game.open = true; game.flash = 2; sound.play.goal && sound.play.goal();
  fx.burst && fx.burst(new THREE.Vector3(0, 1.5, -FENCE.rz), [0xffe2a0, 0xffffff, 0x9fe8c0], 50);
  toast('Every croc is following! The fence is open: lead them to the sea', 'good');
  bubbles.say(wally.root, 'Right, everyone. To the sea! Follow the sceptre!', 3.4);
}
function startFinale() {
  game.finale = 0.001; toast('Free! Every croc of Croc Park is out in the sea', 'good');
  bubbles.say(wally.root, 'Up the coast now, fellas. The Daintree, and a boat to push!', 3.6);
}
function finaleStep(dt) {
  game.finale += dt;
  for (const c of crocs) { c.z -= dt * 4; c.heading = Math.PI; c.holder.position.set(c.x, groundY(c.x, c.z), c.z); c.holder.rotation.y = c.heading; }   // out to sea, north up the coast
  wally.pos.z -= dt * 2;
  if (game.finale > 6 && !game.done) finish();
}

function drawHud() {
  $('crocs-count').textContent = `${game.called} of ${crocs.length}`;
  $('job').textContent = !game.open ? 'Walk up to each croc: the sceptre calls it to follow you'
    : game.finale ? 'Up the coast to the Daintree!' : 'Lead them out through the gate, over the sand and into the sea';
}
function finish() {
  game.done = true; game.running = false; $('hud').hidden = true; $('touch').hidden = true;
  $('result-title').textContent = 'The crocs of Croc Park are free';
  $('result-why').textContent = 'Every croc followed the sceptre out to the sea. Next: up the coast to the Daintree, and the boat on the sandbar. ';
  $('result').hidden = false;
  $('again').textContent = 'Up the coast'; $('again').onclick = () => { location.href = 'coast.html'; };
  window.chomp.result = { done: true };
}

function start() {
  sound.start(); sound.startMusic('park');
  $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true;
  bubbles.say(wally.root, "G'day, fellas! The King's set you free. Follow me to the sea!", 3.8, 2);
  toast('Walk up to each croc: the sceptre calls it into your line', 'info');
}
$('play').onclick = start;
$('again').onclick = () => location.reload();

// ---- Loop -----------------------------------------------------------------------------------------
camTarget.copy(wally.pos).add(new THREE.Vector3(0, 1.6, 0));
let t = 0, last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  if (game.running) step(dt, t);
  else { holdSceptre(t); for (const c of crocs) { c.holder.position.set(c.x, groundY(c.x, c.z), c.z); c.holder.rotation.y = c.heading; if (c.skin) { c.skin.play(wet(c.x, c.z) ? 'swim' : 'idle', { alternatives: ['idle'] }); c.skin.update(dt); } } for (const p of crowd) { p.skin.play('idle'); p.skin.update(dt); } }
  bubbles.update(dt); fx.update(dt, t);
  if (world.update) world.update(t, dt, false, camera);
  followCamera(dt);
  fpsWatch(dt);
  post.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.chomp = { game, wally, crocs, scene, camera, trail };
if (params.has('play')) start();
