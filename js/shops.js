// shops.js
// The shops on the visitors' path, drawn from code (Ken, 2026-10-30: his Meshy stand and souvenir shop are the
// reference; "I would rather not have duplicated shops"). All share one way of being built, weathered boards,
// a tin roof, a hand-painted sign, a serving counter, and each is its own place with its own colours, roof and
// goods. The food stands show the game's own food on the counter, so the thrown food has a source.
// A shop faces +z, stands on y = 0 and fits rules.js STAND.

import * as THREE from 'three';
import { person } from './tourists.js';

const W = 3.0, D = 2.3, H = 2.45, COUNTER = 1.05;      // width, depth, height to the eaves, counter height

function tex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
// Materials with the same settings are one material, so the shops merge into few draws (world.js mergeByMaterial).
const MATS = new Map();
function mat(opts) {
  const key = JSON.stringify(opts, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshStandardMaterial({ roughness: 0.85, ...opts }));
  return MATS.get(key);
}
function add(parent, geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function box(parent, w, h, d, material, x, y, z) { return add(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z); }
function cyl(parent, r0, r1, h, material, x, y, z, seg = 10) { return add(parent, new THREE.CylinderGeometry(r0, r1, h, seg), material, x, y, z); }

// ---- Painted surfaces ----------------------------------------------------------

// Upright boards: paint worn back to the timber, dark gaps, grain and nail heads.
function boards(base, wood = '#6b5238', wear = 0.35) {
  return tex(512, 512, (g, w, h) => {
    const n = 8, bw = w / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = base; g.fillRect(i * bw, 0, bw, h);
      g.fillStyle = `rgba(0,0,0,${rnd(0, 0.16)})`; g.fillRect(i * bw, 0, bw, h);
      for (let k = 0; k < 26; k++) {               // grain, and paint worn through to the timber
        const x = i * bw + rnd(3, bw - 3), y = rnd(0, h), len = rnd(30, 170);
        g.strokeStyle = Math.random() < wear ? wood : `rgba(30,20,10,${rnd(0.1, 0.35)})`; g.lineWidth = rnd(0.6, 3);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-3, 3), y + len); g.stroke();
      }
      g.fillStyle = '#17110b'; g.fillRect(i * bw, 0, 3, h);   // the gap between boards
      for (const y of [28, h - 28]) { g.fillStyle = '#2b2b2b'; g.beginPath(); g.arc(i * bw + bw / 2, y, 3.2, 0, 7); g.fill(); }
    }
  });
}
// Corrugated iron, running front to back.
function iron(base, rust) {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { const x = i * w / 16; const s = g.createLinearGradient(x, 0, x + w / 16, 0); s.addColorStop(0, 'rgba(0,0,0,0.45)'); s.addColorStop(0.5, 'rgba(255,255,255,0.22)'); s.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = s; g.fillRect(x, 0, w / 16, h); }
    for (let i = 0; i < 50; i++) { g.fillStyle = rust + rnd(0.15, 0.55) + ')'; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(3, 24), rnd(3, 34), 0, 0, 7); g.fill(); }
  });
}
function stripes(a, b) {
  return tex(256, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * w / 8, 0, w / 8, h); } g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 40; i++) g.fillRect(rnd(0, w), rnd(0, h), rnd(4, 30), 1); });
}
// A croc in silhouette, for signs and counters.
function croc(g, x, y, s, flip = 1) {
  g.save(); g.translate(x, y); g.scale(s * flip, s);
  g.beginPath(); g.moveTo(-50, 2);
  g.quadraticCurveTo(-30, -8, -18, -8); g.lineTo(6, -11); g.quadraticCurveTo(22, -12, 30, -7); g.lineTo(52, -5); g.lineTo(54, 0); g.lineTo(30, 3);
  g.lineTo(22, 7); g.lineTo(26, 13); g.lineTo(18, 13); g.lineTo(13, 7); g.lineTo(-8, 7); g.lineTo(-10, 13); g.lineTo(-18, 13); g.lineTo(-18, 5); g.quadraticCurveTo(-34, 6, -50, 2);
  g.closePath(); g.fill();
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-26 + i * 8, -8); g.lineTo(-22 + i * 8, -14); g.lineTo(-18 + i * 8, -9); g.fill(); }
  g.restore();
}
// The board over the shop: weathered timber, big painted letters, and a croc at the end if wanted.
function signTex(text, ink, board, withCroc) {
  return tex(1024, 200, (g, w, h) => {
    g.fillStyle = board; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(0,0,0,${rnd(0.02, 0.14)})`; g.fillRect(0, i * h / 4, w, h / 4); g.fillStyle = 'rgba(15,10,5,0.75)'; g.fillRect(0, i * h / 4, w, 3); }
    for (let i = 0; i < 120; i++) { g.strokeStyle = `rgba(40,25,10,${rnd(0.08, 0.3)})`; g.lineWidth = rnd(0.5, 2); const x = rnd(0, w), y = rnd(0, h); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(30, 180), y + rnd(-3, 3)); g.stroke(); }
    const room = withCroc ? w - 300 : w - 70; let size = 130;
    do { g.font = `900 ${size}px Impact, 'Arial Black', sans-serif`; size -= 4; } while (g.measureText(text).width > room && size > 24);
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, withCroc ? w / 2 - 95 : w / 2, h / 2 + 6);
    if (withCroc) croc(g, w - 125, h / 2, 1.9);
    for (let i = 0; i < 70; i++) { g.fillStyle = board; g.globalAlpha = rnd(0.2, 0.6); g.fillRect(rnd(0, w), rnd(0, h), rnd(2, 20), rnd(1, 4)); }   // the paint, flaking
    g.globalAlpha = 1;
  });
}
function chalkTex(lines) {
  return tex(256, 360, (g, w, h) => {
    g.fillStyle = '#23282a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7a5a38'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    g.fillStyle = '#eeeadf'; g.textBaseline = 'middle';
    lines.forEach((l, i) => { const y = 44 + i * (h - 80) / lines.length; g.font = i ? "26px 'Comic Sans MS', cursive, sans-serif" : "bold 34px 'Comic Sans MS', cursive, sans-serif"; g.textAlign = i ? 'left' : 'center'; g.fillText(l, i ? 28 : w / 2, y); });
  });
}
function paintedPanel(text, ink, base) {
  return tex(512, 180, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = ink; croc(g, w / 2, 58, 2.1); g.font = "900 44px Impact, 'Arial Black', sans-serif"; g.textAlign = 'center'; g.fillText(text, w / 2, 150); });
}

// ---- The building ------------------------------------------------------------------

function shell(g, look) {
  const wall = mat({ map: look.wall }), wood = mat({ color: 0x5a4028 });
  const inside = mat({ map: look.wall, color: 0x9a8f80 });
  box(g, W, H, 0.07, inside, 0, H / 2, -D / 2 + 0.03);                         // the back wall
  for (const s of [-1, 1]) box(g, 0.07, H, D, wall, s * (W / 2 - 0.03), H / 2, 0);   // the sides
  box(g, W, COUNTER, 0.07, wall, 0, COUNTER / 2, D / 2 - 0.03);                // under the counter
  box(g, W + 0.2, 0.07, 0.62, mat({ color: look.counter || 0x8a6a45 }), 0, COUNTER + 0.03, D / 2 - 0.18);   // the counter
  box(g, W, 0.05, D, wood, 0, 0.03, 0);                                        // the floor
  box(g, W + 0.06, 0.14, 0.09, wood, 0, H - 0.06, D / 2);                      // the beam over the opening
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) cyl(g, 0.075, 0.09, H + 0.2, wood, x * (W / 2), (H + 0.2) / 2, z * (D / 2), 8);   // bush poles at the corners
  // The roof, running off to the back, with an overhang out front.
  const roof = box(g, W + 0.5, 0.05, D + 0.85, mat({ map: look.roof, roughness: look.thatch ? 1 : 0.55, metalness: look.thatch ? 0 : 0.35 }), 0, H + 0.14, 0.2);
  roof.rotation.x = 0.1;
  if (look.thatch) for (let i = 0; i < 26; i++) { const t = box(g, rnd(0.25, 0.5), 0.06, rnd(0.9, 1.5), mat({ map: look.roof }), rnd(-1.6, 1.6), H + 0.2 + rnd(0, 0.06), rnd(-1, 1.4)); t.rotation.set(0.1 + rnd(-0.05, 0.05), rnd(-0.2, 0.2), 0); }
  if (look.awning) { const a = box(g, W + 0.25, 0.03, 0.85, mat({ map: look.awning, side: THREE.DoubleSide }), 0, H - 0.12, D / 2 + 0.34); a.rotation.x = 0.45; }
  // The sign, on two posts above the roof.
  for (const s of [-1, 1]) box(g, 0.1, 0.95, 0.1, wood, s * (W / 2 - 0.2), H + 0.5, D / 2 + 0.02);
  box(g, W + 0.35, 0.7, 0.07, wood, 0, H + 0.68, D / 2 + 0.08);
  add(g, new THREE.PlaneGeometry(W + 0.33, 0.68), mat({ map: look.sign }), 0, H + 0.68, D / 2 + 0.117);
  // A string of bulbs along the beam.
  const bulb = mat({ color: 0xffe2a8, emissive: 0xffc870, emissiveIntensity: 0.9 });
  for (let i = 0; i <= 8; i++) add(g, new THREE.SphereGeometry(0.035, 6, 5), bulb, -W / 2 + 0.1 + i * (W - 0.2) / 8, H - 0.2 - Math.sin(i / 8 * Math.PI) * 0.07, D / 2 + 0.06);
}

function shelves(g, y, material) { box(g, W - 0.4, 0.04, 0.24, material, 0, y, -D / 2 + 0.17); }
function wallPicture(g, x, y, map, w = 0.72, h = 0.5) {
  const frame = mat({ color: 0x4a3420 });
  box(g, w + 0.08, h + 0.08, 0.03, frame, x, y, -D / 2 + 0.085);
  add(g, new THREE.PlaneGeometry(w, h), mat({ map }), x, y, -D / 2 + 0.105);
}
const crocPicture = () => tex(256, 170, (g, w, h) => { g.fillStyle = '#b89a6e'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(70,50,30,0.25)'; g.fillRect(0, h * 0.68, w, h * 0.32); g.fillStyle = '#3a2c1c'; croc(g, w / 2, h * 0.58, 1.9); });
// Rows of jars and bottles on a shelf.
function bottles(g, y, colours, n = 9) {
  for (let i = 0; i < n; i++) {
    const m = mat({ color: colours[i % colours.length], roughness: 0.3 }), x = -W / 2 + 0.42 + i * (W - 0.84) / (n - 1);
    cyl(g, 0.038, 0.044, 0.17, m, x, y + 0.11, -D / 2 + 0.17, 7); cyl(g, 0.016, 0.03, 0.06, m, x, y + 0.22, -D / 2 + 0.17, 6);
  }
}
// One of the game's own foods, sat on the counter at a set size.
function foodModel(g, gltf, x, z, size) {
  if (!gltf) return null;
  const m = gltf.scene.clone(true), b = new THREE.Box3().setFromObject(m), sz = b.getSize(new THREE.Vector3());
  m.scale.setScalar(size / Math.max(sz.x, sz.y, sz.z));
  const c = new THREE.Box3().setFromObject(m);
  m.position.set(x - (c.min.x + c.max.x) / 2, COUNTER + 0.07 - c.min.y, z - (c.min.z + c.max.z) / 2);
  m.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(m); return m;
}
function vendor(g, shirt, shorts, cap) {
  const p = person({ shirt, shorts, cap });
  p.g.scale.set(1.08, 1.08, 1.08); p.g.position.set(rnd(-0.35, 0.35), 0.05, -0.15);
  p.arms[0].rotation.x = -0.55; p.arms[1].rotation.x = -0.75;      // leaning on the counter, ready to serve
  g.add(p.g);
}
const COUNTER_Z = D / 2 - 0.18;

// ---- The shops --------------------------------------------------------------------

function grillStand(g, models) {
  shell(g, { wall: boards('#6e5438', '#8c7354', 0.3), roof: iron('#7c6250', 'rgba(120,62,28,'), awning: stripes('#b53a2e', '#efe6d2'), sign: signTex('HOT DOGS & BURGERS', '#8f2a1e', '#a98a60', true) });
  const steel = mat({ color: 0x8a8d90, metalness: 0.7, roughness: 0.4 }), dark = mat({ color: 0x1c1a18, roughness: 0.6 });
  // The hotplate: a steel box with a dark top, sausages frying on it.
  box(g, 1.0, 0.16, 0.48, steel, -0.78, COUNTER + 0.15, COUNTER_Z); box(g, 0.94, 0.02, 0.42, dark, -0.78, COUNTER + 0.24, COUNTER_Z);
  const sausage = mat({ color: 0x8c4a26, roughness: 0.5 });
  for (let i = 0; i < 6; i++) { const s = cyl(g, 0.026, 0.026, 0.2, sausage, -1.14 + i * 0.145, COUNTER + 0.27, COUNTER_Z - 0.06 + (i % 2) * 0.1, 7); s.rotation.x = Math.PI / 2; }
  // Buns stacked up, and sauce bottles.
  const bun = mat({ color: 0xd09a58, roughness: 0.75 });
  for (let i = 0; i < 7; i++) { const b = add(g, new THREE.SphereGeometry(0.065, 8, 6), bun, 0.02 + (i % 4) * 0.13, COUNTER + 0.12 + (i > 3 ? 0.09 : 0), COUNTER_Z - 0.14); b.scale.set(1.3, 0.62, 1); }
  for (const [x, c] of [[-0.14, 0xb3201a], [-0.05, 0xe0b420]]) { cyl(g, 0.03, 0.035, 0.17, mat({ color: c, roughness: 0.3 }), x, COUNTER + 0.15, COUNTER_Z + 0.14, 7); cyl(g, 0.006, 0.02, 0.05, mat({ color: c }), x, COUNTER + 0.26, COUNTER_Z + 0.14, 5); }
  foodModel(g, models.get('food-hotdog'), 0.62, COUNTER_Z + 0.03, 0.4);
  foodModel(g, models.get('food-hamburger'), 1.12, COUNTER_Z + 0.03, 0.34);
  // The back wall.
  shelves(g, 1.42, mat({ color: 0x6b4c2e })); bottles(g, 1.42, [0x2e6b34, 0x6e3a1a, 0xb3201a, 0xe0b420]);
  wallPicture(g, -0.82, 2.0, crocPicture());
  add(g, new THREE.PlaneGeometry(0.62, 0.86), mat({ map: chalkTex(['MENU', 'Hot dog', 'Burger', 'Hot chips', 'Cold drink']) }), 0.95, 1.96, -D / 2 + 0.09);
  const ring = add(g, new THREE.TorusGeometry(0.22, 0.06, 8, 18), mat({ color: 0xc9b08a }), 0.12, 2.0, -D / 2 + 0.11);
  ring.scale.y = 1.05;
  add(g, new THREE.PlaneGeometry(1.5, 0.53), mat({ map: paintedPanel('GOOD TUCKER', '#2f2316'), transparent: true, depthWrite: false }), 0, 0.56, D / 2 + 0.012);
  vendor(g, 0xb59a64, 0x6b5a3e, 0x5a4a32);
}

function fryerStand(g, models) {
  shell(g, { wall: boards('#b58f3e', '#6e5438', 0.42), roof: iron('#5f7d5c', 'rgba(110,70,35,'), awning: stripes('#2f6b44', '#efe6d2'), sign: signTex('FRIES & CHICKEN', '#1f3f73', '#d8c48c', false), counter: 0x9b8a6a });
  const steel = mat({ color: 0xa2a5a8, metalness: 0.75, roughness: 0.35 }), oil = mat({ color: 0xb98a2c, roughness: 0.15, metalness: 0.2 });
  // The fryer: a steel tub of hot oil, with two wire baskets hung up to drain.
  box(g, 0.9, 0.24, 0.5, steel, 0.82, COUNTER + 0.19, COUNTER_Z); box(g, 0.8, 0.02, 0.4, oil, 0.82, COUNTER + 0.31, COUNTER_Z);
  for (const x of [0.62, 1.02]) {
    box(g, 0.3, 0.13, 0.26, mat({ color: 0x55585a, metalness: 0.6, wireframe: true }), x, COUNTER + 0.46, COUNTER_Z - 0.1);
    const h = box(g, 0.025, 0.025, 0.3, steel, x, COUNTER + 0.53, COUNTER_Z + 0.08); h.rotation.x = -0.5;
  }
  // Paper cones of chips.
  const paper = mat({ color: 0xe9e0c8 }), chip = mat({ color: 0xe6be58 });
  for (let i = 0; i < 4; i++) {
    const x = -0.28 + i * 0.17, cone = add(g, new THREE.ConeGeometry(0.07, 0.22, 8, 1, true), paper, x, COUNTER + 0.2, COUNTER_Z + 0.12); cone.rotation.x = Math.PI;
    for (let k = 0; k < 5; k++) { const c = box(g, 0.016, 0.1, 0.016, chip, x + rnd(-0.03, 0.03), COUNTER + 0.33, COUNTER_Z + 0.12 + rnd(-0.03, 0.03)); c.rotation.z = rnd(-0.25, 0.25); }
  }
  foodModel(g, models.get('food-chicken'), -0.62, COUNTER_Z + 0.02, 0.38);
  foodModel(g, models.get('food-fries'), -1.12, COUNTER_Z + 0.02, 0.34);
  // A rack of roast chickens at the back, and salt shakers.
  const roast = mat({ color: 0xb06a28, roughness: 0.45 });
  box(g, 1.3, 0.03, 0.26, steel, -0.5, 1.5, -D / 2 + 0.18);
  for (let i = 0; i < 4; i++) { const r = add(g, new THREE.SphereGeometry(0.095, 9, 7), roast, -1.0 + i * 0.33, 1.6, -D / 2 + 0.18); r.scale.set(1.25, 0.8, 0.9); }
  add(g, new THREE.PlaneGeometry(0.62, 0.86), mat({ map: chalkTex(['TODAY', 'Hot chips', 'Chicken leg', 'Half a bird', 'Gravy']) }), 0.9, 1.92, -D / 2 + 0.09);
  wallPicture(g, -0.5, 2.05, tex(256, 170, (c, w, h) => { c.fillStyle = '#2f6b44'; c.fillRect(0, 0, w, h); c.fillStyle = '#efe6d2'; c.font = "900 40px Impact, 'Arial Black', sans-serif"; c.textAlign = 'center'; c.fillText('FRESH', w / 2, 70); c.fillText('FRIED', w / 2, 125); }), 0.6, 0.42);
  add(g, new THREE.PlaneGeometry(1.5, 0.53), mat({ map: paintedPanel('CHIPPER', '#3a2a12'), transparent: true, depthWrite: false }), 0, 0.56, D / 2 + 0.012);
  vendor(g, 0xe9e0c8, 0x2c3e50, 0x2f6b44);
}

function ovenStand(g, models) {
  shell(g, { wall: boards('#4f7d78', '#7a6444', 0.45), roof: tex(256, 256, (c, w, h) => { c.fillStyle = '#a78a52'; c.fillRect(0, 0, w, h); for (let i = 0; i < 420; i++) { c.strokeStyle = ['#7d6436', '#c4a868', '#8e7442', '#5f4c2a'][i % 4]; c.lineWidth = rnd(1, 3); const x = rnd(0, w), y = rnd(0, h); c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd(-8, 8), y + rnd(30, 90)); c.stroke(); } }), thatch: true, sign: signTex('PIZZA & TACOS', '#f2e6c8', '#27514c', false), counter: 0x6e5a3e });
  // The wood-fired oven, out to one side: a brick dome with a dark mouth and a chimney.
  const brick = mat({ map: tex(256, 128, (c, w, h) => { c.fillStyle = '#6a5a4c'; c.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let i = -1; i < 9; i++) { c.fillStyle = ['#a85c3c', '#94502f', '#b86c48', '#8a4a2e'][Math.floor(Math.random() * 4)]; c.fillRect(i * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14); } }, [3, 2]), roughness: 0.95 });
  const X = W / 2 + 0.95, Z = 0.25;
  box(g, 1.25, 0.82, 1.25, brick, X, 0.41, Z);
  const dome = add(g, new THREE.SphereGeometry(0.58, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2), brick, X, 0.82, Z); dome.scale.y = 0.95;
  const mouth = add(g, new THREE.CircleGeometry(0.24, 14, 0, Math.PI), mat({ color: 0x120c08 }), X, 0.84, Z + 0.565);
  mouth.scale.y = 1.15;
  add(g, new THREE.CircleGeometry(0.13, 10, 0, Math.PI), mat({ color: 0xff7a2a, emissive: 0xff5a10, emissiveIntensity: 1.3 }), X, 0.84, Z + 0.57);
  cyl(g, 0.09, 0.11, 0.8, mat({ color: 0x3a3a3a, metalness: 0.5 }), X, 1.68, Z - 0.1, 8);
  for (let i = 0; i < 6; i++) { const log = cyl(g, 0.055, 0.055, 0.5, mat({ color: 0x6e4e30 }), X - 0.18 + (i % 3) * 0.13, 0.07 + Math.floor(i / 3) * 0.1, Z + 0.95, 7); log.rotation.x = Math.PI / 2; }
  // Round pizzas on boards, a row of taco shells, tomatoes and limes.
  const crust = mat({ color: 0xd4a050 }), sauce = mat({ color: 0xc23a1c, roughness: 0.6 }), cheese = mat({ color: 0xe8c65a, roughness: 0.6 });
  for (const x of [-1.05, -0.45]) {
    cyl(g, 0.27, 0.27, 0.02, mat({ color: 0x8a6a45 }), x, COUNTER + 0.08, COUNTER_Z, 16); cyl(g, 0.23, 0.24, 0.03, crust, x, COUNTER + 0.11, COUNTER_Z, 16); cyl(g, 0.205, 0.205, 0.012, sauce, x, COUNTER + 0.13, COUNTER_Z, 16); cyl(g, 0.17, 0.17, 0.012, cheese, x, COUNTER + 0.14, COUNTER_Z, 14);
    for (let k = 0; k < 6; k++) { const a = k * 1.05, r = cyl(g, 0.026, 0.026, 0.012, sauce, x + Math.cos(a) * 0.11, COUNTER + 0.15, COUNTER_Z + Math.sin(a) * 0.11, 7); r.scale.y = 1; }
  }
  foodModel(g, models.get('food-pizza'), 0.1, COUNTER_Z + 0.02, 0.36);
  foodModel(g, models.get('food-taco'), 0.62, COUNTER_Z + 0.02, 0.34);
  const shell_ = mat({ color: 0xe0b860 }), filling = mat({ color: 0x6e8e3a });
  for (let i = 0; i < 3; i++) { const x = 0.96 + i * 0.16, t = add(g, new THREE.TorusGeometry(0.075, 0.012, 5, 10, Math.PI), shell_, x, COUNTER + 0.08, COUNTER_Z); t.rotation.set(Math.PI, Math.PI / 2, 0); box(g, 0.02, 0.05, 0.11, filling, x, COUNTER + 0.1, COUNTER_Z); }
  // Hanging chillies and garlic, jars, a chalk menu.
  shelves(g, 1.45, mat({ color: 0x5c4630 })); bottles(g, 1.45, [0xc23a1c, 0x6e8e3a, 0xd9b45a], 7);
  const chilli = mat({ color: 0xb31f14, roughness: 0.4 });
  for (let s = 0; s < 2; s++) for (let i = 0; i < 6; i++) { const c = add(g, new THREE.ConeGeometry(0.018, 0.1, 5), chilli, -1.2 + s * 0.2 + (i % 2) * 0.03, 2.2 - i * 0.075, -D / 2 + 0.11); c.rotation.x = Math.PI; }
  add(g, new THREE.PlaneGeometry(0.62, 0.86), mat({ map: chalkTex(['ORDER', 'Margherita', 'Bush pizza', 'Beef taco', 'Fish taco']) }), 0.75, 2.0, -D / 2 + 0.09);
  add(g, new THREE.PlaneGeometry(1.5, 0.53), mat({ map: paintedPanel('WOOD FIRED', '#e8dcc0'), transparent: true, depthWrite: false }), 0, 0.56, D / 2 + 0.012);
  vendor(g, 0xc23a1c, 0x264653, 0xf2e6c8);
}

function souvenirShop(g) {
  const shingle = tex(256, 256, (c, w, h) => { for (let r = 0; r < 10; r++) for (let i = -1; i < 9; i++) { c.fillStyle = ['#6a4a2e', '#7a5636', '#5c4028', '#84603e'][Math.floor(Math.random() * 4)]; c.fillRect(i * 32 + (r % 2) * 16, r * 26, 31, 25); } });
  shell(g, { wall: boards('#8a6f4c', '#5a4630', 0.25), roof: shingle, thatch: false, sign: signTex('PARK SOUVENIRS', '#2f2316', '#b09468', true), counter: 0x7a6040 });
  // T-shirts on the back wall, each with its croc.
  const shirtTex = (base, ink) => tex(256, 256, (c, w, h) => { c.fillStyle = base; c.beginPath(); c.moveTo(70, 18); c.lineTo(186, 18); c.lineTo(250, 70); c.lineTo(214, 104); c.lineTo(194, 88); c.lineTo(194, 244); c.lineTo(62, 244); c.lineTo(62, 88); c.lineTo(42, 104); c.lineTo(6, 70); c.closePath(); c.fill(); c.fillStyle = base === '#efe9da' ? '#d8d0bc' : 'rgba(255,255,255,0.12)'; c.beginPath(); c.arc(128, 18, 26, 0, Math.PI); c.fill(); c.fillStyle = ink; croc(c, 128, 120, 0.95); c.font = "900 22px Impact, 'Arial Black', sans-serif"; c.textAlign = 'center'; c.fillText('CROC PARK', 128, 170); });
  const rail = mat({ color: 0x4a4a4a, metalness: 0.6 });
  const r = cyl(g, 0.012, 0.012, W - 0.9, rail, -0.3, 2.14, -D / 2 + 0.14, 6); r.rotation.z = Math.PI / 2;
  [['#2b3540', '#d8d0bc'], ['#efe9da', '#3a4a2e'], ['#5a6f3a', '#efe9da'], ['#8c3a2a', '#efe9da']].forEach(([b, i], k) => add(g, new THREE.PlaneGeometry(0.66, 0.66), mat({ map: shirtTex(b, i), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), -1.05 + k * 0.5, 1.8, -D / 2 + 0.12 + k * 0.006));
  // Bush hats on pegs down the outside wall, and on the counter.
  const hatMat = c => mat({ color: c });
  const hat = (x, y, z, c, tiltZ = 0) => { const m = hatMat(c), b = cyl(g, 0.2, 0.2, 0.018, m, x, y, z, 14), t = cyl(g, 0.1, 0.12, 0.1, m, x, y + 0.055, z, 12), band = cyl(g, 0.122, 0.122, 0.025, mat({ color: 0x2b1e12 }), x, y + 0.02, z, 12); for (const o of [b, t, band]) o.rotation.z = tiltZ; };
  for (let i = 0; i < 4; i++) hat(-W / 2 - 0.08, 1.98 - i * 0.42, 0.7 - i * 0.1, [0x7a5a38, 0x5a4228, 0x8c6c44, 0x6a4c30][i], 1.2);
  hat(-1.12, COUNTER + 0.09, COUNTER_Z, 0x7a5a38);
  // A stand of sunglasses, boomerangs on the wall, sunscreen and stubby holders on the counter.
  const stand = box(g, 0.32, 1.15, 0.12, mat({ color: 0x8a6a45 }), W / 2 - 0.3, COUNTER + 0.6, COUNTER_Z - 0.05);
  stand.castShadow = true;
  const lens = mat({ color: 0x111418, roughness: 0.12, metalness: 0.6 });
  for (let r2 = 0; r2 < 6; r2++) for (const s of [-1, 1]) { const l = add(g, new THREE.SphereGeometry(0.035, 7, 5), lens, W / 2 - 0.3 + s * 0.05, COUNTER + 0.2 + r2 * 0.17, COUNTER_Z + 0.02); l.scale.z = 0.3; }
  const carved = mat({ color: 0xa8683a, roughness: 0.65 }), bandMat = mat({ color: 0x22180f });
  for (let i = 0; i < 3; i++) { const b = add(g, new THREE.TorusGeometry(0.21, 0.03, 5, 12, 2.1), carved, 0.72 + i * 0.03, 2.05 - i * 0.28, -D / 2 + 0.11); b.rotation.z = 0.5; b.scale.z = 0.35; box(g, 0.05, 0.015, 0.012, bandMat, 0.72 + i * 0.03, 2.2 - i * 0.28, -D / 2 + 0.14); }
  const bottle = mat({ color: 0xe0a820, roughness: 0.35 }), lid = mat({ color: 0x2a5fa8 });
  for (let i = 0; i < 6; i++) { const x = 0.05 + i * 0.1; cyl(g, 0.036, 0.04, 0.2, bottle, x, COUNTER + 0.17, COUNTER_Z + 0.1, 7); cyl(g, 0.02, 0.03, 0.04, lid, x, COUNTER + 0.29, COUNTER_Z + 0.1, 6); }
  for (let i = 0; i < 5; i++) box(g, 0.13, 0.06, 0.09, mat({ color: [0x7a4f2a, 0x3a6a4a, 0x9a3a2a][i % 3] }), -0.55 + i * 0.14, COUNTER + 0.1, COUNTER_Z + 0.05);
  add(g, new THREE.PlaneGeometry(1.7, 0.6), mat({ map: paintedPanel('CROCODILE PARK', '#2a1f12'), transparent: true, depthWrite: false }), 0, 0.56, D / 2 + 0.012);
  vendor(g, 0xc9a86a, 0x5a4a32, 0x5a4228);
}

function fruitStand(g) {
  shell(g, { wall: boards('#e09a45', '#8a6a40', 0.22), roof: iron('#c9603f', 'rgba(120,62,28,'), awning: stripes('#f2c230', '#fff6e0'), sign: signTex('TROPICAL FRUIT', '#2f6b34', '#f6e3a8', false), counter: 0x9b7a4a });
  const crate = mat({ color: 0x9a7448 });
  const heap = (x, colour, r, n = 9) => {
    box(g, 0.62, 0.12, 0.46, crate, x, COUNTER + 0.13, COUNTER_Z);
    for (let i = 0; i < n; i++) add(g, new THREE.SphereGeometry(r, 9, 7), mat({ color: colour, roughness: 0.55 }), x - 0.2 + (i % 3) * 0.2, COUNTER + 0.23 + Math.floor(i / 6) * r * 1.2, COUNTER_Z - 0.13 + (Math.floor(i / 3) % 2) * 0.22);
  };
  heap(-1.08, 0xf2a530, 0.075); heap(-0.38, 0xd9402a, 0.07); heap(0.34, 0x8ccf4a, 0.075);
  // A pineapple or two, and a big hand of bananas hung from the beam.
  for (const x of [0.92, 1.2]) { const p = add(g, new THREE.SphereGeometry(0.11, 9, 8), mat({ color: 0xc99a30, roughness: 0.8 }), x, COUNTER + 0.2, COUNTER_Z); p.scale.y = 1.35; add(g, new THREE.ConeGeometry(0.075, 0.2, 7), mat({ color: 0x3f8a3a }), x, COUNTER + 0.42, COUNTER_Z); }
  for (let i = 0; i < 6; i++) { const b = cyl(g, 0.022, 0.03, 0.26, mat({ color: 0xf4d83c, roughness: 0.5 }), -0.9 + i * 0.07, H - 0.48, D / 2 - 0.12, 6); b.rotation.z = -0.5 + i * 0.2; }
  add(g, new THREE.PlaneGeometry(0.62, 0.86), mat({ map: chalkTex(['FRESH', 'Mango', 'Pineapple', 'Paw paw', 'Banana']) }), 0, 1.9, -D / 2 + 0.09);
  add(g, new THREE.PlaneGeometry(1.5, 0.53), mat({ map: paintedPanel('PICKED TODAY', '#4a2a0e'), transparent: true, depthWrite: false }), 0, 0.56, D / 2 + 0.012);
  vendor(g, 0xf2c230, 0x3f6b4a, 0xc9603f);
}

function iceCreamStand(g) {
  shell(g, { wall: boards('#efb4bd', '#b98a80', 0.15), roof: iron('#86ccd6', 'rgba(90,120,130,'), awning: stripes('#f28aa0', '#fff6e8'), sign: signTex('ICE CREAMS', '#c23a66', '#fff2d4', false), counter: 0xf4ead8 });
  // The freezer on the counter, a row of cones, and a giant cone up on the roof.
  box(g, 1.2, 0.3, 0.5, mat({ color: 0xf6f8f8, roughness: 0.3 }), -0.72, COUNTER + 0.22, COUNTER_Z);
  const cone = mat({ color: 0xd9a050, roughness: 0.8 }), scoops = [0xfff0d2, 0xf59ab0, 0x8a5230, 0x9ad8b0, 0xf2d060];
  scoops.forEach((c, i) => {
    const x = 0.14 + i * 0.24, k = add(g, new THREE.ConeGeometry(0.06, 0.2, 8), cone, x, COUNTER + 0.17, COUNTER_Z); k.rotation.x = Math.PI;
    add(g, new THREE.SphereGeometry(0.07, 9, 7), mat({ color: c, roughness: 0.6 }), x, COUNTER + 0.31, COUNTER_Z);
  });
  const big = add(g, new THREE.ConeGeometry(0.42, 1.2, 12), cone, W / 2 - 0.5, H + 0.95, -0.35); big.rotation.x = Math.PI;
  add(g, new THREE.SphereGeometry(0.47, 14, 10), mat({ color: 0xf59ab0, roughness: 0.6 }), W / 2 - 0.5, H + 1.72, -0.35);
  add(g, new THREE.SphereGeometry(0.1, 8, 6), mat({ color: 0xc8202c, roughness: 0.3 }), W / 2 - 0.5, H + 2.22, -0.35);   // the cherry
  add(g, new THREE.PlaneGeometry(0.62, 0.86), mat({ map: chalkTex(['SCOOPS', 'Vanilla', 'Strawberry', 'Choc', 'Mango']) }), 0, 1.9, -D / 2 + 0.09);
  add(g, new THREE.PlaneGeometry(1.5, 0.53), mat({ map: paintedPanel('COOL DOWN', '#b0355c'), transparent: true, depthWrite: false }), 0, 0.56, D / 2 + 0.012);
  vendor(g, 0xfff6e8, 0xf28aa0, 0xf28aa0);
}

function drinksStand(g) {
  shell(g, { wall: boards('#57b0c4', '#7a8a80', 0.2), roof: iron('#e8bb50', 'rgba(130,90,30,'), awning: stripes('#2a8fb0', '#fff6e0'), sign: signTex('COLD DRINKS', '#fff6dc', '#1f7a94', false), counter: 0xa8865a });
  // A tub of ice with bottles in it, and coconuts with straws.
  box(g, 1.1, 0.26, 0.5, mat({ color: 0x3f7fa8, metalness: 0.4, roughness: 0.4 }), -0.72, COUNTER + 0.2, COUNTER_Z);
  box(g, 1.0, 0.02, 0.42, mat({ color: 0xe6f6fa, roughness: 0.2 }), -0.72, COUNTER + 0.33, COUNTER_Z);
  [0xc23a1c, 0x2e8b4a, 0xe08a20, 0x2a6fb0, 0xc23a1c, 0x2e8b4a].forEach((c, i) => { const b = cyl(g, 0.034, 0.04, 0.22, mat({ color: c, roughness: 0.25 }), -1.08 + i * 0.15, COUNTER + 0.42, COUNTER_Z - 0.05 + (i % 2) * 0.1, 7); b.rotation.z = (i % 2 ? 1 : -1) * 0.12; });
  for (let i = 0; i < 3; i++) {
    const x = 0.32 + i * 0.36;
    add(g, new THREE.SphereGeometry(0.13, 10, 8), mat({ color: 0x7a5230, roughness: 0.95 }), x, COUNTER + 0.2, COUNTER_Z);
    const s = cyl(g, 0.009, 0.009, 0.2, mat({ color: 0xf28aa0 }), x + 0.05, COUNTER + 0.38, COUNTER_Z, 5); s.rotation.z = -0.35;
  }
  shelves(g, 1.42, mat({ color: 0x6b4c2e })); bottles(g, 1.42, [0xc23a1c, 0x2e8b4a, 0xe08a20, 0x2a6fb0]);
  add(g, new THREE.PlaneGeometry(0.62, 0.86), mat({ map: chalkTex(['ICE COLD', 'Coconut', 'Lemonade', 'Mango juice', 'Water']) }), 0, 1.98, -D / 2 + 0.09);
  add(g, new THREE.PlaneGeometry(1.5, 0.53), mat({ map: paintedPanel('THIRSTY?', '#fff6dc'), transparent: true, depthWrite: false }), 0, 0.56, D / 2 + 0.012);
  vendor(g, 0x2a8fb0, 0xe8dcc0, 0xe8bb50);
}

const KINDS = { grill: grillStand, fryer: fryerStand, oven: ovenStand, souvenir: souvenirShop, fruit: fruitStand, icecream: iceCreamStand, drinks: drinksStand };

// One shop, by its kind (rules.js STANDS), its front facing +z.
export function buildShop(kind, models) {
  const g = new THREE.Group();
  KINDS[kind](g, models);
  return g;
}
