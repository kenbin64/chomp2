// esplanade-scene.js
// The Cairns Esplanade, built for the run: the promenade, mudflats, mangroves
// and sea on one side (-x), fig trees, palms, picnic shelters and hotels on the
// other (+x), and the Lagoon pool at the finish. Scenery and the obstacle
// models only; what happens is in esplanade.js.

import * as THREE from 'three';
import { PATH } from './esplanade-rules.js';
import { addSky, addLights, addHorizon, addRanges, palm } from '../world.js';
import { palmStand } from '../palms.js';
import { Trees } from '../trees.js';
import { Grass } from '../grass.js';
import { surfaceMaterial, applySky } from '../realism.js';
import { Water } from 'three/addons/objects/Water.js';
import { person } from '../tourists.js';
import { pelicanModel } from '../hazards.js';

const G = PATH.ground;

function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }); }
function shadowed(m, cast = true, receive = true) { m.castShadow = cast; m.receiveShadow = receive; return m; }
function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function plane(w, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
  return m;
}

const LENGTH = PATH.finish + 120;
const MID = (PATH.finish + 60) / 2 - 30;

// The boardwalk, on piles over the water, with the ocean beside it and the
// city side level with the deck. The sea side has no rail: Wally can jump in.
// Ken (2026-10-17): wood with a grain, grass with life, an ocean as vibrant as
// the park's. The photographed surfaces (realism.js) are used where present.
function lawnMaterial(realism) {
  const m = surfaceMaterial(realism, 'grass', 160 / 3, LENGTH / 3, { vertexColors: true });
  return m || mat(0xffffff, { vertexColors: true });
}
function addGround(scene, realism, q) {
  // City-side lawn: the photographed grass, tinted in broad lush and dry patches.
  const lawnGeo = new THREE.PlaneGeometry(160, LENGTH, 80, 160);
  lawnGeo.rotateX(-Math.PI / 2);
  const lp = lawnGeo.attributes.position, lc = new Float32Array(lp.count * 3), c = new THREE.Color();
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i) + PATH.half + 80, z = lp.getZ(i) + MID;
    c.setRGB(0.82, 0.86, 0.78);
    const n = Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.5 + Math.sin(x * 0.037 + z * 0.029) * 0.5;
    const dry = Math.max(0, Math.sin(x * 0.053 + 1.3) * Math.cos(z * 0.047 - 0.7));
    c.lerp(new THREE.Color(1.0, 0.93, 0.62), dry * 0.35).multiplyScalar(1 + n * 0.2);
    if (!realism) c.multiply(new THREE.Color(0x67a34a));
    c.toArray(lc, i * 3);
  }
  lawnGeo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const lawn = new THREE.Mesh(lawnGeo, lawnMaterial(realism));
  lawn.position.set(PATH.half + 80, G - 0.02, MID); lawn.receiveShadow = true; scene.add(lawn);
  // Real grass tufts on the lawn, from the kerb out past the trees.
  const grass = new Grass(scene, {
    x0: PATH.half + 0.6, x1: PATH.half + 46, z0: -30, z1: PATH.finish + 30, heightAt: () => G,
    tufts: q.name === 'high' ? 30000 : q.name === 'medium' ? 14000 : 4000,
    density: x => x < PATH.half + 1.2 ? 0.4 : 1,
  });

  // The boardwalk: photographed hardwood planks with their grain and wear,
  // running across the walk, with a darker gap between boards.
  const real = surfaceMaterial(realism, 'planks', PATH.half * 2 / 3.6, LENGTH / 3.6);   // boards about 28 cm wide, so the grain reads
  const planks = canvasTexture(256, 256, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = ['#a77a4f', '#9b6f45', '#b0845a', '#986a40'][i % 4]; g.fillRect(i * 32, 0, 30, h);
      g.fillStyle = 'rgba(60,35,15,0.5)'; g.fillRect(i * 32 + 30, 0, 2, h);
    }
  }, [1, LENGTH / 3]);
  const deck = shadowed(new THREE.Mesh(new THREE.BoxGeometry(PATH.half * 2, 0.25, LENGTH), real || mat(0xffffff, { map: planks })), false, true);
  deck.position.set(0, G - 0.125, MID); scene.add(deck);
  const pile = new THREE.CylinderGeometry(0.16, 0.18, G + 5.5, 10), wood = mat(0x5e4630);   // down to the sea floor
  for (let z = -30; z < PATH.finish + 4; z += 4) {
    const p = new THREE.Mesh(pile, wood); p.position.set(-PATH.half + 0.2, (G - 5.5) / 2, z); scene.add(p);
  }
  const kerb = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, LENGTH), mat(0x8a6a48)));
  kerb.position.set(PATH.half + 0.15, G + 0.07, MID); scene.add(kerb);
  // The sea: right up to the boardwalk, out to the horizon, over a sandy floor.
  // Where the ripple picture is present (and not on low graphics) it is the
  // park's reflective water, in a brighter tropical blue-green; otherwise plain.
  let sea, ripple = () => {};
  if (realism && realism.waterNormals && q.name !== 'low') {
    sea = new Water(new THREE.PlaneGeometry(900, LENGTH + 600), {
      textureWidth: q.name === 'high' ? 512 : 256, textureHeight: q.name === 'high' ? 512 : 256,
      waterNormals: realism.waterNormals, sunDirection: new THREE.Vector3(-0.6, 0.7, -0.4).normalize(),
      sunColor: 0xfff1d6, waterColor: 0x0f8fa8, distortionScale: 2.2, fog: !!scene.fog,
    });
    sea.material.uniforms.size.value = 2.4;
    ripple = t => { sea.material.uniforms.time.value = t * 0.6; };
  } else {
    sea = new THREE.Mesh(new THREE.PlaneGeometry(900, LENGTH + 600), new THREE.MeshPhongMaterial({ color: 0x2aa3c4, specular: 0xffffff, shininess: 70, transparent: true, opacity: 0.92 }));
  }
  sea.rotation.x = -Math.PI / 2; sea.position.set(-450 + PATH.half, 0, MID); sea.receiveShadow = true; scene.add(sea);
  sea.userData.ripple = ripple; sea.userData.grass = grass;
  // The sea floor sits 5.5 m down: deeper than the real mudflats, so Wally has
  // room to swim under the water (SEA_FLOOR in esplanade.js).
  const floor = plane(900, LENGTH + 600, mat(0xb8a47a), -450 + PATH.half, -5.5, MID);
  floor.name = 'shallow-sea-floor';                  // hidden while Wally dives to the reef below it
  scene.add(floor);
  return sea;
}

function mangrove(x, z, s) {
  const g = new THREE.Group();
  const root = mat(0x5b4632), leaf = mat(0x2f5f2c);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6), root));
    r.position.set(Math.cos(a) * 0.6, 0.6, Math.sin(a) * 0.6); r.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(r);
  }
  for (let i = 0; i < 5; i++) {
    const c = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 0.5, 16, 12), leaf));
    c.position.set((Math.random() - 0.5) * 1.6, 1.8 + Math.random() * 0.8, (Math.random() - 0.5) * 1.6); c.scale.y = 0.7;
    g.add(c);
  }
  g.position.set(x, -1.2, z); g.scale.setScalar(s);             // standing in the shallows
  return g;
}

// A big shady fig: thick trunk, hanging roots, a wide dark-green crown.
function fig(x, z, s) {
  const g = new THREE.Group();
  const bark = mat(0x8a7a66), leaf = mat(0x2e6b2e);
  g.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 5, 16), bark)));
  g.children[0].position.y = 2.5;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const r = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 6), bark));
    r.position.set(Math.cos(a) * 2.5, 2.8, Math.sin(a) * 2.5); g.add(r);
  }
  for (let i = 0; i < 9; i++) {
    const c = shadowed(new THREE.Mesh(new THREE.SphereGeometry(2.2 + Math.random(), 18, 14), leaf));
    c.position.set((Math.random() - 0.5) * 6, 6 + Math.random() * 1.5, (Math.random() - 0.5) * 6); c.scale.y = 0.65;
    g.add(c);
  }
  g.position.set(x, G, z); g.scale.setScalar(s);
  return g;
}

// Buildings with depth (Ken: not cold facades): each tower has balconies that
// stand out from the walls, a darker recessed glass band per floor, a rooftop
// parapet and plant room, an awning and shopfront at street level, and a few
// stepped back. Warm render colours, lit windows here and there.
function balconyTower(rnd, w, h, d, colour) {
  const g = new THREE.Group();
  const wall = mat(colour, { roughness: 0.92 });
  const trim = mat(0xf7f2e8, { roughness: 0.6 });
  const glass = mat(0x3d5a6e, { roughness: 0.15, metalness: 0.4, envMapIntensity: 1.2 });
  const lit = mat(0x6b5a3a, { roughness: 0.2, emissive: 0xffc06a, emissiveIntensity: 0.6 });
  const rail = mat(0xe9edf0, { roughness: 0.4, metalness: 0.3 });
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall)); body.position.y = h / 2; g.add(body);
  const floors = Math.max(2, Math.floor((h - 4) / 3.2));
  for (let f = 0; f < floors; f++) {
    const y = 4 + f * 3.2;
    // Recessed glass band on the side facing the water (-x).
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, d * 0.82), rnd() < 0.12 ? lit : glass);
    band.position.set(-w / 2 - 0.02, y + 1.1, 0); g.add(band);
    // A balcony slab with a railing, standing out 1.2 m.
    const slab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, d * 0.9), trim)); slab.position.set(-w / 2 - 0.6, y, 0); g.add(slab);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, d * 0.9), rail); r.position.set(-w / 2 - 1.17, y + 0.55, 0); g.add(r);
    // Windows along the ends too.
    for (const sz of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.5, 0.1), rnd() < 0.12 ? lit : glass);
      win.position.set(0, y + 1.1, sz * (d / 2 + 0.02)); g.add(win);
    }
  }
  // Rooftop parapet and a small plant room.
  const par = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.8, d + 0.4), trim)); par.position.y = h + 0.4; g.add(par);
  const room = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w * 0.35, 2.4, d * 0.4), wall)); room.position.set(w * 0.15, h + 1.2, 0); g.add(room);
  // Street level: a colourful awning and a warm shopfront.
  const awn = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, d * 0.95), mat([0xd2553a, 0x2f8f7a, 0xe0a030, 0x3a6fb0][Math.floor(rnd() * 4)])));
  awn.position.set(-w / 2 - 1.1, 3.1, 0); awn.rotation.z = 0.18; g.add(awn);
  const shop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, d * 0.8), lit); shop.position.set(-w / 2 - 0.03, 1.4, 0); g.add(shop);
  return g;
}

function windowsTexture(base) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 22) for (let x = 8; x < w; x += 24) {
      g.fillStyle = Math.random() < 0.15 ? '#ffe9a8' : '#4b6a80'; g.fillRect(x, y, 14, 12);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y + 13, 14, 3);        // balcony rail
    }
  });
}

function addCity(scene, rnd) {
  const colours = [0xf2e6d2, 0xe6efe9, 0xf5dcc0, 0xd8e8e1, 0xfaf4ea, 0xefd2bd, 0xf0e2a8];
  for (let z = -30; z < PATH.finish + 60; z += 18 + rnd() * 10) {
    const h = 10 + rnd() * 34, w = 12 + rnd() * 10, d = 12 + rnd() * 6;
    const b = balconyTower(rnd, w, h, d, colours[Math.floor(rnd() * colours.length)]);
    b.position.set(42 + rnd() * 20, G, z); scene.add(b);
    if (h > 26 && rnd() < 0.5) {                                   // a stepped-back upper block
      const top = balconyTower(rnd, w * 0.7, 8, d * 0.75, colours[Math.floor(rnd() * colours.length)]);
      top.position.set(b.position.x + w * 0.1, G + h + 0.8, z); scene.add(top);
    }
  }
}

function shelter(scene, z) {
  const g = new THREE.Group();
  const wood = mat(0x7a5a3a), roof = mat(0x2f6e7a);
  for (const [x, zz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    const p = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), wood)); p.position.set(x, 1.3, zz); g.add(p);
  }
  const top = shadowed(new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.2, 4), roof)); top.position.y = 3.1; top.rotation.y = Math.PI / 4; g.add(top);
  const table = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 1), wood)); table.position.y = 0.8; g.add(table);
  g.position.set(PATH.half + 3.5, G, z);
  scene.add(g);
  return g;
}

function addLagoon(scene) {
  const z0 = PATH.finish + 4;
  const edge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(30, 1.4, 34), mat(0xe8dcc0)), false, true);
  edge.position.set(0, G - 1.0, z0 + 17); scene.add(edge);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(26, 30), new THREE.MeshPhongMaterial({ color: 0x29c4d6, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.88 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, G - 0.3, z0 + 17); scene.add(pool);
  const sign = canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#1d5f73'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.font = 'bold 120px "Trebuchet MS", sans-serif'; g.textAlign = 'center';
    g.fillText('Esplanade Lagoon', w / 2, 170);
  });
  const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(8, 2, 0.2), [mat(0x1d5f73), mat(0x1d5f73), mat(0x1d5f73), mat(0x1d5f73), mat(0xffffff, { map: sign }), mat(0x1d5f73)]));
  board.position.set(0, G + 5, z0 + 2); board.rotation.y = Math.PI;                // faces back down the promenade
  scene.add(board);
  for (const s of [-1, 1]) {
    const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 8), mat(0x1d5f73)));
    post.position.set(s * 3.6, G + 2, z0 + 2); scene.add(post);
  }
  return pool;
}

// ---- Obstacle and pickup models ---------------------------------------------

export function obstacleModel(kind) {
  const g = new THREE.Group();
  if (kind === 'bin') {
    const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.95, 20), mat(0x2f6b3a)));
    body.position.y = 0.48;
    const lid = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20), mat(0xf2c12e)));
    lid.position.y = 0.98; g.add(body, lid);
  } else if (kind === 'bench') {
    const wood = mat(0x9b6b3f), metal = mat(0x3a3f44);
    for (let i = 0; i < 3; i++) { const s = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.14), wood)); s.position.set(0, 0.5, -0.2 + i * 0.2); g.add(s); }
    for (const x of [-0.75, 0.75]) { const l = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.55), metal)); l.position.set(x, 0.25, 0); g.add(l); }
  } else if (kind === 'branch') {
    const log = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, PATH.half * 2 + 3, 14), mat(0x7a6a55)));
    log.rotation.z = Math.PI / 2; log.position.y = 1.55; g.add(log);
    for (let i = 0; i < 8; i++) {
      const leaf = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mat(0x2e6b2e)));
      leaf.position.set(-PATH.half + i * 1.3, 1.75 + Math.random() * 0.2, (Math.random() - 0.5) * 0.4); leaf.scale.y = 0.6; g.add(leaf);
    }
    for (const s of [-1, 1]) { const p = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.8, 10), mat(0x7a6a55))); p.position.set(s * (PATH.half + 1.3), 0.9, 0); g.add(p); }
  } else if (kind === 'pelican') {
    g.add(pelicanModel());
  } else if (kind === 'jogger') {
    const p = person();
    g.add(p.g); g.userData.person = p;
  }
  return g;
}

// Ken's mango model (models/mango.glb), when present; a soft golden glow behind
// it marks it as a Golden Mango to collect.
let mangoGltf = null, mangoGlow = null;
export function useMangoModel(gltf) { mangoGltf = gltf || null; }
export function mangoModel() {
  if (mangoGltf) {
    const g = new THREE.Group(), m = mangoGltf.scene.clone(true);
    const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
    m.scale.multiplyScalar(0.5 / Math.max(size.x, size.y, size.z));
    const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()); m.position.sub(c);
    m.traverse(o => { if (o.isMesh) o.castShadow = true; });
    if (!mangoGlow) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
      const r = x.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,214,90,0.85)'); r.addColorStop(1, 'rgba(255,190,40,0)');
      x.fillStyle = r; x.fillRect(0, 0, 64, 64); mangoGlow = new THREE.CanvasTexture(cv);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: mangoGlow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.3);
    g.add(glow, m); return g;
  }
  const g = new THREE.Group();
  const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), mat(0xffb51f, { emissive: 0xff8a00, emissiveIntensity: 0.35, roughness: 0.35 }));
  fruit.scale.set(0.85, 1, 1.15); fruit.castShadow = true; g.add(fruit);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(0x3a8f3a)); leaf.scale.set(0.5, 0.25, 1.4); leaf.position.set(0, 0.22, -0.08); g.add(leaf);
  return g;
}

// ---- Build it ---------------------------------------------------------------

export function buildEsplanade(scene, q, backdrops = {}, realism = null) {
  let seed = 21;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  addSky(scene, backdrops.sky);
  const sun = addLights(scene, q);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
  sun.target.position.set(0, 0, 0); scene.add(sun.target);
  const ring = addHorizon(scene, backdrops.ring);
  // The painted horizon's haze is see-through and looked like a white veil over
  // the sea (Ken), so the Esplanade has the park's solid 3D ranges instead: green
  // hills behind the city, lower ones across the water (as across Trinity Inlet
  // from the real Esplanade). The sea is to the west (-x) here, hence the turn.
  ring.visible = false; ring.userData.off = true;
  // A cool blue haze keeps them rainforest green (the warm sunset haze turned them sandy).
  const ranges = addRanges(scene, new THREE.Color(0x9cbcc8), sun.position.clone().normalize(), { sink: 1, turn: Math.PI / 2 });   // Ken: open water out to sea (Trinity Bay); the ranges stay behind the city and reach out a little along the coast
  const sea = addGround(scene, realism, q);
  // The park's photographed blue sky (Ken: the ocean as vibrant as the park's;
  // the pale sunset made the water reflect pale). It lights the scene too.
  if (realism && realism.sky) {
    applySky(scene, realism, sun, scene.children.find(o => o.isMesh && o.geometry.type === 'SphereGeometry'));
    scene.fog.near = 140; scene.fog.far = 600;
    scene.environmentIntensity = 0.35;     // the open waterfront takes much less sky light than the park (at 0.9 it washed out)
  }
  // Ken's trees (trees.js): palms along the path in stands of one to three, kept
  // clear of it, and ghost gums and umbrella trees on the city side, where the
  // built figs used to be. (The built mangroves in the water are gone until
  // there is a mangrove model; see MODELS.md.)
  const trees = new Trees(scene, { light: q.name === 'low' });
  for (let z = -10; z < PATH.finish; z += 14 + rnd() * 6) {
    for (const t of palmStand(PATH.half + 2.6, z, rnd, { minH: 6, maxH: 11 })) trees.add('palm', Math.max(PATH.half + 1.0, t.x), G, t.z, t.height + 2);
  }
  for (let z = -20; z < PATH.finish + 20; z += 12 + rnd() * 10) {
    const x = 13 + rnd() * 14;
    if (rnd() < 0.5) trees.add('eucalyptus', x, G, z, 13 + rnd() * 8);
    else trees.add('umbrella', x, G, z, 7 + rnd() * 4);
  }
  trees.build();
  addCity(scene, rnd);
  const pool = addLagoon(scene);
  return { sun, ring, ranges, pool, sea, trees, shelter: z => shelter(scene, z) };
}
