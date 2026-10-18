// chest.js
// A treasure chest: timber with gold bands, a lid that opens and a warm glow
// inside. Used for the pirate chest in the reef's coral cave and the chest on
// the bottom of the Croc Park lagoon.

import * as THREE from 'three';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function chestModel(prize = null) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#6b4423'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 21) { c.fillStyle = '#4e2f16'; c.fillRect(0, y, w, 3); }
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(40,25,10,${Math.random() * 0.3})`; c.fillRect(Math.random() * w, Math.random() * h, 8, 1); }
  }), roughness: 0.85 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a52c, metalness: 0.85, roughness: 0.3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.0), wood); box.position.y = 0.45; g.add(box);
  for (const x of [-0.6, 0.6]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.92, 1.04), gold); band.position.set(x, 0.45, 0); g.add(band); }
  const lid = new THREE.Group(); lid.position.set(0, 0.9, -0.5);
  const lidTop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 20, 1, false, 0, Math.PI), wood);
  lidTop.rotation.z = Math.PI / 2; lidTop.position.set(0, 0, 0.5); lid.add(lidTop);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.08), gold); lock.position.set(0, -0.05, 1.02); lid.add(lock);
  g.add(lid);
  const glow = new THREE.PointLight(0xffc24a, 0, 8); glow.position.y = 1.2; g.add(glow);
  // What is inside, shown rising out when it opens (the reef's is a Golden Mango).
  const mango = prize || new THREE.Group(); mango.scale.setScalar(2.2); mango.position.y = 0.95; mango.visible = false; g.add(mango);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, lid, glow, mango };
}
