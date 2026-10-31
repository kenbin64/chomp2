// mango-thieves.js
// Pelicans and fruit bats after Wally's mangoes on the Esplanade (Ken, 2026-10-31). Every so often one swoops in off the
// sea. It homes in, then commits: step aside at the last moment and it misses. If it gets him it snatches a mango and
// flies on along the walk, then drops it: he can run it down and get it back.

import * as THREE from 'three';
import { ModelSkin } from '../models.js';

const SWOOP = 13, CARRY = 8.5, COMMIT = 6, GRAB = 1.4, EVERY = [14, 22], FIRST = 18;
const between = ([a, b]) => a + Math.random() * (b - a);

export class MangoThieves {
  // makeMango(): a mango's mesh. ground: y of the walk. half: half the walk's width. onWarn(bird): one is coming.
  constructor(scene, models, makeMango, { ground, half, finish, onWarn }) {
    this.scene = scene; this.makeMango = makeMango; this.ground = ground; this.half = half; this.finish = finish; this.onWarn = onWarn;
    this.next = FIRST; this.drops = [];
    this.birds = [['pelican', 1.35], ['flyingfox', 0.95], ['flyingfox', 0.95]].map(([name, height]) => {
      const g = new THREE.Group(), gltf = models.get(name); let skin = null;
      if (gltf) { skin = new ModelSkin(gltf, { height }); g.add(skin.root); }
      else { const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshStandardMaterial({ color: name === 'pelican' ? 0xf4f1ea : 0x3a2a20 })); m.scale.set(1, 0.6, 1.5); g.add(m); }
      g.visible = false; scene.add(g);
      return { g, skin, name, state: 'off', vel: new THREE.Vector3(), aim: new THREE.Vector3(), carry: null, goal: new THREE.Vector3() };
    });
  }

  // Each frame. wally: Wally. mangoes: how many he has. Returns { stole, got }.
  update(dt, wally, mangoes) {
    const out = { stole: 0, got: 0 }, here = wally.pos;
    this.next -= dt;
    const onWalk = Math.abs(here.x) <= this.half && here.y >= this.ground - 0.5;
    if (this.next <= 0 && mangoes > 0 && onWalk) {
      const b = this.birds.filter(x => x.state === 'off')[Math.floor(Math.random() * 3)] || this.birds.find(x => x.state === 'off');
      if (b) this.launch(b, here);
      this.next = between(EVERY);
    }
    for (const b of this.birds) {
      if (b.state === 'off') continue;
      const p = b.g.position;
      if (b.state === 'swoop') {
        if (p.distanceTo(b.aim) > COMMIT) b.aim.set(here.x, here.y + 1.2, here.z);          // homing, until it commits
        this.fly(b, b.aim, SWOOP, dt);
        const hit = Math.hypot(p.x - here.x, p.z - here.z) < GRAB && p.y - here.y < 2.4 && p.y - here.y > 0;
        if (hit && mangoes - out.stole > 0) {
          out.stole++; b.state = 'carry'; b.carry = this.makeMango(); this.scene.add(b.carry);
          const z = Math.max(8, Math.min(this.finish - 4, here.z + (Math.random() < 0.5 ? -1 : 1) * (11 + Math.random() * 7)));
          b.goal.set((Math.random() - 0.5) * (this.half * 1.3), this.ground + 3.4, z);
        } else if (p.distanceTo(b.aim) < 0.8) { b.state = 'leave'; b.goal.set(p.x - 40, 24, p.z + 10); }
      } else if (b.state === 'carry') {
        this.fly(b, b.goal, CARRY, dt);
        b.carry.position.copy(p).add(new THREE.Vector3(0, -0.45, 0));
        if (p.distanceTo(b.goal) < 0.7) {                                                    // lets it go: it falls to the walk
          this.drops.push({ mesh: b.carry, x: p.x, z: p.z, y: p.y - 0.45, vy: 0, landed: false }); b.carry = null;
          b.state = 'leave'; b.goal.set(p.x - 40, 24, p.z + 10);
        }
      } else if (b.state === 'leave') {
        this.fly(b, b.goal, SWOOP, dt);
        if (p.distanceTo(b.goal) < 2) { b.state = 'off'; b.g.visible = false; }
      }
      if (b.skin) { b.skin.play('fly', { alternatives: ['glide', 'waddle', 'idle'], speed: 1.3 }); b.skin.update(dt); }
    }
    for (const d of [...this.drops]) {
      if (!d.landed) { d.vy -= 9.8 * dt; d.y += d.vy * dt; if (d.y <= this.ground + 0.45) { d.y = this.ground + 0.45; d.landed = true; } }
      d.mesh.position.set(d.x, d.y, d.z); d.mesh.rotation.y += dt * 2;
      if (d.landed && Math.hypot(d.x - here.x, d.z - here.z) < 1.5) { out.got++; this.scene.remove(d.mesh); this.drops.splice(this.drops.indexOf(d), 1); }
    }
    return out;
  }

  launch(b, here) {
    b.state = 'swoop'; b.g.visible = true; b.vel.set(0, 0, 0);
    b.g.position.set(here.x - 24, here.y + 11, here.z + (Math.random() - 0.5) * 18);
    b.aim.set(here.x, here.y + 1.2, here.z);
    this.onWarn(b);
  }

  fly(b, goal, speed, dt) {
    const want = goal.clone().sub(b.g.position), d = want.length();
    if (d > 0.001) want.multiplyScalar(speed / d);
    b.vel.lerp(want, Math.min(1, dt * 4));
    b.g.position.addScaledVector(b.vel, dt);
    if (b.vel.lengthSq() > 0.01) b.g.rotation.y = Math.atan2(b.vel.x, b.vel.z);
  }

  // A drop that has fallen, to point at.
  nearestDrop(pos) { let best = null, bd = Infinity; for (const d of this.drops) { const n = Math.hypot(d.x - pos.x, d.z - pos.z); if (n < bd) { bd = n; best = d; } } return best; }
}
