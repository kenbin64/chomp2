// kuranda-market.js
// The Kuranda markets made like the real ones (Ken, 2026-10-18: "rustic and
// hippy", "more like a bazaar or farmers market", the stands and bungalows
// looked cheap). A rambling bazaar under the rainforest:
//   stalls   rough timber frames, rusty corrugated iron or canvas roofs, sarongs,
//            tie-dye, dreamcatchers and wind chimes hanging at the back, trestle
//            tables with batik cloths piled with goods for each kind of stall,
//            hand-painted signs, fairy lights along the roof edge
//   street   bunting, shade sails and strings of fairy lights across it
//   houses   Queenslanders: on stumps, weatherboards, pitched iron roofs,
//            verandas with posts, brackets and balusters, lattice, shutters,
//            hanging ferns
// Everything here is drawn from shapes and painted canvases; each stall and
// house is merged into a few meshes (one per material) so a busy market stays
// cheap to draw. Night: the fairy lights glow (setNight).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fitText } from '../signtext.js';

// ---- Painted textures ---------------------------------------------------------------------
const cache = new Map();
function canvasTex(key, w, h, draw, repeat = [1, 1]) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.anisotropy = 4; cache.set(key, t); return t;
}
const rand = (() => { let s = 777; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

// Old corrugated iron: ridges, with rust bleeding down from the nail lines.
function ironTex(rust = 0.5) {
  return canvasTex('iron' + rust, 256, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) { const v = 150 + 55 * Math.sin(x / w * Math.PI * 24); g.fillStyle = `rgb(${v},${v + 4},${v + 8})`; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 260 * rust; i++) {
      const x = rand() * w, y = rand() * h, len = 10 + rand() * 70;
      const grd = g.createLinearGradient(x, y, x, y + len); grd.addColorStop(0, `rgba(${120 + rand() * 50},${55 + rand() * 25},20,${0.25 + rand() * 0.35})`); grd.addColorStop(1, 'rgba(120,60,20,0)');
      g.fillStyle = grd; g.fillRect(x, y, 2 + rand() * 7, len);
    }
    g.fillStyle = 'rgba(70,40,20,0.5)'; for (const y of [8, h - 10]) for (let x = 6; x < w; x += 21) g.fillRect(x, y, 3, 3);
  });
}
// Weatherboards: painted horizontal boards with a shadow under each lap and worn paint.
function weatherboardTex(colour) {
  return canvasTex('wb' + colour, 256, 256, (g, w, h) => {
    g.fillStyle = colour; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      const grd = g.createLinearGradient(0, y, 0, y + 16); grd.addColorStop(0, 'rgba(255,255,255,0.12)'); grd.addColorStop(0.8, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = grd; g.fillRect(0, y, w, 16);
    }
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(90,70,50,${rand() * 0.15})`; g.fillRect(rand() * w, rand() * h, 2 + rand() * 14, 1 + rand() * 2); }
  }, [2, 2]);
}
// Rough-sawn timber.
function timberTex(tone = 0) {
  return canvasTex('timber' + tone, 128, 256, (g, w, h) => {
    const base = [[122, 85, 54], [96, 68, 44], [140, 104, 70]][tone];
    g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = rand() * w; g.strokeStyle = `rgba(40,25,12,${0.1 + rand() * 0.25})`; g.lineWidth = 0.6 + rand() * 1.4; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rand() * 8 - 4, h / 3, x + rand() * 8 - 4, h * 2 / 3, x + rand() * 6 - 3, h); g.stroke(); }
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(40,25,12,0.45)'; g.beginPath(); g.ellipse(rand() * w, rand() * h, 3 + rand() * 4, 6 + rand() * 8, 0, 0, Math.PI * 2); g.fill(); }
  });
}
// Tie-dye: spirals of bright colour radiating from the middle.
function tieDyeTex(seed) {
  // Faded, sun-washed tie-dye: a little colour, not a rainbow (Ken: Kuranda was too colourful).
  // Rich, warm colours, like Ken's art hut (Ken: Kuranda is more colourful than other places).
  const sets = [['#e0583a', '#f2b02e', '#1f9c94', '#b0397a'], ['#2fa36a', '#f2c94c', '#e2703a', '#5a5fb8'], ['#d8466a', '#28a8b0', '#f0a030', '#6aa83a'], ['#c0392b', '#e8a838', '#16808a', '#8e44ad']];
  const cols = sets[seed % sets.length];
  return canvasTex('tie' + seed, 128, 128, (g, w, h) => {
    for (let r = 90; r > 0; r -= 2) for (let a = 0; a < Math.PI * 2; a += 0.06) {
      g.fillStyle = cols[Math.floor((a * 2 + r * 0.08 + seed) % cols.length)];
      g.fillRect(w / 2 + Math.cos(a + r * 0.05) * r, h / 2 + Math.sin(a + r * 0.05) * r, 3, 3);
    }
  });
}
// Batik and sarong cloth: repeating hand-printed motifs on a coloured ground.
function batikTex(seed) {
  const grounds = ['#1f6f8a', '#b8432a', '#2f8a4a', '#8a2f6a', '#d08a1a', '#14808a'];   // teal, terracotta, leaf green, magenta, mango, deep teal
  const ground = grounds[seed % grounds.length];
  return canvasTex('batik' + seed, 128, 128, (g, w, h) => {
    g.fillStyle = ground; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,240,210,0.75)'; g.lineWidth = 2;
    for (let y = 16; y < h; y += 32) for (let x = 16; x < w; x += 32) {
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * 10, y + Math.sin(a + 0.6) * 10, x + Math.cos(a) * 13, y + Math.sin(a) * 13); } g.stroke();
      g.fillStyle = 'rgba(255,210,120,0.8)'; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 40; i++) g.fillRect(rand() * w, rand() * h, 1, 6 + rand() * 12);   // the crackle of wax
  });
}
// A hand-painted sign on a weathered board.
function signTex(text, bg, fg) {
  return canvasTex('sign' + text + bg, 512, 160, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${rand() * 0.08})`; g.fillRect(0, rand() * h, w, 1 + rand() * 2); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, text, w / 2, h / 2 + 4, w - 64, 66, 'italic bold {size}px "Comic Sans MS", "Segoe Print", "Trebuchet MS", cursive');   // always fits inside the border
    g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
  });
}
// Woven lattice.
function latticeTex() {
  return canvasTex('lattice', 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#efe9da'; g.lineWidth = 7;
    for (let i = -w; i < w * 2; i += 26) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
  }, [3, 1]);
}

// ---- Merging: a group of meshes into one mesh per material ----------------------------------
function bake(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map(), keep = [];
  group.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.keep) { keep.push(o); return; }
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const geo = g.index ? g.toNonIndexed() : g;
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(geo);
  });
  const out = new THREE.Group();
  for (const [m, list] of byMat) {
    const merged = new THREE.Mesh(mergeGeometries(list), m);
    merged.castShadow = !m.transparent && !m.userData.small; merged.receiveShadow = !m.userData.small;   // small goods cast no shadow (cheaper)
    out.add(merged);
  }
  for (const k of keep) { k.updateMatrixWorld(true); const c = k.clone(); c.matrix.copy(k.matrixWorld); c.matrixAutoUpdate = false; out.add(c); }
  return out;
}

// A stall merged into a few meshes, ready to place.
export function bakeStall(group) { return bake(group); }

// ---- Materials (shared) ---------------------------------------------------------------------
const M = {};
function mats() {
  if (M.ready) return M;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  M.timber = std({ map: timberTex(0) }); M.timberDark = std({ map: timberTex(1) }); M.timberLight = std({ map: timberTex(2) });
  M.iron = std({ map: ironTex(0.5), roughness: 0.6, metalness: 0.35 }); M.ironRusty = std({ map: ironTex(1.2), roughness: 0.7, metalness: 0.25 });
  M.canvas = [0xf0e2c0, 0xc9502e, 0x1f8a84, 0xe8a830].map(c => std({ color: c, side: THREE.DoubleSide }));
  M.cloth = Array.from({ length: 6 }, (_, i) => std({ map: batikTex(i), side: THREE.DoubleSide, roughness: 0.95 }));
  M.tie = Array.from({ length: 4 }, (_, i) => std({ map: tieDyeTex(i), side: THREE.DoubleSide, roughness: 0.95 }));
  M.rope = std({ color: 0xc9a46a }); M.metal = std({ color: 0xb8b8b0, metalness: 0.8, roughness: 0.3 });
  M.glass = std({ color: 0xffb54a, roughness: 0.2, transparent: true, opacity: 0.75 });
  M.hessian = std({ color: 0xb69466, roughness: 1 }); M.feather = std({ color: 0xf2efe6, side: THREE.DoubleSide });
  M.leaf = std({ color: 0x3f7a35, side: THREE.DoubleSide }); M.pot = std({ color: 0xa65a35 });
  M.bulb = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc46a, emissiveIntensity: 0.2, roughness: 0.4 });
  M.fruit = { mango: std({ color: 0xffb21f, roughness: 0.45 }), banana: std({ color: 0xf2d43a, roughness: 0.5 }), pineapple: std({ color: 0xd99a2b }), green: std({ color: 0x5c8f2a }),
    dragon: std({ color: 0xe0316b, roughness: 0.5 }), pawpaw: std({ color: 0xf08a2a, roughness: 0.5 }), coconut: std({ color: 0x6b4a2a }) };
  M.honey = std({ color: 0xe8a020, roughness: 0.15, transparent: true, opacity: 0.85 }); M.lid = std({ color: 0xc23b2b });
  M.crystal = [0xb59cff, 0x9ff0e8, 0xffb6e1].map(c => std({ color: c, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 }));
  M.hat = std({ color: 0x6b4a30 }); M.bowl = std({ map: timberTex(2), roughness: 0.5 });
  // Small things (goods, bulbs, cloths, chimes) cast no shadows: the frames and roofs do.
  for (const m of [M.rope, M.metal, M.glass, M.hessian, M.feather, M.leaf, M.pot, M.bulb, M.honey, M.lid, M.hat, M.bowl, ...M.crystal, ...Object.values(M.fruit), ...M.cloth, ...M.tie]) m.userData.small = true;
  M.ready = true; return M;
}

function box(w, h, d, m, x, y, z, parent, ry = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o; }
function cyl(r0, r1, h, m, x, y, z, parent, seg = 8) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.position.set(x, y, z); parent.add(o); return o; }
function ball(r, m, x, y, z, parent, sx = 1, sy = 1, sz = 1) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o; }

// A hanging cloth: a plane gently curved, so it reads as fabric not a board.
function hangingCloth(w, h, m, x, y, z, parent, ry = 0) {
  const geo = new THREE.PlaneGeometry(w, h, 8, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / w * Math.PI * 3) * 0.05 + (p.getY(i) < -h / 3 ? Math.sin(p.getX(i) * 9) * 0.03 : 0));
  geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o;
}
function dreamcatcher(x, y, z, parent) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 6, 24), M.rope); g.add(ring);
  for (let k = 0; k < 3; k++) { const s = cyl(0.004, 0.004, 0.32, M.rope, -0.12 + k * 0.12, -0.38, 0, g, 4); s.userData.keep = false; const f = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.16), M.feather); f.position.set(-0.12 + k * 0.12, -0.58, 0); g.add(f); }
  const web = new THREE.Mesh(new THREE.CircleGeometry(0.2, 6), M.rope); web.scale.setScalar(0.4); g.add(web);
}
function windChime(x, y, z, parent) {
  cyl(0.12, 0.12, 0.02, M.timberLight, x, y, z, parent, 10);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; cyl(0.012, 0.012, 0.25 + k * 0.05, M.metal, x + Math.cos(a) * 0.08, y - 0.18 - k * 0.025, z + Math.sin(a) * 0.08, parent, 6); }
}

// Goods on a stall's table, by kind.
function goods(kind, parent, w) {
  const top = 0.96;
  if (kind === 'fruit') {
    for (let i = 0; i < 4; i++) {                              // crates of tropical fruit
      const cx = -w / 2 + 0.5 + i * (w - 1) / 3;
      box(0.62, 0.22, 0.48, M.timberLight, cx, top + 0.11, -0.05, parent);
      const f = ['mango', 'dragon', 'pawpaw', 'mango'][i];
      for (let k = 0; k < 9; k++) ball(0.085, M.fruit[f], cx - 0.2 + (k % 3) * 0.2, top + 0.26 + Math.floor(k / 3) * 0.02, -0.18 + Math.floor(k / 3) * 0.13, parent, f === 'mango' ? 0.85 : 1, 1, f === 'pawpaw' ? 1.5 : 1.1);
    }
    for (let i = 0; i < 2; i++) { const x = -0.4 + i * 0.9; for (let k = 0; k < 5; k++) { const b = cyl(0.03, 0.025, 0.24, M.fruit.banana, x + k * 0.05, top + 0.08, 0.3, parent, 6); b.rotation.z = 0.4 + k * 0.1; } }
    for (let i = 0; i < 3; i++) { const x = w / 2 - 0.4 - i * 0.35; ball(0.11, M.fruit.pineapple, x, top + 0.13, 0.32, parent, 1, 1.5, 1); const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), M.fruit.green); c.position.set(x, top + 0.38, 0.32); parent.add(c); }
    for (let i = 0; i < 4; i++) ball(0.1, M.fruit.coconut, -w / 2 + 0.3 + i * 0.22, 0.12, 0.6, parent);
  } else if (kind === 'treats') {                              // honey, jams and chutneys in rows of jars
    for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) {
      const x = -w / 2 + 0.3 + i * (w - 0.6) / 8, z = -0.25 + r * 0.22, y = top + 0.09 + r * 0.04;
      cyl(0.055, 0.055, 0.15, r === 1 ? M.fruit.dragon : M.honey, x, y, z, parent, 10); cyl(0.058, 0.058, 0.03, M.lid, x, y + 0.09, z, parent, 10);
    }
    for (let i = 0; i < 3; i++) { const s = cyl(0.2, 0.24, 0.5, M.hessian, -w / 2 + 0.4 + i * 0.5, 0.25, 0.65, parent, 10); s.scale.z = 0.8; }   // sacks of coffee beans
  } else if (kind === 'crafts') {                              // carved bowls, crystals, soaps
    for (let i = 0; i < 5; i++) { const bw = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.bowl); bw.position.set(-w / 2 + 0.35 + i * 0.35, top + 0.16, -0.15); bw.rotation.x = Math.PI; parent.add(bw); }
    for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 + (i % 3) * 0.02), M.crystal[i % 3]); c.position.set(-0.3 + i * 0.22, top + 0.1, 0.22); c.scale.y = 1.6; parent.add(c); }
    for (let i = 0; i < 6; i++) box(0.14, 0.06, 0.09, M.canvas[i % 4], w / 2 - 0.5 - (i % 3) * 0.18, top + 0.03 + Math.floor(i / 3) * 0.06, 0.35, parent);
  } else {                                                     // clothes: folded piles and Akubras
    for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++) box(0.34, 0.05, 0.28, (k + i) % 2 ? M.tie[(i + k) % 4] : M.cloth[(i + k) % 6], -w / 2 + 0.35 + i * (w - 0.7) / 5, top + 0.03 + k * 0.055, -0.1, parent);
    for (let i = 0; i < 3; i++) { const x = -0.5 + i * 0.5; cyl(0.2, 0.2, 0.02, M.hat, x, top + 0.31, 0.3, parent, 16); cyl(0.11, 0.13, 0.13, M.hat, x, top + 0.38, 0.3, parent, 12); }
  }
}

// ---- A market stall ------------------------------------------------------------------------
// kind: fruit, treats, crafts or clothes. sign: what the board says. Faces +z (the street);
// the caller turns it. Returns { group, bulbs }.
export function marketStall(kind, sign, { w = 3.8, d = 2.6, roof = 'iron', tone = 0 } = {}) {
  mats();
  const g = new THREE.Group();
  const post = [M.timber, M.timberDark, M.timberLight][tone % 3];
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    const p = cyl(0.07, 0.09, 2.7, post, x, 1.35, z, g, 7); p.rotation.z = (rand() - 0.5) * 0.03;   // bush poles, not quite straight
  }
  for (const z of [-d / 2, d / 2]) box(w + 0.3, 0.12, 0.1, post, 0, 2.62, z, g);
  // The roof: rusty iron sheets at a lean, or a canvas tarp with a scalloped fringe.
  if (roof === 'iron') {
    const sheet = box(w + 0.7, 0.04, d + 0.9, tone % 2 ? M.ironRusty : M.iron, 0, 2.86, 0.1, g); sheet.rotation.x = -0.14;
  } else {
    const tarp = M.canvas[(tone + 1) % 4];
    const t = box(w + 0.6, 0.03, d + 0.7, tarp, 0, 2.86, 0.1, g); t.rotation.x = -0.1;
    for (let x = -w / 2 - 0.2; x <= w / 2 + 0.2; x += 0.42) { const fr = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10, Math.PI, Math.PI), tarp); fr.position.set(x, 2.74, d / 2 + 0.45); parent0(fr, g); }
  }
  // The back: slatted timber, with cloths, tie-dye, dreamcatchers and chimes hanging off it.
  for (let y = 0.3; y < 2.5; y += 0.32) box(w, 0.24, 0.04, post, 0, y, -d / 2 + 0.05, g);
  const hang = Math.floor(w / 0.75);
  for (let i = 0; i < hang; i++) {
    const x = -w / 2 + 0.45 + i * (w - 0.9) / Math.max(1, hang - 1);
    if (kind === 'clothes' || (i % 3 === 0)) hangingCloth(0.62, 1.15, (i + tone) % 4 ? M.cloth[(i + tone) % 6] : M.tie[(i + tone) % 4], x, 1.75, -d / 2 + 0.14, g);
    else if (i % 4 === 1) dreamcatcher(x, 2.1, -d / 2 + 0.16, g);
    else windChime(x, 2.4, -d / 2 + 0.25, g);
  }
  // Trestle table with a batik cloth draped over it.
  box(w - 0.3, 0.06, 1.0, post, 0, 0.92, 0.2, g);
  for (const x of [-(w - 0.6) / 2, (w - 0.6) / 2]) for (const z of [-0.2, 0.6]) { const l = box(0.06, 0.9, 0.06, post, x, 0.45, z, g); l.rotation.x = z > 0 ? 0.08 : -0.08; }
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.4, 1.06, 1, 1, 1), M.cloth[(tone + 2) % 6]); cloth.position.set(0, 0.76, 0.2); g.add(cloth);
  const goodsGroup = new THREE.Group(); goodsGroup.position.set(0, 0, 0.2); g.add(goodsGroup); goods(kind, goodsGroup, w - 0.4);
  // A hand-painted sign on the front beam.
  const palette = [['#3a4a36', '#f0e2bc'], ['#6a3a2a', '#f3e6cc'], ['#3a4652', '#efe4cc'], ['#5a4a38', '#f2e8d0']][tone % 4];   // weathered timber boards, cream lettering
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.7), new THREE.MeshStandardMaterial({ map: signTex(sign, ...palette), roughness: 0.8 }));
  board.position.set(0, 3.25, d / 2 + 0.25); g.add(board);
  box(0.06, 0.55, 0.06, post, -1.0, 2.95, d / 2 + 0.22, g); box(0.06, 0.55, 0.06, post, 1.0, 2.95, d / 2 + 0.22, g);
  // Fairy lights along the front edge of the roof (they glow at night).
  const bulbs = [];
  for (let i = 0; i <= 10; i++) { const x = -w / 2 - 0.2 + i * (w + 0.4) / 10, sag = Math.sin(i / 10 * Math.PI) * 0.12; bulbs.push(ball(0.04, M.bulb, x, 2.66 - sag, d / 2 + 0.5, g)); }
  // A potted fern and a woven rug out front.
  cyl(0.18, 0.13, 0.32, M.pot, w / 2 + 0.35, 0.16, d / 2 + 0.4, g, 10);
  for (let k = 0; k < 7; k++) { const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.6), M.leaf); fr.position.set(w / 2 + 0.35, 0.55, d / 2 + 0.4); fr.rotation.set(0.7, k / 7 * Math.PI * 2, 0); g.add(fr); }
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 1.4), M.hessian);                 // a hessian mat, not a bright rug rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.02, d / 2 + 1.1); g.add(rug);
  return g;
}
function parent0(o, g) { g.add(o); return o; }

// ---- A Queenslander ------------------------------------------------------------------------
// Raised on stumps, weatherboards, a pitched iron roof, a veranda across the
// front (facing +z) with posts, brackets and balusters, lattice, shuttered
// windows and hanging ferns.
export function queenslander(w, colour, shutters = '#2f6b5a') {
  mats();
  const g = new THREE.Group();
  // Shared by colour, so all the houses merge into a handful of draws.
  const shared = (key, make) => (M[key] = M[key] || make());
  const walls = shared('walls' + colour, () => new THREE.MeshStandardMaterial({ map: weatherboardTex(colour), roughness: 0.85 }));
  const trim = shared('trim', () => new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.7 }));
  const shut = shared('shut' + shutters, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(shutters), roughness: 0.75 }));
  const floorY = 1.2, wallH = 3.2, depth = 7, ver = 2.4;
  for (let x = -w / 2 + 0.3; x <= w / 2 - 0.3; x += 1.8) for (let z = -depth / 2; z <= depth / 2 + ver; z += 1.8) cyl(0.11, 0.13, floorY, M.timberDark, x, floorY / 2, z, g, 6);   // stumps
  const lattice = shared('lattice', () => new THREE.MeshStandardMaterial({ map: latticeTex(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  const lat = new THREE.Mesh(new THREE.PlaneGeometry(w, floorY - 0.1), lattice); lat.position.set(0, (floorY - 0.1) / 2, depth / 2 + ver - 0.05); g.add(lat);
  box(w + 0.2, 0.2, depth + ver + 0.2, M.timberLight, 0, floorY, ver / 2, g);                    // the floor and veranda deck
  box(w, wallH, depth, walls, 0, floorY + wallH / 2, 0, g);
  // Roof: two iron slopes over the house, and a skillion over the veranda.
  const pitch = 0.5, half = depth / 2 + 0.5, rise = Math.tan(pitch) * half;
  for (const s of [-1, 1]) { const r = box(w + 0.8, 0.05, half / Math.cos(pitch) + 0.1, M.iron, 0, floorY + wallH + rise / 2, s * half / 2, g); r.rotation.x = s * pitch; }
  const gable = new THREE.Shape(); gable.moveTo(-half, 0); gable.lineTo(half, 0); gable.lineTo(0, rise); gable.lineTo(-half, 0);
  for (const s of [-1, 1]) { const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), walls); gm.position.set(s * w / 2, floorY + wallH, 0); gm.rotation.y = Math.PI / 2; g.add(gm); }
  const sk = box(w + 0.8, 0.05, ver + 0.6, M.ironRusty, 0, floorY + wallH - 0.25, depth / 2 + ver / 2 + 0.1, g); sk.rotation.x = 0.12;
  // Veranda: posts with brackets, rail, balusters.
  const front = depth / 2 + ver;
  for (let x = -w / 2 + 0.15; x <= w / 2; x += w / Math.max(2, Math.round(w / 2.6))) {
    box(0.14, wallH - 0.3, 0.14, trim, x, floorY + (wallH - 0.3) / 2, front, g);
    for (const s of [-1, 1]) { const br = box(0.06, 0.5, 0.06, trim, x + s * 0.22, floorY + wallH - 0.6, front, g); br.rotation.z = s * 0.7; }
  }
  box(w, 0.08, 0.1, trim, 0, floorY + 1.0, front, g); box(w, 0.06, 0.08, trim, 0, floorY + 0.15, front, g);
  for (let x = -w / 2 + 0.1; x < w / 2; x += 0.16) box(0.04, 0.85, 0.04, trim, x, floorY + 0.58, front, g);
  // Windows: white frames, glowing glass, coloured shutters; a door in the middle.
  for (let x = -w / 2 + 1.4; x < w / 2 - 0.8; x += 2.6) {
    if (Math.abs(x) < 0.9) continue;
    box(1.1, 1.3, 0.06, M.glass, x, floorY + 1.7, depth / 2 + 0.02, g);
    box(1.25, 0.08, 0.1, trim, x, floorY + 2.4, depth / 2 + 0.05, g); box(1.25, 0.08, 0.1, trim, x, floorY + 1.0, depth / 2 + 0.05, g);
    for (const s of [-1, 1]) box(0.45, 1.35, 0.05, shut, x + s * 0.85, floorY + 1.7, depth / 2 + 0.06, g);
  }
  box(1.0, 2.2, 0.06, shut, 0, floorY + 1.1 + 0.05, depth / 2 + 0.03, g); box(1.15, 0.1, 0.1, trim, 0, floorY + 2.25, depth / 2 + 0.05, g);
  // Steps down to the street.
  for (let i = 0; i < 4; i++) box(1.6, 0.12, 0.35, M.timberLight, 0, floorY - 0.3 * i - 0.06, front + 0.3 + i * 0.32, g);
  // Hanging ferns in baskets along the veranda.
  for (let x = -w / 2 + 1.3; x < w / 2 - 0.5; x += 2.6) {
    cyl(0.005, 0.005, 0.5, M.rope, x, floorY + wallH - 0.8, front - 0.2, g, 4);
    cyl(0.2, 0.12, 0.2, M.hessian, x, floorY + wallH - 1.15, front - 0.2, g, 10);
    for (let k = 0; k < 8; k++) { const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.55), M.leaf); fr.position.set(x, floorY + wallH - 1.25, front - 0.2); fr.rotation.set(2.2, k / 8 * Math.PI * 2, 0); g.add(fr); }
  }
  return g;                     // the caller merges all the houses together (bakeStall)
}

// ---- Over the street: bunting, shade sails, fairy-light strings ---------------------------
export function overStreet(scene, half, z0, z1) {
  mats();
  const g = new THREE.Group(), bulbs = [];
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.16, 0, 0), new THREE.Vector3(0.16, 0, 0), new THREE.Vector3(0, -0.36, 0)]);
  flagGeo.setIndex([0, 1, 2]); flagGeo.computeVertexNormals();
  const flagMats = ['#e0583a', '#f2b02e', '#2fa36a', '#1f9c94', '#b0397a', '#f0e2c0'].map(c => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.9 }));
  for (let z = z0 + 8; z < z1; z += 9) {
    const kind = Math.round((z - z0) / 9) % 2;                      // bunting and fairy lights in turn
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, x = -half - 1.5 + u * (half * 2 + 3), y = 6.2 - Math.sin(u * Math.PI) * 0.7, zz = z + u * 2;
      if (kind === 0 && i < 24) { const f = new THREE.Mesh(flagGeo, flagMats[i % 6]); f.position.set(x, y, zz); g.add(f); }
      if (kind === 1) bulbs.push(ball(0.05, M.bulb, x, y - 0.1, zz, g));
    }
  }
  for (let z = z0 + 8; z < z1; z += 9) for (const s of [-1, 1]) cyl(0.06, 0.08, 6.8, M.timberDark, s * (half + 1.5), 3.4, z + (s > 0 ? 2 : 0), g, 6);   // poles that hold them up
  const baked = bake(g);
  scene.add(baked);
  return { group: baked };
}

// The fairy lights glow at night (0 day, 1 night).
export function setMarketNight(n) { if (M.bulb) { M.bulb.emissiveIntensity = 0.2 + 3.2 * n; } }

// ---- Ken's models: the empty canopy (stocked here) and the art hut ----------------------------
// A copy of a model, `height` metres tall, standing on the ground, centred,
// facing +z (the caller turns it).
export function placeModel(gltf, height) {
  const root = gltf.scene.clone(true);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), k = height / size.y;
  root.scale.setScalar(k);
  root.position.set(-(box.min.x + size.x / 2) * k, -box.min.y * k, -(box.min.z + size.z / 2) * k);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const g = new THREE.Group(); g.add(root);
  g.userData.size = new THREE.Vector3(size.x * k, size.y * k, size.z * k);
  return g;
}
// Ken's empty canopy, stocked with the vendor's things (Ken: "an empty canopy
// that we can add the vendor stuff"): a trestle table with a cloth piled with
// goods for its kind, cloths and chimes hanging at the back, a painted sign
// out front, a potted fern and a hessian mat. Returns the group.
export function stockedCanopy(gltf, kind, sign, tone = 0, height = 3.6) {
  mats();
  const g = placeModel(gltf, height), sz = g.userData.size;
  const w = Math.min(3.2, sz.x * 0.78), back = -sz.z / 2 + 0.3;
  const post = [M.timber, M.timberDark, M.timberLight][tone % 3];
  const stock = new THREE.Group();
  box(w, 0.06, 1.0, post, 0, 0.92, 0.1, stock);
  for (const x of [-(w - 0.3) / 2, (w - 0.3) / 2]) for (const z of [-0.3, 0.5]) box(0.06, 0.9, 0.06, post, x, 0.45, z, stock);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.4, 1.06), M.cloth[(tone + 2) % 6]); cloth.position.set(0, 0.76, 0.1); stock.add(cloth);
  const goodsGroup = new THREE.Group(); goodsGroup.position.set(0, 0, 0.1); stock.add(goodsGroup); goods(kind, goodsGroup, w - 0.2);
  // Hanging at the back: cloths, a dreamcatcher, chimes.
  const n = Math.max(2, Math.floor(w / 0.8));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.4 + i * (w - 0.8) / Math.max(1, n - 1);
    if (kind === 'clothes' || i % 2 === 0) hangingCloth(0.6, 1.0, (i + tone) % 3 ? M.cloth[(i + tone) % 6] : M.tie[(i + tone) % 4], x, 2.0, back, stock);
    else if (i % 4 === 1) dreamcatcher(x, 2.2, back + 0.05, stock); else windChime(x, 2.5, back + 0.1, stock);
  }
  cyl(0.18, 0.13, 0.32, M.pot, w / 2 + 0.25, 0.16, sz.z / 2 + 0.3, stock, 10);
  for (let k = 0; k < 7; k++) { const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.6), M.leaf); fr.position.set(w / 2 + 0.25, 0.55, sz.z / 2 + 0.3); fr.rotation.set(0.7, k / 7 * Math.PI * 2, 0); stock.add(fr); }
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, 1.2), M.hessian); mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.02, sz.z / 2 + 0.8); stock.add(mat);
  // The sign, on two posts in front.
  const palette = [['#3a4a36', '#f0e2bc'], ['#6a3a2a', '#f3e6cc'], ['#3a4652', '#efe4cc'], ['#5a4a38', '#f2e8d0']][tone % 4];
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.6), new THREE.MeshStandardMaterial({ map: signTex(sign, ...palette), roughness: 0.8 }));
  board.position.set(-w / 2 + 0.6, 1.55, sz.z / 2 + 0.9); stock.add(board);
  box(0.06, 1.3, 0.06, post, -w / 2 - 0.25, 0.65, sz.z / 2 + 0.88, stock); box(0.06, 1.3, 0.06, post, -w / 2 + 1.45, 0.65, sz.z / 2 + 0.88, stock);
  g.add(bake(stock));
  return g;
}

// ---- Plants (Ken: lots of plants on the verandas and all around) --------------------------------
// A cluster of potted tropical plants: ferns, palms, bromeliads, gingers with
// red flowers, a pink bougainvillea. Built from shapes, merged by the caller.
export function plantCluster(rnd, n = 4) {
  mats();
  const leaf = [M.leaf, M.leafLight || (M.leafLight = new THREE.MeshStandardMaterial({ color: 0x5ea83e, side: THREE.DoubleSide, roughness: 0.8 })), M.leafDark || (M.leafDark = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, side: THREE.DoubleSide, roughness: 0.8 }))];
  const flower = [0xe0303a, 0xff6aa8, 0xf2b02e, 0xd84ad0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  const pots = [M.pot, new THREE.MeshStandardMaterial({ color: 0x1f8a84, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0xe8a830, roughness: 0.5 })];
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * 1.6, z = (rnd() - 0.5) * 1.0, big = 0.7 + rnd() * 0.8, kind = Math.floor(rnd() * 4);
    cyl(0.2 * big, 0.14 * big, 0.36 * big, pots[i % 3], x, 0.18 * big, z, g, 10);
    const top = 0.36 * big;
    const fronds = kind === 1 ? 6 : 10;
    for (let k = 0; k < fronds; k++) {
      const a = k / fronds * Math.PI * 2 + rnd();
      const len = (kind === 1 ? 1.1 : kind === 2 ? 0.45 : 0.7) * big;
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(kind === 1 ? 0.22 : 0.14, len), leaf[(k + i) % 3]);
      fr.position.set(x + Math.cos(a) * len * 0.3, top + len * 0.4, z + Math.sin(a) * len * 0.3);
      fr.rotation.set(kind === 2 ? 0.25 : 0.6, -a, 0); g.add(fr);
    }
    if (kind === 2 || kind === 3) for (let k = 0; k < (kind === 3 ? 5 : 1); k++) {   // a bromeliad heart, or ginger and bougainvillea flowers
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.07 * big, 0.22 * big, 6), flower[(i + k) % 4]);
      f.position.set(x + (rnd() - 0.5) * 0.3 * big, top + 0.35 * big + rnd() * 0.3 * big, z + (rnd() - 0.5) * 0.3 * big); g.add(f);
    }
  }
  return g;
}
