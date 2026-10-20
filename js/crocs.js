// crocs.js
// The park's other crocodiles. Ordinary crocs, nothing like Wally: no shirt,
// no hat, and no manners. They cruise the lagoon and go for any food that
// looks like landing near them. If one gets to it first, it is gone.

import * as THREE from 'three';
import { LAGOON, isWater } from './rules.js';
import { dress } from './models.js';
import { PARK_TREASURE, crocBites } from './treasure-rules.js';

// Not Bruce or Shazza: those are the cassowary and the flying fox in Ken's design document.
const NAMES = ['Big Kev', 'Dazza', 'Mick', 'Trev'];
const NOTICE = 4;        // how far away they notice where food will land
const SNAP = 1.3;
const BUMP = 1.6;        // Wally cannot swim through them

function m(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }); }

// A rounded bar: a capsule laid along the snout and squashed to size, so jaws
// read as smooth rather than boxy. w, h, d are its full width, height and length.
function rod(w, h, d) {
  const g = new THREE.CapsuleGeometry(0.5, 1, 8, 24);
  g.rotateX(Math.PI / 2);
  g.scale(w, h, d / 2);
  return g;
}

function buildCroc() {
  const g = new THREE.Group();
  const skin = m(0x4d5a2e), belly = m(0xb9b07a);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 36, 24), skin);
  body.scale.set(0.9, 0.45, 2.1); g.add(body);
  const under = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 20), belly);
  under.scale.set(0.85, 0.3, 1.9); under.position.y = -0.08; g.add(under);
  const head = new THREE.Group(); head.position.set(0, 0.05, 1.25); g.add(head);
  const snout = new THREE.Mesh(rod(0.5, 0.24, 1.2), skin); snout.position.z = 0.5; head.add(snout);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.06, 0); head.add(jaw);
  const lower = new THREE.Mesh(rod(0.46, 0.15, 1.12), skin); lower.position.set(0, -0.06, 0.5); jaw.add(lower);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 16), m(0xd9b21e, { roughness: 0.3 }));
    eye.position.set(s * 0.17, 0.17, 0.05); head.add(eye);
    for (const z of [0.6, 1.2]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 8, 16), skin);
      leg.position.set(s * 0.55, -0.12, z - 0.9); leg.rotation.z = s * 1.1; g.add(leg);
    }
  }
  let parent = g, len = 0.8;
  const tail = [];
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group(); seg.position.z = i === 0 ? -1.15 : -len; parent.add(seg);
    const piece = new THREE.Mesh(new THREE.CylinderGeometry(0.3 - i * 0.05, 0.35 - i * 0.05, len, 16), skin);
    piece.rotation.x = Math.PI / 2; piece.position.z = -len / 2; piece.scale.x = 0.8; seg.add(piece);
    tail.push(seg); parent = seg; len *= 0.9;
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g, jaw, tail };
}

function waterSpot() {
  for (;;) {
    const x = (Math.random() * 1.6 - 0.8) * LAGOON.rx, z = (Math.random() * 1.6 - 0.8) * LAGOON.rz;
    if (isWater(x * 1.1, z * 1.1)) return new THREE.Vector3(x, 0, z);
  }
}

export class Crocs {
  // guard: one more croc that circles the lagoon's treasure chest under water
  // (Ken: get the treasure without the other crocs getting you).
  constructor(scene, count = 3, { guard = false } = {}) {
    this.list = [];
    for (let i = 0; i < count + (guard ? 1 : 0); i++) {
      const parts = buildCroc();
      scene.add(parts.g);
      const pos = waterSpot();
      this.list.push({ name: NAMES[i % NAMES.length], parts, pos, goal: waterSpot(), heading: 0,
                       chase: null, lunge: 0, t: i * 2, y: -0.25, guard: i >= count, ang: Math.random() * Math.PI * 2 });
    }
  }

  // The croc that bites Wally under water, if one does (only down there: at the
  // surface they just shove him aside).
  bites(wally) {
    return this.list.find(c => crocBites(wally.pos.x, wally.pos.z, wally.pos.y, c.pos.x, c.pos.z, c.y)) || null;
  }

  useModel(gltf) {
    for (const c of this.list) {
      c.skin = dress(c.parts.g, gltf, { length: 4.2 }, -0.3);
      if (c.skin) c.skin.root.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });   // a moving skin's bounds go stale
    }
  }

  // Returns [{ croc, item }] for food snatched this frame. Pushes Wally out of the way.
  update(dt, food, wally) {
    const snatched = [];
    for (const c of this.list) {
      c.t += dt;
      if (c.guard) { this.patrol(c, dt, wally); continue; }
      // Look for food coming down near by.
      if (!c.chase) {
        for (const it of food.items) {
          if (it.claimed) continue;
          const land = food.landing(it);
          const missed = land && Math.hypot(land.x - wally.pos.x, land.z - wally.pos.z) > 3.5;   // only food he has missed
          if (land && missed && isWater(land.x, land.z) && land.distanceTo(c.pos) < NOTICE) { c.chase = it; it.claimed = true; break; }
        }
      }
      let speed = 1.2;
      if (c.chase) {
        if (c.chase.taken) { c.chase = null; }
        else {
          const land = food.landing(c.chase);
          if (land) c.goal.set(land.x, 0, land.z);
          speed = 1.6;                                       // much slower than Wally swims
          const head = this.headPos(c);
          const it = c.chase.mesh.position;
          if (Math.hypot(head.x - it.x, head.z - it.z) < SNAP && it.y < 1.4) {
            snatched.push({ croc: c, item: c.chase });
            c.chase = null; c.lunge = 0.5;
          }
        }
      }
      const to = new THREE.Vector3(c.goal.x - c.pos.x, 0, c.goal.z - c.pos.z);
      if (to.length() < 0.8 && !c.chase) c.goal = waterSpot();
      else if (to.length() > 0.05) {
        const want = Math.atan2(to.x, to.z);
        let d = want - c.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
        c.heading += d * Math.min(1, dt * 2.5);
        const nx = c.pos.x + Math.sin(c.heading) * speed * dt, nz = c.pos.z + Math.cos(c.heading) * speed * dt;
        if (isWater(nx, nz)) { c.pos.x = nx; c.pos.z = nz; } else c.goal = waterSpot();
      }
      // Wally and a croc cannot occupy the same water.
      const dx = wally.pos.x - c.pos.x, dz = wally.pos.z - c.pos.z, dd = Math.hypot(dx, dz);
      if (dd < BUMP && wally.surface === 'water' && dd > 0.001 && Math.abs(wally.pos.y - c.y) < 1.2) {
        wally.pos.x = c.pos.x + dx / dd * BUMP; wally.pos.z = c.pos.z + dz / dd * BUMP;
      }

      c.lunge = Math.max(0, c.lunge - dt);
      const g = c.parts.g;
      g.position.set(c.pos.x, -0.25 + Math.sin(c.t * 1.3) * 0.04 + (c.lunge > 0 ? Math.sin(c.lunge * Math.PI * 2) * 0.6 : 0), c.pos.z);
      g.rotation.y = c.heading;
      c.parts.jaw.rotation.x = c.chase ? 0.45 : (c.lunge > 0 ? 0.7 * (c.lunge / 0.5) : 0.05);
      c.parts.tail.forEach((s, i) => { s.rotation.y = Math.sin(c.t * (speed > 2 ? 6 : 2.5) - i * 0.8) * 0.25; });
      if (c.skin) { c.skin.play(c.lunge > 0 ? 'lunge_snap' : 'swim', { once: c.lunge > 0, alternatives: ['swim', 'idle'] }); c.skin.update(dt); }
    }
    return snatched;
  }

  // The guard: round and round the chest, under water, slow and steady, with
  // a turn now and then to keep a diver guessing.
  patrol(c, dt, wally) {
    const T = PARK_TREASURE;
    c.dirSign = c.dirSign || 1;
    if (Math.random() < dt * 0.05) c.dirSign *= -1;
    c.ang += dt * 0.32 * c.dirSign;
    c.pos.x = T.chest.x + Math.cos(c.ang) * T.guardR; c.pos.z = T.chest.z + Math.sin(c.ang) * T.guardR * 0.65;
    c.heading = Math.atan2(-Math.sin(c.ang) * c.dirSign, Math.cos(c.ang) * 0.65 * c.dirSign);
    c.y = T.guardY + Math.sin(c.t * 0.9) * 0.15;
    c.lunge = Math.max(0, c.lunge - dt);
    const g = c.parts.g;
    g.position.set(c.pos.x, c.y, c.pos.z); g.rotation.y = c.heading;
    c.parts.jaw.rotation.x = c.lunge > 0 ? 0.7 * (c.lunge / 0.5) : 0.12;
    c.parts.tail.forEach((s, i) => { s.rotation.y = Math.sin(c.t * 2.5 - i * 0.8) * 0.25; });
    if (c.skin) { c.skin.play(c.lunge > 0 ? 'lunge_snap' : 'swim', { once: c.lunge > 0, alternatives: ['swim', 'idle'] }); c.skin.update(dt); }
  }

  headPos(c) {
    return new THREE.Vector3(c.pos.x + Math.sin(c.heading) * 1.9, 0, c.pos.z + Math.cos(c.heading) * 1.9);
  }
}
