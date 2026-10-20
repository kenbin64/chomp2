// cane-scene.js
// What the sugar cane fields look like (Ken, 2026-10-20; MASTER.md): dusk, the
// last of the sunset behind the ranges to the west, the moon up, and the glow
// of the burning cane; the hills of Cairns and Walsh's Pyramid on the skyline.
// The rules of the field are in cane-rules.js; this file only draws it.
//
// Full cane (Ken's tile, models/cane-tile.glb) only near Wally; the rest of the
// field is picture cards of the same tile (Ken: "only near Wally, after that just
// backdrop images"), so it runs on phones.

import * as THREE from 'three';
import { CANE, cellToWorld, at } from './cane-rules.js';

const STALK_HEIGHT = 3.4;              // metres: ripe cane stands three to four metres tall
const NEAR = { low: 4, medium: 6, high: 7 };   // cells round Wally drawn as full cane

// The meshes of a loaded model, merged into geometries placed for one cell: the
// footprint scaled to the cell, the base on the ground, the given height.
function cellParts(gltf, height, sink = 0, spread = 1.08) {
  const root = gltf.scene.clone(true);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const k = new THREE.Matrix4()
    .makeScale(CANE.cell * spread / size.x, height / size.y, CANE.cell * spread / size.z)
    .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y - sink * size.y, -(box.min.z + box.max.z) / 2));
  const parts = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(k, o.matrixWorld));
    parts.push({ geometry: g, material: o.material });
  });
  return parts;
}

// One instanced mesh per part, up to max copies.
function instanced(scene, parts, max, { shadows = false } = {}) {
  const meshes = parts.map(p => {
    const m = new THREE.InstancedMesh(p.geometry, p.material, max);
    m.count = 0; m.castShadow = shadows; m.receiveShadow = true; m.frustumCulled = false;
    scene.add(m); return m;
  });
  return {
    meshes,
    set(list, yaw = []) {
      const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
      const n = Math.min(list.length, max);
      for (const m of meshes) {
        for (let k = 0; k < n; k++) {
          q.setFromAxisAngle(up, yaw[k] || 0);
          mat.compose(list[k], q, one); m.setMatrixAt(k, mat);
        }
        m.count = n; m.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

// A picture of the cane tile from the side, with see-through gaps, for the cards.
function caneCardTexture(renderer, parts) {
  const W = 256, H = 384;
  const rt = new THREE.WebGLRenderTarget(W, H, { colorSpace: THREE.SRGBColorSpace });
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xffffff, 0x554433, 2.4));
  const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(1, 2, 3); s.add(d);
  for (const p of parts) s.add(new THREE.Mesh(p.geometry, p.material));
  const half = CANE.cell * 0.6;
  const cam = new THREE.OrthographicCamera(-half, half, STALK_HEIGHT + 0.1, -0.05, 0.1, 50);
  cam.position.set(0, STALK_HEIGHT / 2, 10); cam.lookAt(0, STALK_HEIGHT / 2, 0);
  const was = renderer.getRenderTarget(), clear = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(s, cam);
  renderer.setRenderTarget(was); renderer.setClearAlpha(clear);
  return rt.texture;
}

// The top of Ken's cut-ground tile, seen from straight above, for flat ground:
// the stubble and soil without the tile's thickness or edges (no squares).
function groundTexture(renderer, gltf) {
  const S = 512, rt = new THREE.WebGLRenderTarget(S, S, { colorSpace: THREE.SRGBColorSpace });
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xffffff, 0x554433, 2.6));
  const root = gltf.scene.clone(true); s.add(root);
  const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const half = Math.min(size.x, size.z) * 0.42;                 // the middle of the tile, away from its edges
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, size.y * 4 + 10);
  cam.position.set(c.x, box.max.y + 1, c.z); cam.up.set(0, 0, -1); cam.lookAt(c.x, box.min.y, c.z);
  const was = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x3a2a1c, 1); renderer.clear(); renderer.render(s, cam);
  renderer.setRenderTarget(was);
  return rt.texture;
}

// Flames: tall flickering cards that always turn to face the camera (about the
// upright axis), one draw call for every burning cell.
function flameTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const shape = (w, h, col) => {
    g.fillStyle = col; g.beginPath();
    g.moveTo(32, 128 - h); g.bezierCurveTo(32 + w * 0.2, 128 - h * 0.6, 32 + w, 128 - h * 0.35, 32 + w * 0.7, 124);
    g.lineTo(32 - w * 0.7, 124); g.bezierCurveTo(32 - w, 128 - h * 0.35, 32 - w * 0.2, 128 - h * 0.6, 32, 128 - h); g.fill();
  };
  g.filter = 'blur(3px)';
  shape(30, 124, 'rgba(200,40,10,0.55)');
  shape(22, 100, 'rgba(255,120,20,0.85)');
  shape(14, 70, 'rgba(255,200,70,0.95)');
  shape(7, 40, 'rgba(255,250,210,1)');
  return new THREE.CanvasTexture(c);
}

// Two crossed cards per cell: four triangles where the full tile has six thousand.
function crossedCards(texture, width, height) {
  const g = new THREE.BufferGeometry();
  const w = width / 2, P = [], U = [], I = [];
  for (const a of [0, Math.PI / 2]) {
    const c = Math.cos(a) * w, s = Math.sin(a) * w, b = P.length / 3;
    P.push(-c, 0, -s, c, 0, s, c, height, s, -c, height, -s);
    U.push(0, 0, 1, 0, 1, 1, 0, 1);
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: texture, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
  return [{ geometry: g, material: mat }];
}

// The dusk sky: deep blue overhead, the last of the sunset low in the west.
function duskSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { west: { value: new THREE.Vector3(-1, 0, 0.25).normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 west; varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 top = vec3(0.05, 0.07, 0.18), mid = vec3(0.20, 0.17, 0.36), low = vec3(0.38, 0.22, 0.36);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.15, 0.7, h));
        float w = max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), west));
        float glow = pow(w, 3.0) * (1.0 - smoothstep(0.0, 0.32, h));
        c = mix(c, vec3(1.0, 0.52, 0.24), glow * 0.85);
        c = mix(c, vec3(1.0, 0.78, 0.45), pow(w, 12.0) * (1.0 - smoothstep(0.0, 0.08, h)) * 0.8);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
}

// The moon, full, as Australia sees it (a soft disc and its glow; MASTER.md).
function moonSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const glow = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,250,235,0.9)'); glow.addColorStop(0.32, 'rgba(240,240,255,0.35)'); glow.addColorStop(1, 'rgba(200,210,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f4f1e6'; g.beginPath(); g.arc(64, 64, 18, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(150,150,160,0.35)';                    // the dark patches (seas)
  for (const [x, y, r] of [[58, 70, 5], [69, 66, 4], [62, 58, 3.5], [70, 74, 3]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false }));
  s.scale.setScalar(70);
  return s;
}

// The ranges behind the coast, a dark ring on the skyline, with Walsh's Pyramid:
// the steep cone that rises straight out of the cane fields south of Cairns.
function skyline() {
  const g = new THREE.Group();
  const R = 520, seg = 160, pos = [], idx = [];
  for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2;
    const west = Math.max(0, -Math.cos(a));                 // the ranges are higher inland (west)
    const h = 22 + west * 48 + Math.sin(a * 7) * 6 + Math.sin(a * 17 + 1) * 3.5 + Math.sin(a * 3 + 2) * 8;
    pos.push(Math.cos(a) * R, -2, Math.sin(a) * R, Math.cos(a) * R, h, Math.sin(a) * R);
    if (k < seg) { const b = k * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const dark = new THREE.MeshBasicMaterial({ color: 0x141428, side: THREE.DoubleSide, fog: false });
  g.add(new THREE.Mesh(geo, dark));
  // Walsh's Pyramid: 922 m, near enough a cone, seen across the fields.
  const pyramid = new THREE.Mesh(new THREE.ConeGeometry(70, 120, 10, 1), new THREE.MeshBasicMaterial({ color: 0x1b1a30, fog: false }));
  const a = Math.PI * 0.62;                                 // to the south-west, against the sunset
  pyramid.position.set(Math.cos(a) * (R - 40), 58, Math.sin(a) * -(R - 40));
  g.add(pyramid);
  return g;
}

// Flames for the burning cells: billboards that sway and flicker.
function fireField(cells) {
  const per = 3, count = cells.length * per;
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { map: { value: flameTexture() }, time: { value: 0 } },
    vertexShader: `
      attribute float phase; uniform float time; varying vec2 vUv; varying float vA;
      void main() {
        vUv = uv;
        vec3 centre = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float size = length(instanceMatrix[0].xyz);
        float f = sin(time * 8.0 + phase) * 0.5 + 0.5, g = sin(time * 13.0 + phase * 1.7) * 0.5 + 0.5;
        vA = 0.65 + f * 0.35;
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));   // the camera's right, kept level
        float h = size * (2.4 + f * 0.7 + g * 0.3);
        vec3 p = centre + right * position.x * size * 1.3 + vec3(0.0, position.y * h, 0.0);
        p += right * sin(time * 3.0 + phase + position.y * 2.0) * 0.18 * position.y * size;   // the tips sway
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'uniform sampler2D map; varying vec2 vUv; varying float vA; void main(){ vec4 c = texture2D(map, vUv); gl_FragColor = vec4(c.rgb * 1.4, c.a * vA); }',
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const phase = new Float32Array(count), m = new THREE.Matrix4();
  let k = 0;
  for (const { i, j } of cells) {
    const w = cellToWorld(i, j);
    for (let n = 0; n < per; n++, k++) {
      const sz = 0.8 + Math.random() * 0.5;
      m.makeScale(sz, sz, sz).setPosition(w.x + (Math.random() - 0.5) * CANE.cell * 0.9, 0, w.z + (Math.random() - 0.5) * CANE.cell * 0.9);
      mesh.setMatrixAt(k, m); phase[k] = Math.random() * 6.28;
    }
  }
  geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phase, 1));
  mesh.frustumCulled = false;
  return mesh;
}

// Build the scene. Returns what the game updates each frame.
export function buildCane(scene, renderer, quality, models, field) {
  const near = NEAR[quality.name] || 6;
  scene.background = new THREE.Color(0x14142a);
  scene.fog = new THREE.FogExp2(0x2a2440, 0.016);
  scene.add(duskSky());
  const moon = moonSprite(); moon.position.set(260, 330, 420); scene.add(moon);
  scene.add(skyline());

  // Light: the moon (cool, from high in the east), the last of the sunset (warm,
  // low from the west), a dim sky, and the fire (point lights near Wally).
  scene.add(new THREE.HemisphereLight(0x5a6aa0, 0x2a1c14, 0.75));
  const moonLight = new THREE.DirectionalLight(0xb8c8ff, 0.9);
  moonLight.position.set(30, 60, 40);
  moonLight.castShadow = quality.shadows;
  if (quality.shadows) {
    moonLight.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    Object.assign(moonLight.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 160 });
  }
  scene.add(moonLight, moonLight.target);
  const sunset = new THREE.DirectionalLight(0xff8a4a, 0.55); sunset.position.set(-80, 12, 20); scene.add(sunset);
  const fireLights = Array.from({ length: quality.name === 'low' ? 3 : 6 }, () => {
    const l = new THREE.PointLight(0xff8a3a, 0, 18, 1.6); scene.add(l); return l;
  });

  // The ground: dark soil, a little lighter on the cut cells (the cut-ground tiles add the stubble).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // The cane, the cut ground, and the cards.
  const tileGltf = models.get('cane-tile'), groundGltf = models.get('cane-ground');
  // The clumps overlap into thick cane (spread 1.45), and the tile's square of soil
  // is sunk below the ground (sink: a twentieth of its height) so no squares show.
  const tileParts = tileGltf ? cellParts(tileGltf, STALK_HEIGHT, 0.05, 1.45) : [{ geometry: new THREE.BoxGeometry(CANE.cell, STALK_HEIGHT, CANE.cell).translate(0, STALK_HEIGHT / 2, 0), material: new THREE.MeshStandardMaterial({ color: 0x5f8a3a }) }];
  const stubble = groundGltf ? groundTexture(renderer, groundGltf) : null;
  const groundParts = [{ geometry: new THREE.PlaneGeometry(CANE.cell * 1.02, CANE.cell * 1.02).rotateX(-Math.PI / 2).translate(0, 0.02, 0),
                         material: new THREE.MeshStandardMaterial({ map: stubble, color: stubble ? 0xffffff : 0x5a4430, roughness: 1 }) }];
  const maxNear = (near * 2 + 1) ** 2;
  const nearCane = instanced(scene, tileParts, maxNear, { shadows: quality.shadows });
  const cutGround = instanced(scene, groundParts, (near * 2 + 5) ** 2);
  const cardTex = caneCardTexture(renderer, tileParts);
  const cards = instanced(scene, crossedCards(cardTex, CANE.cell * 1.15, STALK_HEIGHT), CANE.size * CANE.size);
  // Cane beyond the field's edge, as far as the eye goes in the dusk: cards only, fixed.
  const beyond = instanced(scene, crossedCards(cardTex, CANE.cell * 1.3, STALK_HEIGHT), 4000);
  {
    const list = [], yaw = [], half = CANE.size * CANE.cell / 2;
    for (let x = -half - 40; x < half + 40; x += CANE.cell * 1.1) for (let z = -half - 40; z < half + 40; z += CANE.cell * 1.1) {
      if (Math.abs(x) < half + 1 && Math.abs(z) < half + 1) continue;
      if (z < -half - 4 && z > -half - 10) continue;          // the farm road along the south side
      list.push(new THREE.Vector3(x + (Math.random() - 0.5), 0, z + (Math.random() - 0.5))); yaw.push(Math.random() * 3);
    }
    beyond.set(list, yaw);
  }

  // The fire, laid once (it never spreads).
  const fireCellsList = [];
  for (let j = 0; j < CANE.size; j++) for (let i = 0; i < CANE.size; i++) if (at(field, i, j) === 'fire') fireCellsList.push({ i, j });
  const fire = fireField(fireCellsList); scene.add(fire);
  // Burnt stalks under the flames: the cards, darkened.
  const burntMat = new THREE.MeshStandardMaterial({ map: cardTex, alphaTest: 0.45, side: THREE.DoubleSide, color: 0x2a1a12, emissive: 0x3a1204, emissiveIntensity: 0.6 });
  const burnt = instanced(scene, [{ geometry: crossedCards(cardTex, CANE.cell, STALK_HEIGHT * 0.7)[0].geometry, material: burntMat }], fireCellsList.length);
  burnt.set(fireCellsList.map(({ i, j }) => { const w = cellToWorld(i, j); return new THREE.Vector3(w.x, 0, w.z); }), fireCellsList.map(() => Math.random() * 3));

  // Which cells are drawn how, from where Wally is. Called when he moves to a new
  // cell or the field changes (a cut).
  const yawOf = (i, j) => ((i * 73856093) ^ (j * 19349663)) % 628 / 100;   // a fixed turn per cell, so cane does not swim
  let lastKey = '';
  function arrange(f, wi, wj, force = false) {
    const key = `${wi},${wj}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    const nearList = [], nearYaw = [], cardList = [], cardYaw = [], cutList = [], cutYaw = [];
    for (let j = 0; j < CANE.size; j++) for (let i = 0; i < CANE.size; i++) {
      const c = at(f, i, j), w = cellToWorld(i, j), d = Math.max(Math.abs(i - wi), Math.abs(j - wj));
      const p = new THREE.Vector3(w.x, 0, w.z);
      if (c === 'cane') {
        if (d <= near) { nearList.push(p); nearYaw.push(yawOf(i, j)); } else { cardList.push(p); cardYaw.push(yawOf(i, j)); }
      } else if (c === 'cut' && d <= near + 2) { cutList.push(p); cutYaw.push(yawOf(i, j)); }
    }
    nearCane.set(nearList, nearYaw); cards.set(cardList, cardYaw); cutGround.set(cutList, cutYaw);
  }

  // Each frame: the flames flicker, and the fire lights go to the burning cells nearest Wally.
  function update(t, wallyPos) {
    fire.material.uniforms.time.value = t;
    moonLight.target.position.copy(wallyPos); moonLight.position.set(wallyPos.x + 30, 60, wallyPos.z + 40);
    const nearest = fireCellsList
      .map(c => { const w = cellToWorld(c.i, c.j); return { w, d: Math.hypot(w.x - wallyPos.x, w.z - wallyPos.z) }; })
      .sort((a, b) => a.d - b.d);
    fireLights.forEach((l, k) => {
      const n = nearest[k * 3];                               // spread out along the fire, not all on one cell
      if (!n) { l.intensity = 0; return; }
      l.position.set(n.w.x, 2.2, n.w.z);
      l.intensity = (14 + Math.sin(t * 9 + k * 2) * 3 + Math.sin(t * 23 + k) * 2) * (n.d < 30 ? 1 : 0);
    });
  }

  return { arrange, update, moon, fireCells: fireCellsList };
}
