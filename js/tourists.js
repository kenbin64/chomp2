// tourists.js
// Visitors strolling the boardwalk. Wally is friendly, but a big excited
// crocodile coming close still startles them: they jump, back off, and throw
// food to keep him busy. They also toss food over the rail now and then.

import * as THREE from 'three';
import { BOARDWALK, deckHeight } from './rules.js';
import { dress } from './models.js';
import { addRim, contactShadow } from './look.js';

const WALK_LIMIT = 30;          // they stay on the part of the deck over the lagoon and banks
const STARTLE_RANGE = 5;
const WINDUP = 0.45, FOLLOW = 0.35;

// Visitors are everyday Australians and their guests, drawn as individuals:
// a wide range of skin tones, hair, ages, builds and clothes, mixed at random.
// No costumes or cultural props: people, not stereotypes.
const SHIRTS = [0x2f80ed, 0xeb5757, 0xf2c94c, 0x27ae60, 0x9b51e0, 0xffffff, 0xf2994a, 0x56ccf2, 0x1d3557, 0xe76f51, 0x2a9d8f, 0xffb4a2];
const SHORTS = [0x3b3b58, 0xc2b280, 0x5d6d7e, 0x8b5a2b, 0x2c3e50, 0x6d6875, 0x264653];
const SKIN = [0xffe0c4, 0xf6cfa9, 0xeec39a, 0xd9a47a, 0xc68642, 0xa86b3c, 0x8d5524, 0x6b3e26, 0x4a2c1d, 0x3b2219];
const HAIR = [0x1a1a1a, 0x2b1d0e, 0x4a2f1b, 0x6b4423, 0xa0522d, 0xd6b370, 0xe8d8b0, 0xb8b8b8];
const HAIRSTYLES = ['short', 'long', 'curly', 'bun', 'braids', 'bald', 'short', 'curly', 'long'];
const EYES = [0x5b3a1e, 0x3a2414, 0x2f6b8f, 0x4c7a3a, 0x7a5a2e];

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

// Materials: skin a little glossy, hair with a sheen, clothes soft; all with the
// rim light that makes characters stand out from the background.
function skinMat(color) { return addRim(new THREE.MeshStandardMaterial({ color, roughness: 0.5 })); }
function clothMat(color, map) { return addRim(new THREE.MeshStandardMaterial({ color: map ? 0xffffff : color, map: map || null, roughness: 0.85 }), { strength: 0.22 }); }
function hairMat(color) { return addRim(new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.05 }), { strength: 0.25 }); }
function plain(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra }); }
function part(g, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh); return mesh;
}

// A shirt pattern: plain, stripes, or a few flowers, drawn on a small canvas.
const patternCache = new Map();
function shirtPattern(color) {
  const kind = pick(['plain', 'plain', 'stripes', 'flowers', 'band']);
  if (kind === 'plain') return null;
  const key = `${kind}-${color}`;
  if (patternCache.has(key)) return patternCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const base = new THREE.Color(color);
  g.fillStyle = `#${base.getHexString()}`; g.fillRect(0, 0, 128, 128);
  const light = base.clone().offsetHSL(0, -0.1, 0.25), dark = base.clone().offsetHSL(0, 0, -0.18);
  if (kind === 'stripes') { g.fillStyle = `#${light.getHexString()}`; for (let y = 0; y < 128; y += 22) g.fillRect(0, y, 128, 9); }
  if (kind === 'band') { g.fillStyle = `#${dark.getHexString()}`; g.fillRect(0, 54, 128, 22); }
  if (kind === 'flowers') {
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * 128, y = Math.random() * 128;
      g.fillStyle = `#${light.getHexString()}`;
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ffe066'; g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  patternCache.set(key, t);
  return t;
}

function hair(head, style, colour) {
  const h = hairMat(colour);
  if (style === 'bald') {
    if (Math.random() < 0.6) part(head, new THREE.SphereGeometry(0.16, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2.6), h, 0, -0.06, 0.07);   // beard
    return;
  }
  part(head, new THREE.SphereGeometry(0.232, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2.1), h, 0, 0.035, -0.02);
  if (style === 'short') part(head, new THREE.SphereGeometry(0.12, 16, 10), h, 0, 0.17, 0.12).scale.set(1.4, 0.45, 0.8);       // a fringe
  if (style === 'long') part(head, new THREE.CapsuleGeometry(0.17, 0.32, 6, 16), h, 0, -0.2, -0.12).scale.set(1.2, 1, 0.6);
  if (style === 'bun') part(head, new THREE.SphereGeometry(0.11, 16, 12), h, 0, 0.22, -0.14);
  if (style === 'curly') for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r = 0.2;
    part(head, new THREE.SphereGeometry(0.085, 12, 8), h, Math.cos(a) * r, 0.12 + Math.sin(i * 2.3) * 0.05, Math.sin(a) * r - 0.03);
  }
  if (style === 'braids') for (const s of [-1, 1]) part(head, new THREE.CapsuleGeometry(0.045, 0.4, 4, 10), h, s * 0.15, -0.25, -0.1);
}

// One arm: shoulder pivot, sleeve, upper arm, an elbow that bends, forearm and hand.
function arm(g, side, skin, shirt) {
  const shoulder = new THREE.Group(); shoulder.position.set(side * 0.3, 1.33, 0); g.add(shoulder);
  part(shoulder, new THREE.CapsuleGeometry(0.095, 0.12, 6, 14), shirt, 0, -0.06, 0);         // sleeve
  part(shoulder, new THREE.CapsuleGeometry(0.068, 0.2, 6, 12), skin, 0, -0.2, 0);
  const elbow = new THREE.Group(); elbow.position.y = -0.32; shoulder.add(elbow);
  part(elbow, new THREE.CapsuleGeometry(0.062, 0.2, 6, 12), skin, 0, -0.12, 0);
  const hand = part(elbow, new THREE.SphereGeometry(0.068, 16, 12), skin, 0, -0.28, 0.01);
  hand.scale.set(0.85, 1.1, 0.7);
  shoulder.userData.elbow = elbow; shoulder.userData.hand = hand;
  return shoulder;
}

// A cartoon visitor, about 1.5 to 1.85 m tall, different every time.
export function person() {
  const g = new THREE.Group();
  const skinColor = pick(SKIN);
  const skin = skinMat(skinColor);
  const shirtColor = pick(SHIRTS);
  const shirt = clothMat(shirtColor, shirtPattern(shirtColor));
  const shorts = clothMat(pick(SHORTS));
  const older = Math.random() < 0.2;
  g.add(contactShadow(0.45, 0.32));
  const longPants = Math.random() < 0.3;                   // trousers or shorts: both legs alike
  const shoe = pick([0x333333, 0xffffff, 0x8b5a2b, 0x2f80ed, 0xeb5757]);

  const legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(s * 0.13, 0.82, 0); g.add(hip);
    part(hip, new THREE.CapsuleGeometry(0.1, 0.55, 6, 14), longPants ? shorts : skin, 0, -0.42, 0);
    part(hip, new THREE.CapsuleGeometry(0.125, 0.18, 6, 14), shorts, 0, -0.12, 0);
    part(hip, new THREE.CapsuleGeometry(0.075, 0.16, 6, 12), plain(shoe), 0, -0.8, 0.06).rotation.x = Math.PI / 2;
    part(hip, new THREE.BoxGeometry(0.15, 0.03, 0.3), plain(0xf2f2f2), 0, -0.86, 0.06);          // sole
    return hip;
  });
  part(g, new THREE.CapsuleGeometry(0.24, 0.35, 8, 20), shirt, 0, 1.12, 0);
  part(g, new THREE.TorusGeometry(0.13, 0.025, 8, 20), shirt, 0, 1.4, 0).rotation.x = Math.PI / 2;  // collar
  part(g, new THREE.CylinderGeometry(0.075, 0.085, 0.12, 14), skin, 0, 1.46, 0);                     // neck
  const arms = [arm(g, -1, skin, shirt), arm(g, 1, skin, shirt)];

  const head = new THREE.Group(); head.position.y = 1.64; g.add(head);
  part(head, new THREE.SphereGeometry(0.22, 32, 24), skin, 0, 0, 0);
  for (const s of [-1, 1]) part(head, new THREE.SphereGeometry(0.05, 12, 10), skin, s * 0.215, 0.0, -0.01).scale.set(0.5, 1, 0.8);   // ears
  part(head, new THREE.SphereGeometry(0.045, 14, 12), skin, 0, -0.03, 0.215).scale.set(1, 0.9, 0.8);                                   // nose
  // Pixar-style eyes: white, coloured iris, pupil, and a bright catch-light.
  const iris = plain(pick(EYES), { roughness: 0.3 });
  for (const s of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.052, 16, 12), plain(0xffffff, { roughness: 0.25 }), s * 0.08, 0.04, 0.185);
    part(head, new THREE.SphereGeometry(0.031, 14, 10), iris, s * 0.08, 0.042, 0.226);
    part(head, new THREE.SphereGeometry(0.017, 10, 8), plain(0x111111, { roughness: 0.2 }), s * 0.08, 0.043, 0.247);
    part(head, new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), s * 0.08 + 0.01, 0.055, 0.254);
    const brow = part(head, new THREE.CapsuleGeometry(0.012, 0.05, 4, 8), hairMat(older ? 0xc8c8c8 : pick(HAIR)), s * 0.08, 0.105, 0.2);
    brow.rotation.z = Math.PI / 2 + s * 0.12;
  }
  const mouth = part(head, new THREE.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), plain(0x7a3b2e), 0, -0.09, 0.2);
  mouth.rotation.z = Math.PI;
  for (const s of [-1, 1]) part(head, new THREE.SphereGeometry(0.04, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf08080, transparent: true, opacity: 0.25, roughness: 0.6 }), s * 0.13, -0.04, 0.17);  // cheeks
  hair(head, pick(HAIRSTYLES), older ? 0xc8c8c8 : pick(HAIR));
  if (Math.random() < 0.3) part(head, new THREE.BoxGeometry(0.3, 0.06, 0.04), plain(0x111111, { roughness: 0.1, metalness: 0.4 }), 0, 0.05, 0.235);   // sunnies
  if (Math.random() < 0.45) {       // sun hat or cap, with a band
    const hatColor = pick([0xf4e1b5, 0xffffff, 0x2f80ed, 0xeb5757, 0x2a9d8f]);
    const hat = clothMat(hatColor);
    if (Math.random() < 0.5) {
      part(head, new THREE.CylinderGeometry(0.36, 0.36, 0.025, 28), hat, 0, 0.14, 0);
      part(head, new THREE.CylinderGeometry(0.17, 0.2, 0.16, 24), hat, 0, 0.22, 0);
      part(head, new THREE.CylinderGeometry(0.202, 0.202, 0.04, 24), plain(0x333333), 0, 0.165, 0);
    } else {
      part(head, new THREE.SphereGeometry(0.235, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hat, 0, 0.06, 0);
      part(head, new THREE.BoxGeometry(0.26, 0.02, 0.2), hat, 0, 0.07, 0.28);        // peak
    }
  }
  // Things they carry: a backpack, a camera, or a phone ready for a photo of Wally.
  const kit = Math.random();
  let phone = null;
  if (kit < 0.3) {
    part(g, new THREE.BoxGeometry(0.34, 0.4, 0.16), clothMat(pick([0x2c3e50, 0x8e44ad, 0x16a085])), 0, 1.15, -0.27);
    for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(0.04, 0.4, 0.02), plain(0x222222), s * 0.14, 1.2, 0.2);   // straps
  }
  if (kit > 0.45) {
    phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.012), plain(0x111111, { roughness: 0.15, metalness: 0.5 }));
    phone.position.set(0, -0.32, 0.06); phone.castShadow = true;
    arms[1].userData.elbow.add(phone);
  }
  const build = 0.85 + Math.random() * 0.35, height = older ? 0.92 : 0.88 + Math.random() * 0.2;
  g.scale.set(build, height, build);
  return { g, legs, arms, head, phone };
}

// Ken's people (models/tourist-N.glb, made from his cast sheets) and how tall
// each one stands in the game, in metres: a range, so no two look cloned in
// size. Anyone not listed is sized as an adult.
const ADULT = [1.6, 1.85];
export const CAST = [
  { file: 'tourist-1', who: 'hiker',                 tall: [1.75, 1.88] },
  { file: 'tourist-2', who: 'young surfer',          tall: [1.72, 1.85] },
  { file: 'tourist-3', who: 'elder bushman',         tall: [1.65, 1.78] },
  { file: 'tourist-4', who: 'Torres Strait auntie',  tall: [1.55, 1.68] },
  { file: 'tourist-5', who: 'tropical beach kid',    tall: [1.05, 1.25] },
  { file: 'tourist-6', who: 'islander girl',         tall: [1.15, 1.35] },
];
// The people models that loaded, each carrying its height range.
export function peopleModels(models) {
  const list = [];
  for (let i = 1; i <= 24; i++) {
    const file = `tourist-${i}`, gltf = models.get(file);
    if (!gltf) continue;
    gltf.userData = gltf.userData || {};
    gltf.userData.tall = (CAST.find(c => c.file === file) || {}).tall || ADULT;
    list.push(gltf);
  }
  return list;
}

// Put one of Ken's people models on a visitor (tools/blender-animate-human.py
// moves). The shape-built stand-in is stretched to vary builds, which would
// distort a model, so a dressed visitor is scaled evenly and varies by height.
// The phone in their hand shows only while they take a photo.
export function wearModel(body, gltf) {
  body.g.scale.setScalar(1);
  const [lo, hi] = (gltf.userData && gltf.userData.tall) || ADULT;
  const skin = dress(body.g, gltf, { height: lo + Math.random() * (hi - lo) });
  if (!skin) return null;
  skin.phone = skin.root.getObjectByName('HeldPhone') || null;
  if (skin.phone) skin.phone.visible = false;
  return skin;
}

export class Tourists {
  constructor(scene, count) {
    this.list = [];
    for (let i = 0; i < count; i++) {
      const body = person();
      scene.add(body.g);
      const x = -WALK_LIMIT + (i + Math.random()) * (2 * WALK_LIMIT / count);
      this.list.push({ body, x, lane: (i % 2 ? 1 : -1) * 0.7, dir: Math.random() < 0.5 ? 1 : -1,
        speed: 0.9 + Math.random() * 0.6, state: 'walk', timer: 0, walk: Math.random() * 6,
        calm: 0, hop: 0, throwAt: null });
    }
  }

  // Wear Ken's tourist models (tourist-1.glb to tourist-10.glb), shared out in turn.
  useModels(list) {
    if (!list.length) return;
    this.list.forEach((t, i) => { t.skin = wearModel(t.body, list[i % list.length]); });
  }

  // Ask the nearest free tourist to throw at Wally. Returns true if one agreed.
  requestThrow(wallyPos) {
    let best = null, bestD = 36;
    for (const t of this.list) {
      if (t.state !== 'walk') continue;
      const d = Math.abs(t.x - wallyPos.x) + Math.random() * 6;
      if (d < bestD) { best = t; bestD = d; }
    }
    if (!best) return false;
    best.state = 'windup'; best.timer = WINDUP; best.startled = false;
    return true;
  }

  // Returns throws released this frame: { hand: Vector3, startled, who: the person's model }.
  update(dt, wallyPos) {
    const releases = [];
    for (const t of this.list) {
      const y = deckHeight(t.x);
      const pos = new THREE.Vector3(t.x, y, BOARDWALK.z + t.lane);
      const toWally = new THREE.Vector3(wallyPos.x - pos.x, 0, wallyPos.z - pos.z);
      const near = toWally.length() < STARTLE_RANGE && Math.abs(wallyPos.y - y) < 3;
      t.calm -= dt;

      if (near && t.state === 'walk' && t.calm <= 0) {
        t.state = 'windup'; t.timer = WINDUP; t.startled = true; t.hop = 0.5; t.calm = 5;
      }

      if (t.state === 'walk') {
        t.x += t.dir * t.speed * dt;
        if (Math.abs(t.x) > WALK_LIMIT) { t.x = Math.sign(t.x) * WALK_LIMIT; t.dir *= -1; }
        t.walk += dt * t.speed * 6;
        t.body.g.rotation.y = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        t.timer -= dt;
        t.body.g.rotation.y = Math.atan2(toWally.x, toWally.z);   // face Wally to throw
        if (t.state === 'windup' && t.timer <= 0) {
          const hand = new THREE.Vector3(0.3, 1.9, 0.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), t.body.g.rotation.y).add(pos);
          releases.push({ hand, startled: t.startled, who: t.body.g });
          t.state = 'follow'; t.timer = FOLLOW;
        } else if (t.state === 'follow' && t.timer <= 0) {
          t.state = 'walk';
          if (t.startled) t.dir = Math.sign(t.x - wallyPos.x) || 1;   // back away from him
          t.speed = t.startled ? 2.2 : 0.9 + Math.random() * 0.6;
        }
      }
      if (t.state === 'walk' && t.speed > 1.6) t.speed -= dt * 0.4;   // calm down after a fright

      t.hop = Math.max(0, t.hop - dt);
      t.body.g.position.set(pos.x, pos.y + Math.sin(t.hop * Math.PI * 2) * 0.35 * (t.hop > 0 ? 1 : 0), pos.z);
      this.pose(t);
      if (t.skin) {
        if (t.state === 'windup' && t.startled) t.skin.play('nervous', { alternatives: ['startled', 'throw', 'idle'] });
        else if (t.state === 'windup') t.skin.play('throw', { once: true, fit: WINDUP + FOLLOW, alternatives: ['idle'] });
        else if (t.state === 'walk') t.skin.play('walk', { alternatives: ['idle'] });
        t.skin.update(dt);
      }
    }
    return releases;
  }

  pose(t) {
    const B = t.body, walking = t.state === 'walk';
    const swing = walking ? Math.sin(t.walk) * 0.6 : 0;
    B.legs[0].rotation.x = swing; B.legs[1].rotation.x = -swing;
    if (t.state === 'windup') {
      B.arms[1].rotation.x = -2.6 + (t.timer / WINDUP) * -0.4;   // arm back over the shoulder
      B.arms[0].rotation.x = t.startled ? -2.8 : 0.2;             // other hand up in surprise
    } else if (t.state === 'follow') {
      B.arms[1].rotation.x = -0.6;
      B.arms[0].rotation.x = 0;
    } else {
      B.arms[0].rotation.x = -swing * 0.7; B.arms[1].rotation.x = swing * 0.7;
    }
    B.head.rotation.y = walking ? Math.sin(t.walk * 0.2) * 0.4 : 0;
  }
}
