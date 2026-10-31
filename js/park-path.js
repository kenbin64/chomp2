// park-path.js
// The visitors' side of the croc fence (Ken, 2026-10-29): a paved path all the
// way round the park, where the people stand and stroll, and food kiosks on its
// outer edge facing the crocs, as at a real croc park. The path's shape is in
// rules.js (PATH, fencePoint) so the people, lamps and trees all agree on it.

import * as THREE from 'three';
import { BANK_Y, BOARDWALK, PATH, fencePoint, STAND, kioskSpots, fenceRuns } from './rules.js';
export { kioskSpots };
import { OUTER, EXIT, EXIT_ANGLE, EXIT_HALF, PENS, penShape } from './chase-rules.js';
import { addSolid } from './ground.js';
import { buildShop } from './shops.js';

// Warm pavers (Ken, 2026-10-30: it has to read as a path from inside the croc fence, and the dark asphalt did not).
function paverTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rows = 8, wide = 64, high = 256 / rows;
  g.fillStyle = '#a58a64'; g.fillRect(0, 0, 256, 256);                 // the sand between them
  const tones = ['#e2c698', '#d8b98a', '#e8d0a6', '#cfae80', '#dcbf92'];
  for (let r = 0; r < rows; r++) for (let i = -1; i < 5; i++) {
    g.fillStyle = tones[Math.floor(Math.random() * tones.length)];
    g.fillRect(i * wide + (r % 2) * wide / 2 + 2, r * high + 2, wide - 4, high - 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// A strip round the fence from o0 to o1 metres out. It stops where the boardwalk comes down over it, so the two
// never overlap.
function ring(o0, o1, y, material) {
  const steps = 360, pos = [], uv = [], index = [];
  let run = 0, last = null;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2, p = fencePoint(a, o0), q = fencePoint(a, o1);
    if (last) run += Math.hypot(p.x - last.x, p.z - last.z);
    last = p;
    pos.push(p.x, y, p.z, q.x, y, q.z);
    uv.push(run / 2, 0, run / 2, (o1 - o0) / 2);                       // the pavers repeat every 2 m
  }
  const underDeck = (x, z) => Math.abs(z - BOARDWALK.z) < BOARDWALK.width / 2 + 0.2 && Math.abs(x) < BOARDWALK.x1;
  for (let i = 0; i < steps; i++) {
    const k = i * 2, mx = (pos[k * 3] + pos[(k + 3) * 3]) / 2, mz = (pos[k * 3 + 2] + pos[(k + 3) * 3 + 2]) / 2;
    if (underDeck(mx, mz)) continue;
    index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}
export function addVisitorPath(scene) {
  const side = THREE.DoubleSide, kerb = new THREE.MeshStandardMaterial({ color: 0xbfb296, roughness: 0.9, side });
  scene.add(ring(PATH.inner, PATH.outer, BANK_Y + 0.03, new THREE.MeshStandardMaterial({ map: paverTexture(), color: 0xb0a48f, roughness: 0.95, side })   /* (shaded down: pale stone blooms to white in the sun) */));
  scene.add(ring(PATH.inner - 0.22, PATH.inner, BANK_Y + 0.05, kerb), ring(PATH.outer, PATH.outer + 0.22, BANK_Y + 0.05, kerb));
}

// ---- Shared painted surfaces ---------------------------------------------

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// Plywood: pale pine with long faint grain lines and the odd knot.
function plywood(g, w, h) {
  g.fillStyle = '#c9a877'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * h;
    g.strokeStyle = `rgba(120,85,45,${0.08 + Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 2;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 12, w * 0.7, y + (Math.random() - 0.5) * 12, w, y + (Math.random() - 0.5) * 8); g.stroke();
  }
  for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(110,70,35,0.35)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 6, 3, 0, 0, Math.PI * 2); g.fill(); }
}
// The sign: painted by hand straight onto a plywood board. width: canvas pixels, wider for a longer board
// (the way-out board is 4.6 m long; at 512 its words did not fit and were cut off).
function signTexture(text, ink, width = 512) {
  return canvasTex(width, 128, (g, w, h) => {
    plywood(g, w, h);
    let size = 70;
    do { g.font = `900 ${size}px Impact, 'Arial Black', sans-serif`; size -= 4; } while (g.measureText(text).width > w - 36 && size > 20);
    g.save(); g.translate(w / 2, h / 2 + 4); g.rotate(-0.02);                        // not quite level
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 0);
    g.restore();
  });
}

function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

// The shops (shops.js), each facing the crocs and solid to Wally.
export function addKiosks(scene, models) {
  for (const s of kioskSpots()) {
    const k = buildShop(s.kind, models);
    k.position.set(s.x, BANK_Y, s.z); k.rotation.y = s.rot;
    scene.add(k);
    for (const i of [-1, 0, 1]) addSolid(s.x + Math.cos(s.rot) * i * STAND.w / 3, s.z - Math.sin(s.rot) * i * STAND.w / 3, STAND.d / 2);
    if (s.kind === 'oven') addSolid(s.x + Math.cos(s.rot) * 2.45, s.z - Math.sin(s.rot) * 2.45, 0.9);   // its brick oven, out to one side
  }
}

// ---- Fences ----------------------------------------------------------------
// Chain-link, as in Ken's photos of real croc parks: dark steel posts, a top rail and a bottom wire,
// and wire mesh between that you see straight through. pts: Vector3s along the ground; closed: a ring.
function meshTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#2e3236'; g.lineWidth = 3;                     // two sets of diagonals
  for (let i = -64; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
// Bark: dark brown with long lines of grain and the odd knot, along the log.
function barkTexture() {
  const t = canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = '#4a3a24'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w, v = Math.random() < 0.5 ? 'rgba(30,22,12,' : 'rgba(120,98,66,';
      g.strokeStyle = v + (0.2 + Math.random() * 0.4) + ')'; g.lineWidth = 1 + Math.random() * 2.5;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (Math.random() - 0.5) * 16, h * 0.3, x + (Math.random() - 0.5) * 16, h * 0.7, x, h); g.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      g.fillStyle = 'rgba(28,20,10,0.75)'; g.beginPath(); g.ellipse(x, y, 7, 11, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(130,105,70,0.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 11, 16, 0, 0, Math.PI * 2); g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// The fence, drawn from code in the style of Ken's fence module (2026-10-30: his model's wires and logs did not
// survive being made light enough to repeat round the park): log posts with galvanised collars and base
// plates, a log rail top and bottom, and see-through chain-link between. pts: along the ground, one run.
let fenceParts = null;
function parts() {
  if (fenceParts) return fenceParts;
  const bark = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa8adb0, roughness: 0.45, metalness: 0.7 });
  const wire = new THREE.MeshStandardMaterial({ map: meshTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 });
  return fenceParts = { bark, steel, wire,
    post: new THREE.CylinderGeometry(0.085, 0.095, 1, 10), collar: new THREE.CylinderGeometry(0.1, 0.1, 1, 10),
    plate: new THREE.BoxGeometry(0.34, 0.025, 0.34), log: new THREE.CylinderGeometry(0.065, 0.07, 1, 8) };
}
export function logFence(scene, pts, height) {
  const P = parts(), lowY = height * 0.17, topY = height * 0.91, base = BANK_Y;
  for (const p of pts) {
    const post = mesh(P.post, P.bark, p.x, base + height / 2, p.z, scene); post.scale.y = height;
    const low = mesh(P.collar, P.steel, p.x, base + 0.07, p.z, scene); low.scale.y = 0.14;
    const cap = mesh(P.collar, P.steel, p.x, base + height - 0.05, p.z, scene); cap.scale.y = 0.1;
    mesh(P.plate, P.steel, p.x, base + 0.012, p.z, scene);
  }
  const pos = [], uv = [], index = [];
  let run = 0;
  pts.forEach((p, i) => {
    if (i) {
      const q = pts[i - 1], len = Math.hypot(p.x - q.x, p.z - q.z), mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, h = Math.atan2(p.x - q.x, p.z - q.z);
      for (const y of [lowY, topY]) {
        const log = mesh(P.log, P.bark, mx, base + y, mz, scene);
        log.scale.y = len; log.rotation.set(Math.PI / 2, 0, 0); log.rotation.order = 'YXZ'; log.rotation.y = h;
      }
      run += len;
    }
    // The wire: one ribbon along the run, from log to log.
    pos.push(p.x, base + lowY, p.z, p.x, base + topY, p.z);
    uv.push(run / 0.4, 0, run / 0.4, (topY - lowY) / 0.4);          // one diamond every 10 cm
    if (i) { const k = i * 2; index.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index); geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, P.wire));
}

// The park's outer fence, 2 m high, with the gap at the way out to the cane fields (chase-rules.js).
export function addOuterFence(scene) {
  const half = EXIT_HALF / Math.hypot(OUTER.rx * Math.sin(EXIT_ANGLE), OUTER.rz * Math.cos(EXIT_ANGLE));
  const atExit = p => Math.abs(Math.atan2(Math.sin(p.a - EXIT_ANGLE), Math.cos(p.a - EXIT_ANGLE))) < half;
  for (const run of fenceRuns(OUTER.rx, OUTER.rz, atExit, 3)) logFence(scene, run, 2.0);
}

// ---- The keepers' pens -----------------------------------------------------
// Shade-cloth yards on timber posts, open at both ends: Wally can run through, and nobody sees through.
export function addPens(scene) {
  const cloth = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.95, side: THREE.DoubleSide });
  const timber = new THREE.MeshStandardMaterial({ color: 0x7a5c3c, roughness: 0.9 });
  const post = new THREE.CylinderGeometry(0.06, 0.07, 1.9, 8);
  for (const pen of PENS) {
    for (const w of penShape(pen).walls) {
      const len = Math.hypot(w.bx - w.ax, w.bz - w.az), mx = (w.ax + w.bx) / 2, mz = (w.az + w.bz) / 2;
      const wall = mesh(new THREE.PlaneGeometry(len, 1.75), cloth, mx, BANK_Y + 0.95, mz, scene);
      wall.rotation.y = Math.atan2(w.bx - w.ax, w.bz - w.az) + Math.PI / 2;   // the plane's width runs along the wall
      const posts = Math.ceil(len / 1.8);
      for (let i = 0; i <= posts; i++) mesh(post, timber, w.ax + (w.bx - w.ax) * i / posts, BANK_Y + 0.95, w.az + (w.bz - w.az) * i / posts, scene);
      for (let d = 0; d <= len; d += 0.45) addSolid(w.ax + (w.bx - w.ax) * d / len, w.az + (w.bz - w.az) * d / len, 0.12);   // solid to Wally
    }
  }
}

// ---- The way out -----------------------------------------------------------
// Two tall timber posts and a hand-painted board at the gap, a block of cane beyond, and smoke from the
// cane fires rising past it, so the way out can be seen from across the park. Returns the smoke's update.
function smokeTexture() {
  return canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    // Dark: pale grey smoke vanished against the sky (screenshot from the boardwalk, 2026-10-30).
    r.addColorStop(0, 'rgba(70,64,58,0.95)'); r.addColorStop(0.55, 'rgba(85,80,74,0.55)'); r.addColorStop(1, 'rgba(95,90,85,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
}
export function addExit(scene) {
  const out = { x: Math.cos(EXIT_ANGLE), z: Math.sin(EXIT_ANGLE) };
  const along = { x: -Math.sin(EXIT_ANGLE) * OUTER.rx, z: Math.cos(EXIT_ANGLE) * OUTER.rz }, an = Math.hypot(along.x, along.z);
  const ux = along.x / an, uz = along.z / an;                      // along the fence at the gate
  const timber = new THREE.MeshStandardMaterial({ color: 0x6e5134, roughness: 0.9 });
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.2, 3.0, 0.2), timber, EXIT.x + ux * s * (EXIT_HALF + 0.1), BANK_Y + 1.5, EXIT.z + uz * s * (EXIT_HALF + 0.1), scene);
  const board = mesh(new THREE.PlaneGeometry(EXIT_HALF * 2 + 0.6, 0.7), new THREE.MeshStandardMaterial({ map: signTexture('NO ENTRY · CANE FIRES', '#9a2a1e', 1024), roughness: 0.9, side: THREE.DoubleSide }), EXIT.x, BANK_Y + 2.7, EXIT.z, scene);
  board.rotation.y = Math.atan2(ux, uz) + Math.PI / 2;            // spanning the gap
  // The cane: a block of tall stalks out past the gate.
  const cane = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.035, 3.2, 5), new THREE.MeshStandardMaterial({ color: 0x9fae4a, roughness: 0.8 }), 900);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 900; i++) {
    const across = (Math.random() - 0.5) * 30, deep = 3 + Math.random() * 18;
    q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15));
    m.compose(new THREE.Vector3(EXIT.x + out.x * deep + ux * across, BANK_Y + 1.6, EXIT.z + out.z * deep + uz * across), q, one);
    cane.setMatrixAt(i, m);
  }
  cane.castShadow = true; scene.add(cane);
  // The smoke: columns of soft puffs that rise, spread and fade, then start again at the bottom.
  const tex = smokeTexture(), puffs = [];
  for (let c = 0; c < 3; c++) {
    const bx = EXIT.x + out.x * (26 + c * 9) + ux * (c - 1) * 14, bz = EXIT.z + out.z * (26 + c * 9) + uz * (c - 1) * 14;
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.userData = { bx, bz, t: i / 16 };
      scene.add(s); puffs.push(s);
    }
  }
  return dt => {
    for (const s of puffs) {
      const u = s.userData; u.t = (u.t + dt * 0.05) % 1;              // about 20 s from the ground to the top
      s.position.set(u.bx + u.t * 10, BANK_Y + 2 + u.t * 45, u.bz + u.t * 4);   // leaning with the breeze
      s.scale.setScalar(6 + u.t * 22);
      s.material.opacity = Math.min(1, u.t * 8) * (1 - u.t * 0.8);
    }
  };
}
