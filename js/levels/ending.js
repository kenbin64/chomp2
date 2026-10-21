// ending.js
// The ending (MASTER.md section 6, the third version's ending as recorded, after Ken's fourth
// version of the finale; Ken, 2026-10-21: it ends with Kenny). A cinematic on the Daintree River:
//   1. The boat is free: the passengers cheer, the crocs round it.
//   2. The King on the riverbank: the truth of the sceptre, and Wally's choice; he chooses to be a
//      croc of the Daintree again, and the sceptre changes him back.
//   3. Kenny's secret: the King sent him, from the very first day.
//   4. The celebration on the bank.
//   5. The farewell: Wally carries Kenny across the river to the gum trees; Kenny holds out the
//      Vegemite one last time and Wally nudges it back; Kenny climbs his gum tree, Wally slides into
//      the river. Croc eyes surface below, and Kenny has the last line.
//   6. The credits.
// Skippable (Space, Enter, Escape, the Skip button) straight to the credits.

import * as THREE from 'three';
import { HALF, AGROUND_Z, riverX, boatX, groundAt, crocsRoundBoat } from './daintree-rules.js';
import { buildDaintree } from './daintree-scene.js';
import { loadModels, ModelSkin, MODEL_FILES } from '../models.js';
import { kennysJar } from '../food.js';
import { jarLabelTexture } from '../textures.js';
import { Trees } from '../trees.js';
import { peopleModels } from '../tourists.js';
import { pickQuality, isTouchDevice, pixelRatioFor } from '../quality.js';
import { readProgress, outfitModel, wearing } from '../progress.js';
import { dressOutfit } from '../outfit.js';
import { loadRealism } from '../realism.js';
import * as sound from '../sound.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
const quality = pickQuality();

// ---- Stage --------------------------------------------------------------------------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatioFor(quality)); renderer.shadowMap.enabled = quality.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1400);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 66 : 50; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const models = await loadModels([...MODEL_FILES, 'river-boat', 'king-croc', 'king-throne'], { light: touch || quality.name === 'low' });
const realism = await loadRealism(renderer, { light: touch || quality.name === 'low' });
// The ending's two places on the banks are kept open (no mangroves or forest there): the King's
// spot on the near bank, Kenny's gum trees on the far bank.
const Z_ = AGROUND_Z - 22;
const openBank = (x, z) => (x < riverX(z) && Math.abs(z - (Z_ + 2)) < 24 && x > riverX(z) - 26 - 26) || (x > riverX(z) && Math.abs(z - (Z_ + 34)) < 22 && x < riverX(z) + 26 + 22);
const world = buildDaintree(scene, quality, realism, openBank);

// ---- The places: where the boat floats, the near bank (the King, the celebration), the far bank
//      (the gum trees, Kenny's home: koalas live in eucalyptus woodland, not the rainforest) --------
const Z = AGROUND_Z - 22;                                    // where the boat floats, free
const nearX = riverX(Z) - HALF - 3, farX = riverX(Z + 30) + HALF + 4;
const yAt = (x, z) => Math.max(groundAt(x, z).y, -0.45);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function holder(skin, x, y, z, ry = 0) { const g = new THREE.Group(); g.add(skin.root); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); return g; }
const skinOf = (name, fit) => { const g = models.get(name); if (!g) return null; const s = new ModelSkin(g, fit); s.root.traverse(o => { if (o.isMesh) o.castShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false; }); return s; };

// The boat and its passengers.
const boat = new THREE.Group(); scene.add(boat);
{ const g = models.get('river-boat'); if (g) { const m = g.scene.clone(true), b = new THREE.Box3().setFromObject(m); m.scale.setScalar(10 / b.getSize(new THREE.Vector3()).x); const b2 = new THREE.Box3().setFromObject(m); m.position.y = -0.45 - b2.min.y; m.rotation.y = Math.PI / 2; boat.add(m); } }
boat.position.set(boatX(Z), 0, Z); boat.rotation.y = 0.5;
const cast = peopleModels(models);
const passengers = cast.slice(0, 8).map((gltf, i) => {
  const tall = gltf.userData.tall, h = Array.isArray(tall) ? (tall[0] + tall[1]) / 2 : 1.72;
  const s = new ModelSkin(gltf, { height: h }), side = i % 2 ? 1 : -1;
  const g = new THREE.Group(); g.add(s.root); boat.add(g); g.position.set(side * 1.05, 0.55, -3.6 + Math.floor(i / 2) * 2.4); g.rotation.y = side * Math.PI / 2;
  return { g, s };
});
// The crowd on the near bank for the celebration (the cast of the trip), hidden until then.
const crowd = cast.slice(8, 20).map((gltf, i) => {
  const tall = gltf.userData.tall, h = Array.isArray(tall) ? (tall[0] + tall[1]) / 2 : 1.72;
  const s = new ModelSkin(gltf, { height: h }), z = Z - 10 + i * 1.8, x = nearX - 2 - (i % 3) * 1.6;
  const g = holder(s, x, yAt(x, z), z, Math.PI / 2); g.visible = false; return { g, s };
});
// The crocs: the park's and the wild ones, round the boat in the water.
const crocs = [...crocsRoundBoat(5), ...Array.from({ length: 10 }, (_, i) => ({ x: boatX(Z) + Math.cos(i * 0.63) * 12, z: Z + Math.sin(i * 0.63) * 12 }))].map(p => {
  const s = skinOf('croc-regular', { length: 3.4 }); if (!s) return null;
  const g = holder(s, p.x, -0.25, p.z, Math.atan2(boatX(Z) - p.x, Z - p.z)); s.play('swim', { alternatives: ['idle'] }); return { g, s };
}).filter(Boolean);
// The King on his throne at the river's edge.
const kingZ = Z + 2, kingX = nearX - 1.5;
const throne = (() => { const g = models.get('king-throne'); if (!g) return null; const m = g.scene.clone(true), b = new THREE.Box3().setFromObject(m); m.scale.setScalar(4.2 / b.getSize(new THREE.Vector3()).y); const b2 = new THREE.Box3().setFromObject(m); m.position.y = -b2.min.y; const h = new THREE.Group(); h.add(m); h.position.set(kingX, yAt(kingX, kingZ), kingZ); h.rotation.y = Math.PI / 2; scene.add(h); return h; })();
const kingSkin = skinOf('king-croc', { height: 3.6 });
const king = kingSkin ? holder(kingSkin, kingX + 0.35, yAt(kingX, kingZ) + 0.6, kingZ, Math.PI / 2) : null;
if (kingSkin) kingSkin.play('Sit');
// The sceptre, glowing.
const sceptre = (() => { const g = new THREE.Group(), gl = models.get('sceptre'); if (gl) { const m = gl.scene.clone(true), b = new THREE.Box3().setFromObject(m); m.scale.setScalar(1.6 / b.getSize(new THREE.Vector3()).y); m.position.sub(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3())); g.add(m); } const l = new THREE.PointLight(0xffe2a0, 4, 14); g.add(l); g.userData.light = l; scene.add(g); return g; })();
// Wally (part human), and the croc he becomes.
const progress = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
const wallySkin = skinOf(outfitModel(progress), { height: 2.7 }) || skinOf('wally', { height: 2.7 });
if (wallySkin) dressOutfit(wallySkin.root, 'wally', wearing(progress, 'wally'));
const wallyX = nearX + 0.5, wallyZ = Z - 4.5;                // beside the throne, not in front of it
const wally = wallySkin ? holder(wallySkin, wallyX, yAt(wallyX, wallyZ), wallyZ, Math.atan2(kingX - wallyX, kingZ - wallyZ)) : new THREE.Group();
const croc = (() => { const s = skinOf('croc-regular', { length: 3.6 }); if (!s) return null; const g = holder(s, wallyX, yAt(wallyX, wallyZ), wallyZ, Math.atan2(kingX - wallyX, kingZ - wallyZ)); g.visible = false; s.play('idle'); return { g, s }; })();
// Kenny.
const kennySkin = skinOf('kenny', { height: 1.3 });
const kenny = kennySkin ? holder(kennySkin, wallyX + 1.2, yAt(wallyX + 1.2, wallyZ - 1.4), wallyZ - 1.4, Math.atan2(kingX - wallyX, kingZ - wallyZ)) : new THREE.Group();
const jar = kennysJar(jarLabelTexture()); jar.visible = false; scene.add(jar);
// The gum trees on the far bank, one close by for Kenny.
const gumX = farX + 6, gumZ = Z + 34;
const gums = new Trees(scene, { light: quality.name === 'low' });
for (let k = 0; k < 14; k++) { const z = gumZ - 26 + k * 4 + Math.sin(k) * 2, x = farX + 9 + (k % 3) * 4; gums.add('eucalyptus', x, yAt(x, z), z, 18 + (k % 4) * 3); }
gums.build();
const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 9, 10), new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.8 }));   // Kenny's tree: a pale gum trunk to climb
trunk.position.set(gumX, yAt(gumX, gumZ) + 4.5, gumZ); trunk.castShadow = true; scene.add(trunk);
{ const crown = new Trees(scene, { light: quality.name === 'low' }); crown.add('eucalyptus', gumX + 0.3, yAt(gumX, gumZ), gumZ, 15); crown.build(); }   // its crown, a gum like the rest

// ---- The script: [start second, who, words, shot] ----------------------------------------------------
const K = 'The Croc King';
const LINES = [
  [0, null, '', 'boat'],
  [4, 'A passenger', 'We are free! Three cheers for Wally and the crocs!', 'boat'],
  [9, null, '', 'king'],
  [11, K, 'You kept your word, young croc. The boat is safe, and the crocs of Croc Park are free in the Daintree.', 'king'],
  [18, K, 'Now the last of it. The sceptre made you part human. Because of your selfless act, you may choose: stay as you are, or be a croc again, a true croc of the Daintree.', 'king'],
  [27, 'Wally', 'Your Majesty... I reckon I am a croc. A Daintree croc.', 'wally'],
  [32, K, 'So be it.', 'raise'],
  [34, null, '', 'change'],
  [40, K, 'And Kenny, my old friend. Thank you.', 'king'],
  [44, 'Wally', '?', 'kenny'],
  [46, 'Kenny', 'The King sent me to look after you, mate. From the very first day.', 'kenny'],
  [52, null, '', 'party'],
  [60, null, '', 'carry'],
  [71, null, '', 'jar'],
  [78, null, '', 'climb'],
  [86, null, '', 'eyes'],
  [90, 'Kenny', 'If you see a croc in the Daintree, give it room. It might be Wally.', 'eyes'],
  [99, null, '', 'end'],
];
const END_T = 100;
let t = 0, playing = false, line = -1;
function caption(who, text) { const c = $('scene-caption'); c.hidden = !text; if (!text) return; c.querySelector('b').textContent = who ? `${who}:` : ''; c.querySelector('span').textContent = text; }
function lineAt(time) { let i = 0; while (i < LINES.length - 1 && time >= LINES[i + 1][0]) i++; return i; }
const ease = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };

function stage(dt, time) {
  const i = lineAt(time), [start, who, words, shot] = LINES[i], into = time - start;
  if (i !== line) { line = i; caption(who, words); if (shot === 'change') sound.play.powerup(); if (shot === 'party') sound.fanfare && sound.fanfare(); }
  const look = V(0, 0, 0), pos = V(0, 0, 0);
  const wp = wally.position, kp = kenny.position;
  // Who does what in each shot.
  for (const p of passengers) p.s.play(time < 52 ? 'cheer' : 'wave', { alternatives: ['idle'] });
  if (kingSkin) kingSkin.play(shot === 'raise' || shot === 'change' ? 'Raise' : who === K ? 'Speak' : 'Sit', { once: shot === 'raise', alternatives: ['Sit'] });
  // The sceptre: in the King's raised hand, blazing at the change.
  sceptre.position.set(kingX + 0.4, yAt(kingX, kingZ) + (shot === 'raise' || shot === 'change' ? 5.6 : 3.4), kingZ - 0.9);
  sceptre.userData.light.intensity = shot === 'change' ? 40 + Math.sin(into * 20) * 20 : 5;
  // The change: a flash, and Wally is a croc again.
  if (shot === 'change' && into > 2.6 && wally.visible) { wally.visible = false; if (croc) croc.g.visible = true; sceptre.userData.light.intensity = 120; }
  if (shot === 'change') { const s = 1 + Math.sin(Math.min(1, into / 2.6) * Math.PI) * 0.15; wally.scale.setScalar(s); }
  if (wallySkin) wallySkin.play(shot === 'wally' ? 'Idle' : 'Idle');
  if (kennySkin) kennySkin.play(shot === 'kenny' ? 'Wave' : shot === 'party' ? 'Celebrate' : shot === 'jar' ? 'Offer' : shot === 'climb' ? 'Walk' : 'Idle', { alternatives: ['Idle'] });
  for (const c of crowd) { c.g.visible = shot === 'party'; c.s.play('cheer', { alternatives: ['idle'] }); }
  // The farewell: across the river, Kenny on Wally's back.
  if (croc) {
    const cg = croc.g;
    if (shot === 'carry' || shot === 'jar' || shot === 'climb' || shot === 'eyes' || shot === 'end') {
      const u = shot === 'carry' ? ease(into / 10) : 1;
      const x0 = wallyX, z0 = wallyZ, x1 = farX - 1.5, z1 = gumZ - 1;
      cg.position.set(x0 + (x1 - x0) * u, shot === 'carry' && u < 0.95 ? -0.2 : yAt(x1, z1), z0 + (z1 - z0) * u);
      cg.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      croc.s.play(shot === 'carry' && u < 0.95 ? 'swim' : 'idle', { alternatives: ['idle'] });
      if (shot === 'carry') kenny.position.set(cg.position.x, cg.position.y + 0.55, cg.position.z);   // riding on his back
      if (shot === 'jar') { kenny.position.set(x1 + 1.4, yAt(x1 + 1.4, z1 + 1), z1 + 1); kenny.rotation.y = Math.atan2(cg.position.x - kenny.position.x, cg.position.z - kenny.position.z); jar.visible = true; jar.position.set(kenny.position.x - 0.35, kenny.position.y + 0.8 - (into > 4 ? (into - 4) * 0.3 : 0), kenny.position.z - 0.2); }
      if (shot === 'jar' && into > 4) { croc.s.play('walk', { alternatives: ['idle'] }); }                     // he nudges it back to Kenny
      if (shot === 'climb' || shot === 'eyes' || shot === 'end') {
        jar.visible = false;
        const cu = shot === 'climb' ? ease(into / 7) : 1;
        kenny.position.set(gumX - 0.55, yAt(gumX, gumZ) + 0.1 + cu * 5.5, gumZ); kenny.rotation.y = -Math.PI / 2;   // on the river side of the trunk, facing the water
        // Wally slides back into the river; then only his eyes show.
        const su = shot === 'climb' ? ease((into - 3) / 4) : 1;
        cg.position.set(x1 - 3 - su * 7, -0.2 - su * 0.12, z1 + 1 - su * 0.5); cg.rotation.y = Math.PI / 2;   // back in the water below Kenny's tree, eyes and snout showing, looking up at him
      }
    }
  }
  // The shots.
  switch (shot) {
    case 'boat': pos.set(boatX(Z) - 20 + into, 7, Z - 16); look.set(boatX(Z), 1.5, Z); break;
    case 'king': pos.set(kingX + 7, yAt(kingX, kingZ) + 3.2, kingZ - 5); look.set(kingX, yAt(kingX, kingZ) + 2.6, kingZ); break;
    case 'wally': { const r = wally.rotation.y; pos.set(wp.x + Math.sin(r) * 4.2 + 1.2, wp.y + 2.3, wp.z + Math.cos(r) * 4.2); look.set(wp.x, wp.y + 2, wp.z); break; }   // in front of him, his face
    case 'raise': case 'change': pos.set(wallyX + 8, yAt(wallyX, wallyZ) + 4, wallyZ - 8); look.set((wallyX + kingX) / 2, yAt(kingX, kingZ) + 2.8, kingZ); break;
    case 'kenny': kenny.rotation.y = Math.atan2(camera.position.x - kp.x, camera.position.z - kp.z); pos.set(kp.x + 2.8, kp.y + 1.3, kp.z + 1.2); look.set(kp.x, kp.y + 0.8, kp.z); break;   // turned to us for his secret
    case 'party': pos.set(nearX + 16 - into * 0.6, 6, Z - 12 + into * 1.2); look.set(nearX - 2, 1.5, Z); break;
    case 'carry': { const c = croc ? croc.g.position : wp; pos.set(c.x - 6, 3.5, c.z - 9); look.set(c.x, 0.5, c.z); break; }
    case 'jar': pos.set(kp.x + 3.5, kp.y + 1.3, kp.z - 2.5); look.set(kp.x, kp.y + 0.7, kp.z - 0.3); break;
    case 'climb': pos.set(gumX - 9, yAt(gumX, gumZ) + 2.5 + into * 0.3, gumZ + 1); look.set(gumX, yAt(gumX, gumZ) + 2 + into * 0.6, gumZ); break;
    case 'eyes': case 'end': pos.set(farX - 20, 1.4, gumZ + 0.5); look.set(gumX - 2, 3.2, gumZ); break;   // low over the water: the eyes in front, Kenny in his gum tree behind
  }
  camera.position.lerp(pos, line === i && into < 0.05 ? 1 : Math.min(1, dt * 2.5)); camera.lookAt(look);
  $('fade').classList.toggle('on', shot === 'end' || (shot === 'change' && into > 2.3 && into < 2.9));
  for (const s of [kingSkin, wallySkin, kennySkin, croc && croc.s, ...passengers.map(p => p.s), ...crowd.map(c => c.s), ...crocs.map(c => c.s)]) if (s) s.update(dt);
}

// ---- The credits ----------------------------------------------------------------------------------
function credits() {
  playing = false; caption('', ''); $('skip').hidden = true; $('fade').classList.add('on');
  try { localStorage.setItem('chomp-finished', '1'); } catch { /* fine */ }
  setTimeout(() => { $('credits').hidden = false; }, 900);
}
function start() { sound.start(); sound.startMusic('theme'); $('title').hidden = true; $('skip').hidden = false; playing = true; t = 0; }
$('play').onclick = start;
$('skip').onclick = e => { e.stopPropagation(); credits(); };
addEventListener('keydown', e => { if (playing && ['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); credits(); } });

// ---- Loop -----------------------------------------------------------------------------------------
let last = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing) { t += dt; if (t >= END_T) credits(); }
  stage(dt, playing ? t : 0);
  world.update(now / 1000, camera); gums.update(now / 1000);
  boat.position.y = Math.sin(now / 700) * 0.06;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.chomp = { get t() { return t; }, set t(v) { t = v; line = -1; }, start, credits, camera };
if (params.has('play')) start();
