// range-land.js
// The land between Cairns and Kuranda, shared by the rides that cross it (the Skyrail,
// the Kuranda Scenic Railway): the coastal plain and the Coral Sea, the range rising to the
// Tableland, the Barron Gorge with the falls at its head, the rainforest canopy, the far
// ranges and the mist. Moved out of skyrail.js (2026-10-21) so both rides use one land.
//
// One height function (height) holds it all: the plain and the sea at x < 0, the range
// rising, the plateau at Kuranda (x = L), the gorge crossing near the top.
//
//   const land = buildRange(scene, { quality, light, sun, clear });   // clear(x, z): no trees there
//   land.trees.update(t); land.fallsTex.offset.y -= dt * 0.8;

import * as THREE from 'three';
import { Trees } from '../trees.js';

import { L, TOP, GORGE, smooth, coastAt, gorgeCut, height } from './range-height.js';
export { L, TOP, GORGE, smooth, coastAt, gorgeCut, height };

// shape(x, z, h): the drawn ground there, given the land's height h (a ride cuts its line in).
export function buildRange(scene, { quality, light, sun, clear = () => false, fallsSheet = true, shape = (x, z, h) => h, detail = 1 }) {
  const ground = (x, z) => shape(x, z, height(x, z));
  let fallsTex = null;
  {
    const W = 3000, D = 2400, geo = new THREE.PlaneGeometry(W, D, Math.round((quality.name === 'low' ? 150 : 300) * detail), Math.round((quality.name === 'low' ? 120 : 240) * detail));   // detail: a ride that needs a finer land (the railway's cuttings)
    geo.rotateX(-Math.PI / 2); geo.translate(600, 0, 0);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    const n = geo.attributes.normal, col = [], c = new THREE.Color();
    const canopy = [new THREE.Color(0x12301a), new THREE.Color(0x183c1e), new THREE.Color(0x1f4723)];   // the floor under the canopy: deep shade
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), steep = n.getY(i) < 0.72;
      if (y < -1) c.set(0xc9b98f);                                                    // under the shallows
      else if (x < coastAt(z) + 30) c.set(0xd8c89a);                                  // the beach
      else if (x < 140) {                                                             // the coastal plain: cane fields, patchy, not a grid
        const v = Math.sin(x * 0.031 + Math.sin(z * 0.017) * 2) + Math.sin(z * 0.023 + x * 0.007) * 0.8;
        c.set(0x8fb257).lerp(new THREE.Color(v > 0.6 ? 0xb9c46a : v < -0.6 ? 0x6f9a44 : 0x8fb257), 0.8);
      } else if (gorgeCut(x, z) > GORGE.d * 0.82) c.set(0x6a6450);                   // the gorge floor: river stones
      else if (gorgeCut(x, z) > 18) c.set(0x6e675b).lerp(new THREE.Color(0x423d35), Math.max(0, Math.sin(y * 0.12)) * 0.7);   // the gorge walls: granite in bands
      else if (steep) c.set(0x8a8174).lerp(new THREE.Color(0x5a5248), Math.max(0, Math.sin(y * 0.15)) * 0.6);   // rock in bands: the gorge walls, cliffs
      else c.copy(canopy[Math.floor((Math.sin(x * 0.07) + Math.sin(z * 0.09) + 2) * 0.75) % 3]);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    land.receiveShadow = true; scene.add(land);
    // The Coral Sea behind the valley station, and the river in the bottom of the gorge.
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.MeshStandardMaterial({ color: 0x1f7f99, roughness: 0.12, metalness: 0.15 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-10000 + coastAt(0) + 40, 0, 0); scene.add(sea);
    // The river down the gorge floor: churned white below the falls, browner further down.
    {
      const rows = 120, z0 = GORGE.head + 120, z1 = GORGE.head + 1400, pts = [], col = [], idx = [];
      for (let i = 0; i <= rows; i++) {
        const z = z0 + (z1 - z0) * i / rows, cx = GORGE.x + Math.sin(z * 0.006) * 28, w = 9 + i * 0.05;
        for (const s of [-1, 1]) { const x = cx + s * w; pts.push(x, height(cx, z) + 1.2, z); }
        const k = Math.min(1, i / 40); const c = new THREE.Color(0xf2efe6).lerp(new THREE.Color(0x7a6f52), k); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (i < rows) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, side: THREE.DoubleSide })));
    }
    // Green Island, a low green cay out in the sea.
    const cay = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1 }));
    cay.scale.set(1, 0.12, 0.7); cay.position.set(-1600, 0, -300); scene.add(cay);
  }
  // Far ranges all round, soft in the haze.
  {
    const ring = new THREE.Group();
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2, r = 2700 + Math.sin(k * 3.1) * 200;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(420 + Math.sin(k) * 120, 380 + Math.sin(k * 1.7) * 140, 7), new THREE.MeshStandardMaterial({ color: 0x4c6f6a, roughness: 1, flatShading: true }));
      peak.position.set(600 + Math.cos(a) * r, 120, Math.sin(a) * r); peak.scale.y = 0.8;
      if (Math.cos(a) * r > -900) ring.add(peak);                     // no mountains out in the sea
    }
    scene.add(ring);
  }

  // Late-afternoon light: a warm, low sun, and soft mist lying in the valleys of the range.
  sun.color.set(0xffd2a0); sun.intensity = 2.6;
  const mist = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,0.75)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c), out = [];
    let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < 60; i++) {
      const x = 200 + rnd() * 1300, z = -700 + rnd() * 1400, h = height(x, z);
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xfff1df, transparent: true, opacity: 0.22 + rnd() * 0.2, depthWrite: false, fog: true }));
      m.position.set(x, h + 18 + rnd() * 30, z); m.scale.set(220 + rnd() * 180, 50 + rnd() * 30, 1); scene.add(m); out.push(m);
    }
    return out;
  })();

  // ---- The rainforest canopy: Ken's rainforest tile and his trees, as impostor cards -----------
  const trees = new Trees(scene, { light });
  {
    let rnd = 7; const r = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
    const near = quality.name === 'low' ? 18 : quality.name === 'medium' ? 14 : 11, farStep = near * 1.5;
    for (let x = 150; x < L + 260; x += near) for (let z = -720; z < 720; z += Math.abs(z) < 260 ? near : farStep) {
      const step = Math.abs(z) < 260 ? near : farStep;
      if (Math.abs(x - GORGE.x) < GORGE.w * 1.4 && z > GORGE.head - 40) continue;   // the gorge stays open
      const px = x + (r() - 0.5) * step, pz = z + (r() - 0.5) * step;
      const h = ground(px, pz);
      const s = ground(px + 3, pz) - h, s2 = ground(px, pz + 3) - h;
      if (Math.hypot(s, s2) > 2.6) continue;                            // too steep (the gorge walls): bare rock
      if (clear(px, pz)) continue;                                       // kept open by the ride (a station, a railway)
      const k = r();
      if (k < 0.86) trees.add('rainforest', px, h - 1.2, pz, 17 + r() * 5);         // the canopy: Ken's rainforest tile
      else if (k < 0.94) trees.add('eucalyptus', px, h, pz, 26 + r() * 10);           // a few tall emergents
      else trees.add('umbrella', px, h, pz, 18 + r() * 6);
    }
    // The coastal plain: palms along the beach and a few trees in the fields.
    for (let i = 0; i < 220; i++) { const z = -900 + r() * 1800, x = coastAt(z) + 10 + r() * 60; trees.add('palm', x, height(x, z), z, 10 + r() * 5); }
    for (let i = 0; i < 160; i++) { const x = -300 + r() * 420, z = -800 + r() * 1600; trees.add('umbrella', x, height(x, z), z, 9 + r() * 6); }
    trees.build();
  }

  // ---- The falls at the head of the gorge, as seen from the air -----------------------------
  // From the gondola, hundreds of metres off, the falls read as a white cascade with
  // a plume of mist rising from it; Ken's falls model is for close up (the zip line, and the
  // train's lookout, which passes fallsSheet: false and sets the model there itself).
  if (fallsSheet) {
    const lip = height(GORGE.x, GORGE.head), foot = height(GORGE.x, GORGE.head + 260);
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
    for (let x = 0; x < 64; x++) for (let y = 0; y < 256; y += 2) { const v = 210 + Math.random() * 45; g.fillStyle = `rgba(${v},${v - 4},${v - 14},${0.55 + Math.random() * 0.45})`; g.fillRect(x, y, 1, 2 + Math.random() * 10); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 2);
    const cascade = new THREE.Mesh(new THREE.PlaneGeometry(70, lip - foot + 20, 10, 10), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, depthWrite: false, side: THREE.DoubleSide, emissive: 0x333028 }));
    cascade.position.set(GORGE.x, (lip + foot) / 2, GORGE.head + 120); cascade.rotation.x = -0.9; scene.add(cascade);
    fallsTex = tex;
    const mc = document.createElement('canvas'); mc.width = mc.height = 128; const mg = mc.getContext('2d'), r = mg.createRadialGradient(64, 64, 4, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,0.85)'); r.addColorStop(1, 'rgba(255,255,255,0)'); mg.fillStyle = r; mg.fillRect(0, 0, 128, 128);
    const mt = new THREE.CanvasTexture(mc);
    for (let k = 0; k < 14; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, color: 0xe8ece8, transparent: true, opacity: 0.16, depthWrite: false }));
      s.position.set(GORGE.x + (Math.random() - 0.5) * 50, foot + 8 + k * 6, GORGE.head + 200 + (Math.random() - 0.5) * 40); s.scale.setScalar(40 + k * 4); scene.add(s);
    }
  }
  return { trees, fallsTex, mist };
}
