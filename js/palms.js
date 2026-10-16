// palms.js
// Coconut palms that read as real trees: one smooth trunk that tapers and
// curves, ringed bark, and a crown of arching fronds made of dozens of
// leaflets, folded into a shallow V the way real fronds are, with coconuts
// under the crown. Each frond is a curved strip with a painted leaflet cut-out,
// so a whole crown is one mesh and one draw.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- The frond picture --------------------------------------------------

// A pinnate frond drawn on a canvas: a midrib up the centre and leaflets
// angled toward the tip, longest in the middle. The background is clear, so
// alphaTest cuts the strip into separate leaflets.
let frondTexture = null;
function frondPicture() {
  if (frondTexture) return frondTexture;
  const W = 256, H = 1024, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const greens = ['#3f8f2f', '#4f9f35', '#5aa83a', '#3a8030', '#67b23f'];
  const n = 46;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);                                   // 0 at the base, 1 at the tip
    const y = H * (0.97 - t * 0.93);
    const len = W * 0.5 * Math.sin(Math.PI * (0.12 + t * 0.85)) * (0.9 + 0.1 * Math.sin(i * 7.3));
    for (const side of [-1, 1]) {
      const x0 = W / 2, x1 = W / 2 + side * len, y1 = y - len * 0.55;    // leaflets sweep toward the tip
      const grad = g.createLinearGradient(x0, y, x1, y1);
      const base = greens[(i * 3 + (side > 0 ? 1 : 0)) % greens.length];
      grad.addColorStop(0, '#2f6e25'); grad.addColorStop(0.25, base); grad.addColorStop(1, '#8cc455');
      g.strokeStyle = grad;
      g.lineCap = 'round';
      g.lineWidth = 9 + 5 * Math.sin(Math.PI * t);
      g.beginPath();
      g.moveTo(x0, y);
      g.quadraticCurveTo(x0 + side * len * 0.5, y - len * 0.15, x1, y1);
      g.stroke();
    }
  }
  g.strokeStyle = '#8a7a3e'; g.lineWidth = 7;                // the midrib, pale and woody
  g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, H * 0.03); g.stroke();
  frondTexture = new THREE.CanvasTexture(c);
  frondTexture.colorSpace = THREE.SRGBColorSpace;
  frondTexture.anisotropy = 8;
  return frondTexture;
}

// ---- Shapes -------------------------------------------------------------

// One frond as a strip: length along +y before bending. It arches out and
// droops toward the tip, and the two halves fold up into a shallow V.
function frondGeometry(length, width, droop) {
  const geo = new THREE.PlaneGeometry(width, length, 4, 18);
  geo.translate(0, length / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = y / length;
    // After the frond is tipped out from the trunk, its local +z points down and
    // outward: the droop goes that way, and the V folds the other way (up).
    const fold = -Math.abs(x) * 0.45;
    p.setXYZ(i, x * (1 - 0.35 * t), y * (1 - 0.25 * t * t), fold + droop * t * t * length);
  }
  geo.computeVertexNormals();
  return geo;
}

// Places a frond on the crown: yaw round the trunk, and how far it tips out
// from upright (young fronds stand up, old ones hang).
function placed(geo, yaw, tilt) {
  const m = new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeRotationX(tilt));
  return geo.clone().applyMatrix4(m);
}

// The trunk: one tube that tapers and curves, bent along a gentle arc.
function trunkGeometry(height, lean) {
  const geo = new THREE.CylinderGeometry(0.17, 0.27, height, 16, 24, true);
  geo.translate(0, height / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = y / height;
    const swell = t < 0.08 ? (0.08 - t) * 2.2 : 0;           // the flared base
    p.setX(i, p.getX(i) * (1 + swell) + lean * height * 0.22 * t * t);
    p.setZ(i, p.getZ(i) * (1 + swell));
  }
  geo.computeVertexNormals();
  return geo;
}

// ---- Materials, shared by every palm -------------------------------------

let mats = null;
function materials(barkMaterial) {
  if (mats) return mats;
  const frond = new THREE.MeshStandardMaterial({
    map: frondPicture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.62, metalness: 0,
  });
  mats = {
    frond,
    trunk: barkMaterial || new THREE.MeshStandardMaterial({ color: 0x8b7a62, roughness: 0.95 }),
    nut: new THREE.MeshStandardMaterial({ color: 0x7a6a2c, roughness: 0.55 }),
  };
  return mats;
}

// A random number generator per palm, so each tree is different but the same
// every time the game loads.
function seeded(seed) {
  let s = (Math.abs(Math.floor(seed * 9301 + 49297)) % 233280) || 1;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

// Ken's palm crown (models/palm-crown.glb): the fronds and coconuts of a real
// coconut palm, cut from its trunk, which came out of the model generator thin
// and twisted. It sits on the trunk built here. Measured once: where its stub
// is, so the trunk can be run up into it and the join is hidden.
let crown = null;
export function usePalmCrown(gltf) {
  if (!gltf) return;
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3());
  // The stub: the lowest points near the middle (frond tips also hang low, but out to the side).
  const mid = box.getCenter(new THREE.Vector3()), v = new THREE.Vector3(), stub = new THREE.Vector3();
  let n = 0;
  scene.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.y < box.min.y + size.y * 0.08 && Math.hypot(v.x - mid.x, v.z - mid.z) < size.x * 0.12) { stub.add(v); n++; }
    }
  });
  if (n) stub.divideScalar(n); else stub.set(mid.x, box.min.y, mid.z);
  scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  crown = { scene, size, stub };
}

// Fairy lights spiralling up the trunk and a soft uplight at its foot, as the
// Esplanade palms have. Brighter than white on purpose, so the glow pass blooms them.
let lightBits = null;
// A picture that is white at the bottom and black at the top: as an alphaMap it
// fades whatever wears it out toward the top.
function fadeUp() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 64, 0, 0);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.35, '#666'); grad.addColorStop(1, '#000');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
}
function trunkLights(height, lean) {
  if (!lightBits) {
    lightBits = {
      bulb: new THREE.SphereGeometry(0.045, 6, 4),
      warm: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3.2, 2.4, 1.1) }),
      // The uplight's wash: strongest at the lamp and gone by three metres up,
      // so it reads as light on the trunk rather than a tube round it.
      beam: new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.22, alphaMap: fadeUp(),
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      fixture: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5, metalness: 0.6 }),
    };
  }
  const g = new THREE.Group(), B = lightBits, count = 70, turns = 9;
  const bulbs = new THREE.InstancedMesh(B.bulb, B.warm, count), m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const t = 0.06 + (i / count) * 0.86, a = t * turns * Math.PI * 2;
    const r = (0.27 - 0.1 * t) + 0.03;                       // just outside the trunk's own taper
    m.makeTranslation(lean * height * 0.22 * t * t + Math.cos(a) * r, t * height, Math.sin(a) * r);
    bulbs.setMatrixAt(i, m);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 3.2, 16, 1, true), B.beam);   // hugs the trunk
  beam.position.y = 1.6;
  const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 16), B.fixture);
  fixture.position.set(0.45, 0.06, 0);
  g.add(bulbs, beam, fixture);
  return g;
}

// A whole palm, its base at the group's origin. barkMaterial is the scanned
// bark when present; lights: true adds fairy lights and an uplight.
export function buildPalm(height, lean, seed, barkMaterial, { lights = false } = {}) {
  const rnd = seeded(seed);
  const m = materials(barkMaterial);
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(trunkGeometry(height, lean), m.trunk);
  trunk.castShadow = true; trunk.receiveShadow = true;
  g.add(trunk);
  const top = new THREE.Vector3(lean * height * 0.22, height, 0);
  if (lights) g.add(trunkLights(height, lean));

  if (crown) {
    // Sized to suit the trunk, with its own variety; turned any way; tipped with the lean.
    const s = (height * 0.62 / crown.size.x) * (0.85 + rnd() * 0.35);
    const c = crown.scene.clone();
    c.scale.setScalar(s);
    // The trunk top goes a third of the way up into the crown, hiding the thin stub.
    const into = crown.size.y * 0.3;
    const holder = new THREE.Group();
    holder.position.copy(top);
    holder.rotation.set(0, rnd() * Math.PI * 2, 0);
    holder.rotateZ(-lean * 0.22);
    c.position.set(-crown.stub.x * s, -(crown.stub.y + into) * s, -crown.stub.z * s);
    holder.add(c);
    g.add(holder);
    return g;
  }

  const pieces = [], count = 13 + Math.floor(rnd() * 4);
  for (let i = 0; i < count; i++) {
    const age = rnd();                                       // 0 young and upright, 1 old and hanging
    const len = 3.2 + rnd() * 1.3;
    const geo = frondGeometry(len, 1.25 + rnd() * 0.3, 0.18 + age * 0.35);
    pieces.push(placed(geo, (i / count) * Math.PI * 2 + rnd() * 0.4, 0.35 + age * 1.0));
  }
  const fronds = new THREE.Mesh(mergeGeometries(pieces), m.frond);
  pieces.forEach(p => p.dispose());
  fronds.position.copy(top);
  fronds.castShadow = true;
  g.add(fronds);

  const nuts = 3 + Math.floor(rnd() * 4), nutGeo = new THREE.SphereGeometry(0.16, 12, 10);
  for (let i = 0; i < nuts; i++) {
    const a = rnd() * Math.PI * 2, n = new THREE.Mesh(nutGeo, m.nut);
    n.position.set(top.x + Math.cos(a) * 0.24, top.y - 0.15 - rnd() * 0.15, Math.sin(a) * 0.24);
    n.castShadow = true;
    g.add(n);
  }
  return g;
}

// Where to put the palms of one stand: one alone, or a clump of two or three
// whose trunks lean away from each other, as coconut palms grow. Returns
// [{ x, z, height, lean, yaw }]: lean is how far it leans, yaw which way.
export function palmStand(x, z, rnd, { minH = 6, maxH = 12 } = {}) {
  const r = rnd(), count = r < 0.5 ? 1 : r < 0.8 ? 2 : 3;
  const height = () => minH + rnd() * (maxH - minH);
  if (count === 1) return [{ x, z, height: height(), lean: (rnd() - 0.5) * 0.9, yaw: rnd() * Math.PI * 2 }];
  const out = [], start = rnd() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const a = start + (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.5, d = 0.7 + rnd() * 0.9;
    // A local +x lean turned by yaw points along (cos yaw, -sin yaw); outward is (cos a, sin a).
    out.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, height: height(), lean: 0.45 + rnd() * 0.5, yaw: -a });
  }
  return out;
}
