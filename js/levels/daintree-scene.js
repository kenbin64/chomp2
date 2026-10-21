// daintree-scene.js
// The look of the Daintree River (rules in daintree-rules.js): a wide tea-green river,
// grey-brown mud banks, mangroves standing on their arching prop roots at the water's
// edge, the rainforest closing in behind (Ken's rainforest tiles, as in Kuranda), the
// ranges beyond, and the sandbar where the boat runs aground.

import * as THREE from 'three';
import { addSky, addLights, addRanges } from '../world.js';
import { applySky } from '../realism.js';
import { Trees } from '../trees.js';
import { HALF, MUD, FOREST, SANDBAR, SANDBAR_X, riverX, groundAt, bedAt } from './daintree-rules.js';

const Z0 = -40, Z1 = SANDBAR.z + 80;                 // the stretch of river that is drawn

function canvasTexture(size, paint, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
  return t;
}

// The banks and the river bed: one ground, following the rules' heights, mud above the water.
function ground(scene, rnd) {
  const W = 2 * (FOREST + 30), L = Z1 - Z0;
  const geo = new THREE.PlaneGeometry(W, L, 110, 220); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i), z = pos.getZ(i) + (Z0 + Z1) / 2, x = lx + riverX(z);   // the strip follows the river's bends
    const g = groundAt(x, z);
    pos.setXYZ(i, x, g.surface === 'mud' ? g.y + Math.max(0, Math.abs(x - riverX(z)) - FOREST) * 0.1 : bedAt(x, z), z);   // under water and the sandbar: the river bed (the sandbar is drawn on its own)
  }
  geo.computeVertexNormals();
  const mud = canvasTexture(512, (g, n) => {
    g.fillStyle = '#5a4c3a'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${60 + rnd() * 50},${48 + rnd() * 35},${30 + rnd() * 25},${0.25 + rnd() * 0.4})`; g.beginPath(); g.ellipse(rnd() * n, rnd() * n, 3 + rnd() * 18, 2 + rnd() * 9, rnd() * 3, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(40,30,20,${0.2 + rnd() * 0.3})`; g.lineWidth = 1; g.beginPath(); const x = rnd() * n, y = rnd() * n; g.moveTo(x, y); g.lineTo(x + rnd() * 30 - 15, y + rnd() * 6 - 3); g.stroke(); }   // cracks and twigs
  }, 40);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: mud, color: 0xb8ad98, roughness: 0.95 }));
  m.receiveShadow = true; scene.add(m);
}

// The water: a broad sheet over the whole stretch, tea-green and glassy, its ripples moving.
function water(scene, rnd) {
  const ripple = canvasTexture(256, (g, n) => {
    const img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const a = Math.sin((x / n) * Math.PI * 6 + Math.sin((y / n) * Math.PI * 4) * 1.5), b = Math.cos((y / n) * Math.PI * 8 + Math.sin((x / n) * Math.PI * 2) * 2);
      const i = (y * n + x) * 4; img.data[i] = 128 + a * 40; img.data[i + 1] = 128 + b * 40; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, 30);
  ripple.colorSpace = THREE.NoColorSpace;
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x2c3d25, roughness: 0.2, metalness: 0.05, normalMap: ripple, normalScale: new THREE.Vector2(0.25, 0.25),
    transparent: true, opacity: 0.93, clearcoat: 0.25, clearcoatRoughness: 0.35 });   // dark tea-green, a soft sheen
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2 * (FOREST + 80), Z1 - Z0 + 80), mat);
  sheet.rotation.x = -Math.PI / 2; sheet.position.set(0, 0, (Z0 + Z1) / 2); sheet.userData.noAO = true; scene.add(sheet);
  return t => { ripple.offset.set(t * 0.004, t * 0.011); };
}

// Mangroves: a dark, dense crown on a fan of arching prop roots, in two bands along each bank.
function mangroves(scene, rnd) {
  const spots = [];
  for (const side of [-1, 1]) for (let z = Z0; z < Z1; z += 3.2 + rnd() * 2.6) {
    const d = HALF - 1.5 + rnd() * (MUD + 1);
    spots.push({ x: riverX(z) + side * d, z: z + rnd() * 2, s: 0.8 + rnd() * 0.7 });
  }
  const ROOTS = 7, n = spots.length;
  const rootGeo = new THREE.TorusGeometry(1, 0.05, 5, 10, Math.PI);      // a half ring: one arching root
  const roots = new THREE.InstancedMesh(rootGeo, new THREE.MeshStandardMaterial({ color: 0x6b5a47, roughness: 0.9 }), n * ROOTS);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 1, 6), new THREE.MeshStandardMaterial({ color: 0x5d4b3a, roughness: 0.9 }), n);
  const crownGeo = new THREE.IcosahedronGeometry(1, 3);
  { const p = crownGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.82 + rnd() * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); } crownGeo.computeVertexNormals(); }
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), n * 3);
  const greens = [0x2f4a24, 0x3a5a2a, 0x29421f, 0x46652f, 0x34502a].map(c => new THREE.Color(c));   // each crown its own green
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  spots.forEach((sp, i) => {
    const s = sp.s, base = 0.1;
    for (let r = 0; r < ROOTS; r++) {                                 // the roots fan out round the trunk, arching down into the mud
      const a = (r / ROOTS) * Math.PI * 2 + rnd() * 0.5, R = (0.9 + rnd() * 0.5) * s;
      E.set(0, a, 0); Q.setFromEuler(E);
      P.set(sp.x + Math.cos(a) * R * 0.5, base, sp.z - Math.sin(a) * R * 0.5); S.set(R * 0.5, R * 1.1, R * 0.5);
      M.compose(P, Q, S); roots.setMatrixAt(i * ROOTS + r, M);
    }
    P.set(sp.x, 1.4 * s + base, sp.z); Q.identity(); S.set(s, 2.2 * s, s); M.compose(P, Q, S); trunks.setMatrixAt(i, M);
    for (let c = 0; c < 3; c++) {
      P.set(sp.x + (rnd() - 0.5) * 1.6 * s, (2.6 + rnd() * 0.9) * s, sp.z + (rnd() - 0.5) * 1.6 * s); E.set(0, rnd() * 6, 0); Q.setFromEuler(E);
      const k = (1.3 + rnd() * 0.7) * s; S.set(k * 1.3, k, k * 1.3); M.compose(P, Q, S); crowns.setMatrixAt(i * 3 + c, M);
      crowns.setColorAt(i * 3 + c, greens[Math.floor(rnd() * greens.length)]);
    }
  });
  for (const m of [roots, trunks, crowns]) { m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; scene.add(m); }
}

// The sandbar: pale sand just out of the water, with a few washed-up branches.
function sandbar(scene, rnd) {
  const geo = new THREE.SphereGeometry(1, 128, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  { // A natural outline, not a perfect oval: the edge pushed in and out round the bar.
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.12 * Math.sin(a * 3 + 1) + 0.07 * Math.sin(a * 7 + 2) + 0.04 * Math.sin(a * 13); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    geo.computeVertexNormals();
  }
  const sand = canvasTexture(256, (g, n) => { g.fillStyle = '#e6d6ad'; g.fillRect(0, 0, n, n); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${190 + rnd() * 50},${170 + rnd() * 50},${120 + rnd() * 50},0.5)`; g.fillRect(rnd() * n, rnd() * n, 1.5, 1.5); } }, 4);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: sand, color: 0xfff4dc, roughness: 1 }));
  m.scale.set(SANDBAR.rx, SANDBAR.top + 0.6, SANDBAR.rz); m.position.set(SANDBAR_X, -0.6, SANDBAR.z); m.receiveShadow = true; scene.add(m);
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 3 + rnd() * 3, 6), wood);
    b.rotation.set(Math.PI / 2, 0, rnd() * 3); b.position.set(SANDBAR_X + (rnd() - 0.5) * SANDBAR.rx, 0.25, SANDBAR.z + (rnd() - 0.5) * SANDBAR.rz); b.castShadow = true; scene.add(b);
  }
}

export function buildDaintree(scene, q, realism = null) {
  let seed = 41; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  addSky(scene);
  const sun = addLights(scene, q);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  scene.add(sun.target);
  if (realism && realism.sky) {
    applySky(scene, realism, sun, scene.children.find(o => o.isMesh && o.geometry.type === 'SphereGeometry'));
    scene.environmentIntensity = 0.5;
  }
  if (scene.fog) { scene.fog.color = new THREE.Color(0xb9cdc0); scene.fog.near = 80; scene.fog.far = 460; }
  // The ranges of the Daintree behind the forest (Thornton Peak's country), hazy blue-green.
  const ranges = addRanges(scene, new THREE.Color(0x7f9f95), sun.position.clone().normalize(), { sink: 0 });

  ground(scene, rnd);
  const ripple = water(scene, rnd);
  mangroves(scene, rnd);
  sandbar(scene, rnd);

  // The rainforest: Ken's rainforest tiles in a thick band behind the mangroves on both banks,
  // tall trees beyond, all following the river's bends.
  const trees = new Trees(scene, { light: q.name === 'low' });
  const TILE = 14;
  for (const side of [-1, 1]) for (let z = Z0; z < Z1; z += TILE * 0.85) for (let k = 0; k < 2; k++) {
    const d = FOREST + 4 + k * TILE * 0.9 + rnd() * 2;
    trees.add('rainforest', riverX(z) + side * d, -0.4 + groundAt(riverX(z) + side * d, z).y, z + rnd() * 3, 15 + rnd() * 3);
  }
  const far = q.name === 'high' ? 220 : q.name === 'medium' ? 150 : 90;
  for (let i = 0; i < far; i++) {
    const side = rnd() < 0.5 ? -1 : 1, z = Z0 + rnd() * (Z1 - Z0), d = FOREST + 30 + rnd() * 70, x = riverX(z) + side * d;
    trees.add(rnd() < 0.6 ? 'umbrella' : rnd() < 0.5 ? 'palm' : 'eucalyptus', x, groundAt(x, z).y + (d - FOREST) * 0.1, z, 18 + rnd() * 10);
  }
  trees.build();

  return { sun, ranges, trees, update(t, camera) { ripple(t); trees.update(t); if (ranges && ranges.userData.follow) ranges.userData.follow(camera); } };
}
