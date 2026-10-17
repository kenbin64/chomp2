// kuranda.js
// Level 4: Kuranda, the village in the rainforest (Ken, 2026-10-17). Wally
// has come up on the Skyrail. The market shoppers along the street throw him
// snacks if he keeps to the sweet spot (the same rule as everywhere). Feed out
// every group, fill the feed-o-meter, and the trail to Barron Falls opens at
// the end of the street. The clothes stall sells new gear for Wally and Kenny
// for Golden Mangoes, and the river-boat ticket for the Daintree.

import * as THREE from 'three';
import { Wally } from '../wally.js';
import { Food, randomKind, useJarModel } from '../food.js';
import { Input } from '../input.js';
import { Bubbles, pickLine, chatty } from '../bubbles.js';
import { Effects, CRUMBS } from '../fx.js';
import { loadModels, dress } from '../models.js';
import { createPost } from '../post.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { loadRealism } from '../realism.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, LIVES, REVIVE_ENERGY, inRedZone } from '../rules.js';
import { FULL } from '../quests.js';
import { HumanoidPoser } from '../rig.js';
import { completeArea, readProgress, starsFor, POSTCARDS, bankFinds, payEntry, WARDROBE, buyItem, wearItem, wearing,
         buyBoatTicket, BOAT_TICKET_PRICE } from '../progress.js';
import { Clusters } from '../clusters.js';
import { kennysJar } from '../food.js';
import { jarLabelTexture } from '../textures.js';
import { dressOutfit } from '../outfit.js';
import { buildKuranda, STREET, STALLS, SHOP, TRAIL_Z } from './kuranda-scene.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');
const G = STREET.ground;
// Star thresholds: groups fed, catches, and a full finish (about 11 groups of 5).
const STARS = [60, 95, 130];
POSTCARDS.kuranda = POSTCARDS.kuranda || 'Kuranda sits in the rainforest above Cairns.';

// ---- The ground: the village street, flat, between the stalls --------------------------
setGround({
  stand: () => ({ y: G, surface: 'land' }),
  move: (x, z, nx, nz) => ({ x: Math.max(-STREET.half - 0.6, Math.min(STREET.half + 0.6, nx)),
                             z: Math.max(STREET.z0 + 2, Math.min(game && game.ready ? STREET.z1 : TRAIL_Z - 0.8, nz)) }),
  foodAt: () => G,
  isWater: () => false,
  start: () => ({ x: 0, y: G, z: 0 }),
});

// ---- Stage --------------------------------------------------------------------------
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
useJarModel(models.get('jar'));
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light: touch || quality.name === 'low' });
const world = buildKuranda(scene, quality, realism);
const post = createPost(renderer, scene, camera, quality);
addEventListener('resize', () => post.setSize(innerWidth, innerHeight));
if (!scene.environment) {
  const env = new THREE.Scene();
  const sky = scene.children.find(o => o.isMesh && o.geometry.type === 'SphereGeometry');
  if (sky) env.add(sky.clone());
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.04).texture; scene.environmentIntensity = 0.8; pmrem.dispose();
}

let progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
// The Skyrail fare is paid on arrival, once (the ticket chain, progress.js).
progress = payEntry(progress, 'kuranda');
function save() { try { localStorage.setItem('chomp-progress', JSON.stringify(progress)); } catch { /* not saved */ } }
save();

const wally = new Wally(scene);
wally.facing = 0;
wally.useModel(models.get('wally'));
const food = new Food(scene); food.useModels(models);
const bubbles = new Bubbles(scene, touch ? 3 : 4);
const fx = new Effects(scene, food);

// Shopper groups in front of the stalls (not the clothes stall: that's the shop).
const clusters = new Clusters(scene, () => G, bubbles);
for (const [x, z, kind] of STALLS) {
  if (kind === 'clothes') continue;
  clusters.add({ x: Math.sign(x) * (STREET.half + 1.6), z: z + 3, size: 2 + (z % 3 === 0 ? 1 : 0), food: 5, rate: 0.6 });
}
clusters.add({ x: STREET.half + 1.6, z: TRAIL_Z - 14, size: 3, food: 7, rate: 0.5 });   // a last group by the trail, to top up

// Kenny, for the rescue, with his jar.
const kennyMesh = new THREE.Group(); scene.add(kennyMesh); kennyMesh.visible = false;
let kennyPoser = null, kennySkin = null;
{
  kennySkin = dress(kennyMesh, models.get('kenny'), { height: 1.3 });
  if (kennySkin && kennySkin.clips.size) kennyPoser = new HumanoidPoser(kennySkin.root);
}
const jar = kennysJar(jarLabelTexture()); jar.visible = false; scene.add(jar);

// Wear what they own (outfit.js).
function dressUp() {
  if (wally.skin) dressOutfit(wally.skin.root, 'wally', wearing(progress, 'wally'));
  if (kennySkin) dressOutfit(kennySkin.root, 'kenny', wearing(progress, 'kenny'));
}
dressUp();

// ---- Controls and state ---------------------------------------------------------------
const input = new Input(canvas, touch ? { stick: $('stick'), knob: $('knob'), jump: $('t-jump'), fours: $('t-fours'), pause: $('t-pause'), cam: $('t-cam') } : null);
input.onPause = () => setPaused(!game.paused);
input.onMute = () => toast_('Sound ' + (sound.toggleMute() ? 'off' : 'on'), 'info');
const game = {
  running: false, paused: false, done: false, time: 0,
  energy: ENERGY_MAX, lives: LIVES, stun: 0, boost: 0, faint: 0, hungry: 0, hintCool: 0, kennyUsed: false,
  points: 0, foodPoints: 0, caught: 0, streak: 0, scared: 0, mangoes: 0,
  groupsDone: 0, groupsTotal: clusters.list.length, ready: false, inShop: false, shopAway: true,
};
window.chomp = { game, wally, food, scene };

function toast_(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 1800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

// People throw toward where Wally will be.
function throwFrom(hand) {
  const flight = 1.2 + Math.random() * 0.5;
  const tx = Math.max(-STREET.half + 0.6, Math.min(STREET.half - 0.6, wally.pos.x + wally.vel.x * flight + (Math.random() - 0.5) * 2.4));
  const tz = wally.pos.z + wally.vel.z * flight + (Math.random() - 0.5) * 2.4;
  const ty = G + 2 + (Math.random() < 0.3 ? 1.2 : 0);
  return food.throw(randomKind(), hand, launchVelocity(hand, new THREE.Vector3(tx, ty, tz), flight));
}

// ---- The clothes stall ------------------------------------------------------------------
function drawShop() {
  $('shop-mangoes').textContent = progress.mangoes || 0;
  const owned = (progress.wardrobe && progress.wardrobe.owned) || [];
  for (const who of ['wally', 'kenny']) {
    const list = $(`shop-${who}`); list.innerHTML = '';
    const on = wearing(progress, who);
    const GROUP = { shirt: 'Shirts', shorts: 'Board shorts', vest: 'Vests', hat: 'Hats', glasses: 'Sunnies', face: 'Masks', wig: 'Wigs', held: 'Boomerangs' };
    let lastSlot = null;
    for (const item of WARDROBE.filter(i => i.who === who)) {
      if (item.slot !== lastSlot) { lastSlot = item.slot; const h = document.createElement('li'); h.className = 'grp'; h.textContent = GROUP[item.slot] || item.slot; list.append(h); }
      const li = document.createElement('li');
      const sw = document.createElement('span'); sw.className = 'sw';
      const hex = c => '#' + c.toString(16).padStart(6, '0');
      sw.style.background = item.needs ? '#555' : item.colour == null ? (who === 'wally' ? 'linear-gradient(135deg,#f06a2a,#ffd166)' : '#8a6a48')
        : item.style === 'stripes' ? `repeating-linear-gradient(0deg, ${hex(item.colour)} 0 4px, ${hex(item.colour2)} 4px 8px)`
        : item.style === 'disco' ? 'linear-gradient(135deg,#ff2fa8,#ffd23a,#39ff6a,#40c0ff,#d040ff)' : hex(item.colour);
      if (item.style === 'neon') sw.style.boxShadow = `0 0 8px ${hex(item.colour)}`;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = item.name;
      li.append(sw, nm);
      const wearingIt = Object.values(on).some(x => x && x.id === item.id);
      if (item.needs) { const s = document.createElement('span'); s.className = 'soon'; s.textContent = 'Coming soon'; li.append(s); }
      else if (wearingIt) { const s = document.createElement('span'); s.className = 'on'; s.textContent = 'Wearing'; li.append(s); }
      else if (owned.includes(item.id)) {
        const b = document.createElement('button'); b.className = 'wear'; b.type = 'button'; b.textContent = 'Wear';
        b.onclick = () => { progress = wearItem(progress, item.id); save(); dressUp(); drawShop(); sound.play.goal(); };
        li.append(b);
      } else {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = `🥭 ${item.price}`;
        b.disabled = (progress.mangoes || 0) < item.price;
        b.onclick = () => {
          const r = buyItem(progress, item.id);
          if (r.ok) { progress = wearItem(r.progress, item.id); save(); dressUp(); sound.play.powerup(); bubbles.say(wally.root, 'Ripper! How do I look?', 3); }
          drawShop();
        };
        li.append(b);
      }
      list.append(li);
    }
  }
  const t = $('shop-ticket'); t.innerHTML = '';
  const li = document.createElement('li');
  const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = 'River-boat ticket';
  li.append(nm);
  if (progress.boatTicket) { const s = document.createElement('span'); s.className = 'on'; s.textContent = 'Got it'; li.append(s); }
  else {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = `🥭 ${BOAT_TICKET_PRICE}`;
    b.disabled = (progress.mangoes || 0) < BOAT_TICKET_PRICE;
    b.onclick = () => { const r = buyBoatTicket(progress); if (r.ok) { progress = r.progress; save(); sound.play.powerup(); } drawShop(); };
    li.append(b);
  }
  t.append(li);
  $('shop-note').textContent = (progress.mangoes || 0) < 20 ? 'Short on mangoes? Collect Golden Mangoes on the Esplanade, then come back.' : '';
}
function openShop() { game.inShop = true; game.shopAway = false; drawShop(); $('shop').hidden = false; }
$('shop-close').onclick = () => { $('shop').hidden = true; game.inShop = false; };

// ---- One frame ----------------------------------------------------------------------
const cam = { yaw: 0, pitch: 0.35, dist: 11, manual: 0, recenter: false, side: 'behind', still: 0 };
window.chomp.cam = cam; window.chomp.camera = camera;
const bot = params.has('bot') ? makeBot() : null;

function step(dt, t) {
  const k = input.read();
  game.time += dt;
  if (bot) Object.assign(k, bot());
  if (k.turn !== 0 || k.turnKeys !== 0 || k.tilt !== 0) { cam.manual = 1.2; cam.recenter = false; }
  if (k.recenter) { cam.side = cam.side === 'behind' ? 'front' : 'behind'; cam.recenter = true; }
  cam.yaw += k.turn + k.turnKeys * dt * 2;
  cam.pitch = Math.min(1.35, Math.max(-0.15, cam.pitch + k.tilt));
  cam.dist = Math.min(22, Math.max(5, cam.dist + k.zoom));
  game.stun = Math.max(0, game.stun - dt); game.boost = Math.max(0, game.boost - dt); game.hungry -= dt; game.hintCool -= dt;

  const down = game.faint > 0;
  const pace = speedFactor(game.energy) * (game.stun > 0 ? 0.4 : 1) * (game.boost > 0 ? 1.3 : 1);
  const control = down || game.done ? { forward: 0, right: 0, jump: false, fours: false } : { ...k, fours: false };
  for (const e of wally.update(dt, control, cam.yaw, pace)) {
    if (e === 'jump') sound.play.jump(); else if (e === 'land') sound.play.land();
  }
  const moving = Math.hypot(wally.vel.x, wally.vel.z) > 0.5;
  if (!game.done && game.boost <= 0 && !down) game.energy -= energyDrain(wally.mode, moving, 'kuranda') * dt;

  // The clothes stall: walk up to it and it opens.
  const nearShop = Math.hypot(wally.pos.x - Math.sign(SHOP.x) * STREET.half, wally.pos.z - SHOP.z) < 3;
  if (!nearShop) game.shopAway = true;
  if (nearShop && game.shopAway && !game.done) { openShop(); return; }

  // Shoppers.
  if (!game.done) for (const e of clusters.update(dt, t, wally.pos, throwFrom)) {
    if (e.type === 'throw' && Math.random() < 0.35) bubbles.say(e.thrower.g, pickLine('touristThrow'), 2.3);
    if (e.type === 'flee') { game.scared++; toast_('Too close! They ran off with their snacks', 'bad'); }
    if ((e.type === 'flee' || e.type === 'empty') && !e.cluster.counted) { e.cluster.counted = true; game.groupsDone++; }
  }
  // Every group fed, then a full tank, then the trail opens (Ken's rule for every level).
  if (!game.ready && game.groupsDone >= game.groupsTotal) {
    if (game.energy >= FULL) {
      game.ready = true; sound.play.powerup(); world.bar.visible = false;
      toast_('Every group fed and a full tank! The Barron Falls trail is open', 'info');
    } else if (!food.items.length) { finish(false, 'hungry'); return; }
  }

  // Food.
  food.update(dt, t);
  const mouth = wally.mouthPosition();
  let closest = Infinity;
  for (const it of [...food.items]) {
    const p = it.mesh.position;
    const d = it.landed && !wally.airborne ? Math.hypot(p.x - mouth.x, p.z - mouth.z) + (mouth.y - p.y > 3.2 ? 99 : 0) : p.distanceTo(mouth);
    if (d < 1.4 * (game.boost > 0 ? 1.4 : 1)) {
      clusters.cheer(it.cluster);
      const how = it.landed ? 'ground' : (wally.airborne ? 'leap' : 'air');
      fx.burst(p, CRUMBS[it.kind] || [0xffffff]); food.take(it, 'eaten'); wally.chomp(how); sound.play.chomp(); fx.shake(0.1, 0.1);
      game.streak++; game.caught++;
      const pts = catchPoints(how, game.streak, game.boost > 0); game.foodPoints += pts; game.points += pts;
      game.energy = Math.min(ENERGY_MAX, game.energy + FOODS[it.kind].energy);
      toast_(`+${pts} ${how === 'leap' ? 'Jumping catch!' : how === 'air' ? 'In the air!' : it.name}`);
      if (chatty()) bubbles.say(wally.root, pickLine('wallyCatch'), 3.4);
    } else closest = Math.min(closest, d);
  }
  wally.jawWant = closest < 4.5 ? 0.75 : 0.12;

  // Kenny: once in the red, and every time Wally runs out of puff (he stays down until the jar comes).
  const kennyIn = (msg) => {
    kennyMesh.position.set(wally.pos.x + 1.4, G, wally.pos.z + 0.6); kennyMesh.rotation.y = -Math.PI / 2; kennyMesh.visible = true;
    jar.position.set(wally.pos.x + 0.6, G + 0.6, wally.pos.z + 0.3); jar.visible = true;
    bubbles.say(kennyMesh, msg, 2.4);
  };
  if (inRedZone(game.energy) && !game.kennyUsed && !game.done && !down) {
    game.kennyUsed = true; game.faint = 0.01; game.redVisit = 3.2; kennyIn("Here's me jar, Wally!");
  }
  if (game.energy <= 0 && !game.done && !down) {
    game.lives--; sound.play.lose();
    if (game.lives <= 0) { finish(false); return; }
    game.faint = 3.2; wally.setNapping(true); kennyIn("Hang on, Wally! Comin'!");
    toast_(`Out of puff! ${game.lives} left. Here comes Kenny`, 'bad');
  }
  if (game.redVisit > 0) {                                  // the red-zone visit: Kenny hands it over while Wally keeps going
    game.redVisit -= dt; game.faint = 0;
    if (Math.hypot(jar.position.x - wally.pos.x, jar.position.z - wally.pos.z) < 1.4) game.redVisit = 0.0001;
    if (game.redVisit <= 0.001) {
      jar.visible = kennyMesh.visible = false; game.redVisit = 0;
      game.energy = ENERGY_MAX; game.boost = 8; sound.play.powerup(); toast_("Kenny's jar! Full tank", 'good');
      bubbles.say(wally.root, pickLine('wallyToast'), 3.4);
    }
  } else if (game.faint > 0) {
    game.faint -= dt;
    if (game.faint <= 0) {
      jar.visible = kennyMesh.visible = false; wally.setNapping(false);
      game.energy = Math.max(game.energy, REVIVE_ENERGY); sound.play.powerup(); toast_("Kenny's jar! Back on your feet", 'good');
      bubbles.say(wally.root, pickLine('wallyToast'), 3.4);
    }
  }
  if (jar.visible) jar.rotation.y += dt * 3;
  if (kennyMesh.visible && kennyPoser && kennyPoser.ok) kennyPoser.pose({ time: t, cheer: 1, napping: false });

  if (game.energy < 25 && game.hungry <= 0) { bubbles.say(wally.root, pickLine('wallyHungry'), 3.4); game.hungry = 10; }

  // The trail: the way on, once the job is done.
  if (!game.done && game.ready && wally.pos.z >= TRAIL_Z + 2) {
    game.done = true; wally.cheer = 1.2; bubbles.say(wally.root, 'Barron Falls, here I come!', 3.4);
    setTimeout(() => finish(true), 2200);
  } else if (!game.ready && wally.pos.z > TRAIL_Z - 2 && game.hintCool <= 0) {
    game.hintCool = 6; toast_('Not yet! Feed out every group and fill up first', 'info');
  }
  drawHud();
}

// ---- Camera: on a leash behind him ---------------------------------------------------
const camTarget = new THREE.Vector3();
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
      if (dx * dx + dz * dz > 0.01) cam.yaw = Math.atan2(dx, dz);
    }
  }
  const cp = Math.cos(cam.pitch);
  camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
  if (camera.position.y < 0.8) camera.position.y = 0.8;
  camera.lookAt(camTarget);
  const jolt = fx.shakeOffset(dt); if (jolt) camera.position.add(jolt);
  world.ranges.position.x = camera.position.x; world.ranges.position.z = camera.position.z;
  world.sun.position.set(wally.pos.x - 60, 70, wally.pos.z - 40); world.sun.target.position.copy(wally.pos);
}

// ---- Screens ---------------------------------------------------------------------------
function drawHud() {
  $('score').textContent = game.points.toLocaleString();
  $('mangoes').textContent = progress.mangoes || 0;
  $('coins').textContent = progress.coins || 0;
  $('energy-fill').style.width = `${Math.max(0, game.energy)}%`;
  $('feed').classList.toggle('red', inRedZone(game.energy));
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  $('veg').hidden = game.boost <= 0;
  $('track-wally').style.left = `${Math.min(100, Math.max(0, wally.pos.z / TRAIL_Z * 100))}%`;
  $('job').textContent = game.ready ? 'Head for the Barron Falls trail!' : game.groupsDone >= game.groupsTotal ? 'Now fill the feed-o-meter' : `Groups fed out ${game.groupsDone}/${game.groupsTotal}`;
}

function start() {
  sound.start(); sound.startMusic('park');
  $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true; cam.yaw = Math.PI;
  bubbles.say(wally.root, "G'day, Kuranda! Smells like lunch!", 3.4, 3);
}

function setPaused(p) { if (!game.running) return; game.paused = p; $('paused').hidden = !p; }

function finish(won, why = '') {
  game.running = false;
  $('hud').hidden = true; $('touch').hidden = true;
  const finishBonus = won ? 20 + Math.round(Math.max(0, game.energy) / 10) : 0;
  const total = game.foodPoints + finishBonus;
  const stars = won ? starsFor(total, STARS) : 0;
  if (won) { sound.fanfare(); progress = completeArea(progress, 'kuranda', { score: total, stars }); }
  save();
  $('result-title').textContent = won ? 'Off to Barron Falls!' : why === 'hungry' ? 'Still peckish!' : 'Out of puff';
  $('result-why').textContent = why === 'hungry' ? `Every group's fed, but Wally needs a full tank (${FULL}%) for the trail.` : '';
  $('result-stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Tucker caught', `${game.caught} (${game.foodPoints})`], ['Finish bonus', finishBonus], ['Total', total]]) {
    const li = document.createElement('li'); li.innerHTML = '<span></span><b></b>'; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  $('postcard').hidden = !won;
  $('postcard-text').textContent = POSTCARDS.kuranda;
  $('result').hidden = false;
  window.chomp.result = { won, total, stars };
}

$('play').onclick = start;
$('resume').onclick = () => setPaused(false);
$('again').onclick = () => location.reload();
addEventListener('visibilitychange', () => { if (document.hidden && game.running) setPaused(true); });

// ---- Test pilot (?bot) ------------------------------------------------------------------
function makeBot() {
  return function steer() {
    const me = wally.pos;
    let goal = null;
    const coming = food.items.map(it => food.landing(it)).filter(Boolean).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
    if (coming && Math.hypot(coming.x - me.x, coming.z - me.z) < 14) goal = coming;
    if (!goal) {
      const live = clusters.list.filter(c => !c.counted && !c.fled && c.food > 0).sort((a, b) => Math.abs(a.root.position.z - me.z) - Math.abs(b.root.position.z - me.z))[0];
      if (live) goal = { x: -Math.sign(live.root.position.x) * 2.5, z: live.root.position.z };
      else if (game.ready) goal = { x: 0, z: TRAIL_Z + 6 };
      else if (jar.visible) goal = { x: jar.position.x, z: jar.position.z };
    }
    const none = { forward: 0, right: 0, jump: false, fours: false, turn: 0, turnKeys: 0, tilt: 0, zoom: 0 };
    if (!goal) return none;
    const dx = goal.x - me.x, dz = goal.z - me.z, len = Math.hypot(dx, dz);
    if (len < 0.6) return none;
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const k = Math.min(1, len / 1.5) / len;
    return { ...none, forward: (dx * fx + dz * fz) * k, right: (dx * rx + dz * rz) * k };
  };
}

// ---- Loop --------------------------------------------------------------------------------
let t = 0, last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  if (game.running && !game.paused && !game.inShop) step(dt, t);
  bubbles.update(dt); fx.update(dt, t);
  world.update(t);
  followCamera(dt);
  fpsWatch(dt);
  post.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play') || bot) start();
