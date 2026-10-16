// forest.js
// A belt of rainforest between the park and the distant ranges: tall trees
// with full, leafy canopies. Each canopy is a cloud of leaf clusters (small
// cards with a painted spray of leaves, cut out by alphaTest), the usual way
// games draw foliage. All the leaves of every tree are one instanced mesh, and
// all the trunks another, so the whole forest is two draws.

import * as THREE from 'three';

// A spray of leaves painted on a canvas, clear between the leaves.
function leafPicture() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const greens = ['#2e6b2a', '#3b7d30', '#4a8f36', '#2a5e27', '#58a03e', '#356f2c'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    const r = Math.sqrt(rnd()) * S * 0.42, a = rnd() * Math.PI * 2;
    const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
    g.save();
    g.translate(x, y); g.rotate(rnd() * Math.PI * 2);
    g.fillStyle = greens[Math.floor(rnd() * greens.length)];
    g.beginPath(); g.ellipse(0, 0, 11 + rnd() * 8, 4.5 + rnd() * 2.5, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// count trees scattered in the ring between inner and outer (metres from the
// park's centre), skipping anywhere keep(x, z) says no. groundY(x, z) gives the
// height to stand each tree on.
export function addForest(scene, { count, inner, outer, keep, groundY }) {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const trees = [];
  for (let tries = 0; trees.length < count && tries < count * 20; tries++) {
    const a = rnd() * Math.PI * 2, d = inner + Math.sqrt(rnd()) * (outer - inner);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!keep(x, z)) continue;
    trees.push({ x, z, h: 12 + rnd() * 14, w: 6 + rnd() * 5 });
  }

  const CARDS = 22, UNDER = 6;                         // leaf clusters per canopy, and in the undergrowth below it
  const card = new THREE.PlaneGeometry(1, 1);
  const leaves = new THREE.InstancedMesh(card, new THREE.MeshStandardMaterial({
    map: leafPicture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8,
  }), trees.length * (CARDS + UNDER));
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.6, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.95 }), trees.length);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), s = new THREE.Vector3(), tint = new THREE.Color();
  let n = 0;
  trees.forEach((t, i) => {
    const y0 = groundY(t.x, t.z), trunkH = t.h * 0.42;   // canopies come down low, as at a forest edge
    trunks.setMatrixAt(i, m.compose(p.set(t.x, y0 + trunkH / 2, t.z), q.identity(), s.set(1, trunkH, 1)));
    // The canopy: clusters spread through a flattened dome on top of the trunk.
    const shade = 0.62 + rnd() * 0.3;                  // each tree a slightly different, deeper green
    for (let k = 0; k < CARDS; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * t.w, up = (rnd() - 0.45) * t.w * 0.8;
      p.set(t.x + Math.cos(a) * r, y0 + trunkH + up + t.w * 0.25, t.z + Math.sin(a) * r);
      q.setFromEuler(e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI));
      const size = t.w * (0.75 + rnd() * 0.5);
      leaves.setMatrixAt(n, m.compose(p, q, s.set(size, size, size)));
      leaves.setColorAt(n, tint.setRGB(shade, shade * (0.95 + rnd() * 0.1), shade));
      n++;
    }
    // Undergrowth: shrubs and ferns at the foot of the tree, so the forest edge
    // is a wall of green rather than a row of bare trunks.
    for (let k = 0; k < UNDER; k++) {
      const a = rnd() * Math.PI * 2, r = rnd() * t.w * 1.1, size = 3 + rnd() * 3;
      p.set(t.x + Math.cos(a) * r, y0 + size * 0.35, t.z + Math.sin(a) * r);
      q.setFromEuler(e.set(rnd() * 0.6 - 0.3, rnd() * Math.PI, rnd() * 0.6 - 0.3));
      leaves.setMatrixAt(n, m.compose(p, q, s.set(size, size, size)));
      leaves.setColorAt(n, tint.setRGB(shade * 0.85, shade * 0.9, shade * 0.8));
      n++;
    }
  });
  leaves.count = n;
  for (const im of [leaves, trunks]) {
    im.instanceMatrix.needsUpdate = true;
    im.receiveShadow = true;                           // too far out to need casting
    im.frustumCulled = false;                          // spread round the whole park
    scene.add(im);
  }
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  return trees.length;
}
