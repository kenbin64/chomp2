// pickups.js
// Things lying about a level for Wally to pick up by touching them: Croc Park's
// Golden Mangoes, the gold pieces visitors drop in Kuranda. Each one turns
// slowly, bobs, and has a soft glint so it can be spotted; some are placed
// high (on rocks, above the boardwalk) so he has to jump for them.

import * as THREE from 'three';
import { ModelSkin } from './models.js';
import { swishing, SWISH } from './gear.js';

let glintTex = null;
function glintTexture() {
  if (glintTex) return glintTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,245,200,1)'); grd.addColorStop(0.3, 'rgba(255,215,110,0.5)'); grd.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return (glintTex = new THREE.CanvasTexture(c));
}

// A gold piece, when there is no model: a thick coin with a raised rim.
export function goldPiece() {
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8b62e, metalness: 0.9, roughness: 0.25, emissive: 0x3a2a00 });
  const g = new THREE.Group();
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.07, 28), gold); coin.rotation.x = Math.PI / 2; g.add(coin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 8, 28), gold); g.add(rim);
  return g;
}

export class Pickups {
  // spots: [{ x, y, z }] (y: where it floats). make(): a fresh mesh for one.
  // reach: how close Wally's middle must come (metres across, and up and down).
  // scale(): a multiplier on the reach (the Tail Swisher ability).
  constructor(scene, spots, make, { size = 1, reach = 1.3, glint = 1.2, scale = () => 1 } = {}) {
    this.list = spots.map((s, i) => {
      const mesh = make(); mesh.scale.multiplyScalar(size); mesh.position.set(s.x, s.y, s.z);
      mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      shine.scale.setScalar(glint); shine.position.copy(mesh.position); shine.userData.noAO = true;
      scene.add(mesh, shine);
      return { ...s, mesh, shine, taken: false, phase: i * 1.7 };
    });
    this.reach = reach; this.scale = scale;
  }

  get found() { return this.list.filter(p => p.taken).length; }
  get total() { return this.list.length; }

  // Each frame. pos: Wally's feet. Returns the ones picked up this frame.
  update(dt, t, pos) {
    const got = [];
    for (const p of this.list) {
      if (p.taken) {
        if (p.mesh.visible) { p.mesh.position.y += dt * 3; p.mesh.scale.multiplyScalar(1 - dt * 3); if (p.mesh.scale.x < 0.05) p.mesh.visible = false; }
        p.shine.visible = false;
        continue;
      }
      p.mesh.rotation.y += dt * 1.8;
      p.mesh.position.y = p.y + Math.sin(t * 2 + p.phase) * 0.12;
      p.shine.position.copy(p.mesh.position);
      p.shine.material.opacity = 0.45 + 0.4 * Math.sin(t * 3 + p.phase);
      // His body spans from his feet to about 2 m up: touching it anywhere counts.
      const dy = p.y - pos.y;
      const reach = swishing() ? SWISH : this.reach * this.scale();            // the Tail Swisher sweeps things in
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < reach && dy > -0.8 && dy < (swishing() ? 3.2 : 2.4)) { p.taken = true; got.push(p); }
    }
    return got;
  }
}

// A Golden Mango: Ken's model when it is loaded, otherwise a golden egg shape.
export function mangoMaker(gltf) {
  return () => {
    if (gltf) { const s = new ModelSkin(gltf, { height: 0.45 }); return s.root; }
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffc21a, metalness: 0.3, roughness: 0.35, emissive: 0x4a3000 }));
    m.scale.set(0.85, 1, 1.15); return m;
  };
}
