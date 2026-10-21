// push.js
// The Great Push (Ken, 2026-10-21; MASTER.md section 6, the rescue). Played: Wally swims up the
// Daintree River with the ten crocs of Croc Park in his line, to the tour boat stuck on the sandbar,
// the wild crocs still round it. At the stern his crocs take their places along the hull, and on the
// beat of "Heave!" they all shove together. The wild crocs round the boat join too, once Wally touches
// each with the sceptre (Ken), so they all push together (Space, a click, or A), until the boat slides off the sand
// into deep water and everyone cheers. Then the ending.
// The river is the Daintree level's (daintree-rules.js, daintree-scene.js); the push is push-rules.js
// and the line is rescue-rules.js (all tested).

import * as THREE from 'three';
import { AGROUND_Z, BOAT_LENGTH, riverX, boatX, groundAt, insideRiver, crocsRoundBoat } from './daintree-rules.js';
import { buildDaintree } from './daintree-scene.js';
import { BEAT, CROCS, PARK, CALL, READY, NEEDED, offBeat, quality, rating, heave, settle, afloat, beatOf } from './push-rules.js';
import { SPACING, addToTrail, placeInLine, follow } from './rescue-rules.js';
import { Wally } from '../wally.js';
import { Input, steering, easeBehind } from '../input.js';
import { Bubbles } from '../bubbles.js';
import { Effects } from '../fx.js';
import { loadModels, ModelSkin, MODEL_FILES } from '../models.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import { peopleModels } from '../tourists.js';
import { readProgress, outfitModel, wearing } from '../progress.js';
import { dressOutfit } from '../outfit.js';
import { loadRealism } from '../realism.js';
import * as sound from '../sound.js';
import { say as forDevice } from '../device.js';
import { areaIntro, courseShots, orbitShots } from '../area-intro.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');

// ---- Stage --------------------------------------------------------------------------
let quality_ = pickQuality();
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality_.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality_)); renderer.shadowMap.enabled = quality_.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1400);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 72 : 58; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const fpsWatch = watchFrameRate(quality_, lower => { quality_ = lower; renderer.setPixelRatio(pixelRatioFor(lower)); resize(); });
// Entering: round the stuck boat with the stage's name (Ken).
const intro = areaIntro({ id: 'push', name: 'The Great Push', place: 'The Daintree River', focus: on => fpsWatch.focus(on),
  shots: () => orbitShots({ centre: { x: boatX(AGROUND_Z), y: 0, z: AGROUND_Z }, radius: 40, height: 28, low: 12, a0: Math.PI * 0.6, a1: Math.PI * 1.25 }) });

const models = await loadModels([...MODEL_FILES, 'river-boat'], { light: touch || quality_.name === 'low' });
const realism = await loadRealism(renderer, { light: touch || quality_.name === 'low' });
const world = buildDaintree(scene, quality_, realism);

// ---- The boat on the sandbar, and its passengers ----------------------------------------------
const boatHeading = z => Math.atan2(boatX(z + 1) - boatX(z - 1), 2);
const boat = { root: new THREE.Group(), moved: 0, float: 0 };
scene.add(boat.root);
{
  const gltf = models.get('river-boat');
  if (gltf) {
    const m = gltf.scene.clone(true), box = new THREE.Box3().setFromObject(m);
    m.scale.setScalar(BOAT_LENGTH / box.getSize(new THREE.Vector3()).x);
    const b2 = new THREE.Box3().setFromObject(m); m.position.y = -0.45 - b2.min.y; m.rotation.y = Math.PI / 2;
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    boat.root.add(m);
  }
}
const passengers = peopleModels(models).slice(0, 8).map((gltf, i) => {
  const tall = gltf.userData.tall, h = Array.isArray(tall) ? (tall[0] + tall[1]) / 2 : 1.72;
  const g = new THREE.Group(), skin = new ModelSkin(gltf, { height: h }); g.add(skin.root); boat.root.add(g);
  const side = i % 2 ? 1 : -1; g.position.set(side * 1.05, 0.55, -3.6 + Math.floor(i / 2) * 2.4); g.rotation.y = side * Math.PI / 2;
  return { g, skin };
});
// The boat's place: back along the river by how far it has been pushed, listing on the sand until free.
function placeBoat(t) {
  const z = AGROUND_Z - boat.moved - boat.float;
  boat.root.position.set(boatX(z), afloat(boat.moved) ? Math.sin(t * 1.4) * 0.06 : 0.25 * (1 - boat.moved / NEEDED), z);
  boat.root.rotation.set(afloat(boat.moved) ? 0 : -0.05 * (1 - boat.moved / NEEDED), boatHeading(z) + boat.turn, afloat(boat.moved) ? 0 : 0.06 * (1 - boat.moved / NEEDED));
}
boat.turn = 0;
const stern = () => { const z = AGROUND_Z - boat.moved - BOAT_LENGTH / 2 - 1.5; return { x: boatX(z), z }; };

// ---- The ground: the river, the boat solid ----------------------------------------------------
setGround({
  stand(x, z) { const g = groundAt(x, z); return { y: g.y, surface: g.surface === 'water' ? 'water' : 'land' }; },
  move(x, z, nx, nz) {
    const bz = boat.root.position.z, bx = boat.root.position.x;
    const blocked = (px, pz) => !insideRiver(px, pz) || (Math.abs(pz - bz) < BOAT_LENGTH / 2 + 0.4 && Math.abs(px - bx) < 2.2);
    if (!blocked(nx, nz)) return { x: nx, z: nz };
    if (!blocked(nx, z)) return { x: nx, z };
    if (!blocked(x, nz)) return { x, z: nz };
    return { x, z };
  },
  foodAt: () => 0, isWater: (x, z) => groundAt(x, z).surface === 'water',
  start: () => ({ x: boatX(AGROUND_Z - 42), y: -0.45, z: AGROUND_Z - 42 }),
});

// ---- Wally with the sceptre, the park's crocs in his line, the wild crocs round the boat ---------
const wally = new Wally(scene);
const progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
wally.useModel(models.get(outfitModel(progress)) || models.get('wally'));
if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(progress, 'wally'));
wally.pos.set(boatX(AGROUND_Z - 42), -0.45, AGROUND_Z - 42); wally.facing = 0; wally.root.position.copy(wally.pos);
const sceptre = (() => {
  const g = new THREE.Group(), gl = models.get('sceptre');
  if (gl) { const m = gl.scene.clone(true), b = new THREE.Box3().setFromObject(m); m.scale.setScalar(1.5 / b.getSize(new THREE.Vector3()).y); m.position.sub(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3())); m.position.y += 0.45; g.add(m); }
  const light = new THREE.PointLight(0xffe2a0, 5, 12); light.position.y = 1.1; g.add(light); g.userData.light = light; scene.add(g); return g;
})();
let hand = null; if (wally.skin) wally.skin.root.traverse(o => { if (o.isBone && /RightHand$/.test(o.name)) hand = o; });
function holdSceptre(t) {
  if (wally.poser && wally.poser.ok) { wally.poser.tilt('RightArm', 0, 0, -1.25); wally.poser.tilt('RightForeArm', 0, 0, -0.3); }
  if (wally.skin) wally.skin.root.updateMatrixWorld(true);
  if (hand) hand.getWorldPosition(sceptre.position); else sceptre.position.copy(wally.pos).add(new THREE.Vector3(0.5, 2.4, 0));
  sceptre.rotation.y = wally.facing; sceptre.userData.light.intensity = 5 + Math.sin(t * 3) + (game.flash || 0) * 40; game.flash = Math.max(0, (game.flash || 0) - 0.04);
}
const crocGltf = models.get('croc-regular') || models.get('croc');
function croc(x, z, heading) {
  const holder = new THREE.Group(); scene.add(holder); let skin = null;
  if (crocGltf) { skin = new ModelSkin(crocGltf, { length: 3.4 }); skin.root.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; }); holder.add(skin.root); skin.play('swim', { alternatives: ['idle'] }); }
  holder.position.set(x, -0.25, z); holder.rotation.y = heading;
  return { x, z, heading, holder, skin, lunge: 0 };
}
const parkCrocs = Array.from({ length: PARK }, (_, i) => croc(wally.pos.x + (i % 2 ? 1 : -1), wally.pos.z - SPACING * (i + 1), 0));
const trail = []; for (let z = wally.pos.z - SPACING * 12; z <= wally.pos.z; z += 0.4) trail.unshift({ x: wally.pos.x, z });
const wild = crocsRoundBoat().map(s => ({ ...croc(s.x, s.z, Math.atan2(boatX(AGROUND_Z) - s.x, AGROUND_Z - s.z)), wild: true, called: false }));
// The line: the park's crocs, then each wild croc in the order Wally touches it.
const line = [...parkCrocs];
// A glowing ring at the stern: where to lead them.
const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8 }));
ring.rotation.x = -Math.PI / 2; ring.userData.noAO = true; scene.add(ring);
// Their places for the push: a fan round the stern and along both sides of the hull, facing it.
function pushPlace(i) {
  const z0 = AGROUND_Z - boat.moved, side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
  if (k <= 1) return { x: boatX(z0) + side * (0.9 + k * 1.8), z: z0 - BOAT_LENGTH / 2 - 2.2, heading: 0 };   // four at the stern
  const along = -BOAT_LENGTH / 2 + 0.6 + (k - 2) * 1.5;                                                         // along the sides, toward the bow
  return { x: boatX(z0 + along) + side * 3.6, z: z0 + along, heading: side > 0 ? -Math.PI / 2 + 0.5 : Math.PI / 2 - 0.5 };
}

// ---- The beat meter ------------------------------------------------------------------------------
const meter = document.createElement('div'); meter.className = 'push-meter'; meter.hidden = true;
meter.innerHTML = '<div class="push-track"><i class="push-zone"></i><i class="push-needle"></i></div><p class="push-word"></p><div class="push-progress"><i></i></div>';
document.body.append(meter);
const needle = meter.querySelector('.push-needle'), word = meter.querySelector('.push-word'), bar = meter.querySelector('.push-progress i');

// ---- State and controls ----------------------------------------------------------------------------
const input = new Input(canvas, touch ? { stick: $('stick'), knob: $('knob'), jump: $('t-jump'), fours: $('t-fours'), pause: $('t-pause'), cam: $('t-cam') } : null);
const bubbles = new Bubbles(scene, touch ? 3 : 4);
const fx = new Effects(scene, { items: [] });
const game = { running: false, phase: 'swim', time: 0, beatT: 0, lastBeat: -1, pressed: -1, heaves: 0, perfect: 0, done: false, flash: 0 };
window.chomp = { game, wally, boat, parkCrocs, scene, camera, wild, stern: () => stern() };
function toast(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 1800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}
function caption(text) { const el = $('cine-caption'); el.textContent = text; el.hidden = !text; }
function press() {
  if (game.phase !== 'push' || afloat(boat.moved)) return;
  const b = beatOf(game.beatT);
  if (b === game.pressed) return;                                     // one heave a beat
  game.pressed = b;
  const q = quality(game.beatT);
  word.textContent = rating(q); word.className = 'push-word ' + (q >= 1 ? 'perfect' : q > 0 ? 'good' : 'miss');
  if (q > 0) {
    boat.moved = heave(boat.moved, q); game.heaves++; if (q >= 1) game.perfect++;
    for (const c of line) c.lunge = 0.35 * q;
    sound.play.land(); fx.shake && fx.shake(0.25 * q); game.flash = q;
    fx.splash(new THREE.Vector3(stern().x, 0, stern().z + 2), 18);
    if (Math.random() < 0.5) bubbles.say(passengers[game.heaves % passengers.length].g, ['Go on!', 'It moved!', 'Heave!', 'Again!', 'Yes!'][game.heaves % 5], 1.6);
    if (afloat(boat.moved)) floated();
  } else sound.play.plop && sound.play.plop();
}
addEventListener('keydown', e => { if (game.phase === 'push' && [' ', 'Enter'].includes(e.key) && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); press(); } }, true);
canvas.addEventListener('pointerdown', () => press());
let padWas = false;
function padPress() { const p = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null; const a = !!(p && p.buttons[0] && p.buttons[0].pressed); if (a && !padWas) press(); padWas = a; }

// ---- One frame -----------------------------------------------------------------------------------
const cam = { yaw: Math.PI, pitch: 0.42, dist: 14, manual: 0 };
function step(dt, t) {
  game.time += dt;
  const k = input.read();
  if (game.phase === 'swim') {
    if (k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0) cam.manual = 1.2;
    cam.yaw += k.turn + k.turnKeys * dt * 2; cam.pitch = Math.min(1.35, Math.max(0.05, cam.pitch + k.tilt));
    wally.update(dt, k, cam.yaw, 1);
    addToTrail(trail, wally.pos.x, wally.pos.z, (CROCS + 2) * SPACING);
    line.forEach((c, i) => { const want = placeInLine(trail, i + 1); if (want) { const f = follow(c, want, dt); c.x = f.x; c.z = f.z; c.heading = f.heading; } });
    // The sceptre's touch: a wild croc he comes close to joins the line (Ken).
    for (const w of wild) if (!w.called && Math.hypot(w.x - wally.pos.x, w.z - wally.pos.z) < CALL) {
      w.called = true; line.push(w); game.flash = 1.5; sound.play.powerup();
      const n = wild.filter(x => x.called).length;
      toast(`A wild croc follows the sceptre! ${n} of ${wild.length}`, 'good');
      if (n === 1) bubbles.say(wally.root, "G'day, mate. Give us a hand, will ya?", 2.6);
      if (n === wild.length) bubbles.say(wally.root, 'Everyone together now. To the stern!', 2.8);
    }
    const s = stern(), allWild = wild.every(w => w.called);
    if (Math.hypot(wally.pos.x - s.x, wally.pos.z - s.z) < READY) {
      if (allWild) startPush();
      else if ((game.hint = (game.hint || 0) - dt) <= 0) { game.hint = 4; toast('Touch every wild croc round the boat with the sceptre first: it takes all of them', 'info'); }
    }
    if (game.phase === 'swim') $('job').textContent = allWild ? 'Lead them all to the stern of the boat (the gold ring)' : `Touch the wild crocs round the boat with the sceptre (${wild.filter(w => w.called).length} of ${wild.length}), then to the stern`;
  } else {
    wally.update(dt, { forward: 0, right: 0, jump: false, fours: false }, cam.yaw, 1);
    const s = stern(); wally.pos.x += (s.x - wally.pos.x) * Math.min(1, dt * 3); wally.pos.z += (s.z - 1.5 - wally.pos.z) * Math.min(1, dt * 3); wally.facing = 0;
    line.forEach((c, i) => { const p = pushPlace(i), f = follow(c, p, dt); c.x = f.x; c.z = f.z; c.heading = p.heading; });
  }
  { const s = stern(); ring.position.set(s.x, 0.05, s.z); ring.visible = game.phase === 'swim'; ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08); }
  holdSceptre(t);
  // The crocs' bodies: in the line, or pushing (a shove forward on each heave).
  for (const c of [...parkCrocs, ...wild]) {
    c.lunge = Math.max(0, c.lunge - dt * 1.2);
    c.holder.position.set(c.x + Math.sin(c.heading) * c.lunge, -0.25, c.z + Math.cos(c.heading) * c.lunge); c.holder.rotation.y = c.heading;
    if (c.skin) c.skin.update(dt * (c.lunge > 0 ? 2.5 : 1));
  }
  // Wild crocs not yet called wait round the boat, watching it.
  for (const w of wild) if (!w.called) w.heading = Math.atan2(boat.root.position.x - w.x, boat.root.position.z - w.z);
  // The beat.
  if (game.phase === 'push' && !afloat(boat.moved)) {
    game.beatT += dt; padPress();
    const e = offBeat(game.beatT);
    needle.style.left = `${50 + (e / (BEAT / 2)) * 50}%`;
    const b = beatOf(game.beatT);
    if (b !== game.lastBeat && e > 0.35) {                           // a beat just went by
      if (game.pressed !== b && game.lastBeat >= 0) { boat.moved = settle(boat.moved); word.textContent = 'Missed the beat'; word.className = 'push-word miss'; }
      game.lastBeat = b;
    }
    if (Math.abs(e) < 0.12 && !game.heaveSaid) { game.heaveSaid = true; bubbles.say(wally.root, 'HEAVE!', 0.6); }
    if (Math.abs(e) > 0.4) game.heaveSaid = false;
    bar.style.width = `${(boat.moved / NEEDED) * 100}%`;
  }
  if (game.phase === 'afloat') afloatStep(dt);
  for (const p of passengers) { p.skin.play(game.phase === 'afloat' || (game.phase === 'push' && boat.moved > 0) ? 'cheer' : 'nervous', { alternatives: ['idle'] }); p.skin.update(dt); }
  placeBoat(t);
}
function startPush() {
  game.phase = 'push'; game.beatT = -1.2; game.lastBeat = -1; game.pressed = -99;
  meter.hidden = false; $('job').textContent = forDevice({ keys: 'Press Space on HEAVE!', mouse: 'Click on HEAVE!', pad: 'Press A on HEAVE!', touch: 'Tap on HEAVE!' });
  bubbles.say(wally.root, 'Right, fellas! Everyone on the hull. On my word... HEAVE!', 3.2);
  toast('Press on the beat: when the marker hits the middle, HEAVE!', 'info');
}
function floated() {
  game.phase = 'afloat'; game.afloatT = 0; meter.hidden = true;
  sound.fanfare && sound.fanfare(); game.flash = 2;
  caption('She floats!');
  bubbles.say(wally.root, "Crikey! She's off! Good on ya, fellas!", 3);
}
function afloatStep(dt) {
  game.afloatT += dt;
  boat.float += dt * 1.6 * Math.min(1, game.afloatT / 2);              // drifting back into deep water
  boat.turn = Math.min(0.5, game.afloatT * 0.08);
  for (const c of line) c.lunge = 0;
  if (game.afloatT > 2.5 && game.afloatT < 2.6) bubbles.say(passengers[0].g, 'Thank you, Wally!', 3);
  if (game.afloatT > 3 && game.afloatT < 3.1) bubbles.say(passengers[3].g, 'Hooray for the crocs!', 3);
  if (game.afloatT > 7 && !game.done) finish();
}
function finish() {
  game.done = true; game.running = false; $('hud').hidden = true;
  if (!params.has('stay')) { caption('The Wish'); $('fade').classList.add('on'); setTimeout(() => { location.href = 'ending.html?play'; }, 2200); return; }   // on to the ending by itself
  caption('');
  $('result-title').textContent = 'The boat is free!';
  $('result-why').textContent = `The crocs of Croc Park and the wild crocs of the Daintree pushed the tour boat off the sandbar together: ${game.heaves} heaves, ${game.perfect} perfect. Everyone is safe. Next: the ending. (The ending: next to build.)`;
  $('result').hidden = false; window.chomp.result = { heaves: game.heaves, perfect: game.perfect };
}

// ---- Camera ---------------------------------------------------------------------------------------
const camTarget = new THREE.Vector3();
function frameCamera(dt) {
  if (game.phase === 'swim') {
    camTarget.lerp(wally.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), Math.min(1, dt * 6));
    cam.manual = Math.max(0, cam.manual - dt);
    if (game.running && cam.manual <= 0) cam.yaw = steering() ? easeBehind(cam.yaw, wally.facing, dt) : cam.yaw;
    const cp = Math.cos(cam.pitch);
    camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
    camera.position.y = Math.max(camera.position.y, 1);
  } else {
    // Side on and up, from the open water: the boat, the crocs along it, the sand.
    const b = boat.root.position, want = new THREE.Vector3(b.x - 20, 11, b.z - 9);
    camera.position.lerp(want, Math.min(1, dt * 2)); camTarget.lerp(new THREE.Vector3(b.x, 0.5, b.z - 1), Math.min(1, dt * 3));
  }
  camera.lookAt(camTarget);
  if (window.chomp.camHold) window.chomp.camHold(camera);
}

function start() { if (intro.due()) { $('title').hidden = true; sound.start(); intro.play(camera, begin); return; } begin(); }
function begin() { sound.start(); sound.startMusic('esplanade'); $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch; game.running = true; $('job').textContent = 'Touch the wild crocs round the boat with the sceptre, then lead everyone to the stern'; bubbles.say(wally.root, 'There she is, stuck fast. Follow me, everyone!', 3.2, 2); }
$('play').onclick = start;
$('again').onclick = () => location.reload();

// ---- Loop -----------------------------------------------------------------------------------------
camTarget.copy(wally.pos).add(new THREE.Vector3(0, 1.3, 0));
let t = 0, last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  if (game.running) step(dt, t); else { holdSceptre(t); placeBoat(t); for (const c of [...parkCrocs, ...wild]) { c.holder.position.set(c.x, -0.25, c.z); if (c.skin) c.skin.update(dt); } for (const p of passengers) { p.skin.play('nervous', { alternatives: ['idle'] }); p.skin.update(dt); } }
  bubbles.update(dt); fx.update(dt, t); world.update(t, camera);
  frameCamera(dt); intro.update(dt, camera); fpsWatch(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play')) start();
