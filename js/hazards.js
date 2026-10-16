// hazards.js
// The things that make the park harder. Wally has to get the food while it is
// still in the air, before any of these get to it:
//   Box jellyfish drift in the lagoon. Swimming into one stings: energy lost,
//   streak broken, Wally knocked back. Food that comes down close over one is gone.
//   Flying foxes circle high and swoop at food in the air. Only they fly.
//   Pelicans paddle on the lagoon and waddle on the banks, and snap up food
//   that comes down low near them.

import * as THREE from 'three';
import { LAGOON, isWater, terrainHeight, clampToPark, PARK_EDGE } from './rules.js';
import { dress, hideStandIn } from './models.js';
import { addFlap, rimAll, addRim, addStride } from './look.js';

const STING_RANGE = 1.3;
const BAT_GRAB = 0.9;
const WINGSPAN = 1.4;          // metres; a big spectacled flying fox spans about 1.2 to 1.5
const JELLY_GRAB = 1.0;

function glow(color, opacity) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9,
    transparent: true, opacity, roughness: 0.2, depthWrite: false });
}

// ---- Box jellyfish ------------------------------------------------------

export function jellyModel() {
  const g = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), glow(0xd98cff, 0.55));
  bell.scale.y = 1.2;
  g.add(bell);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), glow(0xffb3ff, 0.8)));
  const tentacles = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 1.4, 8), glow(0x9fe8ff, 0.6));
    t.geometry.translate(0, -0.7, 0);
    t.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
    g.add(t); tentacles.push(t);
  }
  g.userData.tentacles = tentacles;
  return g;
}

export class Jellies {
  constructor(scene, count = 6) {
    this.list = [];
    for (let i = 0; i < count; i++) {
      const mesh = jellyModel();
      scene.add(mesh);
      const j = { mesh, pos: new THREE.Vector3(), dir: Math.random() * Math.PI * 2, phase: i * 1.3 };
      this.place(j);
      this.list.push(j);
    }
  }

  useModel(gltf) {
    for (const j of this.list) {
      j.skin = dress(j.mesh, gltf, { height: 1.8 }, -1.3);
      if (j.skin) jellyLook(j.skin.root);
    }
  }

  place(j) {
    do {
      j.pos.set((Math.random() * 1.6 - 0.8) * LAGOON.rx, 0, (Math.random() * 1.6 - 0.8) * LAGOON.rz);
    } while (!isWater(j.pos.x, j.pos.z) || Math.hypot(j.pos.x, j.pos.z - 21) < 10);
  }

  // Drift slowly, turning back from the shallows. Returns the jelly that stung, if any.
  update(dt, t, wallyPos, wallySwimming) {
    let sting = null;
    for (const j of this.list) {
      j.dir += (Math.sin(t * 0.3 + j.phase) * 0.4) * dt;
      const nx = j.pos.x + Math.cos(j.dir) * 0.8 * dt, nz = j.pos.z + Math.sin(j.dir) * 0.8 * dt;
      if (isWater(nx * 1.15, nz * 1.15)) { j.pos.x = nx; j.pos.z = nz; } else j.dir += Math.PI * 0.7;
      const bob = Math.sin(t * 1.6 + j.phase);
      j.mesh.position.set(j.pos.x, -0.15 + bob * 0.12, j.pos.z);
      j.mesh.scale.set(1 + bob * 0.08, 1 - bob * 0.08, 1 + bob * 0.08);
      j.mesh.userData.tentacles.forEach((ten, i) => { ten.rotation.x = Math.sin(t * 2 + i) * 0.25; ten.rotation.z = Math.cos(t * 1.7 + i) * 0.25; });
      if (j.skin) { j.skin.play('pulse', { alternatives: ['idle'] }); j.skin.update(dt); }
      if (wallySwimming && Math.hypot(wallyPos.x - j.pos.x, wallyPos.z - j.pos.z) < STING_RANGE) sting = j;
    }
    return sting;
  }

  // Food that comes down to just above the water right over a jelly is lost to it.
  grab(food) {
    const taken = [];
    for (const it of food.items) {
      const p = it.mesh.position;
      if (p.y > 0.7) continue;
      if (this.list.some(j => Math.hypot(p.x - j.pos.x, p.z - j.pos.z) < JELLY_GRAB)) taken.push(it);
    }
    return taken;
  }
}

// ---- Flying foxes ---------------------------------------------------------

function batModel() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.9 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x5e4032, roughness: 0.8, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 8, 20), fur);
  body.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 20), new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.9 }));
  head.position.set(0, 0.05, 0.38);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 16), head.material);
  snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.02, 0.55);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 12), fur);
    ear.position.set(s * 0.1, 0.22, 0.36); g.add(ear);
  }
  g.add(body, head, snout);
  const wings = [-1, 1].map(s => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.25); shape.lineTo(s * 1.0, 0.35); shape.lineTo(s * 1.7, 0.05);
    shape.lineTo(s * 1.3, -0.15); shape.lineTo(s * 0.9, -0.05); shape.lineTo(s * 0.5, -0.25); shape.lineTo(0, -0.2);
    const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), wingMat);
    w.rotation.x = -Math.PI / 2;
    const pivot = new THREE.Group(); pivot.add(w); g.add(pivot);
    return pivot;
  });
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.wings = wings;
  return g;
}

// Australian pelican: white body, black wings folded along its back, a long pale
// orange bill with a pouch. It sits on the water or stands on the bank.
export function pelicanModel() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.8 });
  const black = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const bill = new THREE.MeshStandardMaterial({ color: 0xf3b25a, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), white);
  body.scale.set(0.8, 0.7, 1.25); body.position.y = 0.45;
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), black);
    w.scale.set(0.35, 0.45, 1.3); w.position.set(s * 0.28, 0.55, -0.1);
    g.add(w);
  }
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 8, 16), white);
  neck.position.set(0, 0.9, 0.32); neck.rotation.x = 0.25;
  const head = new THREE.Group(); head.position.set(0, 1.18, 0.4);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 20), white));
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.75), bill); beak.position.set(0, -0.02, 0.42);
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 16), bill); pouch.scale.set(0.8, 0.9, 3.4); pouch.position.set(0, -0.09, 0.36);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), black); e.position.set(s * 0.08, 0.04, 0.08); head.add(e); }
  head.add(beak, pouch);
  const legs = [-1, 1].map(s => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x9aa3b0 }));
    l.position.set(s * 0.14, 0.12, 0); g.add(l); return l;
  });
  g.add(body, neck, head);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { head, legs };
  return g;
}

// A model without bones still walks: its legs swing in the shader (addStride).
// Each bird gets its own copy of the material so they do not step in time with
// each other; the copy loses the rim light, so that goes back on first.
// Returns { amount, phase } to set each frame, applied to every part of the bird.
function walkLegs(root) {
  const parts = [];
  root.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox, h = b.max.y - b.min.y;
    const m = o.material.clone();
    m.userData.rim = false;
    addRim(m, { strength: 0.18 });
    const s = addStride(m, { ground: b.min.y, legTop: b.min.y + h * 0.17, centre: (b.min.x + b.max.x) / 2, reach: h * 0.07, lift: h * 0.035 });
    o.material = m;
    parts.push(s);
  });
  if (!parts.length) return null;
  let amount = 0;
  return {
    get amount() { return amount; },
    set(walking, phase, dt) {                             // eases in and out over about an eighth of a second
      amount += (walking - amount) * Math.min(1, dt * 8);
      for (const s of parts) { s.amount.value = amount; s.phase.value = phase; }
    },
  };
}

// One jellyfish, wearing Ken's model with the see-through look when there is
// one, for places outside the Jellies class (the reef under the Esplanade).
export function dressedJelly(gltf) {
  const g = jellyModel();
  if (gltf) { const skin = dress(g, gltf, { height: 1.8 }, -1.3); if (skin) jellyLook(skin.root); }
  return g;
}

// Model exports come out solid. A box jellyfish is clear jelly with a faint
// pink-purple glow, so its materials are made see-through and lit from within.
// Each material is changed once, however many jellyfish share it.
function jellyLook(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || m.userData.jelly) continue;
      m.userData.jelly = true;
      m.transparent = true;
      m.opacity = 0.62;
      m.depthWrite = false;                       // see the far side of the bell through the near side
      m.side = THREE.DoubleSide;
      m.roughness = 0.15;                         // wet and glossy
      if (m.emissive) { m.emissive.set(0xb066e0); m.emissiveIntensity = 0.5; }
      m.needsUpdate = true;
    }
    o.castShadow = false;                         // jelly casts almost no shadow
    o.renderOrder = 2;                            // after the water, so it shows over it
  });
}

const PELICAN_REACH = 1.3;   // how far the bill reaches for low food
const PELICAN_NOTICE = 10;   // how far off a pelican spots food coming down, on water or on land

export class Pelicans {
  constructor(scene, count = 2) {
    this.list = [];
    for (let i = 0; i < count; i++) {
      const mesh = pelicanModel();
      scene.add(mesh);
      this.list.push({ mesh, pos: this.spot(), goal: this.spot(), heading: 0, chase: null, snap: 0, t: i * 2.1 });
    }
  }

  useModel(gltf) {
    for (const p of this.list) {
      p.skin = dress(p.mesh, gltf, { height: 1.35 });
      if (p.skin && !p.skin.has('waddle')) p.stride = walkLegs(p.skin.root);
    }
  }

  // Where to wander next. Like real pelicans they hang about where people are
  // eating: most of the time a spot near one of the visitor groups (set by the
  // game as hotspots()), otherwise anywhere Wally can go, water or the banks.
  spot() {
    const near = this.hotspots ? this.hotspots() : [];
    if (near.length && Math.random() < 0.65) {
      const h = near[Math.floor(Math.random() * near.length)], a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
      const c = clampToPark(h.x + Math.cos(a) * r, h.z + Math.sin(a) * r);
      return new THREE.Vector3(c.x, 0, c.z);
    }
    const a = Math.random() * Math.PI * 2, d = Math.random() * (PARK_EDGE - 0.1);
    return new THREE.Vector3(Math.cos(a) * LAGOON.rx * d, 0, Math.sin(a) * LAGOON.rz * d);
  }

  // Paddles or waddles toward where food will come down, and snaps it up if it
  // gets there first. Returns the items taken this frame.
  update(dt, food, wally = null) {
    const taken = [];
    for (const p of this.list) {
      p.t += dt;
      if (!p.chase) {
        // Opportunists: they head for food as soon as they can see where it will
        // come down, water or bank, and wait to scoop it once it is down.
        for (const it of food.items) {
          if (it.claimed || it.taken) continue;
          const spot = it.landed ? it.rest : food.landing(it);
          // Like the crocs and flying foxes, only food Wally has missed: more than 3.5 m from him.
          const missed = spot && (!wally || Math.hypot(spot.x - wally.x, spot.z - wally.z) > 3.5);
          if (missed && Math.hypot(spot.x - p.pos.x, spot.z - p.pos.z) < PELICAN_NOTICE) { p.chase = it; it.claimed = true; break; }
        }
      }
      if (p.chase) {
        if (p.chase.taken) p.chase = null;
        else {
          const land = food.landing(p.chase);
          if (land) p.goal.set(land.x, 0, land.z);
          const bill = this.billPos(p), f = p.chase.mesh.position;
          // They take it off the water or ground, never out of the air.
          if (p.chase.landed && Math.hypot(bill.x - f.x, bill.z - f.z) < PELICAN_REACH) { taken.push(p.chase); p.chase = null; p.snap = 0.4; }   // dips its bill
        }
      }
      const swimming = isWater(p.pos.x, p.pos.z);
      const speed = p.chase ? (swimming ? 1.6 : 1.3) : 0.6;    // still well slower than Wally: he can beat them to it
      const to = new THREE.Vector3(p.goal.x - p.pos.x, 0, p.goal.z - p.pos.z);
      if (to.length() < 0.6 && !p.chase) p.goal = this.spot();
      else if (to.length() > 0.05) {
        const want = Math.atan2(to.x, to.z);
        let d = want - p.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
        p.heading += d * Math.min(1, dt * 3);
        const c = clampToPark(p.pos.x + Math.sin(p.heading) * speed * dt, p.pos.z + Math.cos(p.heading) * speed * dt);
        p.pos.x = c.x; p.pos.z = c.z;
      }
      // Sits on the water, stands on the bank; legs only show on land.
      const y = swimming ? -0.32 : Math.max(0, terrainHeight(p.pos.x, p.pos.z));
      const waddle = !swimming && to.length() > 0.1 ? Math.sin(p.t * 9) * 0.12 : 0;
      p.mesh.position.set(p.pos.x, y + (swimming ? Math.sin(p.t * 1.5) * 0.03 : Math.abs(waddle) * 0.3), p.pos.z);
      // Legs step on land, in time with the waddle.
      if (p.stride) p.stride.set(!swimming && to.length() > 0.1 ? 1 : 0, p.t * 9, dt);
      // A model without bones cannot move its head, so for the snap the whole bird
      // dips forward and back. YXZ: turn to the heading first, then tip about its own side.
      const dip = p.skin && !p.skin.has('snap') && p.snap > 0 ? 0.45 * Math.sin(Math.PI * p.snap / 0.4) : 0;
      p.mesh.rotation.order = 'YXZ';
      p.mesh.rotation.set(dip, p.heading, waddle);
      const U = p.mesh.userData;
      U.legs.forEach(l => { l.visible = !swimming; });
      p.snap = Math.max(0, p.snap - dt);
      U.head.rotation.x = p.snap > 0 ? -0.8 * (p.snap / 0.4) : (p.chase ? -0.3 : Math.sin(p.t * 0.8) * 0.15);
      if (p.skin) {
        p.skin.play(p.snap > 0 ? 'snap' : (swimming ? 'paddle' : 'waddle'), { once: p.snap > 0, alternatives: ['paddle', 'waddle', 'idle'] });
        p.skin.update(dt);
      }
    }
    return taken;
  }

  // Where the tip of the bill is.
  billPos(p) {
    const water = isWater(p.pos.x, p.pos.z);
    const y = water ? 0.8 : 1.2 + Math.max(0, terrainHeight(p.pos.x, p.pos.z));
    return new THREE.Vector3(p.pos.x + Math.sin(p.heading) * 0.9, y, p.pos.z + Math.cos(p.heading) * 0.9);
  }
}

// Anything that circles, picks a piece of food in the air, swoops on it and
// flies off with it. In this game only the flying foxes fly.
const FLYERS = {
  bat:     { model: batModel, ring: 26, ringStep: 8, height: 16, heightStep: 3, cruise: 9, dive: 17, flap: 8, maxY: 99, escapeY: 34 },
};

class Flyers {
  constructor(scene, kind, count) {
    this.scene = scene;
    this.kind = FLYERS[kind];
    this.list = [];
    for (let i = 0; i < count; i++) {
      const mesh = this.kind.model();
      scene.add(mesh);
      this.list.push({ mesh, state: 'circle', r: this.kind.ring + i * this.kind.ringStep, h: this.kind.height + i * this.kind.heightStep,
                       speed: 0.12 + i * 0.02, phase: i * 1.7, target: null, carry: null,
                       cool: 4 + i * 3, vel: new THREE.Vector3() });
    }
  }

  // The flying fox model has no bones: each bat gets its own copy with its own
  // materials, turned to fly belly-down, and its wings flap in the shader.
  useModel(gltf) {
    if (!gltf) return;
    for (const b of this.list) {
      const fox = gltf.scene.clone(true);
      const flaps = [];
      fox.traverse(o => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        const box = o.geometry.boundingBox;
        const centre = (box.min.x + box.max.x) / 2, span = (box.max.x - box.min.x) / 2;
        o.material = o.material.clone();
        rimAll(o, { strength: 0.18 });
        flaps.push(addFlap(o.material, { span, body: span * 0.18, centre }));
        o.castShadow = true;
      });
      const size = new THREE.Box3().setFromObject(fox).getSize(new THREE.Vector3());
      fox.scale.multiplyScalar(WINGSPAN / size.x);
      fox.rotation.x = Math.PI / 2;               // head forward (+z), belly down
      hideStandIn(b.mesh);
      b.mesh.add(fox);
      b.flaps = flaps;
    }
  }

  // food: the food manager; wally: his position. Returns the items stolen this frame.
  // Fair play: they only go for food coming down well away from Wally, the throws
  // he has missed, never one he is right under.
  update(dt, t, food, eagerness = 0.35, wally = null) {
    const stolen = [], K = this.kind;
    for (const b of this.list) {
      const p = b.mesh.position;
      b.cool -= dt;
      if (b.state === 'circle') {
        const a = t * b.speed + b.phase;
        const goal = new THREE.Vector3(Math.cos(a) * b.r, b.h + Math.sin(t + b.phase) * 1.5, Math.sin(a) * b.r * 0.7);
        this.steer(b, goal, K.cruise, dt);
        if (b.cool <= 0 && food.items.length) {
          const it = food.items[Math.floor(Math.random() * food.items.length)];
          const low = food.predict(it, 0.6).y < K.maxY;
          const land = food.landing(it);
          const missed = !wally || !land || Math.hypot(land.x - wally.x, land.z - wally.z) > 4;
          if (!it.claimed && low && missed && Math.random() < eagerness) { b.state = 'dive'; b.target = it; it.claimed = true; }
          b.cool = 2;
        }
      } else if (b.state === 'dive') {
        const it = b.target;
        if (!it || it.taken) { b.state = 'circle'; b.target = null; b.cool = 3; continue; }
        this.steer(b, food.predict(it, 0.25), K.dive, dt);
        if (p.distanceTo(it.mesh.position) < BAT_GRAB) {
          stolen.push(it);
          b.carry = it.mesh; b.state = 'escape'; b.cool = 8;
          b.escapeTo = new THREE.Vector3(p.x * 3, K.escapeY + 6, p.z * 3 - 40);
        }
      } else if (b.state === 'escape') {
        this.steer(b, b.escapeTo, K.cruise + 3, dt);
        if (b.carry) b.carry.position.copy(p).add(new THREE.Vector3(0, -0.4, 0.3));
        if (p.y > K.escapeY) { b.state = 'circle'; if (b.carry) { this.scene.remove(b.carry); b.carry = null; } }
      }
      const rate = b.state === 'dive' ? K.flap * 1.8 : K.flap;
      const flap = Math.sin(t * rate + b.phase) * 0.7;
      b.mesh.userData.wings[0].rotation.z = -flap; b.mesh.userData.wings[1].rotation.z = flap;
      // Model wings: a strong downstroke, half-tucked in a dive.
      if (b.flaps) { const a = b.state === 'dive' ? flap * 0.5 + 0.25 : flap * 0.9 + 0.1; for (const f of b.flaps) f.value = a; }
    }
    return stolen;
  }

  steer(b, goal, speed, dt) {
    const want = goal.clone().sub(b.mesh.position);
    const d = want.length();
    if (d > 0.001) want.multiplyScalar(Math.min(speed, d / Math.max(dt, 1e-3)) / d);
    b.vel.lerp(want, Math.min(1, dt * 3));
    b.mesh.position.addScaledVector(b.vel, dt);
    if (b.vel.lengthSq() > 0.01) b.mesh.rotation.y = Math.atan2(b.vel.x, b.vel.z);
  }
}

export class FlyingFoxes extends Flyers { constructor(scene, count = 4) { super(scene, 'bat', count); } }

// ---- Cane toads -------------------------------------------------------------
// Squat, warty and always hungry: they hop out of the grass after any food that
// lands on dry ground and swallow it. Slow, so Wally can usually beat them to it.

function toadModel() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x7a6a3c, roughness: 0.95 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xd8c896, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), skin); body.scale.set(1, 0.6, 1.15); body.position.y = 0.2;
  const under = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 12), belly); under.scale.set(0.95, 0.4, 1.05); under.position.y = 0.13;
  g.add(body, under);
  for (let i = 0; i < 14; i++) {                       // warts
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), skin);
    const a = Math.random() * Math.PI * 2, b = Math.random() * 0.8;
    w.position.set(Math.cos(a) * 0.27 * Math.cos(b), 0.2 + Math.sin(b) * 0.17, Math.sin(a) * 0.3 * Math.cos(b)); g.add(w);
  }
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3 }));
    eye.position.set(s * 0.13, 0.33, 0.22); g.add(eye);
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), skin); leg.scale.set(0.8, 0.5, 1.6); leg.position.set(s * 0.25, 0.08, -0.12); g.add(leg);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class CaneToads {
  // heightAt(x, z) gives the ground; isWater(x, z) where toads will not go;
  // home(): a random spot in the grass to wait at.
  constructor(scene, count, { heightAt, isWater, home }) {
    this.heightAt = heightAt; this.isWater = isWater; this.home = home;
    this.list = [];
    for (let i = 0; i < count; i++) {
      const mesh = toadModel(); scene.add(mesh);
      const p = home();
      this.list.push({ mesh, pos: new THREE.Vector3(p.x, 0, p.z), target: null, hop: Math.random(), wait: Math.random() * 3 });
    }
  }

  // Ken's toad model (models/toad.glb), in place of the built-from-shapes toad.
  useModel(gltf) { for (const t of this.list) t.skin = dress(t.mesh, gltf, { height: 0.42 }); }

  // Returns the food items swallowed this frame.
  update(dt, food) {
    const eaten = [];
    for (const t of this.list) {
      if (t.target && (t.target.taken || !t.target.landed)) t.target = null;
      if (!t.target) {
        let best = null, bd = 10;
        for (const it of food.items) {
          if (!it.landed || it.floating || it.claimed) continue;
          const d = Math.hypot(it.rest.x - t.pos.x, it.rest.z - t.pos.z);
          if (d < bd) { best = it; bd = d; }
        }
        if (best) { t.target = best; best.claimed = true; }
      }
      const goal = t.target ? t.target.rest : (t.wait <= 0 ? (t.roam = t.roam || this.home()) : null);
      t.wait -= dt;
      if (goal) {
        const dx = goal.x - t.pos.x, dz = goal.z - t.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.35) {
          t.hop += dt * 2.2;                                 // hop, pause, hop
          const moving = (t.hop % 1) < 0.45;
          if (moving) {
            const nx = t.pos.x + dx / d * dt * 3.2, nz = t.pos.z + dz / d * dt * 3.2;
            if (!this.isWater(nx, nz)) { t.pos.x = nx; t.pos.z = nz; }
          }
          t.mesh.rotation.y = Math.atan2(dx, dz);
          t.lift = moving ? Math.sin((t.hop % 1) / 0.45 * Math.PI) * 0.25 : 0;
        } else if (t.target) {
          eaten.push(t.target); t.target = null; t.lift = 0;
        } else { t.roam = null; t.wait = 2 + Math.random() * 4; t.lift = 0; }
      }
      t.mesh.position.set(t.pos.x, this.heightAt(t.pos.x, t.pos.z) + (t.lift || 0), t.pos.z);
    }
    return eaten;
  }
}
