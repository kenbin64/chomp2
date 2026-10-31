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

