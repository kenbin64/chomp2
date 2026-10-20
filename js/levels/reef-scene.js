// reef-scene.js
// The reef under the Esplanade, out past the boardwalk: a sandy seabed with
// light rippling across it, coral of several kinds, seagrass, schools of fish,
// drifting box jellyfish, clams holding pearls, and a rocky mound with the
// coral cave inside. The cave is a maze (reef-rules.js) with glowing spots on
// its walls, bubble vents to breathe at, the pirate chest at its far end, and
// a giant clam at the mouth that shuts behind Wally once he has the chest.
// Drawing only: what Wally may do is decided in esplanade.js with reef-rules.js.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SEABED_Y, SWIM_Y, WALL_TOP, LANES, TREASURES, wallBoxes, cellCentre, pearlCells, inMaze, mazePath, STARFISH_Y } from './reef-rules.js';
import { dressedJelly } from '../hazards.js';
import { mangoModel } from './esplanade-scene.js';
import { chestModel } from '../chest.js';

// Where things are, in metres. The cave maze's north-west corner is at
// (MAZE.ox, MAZE.oz) and its mouth faces east. East of it, the coral maze on the
// open reef (OUTER), in from the east and out on the west, straight across from
// the cave mouth. East of that, the dive spot by the end of Green Island's jetty.
export const MAZE = { ox: -96, oz: 402, size: 5, cols: 7, rows: 7 };
export const OUTER = { ox: -59, oz: 399.5, size: 8, cols: 6, rows: 5 };
export const DIVE = { x: -6, z: 419.5 };           // where he goes down, off the end of the jetty
export const BOUNDS = { x0: -104, x1: -1, z0: 368, z1: 472 };
export const CORAL_TOP = -4.2;                     // the coral maze's walls stop 4 m down, so the camera can look down into it;
                                                   // they still block him at every depth (too shallow to swim over)

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function canvasTexture(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  return t;
}

// Light coming through rippling water: a web of bright, wavy lines. Scrolled
// slowly across the seabed it looks like the real thing.
function causticPicture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const rnd = seeded(5);
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = rnd() * h, r = 14 + rnd() * 26;
      g.strokeStyle = `rgba(255,255,255,${0.25 + rnd() * 0.35})`; g.lineWidth = 1.5 + rnd() * 2.5;
      g.beginPath();
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * Math.PI * 2, rr = r * (0.75 + 0.25 * Math.sin(a * 3 + i));
        for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {   // tile seamlessly
          if (k === 0) g.moveTo(x + dx + Math.cos(a) * rr, y + dy + Math.sin(a) * rr); else g.lineTo(x + dx + Math.cos(a) * rr, y + dy + Math.sin(a) * rr);
        }
      }
      g.stroke();
    }
  }, 1);
}

function sandPicture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#b39f78'; g.fillRect(0, 0, w, h);
    const rnd = seeded(9);
    for (let i = 0; i < 5000; i++) {
      const v = 150 + rnd() * 80;
      g.fillStyle = `rgba(${v + 20},${v + 5},${v - 30},${0.35 + rnd() * 0.4})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    g.strokeStyle = 'rgba(120,100,70,0.18)'; g.lineWidth = 3;          // ripple marks
    for (let y = 8; y < h; y += 18) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 4); g.stroke(); }
  }, 22);
}

function rockPicture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#5d5a52'; g.fillRect(0, 0, w, h);
    const rnd = seeded(13);
    for (let i = 0; i < 2600; i++) {                                    // fine grit and pits
      const v = 55 + rnd() * 75;
      g.fillStyle = `rgba(${v},${v - 4},${v - 12},0.55)`;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, 0.6 + rnd() * 2.6, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 420; i++) {                                     // small crusts of pink coralline algae
      g.fillStyle = `rgba(${190 + rnd() * 50},${85 + rnd() * 60},${115 + rnd() * 60},0.4)`;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, 1 + rnd() * 2.8, 0, Math.PI * 2); g.fill();
    }
  }, 1);
}

// ---- Coral shapes. Each returns a geometry with a colour per vertex, so a
// whole reef of one kind merges into a single mesh.
const PALETTE = [0xff6f61, 0xff9f43, 0xffd166, 0xc77dff, 0x9b5de5, 0xf15bb5, 0x00bbf9, 0x06d6a0, 0xe76f51];

function coloured(geo, color) {
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function keepPosNorm(geo) {                       // so differently built pieces merge
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
  return geo.index ? geo.toNonIndexed() : geo;
}

// Staghorn: a branching bush of tapering limbs.
function staghorn(rnd, color) {
  const parts = [];
  const grow = (from, dir, len, rad, depth) => {
    const g = new THREE.CylinderGeometry(rad * 0.6, rad, len, 6, 1);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyQuaternion(q); g.translate(from.x, from.y, from.z);
    parts.push(keepPosNorm(g));
    const tip = from.clone().addScaledVector(dir, len);
    if (depth > 0) for (let i = 0; i < 2 + (rnd() < 0.4 ? 1 : 0); i++) {
      const nd = dir.clone().add(new THREE.Vector3(rnd() - 0.5, 0.4 + rnd() * 0.3, rnd() - 0.5).multiplyScalar(0.9)).normalize();
      grow(tip, nd, len * (0.65 + rnd() * 0.2), rad * 0.65, depth - 1);
    }
  };
  for (let i = 0; i < 3; i++) grow(new THREE.Vector3((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3), new THREE.Vector3(rnd() - 0.5, 1, rnd() - 0.5).normalize(), 0.55 + rnd() * 0.3, 0.09, 3);
  return coloured(mergeGeometries(parts), color);
}
// Brain coral: a rounded dome with deep winding grooves.
function brain(rnd, color) {
  // Welded first, so it shades smooth rather than as separate facets. (Detail 8,
  // about 1,600 triangles: the grooves still read at the size it is seen; 12 was 3,400.)
  const raw = new THREE.IcosahedronGeometry(1, 8); raw.deleteAttribute('normal'); raw.deleteAttribute('uv');
  const g = mergeVertices(raw), p = g.attributes.position, v = new THREE.Vector3(), s = rnd() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const groove = Math.sin(v.x * 9 + Math.sin(v.z * 6 + s) * 2) * Math.cos(v.z * 8 + v.y * 5) * 0.06;
    v.multiplyScalar(1 + groove); if (v.y < 0) v.y *= 0.2;
    p.setXYZ(i, v.x, v.y * 0.7, v.z);
  }
  g.computeVertexNormals();
  return coloured(keepPosNorm(g), color);
}
// Tube sponges: a cluster of open tubes.
function tubes(rnd, color) {
  const parts = [];
  for (let i = 0; i < 3 + Math.floor(rnd() * 4); i++) {
    const h = 0.5 + rnd() * 1.1, r = 0.1 + rnd() * 0.08;
    const g = new THREE.CylinderGeometry(r, r * 0.8, h, 10, 1, true);
    g.translate((rnd() - 0.5) * 0.5, h / 2, (rnd() - 0.5) * 0.5);
    parts.push(keepPosNorm(g));
  }
  return coloured(mergeGeometries(parts), color);
}
// Anemone: a tuft of soft tentacles.
function anemone(rnd, color) {
  const parts = [];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, tilt = 0.2 + rnd() * 0.7, len = 0.35 + rnd() * 0.25;
    const g = new THREE.ConeGeometry(0.03, len, 5); g.translate(0, len / 2, 0);
    g.rotateX(tilt); g.rotateY(a);
    parts.push(keepPosNorm(g));
  }
  const base = new THREE.CylinderGeometry(0.18, 0.22, 0.18, 10); base.translate(0, 0.05, 0);
  parts.push(keepPosNorm(base));
  return coloured(mergeGeometries(parts), color);
}

// A sea fan: a flat lattice, cut out by alphaTest.
function fanPicture() {
  const t = canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineCap = 'round';
    const rnd = seeded(3);
    const branch = (x, y, a, len, wid, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.lineWidth = wid; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      if (d > 0) { branch(x2, y2, a - 0.35 - rnd() * 0.2, len * 0.78, wid * 0.75, d - 1); branch(x2, y2, a + 0.35 + rnd() * 0.2, len * 0.78, wid * 0.75, d - 1); }
    };
    branch(w / 2, h, -Math.PI / 2, 60, 7, 6);
    g.lineWidth = 1.2; g.globalAlpha = 0.7;                             // the fine mesh between branches
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(w / 2, h, 40 + i * 5, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); }
  });
  t.repeat.set(1, 1);
  return t;
}

// ---- Clams and pearls ---------------------------------------------------------
const pearlMat = new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.12, metalness: 0, iridescence: 1, iridescenceIOR: 1.6, sheen: 0.6, sheenColor: new THREE.Color(0xffd6f0), emissive: 0x3a3048, emissiveIntensity: 0.6 });
const shellMat = new THREE.MeshStandardMaterial({ color: 0xd9b8c4, roughness: 0.55 });
function shellGeometry(r) {
  // A scalloped half-shell: a lathed bowl with ridges round the rim.
  const pts = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r, -Math.cos(a) * r * 0.45 + r * 0.45)); }
  const g = new THREE.LatheGeometry(pts, 28), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x); const k = 1 + 0.06 * Math.cos(a * 12); p.setXYZ(i, v.x * k, v.y, v.z * k); }
  g.computeVertexNormals();
  return g;
}
const smallShell = shellGeometry(0.42);
export function clamWithPearl() {
  const g = new THREE.Group();
  const bottom = new THREE.Mesh(smallShell, shellMat);
  const top = new THREE.Mesh(smallShell, shellMat); top.rotation.set(Math.PI - 0.95, 0, 0); top.position.set(0, 0.05, -0.36);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), pearlMat); pearl.position.y = 0.16;
  g.add(bottom, top, pearl);
  g.userData.pearl = pearl;
  return g;
}

// ---- Bubble vents ---------------------------------------------------------------
function vent(x, z, inCave) {
  const g = new THREE.Group();
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 0.9, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x3c3a36, roughness: 0.9, side: THREE.DoubleSide }));
  chimney.position.y = 0.45; g.add(chimney);
  const count = 46, bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6),
    // Plain see-through, not glass (transmission): on bubbles this small they look the
    // same, and glass made the renderer draw the whole reef again behind them every frame.
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 0, emissive: 0x6fdcff, emissiveIntensity: 0.3 }), count);
  bubbles.userData.seeds = Array.from({ length: count }, (_, i) => ({ t: i / count, x: (Math.random() - 0.5) * 0.5, z: (Math.random() - 0.5) * 0.5, s: 0.6 + Math.random() * 0.9 }));
  g.add(bubbles);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 7, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x9feeff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glow.position.y = 3.5; g.add(glow);
  g.position.set(x, SEABED_Y, z);
  const height = (inCave ? WALL_TOP : 0) - SEABED_Y;                  // bubbles rise to the cave roof, or the surface
  const m = new THREE.Matrix4();
  return {
    group: g, x, z, r: 1.9,
    update(dt) {
      bubbles.userData.seeds.forEach((b, i) => {
        b.t = (b.t + dt * 0.18 * b.s) % 1;
        const y = 0.9 + b.t * height, wob = Math.sin(b.t * 30 + i) * 0.15;
        m.makeScale(b.s, b.s, b.s).setPosition(b.x + wob, y, b.z);
        bubbles.setMatrixAt(i, m);
      });
      bubbles.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---- The Skyrail pass, in the pirate chest -------------------------------------------
function passModel() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#ffd166'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#1f6f5c'; g.fillRect(0, 0, 256, 44);
  g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('SKYRAIL', 128, 33);
  g.fillStyle = '#102030'; g.font = 'bold 40px sans-serif'; g.fillText('PASS', 128, 100); g.font = '20px sans-serif'; g.fillText('Kuranda', 128, 138);
  const face = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), emissive: 0x332200, emissiveIntensity: 0.4 }), edge = new THREE.MeshStandardMaterial({ color: 0xffd166 });
  return new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.02), [edge, edge, edge, edge, face, face]);
}

// ---- The giant clam, in a dead end of the coral maze ----------------------------------
// Ken's Meshy model, its two shells apart so the top can open and shut on its
// hinge (models/clam-top.glb, clam-bottom.glb); the shape built here if they are
// missing. set(openness): 0 shut, 1 open as modelled.
export function buildGiantClam(topGltf, bottomGltf, width = 3.4) {
  if (!topGltf || !bottomGltf) {
    const c = giantClam(); c.group.scale.setScalar(width / 5.4);
    return c;
  }
  const g = new THREE.Group(), body = new THREE.Group(), hinge = new THREE.Group();
  const top = topGltf.scene.clone(true), bottom = bottomGltf.scene.clone(true);
  const tb = new THREE.Box3().setFromObject(top), bb = new THREE.Box3().setFromObject(bottom);
  // The hinge: where the shells meet at the back (the top shell's far edge in +z).
  const at = new THREE.Vector3(0, (tb.min.y + bb.max.y) / 2, tb.max.z);
  hinge.position.copy(at); top.position.sub(at); hinge.add(top);
  body.add(bottom, hinge);
  const all = new THREE.Box3().setFromObject(body), s = width / Math.max(all.max.x - all.min.x, all.max.z - all.min.z);
  body.scale.setScalar(s); body.position.y = -all.min.y * s;
  body.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(body);
  let openness = 1;
  return { group: g, get openness() { return openness; }, set(o) { openness = o; hinge.rotation.x = -(1 - o) * 0.5; } };
}

// ---- The giant clam (the shape built in code, when Ken's model is missing) -------------
function giantClam() {
  const R = 2.7, g = new THREE.Group();
  const big = shellGeometry(R);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc9a6b8, roughness: 0.5 });
  const lip = new THREE.MeshStandardMaterial({ color: 0x5b3c8c, roughness: 0.4, emissive: 0x2a1250, emissiveIntensity: 0.5 });
  // Two half-shells standing in the gap, hinged at the floor. A shell's bowl
  // opens along +y as built; turned a quarter about z it opens sideways, so the
  // left half (side -1) opens toward +x and the right toward -x, and their rims
  // meet in the middle of the gap. Opening tips each half outward to the floor.
  const halves = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    const shell = new THREE.Mesh(big, mat);
    shell.rotation.z = side * Math.PI / 2;
    shell.position.set(side * 0.45 * R, R, 0);
    shell.castShadow = true;
    pivot.add(shell); g.add(pivot);
    return { pivot, side };
  });
  // The purple mantle showing between the rims when it is shut.
  const mantle = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, 0.18, 8, 40), lip);
  mantle.rotation.y = Math.PI / 2; mantle.position.y = R;
  g.add(mantle);
  let openness = 1;
  return {
    group: g,
    // 1: wide open, both halves lying on the floor; 0: shut, blocking the gap.
    set(o) {
      openness = o;
      for (const h of halves) h.pivot.rotation.z = -h.side * o * 1.35;
      mantle.visible = o < 0.5;
    },
    get openness() { return openness; },
  };
}

// ---- Fish ------------------------------------------------------------------------------
function fishSchool(rnd, centre, count, colour, radius, depth) {
  const body = new THREE.SphereGeometry(0.22, 10, 8); body.scale(0.5, 0.75, 1.3);
  const tail = new THREE.ConeGeometry(0.16, 0.3, 4); tail.rotateX(-Math.PI / 2); tail.translate(0, 0, -0.38);
  const geo = mergeGeometries([keepPosNorm(body), keepPosNorm(tail)]);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.4, metalness: 0.2 }), count);
  const fish = Array.from({ length: count }, () => ({ a: rnd() * Math.PI * 2, r: radius * (0.7 + rnd() * 0.6), y: depth + (rnd() - 0.5) * 2, s: 0.25 + rnd() * 0.1 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  return {
    mesh,
    update(t, dt) {
      fish.forEach((f, i) => {
        f.a += f.s * dt;
        p.set(centre.x + Math.cos(f.a) * f.r, f.y + Math.sin(t * 2 + i) * 0.15, centre.z + Math.sin(f.a) * f.r);
        q.setFromEuler(e.set(0, -f.a, Math.sin(t * 9 + i) * 0.15));        // swimming round the circle, tails flicking
        mesh.setMatrixAt(i, m.compose(p, q, one));
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---- Build it ------------------------------------------------------------------------------
// ---- Reef treasures (Ken: things to collect at different depths) -----------------
// A soft glow behind each, so it can be spotted through the water.
let glowTex = null;
function glowSprite(color, size) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.setScalar(size); return sp;
}
function starfish() {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.17 : 0.42; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
  geo.center();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xff7a3d, roughness: 0.55, emissive: 0x4a1400, emissiveIntensity: 0.6 }));
}
function cowrie() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 18), new THREE.MeshStandardMaterial({ color: 0xf3e2c4, roughness: 0.18, metalness: 0.05, emissive: 0x2a2010, emissiveIntensity: 0.5 }));
  body.scale.set(0.8, 0.55, 1.25);
  const spots = new THREE.Mesh(new THREE.SphereGeometry(0.302, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshStandardMaterial({ color: 0x9a5a32, roughness: 0.2 }));
  spots.scale.copy(body.scale);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.62), new THREE.MeshStandardMaterial({ color: 0x5a3018 }));
  slit.position.y = -0.165;
  g.add(body, spots, slit); return g;
}
// A conch: a spiral shell turned on a lathe, with a pink flared lip.
function conch() {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(0.02 + 0.3 * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - 0.35 * t), -0.32 + t * 0.62)); }
  const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), new THREE.MeshStandardMaterial({ color: 0xf2d2b0, roughness: 0.45 }));
  const g = new THREE.Group(); g.add(shell);
  for (let i = 0; i < 5; i++) {                                       // the spiral ridges
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27 - i * 0.045, 0.025, 6, 20), new THREE.MeshStandardMaterial({ color: 0xd9a77a, roughness: 0.5 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.12 + i * 0.09; g.add(ring);
  }
  const lip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xf2a0a8, roughness: 0.35, side: THREE.DoubleSide }));
  lip.position.set(0.12, -0.05, 0); lip.rotation.y = Math.PI / 2; lip.scale.set(1, 1.4, 0.5); g.add(lip);
  g.rotation.z = 1.2;
  return g;
}
const GLOW = { starfish: 0xff9a5a, shell: 0xfff0d0, conch: 0xffc8a0 };
// spots: [{ kind, x, z }]. Returns [{ kind, x, y, z, mesh, taken }].
// Ken's seashell model (models/seashell.glb), when present, for the shells.
function kensShell(gltf) {
  const m = gltf.scene.clone(true);
  const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  m.scale.multiplyScalar(0.6 / Math.max(size.x, size.y, size.z));
  const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()); m.position.sub(c);
  const g = new THREE.Group(); g.add(m); return g;
}
export function buildTreasures(root, shellGltf, spots) {
  return spots.map(({ kind, x, z }) => {
    const g = new THREE.Group();
    const thing = kind === 'starfish' ? starfish() : kind === 'shell' ? (shellGltf ? kensShell(shellGltf) : cowrie()) : conch();
    g.add(glowSprite(GLOW[kind], 1.6), thing);
    // Starfish lie flat on the seabed; shells float at their depths as before.
    const rests = kind === 'starfish';
    const y = rests ? STARFISH_Y : LANES[TREASURES[kind].lane];
    if (rests) thing.rotation.x = -Math.PI / 2;
    g.position.set(x, y, z); root.add(g);
    return { kind, x, y, z, mesh: g, thing, rests, taken: false, touched: false, phase: Math.random() * 6 };
  });
}

export function buildReef(scene, quality, { maze, outer, jellyGltf = null, coralGltf = null }) {
  const rnd = seeded(77);
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const { ox, oz, size } = MAZE;
  const caveW = maze.cols * size, caveD = maze.rows * size;
  const inOuter = (x, z, margin = 0) => inMaze(outer, x, z, OUTER.ox, OUTER.oz, OUTER.size, margin);
  // Open reef only: not the cave, not the coral maze, not where he dives in.
  const inCaveArea = (x, z, margin = 2) => inMaze(maze, x, z, ox, oz, size, margin) || inOuter(x, z, margin);

  // Light under the water: cool and from above.
  const lights = new THREE.Group();
  lights.add(new THREE.HemisphereLight(0x7fd6ff, 0x0a3340, 0.9));
  const down = new THREE.DirectionalLight(0xc8f6ff, 1.3); down.position.set(-50, 60, 420); down.target.position.set(-55, SEABED_Y, 420);
  lights.add(down, down.target);
  root.add(lights);

  // The seabed.
  const caustics = causticPicture(); caustics.repeat.set(14, 14);
  const bedGeo = new THREE.PlaneGeometry(BOUNDS.x1 - BOUNDS.x0 + 60, BOUNDS.z1 - BOUNDS.z0 + 60, 80, 80);
  bedGeo.rotateX(-Math.PI / 2);
  { const p = bedGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(p.getX(i) * 0.13) * Math.cos(p.getZ(i) * 0.11) * 0.5 + Math.sin(p.getX(i) * 0.41 + p.getZ(i) * 0.3) * 0.15); bedGeo.computeVertexNormals(); }
  const bed = new THREE.Mesh(bedGeo, new THREE.MeshStandardMaterial({ map: sandPicture(), roughness: 1, emissive: 0x7fe4ff, emissiveMap: caustics, emissiveIntensity: 0.22 }));
  bed.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, SEABED_Y, (BOUNDS.z0 + BOUNDS.z1) / 2);
  bed.receiveShadow = true;
  root.add(bed);

  // The underside of the surface, shimmering, seen from below.
  const surfMap = causticPicture(); surfMap.repeat.set(10, 10);
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x9ff2ff, map: surfMap, transparent: true, opacity: 0.75, side: THREE.DoubleSide, fog: false, depthWrite: false }));
  surface.rotation.x = Math.PI / 2; surface.position.set(-55, -0.08, 420);
  root.add(surface);

  // Shafts of sunlight slanting down through the water.
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0xd6fbff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const shafts = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(1.5 + rnd() * 2, 3 + rnd() * 3, 14, 12, 1, true), shaftMat);
    s.position.set(BOUNDS.x0 + 10 + rnd() * (BOUNDS.x1 - BOUNDS.x0 - 20), -6, BOUNDS.z0 + 10 + rnd() * (BOUNDS.z1 - BOUNDS.z0 - 20));
    s.rotation.z = 0.25; s.userData.phase = rnd() * 6;
    if (!inCaveArea(s.position.x, s.position.z, 4)) { root.add(s); shafts.push(s); }
  }

  // Coral, seagrass and rocks over the open reef (not in the cave, not where he dives in).
  const spots = [];
  const many = quality.name === 'high' ? 1 : quality.name === 'medium' ? 0.7 : 0.4;
  for (let tries = 0; spots.length < 230 * many && tries < 4000; tries++) {
    const x = BOUNDS.x0 + rnd() * (BOUNDS.x1 - BOUNDS.x0), z = BOUNDS.z0 + rnd() * (BOUNDS.z1 - BOUNDS.z0);
    if (inCaveArea(x, z, 3) || Math.hypot(x - DIVE.x, z - DIVE.z) < 5) continue;
    spots.push({ x, z });
  }
  const kinds = { staghorn: [], brain: [], tubes: [], anemone: [] };
  const fans = [];
  for (const s of spots) {
    const pick = rnd(), colour = PALETTE[Math.floor(rnd() * PALETTE.length)], scale = 0.8 + rnd() * 1.4;
    let geo, list;
    if (pick < 0.3) { geo = staghorn(rnd, colour); list = kinds.staghorn; }
    else if (pick < 0.5) { geo = brain(rnd, colour); list = kinds.brain; }
    else if (pick < 0.68) { geo = tubes(rnd, colour); list = kinds.tubes; }
    else if (pick < 0.86) { geo = anemone(rnd, colour); list = kinds.anemone; }
    else { fans.push({ ...s, colour, scale }); continue; }
    geo.scale(scale, scale, scale); geo.rotateY(rnd() * Math.PI * 2); geo.translate(s.x, SEABED_Y, s.z);
    list.push(geo);
  }
  const coralMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  for (const list of Object.values(kinds)) if (list.length) { const m = new THREE.Mesh(mergeGeometries(list), coralMat); m.castShadow = true; m.receiveShadow = true; root.add(m); }
  const fanTex = fanPicture();
  for (const f of fans) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * f.scale, 1.6 * f.scale), new THREE.MeshStandardMaterial({ color: f.colour, alphaMap: fanTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }));
    m.position.set(f.x, SEABED_Y + 0.8 * f.scale, f.z); m.rotation.y = rnd() * Math.PI;
    root.add(m);
  }
  // Seagrass: blades in patches, swaying in the swell.
  const blade = new THREE.PlaneGeometry(0.08, 1, 1, 4); blade.translate(0, 0.5, 0);
  const grassCount = Math.round(900 * many);
  const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: 0x3f9b55, side: THREE.DoubleSide, roughness: 0.8 }), grassCount);
  const sway = { value: 0 };
  grass.material.onBeforeCompile = sh => {
    sh.uniforms.swayTime = sway;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float swayTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5;
        transformed.x += sin(swayTime * 1.3 + ph) * 0.35 * position.y * position.y;`);
  };
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    let n = 0;
    for (let patch = 0; patch < 40 && n < grassCount; patch++) {
      const cx = BOUNDS.x0 + rnd() * (BOUNDS.x1 - BOUNDS.x0), cz = BOUNDS.z0 + rnd() * (BOUNDS.z1 - BOUNDS.z0);
      if (inCaveArea(cx, cz, 4)) continue;
      for (let k = 0; k < 24 && n < grassCount; k++) {
        p.set(cx + (rnd() - 0.5) * 4, SEABED_Y, cz + (rnd() - 0.5) * 4);
        grass.setMatrixAt(n++, m.compose(p, q.setFromEuler(e.set(0, rnd() * Math.PI, 0)), s.set(1, 0.8 + rnd() * 1.2, 1)));
      }
    }
    grass.count = n; }
  root.add(grass);

  // Fish.
  const schools = [
    fishSchool(rnd, { x: -40, z: 395 }, 22, 0xffd23f, 6, -6),
    fishSchool(rnd, { x: -30, z: 450 }, 18, 0x3fa7ff, 5, -7.5),
    fishSchool(rnd, { x: -55, z: 385 }, 16, 0xff7b54, 4, -5),
  ];
  for (const s of schools) root.add(s.mesh);

  // The coral maze on the open reef: walls of reef rock crusted in coral, from the
  // seabed to just under the surface, so the way through has to be found.
  const outerBoxes = wallBoxes(outer, OUTER.ox, OUTER.oz, OUTER.size, 1.8);
  { const h = CORAL_TOP - SEABED_Y;
    const geos = outerBoxes.map(b => { const g = new THREE.BoxGeometry(b.x1 - b.x0, h, b.z1 - b.z0, 3, 5, 3); g.translate((b.x0 + b.x1) / 2, SEABED_Y + h / 2, (b.z0 + b.z1) / 2); return keepPosNorm(g); });
    const g = mergeGeometries(geos), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + Math.sin(y * 1.7 + z * 0.8) * 0.3, y, z + Math.sin(y * 1.9 + x * 0.7) * 0.3); }
    g.computeVertexNormals();
    const nrm = g.attributes.normal, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
      const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
      uv[i * 2] = u * 0.4; uv[i * 2 + 1] = v * 0.4;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const walls = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: rockPicture(), roughness: 0.9, color: 0xc9b8c0 }));
    walls.castShadow = true; walls.receiveShadow = true; root.add(walls);
    // Coral all over them: along the tops (seen from the surface) and up the sides.
    const crust = [];
    for (const b of outerBoxes) {
      const len = Math.max(b.x1 - b.x0, b.z1 - b.z0), along = (b.x1 - b.x0) >= (b.z1 - b.z0);
      for (let i = 0; i < Math.floor(len / 1.3); i++) {
        const t = (i + rnd()) / Math.floor(len / 1.3), x = b.x0 + (b.x1 - b.x0) * t, z = b.z0 + (b.z1 - b.z0) * t;
        const kind = [staghorn, brain, tubes, anemone][Math.floor(rnd() * 4)];
        const top = kind(rnd, PALETTE[Math.floor(rnd() * PALETTE.length)]); const s1 = 0.5 + rnd() * 0.5;
        top.scale(s1, s1, s1); top.translate(x, CORAL_TOP - 0.15, z); crust.push(top);
        for (const side of [-1, 1]) {                                   // a growth on each face, part way up
          if (rnd() < 0.45) continue;
          const g2 = (rnd() < 0.5 ? brain : tubes)(rnd, PALETTE[Math.floor(rnd() * PALETTE.length)]); const s2 = 0.35 + rnd() * 0.4;
          g2.scale(s2, s2, s2);
          const off = side * 1.0;
          g2.translate(along ? x : x + off, SEABED_Y + 1 + rnd() * (h - 2), along ? z + off : z); crust.push(g2);
        }
      }
    }
    if (crust.length) root.add(new THREE.Mesh(mergeGeometries(crust), coralMat)); }

  // The cave: a coral maze walled in rock, with a roof over it.
  const rock = new THREE.MeshStandardMaterial({ map: rockPicture(), roughness: 0.95 });
  const boxes = wallBoxes(maze, ox, oz, size);
  const wallH = WALL_TOP - SEABED_Y;
  const wallGeos = boxes.map(b => { const g = new THREE.BoxGeometry(b.x1 - b.x0, wallH, b.z1 - b.z0, 2, 3, 2); g.translate((b.x0 + b.x1) / 2, SEABED_Y + wallH / 2, (b.z0 + b.z1) / 2); return keepPosNorm(g); });
  { const g = mergeGeometries(wallGeos), p = g.attributes.position;             // knobbly, not machined
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + Math.sin(y * 2 + z) * 0.12, y, z + Math.sin(y * 2.3 + x) * 0.12); }
    g.computeVertexNormals();
    // Rock needs texture coordinates: each face takes the picture from the way it
    // faces (sides along x or z, tops from above), so nothing is smeared.
    const nrm = g.attributes.normal, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
      const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
      uv[i * 2] = u * 0.4; uv[i * 2 + 1] = v * 0.4;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const walls = new THREE.Mesh(g, rock); walls.castShadow = true; walls.receiveShadow = true; root.add(walls); }
  // Coral along the wall tops, so it reads as a coral maze from above.
  { const tops = [];
    for (const b of boxes) {
      const len = Math.max(b.x1 - b.x0, b.z1 - b.z0), n = Math.floor(len / 1.6);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = b.x0 + (b.x1 - b.x0) * t, z = b.z0 + (b.z1 - b.z0) * t;
        const g = rnd() < 0.5 ? brain(rnd, PALETTE[Math.floor(rnd() * PALETTE.length)]) : staghorn(rnd, PALETTE[Math.floor(rnd() * PALETTE.length)]);
        const s = 0.45 + rnd() * 0.4; g.scale(s, s, s); g.translate(x, WALL_TOP - 0.1, z); tops.push(g);
      }
    }
    if (tops.length) root.add(new THREE.Mesh(mergeGeometries(tops), coralMat)); }
  // Glowing spots on the walls: the only light deep in the cave.
  { const glowDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.4, 2.2, 2.6) }), boxes.length * 3);
    const m = new THREE.Matrix4(); let n = 0;
    for (const b of boxes) for (let k = 0; k < 3; k++) {
      const side = rnd() < 0.5;
      const x = side ? b.x0 + rnd() * (b.x1 - b.x0) : (rnd() < 0.5 ? b.x0 - 0.05 : b.x1 + 0.05);
      const z = side ? (rnd() < 0.5 ? b.z0 - 0.05 : b.z1 + 0.05) : b.z0 + rnd() * (b.z1 - b.z0);
      glowDots.setMatrixAt(n++, m.makeTranslation(x, SEABED_Y + 0.6 + rnd() * (wallH - 1.2), z));
      if (rnd() < 0.3) glowDots.setColorAt(n - 1, new THREE.Color().setRGB(2.0, 0.6, 2.4));
    }
    glowDots.count = n; root.add(glowDots); }
  // The roof: a slab of reef rock over the maze, shown only from outside.
  const roof = new THREE.Group();
  { const g = new THREE.PlaneGeometry(caveW + 6, caveD + 6, 40, 40); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const edge = Math.min(1, (Math.min(caveW / 2 + 3 - Math.abs(x), caveD / 2 + 3 - Math.abs(z))) / 4); p.setY(i, edge * (1.6 + Math.sin(x * 0.3) * Math.cos(z * 0.27) * 1.0) - (1 - edge) * 1.5); }
    g.computeVertexNormals();
    const top = new THREE.Mesh(g, rock); top.position.set(ox + caveW / 2, WALL_TOP, oz + caveD / 2); top.castShadow = true; top.receiveShadow = true;
    roof.add(top);
    const roofCoral = [];
    for (let i = 0; i < 60 * many; i++) {
      const x = ox - 2 + rnd() * (caveW + 4), z = oz - 2 + rnd() * (caveD + 4);
      const geo = [staghorn, brain, tubes, anemone][Math.floor(rnd() * 4)](rnd, PALETTE[Math.floor(rnd() * PALETTE.length)]);
      const s = 0.7 + rnd(); geo.scale(s, s, s); geo.translate(x, WALL_TOP + 1.6, z); roofCoral.push(geo);
    }
    roof.add(new THREE.Mesh(mergeGeometries(roofCoral), coralMat)); }
  root.add(roof);

  // Pearls: in clams across the open reef, and in the cave (reef-rules pearlCells).
  const pearls = [];
  const addPearl = (x, z, inCave) => {
    const c = clamWithPearl(); c.position.set(x, SEABED_Y + 0.05, z); c.rotation.y = rnd() * Math.PI * 2; c.scale.setScalar(1.3);
    root.add(c); pearls.push({ x, z, mesh: c, taken: false, inCave });
  };
  for (const cell of pearlCells(outer, 4)) { const p = cellCentre(outer, cell, OUTER.ox, OUTER.oz, OUTER.size); addPearl(p.x, p.z, false); }
  for (let tries = 0, n = 0; n < 5 && tries < 400; tries++) {
    const x = BOUNDS.x0 + 8 + rnd() * (BOUNDS.x1 - BOUNDS.x0 - 16), z = BOUNDS.z0 + 8 + rnd() * (BOUNDS.z1 - BOUNDS.z0 - 16);
    if (inCaveArea(x, z, 4) || Math.hypot(x - DIVE.x, z - DIVE.z) < 6) continue;
    addPearl(x, z, false); n++;
  }
  for (const cell of pearlCells(maze, 6)) { const p = cellCentre(maze, cell, ox, oz, size); addPearl(p.x, p.z, true); }

  // Bubble vents (Ken: more air tunnels): in the cave, one on the way to the
  // chest every few steps and a couple off in side passages; in the coral maze,
  // one every few cells along the way through.
  const ventCellsIn = [];
  const cpath = mazePath(maze, maze.entrance, maze.chest);
  for (let k = 3; k < cpath.length - 1; k += 4) ventCellsIn.push(cpath[k]);
  const onPath = new Set(cpath.map(c => c.c + ',' + c.r));
  const side = [];
  for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) if (!onPath.has(c + ',' + r) && maze.dist[r * maze.cols + c] >= 4) side.push({ c, r });
  for (let k = 0; k < Math.min(2, side.length); k++) ventCellsIn.push(side[Math.floor((k + 0.5) * side.length / 2)]);
  const route = mazePath(outer, outer.entrance, outer.exit);
  const outerVents = route.filter((_, k) => k > 0 && k % 4 === 2).map(c => cellCentre(outer, c, OUTER.ox, OUTER.oz, OUTER.size));
  const vents = [...outerVents.map(p => vent(p.x, p.z, false)), ...ventCellsIn.map(c => { const p = cellCentre(maze, c, ox, oz, size); return vent(p.x, p.z, true); })];
  for (const v of vents) root.add(v.group);

  // The chest, a fair way in (reef-rules CHEST_DEPTH).
  const chest = chestModel(passModel());              // the pirate chest holds the Skyrail pass (Ken, 2026-10-18)
  const cp = cellCentre(maze, maze.chest, ox, oz, size);
  chest.group.position.set(cp.x, SEABED_Y, cp.z);
  root.add(chest.group);

  // The cave mouth. (The giant clam is in the coral maze now: buildGiantClam.)
  const mouth = { x: ox + caveW, z: oz + (maze.entrance.r + 0.5) * size };
  // An arch of coral over the mouth, so the way in can be seen from afar.
  { const arch = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.7, 10, 24, Math.PI), rock); arch.rotation.y = Math.PI / 2; arch.position.set(mouth.x + 0.4, SEABED_Y, mouth.z); root.add(arch); }

  // Box jellyfish drifting over the open reef.
  const jellies = [];
  for (let i = 0; i < 9; i++) {
    let x, z;
    if (i < 6) {                                                       // six in the coral maze's corridors
      const c = { c: Math.floor(rnd() * outer.cols), r: Math.floor(rnd() * outer.rows) }, p = cellCentre(outer, c, OUTER.ox, OUTER.oz, OUTER.size);
      x = p.x; z = p.z;
    } else do { x = BOUNDS.x0 + 10 + rnd() * (BOUNDS.x1 - BOUNDS.x0 - 20); z = BOUNDS.z0 + 10 + rnd() * (BOUNDS.z1 - BOUNDS.z0 - 20); } while (inCaveArea(x, z, 4) || Math.hypot(x - DIVE.x, z - DIVE.z) < 10);
    const m = dressedJelly(jellyGltf); root.add(m);
    // Each drifts slowly up and down through the three swimming depths (Ken: dodge them).
    jellies.push({ m, x, z, y: SWIM_Y, phase: rnd() * 6, rise: 0.25 + rnd() * 0.2, cool: 0, inMaze: i < 6 });
  }

  // Ken's coral (models/coral.glb), when present: clumps growing along the tops
  // of the coral maze's walls and round the open reef, each turned and sized
  // differently. One draw per part of the model, however many clumps.
  if (coralGltf) {
    const spots = [];
    let cseed = 97; const crnd = () => ((cseed = (cseed * 16807) % 2147483647) / 2147483647);
    for (const b of outerBoxes) {
      const len = Math.hypot(b.x1 - b.x0, b.z1 - b.z0);
      for (let k = 0; k < Math.max(1, Math.round(len / 4)); k++) {
        if (crnd() < 0.35) continue;
        const t = (k + 0.5) / Math.max(1, Math.round(len / 4));
        spots.push([b.x0 + (b.x1 - b.x0) * t, CORAL_TOP - 0.2, b.z0 + (b.z1 - b.z0) * t, 1.6 + crnd() * 1.6]);
      }
    }
    for (let k = 0; k < (quality.name === 'low' ? 10 : 30); k++) {
      const x = BOUNDS.x0 + 8 + crnd() * (BOUNDS.x1 - BOUNDS.x0 - 16), z = BOUNDS.z0 + 8 + crnd() * (BOUNDS.z1 - BOUNDS.z0 - 16);
      if (inCaveArea(x, z, 6) || Math.hypot(x - DIVE.x, z - DIVE.z) < 8 || inMaze(outer, x, z, OUTER.ox, OUTER.oz, OUTER.size, 2)) continue;
      spots.push([x, SEABED_Y, z, 2.2 + crnd() * 2.5]);
    }
    const src = coralGltf.scene.clone(true);
    src.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3());
    const norm = new THREE.Matrix4().makeScale(1 / size.y, 1 / size.y, 1 / size.y)
      .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    src.traverse(o => {
      if (!o.isMesh) return;
      const inst = new THREE.InstancedMesh(o.geometry, o.material, spots.length);
      spots.forEach(([x, y, z, h], i) => {
        q.setFromAxisAngle(up, crnd() * Math.PI * 2);
        inst.setMatrixAt(i, m.compose(p.set(x, y, z), q, sc.setScalar(h)).multiply(norm).multiply(o.matrixWorld));
      });
      inst.castShadow = true; inst.receiveShadow = true;
      root.add(inst);
    });
  }

  return {
    root, roof, pearls, vents, jellies, mouth, boxes, outerBoxes,
    chest: { ...chest, x: cp.x, z: cp.z, opened: false, open: 0 },
    update(t, dt) {
      caustics.offset.set(t * 0.02, t * 0.013); surfMap.offset.set(-t * 0.015, t * 0.02);
      sway.value = t;
      for (const s of schools) s.update(t, dt);
      for (const v of vents) v.update(dt);
      for (const s of shafts) shaftMat.opacity = 0.06 + Math.sin(t * 0.7 + s.userData.phase) * 0.015;
      for (const p of pearls) if (!p.taken) p.mesh.userData.pearl.position.y = 0.16 + Math.sin(t * 2 + p.x) * 0.03;
      for (const j of jellies) {
        j.phase += dt;
        const drift = j.inMaze ? 1.0 : 2.5;                            // in a corridor it keeps clear of the coral walls
        const depth = (LANES[0] + LANES[2]) / 2 + Math.sin(j.phase * j.rise) * (LANES[0] - LANES[2]) / 2 * 1.1;
        j.m.position.set(j.x + Math.sin(j.phase * 0.3) * drift, depth + Math.sin(j.phase * 1.2) * 0.2, j.z + Math.cos(j.phase * 0.25) * drift);
        const pulse = Math.sin(j.phase * 3) * 0.5 + 0.5;
        j.m.scale.set(1 + pulse * 0.08, 1 - pulse * 0.08, 1 + pulse * 0.08);
      }
      const c = this.chest;
      if (c.opened && c.open < 1) { c.open = Math.min(1, c.open + dt * 1.5); c.lid.rotation.x = -c.open * 1.9; c.glow.intensity = c.open * 6; }
      if (c.mango.visible) { c.mango.rotation.y += dt * 2; c.mango.position.y = 1.4 + Math.sin(t * 2) * 0.15; }
    },
  };
}
