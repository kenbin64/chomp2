// mossman-scene.js
// What Mossman Gorge looks like (MASTER.md): the Mossman River running clear over
// grey granite through the rainforest, swimming holes you can see the bottom of,
// smooth rock slicks with water sheeting down them, boulders, and the forest
// closing in on both banks. The rules are in mossman-rules.js; this only draws it.

import * as THREE from 'three';
import { addSky, addLights } from '../world.js';
import { Trees } from '../trees.js';
import { surfaceMaterial } from '../realism.js';
import { POOLS, POOL_DEPTH, SLIDE_HALF, BANK_WIDTH, WALL, FINISH_Z, riverX, slideEnds, bankHeight, levelAt, poolAt, slideAt } from './mossman-rules.js';

// A flowing-water picture: soft streaks, moved along each frame for the current.
function flowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#9fd8dc'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`; g.lineWidth = 1 + Math.random() * 2.5;
    const x = Math.random() * 128, y = Math.random() * 256, len = 20 + Math.random() * 60;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 4, y + len / 3, x - 4, y + len * 0.66, x, y + len); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A granite boulder: a lumpy, rounded stone, mossy on top.
function boulderGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 4), p = g.attributes.position, v = new THREE.Vector3();   // round enough to read as water-worn
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + 0.2 * Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed * 1.7) + 0.1 * Math.sin(v.z * 5.3 + seed * 2.3));
    v.y *= 0.65; if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, col = [];
  for (let i = 0; i < p.count; i++) {
    const up = n.getY(i);
    if (up > 0.6) col.push(0.55, 0.72, 0.42); else if (p.getY(i) < 0) col.push(0.6, 0.6, 0.6); else col.push(1, 1, 1);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function buildMossman(scene, quality, realism = null) {
  addSky(scene, null);
  const sun = addLights(scene, quality);
  sun.position.set(-30, 80, 40); scene.add(sun.target);
  scene.fog = new THREE.Fog(0xb8d4cf, 60, 260);
  scene.background = new THREE.Color(0xb8d4cf);

  // ---- The gorge floor and walls: one mesh, the rock heights from the rules ----------
  const W = WALL + 30, step = quality.name === 'low' ? 1.6 : 1.1;
  const cols = Math.ceil(W * 2 / step), rows = Math.ceil((FINISH_Z + 40) / step);
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3), col = new Float32Array((cols + 1) * (rows + 1) * 3), uv = new Float32Array((cols + 1) * (rows + 1) * 2), idx = [];
  // Ken's reference photo (2026-10-20): pale, water-polished granite, darker where it is wet.
  const granite = new THREE.Color(0xa89e8e), wet = new THREE.Color(0x6f675b), forest = new THREE.Color(0x2c4a26), c = new THREE.Color();
  for (let r = 0; r <= rows; r++) for (let k = 0; k <= cols; k++) {
    const z = -20 + r * step, cx = riverX(z), x = cx - W + k * step, d = Math.abs(x - cx);
    // Under the holes and slides the rock is the river bed; elsewhere the bank.
    const p = poolAt(x, z), s = slideAt(x, z);
    let y = bankHeight(x, z);
    if (p >= 0) y = POOLS[p].level - POOL_DEPTH;
    else if (s) y = s.y - 0.05;
    else if (d < SLIDE_HALF + 2.5) y = Math.min(y, levelAt(z) + 0.2);                // the channel's edge
    if (d > WALL) y += (d - WALL) * 1.4;                                             // the gorge walls
    const i = (r * (cols + 1) + k) * 3;
    pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
    uv[(i / 3) * 2] = x * 0.22; uv[(i / 3) * 2 + 1] = (z + y * 0.6) * 0.22;     // the rock photo, tiled (stretched a little down the slopes)
    // Granite by the water (darker where wet), forest floor up the banks.
    const tone = 0.9 + 0.2 * Math.sin(x * 0.7 + z * 0.3) * Math.sin(z * 0.9);
    if (p >= 0 || s) c.copy(wet).multiplyScalar(tone);
    else if (d < BANK_WIDTH + 3) c.copy(granite).multiplyScalar(tone);
    else c.copy(granite).lerp(forest, Math.min(1, (d - BANK_WIDTH - 3) / 6)).multiplyScalar(tone);
    c.toArray(col, i);
    if (r < rows && k < cols) { const a = r * (cols + 1) + k, b = a + cols + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  // The photographed rock (assets/surfaces/rock) under the colours: real grain and streaks, not flat paint.
  const rockMat = surfaceMaterial(realism, 'rock', 1, 1, { vertexColors: true, roughness: 0.8 }) || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  rockMat.vertexColors = true;
  const floor = new THREE.Mesh(geo, rockMat);
  floor.receiveShadow = true; scene.add(floor);

  // ---- The water: clear holes you can see into, and water sheeting down the slides ---------
  const flow = flowTexture();
  // Clear, dark green-teal water you can see the bottom through (the photo).
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x2f6f5e, transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0.15, depthWrite: false });
  for (const p of POOLS) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), holeMat);
    disc.rotation.x = -Math.PI / 2; disc.scale.set(p.r * 0.8 + 0.6, p.r + 0.6, 1);
    disc.position.set(riverX(p.z), p.level + 0.02, p.z); disc.renderOrder = 2; disc.userData.noAO = true;
    scene.add(disc);
  }
  const sheetMat = new THREE.MeshStandardMaterial({ map: flow, color: 0xffffff, transparent: true, opacity: 0.8, roughness: 0.1, depthWrite: false });
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < POOLS.length - 1; i++) {
    const s = slideEnds(i), n = 24, P = [], U = [], I = [];
    for (let k = 0; k <= n; k++) {
      const z = s.z0 + (s.z1 - s.z0) * k / n, y = s.y0 + (s.y1 - s.y0) * k / n + 0.06, cx = riverX(z);
      P.push(cx - SLIDE_HALF - 0.4, y, z, cx + SLIDE_HALF + 0.4, y, z); U.push(0, k / 2, 1, k / 2);
      if (k < n) { const a = k * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    const sheet = new THREE.Mesh(g, sheetMat); sheet.userData.noAO = true; sheet.renderOrder = 2; scene.add(sheet);
    // White water where each slide drops into the hole below.
    const splash = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), foamMat);
    splash.rotation.x = -Math.PI / 2; splash.position.set(riverX(s.z1), s.y1 + 0.05, s.z1 + 1); splash.userData.noAO = true; scene.add(splash);
  }

  // ---- Granite boulders along the banks and in the stream, batched ---------------------------
  const stone = surfaceMaterial(realism, 'rock', 1.5, 1.5, { color: 0xc9c0b0, roughness: 0.7 }) || new THREE.MeshStandardMaterial({ color: 0xb3ab9c, roughness: 0.75 });
  stone.vertexColors = true;
  const KINDS = 4, PER = quality.name === 'low' ? 30 : 55, solids = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < KINDS; k++) {
    const mesh = new THREE.InstancedMesh(boulderGeometry(k * 2.7 + 1), stone, PER);
    for (let i = 0; i < PER; i++) {
      let x, z, tries = 0;
      do { z = -4 + rnd() * (FINISH_Z + 4); x = riverX(z) + (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * (WALL - 3)); tries++; }
      while ((poolAt(x, z) >= 0 || slideAt(x, z) || Math.abs(x - riverX(z)) < SLIDE_HALF + 2) && tries < 30);
      const big = Math.abs(x - riverX(z)) > BANK_WIDTH ? 1.6 : 1;
      const r = (0.8 + rnd() * 2.2) * big, y = bankHeight(x, z);
      q.setFromEuler(e.set((rnd() - 0.5) * 0.3, rnd() * 6.28, (rnd() - 0.5) * 0.3));
      mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, y + r * 0.25, z), q, new THREE.Vector3(r, r, r * (1 + rnd() * 0.4))));
      solids.push({ x, z, r: r * 0.85, top: y + r * 0.55 });
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }

  // ---- The rainforest on both banks: Ken's rainforest tile and the gums --------------------
  const trees = new Trees(scene, { light: quality.name === 'low' });
  const spacing = quality.name === 'low' ? 7 : 5;
  for (let z = -15; z < FINISH_Z + 35; z += spacing) for (const side of [-1, 1]) {
    for (let d = BANK_WIDTH + 4; d < W; d += spacing * (0.9 + rnd() * 0.4)) {
      const x = riverX(z) + side * d + (rnd() - 0.5) * 2, zz = z + (rnd() - 0.5) * 3;
      trees.add(rnd() < 0.85 ? 'rainforest' : 'eucalyptus', x, bankHeight(x, zz) - 0.5, zz, 14 + rnd() * 8);
    }
  }
  trees.build();

  // Shafts of light through the canopy, and a little mist over the water.
  const mistTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  for (const p of POOLS) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: 0xf2fbf8, transparent: true, opacity: 0.35, depthWrite: false }));
    s.position.set(riverX(p.z), p.level + 1.2, p.z); s.scale.set(p.r * 2.2, 3, 1); scene.add(s);
  }

  return {
    sun, solids,
    update(t, camera) {
      flow.offset.y = -t * 1.4;                                  // the water runs down the slides
      trees.update(t);
      sun.target.position.set(camera.position.x, 0, camera.position.z); sun.position.set(camera.position.x - 30, 80, camera.position.z + 40);
    },
  };
}
