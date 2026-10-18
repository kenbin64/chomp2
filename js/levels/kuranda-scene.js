// kuranda-scene.js
// Kuranda, the village in the rainforest: one main street of market stalls
// under the canopy, rainforest all round (Ken's trees), the ranges behind,
// and the Skyrail gondolas gliding over the treetops. At the far end, the
// trail to Barron Falls. Stalls, shopfronts and gondolas are built here as
// placeholders until Ken's Meshy models arrive (MODELS.md, Kuranda section).

import * as THREE from 'three';
import { addSky, addLights, addRanges } from '../world.js';
import { marketStall, queenslander, overStreet, setMarketNight, bakeStall } from './kuranda-market.js';
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

  // The market (Ken: rustic and hippy, like a bazaar or farmers market, like the
  // real Kuranda markets): the stalls the game uses, more stalls filling the
  // gaps so it is one rambling bazaar, a mulched floor under them, and over the
  // street bunting, shade sails and fairy lights (kuranda-market.js).
  const SIGNS = { fruit: 'Tropical Fruit', treats: 'Honey & Jams', crafts: 'Rainforest Crafts', clothes: 'Hippie Threads' };
  const face = x => (x > 0 ? -Math.PI / 2 : Math.PI / 2);
  let tone = 0;
  const market = new THREE.Group();                    // every stall, merged together at the end
  const stallMeshes = STALLS.map(([x, z, kind]) => {
    const sign = x === VENDOR.x && z === VENDOR.z ? 'Shells & Mangoes' : SIGNS[kind];
    const s = marketStall(kind, sign, { roof: tone % 3 === 2 ? 'canvas' : 'iron', tone: tone++ });
    s.position.set(x, 0, z); s.rotation.y = face(x); market.add(s); return s;
  });
  const EXTRA = [['fruit', 'Organic Veggies'], ['crafts', 'Crystals & Gems'], ['clothes', 'Tie-Dye'], ['treats', 'Local Coffee'], ['clothes', 'Leather & Hats'],
                 ['crafts', 'Pottery'], ['fruit', 'Fresh Juice'], ['treats', 'Bush Honey'], ['crafts', 'Hand-made Soap'], ['fruit', 'Dragonfruit']];
  let e = 0;
  for (const side of [-1, 1]) for (let z = STREET.z0 + 6; z < TRAIL_Z - 8; z += 6.5) {
    if (STALLS.some(([sx, sz]) => Math.sign(sx) === side && Math.abs(sz - z) < 5)) continue;
    const [kind, sign] = EXTRA[e++ % EXTRA.length];
    const s = marketStall(kind, sign, { roof: e % 3 === 0 ? 'canvas' : 'iron', tone: e, w: 3.4 + rnd() * 0.8 });
    s.position.set(side * 8.2, 0, z); s.rotation.y = face(side); market.add(s);
  }
  scene.add(bakeStall(market));
  // A mulched floor under the stalls, between the street and the houses.
  const mulch = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 1 });
  for (const side of [-1, 1]) { const m = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(7, len), mulch), false, true); m.rotation.x = -Math.PI / 2; m.position.set(side * 8.6, 0.015, mid); scene.add(m); }
  overStreet(scene, STREET.half, STREET.z0, TRAIL_Z - 6);
  // Queenslanders behind the market (Ken: the bungalows looked cheap).
  const fronts = ['#f2e3c4', '#dcebd8', '#f5d6c2', '#e4dcf0', '#f0e9b8', '#cfe3ea'], shutters = ['#2f6b5a', '#8a3b2a', '#2f4f7a', '#6a4a8a'];
  const houses = new THREE.Group();
  for (let z = 6; z < STREET.z1 - 20; z += 22 + rnd() * 8) for (const side of [-1, 1]) {
    const f = queenslander(10 + rnd() * 4, fronts[Math.floor(rnd() * fronts.length)], shutters[Math.floor(rnd() * shutters.length)]);
    f.position.set(side * 20, 0, z + side * 6); f.rotation.y = face(side); houses.add(f);   // verandas face the street
  }
  scene.add(bakeStall(houses));

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
    night: setMarketNight,                       // the fairy lights glow after dark
    update(t) { trees.update(t); grass.update(t); glide(t); } };
}
