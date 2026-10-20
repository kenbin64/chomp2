// food.js
// The tucker tourists throw: what each piece looks like, its flight, and what
// happens when it lands. Landed food floats or sits for a few seconds, still good
// to eat, until it dissolves or something else gets it.

import * as THREE from 'three';
import { FOODS, GRAVITY, positionAt, groundSize } from './rules.js';
import { ground } from './ground.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { fitToSize } from './models.js';

function m(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.6 }); }
function add(g, geo, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, m(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh;
}

// Each model is about half a metre across: bigger than life, so it reads from afar.
const MODELS = {
  fries(g) {
    add(g, new THREE.CylinderGeometry(0.2, 0.15, 0.32, 24), 0xd6212b, 0, -0.05);
    for (let i = 0; i < 9; i++) {
      const s = add(g, new THREE.BoxGeometry(0.05, 0.36, 0.05), 0xf7d36b, Math.cos(i) * 0.1, 0.18, Math.sin(i * 1.7) * 0.1);
      s.rotation.z = (i % 3 - 1) * 0.2;
    }
  },
  pizza(g) {
    const slice = new THREE.CylinderGeometry(0.42, 0.42, 0.05, 6, 1, false, 0, Math.PI / 4);
    add(g, slice, 0xf2c14e);
    add(g, new THREE.CylinderGeometry(0.42, 0.42, 0.06, 6, 1, false, 0, Math.PI / 4), 0xd94f2a, 0, 0.01).scale.set(0.92, 1, 0.92);
    for (const [x, z] of [[0.12, 0.18], [0.06, 0.3], [0.2, 0.28]]) add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20), 0x9b1d1d, x, 0.05, z);
    add(g, new THREE.CapsuleGeometry(0.05, 0.3, 8, 16), 0xd99a44, 0.2, 0, 0.36).rotation.set(0, Math.PI / 8 + Math.PI / 2, Math.PI / 2);
  },
  taco(g) {
    const shell = add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.12, 32, 1, true, 0, Math.PI), 0xe9b949);
    shell.rotation.z = Math.PI / 2; shell.material.side = THREE.DoubleSide;
    add(g, new THREE.BoxGeometry(0.1, 0.1, 0.36), 0x7a3e1d, 0, 0.0);
    add(g, new THREE.BoxGeometry(0.14, 0.05, 0.34), 0x6cc04a, 0, 0.07);
    add(g, new THREE.BoxGeometry(0.1, 0.04, 0.3), 0xd8392b, 0, 0.11);
  },
  hotdog(g) {
    add(g, new THREE.CapsuleGeometry(0.1, 0.42, 8, 20), 0xe6b56d, 0, -0.04).rotation.z = Math.PI / 2;
    add(g, new THREE.CapsuleGeometry(0.065, 0.5, 8, 20), 0xa6402a, 0, 0.06).rotation.z = Math.PI / 2;
    add(g, new THREE.BoxGeometry(0.4, 0.02, 0.03), 0xf5d000, 0, 0.13);     // mustard
  },
  shrimp(g) {
    const t = add(g, new THREE.TorusGeometry(0.16, 0.07, 16, 32, Math.PI * 1.5), 0xff8a5c);
    t.rotation.x = Math.PI / 2;
    add(g, new THREE.ConeGeometry(0.07, 0.14, 12), 0xff6a3d, 0.16, 0, 0.05).rotation.z = -1.2;
  },
  chicken(g) {
    add(g, new THREE.SphereGeometry(0.17, 24, 20), 0xc07a32, 0, 0, 0).scale.set(1, 1, 1.35);
    add(g, new THREE.CylinderGeometry(0.035, 0.04, 0.24, 16), 0xf3ead8, 0, 0, -0.3).rotation.x = Math.PI / 2;
    add(g, new THREE.SphereGeometry(0.05, 16, 12), 0xf3ead8, 0.03, 0, -0.43);
    add(g, new THREE.SphereGeometry(0.05, 16, 12), 0xf3ead8, -0.03, 0, -0.43);
  },
  steak(g) {
    const s = add(g, new THREE.CylinderGeometry(0.28, 0.28, 0.08, 28), 0x7b2e1e);
    s.scale.set(1.25, 1, 0.85);
    add(g, new THREE.CylinderGeometry(0.29, 0.29, 0.02, 28), 0xf0e1c8, 0, 0.0).scale.set(1.27, 1, 0.87); // fat rim
    for (let i = -1; i <= 1; i++) add(g, new THREE.BoxGeometry(0.5, 0.01, 0.03), 0x3a1408, 0, 0.045, i * 0.09).rotation.y = 0.5;
  },
  hoagie(g) {
    const roll = add(g, new THREE.CapsuleGeometry(0.11, 0.5, 8, 20), 0xd9a55c, 0, 0.05);
    roll.rotation.z = Math.PI / 2; roll.scale.set(1, 1, 1.15);
    add(g, new THREE.BoxGeometry(0.6, 0.05, 0.22), 0xd94a6a, 0, -0.03);
    add(g, new THREE.BoxGeometry(0.58, 0.03, 0.24), 0x6cc04a, 0, -0.07);
    add(g, new THREE.BoxGeometry(0.62, 0.07, 0.22), 0xd9a55c, 0, -0.11);
  },
  burger(g) {
    add(g, new THREE.CylinderGeometry(0.28, 0.26, 0.1, 32), 0xd9a15b, 0, -0.12);
    add(g, new THREE.CylinderGeometry(0.29, 0.29, 0.08, 32), 0x6b3a1e, 0, -0.03);
    add(g, new THREE.BoxGeometry(0.46, 0.03, 0.46), 0xffc93c, 0, 0.02).rotation.y = 0.6;
    add(g, new THREE.CylinderGeometry(0.31, 0.31, 0.03, 32), 0x5bb043, 0, 0.05);
    add(g, new THREE.SphereGeometry(0.29, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), 0xe0a85f, 0, 0.06);
  },
};

// Ken's toast model (models/toast.glb), when present, like the jar.
let toastModel = null;
export function useToastModel(gltf) { toastModel = gltf || null; }

// Kenny's toast: a slice of toast with butter and the dark spread from his jar.
// The spread is never named (it is a real product), only shown.
export function kennysToast() {
  if (toastModel) {
    const g = new THREE.Group(), t = toastModel.scene.clone(true);
    fitToSize(t, 0.75);
    t.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(t); return g;
  }
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(0.44, 0.08, 0.44), 0xc98d4a, 0, -0.02);          // crust
  add(g, new THREE.BoxGeometry(0.38, 0.02, 0.38), 0xf0c27a, 0, 0.025);           // toasted face
  add(g, new THREE.BoxGeometry(0.34, 0.018, 0.34), 0x2a1408, 0, 0.04);           // the spread
  add(g, new THREE.BoxGeometry(0.1, 0.012, 0.08), 0xffe08a, 0.06, 0.052, -0.05); // a melting bit of butter
  g.scale.setScalar(1.4);
  return g;
}

// Ken's jar model (models/jar.glb), when it is present: every jar in the game
// is a copy of it. Each level hands it over once its models have loaded.
let jarModel = null;
export function useJarModel(gltf) { jarModel = gltf || null; }
const JAR_SIZE = 0.75;           // metres tall: big enough to spot from across the park

// Kenny's jar of dark spread. It may look like the jar everyone knows, but
// carries no name, only a V.
export function kennysJar(labelTexture) {
  if (jarModel) {
    const g = new THREE.Group();
    const jar = jarModel.scene.clone(true);
    fitToSize(jar, JAR_SIZE);
    jar.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(jar);
    return g;
  }
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 28), new THREE.MeshStandardMaterial({ color: 0x1a0d05, roughness: 0.2, metalness: 0.1 }));
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.2, 28, 1, true), new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.6 }));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.09, 28), new THREE.MeshStandardMaterial({ color: 0xffd400, roughness: 0.4 }));
  lid.position.y = 0.21;
  g.add(glass, label, lid);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(1.5);
  return g;
}

// Weighted choice: fries, pizza, tacos and hot dogs are common; steak is a treat.
const KINDS = ['fries', 'fries', 'pizza', 'pizza', 'taco', 'taco', 'hotdog', 'hotdog',
               'shrimp', 'chicken', 'hoagie', 'burger', 'steak'];
// avoid: kinds this person would not carry (Ken, 2026-10-20: nobody throws food their
// faith or culture forbids; see `avoid` in CAST, js/tourists.js).
export function randomKind(avoid = null) {
  const list = avoid && avoid.length ? KINDS.filter(k => !avoid.includes(k)) : KINDS;
  return list[Math.floor(Math.random() * list.length)];
}
// The food for one person to throw: from what they would carry.
export const kindFor = person => randomKind(person && person.skin && person.skin.cast && person.skin.cast.userData && person.skin.cast.userData.avoid);

// Model file for each kind of food (see MODELS.md).
const FOOD_FILES = { fries: 'food-fries', pizza: 'food-pizza', taco: 'food-taco', hotdog: 'food-hotdog', shrimp: 'food-shrimp',
                     chicken: 'food-chicken', hoagie: 'food-hoagie', burger: 'food-hamburger', steak: 'food-steak' };

export class Food {
  constructor(scene) {
    this.scene = scene;
    this.models = new Map();   // kind -> glTF, when Ken's model exists
    this.items = [];         // in the air or landed, still good to eat
    this.fading = [];        // dissolving or eaten
    this.rings = [];         // splash rings
  }

  // Use Ken's food models where they exist.
  useModels(models) {
    for (const [kind, file] of Object.entries(FOOD_FILES)) if (models.has(file)) this.models.set(kind, models.get(file));
  }

  throw(kind, from, velocity) {
    const g = new THREE.Group();
    const gltf = this.models.get(kind);
    if (gltf) {
      const m = cloneSkinned(gltf.scene);
      fitToSize(m, 0.55);
      m.traverse(o => { if (o.isMesh) o.castShadow = true; });
      g.add(m);
    } else MODELS[kind](g);
    g.position.copy(from);
    this.scene.add(g);
    const item = { kind, name: FOODS[kind].name, mesh: g, from: from.clone(), v: { ...velocity }, t: 0,
                   spin: new THREE.Vector3(Math.random() * 4, Math.random() * 6, Math.random() * 4), taken: false,
                   landed: false, age: 0, rest: null, floating: false };
    this.items.push(item);
    return item;
  }

  // Where an item will be `ahead` seconds from now (for crocs and bats to aim at).
  // Landed food stays where it is.
  predict(item, ahead) {
    if (item.landed) return item.rest.clone();
    const p = positionAt(item.from, item.v, item.t + ahead);
    return new THREE.Vector3(p.x, p.y, p.z);
  }

  // Where an item will come down (deck, ground or water), or null if not within 4 s.
  landing(item) {
    if (item.landed) return item.rest.clone();
    for (let ahead = 0; ahead < 4; ahead += 0.05) {
      const p = this.predict(item, ahead);
      if (p.y <= ground.foodAt(p.x, p.z, p.y + 0.5)) return p;
    }
    return null;
  }

  // Remove an item from the air: eaten, dissolved, or carried off.
  // 'carried' leaves the model alone: a flying fox is taking it away.
  take(item, how) {
    item.taken = true;
    this.items = this.items.filter(i => i !== item);
    if (how === 'carried') return;
    this.fading.push({ mesh: item.mesh, life: how === 'eaten' ? 0.12 : 0.5, max: how === 'eaten' ? 0.12 : 0.5 });
  }

  splash(x, y, z, colour = 0xffffff) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 48),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.05, z);
    this.scene.add(ring); this.rings.push({ mesh: ring, life: 0.7 });
  }

  // Moves everything. Returns { landed, dissolved }: items that touched down this
  // frame, and items that sat too long and are gone.
  update(dt, t = 0) {
    const landed = [], dissolved = [];
    for (const it of [...this.items]) {
      if (it.landed) {
        it.age += dt;
        const size = groundSize(it.age);
        if (size <= 0) { this.take(it, 'dissolved'); dissolved.push(it); continue; }
        it.mesh.scale.setScalar(size);
        const bob = it.floating ? Math.sin(t * 2.5 + it.rest.x) * 0.06 : 0;
        it.mesh.position.set(it.rest.x, it.rest.y + bob, it.rest.z);
        it.mesh.rotation.y += dt * (it.floating ? 0.6 : 0);
        continue;
      }
      const prevY = it.mesh.position.y;
      it.t += dt;
      const p = positionAt(it.from, it.v, it.t);
      it.mesh.position.set(p.x, p.y, p.z);
      it.mesh.rotation.x += it.spin.x * dt; it.mesh.rotation.y += it.spin.y * dt; it.mesh.rotation.z += it.spin.z * dt;
      const floor = ground.foodAt(p.x, p.z, prevY);
      if (p.y <= floor && it.v.y - GRAVITY * it.t < 0) {
        it.floating = floor <= 0.01 && ground.isWater(p.x, p.z);
        it.landed = true; it.age = 0;
        it.rest = new THREE.Vector3(p.x, floor + (it.floating ? 0.05 : 0.15), p.z);
        it.mesh.rotation.set(0, it.mesh.rotation.y, 0);          // settles flat
        this.splash(p.x, floor, p.z, it.floating ? 0xffffff : 0xe8d9b0);
        landed.push(it);
      }
    }
    for (const f of [...this.fading]) {
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      f.mesh.scale.setScalar(k);
      if (f.life <= 0) { this.scene.remove(f.mesh); this.fading = this.fading.filter(x => x !== f); }
    }
    for (const r of [...this.rings]) {
      r.life -= dt;
      r.mesh.scale.setScalar(1 + (0.7 - r.life) * 6);
      r.mesh.material.opacity = Math.max(0, r.life / 0.7);
      if (r.life <= 0) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); this.rings = this.rings.filter(x => x !== r); }
    }
    return { landed, dissolved };
  }

  clear() {
    for (const it of this.items) this.scene.remove(it.mesh);
    for (const f of this.fading) this.scene.remove(f.mesh);
    for (const r of this.rings) this.scene.remove(r.mesh);
    this.items = []; this.fading = []; this.rings = [];
  }
}
