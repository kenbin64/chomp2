// sections-draw.js
// Drawing the chase's sections (park-sections.js has where everything is): iron walls and signed gates, the Reptile
// House and its snake pit, the Service Yard's crates and ute, the Food Court's tables.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addSolid, removeSolids, addPlatform } from './ground.js';
import { EXIT, EXIT_ANGLE, EXIT_HALF, OUTER } from './chase-rules.js';
import { BANK_Y } from './rules.js';
import { ironWalls, gates, placed, lowWalls, REPTILE, PIT, CRATES, UTE, TABLES, WALL_H, LOW_H, BAR_H, wallSolids, dressingSolids, gateBarSolids, allBoxes } from './park-sections.js';

function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function add(parent, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
const std = o => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });

// Corrugated iron, upright ribs, streaked with rust.
const ironTex = (base, rust) => tex(256, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) { const x = i * w / 14, s = g.createLinearGradient(x, 0, x + w / 14, 0); s.addColorStop(0, 'rgba(0,0,0,0.38)'); s.addColorStop(0.5, 'rgba(255,255,255,0.2)'); s.addColorStop(1, 'rgba(0,0,0,0.38)'); g.fillStyle = s; g.fillRect(x, 0, w / 14, h); }
  for (let i = 0; i < 26; i++) { const x = rnd(0, w), y = rnd(0, h * 0.5); const s = g.createLinearGradient(0, y, 0, y + 110); s.addColorStop(0, `rgba(${rust},0.5)`); s.addColorStop(1, `rgba(${rust},0)`); g.fillStyle = s; g.fillRect(x, y, rnd(3, 9), 110); }
});
const stoneTex = () => tex(256, 128, (g, w, h) => { g.fillStyle = '#5e5a50'; g.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) for (let i = -1; i < 7; i++) { const v = rnd(120, 165) | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 18})`; g.fillRect(i * 44 + (r % 2) * 22 + 2, r * 32 + 2, 40, 28); } }, [2, 1]);
function signTex(text, ink, board) {
  return tex(768, 150, (g, w, h) => {
    g.fillStyle = board; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(30,20,10,${rnd(0.08, 0.3)})`; g.lineWidth = rnd(0.5, 2); const x = rnd(0, w), y = rnd(0, h); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(30, 170), y + rnd(-2, 2)); g.stroke(); }
    let size = 104;
    do { g.font = `900 ${size}px Impact, 'Arial Black', sans-serif`; size -= 4; } while (g.measureText(text).width > w - 50 && size > 24);
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  });
}

function walls(scene) {
  const mats = [std({ map: ironTex('#7f8a86', '120,62,28'), metalness: 0.35, roughness: 0.6 }), std({ map: ironTex('#8d8373', '120,62,28'), metalness: 0.3, roughness: 0.65 })];
  const postMat = std({ color: 0x4a3a28 }), panel = new THREE.BoxGeometry(1, 1, 1), post = new THREE.CylinderGeometry(0.07, 0.08, WALL_H + 0.2, 8);
  for (const s of ironWalls()) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), n = Math.max(1, Math.round(len / 2.4)), rot = Math.atan2(s.bx - s.ax, s.bz - s.az);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, b = add(scene, panel, mats[i % 2], s.ax + (s.bx - s.ax) * t, BANK_Y + WALL_H / 2, s.az + (s.bz - s.az) * t);
      b.scale.set(0.05, WALL_H, len / n + 0.02); b.rotation.y = rot;
    }
    for (let i = 0; i <= n; i++) add(scene, post, postMat, s.ax + (s.bx - s.ax) * i / n, BANK_Y + (WALL_H + 0.2) / 2, s.az + (s.bz - s.az) * i / n);
  }
}
// Each gate: two posts and a beam, with the name of what is ahead painted on each face.
function gateSigns(scene) {
  const timber = std({ color: 0x5a4028 }), cache = new Map();
  const faceMat = t => { if (!cache.has(t)) cache.set(t, std({ map: signTex(t, '#2c2013', '#c2a878') })); return cache.get(t); };
  const postG = new THREE.BoxGeometry(0.16, 3.4, 0.16);
  for (const g of gates()) {
    const ux = Math.cos(g.a) * 0 + (g.x - 0), len = Math.hypot(g.x, g.z); void ux; void len;
    // Across the gate runs from the croc fence out: found from its two ends.
    const out = { x: Math.cos(g.a), z: Math.sin(g.a) }, wide = g.wide;
    const rx = out.x / 28, rz = out.z / 18, n = Math.hypot(rx, rz), nx = rx / n, nz = rz / n;
    for (const s of [-1, 1]) add(scene, postG, timber, g.x + nx * s * wide / 2, BANK_Y + 1.7, g.z + nz * s * wide / 2);
    const rot = Math.atan2(nz, -nx) + Math.PI / 2;      // the board's length along the gate
    const beam = add(scene, new THREE.BoxGeometry(wide + 0.3, 0.55, 0.08), timber, g.x, BANK_Y + 3.05, g.z); beam.rotation.y = Math.atan2(-nz, nx);
    void rot;
    // +t: the way the angle grows; a board reads toward whoever is coming along that way.
    const tx = -nz, tz = nx;
    g.ahead.forEach((text, k) => {
      const side = k === 0 ? -1 : 1;                    // ahead[0] is read travelling +t, so it faces -t
      const m = add(scene, new THREE.PlaneGeometry(wide + 0.25, 0.5), faceMat(text), g.x + tx * side * 0.05, BANK_Y + 3.05, g.z + tz * side * 0.05);
      m.rotation.y = Math.atan2(tx * side, tz * side); m.castShadow = false;
    });
  }
}
function reptileHouse(scene) {
  const p = placed(REPTILE.deg, REPTILE.out), g = new THREE.Group(); g.position.set(p.x, BANK_Y, p.z); g.rotation.y = p.rot;
  // Local x runs across the path's line, z along it (penShape's way): w across, d along; the door faces the path.
  const { w, d, h } = REPTILE;
  add(g, new THREE.BoxGeometry(d, h, w), std({ map: tex(256, 256, (c, tw, th) => { c.fillStyle = '#4f6b4a'; c.fillRect(0, 0, tw, th); for (let i = 0; i < 16; i++) { c.fillStyle = `rgba(0,0,0,${0.08 + (i % 2) * 0.14})`; c.fillRect(i * tw / 16, 0, tw / 16, th); } c.fillStyle = 'rgba(20,30,15,0.3)'; for (let i = 0; i < 80; i++) c.fillRect(rnd(0, tw), rnd(0, th), 2, rnd(8, 40)); }, [3, 1]) }), 0, h / 2, 0);
  const roof = add(g, new THREE.BoxGeometry(d + 0.9, 0.12, w + 0.9), std({ map: ironTex('#6d6a62', '120,62,28'), metalness: 0.3, roughness: 0.6 }), 0, h + 0.1, 0); roof.rotation.z = 0.05;
  // A wide sign and dark doors on the path side.
  const sideOut = -1;   // toward the croc fence, in local x
  const sign = add(g, new THREE.PlaneGeometry(w * 0.8, 1), std({ map: signTex('REPTILE HOUSE', '#e8dcb8', '#2f4a2c') }), sideOut * (d / 2 + 0.03), h - 0.6, 0);
  sign.rotation.y = -Math.PI / 2;
  for (const s of [-1, 1]) { const door = add(g, new THREE.PlaneGeometry(1.2, 2), std({ color: 0x1b1712 }), sideOut * (d / 2 + 0.02), 1, s * 1.6); door.rotation.y = -Math.PI / 2; }
  scene.add(g);
}
function snakePit(scene) {
  const p = placed(PIT.deg, PIT.out), g = new THREE.Group(); g.position.set(p.x, BANK_Y, p.z); g.rotation.y = p.rot;
  add(g, new THREE.BoxGeometry(PIT.d, 0.06, PIT.w), std({ color: 0x9a8a5c, roughness: 1 }), 0, 0.03, 0);
  const snake = [0x3e5a2a, 0xa88a2c, 0x5a3a20];
  for (let i = 0; i < 5; i++) { const t = add(g, new THREE.TorusGeometry(rnd(0.16, 0.3), 0.04, 6, 16, rnd(4, 6)), std({ color: snake[i % 3], roughness: 0.4 }), rnd(-1, 1), 0.1, rnd(-1.5, 1.5)); t.rotation.x = Math.PI / 2; t.rotation.z = rnd(0, 6); }
  scene.add(g);
}
function lows(scene) {
  const stone = std({ map: stoneTex(), roughness: 0.95 }), unit = new THREE.BoxGeometry(1, 1, 1);
  for (const s of lowWalls()) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az), b = add(scene, unit, stone, (s.ax + s.bx) / 2, BANK_Y + LOW_H / 2, (s.az + s.bz) / 2);
    b.scale.set(0.34, LOW_H, len + 0.3); b.rotation.y = Math.atan2(s.bx - s.ax, s.bz - s.az);
  }
}
// The stacks of boxes to climb: painted, so they read as things to play on.
function boxStacks(scene) {
  const paint = ['#d9633f', '#3f9fb0', '#e0a830'].map(c => std({ map: tex(256, 256, (g, w, h) => {
    g.fillStyle = c; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(40,25,10,0.55)'; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 12; g.beginPath(); g.moveTo(16, 16); g.lineTo(w - 16, h - 16); g.stroke();
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${rnd(0.02, 0.1)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(10, 60), 2); }
  }) }));
  for (const b of allBoxes()) {
    const m = add(scene, new THREE.BoxGeometry(b.d, b.top, b.w), paint[Math.round(b.top) % 3], b.x, BANK_Y + b.top / 2, b.z); m.rotation.y = b.rot;
    addPlatform(b.x, b.z, b.w * 0.72, BANK_Y + b.top);
  }
}
function serviceYard(scene) {
  const wood = std({ map: tex(256, 256, (g, w, h) => { g.fillStyle = '#9a7b4e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(0,0,0,${rnd(0.03, 0.14)})`; g.fillRect(0, i * h / 5, w, h / 5); g.fillStyle = 'rgba(30,20,10,0.8)'; g.fillRect(0, i * h / 5, w, 3); } g.strokeStyle = '#5c4426'; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16); g.beginPath(); g.moveTo(10, 10); g.lineTo(w - 10, h - 10); g.stroke(); }) });
  for (const c of CRATES) { const p = placed(c.deg, c.out), b = add(scene, new THREE.BoxGeometry(c.d, c.h, c.w), wood, p.x, BANK_Y + c.h / 2, p.z); b.rotation.y = p.rot; }
  const p = placed(UTE.deg, UTE.out), g = new THREE.Group(); g.position.set(p.x, BANK_Y, p.z); g.rotation.y = p.rot;
  const white = std({ color: 0xe8e6de, roughness: 0.4, metalness: 0.25 }), dark = std({ color: 0x1a1c1e, roughness: 0.3 }), tyre = std({ color: 0x151515, roughness: 0.95 }), tray = std({ color: 0x6e6e6a, roughness: 0.6, metalness: 0.4 });
  add(g, new THREE.BoxGeometry(1.8, 0.55, 4.6), white, 0, 0.72, 0);                         // the body
  add(g, new THREE.BoxGeometry(1.7, 0.72, 1.9), white, 0, 1.33, 0.55);                      // the cab
  add(g, new THREE.BoxGeometry(1.5, 0.5, 1.92), dark, 0, 1.4, 0.56);                        // its windows
  add(g, new THREE.BoxGeometry(1.8, 0.4, 1.9), tray, 0, 1.15, -1.3);                        // the tray
  for (const [x, z] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]]) { const w = add(g, new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14), tyre, x, 0.36, z); w.rotation.z = Math.PI / 2; }
  scene.add(g);
}
function foodCourtTables(scene) {
  const top = std({ color: 0x8a6a45 }), leg = std({ color: 0x4a3a28 }), brollys = [0xb53a2e, 0x2f6b44, 0xd8b84a].map(c => std({ color: c, side: THREE.DoubleSide }));
  TABLES.forEach((t, i) => {
    const p = placed(t.deg, t.out), g = new THREE.Group(); g.position.set(p.x, BANK_Y, p.z); g.rotation.y = i * 0.7;
    add(g, new THREE.BoxGeometry(1.5, 0.06, 0.8), top, 0, 0.76, 0);
    for (const s of [-1, 1]) { add(g, new THREE.BoxGeometry(1.5, 0.05, 0.28), top, 0, 0.46, s * 0.62); add(g, new THREE.BoxGeometry(0.08, 0.72, 1.3), leg, s * 0.55, 0.38, 0); }
    add(g, new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), leg, 0, 1.1, 0);
    add(g, new THREE.ConeGeometry(1.25, 0.42, 12, 1, true), brollys[i % 3], 0, 2.25, 0);
    scene.add(g);
  });
}

// scene gets the grounds' dressing; walled the iron walls and gates, which only come up when he breaks out.
export function addSections(scene, walled) {
  walls(walled); gateSigns(walled); reptileHouse(scene); snakePit(scene); lows(scene); serviceYard(scene); foodCourtTables(scene); boxStacks(scene);
  for (const s of dressingSolids()) addSolid(s.x, s.z, s.r, s.top);
}
// The bars across each gate, painted and signed with the mangoes it takes (Ken, 2026-10-30: the more mangoes the more
// gates open). set(n) drops those he now has enough for into the ground, and says how many just opened.
export function addGateBars(scene) {
  const paint = std({ color: 0xe8a020, roughness: 0.5 }), list = [];
  const signMat = cache => need => { if (!cache.has(need)) cache.set(need, std({ map: tex(256, 128, (g, w, h) => { g.fillStyle = '#c23a1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff6dc'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = "900 62px Impact, 'Arial Black', sans-serif"; g.fillText(`${need}`, w / 2, 44); g.font = "900 32px Impact, 'Arial Black', sans-serif"; g.fillText('MANGOES', w / 2, 98); }) })); return cache.get(need); };
  const sign = signMat(new Map());
  for (const g of gates()) {
    const out = { x: Math.cos(g.a), z: Math.sin(g.a) }, rx = out.x / 28, rz = out.z / 18, n = Math.hypot(rx, rz), nx = rx / n, nz = rz / n;
    const parts = [], count = Math.max(4, Math.round(g.wide / 0.5));
    for (let i = 0; i <= count; i++) { const b = new THREE.BoxGeometry(0.09, BAR_H, 0.09); b.translate((i / count - 0.5) * g.wide, BAR_H / 2, 0); parts.push(b); }
    for (const y of [0.35, BAR_H - 0.08]) { const b = new THREE.BoxGeometry(g.wide, 0.12, 0.1); b.translate(0, y, 0); parts.push(b); }
    const group = new THREE.Group();
    group.position.set(g.x, BANK_Y, g.z); group.rotation.y = Math.atan2(-nz, nx);
    const bars = new THREE.Mesh(mergeGeometries(parts), paint); bars.castShadow = true; group.add(bars);
    parts.forEach(p => p.dispose());
    for (const side of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), sign(g.need)); s.position.set(0, 0.85, side * 0.07); if (side < 0) s.rotation.y = Math.PI; group.add(s); }
    scene.add(group);
    list.push({ g, group, solids: null, sink: 0, open: false });
  }
  const shut = e => { e.open = false; e.sink = 0; e.group.position.y = BANK_Y; e.group.visible = true; if (!e.solids) e.solids = gateBarSolids(e.g).map(s => { const a = addSolid(s.x, s.z, s.r, s.top); a.keeper = true; return a; }); };
  const open = e => { e.open = true; if (e.solids) { removeSolids(e.solids); e.solids = null; } };
  return {
    // The park has locked down. on false: a new run, all gone.
    lockdown(on) { for (const e of list) { if (on) { if (!e.solids && !e.open) shut(e); e.group.visible = !e.open; } else { open(e); e.open = false; e.sink = 0; e.group.position.y = BANK_Y; e.group.visible = false; } } },
    set(mangoes) { let opened = 0; for (const e of list) if (!e.open && mangoes >= e.g.need) { open(e); opened++; } return opened; },
    update(dt) { for (const e of list) if (e.open && e.group.visible) { e.sink += dt * 2.5; e.group.position.y = BANK_Y - e.sink; if (e.sink > BAR_H + 0.3) e.group.visible = false; } },
    list,
  };
}

// The final gate to the cane field, across the way out: shut until the wrangler unlocks it (Ken, 2026-10-30).
export function addFinalGate(scene) {
  const along = { x: -Math.sin(EXIT_ANGLE) * OUTER.rx, z: Math.cos(EXIT_ANGLE) * OUTER.rz }, an = Math.hypot(along.x, along.z), wide = EXIT_HALF * 2;
  const parts = [], count = 8;
  for (let i = 0; i <= count; i++) { const b = new THREE.BoxGeometry(0.1, 2.4, 0.1); b.translate((i / count - 0.5) * wide, 1.2, 0); parts.push(b); }
  for (const y of [0.5, 2.15]) { const b = new THREE.BoxGeometry(wide, 0.13, 0.11); b.translate(0, y, 0); parts.push(b); }
  const g = new THREE.Group(); g.position.set(EXIT.x, BANK_Y, EXIT.z); g.rotation.y = Math.atan2(-along.z / an, along.x / an); g.visible = false;
  const bars = new THREE.Mesh(mergeGeometries(parts), std({ color: 0xe8a020, roughness: 0.5 })); bars.castShadow = true; g.add(bars);
  parts.forEach(p => p.dispose());
  const lock = std({ map: tex(256, 128, (c, w, h) => { c.fillStyle = '#c23a1c'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff6dc'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = "900 54px Impact, 'Arial Black', sans-serif"; c.fillText('LOCKED', w / 2, h / 2); }) });
  for (const side of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), lock); s.position.set(0, 1.35, side * 0.08); if (side < 0) s.rotation.y = Math.PI; g.add(s); }
  scene.add(g);
  let sink = 0, open = false;
  return {
    show() { g.visible = true; open = false; sink = 0; g.position.y = BANK_Y; },
    hide() { g.visible = false; open = false; },
    open() { open = true; },
    update(dt) { if (open && g.visible) { sink += dt * 1.6; g.position.y = BANK_Y - sink; if (sink > 2.8) g.visible = false; } },
  };
}

// The walls as things to run into, once they are up.
let standing = null;
export function setWallSolids(on) {
  if (on && !standing) standing = wallSolids().map(s => addSolid(s.x, s.z, s.r, s.top));
  else if (!on && standing) { removeSolids(standing); standing = null; }
}
