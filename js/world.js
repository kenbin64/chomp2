// world.js
// The crocodile park: lagoon, banks, fence, the boardwalk tourists walk on,
// the sign, palms, the marina beyond, and flying foxes overhead.
// Scenery only. Where Wally may go is decided in rules.js.

import { addSolid } from './ground.js';
import { fitText } from './signtext.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAGOON, BANK_Y, BOARDWALK, ROCKS, lagoonDistance, terrainHeight, deckHeight, deckOpenAt, PARK_EDGE } from './rules.js';
import { signTexture, skyTexture, plankTexture, horizonTexture } from './textures.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { fitToSize, fitToHeight } from './models.js';
import { Water } from 'three/addons/objects/Water.js';
import { surfaceMaterial, groundMaterial, applySky } from './realism.js';
import { buildPalm, palmStand } from './palms.js';
import { addForest } from './forest.js';
import { Trees } from './trees.js';
import { Grass } from './grass.js';

const SEA_START_Z = -64;     // beyond this the park meets the harbour

// The photographic sky and scanned surfaces (realism.js), when they are present.
// Every material below falls back to its painted colour without them.
let looks = null;
export function useRealism(realism) { looks = realism; }
const looksCache = new Map();
function scanned(name, rx, ry, extra) {
  const key = `${name}|${rx}|${ry}|${JSON.stringify(extra || {})}`;
  if (!looksCache.has(key)) looksCache.set(key, surfaceMaterial(looks, name, rx, ry, extra));
  return looksCache.get(key);
}

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
}

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  return mesh;
}

// ---- Sky and light ------------------------------------------------------

// Shared with other levels: sky, sun and the horizon painting.
export { addSky, addLights, addHorizon, palm };

// The sky dome. Ken's 360 panorama (backdrops/park-sky.jpg, 2:1) replaces the painted gradient.
function addSky(scene, panorama) {
  const map = panorama || skyTexture();
  if (panorama) panorama.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 48, 32),
    new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  scene.fog = new THREE.Fog(0xf3d2b0, 120, 330);
  return sky;
}

function addLights(scene, q) {
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6b5a3a, 0.55));   // soft fill; most fill now comes from the sky light
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
  sun.position.set(-60, 70, -40);
  sun.castShadow = q.shadows;
  sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 60, bottom: -60, near: 10, far: 220 });
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 3;
  scene.add(sun);
  // A soft, cool back-light from the other side of the sky: it puts a bright
  // edge on characters and shapes, the highlight animated films use.
  const rim = new THREE.DirectionalLight(0xbfe0ff, 0.9);
  rim.position.set(50, 30, 60);
  scene.add(rim);
  return sun;
}

// The horizon painting on a huge cylinder round the park. Ken's own image
// (backdrops/park-ring.png, transparent sky) replaces the painted one.
function addHorizon(scene, image) {
  const tex = image || horizonTexture();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(330, 330, 120, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  ring.position.y = 38;
  ring.renderOrder = -1;
  scene.add(ring);
  return ring;
}

// Distant rainforest ranges, behind the park on the land side (the harbour
// side stays open to the sea). Two layers, the further one bluer and paler,
// the way distance and haze colour real hills. They are drawn unlit, with the
// shading worked out here: slopes facing the sun lighter, gullies darker, and
// a mottle for the canopy, fading into the haze at the foot.
// sink: how much they drop on the sea side (1 = down to nothing, 0.5 = half
// height, as across the water from the Esplanade); turn: turns the whole ring
// (radians) so the low side faces a level's sea. Returns the group.
//
// Parallax (Ken, 2026-10-20): three layers, near, middle and far, so the hills
// slide past one another as the camera moves, the near ones most. A level longer
// than the ring calls group.userData.follow(camera) each frame: each layer is
// carried along with the camera by its own share (the far one nearly all the way,
// the near one 70%: never so little that a level 480 m long walks through the
// near ring), which keeps them on the skyline and keeps the depth.
export function addRanges(scene, horizon, sunDir, { sink = 1, turn = 0 } = {}) {
  const group = new THREE.Group(); group.rotation.y = turn;
  const layers = [
    { r: 215, base: 3, rise: 14, colour: 0x24482e, seed: 2.9, haze: 0.08, follow: 0.7 },    // the near foothills
    { r: 290, base: 7, rise: 26, colour: 0x2e5a3c, seed: 1.7, haze: 0.2, follow: 0.85 },
    { r: 370, base: 18, rise: 40, colour: 0x557487, seed: 4.1, haze: 0.45, follow: 0.94 },
  ];
  const height = (L, a) => {
    let h = L.base + L.rise * (0.5 + 0.28 * Math.sin(a * 3 + L.seed) + 0.17 * Math.sin(a * 7.3 + L.seed * 2) + 0.05 * Math.sin(a * 19 + L.seed));
    h += 1.6 * Math.sin(a * 41 + L.seed) + 0.8 * Math.sin(a * 97);           // canopy on the skyline
    const z = Math.sin(a);
    return h * (1 - sink * Math.max(0, Math.min(1, (-z - 0.15) * 4)));       // sink toward the sea side
  };
  for (const L of layers) {
    const steps = 480, rows = 6, pos = [], col = [], idx = [];
    const base = new THREE.Color(L.colour).lerp(horizon, L.haze), c = new THREE.Color();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
      const h = height(L, a), slope = (height(L, a + 0.01) - height(L, a - 0.01)) / 0.02;
      // Which way this bit of hillside faces: outward from the park, tipped by the slope.
      const fx = x - Math.cos(a + Math.PI / 2) * slope * 0.02, fz = z - Math.sin(a + Math.PI / 2) * slope * 0.02;
      const lit = Math.max(0, (fx * sunDir.x + fz * sunDir.z) / Math.hypot(fx, fz));
      for (let k = 0; k <= rows; k++) {
        const t = k / rows, y = -2 + (Math.max(-2, h) + 2) * t;
        pos.push(x * L.r, y, z * L.r);
        const mottle = 0.08 * Math.sin(a * 230 + k * 2.1) * Math.sin(a * 77 - k);
        c.copy(base).multiplyScalar(0.82 + 0.3 * lit + mottle);
        c.lerp(horizon, (1 - t) * 0.7);                                       // the haze thickest at the foot
        c.toArray(col, col.length);
        if (i < steps && k < rows) {
          const v = i * (rows + 1) + k, n = v + rows + 1;
          idx.push(v, v + 1, n, v + 1, n + 1, n);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
    m.renderOrder = -1 - layers.indexOf(L);                     // far behind near
    m.userData.follow = L.follow;
    group.add(m);
  }
  const local = new THREE.Vector3();
  group.userData.follow = camera => {
    local.copy(camera.position); group.worldToLocal(local);
    for (const m of group.children) m.position.set(local.x * m.userData.follow, 0, local.z * m.userData.follow);
  };
  scene.add(group);
  return group;
}

// ---- Ground and water ---------------------------------------------------

// Height used for drawing. Inside the park it is exactly the game's terrain;
// past SEA_START_Z it drops away into the harbour.
export function drawnHeight(x, z) {
  if (z < SEA_START_Z) return Math.max(-2, BANK_Y - (SEA_START_Z - z) * 0.25);
  return terrainHeight(x, z);
}

function groundColour(x, z, out) {
  const d = lagoonDistance(x, z);
  const sand = new THREE.Color(0xd8bf88), wet = new THREE.Color(0x8f9a6c), grass = new THREE.Color(0x6aa548);
  if (z < SEA_START_Z + 4) return out.copy(sand);
  if (d < 1.0) return out.copy(sand).lerp(wet, Math.min(1, (1 - d) * 1.6));
  if (d < 1.16) return out.copy(sand);
  const n = Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.5 + 0.5;
  return out.copy(grass).offsetHSL(0, 0, (n - 0.5) * 0.08).lerp(sand, Math.max(0, 1.24 - d) * 10);
}

// Flat country running out from the park to meet the horizon painting, on the
// land side; the harbour side is sea. It has a hole the size of the park's own
// ground, so it never covers the lagoon.
function addFarGround(scene) {
  const half = 129;                                  // just inside the park ground's 260 m square
  const outer = new THREE.Shape();
  outer.moveTo(-380, SEA_START_Z); outer.lineTo(380, SEA_START_Z); outer.lineTo(380, 360); outer.lineTo(-380, 360); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-half, SEA_START_Z); hole.lineTo(-half, half); hole.lineTo(half, half); hole.lineTo(half, SEA_START_Z); hole.closePath();
  outer.holes.push(hole);
  const geo = new THREE.ShapeGeometry(outer);
  geo.rotateX(Math.PI / 2);                          // shape y becomes world z
  // The shape's texture coordinates are in metres, so 1/3 gives one grass tile every 3 m.
  const far = new THREE.Mesh(geo, scanned('grass', 1 / 3, 1 / 3, { side: THREE.DoubleSide, color: 0xa9b39a })
    || mat(0x5f9a45, { roughness: 1, side: THREE.DoubleSide }));
  far.position.y = BANK_Y - 0.02;
  far.receiveShadow = true;
  scene.add(far);
}

// How much of the ground is sand rather than grass. The painted look kept its
// sand mostly in the shallows, seen through clear water; real water is not see-
// through, so the sand runs further up the bank to make a beach you can see.
function sandiness(x, z) {
  if (z < SEA_START_Z + 4) return 1;
  const d = lagoonDistance(x, z);
  if (d < 1.22) return 1;
  return Math.min(1, Math.max(0, 1.32 - d) * 10);
}

// With scanned surfaces the vertex colour is only a tint over them: darker wet
// sand at the water's edge, and broad soft patches across the lawn so the
// repeat of the grass tiles does not show.
function groundTint(x, z, out) {
  const d = lagoonDistance(x, z);
  out.setRGB(0.82, 0.86, 0.78);                      // a deeper, more natural green than the bare scan (Ken: it read as flat lime)
  if (z >= SEA_START_Z + 4 && d < 1.0) out.lerp(new THREE.Color(0x8c8678), Math.min(1, (1 - d) * 1.6));
  // Broad patches: lusher and darker in places, drier and yellower in others.
  const n = Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.5 + Math.sin(x * 0.037 + z * 0.029) * 0.5;
  const dryness = Math.max(0, Math.sin(x * 0.053 + 1.3) * Math.cos(z * 0.047 - 0.7));
  out.lerp(new THREE.Color(1.0, 0.93, 0.62), dryness * 0.35 * (1 - Math.min(1, Math.max(0, 1.3 - d) * 3)));
  return out.multiplyScalar(1 + n * 0.2);
}

function addGround(scene) {
  const size = 260, seg = 200;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const real = groundMaterial(looks, size / 3, { vertexColors: true });   // one tile every 3 metres
  const colours = new Float32Array(pos.count * 3), sand = new Float32Array(pos.count);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, drawnHeight(x, z));
    (real ? groundTint(x, z, c) : groundColour(x, z, c)).toArray(colours, i * 3);
    sand[i] = sandiness(x, z);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.setAttribute('sandiness', new THREE.BufferAttribute(sand, 1));
  geo.computeVertexNormals();
  scene.add(shadowed(new THREE.Mesh(geo, real || mat(0xffffff, { vertexColors: true })), false, true));
}

// Real water: one large reflective surface at lagoon level that also forms the
// harbour, since the ground rises above it everywhere else. It reflects the
// park and sky and ripples with a moving bump picture. It draws the scene a
// second time for the reflection, so it is used on medium and high only.
function addRealWater(scene, q, sun) {
  const size = q.name === 'high' ? 512 : 256;
  const water = new Water(new THREE.PlaneGeometry(1000, 1000), {
    textureWidth: size, textureHeight: size,
    waterNormals: looks.waterNormals,
    sunDirection: sun.position.clone().normalize(),
    sunColor: 0xfff1d6,
    waterColor: 0x1f6e66,                              // green-teal: a tropical croc lagoon, not a pool
    distortionScale: 1.4,
    fog: !!scene.fog,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.02, -200);
  water.material.uniforms.size.value = 3.2;            // broader, calmer ripples
  water.userData.noAO = true;                          // not in the shading pass (it would draw the reflection again)
  scene.add(water);
  // The reflection draws the whole park a second time each frame. Things too fine
  // to see in a rippled reflection (the grass: half a million blades) are left
  // out of that drawing only (userData.noReflect).
  const mirror = water.onBeforeRender.bind(water), skipped = [];
  const reflect = (...args) => {
    scene.traverse(o => { if (o.userData.noReflect && o.visible) { o.visible = false; skipped.push(o); } });
    mirror(...args);
    for (const o of skipped) o.visible = true;
    skipped.length = 0;
  };
  // The reflection is drawn just before the frame's main drawing (reflectFirst, called by the game loop), not
  // from inside it. Drawn inside, three.js keeps a separate record of the lights for it, so every material
  // was re-checked as it went from one record to the other (measured 2026-10-26: about 100 needless program
  // checks a frame). Same picture, drawn first. In a VR headset the old way is kept (reflectInside).
  let first = false;
  const view = new THREE.Frustum(), viewMatrix = new THREE.Matrix4();
  water.onBeforeRender = (...args) => { if (!first) reflect(...args); };
  const ripple = function ripple(t) { water.material.uniforms.time.value = t * 0.55; };
  ripple.reflectFirst = (renderer, camera) => {
    first = true;
    camera.updateMatrixWorld();
    view.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    if (water.visible && view.intersectsObject(water)) reflect(renderer, scene, camera);   // only when it would be drawn
  };
  ripple.reflectInside = () => { first = false; };
  // See into the lagoon while Wally is diving: k 0 is the usual mirror-like
  // surface, 1 clear enough to watch him down at the bottom.
  ripple.clear = k => {
    water.material.transparent = k > 0.01;
    water.material.uniforms.alpha.value = 1 - 0.62 * k;
    water.material.depthWrite = k <= 0.01;
  };
  return ripple;
}

// The lagoon surface, gently moving. Returns a function that animates it.
function addWater(scene, q, sun) {
  if (looks && looks.waterNormals && q.name !== 'low') return addRealWater(scene, q, sun);
  const geo = new THREE.PlaneGeometry(LAGOON.rx * 2.4, LAGOON.rz * 2.4, q.waterSegs[0], q.waterSegs[1]);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    color: 0x1fb3b6, specular: 0xffffff, shininess: 80, transparent: true, opacity: 0.8 }));
  water.receiveShadow = true;
  scene.add(water);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 500), new THREE.MeshPhongMaterial({
    color: 0x24a6c9, specular: 0xffffff, shininess: 60 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.05, SEA_START_Z - 250);
  scene.add(sea);

  const pos = geo.attributes.position;
  const wave = function wave(t) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, 0.05 * Math.sin(x * 0.45 + t * 1.3) + 0.04 * Math.sin(z * 0.6 - t * 1.1));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  wave.clear = k => { water.material.opacity = 0.8 - 0.45 * k; };   // see into the lagoon while diving
  return wave;
}

// ---- Built things -------------------------------------------------------

// A low wooden fence that marks how far Wally can roam.
// Many small pieces that never move (the fence, the boardwalk's planks, rails,
// posts and piles: about 400) drawn as a handful of meshes, one per material.
// The same shapes and textures, but the graphics card is told once instead of
// four hundred times (and again for the shadows and the shading pass).
function mergeByMaterial(group, scene) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse(m => {
    if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.clone() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const e = byMat.get(m.material) || { list: [], cast: m.castShadow, receive: m.receiveShadow };
    e.list.push(g.index ? g : g.toNonIndexed()); byMat.set(m.material, e);
  });
  for (const [material, e] of byMat) {
    const indexed = e.list.filter(g => g.index), plain = e.list.filter(g => !g.index);
    for (const list of [indexed, plain]) {
      if (!list.length) continue;
      const merged = new THREE.Mesh(mergeGeometries(list), material);
      merged.castShadow = e.cast; merged.receiveShadow = e.receive;
      scene.add(merged);
    }
  }
}

// gap: half the angle of an opening on the harbour side (the rescue, where Wally leads the crocs
// out to the sea); 0 for none. The opening is at the fence's north point (-z).
function addFence(scene, gap = 0) {
  const post = new THREE.CylinderGeometry(0.12, 0.14, 1.3, 12);
  const wood = scanned('planks', 0.5, 1.5, { color: 0xa58466 }) || mat(0x7a5532);
  const n = 90, pts = [], north = -Math.PI / 2;
  const at = a => new THREE.Vector3(Math.cos(a) * LAGOON.rx * 1.42, BANK_Y, Math.sin(a) * LAGOON.rz * 1.42);
  if (!gap) for (let i = 0; i <= n; i++) pts.push(at((i / n) * Math.PI * 2));
  else for (let i = 0; i <= n; i++) pts.push(at(north + gap + (i / n) * (Math.PI * 2 - 2 * gap)));   // all the way round, the gap left open
  for (const p of (gap ? pts : pts.slice(0, n))) {
    const m = shadowed(new THREE.Mesh(post, wood)); m.position.set(p.x, p.y + 0.65, p.z); scene.add(m);
  }
  for (const h of [0.55, 1.1]) {
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, !gap), 300, 0.05, 5, !gap), wood);
    rail.position.y = h; scene.add(rail);
  }
}

// Built in short sections so it can follow deckHeight: flat over the water,
// sloping down onto the banks at both ends.
function addBoardwalk(scene) {
  const B = BOARDWALK, step = 2;
  const planks = plankTexture(); planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(step / 4, 1);
  // Scanned boards run across the walkway, as on a real boardwalk.
  const deckMat = scanned('planks', step / 1.2, B.width / 1.2, { rotate: true }) || mat(0xffffff, { map: planks });
  const white = mat(0xf4f1ea), wood = scanned('planks', 0.5, 2, { color: 0x9a7a5a }) || mat(0x6e4b2c);
  const railPost = new THREE.CylinderGeometry(0.1, 0.1, 1.1, 16);

  for (let x = B.x0; x < B.x1; x += step) {
    const xm = x + step / 2, y0 = deckHeight(x), y1 = deckHeight(x + step);
    const slope = Math.atan2(y1 - y0, step), len = Math.hypot(step, y1 - y0);
    const deck = shadowed(new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.25, B.width), deckMat));
    deck.position.set(xm, (y0 + y1) / 2 - 0.125, B.z);
    deck.rotation.z = slope;
    scene.add(deck);
    for (const side of [-1, 1]) {
      const z = B.z + side * (B.width / 2 - 0.1);
      // No railing over a gap or the steps: that is where Wally can get through.
      if (!deckOpenAt(xm)) {
        const rail = shadowed(new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.1, 0.14), white));
        rail.position.set(xm, (y0 + y1) / 2 + 1.08, z); rail.rotation.z = slope;
        scene.add(rail);
      }
      if (!deckOpenAt(x) || !deckOpenAt(x - 0.01)) {
        const p = shadowed(new THREE.Mesh(railPost, white)); p.position.set(x, y0 + 0.55, z); scene.add(p);
      }
      if (Math.round(x - B.x0) % 6 === 0) {          // piles down to the lagoon bed
        const ground = Math.min(drawnHeight(x, z), BANK_Y), h = y0 - ground;
        if (h > 0.3) {
          const pile = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, h, 16), wood));
          pile.position.set(x, ground + h / 2, z); scene.add(pile);
        }
      }
    }
  }
}

// The way out to the next area: an archway on the boardwalk with a boom gate
// that lifts when the quest is done. Returns a function that opens it.
const GATE_X = 35.5;
export const GATE = { x: GATE_X, z: BOARDWALK.z };
function addGate(scene) {
  const y = deckHeight(GATE_X), B = BOARDWALK, g = new THREE.Group();
  const timber = mat(0x7a5532);
  for (const side of [-1, 1]) {
    const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 0.4), timber));
    post.position.set(0, 1.7, side * (B.width / 2 + 0.2)); g.add(post);
  }
  const beam = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, B.width + 1), timber));
  beam.position.y = 3.5; g.add(beam);
  const [c, ctx] = (() => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; return [cv, cv.getContext('2d')]; })();
  ctx.fillStyle = '#2f6b3a'; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#fff6d8'; ctx.textAlign = 'center';
  // The next stop on the trip (quests.js AREAS, trip-rules.js ORDER): the cane fields.
  fitText(ctx, 'To the Cane Fields', 256, 62, 470, 44, 'bold {size}px "Trebuchet MS", sans-serif');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  for (const side of [-1, 1]) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.68), mat(0xffffff, { map: tex }));
    board.position.set(side * 0.26, 3.5, 0); board.rotation.y = side * Math.PI / 2;
    g.add(board);
  }
  const boom = new THREE.Group();
  const arm = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, B.width), mat(0xd6212b)));
  arm.position.z = B.width / 2; boom.add(arm);
  boom.position.set(0, 1.0, -B.width / 2);
  g.add(boom);
  g.position.set(GATE_X, y, B.z);
  scene.add(g);
  let lift = 0;
  return function update(dt, open) {
    lift += ((open ? 1 : 0) - lift) * Math.min(1, dt * 3);
    boom.rotation.x = -lift * 1.4;
  };
}

// A smooth, slightly lumpy boulder: a fine sphere pushed in and out a little,
// stretched to size and sliced flat at the top so Wally can stand on it.
function boulderGeometry(radius, bottom, top, seed) {
  const g = new THREE.IcosahedronGeometry(1, 5);
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lump = 1 + 0.09 * Math.sin(v.x * 4 + seed) * Math.cos(v.z * 3.3 - seed) + 0.05 * Math.sin(v.y * 7 + seed * 2);
    v.multiplyScalar(lump);
    const h = top - bottom;
    v.set(v.x * radius, bottom + (v.y * 0.5 + 0.5) * h * 1.18, v.z * radius);
    if (v.y > top) { v.y = top; v.x *= 0.92; v.z *= 0.92; }      // the flat top
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Boulders Wally can climb, drawn from the same list the rules use.
function addRocks(scene) {
  const granite = scanned('rock', 2, 2, { color: 0x9c968c }) || mat(0x8f877b, { roughness: 0.95 });
  ROCKS.forEach((r, i) => {
    const bottom = Math.min(BANK_Y, drawnHeight(r.x, r.z)) - 0.6;
    const m = shadowed(new THREE.Mesh(boulderGeometry(r.r, bottom, r.top, i * 1.7 + 0.4), granite));
    m.position.set(r.x, 0, r.z);
    scene.add(m);
  });
}

// The sign, and a way to scratch it: returned so the opening can paint it clean
// first and have Wally scratch out "NOT" himself.
function addSign(scene) {
  const g = new THREE.Group();
  const face = mat(0xffffff, { map: signTexture() });
  const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.1, 0.16),
    [mat(0x6e4b2c), mat(0x6e4b2c), mat(0x6e4b2c), mat(0x6e4b2c), face, mat(0x6e4b2c)]));
  board.position.y = 2.6;
  const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 0.3), mat(0x5c3d22)));
  post.position.y = 1.3;
  g.add(board, post);
  g.position.set(-11, BANK_Y, 20.5);
  g.rotation.y = 0.45;
  scene.add(g);
  const clean = signTexture({ scratched: false }), scratched = face.map;
  return { group: g, setScratched(on) { face.map = on ? scratched : clean; face.needsUpdate = true; } };
}

// A coconut palm (palms.js), with the scanned bark when it is present. yaw is
// the way it leans; opts.lights adds the Esplanade's fairy lights.
let palmCount = 0;
function palm(x, z, height, lean, yaw = Math.random() * Math.PI * 2, opts = {}) {
  const g = buildPalm(height, lean, ++palmCount * 7.13 + x * 0.1 + z * 0.01, scanned('palm', 1, height / 1.6), opts);
  g.position.set(x, drawnHeight(x, z), z);
  g.rotation.y = yaw;
  return g;
}

// The rainforest between the park and the ranges, on the land side only: a deep
// belt of ghost gums, umbrella trees and palms whose crowns merge into one wall.
function addTreeBelt(trees, q) {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const count = q.name === 'high' ? 760 : q.name === 'medium' ? 440 : 200;
  for (let n = 0, tries = 0; n < count && tries < count * 20; tries++) {
    const a = rnd() * Math.PI * 2, d = 150 + Math.sqrt(rnd()) * 120;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (z < SEA_START_Z + 20) continue;
    const r = rnd();
    if (r < 0.5) trees.add('eucalyptus', x, BANK_Y, z, 16 + rnd() * 12);
    else if (r < 0.8) trees.add('umbrella', x, BANK_Y, z, 9 + rnd() * 5);
    else trees.add('palm', x, BANK_Y, z, 11 + rnd() * 5);
    n++;
  }
}

function addPalmsAndRocks(scene, q, models, trees) {
  addSolid(-11, 20.5, 0.4);                                     // the sign's post
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Stands of one, two or three palms (palms.js palmStand), so fewer stands than palms.
  for (let i = 0; i < Math.round(q.palms * 0.62); i++) {
    const a = rnd() * Math.PI * 2, d = 1.5 + rnd() * 1.4;
    const x = Math.cos(a) * LAGOON.rx * d, z = Math.sin(a) * LAGOON.rz * d;
    if (z < SEA_START_Z + 2 || Math.abs(z - BOARDWALK.z) < 3) continue;
    for (const t of palmStand(x, z, rnd, { minH: 6, maxH: 13 })) trees.add('palm', t.x, drawnHeight(t.x, t.z), t.z, t.height + 2);
  }
  // Ghost gums and umbrella trees further back, giving shade and variety.
  for (let i = 0; i < Math.round(q.palms * 0.5); i++) {
    const a = rnd() * Math.PI * 2, d = 2.0 + rnd() * 1.6;
    const x = Math.cos(a) * LAGOON.rx * d, z = Math.sin(a) * LAGOON.rz * d;
    if (z < SEA_START_Z + 6 || Math.abs(z - BOARDWALK.z) < 5) continue;
    if (rnd() < 0.55) trees.add('eucalyptus', x, drawnHeight(x, z), z, 13 + rnd() * 8);
    else trees.add('umbrella', x, drawnHeight(x, z), z, 7 + rnd() * 4);
  }
  const rock = scanned('rock', 1, 1, { color: 0x9c968c }) || mat(0x8c8579, { roughness: 0.95 });
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, d = 0.98 + rnd() * 0.3;
    const x = Math.cos(a) * LAGOON.rx * d, z = Math.sin(a) * LAGOON.rz * d;
    const r = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + rnd() * 0.3, 2), rock));
    r.position.set(x, drawnHeight(x, z) + 0.1, z); r.scale.y = 0.6; r.rotation.set(rnd(), rnd(), rnd());
    scene.add(r);
  }
}

function boat(colour) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 4), mat(0xffffff));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(12.05, 0.5, 4.05), mat(colour));
  stripe.position.y = -0.5;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(6, 1.8, 3.2), mat(0xf8f8f8));
  cabin.position.set(-1, 1.9, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(6.05, 0.5, 3.25), mat(0x2a4a6a));
  glass.position.set(-1, 2.1, 0);
  g.add(hull, stripe, cabin, glass);
  return g;
}

function addHarbour(scene, models) {
  const boats = [];
  [[-60, -105, 0x1e64c8], [10, -120, 0xf2b705], [70, -98, 0x1e64c8], [-15, -150, 0xd9480f]].forEach(([x, z, c], i) => {
    let b = boat(c);
    if (models && models.has('boat')) {
      b = new THREE.Group();
      const m = cloneSkinned(models.get('boat').scene);
      fitToSize(m, 12); b.add(m);
    } b.position.set(x, 0.6, z); b.rotation.y = i * 0.7; scene.add(b); boats.push(b);
  });
  return boats;
}

// Builds everything and returns the bits that move.
// opts.fenceGap: leave an opening in the fence on the harbour side (half its angle, radians).
export function buildWorld(scene, q, models = new Map(), backdrops = {}, realism = null, opts = {}) {
  useRealism(realism);
  const sky = addSky(scene, backdrops.sky);
  const ring = addHorizon(scene, backdrops.ring);
  const sun = addLights(scene, q);
  const photo = applySky(scene, realism, sun, sky);  // the real sky, and the sun moved to match it
  if (photo && !backdrops.ring) {                     // the painted hills clash with a photo sky:
    ring.visible = false;                             // real-looking ranges instead, and a softer,
    addRanges(scene, scene.fog.color, sun.position.clone().normalize());  // further-off haze
    scene.fog.near = 110; scene.fog.far = 520;
  }
  // Ken's trees (trees.js): his palms round the park, ghost gums and umbrella
  // trees among them, and a deep belt of all three out toward the ranges.
  const trees = new Trees(scene, { light: q.name === 'low' });
  // Every tree trunk is solid (ground.js): a palm's is slim, a gum's wider.
  { const add = trees.add.bind(trees); trees.add = (kind, x, y, z, h) => { addSolid(x, z, kind === 'palm' ? 0.35 : 0.55); return add(kind, x, y, z, h); }; }
  addTreeBelt(trees, q);
  addGround(scene);
  addFarGround(scene);
  // Real grass on the lawns (grass.js): short on the lawn, longer past the fence.
  const grass = new Grass(scene, {
    x0: -110, x1: 110, z0: SEA_START_Z + 6, z1: 110, heightAt: drawnHeight,
    tufts: q.name === 'high' ? 36000 : q.name === 'medium' ? 16000 : 5000,
    density: (x, z) => {
      if (sandiness(x, z) > 0.15) return 0;
      const d = lagoonDistance(x, z);
      if (d > 4.2) return 0;
      const fade = d > 3.4 ? (4.2 - d) / 0.8 : 1;                // thins out into the distance
      return fade * (d > PARK_EDGE + 0.05 ? 1.7 : 1);              // left long beyond the fence
    },
  });
  const wave = addWater(scene, q, sun);
  { const statics = new THREE.Group(); addFence(statics, opts.fenceGap || 0); addBoardwalk(statics); mergeByMaterial(statics, scene); }
  const sign = addSign(scene);
  addPalmsAndRocks(scene, q, models, trees);
  trees.build();
  addRocks(scene);
  const gate = addGate(scene);
  const boats = addHarbour(scene, models);

  const update = function update(t, dt, gateOpen, camera = null) {
    wave(t);
    trees.update(t);
    grass.update(t, camera);
    gate(dt, gateOpen);
    boats.forEach((b, i) => { b.position.y = 0.6 + Math.sin(t * 0.8 + i) * 0.15; b.rotation.z = Math.sin(t * 0.6 + i) * 0.03; });
  };
  return { update, sun, sky, photo, sign, waterClear: k => wave.clear && wave.clear(k),
    reflectFirst: (renderer, camera) => wave.reflectFirst && wave.reflectFirst(renderer, camera),
    reflectInside: () => wave.reflectInside && wave.reflectInside() };
}
