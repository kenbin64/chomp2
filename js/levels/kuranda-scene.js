// kuranda-scene.js
// Kuranda, the village in the rainforest: one main street of market stalls
// under the canopy, rainforest all round (Ken's trees), the ranges behind,
// and the Skyrail gondolas gliding over the treetops. At the far end, the
// trail to Barron Falls. Stalls, shopfronts and gondolas are built here as
// placeholders until Ken's Meshy models arrive (MODELS.md, Kuranda section).

import { fitText } from '../signtext.js';
import * as THREE from 'three';
import { addSky, addLights, addRanges } from '../world.js';
import { marketStall, queenslander, overStreet, setMarketNight, bakeStall, stockedCanopy, placeModel, paverTexture, leafCanopy, chalkboard, clothesRack, edgeRocks } from './kuranda-market.js';
import { shopVariant, WALLS, ROOFS, NAMES } from './kuranda-shops.js';
import { Trees } from '../trees.js';
import { Grass } from '../grass.js';
import { surfaceMaterial, applySky } from '../realism.js';

export const STREET = { half: 5, z0: -10, z1: 230, ground: 0 };
export const TRAIL_Z = 222;                        // the gate onto the Barron Falls trail
export const VILLAGE_END = 64;                     // shopfronts up to here, then the market stalls
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

export function buildKuranda(scene, q, realism = null, models = new Map()) {
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
  // Brick pavers like Ken's photo of the real markets, right across to the shops.
  const street = new THREE.MeshStandardMaterial({ map: paverTexture(STREET.half * 2 / 2.2, len / 2.2), roughness: 0.9 });
  const road = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(STREET.half * 2, len), street), false, true);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, mid); scene.add(road);
  // Kuranda is in the middle of the rainforest (Ken): no grassland. The ground is
  // rainforest floor, leaf litter, dark soil and moss, under a thick forest.
  const litter = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#3b2e1f'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${40 + rnd() * 30},${60 + rnd() * 40},${25 + rnd() * 15},${0.25 + rnd() * 0.3})`; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 10 + rnd() * 40, 0, Math.PI * 2); g.fill(); }   // moss
    for (let i = 0; i < 2200; i++) {                                 // fallen leaves
      const x = rnd() * 512, y = rnd() * 512, a = rnd() * Math.PI, l = 5 + rnd() * 9;
      const tone = [[110, 70, 35], [140, 95, 45], [90, 60, 30], [70, 85, 40], [160, 110, 55]][Math.floor(rnd() * 5)];
      g.fillStyle = `rgba(${tone},${0.6 + rnd() * 0.4})`; g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, l, l * 0.4, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(300 / 6, 500 / 6); t.anisotropy = 4; return t;
  })();
  const field = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(300, 500), new THREE.MeshStandardMaterial({ map: litter, color: 0x7f9a6a, roughness: 1 })), false, true);   // shaded, mossy green-brown
  field.rotation.x = -Math.PI / 2; field.position.set(0, -0.01, mid); scene.add(field);
  const grass = { update() {} };                                   // no grass in the rainforest

  // The market (Ken: rustic and hippy, like a bazaar or farmers market, like the
  // real Kuranda markets): the stalls the game uses, more stalls filling the
  // gaps so it is one rambling bazaar, a mulched floor under them, and over the
  // street bunting, shade sails and fairy lights (kuranda-market.js).
  const SIGNS = { fruit: 'Tropical Fruit', treats: 'Honey & Jams', crafts: 'Rainforest Crafts', clothes: 'Hippie Threads' };
  const face = x => (x > 0 ? -Math.PI / 2 : Math.PI / 2);
  let tone = 0;
  const market = new THREE.Group();                    // built stalls, merged together at the end
  const canopy = models.get('kuranda-canopy'), artHut = models.get('kuranda-art');
  // A stall: Ken's canopy stocked with the vendor's things, or a built stall without it.
  const stall = (kind, sign, t, x, z, side) => {
    if (canopy) { const c = stockedCanopy(canopy, kind, sign, t); c.position.set(side * 8.4, 0, z); c.rotation.y = face(side); scene.add(c); return c; }
    const s = marketStall(kind, sign, { roof: t % 3 === 2 ? 'canvas' : 'iron', tone: t }); s.position.set(x, 0, z); s.rotation.y = face(side); market.add(s); return s;
  };
  const stallMeshes = STALLS.map(([x, z, kind]) => stall(kind, x === VENDOR.x && z === VENDOR.z ? 'Shells & Mangoes' : SIGNS[kind], tone++, x, z, Math.sign(x)));
  const EXTRA = [['fruit', 'Organic Veggies'], ['crafts', 'Crystals & Gems'], ['clothes', 'Tie-Dye'], ['treats', 'Local Coffee'], ['clothes', 'Leather & Hats'],
                 ['crafts', 'Pottery'], ['fruit', 'Fresh Juice'], ['treats', 'Bush Honey'], ['crafts', 'Hand-made Soap'], ['fruit', 'Dragonfruit']];
  let e = 0;
  // Ken: less dense. A few more stalls in the gaps, well spaced, sides taking turns.
  let flip = 1;
  for (let z = VILLAGE_END + 6; z < TRAIL_Z - 10; z += 19.5) {
    const side = (flip = -flip);
    if (STALLS.some(([sx, sz]) => Math.abs(sz - z) < 9)) continue;
    const [kind, sign] = EXTRA[e++ % EXTRA.length];
    stall(kind, sign, e, side * 8.2, z, side);
  }
  scene.add(bakeStall(market));
  // A mulched floor under the stalls, between the street and the houses.
  // The pavers carry on under the stalls to the shopfronts (no dirt strips).
  const sidePavers = new THREE.MeshStandardMaterial({ map: paverTexture(7 / 2.2, len / 2.2), roughness: 0.9 });
  for (const side of [-1, 1]) { const m = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(7, len), sidePavers), false, true); m.rotation.x = -Math.PI / 2; m.position.set(side * 8.6, 0.015, mid); scene.add(m); }
  // Out front of the stalls: rainbow chalkboard signs, clothes racks, rocks.
  const BOARDS = [['Local art', 'Wall hangings', 'Tie-dye'], ['Henna', 'Tattoos', 'Braids'], ['Fresh juice', 'Smoothies', '$5'], ['Crystals', 'Healing', 'Gems'],
                  ['Hand made', 'Jewellery'], ['Hats', 'Leather', 'Bags'], ['Organic', 'Coffee', 'Open'], ['Portraits', 'While U wait']];
  const front = new THREE.Group();
  let fb = 0;
  for (const side of [-1, 1]) for (let z = STREET.z0 + 5; z < TRAIL_Z - 6; z += 9 + rnd() * 6) {
    const x = side * (STREET.half + 0.7);
    if (rnd() < 0.55) { const b = chalkboard(BOARDS[fb++ % BOARDS.length], fb); b.position.set(x, 0, z); b.rotation.y = side > 0 ? -Math.PI / 2 + 0.4 : Math.PI / 2 - 0.4; front.add(b); }
    else if (rnd() < 0.6) { const r = clothesRack(fb++); r.position.set(x + side * 0.4, 0, z); r.rotation.y = Math.PI / 2; front.add(r); }
    else { const r = edgeRocks(rnd); r.position.set(x, 0, z); front.add(r); }
  }
  scene.add(bakeStall(front));
  overStreet(scene, STREET.half, STREET.z0, TRAIL_Z - 6);
  // Queenslanders behind the market (Ken: the bungalows looked cheap).
  const fronts = ['#f2e3c4', '#dcebd8', '#f5d6c2', '#e4dcf0', '#f0e9b8', '#cfe3ea'], shutters = ['#2f6b5a', '#8a3b2a', '#2f4f7a', '#6a4a8a'];
  // The village end of the street: a row of shops facing the street, every one
  // Ken's village shop model repainted and renamed (kuranda-shops.js), with the
  // stalls the game needs standing in among them. (Without the model, stalls.)
  // Ken: the black-trim village shops are replaced by his canopy stocked with
  // goods, spaced out so the street is not crowded.
  const shopModel = artHut || models.get('kuranda-shop');
  let n = 0;
  for (const side of [-1, 1]) for (let z = STREET.z0 + 6 + (side > 0 ? 8 : 0); z < VILLAGE_END - 4; z += 17) {
    if (STALLS.some(([sx, sz]) => Math.sign(sx) === side && Math.abs(sz - z) < 8)) continue;
    const [kind, sign] = EXTRA[e++ % EXTRA.length];                 // Ken: the black-trim shops become stocked canopies
    stall(kind, sign, e, side * 8.2, z, side);
    n++;
  }
  // Queenslanders further back, both sides.
  const houses = new THREE.Group();
  for (let z = 6; z < STREET.z1 - 20; z += 32 + rnd() * 8) for (const side of [-1, 1]) {
    if (artHut) {                                                  // Ken: his colourful art hut replaces the white houses
      const h = placeModel(artHut, 6.2); h.position.set(side * 18, 0, z + side * 6); h.rotation.y = face(side); scene.add(h);
      continue;
    }
    const f = queenslander(10 + rnd() * 4, fronts[Math.floor(rnd() * fronts.length)], shutters[Math.floor(rnd() * shutters.length)]);
    f.position.set(side * 20, 0, z + side * 6); f.rotation.y = face(side); houses.add(f);   // verandas face the street
  }
  scene.add(bakeStall(houses));


  // The rainforest: Ken's trees, thick beyond the village.
  const trees = new Trees(scene, { light: q.name === 'low' });
  // Ken: not a lot of trees, just dense enough to cover everything: fewer, bigger trees.
  const count = q.name === 'high' ? 420 : q.name === 'medium' ? 300 : 160;
  for (let n = 0, tries = 0; n < count && tries < count * 10; tries++) {
    const x = (rnd() * 2 - 1) * 120, z = STREET.z0 - 40 + rnd() * (len + 120);
    if (Math.abs(x) < 22 && z > STREET.z0 - 6 && z < STREET.z1 + 6) continue;   // the forest closes in right behind the buildings
    const r = rnd();
    if (r < 0.55) trees.add('umbrella', x, 0, z, 16 + rnd() * 8);
    else if (r < 0.85) trees.add('eucalyptus', x, 0, z, 22 + rnd() * 12);
    else trees.add('palm', x, 0, z, 12 + rnd() * 5);
    n++;
  }
  // The understorey: smaller trees and palms under the tall ones, thick close to the village.
  const under = q.name === 'high' ? 160 : q.name === 'medium' ? 110 : 60;
  for (let n = 0, tries = 0; n < under && tries < under * 10; tries++) {
    const side = rnd() < 0.5 ? -1 : 1, x = side * (21 + Math.pow(rnd(), 1.6) * 60), z = STREET.z0 - 20 + rnd() * (len + 40);
    trees.add(rnd() < 0.55 ? 'umbrella' : 'palm', x, 0, z, 4 + rnd() * 6); n++;
  }
  // Trees right at the lane's edges, leaning over it: the green canopy and dappled shade of Ken's photo.
  for (const side of [-1, 1]) for (let z = STREET.z0 + 3 + (side > 0 ? 6 : 0); z < TRAIL_Z - 4; z += 12 + rnd() * 4) {
    if (STALLS.some(([sx, sz]) => Math.sign(sx) === side && Math.abs(sz - z) < 3)) continue;
    trees.add('umbrella', side * (STREET.half + 3.2), 0, z, 13 + rnd() * 4);
  }
  // A few shade trees right along the street.
  for (let z = 0; z < STREET.z1 - 10; z += 26) for (const side of [-1, 1]) trees.add('umbrella', side * 12, 0, z + side * 9 + 13, 8 + rnd() * 3);
  // Greenery close round the market (Ken: lots of plants around): small palms
  // and umbrella trees between the stalls and beside the buildings, from the
  // same tree pictures as the forest so they look as good.
  for (const side of [-1, 1]) for (let z = STREET.z0 + 4; z < TRAIL_Z - 6; z += 7 + rnd() * 4) {
    const x = side * (STREET.half + 1.6 + rnd() * 1.4);
    if (STALLS.some(([sx, sz]) => Math.sign(sx) === side && Math.abs(sz - z) < 2.6)) continue;
    trees.add(rnd() < 0.6 ? 'palm' : 'umbrella', x, 0, z, 2.6 + rnd() * 2.2);
  }
  for (const side of [-1, 1]) for (let z = 4; z < STREET.z1 - 14; z += 10 + rnd() * 6) trees.add(rnd() < 0.5 ? 'palm' : 'umbrella', side * (15.5 + rnd() * 3), 0, z, 4 + rnd() * 4);
  trees.build();

  // The Barron Falls trail gate at the end of the street.
  const gate = new THREE.Group();
  const timber = mat(0x6e4a2c);
  for (const s of [-1, 1]) { const p = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), timber)); p.position.set(s * (STREET.half + 0.3), 2.5, 0); gate.add(p); }
  const beam = shadowed(new THREE.Mesh(new THREE.BoxGeometry(STREET.half * 2 + 1.6, 0.6, 0.6), timber)); beam.position.y = 5; gate.add(beam);
  const sign = document.createElement('canvas'); sign.width = 512; sign.height = 96;
  { const g = sign.getContext('2d'); g.fillStyle = '#3d2a18'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#f6e7c4'; g.textAlign = 'center'; fitText(g, 'Barron Falls trail', 256, 64, 470, 52, 'bold {size}px "Trebuchet MS", sans-serif'); }
  const signTex = new THREE.CanvasTexture(sign); signTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), mat(0xffffff, { map: signTex })); board.position.set(0, 4.1, -0.32); board.rotation.y = Math.PI; gate.add(board);
  const bar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(STREET.half * 2, 0.15, 0.15), mat(0xd8452f))); bar.position.y = 1.1; gate.add(bar);
  gate.position.set(0, 0, TRAIL_Z); scene.add(gate);

  const glide = skyrail(scene);
  return { sun, ranges, trees, grass, stalls: stallMeshes, gate, bar,
    night: setMarketNight,                       // the fairy lights glow after dark
    update(t) { trees.update(t); grass.update(t); glide(t); } };
}
