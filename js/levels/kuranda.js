// kuranda.js
// Level 4: Kuranda, the village in the rainforest (Ken, 2026-10-17). Wally
// has come up on the Skyrail. The market shoppers along the street throw him
// snacks if he keeps to the sweet spot (the same rule as everywhere). Feed out
// every group, fill the feed-o-meter, and the trail to Barron Falls opens at
// the end of the street. The clothes stall sells new gear for Wally and Kenny
// for Golden Mangoes, and the river-boat ticket for the Daintree.

import { startRun, addPoints, bankRun, failRun } from '../points.js';
import { foundTalisman, givePrize } from '../revisit.js';
import { installGear, snorkelling, drainFactor } from '../gear.js';
import * as THREE from 'three';
import { Wally } from '../wally.js';
import { Food, randomKind, kindFor, useJarModel } from '../food.js';
import { Input, steering, easeBehind } from '../input.js';
import { Bubbles, pickLine, chatty } from '../bubbles.js';
import { Effects, CRUMBS } from '../fx.js';
import { loadModels, dress, MODEL_FILES } from '../models.js';
import { createPost } from '../post.js';
import { pickQuality, watchFrameRate, isTouchDevice, pixelRatioFor } from '../quality.js';
import { setGround } from '../ground.js';
import * as sound from '../sound.js';
import { areaIntro, courseShots, orbitShots } from '../area-intro.js';
import { installMap, recordVisit, markRetry } from '../mapmodal.js';
import { installShop, openShop } from '../shopmodal.js';
import { showLeaderboard } from '../leaderboard.js';
import { loadRealism } from '../realism.js';
import { FOODS, ENERGY_MAX, energyDrain, speedFactor, catchPoints, launchVelocity, LIVES, REVIVE_ENERGY, inRedZone, aimOffset } from '../rules.js';
import { FULL } from '../quests.js';
import { HumanoidPoser } from '../rig.js';
import { completeArea, readProgress, starsFor, POSTCARDS, bankFinds, payEntry, WARDROBE, buyItem, wearItem, wearing, buyBoatTicket, BOAT_TICKET_PRICE, outfitModel, PROGRESS_CHANGED } from '../progress.js';
import { Clusters } from '../clusters.js';
import { peopleModels } from '../tourists.js';
import { kennysJar } from '../food.js';
import { jarLabelTexture } from '../textures.js';
import { dressOutfit } from '../outfit.js';
import { installBook, bookEvent, bookFound, ability, HiddenFinds, openBook } from '../book.js';
import { startTrading, tradeStep } from '../trade.js';
import { startQuest, questStep } from '../sidequest.js';
import { DayNight } from '../daynight.js';
import { StreetLamps } from '../lamps.js';
import { buildKuranda, STREET, STALLS, SHOP, VENDOR, TRAIL_Z } from './kuranda-scene.js';
import { inClearing, enteredClearing, CLEARING, ENTRY } from './kuranda-rules.js';
import { boomerangThrow } from './boomerang-throw.js';
import * as Trip from '../trip-rules.js';
import { installVendor, openVendor } from '../vendormodal.js';
import { Pickups, goldPiece } from '../pickups.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');
const G = STREET.ground;
// Star thresholds: groups fed, catches, and a full finish (about 11 groups of 5).
const STARS = [60, 95, 130];
POSTCARDS.kuranda = POSTCARDS.kuranda || 'Kuranda sits in the rainforest above Cairns.';

// ---- The ground: the village street, flat, between the stalls, and the boomerang clearing --
const onFoot = (x, z) => Math.abs(x) <= STREET.half + 0.6 || inClearing(x, z, 0.4);   // the clearing overlaps the street edge: no gap to stick in
setGround({
  stand: () => ({ y: G, surface: 'land' }),
  move: (x, z, nx, nz) => {
    const zc = Math.max(STREET.z0 + 2, Math.min(game && game.ready && game.hasAir ? STREET.z1 : TRAIL_Z - 0.8, nz));
    if (onFoot(nx, zc)) return { x: nx, z: zc };
    if (onFoot(x, zc)) return { x, z: zc };                       // slide along the edge
    if (onFoot(nx, z)) return { x: nx, z };
    return { x: Math.max(-STREET.half - 0.6, Math.min(STREET.half + 0.6, nx)), z: zc };
  },
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

const models = await loadModels([...MODEL_FILES, 'talisman-air', 'guide-djabugay'], { light: touch || quality.name === 'low' });   // the boomerang guide, when Ken's model is made
useJarModel(models.get('jar'));
const realism = params.get('real') === '0' ? null : await loadRealism(renderer, { light: touch || quality.name === 'low' });
const world = buildKuranda(scene, quality, realism, models);   // Ken's shop model for the street
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
addEventListener(PROGRESS_CHANGED, () => { progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); });   // the book, trades and shops write it too
// The Skyrail fare is paid on arrival, once (the ticket chain, progress.js).
progress = payEntry(progress, 'kuranda');
function save() { try { localStorage.setItem('chomp-progress', JSON.stringify(progress)); } catch { /* not saved */ } }
save();

// The Wally model to use: his own, or the model of a complete outfit he is wearing.
function wallyModelName() {
  return outfitModel(readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()));
}
const wally = new Wally(scene);
// The first visit: back down the village street from the far end, to Wally at the start.
const intro = areaIntro({
  id: 'kuranda', name: 'Kuranda', place: 'The village in the rainforest', focus: on => fpsWatch.focus(on),
  shots: () => courseShots({ from: { x: 0, z: STREET.z1 }, to: { x: wally.pos.x, z: wally.pos.z - 10 }, y: STREET.ground, height: 36, side: 16 }),
});
wally.facing = 0;
wally.useModel(models.get(wallyModelName()) || models.get('wally'));   // a garment outfit has its own fitted Wally model
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
clusters.useModels(peopleModels(models));   // Ken's people

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
  groupsDone: 0, groupsTotal: clusters.list.length, ready: false, inShop: false, shopAway: true, vendorAway: true, gold: 0,
};
window.chomp = { game, wally, food, scene };

// ---- The trip: this run's gains (the air talisman here; the water at the zip line) ----------
if (!progress.trip) { progress.trip = Trip.tripFor(progress); save(); }
let attempt = Trip.startAttempt(progress.trip, 'kuranda', { force: true }); startRun('kuranda', { level: attempt.level });
game.hasAir = Trip.have(progress.trip, 'talisman-air');
game.stationAway = true;                                         // he has to step off the mark before it starts again

// The boomerang throw, halfway down the street (Ken, 2026-10-20): first person, angle
// and force, the physics decides; the first catch wins the air talisman.
const station = boomerangThrow({ scene, camera, wally, sound, models, people: peopleModels(models),
  onTalisman: () => { game.hasAir = true; attempt = Trip.gain(attempt, 'talisman-air'); game.points += 300; wally.cheer = 1.2; addPoints('catch'); addPoints('talisman'); },
  // Back at the archway, facing the street, ready to walk on (he has to step out before it starts again).
  onDone: caught => {
    $('hud').hidden = false;
    // The first catch: the air talisman. Back again with it sealed: a random useful prize for a catch (Ken).
    if (caught && game.airBefore) setTimeout(() => givePrize(toast_, 'A catch! The instructor gives you'), 400);
    else if (caught && game.hasAir) setTimeout(() => foundTalisman('talisman-air', toast_), 400);
    wally.pos.set(CLEARING.x0 + 0.5, G, ENTRY.z); wally.root.position.copy(wally.pos); wally.facing = Math.PI * 1.5; cam.yaw = Math.PI / 2;
  },
});
window.chomp.station = station;

// Gold pieces dropped along the street: a new spread each visit, two of them up
// on stall awnings so he has to jump for them.
const streetGold = new Pickups(scene, (() => {
  const spots = [];
  for (const s of [...STALLS].sort(() => Math.random() - 0.5).slice(0, 2)) spots.push({ x: Math.sign(s[0]) * (STREET.half + 1.3), y: 3.3, z: s[1] });   // the street edge of an awning: jump for it
  while (spots.length < 8) {
    const z = STREET.z0 + 10 + Math.random() * (STREET.z1 - STREET.z0 - 30), x = (Math.random() * 2 - 1) * (STREET.half - 0.8);
    if (spots.some(p => Math.abs(p.z - z) < 10)) continue;
    spots.push({ x, y: STREET.ground + 0.6, z });
  }
  return spots;
})(), goldPiece, { size: 1.2 });
installVendor({ pause: on => { if (game.running) game.paused = on; }, change: p => { progress = p; } });

// Day and night, and street lamps along the market street (Ken, 2026-10-18).
const daynight = new DayNight(scene, { sun: world.sun });
const lamps = new StreetLamps(scene, models.get('streetlamp'),
  Array.from({ length: Math.floor((STREET.z1 - 4 - (STREET.z0 + 4)) / 14) + 1 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (STREET.half - 0.4), y: STREET.ground, z: STREET.z0 + 4 + i * 14, rot: i % 2 ? -Math.PI / 2 : Math.PI / 2 })),
  { real: quality.name === 'high' ? 8 : quality.name === 'medium' ? 6 : 4 });
Object.assign(window.chomp, { daynight, lamps, streetGold, clusters });
// Hidden finds (Ken): behind the stalls, both sides of the street; three a visit.
const hiddenFinds = new HiddenFinds(scene, STALLS.map(s => ({ x: Math.sign(s[0]) * (STREET.half + 0.2), y: STREET.ground, z: s[1] + 2.6 })));   // tucked in the gaps between the stalls
window.chomp.hiddenFinds = hiddenFinds;
// Friendly traders (Ken): some shoppers offer a trade instead of running off.
clusters.enableTraders(0.25);
startTrading({ land: 'kuranda', run: () => ({}), setRun: () => {},
  feed: () => { game.energy = ENERGY_MAX; }, say: (c, text) => bubbles.say(c.people[0].g, text, 2.4), toast: text => toast_(text, 'good') });
// A sidequest (Ken): one group of shoppers has lost something about the markets.
startQuest({ land: 'kuranda', scene, clusters,
  spot(where) {
    const s = STALLS[Math.floor(Math.random() * STALLS.length)];
    if (where === 'behindStall') return { x: Math.sign(s[0]) * (STREET.half + 0.2), y: STREET.ground + 0.45, z: s[1] - 2.6 };   // in the gap beside a stall
    if (where === 'awning') return { x: Math.sign(s[0]) * (STREET.half + 1.3), y: 3.3, z: s[1] };                               // the street edge of the awning
    return { x: 1.5, y: STREET.ground + 0.45, z: TRAIL_Z - 5 };
  },
  feed: () => { game.energy = ENERGY_MAX; }, say: (c, text) => bubbles.say(c ? c.people[0].g : wally.root, text, c ? 2.4 : 3.4), toast: text => toast_(text, 'info') });

function toast_(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => el.remove(), 1800);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

// People throw toward where Wally will be.
function throwFrom(hand, cluster = null, gentle = false, thrower = null) {
  const flight = gentle ? 0.8 : 1.2 + Math.random() * 0.5;   // up close: a short handout
  // Aimed where he will be (Ken: toward Wally, all reachable), mostly close to him.
  const a = Math.random() * Math.PI * 2, r = aimOffset(Math.random, gentle ? 0.4 : 2);
  const tx = Math.max(-STREET.half + 0.6, Math.min(STREET.half - 0.6, wally.pos.x + wally.vel.x * flight * 0.85 + Math.cos(a) * r));
  const tz = wally.pos.z + wally.vel.z * flight * 0.85 + Math.sin(a) * r;
  const ty = G + 2 + (!gentle && Math.random() < 0.3 ? 1.2 : 0);
  return food.throw(kindFor(thrower), hand, launchVelocity(hand, new THREE.Vector3(tx, ty, tz), flight));
}

// ---- The stalls: walking up to the clothes stall opens the outfit catalogue (shopmodal.js) ----
window.chompDress = () => { progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); wally.changeModel(models.get(outfitModel(progress)) || models.get('wally')); dressUp(); };

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
  if (!game.done && game.boost <= 0 && !down) game.energy -= energyDrain(wally.mode, moving, 'kuranda') * drainFactor() * dt;   // vitamins (gear.js) halve it

  // The shell and mango trader: walk up to the stall and the trading opens.
  const nearVendor = Math.hypot(wally.pos.x - Math.sign(VENDOR.x) * STREET.half, wally.pos.z - VENDOR.z) < 3;
  if (!nearVendor) game.vendorAway = true;
  if (nearVendor && game.vendorAway && !game.done) { game.vendorAway = false; openVendor(); return; }

  // Gold pieces visitors have dropped along the street (Ken): banked as soon as he has them.
  for (const g of streetGold.update(dt, t, wally.pos)) {
    game.gold++; addPoints('pickup'); progress = { ...progress, coins: (progress.coins || 0) + 1 }; save(); bookEvent('gold');
    sound.play.goal(); fx.burst(g.mesh.position, [0xffd24a, 0xffffff], 10);
    toast_(`A gold piece someone dropped! ${streetGold.found}/${streetGold.total}`, 'good');
  }

  for (const f of hiddenFinds.update(dt, t, wally.pos)) { toast_(f.text, 'good'); sound.play.powerup(); }

  // The clothes stall: walk up to it and it opens.
  const nearShop = Math.hypot(wally.pos.x - Math.sign(SHOP.x) * STREET.half, wally.pos.z - SHOP.z) < 3;
  if (!nearShop) game.shopAway = true;
  if (nearShop && game.shopAway && !game.done) { game.shopAway = false; openShop(); return; }

  // Shoppers.
  const clusterEvents = game.done ? [] : clusters.update(dt, t, wally.pos, throwFrom);
  tradeStep(clusterEvents, wally.pos);
  questStep(dt, t, clusterEvents, wally.pos);
  for (const e of clusterEvents) {
    if (e.type === 'throw' && Math.random() < 0.35) bubbles.say(e.thrower.g, pickLine('touristThrow'), 2.3);
    if (e.type === 'flee') { game.scared++; toast_('Too close! They ran off with their snacks', 'bad'); }
    if ((e.type === 'flee' || e.type === 'empty') && !e.cluster.counted) { e.cluster.counted = true; game.groupsDone++; }
  }
  // The boomerang clearing (Ken): walking in under the archway starts the throw, in first person.
  if (enteredClearing(wally.pos.x, wally.pos.z)) { if (game.stationAway && !game.done) { game.stationAway = false; $('hud').hidden = true; game.airBefore = game.hasAir; station.begin(game.hasAir); return; } }
  else if (!inClearing(wally.pos.x, wally.pos.z)) game.stationAway = true;

  // Every group fed, then a full tank, then the trail opens (Ken's rule for every level).
  if (!game.ready && game.groupsDone >= game.groupsTotal) {
    if (game.energy >= FULL) {
      game.ready = true; sound.play.powerup();
      toast_(game.hasAir ? 'Every group fed and a full tank! The Barron Falls trail is open' : 'Every group fed and a full tank! Now see the boomerang guide in the clearing', 'info');
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
      if (daynight.night > 0.6) bookEvent('nightCatch');
      const pts = catchPoints(how, game.streak, game.boost > 0); game.foodPoints += pts; game.points += pts; addPoints(how);
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
  world.bar.visible = !(game.ready && game.hasAir);               // the trail opens with the job done and the air talisman won
  if (!game.done && game.ready && game.hasAir && wally.pos.z >= TRAIL_Z + 2) {
    game.done = true; wally.cheer = 1.2; bubbles.say(wally.root, 'Barron Falls, here I come!', 3.4);
    setTimeout(() => finish(true), 2200);
  } else if (!(game.ready && game.hasAir) && wally.pos.z > TRAIL_Z - 2 && game.hintCool <= 0) {
    game.hintCool = 6; toast_(!game.ready ? 'Not yet! Feed out every group and fill up first' : 'Not yet! The boomerang guide in the clearing halfway down has something for you', 'info');
  }
  drawHud();
}

// ---- Camera: on a leash behind him ---------------------------------------------------
const camTarget = new THREE.Vector3();
function followCamera(dt) {
  if (window.chomp.camHold) { window.chomp.camHold(camera); return; }   // testing: a fixed camera
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
      else if (dx * dx + dz * dz > 0.01) cam.yaw = Math.atan2(dx, dz);
    }
  }
  const cp = Math.cos(cam.pitch);
  camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
  if (camera.position.y < 0.8) camera.position.y = 0.8;
  camera.lookAt(camTarget);
  const jolt = fx.shakeOffset(dt); if (jolt) camera.position.add(jolt);
  world.ranges.userData.follow(camera);                    // parallax: the near hills slide past the far ones
  world.sun.position.set(wally.pos.x - 60, 70, wally.pos.z - 40); world.sun.target.position.copy(wally.pos);
}

// ---- Screens ---------------------------------------------------------------------------
function drawHud() {
  $('score').textContent = game.points.toLocaleString();
  $('mangoes').textContent = progress.mangoes || 0;
  $('coins').textContent = progress.coins || 0;
  $('shells').textContent = progress.shells || 0;
  $('energy-fill').style.width = `${Math.max(0, game.energy)}%`;
  $('feed').classList.toggle('red', inRedZone(game.energy));
  $('lives').textContent = '●'.repeat(Math.max(0, game.lives)) + '○'.repeat(Math.max(0, LIVES - game.lives));
  $('veg').hidden = game.boost <= 0;
  $('track-wally').style.left = `${Math.min(100, Math.max(0, wally.pos.z / TRAIL_Z * 100))}%`;
  $('job').textContent = game.ready ? (game.hasAir ? 'Head for the Barron Falls trail!' : 'Learn the boomerang in the clearing halfway down') : game.groupsDone >= game.groupsTotal ? 'Now fill the feed-o-meter' : `Groups fed out ${game.groupsDone}/${game.groupsTotal}`;
}

function start() {
  recordVisit('kuranda');
  // The first time here: the fly-over first, with the frame-rate check running
  // (quality.js) so the detail is right before he moves. Then play begins.
  if (intro.due()) { $('title').hidden = true; sound.start(); intro.play(camera, begin); return; }
  begin();
}
function begin() {
  sound.start(); sound.startMusic('park');
  $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = !touch;
  game.running = true; cam.yaw = Math.PI;
  bubbles.say(wally.root, "G'day, Kuranda! Smells like lunch!", 3.4, 3);
}

function setPaused(p) { if (!game.running) return; game.paused = p; $('paused').hidden = !p; }

function finish(won, why = '') {
  game.running = false;
  $('hud').hidden = true; $('touch').hidden = true;
  const toZip = won && game.hasAir && !params.has('stay');        // the end of Kuranda: straight down Barron Falls on the zip line
  const finishBonus = won ? 20 + Math.round(Math.max(0, game.energy) / 10) : 0;
  const total = game.foodPoints + finishBonus;
  const stars = won ? starsFor(total, STARS) : 0;
  if (won) { bookEvent('finish'); sound.fanfare(); progress = completeArea(progress, 'kuranda', { score: total, stars }); }
  // The trip: Kuranda is done when both its talismans are won. The water talisman is at
  // the zip line, so a run with the air talisman is kept for it to finish.
  if (!progress.trip) progress.trip = Trip.tripFor(progress);
  if (won) {
    const done = Trip.completeAttempt(progress.trip, attempt, { objectiveMet: true });
    if (done.ok) { progress.trip = done.trip; bankRun({ stars }); }
    else try { addPoints('star', stars);   // not done until the zip line: its stars go with the run (points.js)
      localStorage.setItem('chomp-kuranda-run', JSON.stringify(attempt)); } catch { /* the zip line starts a fresh run */ }
  } else { progress.trip = Trip.failAttempt(progress.trip, attempt).trip; failRun(); }   // nothing from this run is kept, points included (points.js)   // nothing from this run is kept
  save();
  $('result-title').textContent = won ? 'Off to Barron Falls!' : why === 'hungry' ? 'Still peckish!' : 'Out of puff';
  $('result-why').textContent = why === 'hungry' ? `Every group's fed, but Wally needs a full tank (${FULL}%) for the trail.` : '';
  markRetry(won, 'Kuranda');
  $('result-stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('result-lines').innerHTML = '';
  for (const [label, v] of [['Tucker caught', `${game.caught} (${game.foodPoints})`], ['Gold pieces found', game.gold], ['Finish bonus', finishBonus], ['Total', total]]) {
    const li = document.createElement('li'); li.innerHTML = '<span></span><b></b>'; li.firstChild.textContent = label; li.lastChild.textContent = v; $('result-lines').appendChild(li);
  }
  $('postcard').hidden = !won;
  $('postcard-text').textContent = POSTCARDS.kuranda;
  $('result').hidden = false;
  showLeaderboard($('board'), 'kuranda', won ? total : 0, won ? stars : 0);   // finished runs go on the board; the top ten either way
  window.chomp.result = { won, total, stars };
  if (toZip) { $('result').hidden = true; const c = document.createElement('div'); c.className = 'cine-caption'; c.textContent = 'Down Barron Falls on the zip line'; document.body.append(c); setTimeout(() => { location.href = 'zipline.html?story'; }, 2000); }
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
  if (game.running && !game.paused && !station.active) step(dt, t);
  bubbles.update(dt); fx.update(dt, t);
  world.update(t);
  if (!game.paused) station.update(dt);                           // the clearing's visitors, and the throw when it is on
  if (!station.active) followCamera(dt);                           // while it is on, the throw has the camera
  else wally.update(dt, { forward: 0, right: 0, jump: false, fours: false }, cam.yaw, 1);   // standing easy at the mark, not frozen mid-stride
  intro.update(dt, camera);                       // the first-visit fly-over, when it plays
  { const night = daynight.update(game.paused ? 0 : dt, camera); lamps.update(dt, night, wally.pos); world.night(night); }
  fpsWatch(dt);
  post.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('play') || bot) start();

// The map, from anywhere (mapmodal.js): the Map button or Tab. Play pauses while it is open.
installMap({ pause: on => { if (game.running) game.paused = on; } });
installShop({ pause: on => { if (game.running) game.paused = on; } });
installBook({ here: 'kuranda', pause: on => { if (game.running) game.paused = on; } });
installGear({ scene, wally, food, mouth: () => wally.mouthPosition(), hasAir: false, toast: (t, k) => toast_(t, k), openBook: () => openBook('wally'), running: () => game.running && !game.paused, pause: on => { if (game.running) game.paused = on; } });
window.chompStartHere = () => { if (!game.running) start(); };
