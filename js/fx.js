// fx.js
// The feel of the game: crumbs bursting on a catch, a camera shake for big
// moments, and a marker on the ground under each piece of food showing where it
// will come down, so a player can read a throw at a glance.

import * as THREE from 'three';

const GRAVITY = 14;

export class Effects {
  constructor(scene, food) {
    this.scene = scene;
    this.food = food;
    this.bits = [];
    this.markers = new Map();          // food item -> its landing marker
    this.shakeLeft = 0; this.shakePower = 0;
    this.bitGeo = new THREE.IcosahedronGeometry(0.07, 1);
    this.markerGeo = new THREE.RingGeometry(0.55, 0.75, 40);
  }

  // A burst of crumbs at `pos` in the food's colours.
  burst(pos, colours, count = 14) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.bitGeo, new THREE.MeshStandardMaterial({ color: colours[i % colours.length], roughness: 0.6 }));
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2, up = 2 + Math.random() * 4, out = 1.5 + Math.random() * 3;
      this.scene.add(m);
      this.bits.push({ m, v: new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out), life: 0.7 + Math.random() * 0.4 });
    }
  }

  // A water splash: white drops thrown up and out.
  splash(pos, count = 18) { this.burst(pos, [0xffffff, 0xd9f6ff, 0xbfeeff], count); }

  shake(power = 0.25, seconds = 0.2) {
    this.shakePower = Math.max(this.shakePower, power);
    this.shakeLeft = Math.max(this.shakeLeft, seconds);
  }

  // Offset to add to the camera this frame.
  shakeOffset(dt) {
    if (this.shakeLeft <= 0) return null;
    this.shakeLeft -= dt;
    const p = this.shakePower * Math.max(0, this.shakeLeft) / 0.2;
    return new THREE.Vector3((Math.random() - 0.5) * p, (Math.random() - 0.5) * p, (Math.random() - 0.5) * p);
  }

  update(dt, t) {
    for (const b of [...this.bits]) {
      b.life -= dt;
      b.v.y -= GRAVITY * dt;
      b.m.position.addScaledVector(b.v, dt);
      b.m.scale.setScalar(Math.max(0.01, b.life));
      if (b.life <= 0) { this.scene.remove(b.m); b.m.material.dispose(); this.bits.splice(this.bits.indexOf(b), 1); }
    }

    // Landing markers: a ring that tightens as the food comes down.
    const live = new Set();
    for (const it of this.food.items) {
      if (it.landed) continue;
      const land = this.food.landing(it);
      if (!land) continue;
      live.add(it);
      let mk = this.markers.get(it);
      if (!mk) {
        mk = new THREE.Mesh(this.markerGeo, new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));
        mk.rotation.x = -Math.PI / 2;
        mk.renderOrder = 5;
        this.scene.add(mk); this.markers.set(it, mk);
      }
      const height = Math.max(0, it.mesh.position.y - land.y);
      mk.position.set(land.x, land.y + 0.06, land.z);
      mk.scale.setScalar(0.6 + Math.min(1.6, height * 0.25));
      mk.material.opacity = 0.45 + 0.35 * Math.sin(t * 10) ** 2;
    }
    for (const [it, mk] of this.markers) {
      if (!live.has(it)) { this.scene.remove(mk); mk.material.dispose(); this.markers.delete(it); }
    }
  }
}

// Colours of the crumbs for each food.
export const CRUMBS = {
  fries: [0xf7d36b, 0xd6212b], pizza: [0xf2c14e, 0xd94f2a, 0x9b1d1d], taco: [0xe9b949, 0x6cc04a, 0xd8392b],
  hotdog: [0xe6b56d, 0xa6402a, 0xf5d000], shrimp: [0xff8a5c, 0xffd1b8], chicken: [0xc07a32, 0xe8b070],
  hoagie: [0xd9a55c, 0xd94a6a, 0x6cc04a], burger: [0xe0a85f, 0x6b3a1e, 0x5bb043, 0xffc93c], steak: [0x7b2e1e, 0xf0e1c8],
  toast: [0xf0c27a, 0x2a1408],
};
