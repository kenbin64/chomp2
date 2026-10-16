// kenny.js
// Kenny the Koala roams the park on his own, doing his own thing: ambling,
// sitting, having a munch. He is Wally's sidekick, though, and when Wally is
// running low (or just when he feels like it) he brings a slice of toast with the
// dark spread from his jar and leaves it on the bank nearby. Eating it is the power-up.

import * as THREE from 'three';
import { LAGOON, terrainHeight, isWater, lagoonDistance, PARK_EDGE, inRedZone } from './rules.js';
import { kennysJar } from './food.js';
import { jarLabelTexture } from './textures.js';
import { dress } from './models.js';
import { HumanoidPoser } from './rig.js';

const HELP_COOLDOWN = 12;       // seconds before he will set off again after a delivery
const WHIM_EVERY = 75;          // he also turns up now and then on his own
const PICKUP = 1.8;
const TOAST_LIFE = 25;

function m(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra }); }
function part(g, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh;
}

// A round, fluffy koala about a metre tall, holding his jar.
function buildKenny() {
  const g = new THREE.Group();
  const fur = m(0x9a9a9e), light = m(0xe9e6e1), dark = m(0x1c1c1e, { roughness: 0.3 });
  const body = part(g, new THREE.SphereGeometry(0.42, 44, 32), fur, 0, 0.5, 0); body.scale.set(1, 1.15, 0.95);
  part(g, new THREE.SphereGeometry(0.3, 36, 28), light, 0, 0.48, 0.2).scale.set(1, 1.2, 0.6);
  const head = new THREE.Group(); head.position.set(0, 1.08, 0.02); g.add(head);
  part(head, new THREE.SphereGeometry(0.34, 44, 32), fur, 0, 0, 0).scale.set(1.1, 0.95, 0.95);
  for (const s of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.2, 32, 24), fur, s * 0.36, 0.2, -0.04).scale.set(1, 1, 0.55);
    part(head, new THREE.SphereGeometry(0.13, 28, 20), light, s * 0.37, 0.2, 0.03).scale.set(1, 1, 0.4);
    part(head, new THREE.SphereGeometry(0.06, 24, 20), dark, s * 0.13, 0.08, 0.28);
    part(head, new THREE.SphereGeometry(0.018, 12, 12), m(0xffffff), s * 0.13 + 0.02, 0.1, 0.335);
  }
  part(head, new THREE.SphereGeometry(0.11, 28, 24), dark, 0, -0.04, 0.32).scale.set(0.9, 1.25, 0.8);  // the big nose
  // Kenny is always happy: a big smile and rosy cheeks.
  const smile = part(head, new THREE.TorusGeometry(0.09, 0.022, 16, 32, Math.PI), m(0x5a2a2a), 0, -0.16, 0.28);
  smile.rotation.z = Math.PI;
  for (const s of [-1, 1]) part(head, new THREE.SphereGeometry(0.06, 20, 16), m(0xf2a0a8), s * 0.21, -0.07, 0.26).scale.set(1, 0.7, 0.4);
  const arms = [-1, 1].map(s => {
    const a = new THREE.Group(); a.position.set(s * 0.33, 0.72, 0.1); g.add(a);
    part(a, new THREE.CapsuleGeometry(0.09, 0.25, 8, 16), fur, 0, -0.15, 0.05).rotation.x = -0.7;
    return a;
  });
  const legs = [-1, 1].map(s => part(g, new THREE.SphereGeometry(0.15, 24, 20), fur, s * 0.2, 0.12, 0.08));
  // The jar he carries everywhere.
  const jar = new THREE.Group();
  part(jar, new THREE.CylinderGeometry(0.11, 0.11, 0.18, 32), m(0xffffff, { map: jarLabelTexture() }), 0, 0, 0);
  part(jar, new THREE.CylinderGeometry(0.115, 0.115, 0.05, 32), m(0xffd400), 0, 0.11, 0);
  jar.position.set(0, 0.62, 0.36); g.add(jar);
  return { g, head, arms, legs, body };
}

export class Kenny {
  constructor(scene) {
    this.scene = scene;
    this.parts = buildKenny();
    this.mesh = this.parts.g;
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(-9, 0, 23);
    this.state = 'wander';          // wander, sit, help, deliver
    this.goal = this.randomSpot();
    this.timer = 0;
    this.helpCool = 10;
    this.whim = WHIM_EVERY;
    this.rescuesLeft = 1;            // Ken's rule: Kenny can revive Wally once per level
    this.toast = null;
    this.t = 0;
  }

  useModel(gltf) {
    this.skin = dress(this.mesh, gltf, { height: 1.3 });
    if (this.skin && this.skin.clips.size) this.poser = new HumanoidPoser(this.skin.root);   // for standing and waving, which have no clip
  }

  // A spot on the bank or just past the fence: he goes where he likes.
  randomSpot() {
    for (;;) {
      const a = Math.random() * Math.PI * 2, d = 1.12 + Math.random() * 0.45;
      const x = Math.cos(a) * LAGOON.rx * d, z = Math.sin(a) * LAGOON.rz * d;
      if (!isWater(x, z)) return new THREE.Vector3(x, 0, z);
    }
  }

  // A spot on dry land close to Wally, still inside the park so he can reach it.
  dropSpotNear(wally) {
    let x = wally.x, z = wally.z;
    const d = lagoonDistance(x, z) || 0.01;
    if (isWater(x, z) || d < 1.1) { x = x / d * 1.16; z = z / d * 1.16; }      // nearest bank along the same line
    if (lagoonDistance(x, z) > PARK_EDGE - 0.05) { const k = (PARK_EDGE - 0.08) / lagoonDistance(x, z); x *= k; z *= k; }
    return new THREE.Vector3(x, 0, z);
  }

  // Called every frame. Returns 'coming' when he sets off to help,
  // 'dropped' when the toast is down, 'eaten' when Wally gets it.
  update(dt, wallyPos, energy) {
    this.t += dt;
    this.helpCool -= dt; this.whim -= dt;
    let event = null;

    const needs = inRedZone(energy) && this.helpCool <= 0 && this.rescuesLeft > 0;   // the feed-o-meter's red zone
    if (needs && !this.toast && (this.state === 'wander' || this.state === 'sit')) {
      this.state = 'help'; this.rescuesLeft--;
      event = 'coming';
    }

    if (this.state === 'help') this.goal = this.dropSpotNear(wallyPos);
    const speed = this.state === 'help' ? 4.2 : 1.3;
    const to = new THREE.Vector3(this.goal.x - this.pos.x, 0, this.goal.z - this.pos.z);
    const dist = to.length();

    if (this.state === 'sit') {
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'wander'; this.goal = this.randomSpot(); }
    } else if (dist > 0.4) {
      this.walkAround(dist, speed * dt);
    } else if (this.state === 'help') {
      this.dropToast();
      this.state = 'sit'; this.timer = 3; this.helpCool = HELP_COOLDOWN;
      event = 'dropped';
    } else {
      if (Math.random() < 0.5) { this.state = 'sit'; this.timer = 3 + Math.random() * 5; }
      else this.goal = this.randomSpot();
    }

    this.pos.y = Math.max(0, terrainHeight(this.pos.x, this.pos.z));
    // Always a happy bounce in him, bigger when he is hurrying, and a wave now and then.
    const moving = this.state !== 'sit';
    const bounce = moving ? Math.abs(Math.sin(this.t * (this.state === 'help' ? 14 : 8))) * 0.16 : Math.abs(Math.sin(this.t * 3)) * 0.05;
    this.mesh.position.set(this.pos.x, this.pos.y + bounce, this.pos.z);
    this.parts.head.rotation.z = Math.sin(this.t * (moving ? 6 : 1.8)) * (moving ? 0.08 : 0.14);
    const waving = this.state === 'sit' || event === 'dropped';
    this.parts.arms[1].rotation.z = waving ? -2.4 + Math.sin(this.t * 9) * 0.4 : Math.sin(this.t * 8) * 0.3;
    this.parts.arms[0].rotation.z = waving ? 0.3 : -Math.sin(this.t * 8) * 0.3;

    if (this.skin) {
      const sk = this.skin;
      let playing;
      if (this.state === 'help') playing = sk.play('run', { alternatives: ['walk'] });
      else if (this.state === 'sit') playing = sk.play('idle');
      else playing = sk.play('walk', { speed: 0.8 });
      if (!playing) sk.stop();
      sk.update(dt);
      // Standing about, or holding out his jar: posed in code, always happy.
      if (!playing && this.poser && this.poser.ok) this.poser.pose({ time: this.t, cheer: this.toast ? 1 : 0, napping: false });
    }

    if (this.toast) {
      const s = this.toast;
      s.life -= dt;
      s.mesh.rotation.y += dt * 2;
      s.mesh.position.y = s.baseY + 0.6 + Math.sin(this.t * 3) * 0.15;
      s.glow.material.opacity = 0.35 + Math.sin(this.t * 6) * 0.15;
      const reach = Math.hypot(wallyPos.x - s.mesh.position.x, wallyPos.z - s.mesh.position.z);
      if (reach < PICKUP && Math.abs(wallyPos.y - s.baseY) < 2.5) { this.removeToast(); event = 'eaten'; }
      else if (s.life <= 0) this.removeToast();
    }
    return event;
  }

  // Koalas do not swim: he walks round the lagoon on the bank, moving his angle
  // around the oval and his distance out from it, never straight across the water.
  walkAround(dist, step) {
    const ang = p => Math.atan2(p.z / LAGOON.rz, p.x / LAGOON.rx);
    const a0 = ang(this.pos), a1 = ang(this.goal);
    const d0 = Math.max(1.1, lagoonDistance(this.pos.x, this.pos.z)), d1 = Math.max(1.1, lagoonDistance(this.goal.x, this.goal.z));
    let da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
    const arc = Math.abs(da) * LAGOON.rx * d0;                 // rough length of the way round
    const k = Math.min(1, step / Math.max(arc + Math.abs(d1 - d0) * LAGOON.rz, 0.001));
    const a = a0 + da * k, d = d0 + (d1 - d0) * k;
    const nx = Math.cos(a) * LAGOON.rx * d, nz = Math.sin(a) * LAGOON.rz * d;
    if (arc < 1) { const to = new THREE.Vector3(this.goal.x - this.pos.x, 0, this.goal.z - this.pos.z); this.pos.addScaledVector(to.normalize(), Math.min(dist, step)); }
    else { this.mesh.rotation.y = Math.atan2(nx - this.pos.x, nz - this.pos.z); this.pos.x = nx; this.pos.z = nz; }
  }

  dropToast() {
    const mesh = kennysJar(jarLabelTexture());
    const baseY = Math.max(0, terrainHeight(this.goal.x, this.goal.z));
    mesh.position.set(this.goal.x, baseY + 0.6, this.goal.z);
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.9, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(this.goal.x, baseY + 0.05, this.goal.z);
    this.scene.add(mesh, glow);
    this.toast = { mesh, glow, baseY, life: TOAST_LIFE };
  }

  removeToast() {
    this.scene.remove(this.toast.mesh, this.toast.glow);
    this.toast = null;
  }
}
