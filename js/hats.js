// hats.js
// Wally's hats (Ken, 2026-10-21: an assortment of hats for Wally). Each hat is built here from simple
// shapes, so it costs no download, and sits on his head bone, so it moves with every move he makes.
// His own little hat is painted into his model; when another hat is on, outfit.js hides it (HIDE)
// and the new hat sits over the same spot (SEAT), big enough to cover it.
//
// The catalogue (names, prices, which are earned) is HATS in progress.js; the shapes are here.
//
//   const hat = makeHat('akubra');      // a THREE.Group, or null for his own hat
//   wearHat(wally.skin.root, 'akubra'); // puts it on (or takes the last one off)

import * as THREE from 'three';

// Where his own hat is on the model (bind pose, model units, measured from wally.glb in Blender by
// the colours of its crown and band): its band is centred about here, and it tips back a little.
export const SEAT = { x: 0, y: 0.6, z: 0.17, tilt: -0.54, scale: 1.3 };   // tuned by eye on hat-test.html
// The part of the model that is his own hat, hidden while another is worn (outfit.js).
export const HIDE = { x: 0, y: 0.75, z: 0.2, rx: 0.42, ry: 0.3, rz: 0.42, above: 0.47, slope: 0.6, brim: 0.1 };   // tuned by eye on hat-test.html

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, side: THREE.DoubleSide, ...o });   // both sides: the inside of a brim or crown shows
const felt = c => mat(c, { roughness: 0.9 });

// A round crown or brim turned on a lathe from a profile of [radius, height] points.
function lathe(points, material, segments = 28) {
  const g = new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), segments);
  const m = new THREE.Mesh(g, material); m.castShadow = true; return m;
}
function disc(r, material, thick = 0.012) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thick, 32), material); m.castShadow = true; return m; }
function ball(r, material) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), material); m.castShadow = true; return m; }

// A felt hat with a brim (the Akubra and its cousins): crown radius, height, brim radius, colours.
function brimmed({ crown = 0.17, height = 0.15, brim = 0.34, color = 0x6b4a2b, band = 0x2a1a10, dent = 0.025, curl = 0.03 }) {
  const g = new THREE.Group(), m = felt(color);
  const top = lathe([[0, height - dent], [crown * 0.5, height], [crown * 0.92, height - 0.01], [crown, height * 0.6], [crown * 1.04, 0]], m);
  const b = lathe([[crown * 1.02, 0], [brim * 0.8, -0.006], [brim, curl], [brim + 0.008, curl + 0.01], [brim * 0.8, 0.006], [crown * 1.02, 0.012]], m, 36);
  const bandM = lathe([[crown * 1.045, 0.012], [crown * 1.03, 0.045], [crown * 1.025, 0.05]], mat(band));
  g.add(top, b, bandM);
  g.userData.crown = crown; g.userData.height = height; g.userData.band = band;
  return g;
}

const BUILD = {
  akubra: () => brimmed({}),
  'gold-akubra': () => { const g = brimmed({ color: 0xe8b23a, band: 0x7a4a10 }); g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.metalness = 0.75; o.material.roughness = 0.3; } }); return g; },
  cork: () => {
    const g = brimmed({ color: 0xa88a5a, band: 0x5a3a20, brim: 0.32 });
    const cork = mat(0xc89a62), string = new THREE.LineBasicMaterial({ color: 0x3a2a1a });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2, r = 0.3, drop = 0.11 + (i % 2) * 0.03;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.05, 8), cork); c.position.set(Math.cos(a) * r, 0.02 - drop, Math.sin(a) * r);
      const s = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * r, 0.03, Math.sin(a) * r), c.position.clone().add(new THREE.Vector3(0, 0.025, 0))]), string);
      g.add(c, s); c.userData.swing = { a, r, drop };
    }
    return g;
  },
  bucket: () => { const m = mat(0xb9a77a, { roughness: 0.95 }); const g = new THREE.Group(); g.add(lathe([[0, 0.2], [0.14, 0.2], [0.19, 0.17], [0.21, 0.06], [0.21, 0]], m, 32), lathe([[0.21, 0], [0.3, -0.06], [0.31, -0.07]], m, 32), lathe([[0.212, 0.01], [0.212, 0.05]], mat(0x7a6a4a))); return g; },
  cap: () => {
    const g = new THREE.Group(), m = mat(0x1f6fd0);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m); dome.scale.y = 0.95; dome.castShadow = true;
    const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.014, 24, 1, false, -Math.PI / 2, Math.PI), m); peak.position.set(0, 0.01, 0.16); peak.scale.set(1.15, 1, 1); peak.rotation.x = 0.12;
    const btn = ball(0.022, mat(0xffffff)); btn.position.y = 0.2;
    g.add(dome, peak, btn); return g;
  },
  captain: () => {
    const g = new THREE.Group();
    g.add(lathe([[0, 0.13], [0.24, 0.12], [0.25, 0.1], [0.17, 0.05], [0.17, 0]], mat(0xf6f6f2)));
    const band = lathe([[0.175, 0], [0.175, 0.05]], mat(0x111111)); g.add(band);
    const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 24, 1, false, -Math.PI / 2.8, Math.PI / 1.4), mat(0x111111, { roughness: 0.3 })); peak.position.set(0, 0.006, 0.07); peak.rotation.x = 0.18;
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), mat(0xe8b23a, { metalness: 0.8, roughness: 0.3 })); badge.position.set(0, 0.075, 0.2); badge.rotation.x = -0.3;
    g.add(peak, badge); return g;
  },
  tricorn: () => {
    const g = new THREE.Group(), m = felt(0x2c2c36);
    g.add(lathe([[0, 0.16], [0.14, 0.16], [0.19, 0.08], [0.2, 0]], m));
    const geo = new THREE.LatheGeometry([[0.2, 0], [0.24, 0.01], [0.28, 0.03], [0.29, 0.035]].map(([r, h]) => new THREE.Vector2(r, h)), 60), pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {                            // turned up between the corners, the corners poking out (one in front)
      const x = pos.getX(k), z = pos.getZ(k), r = Math.hypot(x, z), a = Math.atan2(x, z), corner = Math.cos(3 * a), out = (r - 0.2) / 0.09;
      const rr = r * (1 + 0.15 * out * Math.max(0, corner)), up = pos.getY(k) + out * 0.09 * (1 - Math.max(0, corner));
      pos.setXYZ(k, Math.sin(a) * rr, up, Math.cos(a) * rr);
    }
    geo.computeVertexNormals();
    const brimM = new THREE.Mesh(geo, m); brimM.castShadow = true; g.add(brimM);
    const rim = []; for (let k = 3; k < pos.count; k += 4) rim.push(new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)));   // gold trim along the edge
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 120, 0.008, 6, true), mat(0xe0b040, { metalness: 0.7, roughness: 0.35 })));
    return g;
  },
  tophat: () => { const g = new THREE.Group(); g.add(lathe([[0, 0.3], [0.15, 0.3], [0.14, 0.05], [0.15, 0]], felt(0x151518))); g.add(lathe([[0.15, 0], [0.27, 0.01], [0.28, 0.03], [0.15, 0.012]], felt(0x151518), 32)); g.add(lathe([[0.146, 0.04], [0.143, 0.09]], mat(0xb81f2a))); return g; },
  party: () => {
    const g = new THREE.Group();
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
    const cols = ['#ff2fa8', '#ffd23a', '#40c0ff', '#39d66a']; for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % 4]; x.fillRect(0, i * 16, 64, 16); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 24, 1, true), mat(0xffffff, { map: tex, side: THREE.DoubleSide })); cone.position.y = 0.18; cone.castShadow = true;
    const pom = ball(0.05, mat(0xffffff, { roughness: 1 })); pom.position.y = 0.37;
    g.add(cone, pom); return g;
  },
  beanie: () => { const g = new THREE.Group(), m = mat(0xc8302a, { roughness: 1 }); const d = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), m); d.scale.y = 1.0; d.castShadow = true; g.add(d, lathe([[0.205, -0.01], [0.21, 0.05], [0.2, 0.06]], mat(0xf2ece0, { roughness: 1 }))); const p = ball(0.06, mat(0xf2ece0, { roughness: 1 })); p.position.y = 0.21; g.add(p); return g; },
  hardhat: () => { const g = new THREE.Group(), m = mat(0xf5c518, { roughness: 0.4 }); const d = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m); d.scale.y = 0.95; d.castShadow = true; g.add(d, lathe([[0.2, 0], [0.26, 0.005], [0.26, 0.02], [0.2, 0.02]], m, 32)); return g; },
  crown: () => {
    const g = new THREE.Group(), gold = mat(0xf2c21b, { metalness: 0.9, roughness: 0.25 });
    g.add(lathe([[0.17, 0], [0.17, 0.07], [0.165, 0.07], [0.165, 0]], gold, 32));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, p = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 4), gold); p.position.set(Math.cos(a) * 0.168, 0.11, Math.sin(a) * 0.168); p.castShadow = true;
      const gem = ball(0.018, mat([0xd8231f, 0x2f8fd8, 0x2e9a4a][i % 3], { metalness: 0.2, roughness: 0.15 })); gem.position.set(Math.cos(a) * 0.172, 0.035, Math.sin(a) * 0.172);
      const tip = ball(0.016, gold); tip.position.set(p.position.x, 0.16, p.position.z);
      g.add(p, gem, tip);
    }
    return g;
  },
};

export function makeHat(id) {
  const b = BUILD[id]; if (!b) return null;
  const g = b(); g.name = 'WallyHat'; g.userData.hat = id;
  g.traverse(o => { if (o.isMesh) o.userData.noAO = false; });
  return g;
}

// Put a hat on Wally's head (or take it off: id null or 'own'). The hat is placed in the model's bind
// space at SEAT, then carried into the head bone's own space, so it follows the head exactly.
export function wearHat(root, id) {
  if (!root) return null;
  const old = []; root.traverse(o => { if (o.name === 'WallyHat') old.push(o); });
  for (const o of old) o.parent.remove(o);
  const hat = makeHat(id);
  if (!hat) return null;
  let mesh = null; root.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  if (!mesh) return null;
  const bones = mesh.skeleton.bones, i = bones.findIndex(b => /(^|[^a-z])Head$/i.test(b.name) || /head$/i.test(b.name));
  if (i < 0) return null;
  const seat = new THREE.Matrix4().compose(new THREE.Vector3(SEAT.x, SEAT.y, SEAT.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(SEAT.tilt, 0, 0)), new THREE.Vector3(SEAT.scale, SEAT.scale, SEAT.scale));
  const m = new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[i], new THREE.Matrix4().multiplyMatrices(mesh.bindMatrix, seat));
  m.decompose(hat.position, hat.quaternion, hat.scale);
  bones[i].add(hat);
  return hat;
}
