// kuranda-scene.js
// Kuranda, the village in the rainforest: one main street of market stalls
// under the canopy, rainforest all round (Ken's trees), the ranges behind,
// and the Skyrail gondolas gliding over the treetops. At the far end, the
// trail to Barron Falls. Stalls, shopfronts and gondolas are built here as
// placeholders until Ken's Meshy models arrive (MODELS.md, Kuranda section).

import * as THREE from 'three';
import { addSky, addLights, addRanges } from '../world.js';
import { Trees } from '../trees.js';
import { Grass } from '../grass.js';
import { surfaceMaterial, applySky } from '../realism.js';

export const STREET = { half: 5, z0: -10, z1: 230, ground: 0 };
export const TRAIL_Z = 222;                        // the gate onto the Barron Falls trail
// Market stalls down both sides: [x, z, kind]. The clothes stall is the shop.
export const STALLS = [
  [8, 18, 'fruit'], [-8, 34, 'crafts'], [8, 52, 'treats'], [-8, 70, 'fruit'],
  [8, 92, 'clothes'], [-8, 110, 'crafts'], [8, 130, 'treats'], [-8, 150, 'fruit'],
  [8, 170, 'crafts'], [-8, 190, 'treats'],
];
export const SHOP = (() => { const s = STALLS.find(s => s[2] === 'clothes'); return { x: s[0], z: s[1] }; })();
// The shell and mango trader (Ken, 2026-10-18): the first crafts stall, near the start of the street.
export const VENDOR = (() => { const s = STALLS.find(s => s[2] === 'crafts'); return { x: s[0], z: s[1] }; })();

function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }); }
function shadowed(m, cast = true, receive = true) { m.castShadow = cast; m.receiveShadow = receive; return m; }

// A striped canvas awning picture.
function stripes(a, b) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 8;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 16, 0, 16, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// A market stall: timber posts, a striped awning, a counter with goods on it.
function stall(kind, facing) {
  const g = new THREE.Group();
  const wood = mat(0x7a5536), dark = mat(0x5a3d26);
  const colours = { fruit: ['#d8452f', '#f3e6cf'], crafts: ['#2f8c6a', '#f3efe2'], treats: ['#e2a530', '#fff3d6'], clothes: ['#7a4fb0', '#f8eefc'] }[kind];
  for (const [x, z] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) {
    const p = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.6, 8), wood)); p.position.set(x, 1.3, z); g.add(p);
  }
  const awning = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 2.8), mat(0xffffff, { map: stripes(...colours), roughness: 0.9 })));
  awning.position.y = 2.65; awning.rotation.x = -0.12; g.add(awning);
  const counter = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 0.8), dark)); counter.position.set(0, 0.45, -0.7); g.add(counter);
  // Goods on the counter.
  const goods = kind === 'fruit' ? [0xffb51f, 0xf2d43a, 0x6aa83a, 0xe8662a] : kind === 'treats' ? [0xd9a560, 0x8a4f2a, 0xf0e2c0] : kind === 'clothes' ? [0x7a4fb0, 0x2f8fd8, 0x2e9a4a, 0xf2c21b] : [0xb8743a, 0x2f8c6a, 0xd8452f];
  for (let i = 0; i < 9; i++) {
    const shape = kind === 'clothes' ? new THREE.BoxGeometry(0.32, 0.06, 0.26) : kind === 'crafts' ? new THREE.CylinderGeometry(0.1, 0.13, 0.28, 10) : new THREE.SphereGeometry(0.11, 12, 10);
    const m = shadowed(new THREE.Mesh(shape, mat(goods[i % goods.length], { roughness: 0.6 })));
    m.position.set(-1.2 + (i % 5) * 0.6, 0.98 + Math.floor(i / 5) * 0.08, -0.7 + (Math.floor(i / 5) - 0.5) * 0.25); g.add(m);
  }
  if (kind === 'clothes') {                                   // a rail of shirts hanging at the back
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.8, 8), mat(0xcfcfcf, { metalness: 0.6, roughness: 0.3 }));
    rail.rotation.z = Math.PI / 2; rail.position.set(0, 2.1, 0.9); g.add(rail);
    [0xf06a2a, 0x2f8fd8, 0x2e9a4a, 0x8a4fd0, 0xf2c21b].forEach((c, i) => {
      const shirt = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.06), mat(c)));
      shirt.position.set(-1.1 + i * 0.55, 1.78, 0.9); g.add(shirt);
    });
  }
  g.rotation.y = facing;
  return g;
}

// A Queenslander-style shopfront: raised timber building, deep veranda, iron roof.
function shopfront(w, colour) {
  const g = new THREE.Group();
  const wall = mat(colour, { roughness: 0.9 }), trim = mat(0xf4f1e8, { roughness: 0.7 }), roof = mat(0x4d7a52, { roughness: 0.55, metalness: 0.4 });
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, 7), wall)); body.position.set(0, 2.6, 2.5); g.add(body);
  const floor = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.3, 10), mat(0x8a6a48))); floor.position.set(0, 0.5, 1); g.add(floor);
  const top = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.2, 10.6), roof)); top.position.set(0, 4.9, 1); top.rotation.x = 0.05; g.add(top);
  for (let x = -w / 2 + 0.4; x <= w / 2 - 0.3; x += 2.4) {
    const p = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.15, 4.2, 0.15), trim)); p.position.set(x, 2.6, -3.7); g.add(p);
  }
  const rail = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), trim)); rail.position.set(0, 1.6, -3.7); g.add(rail);
  for (let x = -w / 2 + 1.2; x < w / 2 - 0.6; x += 2.4) {          // shop windows, warm inside
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.08), mat(0x5a4a2e, { emissive: 0xffc06a, emissiveIntensity: 0.35, roughness: 0.2 }));
    win.position.set(x, 2.4, -1.02); g.add(win);
  }
  return g;
}

// The Skyrail: a cable high over the treetops with gondolas gliding along it.
function skyrail(scene) {
  const y = 34, x0 = -260, x1 = 260, z = 120;
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, x1 - x0, 6), mat(0x333333));
  cable.rotation.z = Math.PI / 2; cable.position.set(0, y, z); scene.add(cable);
  for (const x of [-180, -60, 60, 180]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, y + 6, 6), mat(0x2f4f3a, { metalness: 0.4 }));
    tower.position.set(x, (y - 6) / 2, z - 0.6); scene.add(tower);
  }
  const gondolas = [];
  const cabinMat = mat(0x2f6b45, { roughness: 0.4, metalness: 0.3 }), glass = mat(0x9fd4e6, { roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.1), mat(0xbfc4c8, { metalness: 0.8, roughness: 0.3 })); arm.position.y = -0.9; g.add(arm);
    const cab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 1.6), cabinMat)); cab.position.y = -2.5; g.add(cab);
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.7, 1.65), glass); win.position.y = -2.3; g.add(win);
    g.position.set(x0 + i * (x1 - x0) / 9, y, z); scene.add(g); gondolas.push(g);
  }
  return t => gondolas.forEach((g, i) => { g.position.x = x0 + (((i / 9) + t * 0.012) % 1) * (x1 - x0); g.rotation.z = Math.sin(t * 0.8 + i) * 0.03; });
}

export function buildKuranda(scene, q, realism = null) {
  let seed = 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  addSky(scene);
  const sun = addLights(scene, q);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
  scene.add(sun.target);
  if (realism && realism.sky) {
    applySky(scene, realism, sun, scene.children.find(o => o.isMesh && o.geometry.type === 'SphereGeometry'));
    scene.environmentIntensity = 0.45;
    scene.fog.near = 90; scene.fog.far = 420;
  }
  const ranges = addRanges(scene, new THREE.Color(0x8fb2a8), sun.position.clone().normalize(), { sink: 0 });

  // Ground: a paved street through the village, grass and rainforest floor either side.
  const len = STREET.z1 - STREET.z0, mid = (STREET.z0 + STREET.z1) / 2;
  const street = surfaceMaterial(realism, 'paving', STREET.half * 2 / 2.4, len / 2.4, { color: 0xd8c6b0 }) || mat(0xc8b49a);
  const road = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(STREET.half * 2, len), street), false, true);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, mid); scene.add(road);
  const lawn = surfaceMaterial(realism, 'grass', 300 / 3, 500 / 3, { color: 0xc8d4b8 }) || mat(0x5f8f42);
  const field = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(300, 500), lawn), false, true);
  field.rotation.x = -Math.PI / 2; field.position.set(0, -0.01, mid); scene.add(field);
  const grass = new Grass(scene, {
    x0: -40, x1: 40, z0: STREET.z0, z1: STREET.z1 + 10, heightAt: () => 0,
    tufts: q.name === 'high' ? 30000 : q.name === 'medium' ? 14000 : 4000,
    density: x => Math.abs(x) < STREET.half + 0.3 ? 0 : Math.abs(x) < 12 ? 0.5 : 1.3,
  });

  // Stalls and shopfronts.
  const stallMeshes = STALLS.map(([x, z, kind]) => { const s = stall(kind, x > 0 ? -Math.PI / 2 : Math.PI / 2); s.position.set(x, 0, z); scene.add(s); return s; });
  const fronts = [0xf2e3c4, 0xdcebd8, 0xf5d6c2, 0xe4dcf0, 0xf0e9b8];
  for (let z = 6; z < STREET.z1 - 20; z += 22 + rnd() * 8) for (const side of [-1, 1]) {
    const f = shopfront(10 + rnd() * 4, fronts[Math.floor(rnd() * fronts.length)]);
    f.position.set(side * 19, 0, z + side * 6); f.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(f);   // verandas face the street
  }

  // The rainforest: Ken's trees, thick beyond the village.
  const trees = new Trees(scene, { light: q.name === 'low' });
  const count = q.name === 'high' ? 600 : q.name === 'medium' ? 380 : 180;
  for (let n = 0, tries = 0; n < count && tries < count * 10; tries++) {
    const x = (rnd() * 2 - 1) * 150, z = STREET.z0 - 40 + rnd() * (len + 120);
    if (Math.abs(x) < 28 && z > STREET.z0 - 6 && z < STREET.z1 + 6) continue;   // keep the village clear
    const r = rnd();
    if (r < 0.45) trees.add('umbrella', x, 0, z, 10 + rnd() * 6);
    else if (r < 0.8) trees.add('eucalyptus', x, 0, z, 16 + rnd() * 12);
    else trees.add('palm', x, 0, z, 10 + rnd() * 5);
    n++;
  }
  // A few shade trees right along the street.
  for (let z = 0; z < STREET.z1 - 10; z += 26) for (const side of [-1, 1]) trees.add('umbrella', side * 12, 0, z + side * 9 + 13, 8 + rnd() * 3);
  trees.build();

  // The Barron Falls trail gate at the end of the street.
  const gate = new THREE.Group();
  const timber = mat(0x6e4a2c);
  for (const s of [-1, 1]) { const p = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), timber)); p.position.set(s * (STREET.half + 0.3), 2.5, 0); gate.add(p); }
  const beam = shadowed(new THREE.Mesh(new THREE.BoxGeometry(STREET.half * 2 + 1.6, 0.6, 0.6), timber)); beam.position.y = 5; gate.add(beam);
  const sign = document.createElement('canvas'); sign.width = 512; sign.height = 96;
  { const g = sign.getContext('2d'); g.fillStyle = '#3d2a18'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#f6e7c4'; g.font = 'bold 52px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.fillText('Barron Falls trail', 256, 64); }
  const signTex = new THREE.CanvasTexture(sign); signTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), mat(0xffffff, { map: signTex })); board.position.set(0, 4.1, -0.32); board.rotation.y = Math.PI; gate.add(board);
  const bar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(STREET.half * 2, 0.15, 0.15), mat(0xd8452f))); bar.position.y = 1.1; gate.add(bar);
  gate.position.set(0, 0, TRAIL_Z); scene.add(gate);

  const glide = skyrail(scene);
  return { sun, ranges, trees, grass, stalls: stallMeshes, gate, bar,
    update(t) { trees.update(t); grass.update(t); glide(t); } };
}
