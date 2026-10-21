// daintree-forest.js
// The vine swing into the Daintree rainforest, and the King's court beyond it (Ken,
// 2026-10-20; MASTER.md section 6, the finale's fourth version, steps 3 and 4). The swing's
// rules are in vine-rules.js (tested); this is the look and the play.
//
//   const forest = vineCourse({ scene, models, quality, wally, sound, fx, bubbles, toast });
//   forest.start(onLanded)     Wally on the near bank; onLanded() when he reaches the far bank
//   forest.update(dt, t, k)    k: the input this frame ({ forward, jump })
//   forest.cameraTarget()      where the camera should look (the play camera follows from the side)
//
// Controls: Space (or A, or Jump) leaps for the first vine and lets go of a vine; holding
// forward pumps the swing higher.

import * as THREE from 'three';
import { Trees } from '../trees.js';
import { ModelSkin } from '../models.js';
import { COURSE, ANCHOR_Y, VINE_LENGTH, SWAMP_Y, START, VINES, END, PAWPAW_REACH, DT,
  handAt, swingStep, release, flyStep, catches, grab, landed, inSwamp, firstSwing, pawpawSpots } from './vine-rules.js';

export const COURT = { z: END.z + 26, throneZ: END.z + 34, billabong: { z: END.z + 20, x: 9, r: 7 } };
const X = COURSE.x;
const HANG = 3.0;                                   // from Wally's hands down to his feet

// ---- Ground for this part: the banks, the swamp between, the court beyond ---------------------
export function forestGround(x, z) {
  if (z > END.z - 3 || z < START.z + 3) return { surface: 'land', y: START.y + Math.max(0, Math.abs(x - X) - 10) * 0.15 };
  return { surface: 'water', y: SWAMP_Y - 0.45 };
}
export const insideForest = (x, z) => Math.abs(x - X) < 16 && z > START.z - 14 && z < COURT.throneZ + 6;

function canvasTexture(size, paint, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
  return t;
}

// A pawpaw (papaya): long, yellow going orange, a little green at the stalk.
function pawpaw() {
  const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * (0.11 + 0.05 * t), -0.22 + t * 0.44)); }
  const geo = new THREE.LatheGeometry(pts, 20);
  const tex = canvasTexture(64, (g, n) => { const gr = g.createLinearGradient(0, n, 0, 0); gr.addColorStop(0, '#f08a1c'); gr.addColorStop(0.7, '#f5c22a'); gr.addColorStop(1, '#7da23a'); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, emissive: 0x442200, emissiveIntensity: 0.25 }));
  m.castShadow = true; return m;
}

// A vine: a tube from its branch down to its end, redrawn as it swings, with a few leaves.
function makeVine(scene, mat, leafMat) {
  const g = new THREE.Group(); scene.add(g);
  let mesh = null;
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 0.18), leafMat, 14); g.add(leaves);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  return {
    draw(anchor, end) {
      // A slight sag between the branch and the end, so it reads as a hanging vine.
      const mid = anchor.clone().lerp(end, 0.5); mid.x += 0.25;
      const curve = new THREE.QuadraticBezierCurve3(anchor, mid, end);
      if (mesh) { mesh.geometry.dispose(); g.remove(mesh); }
      mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.07, 6), mat); mesh.castShadow = true; g.add(mesh);
      for (let i = 0; i < 14; i++) {
        curve.getPoint(0.12 + i * 0.06, P); Q.setFromEuler(new THREE.Euler(0.4, i * 2.3, (i % 2 ? 1 : -1) * 0.6));
        M.compose(P.clone().add(new THREE.Vector3((i % 2 ? 0.12 : -0.12), 0, 0)), Q, S); leaves.setMatrixAt(i, M);
      }
      leaves.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---- The look ---------------------------------------------------------------------------------
function buildForest(scene, q, models) {
  let seed = 77; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const Z0 = START.z - 20, Z1 = COURT.throneZ + 20, mid = (Z0 + Z1) / 2;
  // The forest floor: dark soil and leaf litter.
  const litter = canvasTexture(512, (g, n) => {
    g.fillStyle = '#3a2d1e'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 1800; i++) { const t = [[110, 70, 35], [70, 85, 40], [140, 95, 45], [60, 45, 28]][Math.floor(rnd() * 4)]; g.fillStyle = `rgba(${t},${0.5 + rnd() * 0.5})`; g.save(); g.translate(rnd() * n, rnd() * n); g.rotate(rnd() * 3); g.beginPath(); g.ellipse(0, 0, 4 + rnd() * 8, 2 + rnd() * 3, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  }, 24);
  const floorGeo = new THREE.PlaneGeometry(90, Z1 - Z0, 60, 120); floorGeo.rotateX(-Math.PI / 2);
  const p = floorGeo.attributes.position;
  // The banks slope down into the swamp over a few metres, instead of a cliff.
  const bed = SWAMP_Y - 1.6, slope = (d) => Math.min(1, Math.max(0, d / 6));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + X, z = p.getZ(i) + mid, g = forestGround(x, z);
    const inNear = z - (START.z + 3), inFar = (END.z - 3) - z;          // metres out into the swamp from each bank
    const out = Math.min(inNear, inFar);
    const y = out <= 0 ? g.y - 0.02 : (START.y - 0.02) + (bed - START.y) * slope(out);
    p.setXYZ(i, x, y, z);
  }
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: litter, roughness: 1 })); floor.receiveShadow = true; scene.add(floor);
  // The swamp: still, dark water with a green sheen, lily pads.
  const swamp = new THREE.Mesh(new THREE.PlaneGeometry(40, END.z - START.z), new THREE.MeshPhysicalMaterial({ color: 0x1f2e1a, roughness: 0.15, transparent: true, opacity: 0.94, clearcoat: 0.4 }));
  swamp.rotation.x = -Math.PI / 2; swamp.position.set(X, SWAMP_Y, (START.z + END.z) / 2); scene.add(swamp);
  const pads = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 12, 0.3, Math.PI * 1.85), new THREE.MeshStandardMaterial({ color: 0x3f7a2f, roughness: 0.7, side: THREE.DoubleSide }), 90);
  { const M = new THREE.Matrix4(); for (let i = 0; i < 90; i++) { const s = 0.6 + rnd() * 1.1; M.compose(new THREE.Vector3(X + (rnd() - 0.5) * 30, SWAMP_Y + 0.02, START.z + 4 + rnd() * (END.z - START.z - 8)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rnd() * 6)), new THREE.Vector3(s, s, s)); pads.setMatrixAt(i, M); } }
  scene.add(pads);
  // Giant fig trunks, a branch from each reaching out over the swamp: one per vine.
  const barkTex = canvasTexture(256, (g, n) => {
    g.fillStyle = '#6a5a48'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 160; i++) { const x = rnd() * n; g.strokeStyle = `rgba(${40 + rnd() * 30},${32 + rnd() * 20},${24 + rnd() * 15},${0.4 + rnd() * 0.4})`; g.lineWidth = 1 + rnd() * 3; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rnd() * 10 - 5, n * 0.3, x + rnd() * 10 - 5, n * 0.7, x + rnd() * 8 - 4, n); g.stroke(); }   // fissures
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${70 + rnd() * 30},${100 + rnd() * 40},${45 + rnd() * 20},${0.3 + rnd() * 0.4})`; g.beginPath(); g.ellipse(rnd() * n, rnd() * n, 4 + rnd() * 14, 6 + rnd() * 22, 0, 0, Math.PI * 2); g.fill(); }   // moss and lichen
  }, 1);
  barkTex.repeat.set(2, 4);
  const bark = new THREE.MeshStandardMaterial({ map: barkTex, color: 0xd8ccb8, roughness: 0.95 });
  // A fig's trunk: flaring out into buttresses at the foot, narrowing as it rises.
  const trunkGeo = (() => { const pts = []; const H = ANCHOR_Y + 12; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(1.1 + 2.6 * Math.pow(1 - Math.min(1, t * 4), 2.2) - t * 0.35, t * H)); } return new THREE.LatheGeometry(pts, 14); })();
  const moss = new THREE.MeshStandardMaterial({ color: 0x4f6a2e, roughness: 0.9 });
  const vineBark = new THREE.MeshStandardMaterial({ color: 0x4d4a2a, roughness: 0.9 });
  VINES.forEach((vz, i) => {
    const side = i % 2 ? 1 : -1, tx = X + side * 9;
    const trunk = new THREE.Mesh(trunkGeo, bark); trunk.position.set(tx, SWAMP_Y - 1.2, vz + 1.5); trunk.rotation.y = rnd() * 6; trunk.castShadow = true; scene.add(trunk);
    for (let b = 0; b < 4; b++) {                                    // vines and roots hanging down the trunk
      const a = rnd() * Math.PI * 2, h = 5 + rnd() * 8, r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, h, 5), vineBark);
      r.position.set(tx + Math.cos(a) * 1.25, ANCHOR_Y + 2 - h / 2, vz + 1.5 + Math.sin(a) * 1.25); scene.add(r);
    }
    const len = 9.5, branch = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, len, 8), bark);
    branch.rotation.z = Math.PI / 2; branch.position.set(tx - side * len / 2, ANCHOR_Y + 0.2, vz); branch.castShadow = true; scene.add(branch);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), moss); m.scale.set(1.8, 0.5, 1.2); m.position.set(X, ANCHOR_Y + 0.6, vz); scene.add(m);
  });
  // The forest closing in on both sides and all round the court.
  const trees = new Trees(scene, { light: q.name === 'low' });
  for (let z = Z0; z < Z1; z += 11) for (const side of [-1, 1]) for (let k = 0; k < 2; k++) trees.add('rainforest', X + side * (17 + k * 12 + rnd() * 3), -0.5, z + rnd() * 4, 17 + rnd() * 4);
  for (let x = -20; x <= 20; x += 11) trees.add('rainforest', X + x, -0.5, Z1 - 4, 18);
  for (let i = 0; i < 40; i++) trees.add(rnd() < 0.5 ? 'palm' : 'umbrella', X + (rnd() < 0.5 ? -1 : 1) * (12 + rnd() * 4), START.y, Z0 + rnd() * (Z1 - Z0), 5 + rnd() * 4);
  trees.build();
  // The King's court: a clearing by a billabong, the throne on a mound under the canopy.
  const bill = new THREE.Mesh(new THREE.CircleGeometry(COURT.billabong.r, 40), new THREE.MeshPhysicalMaterial({ color: 0x23361f, roughness: 0.1, clearcoat: 0.6 }));
  bill.rotation.x = -Math.PI / 2; bill.position.set(X + COURT.billabong.x, START.y + 0.03, COURT.billabong.z); scene.add(bill);
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: litter, color: 0x8c9a6a, roughness: 1 }));
  mound.scale.set(5, 1.1, 4); mound.position.set(X, START.y - 0.1, COURT.throneZ); mound.receiveShadow = true; scene.add(mound);
  const fit = (gltf, h) => { if (!gltf) return null; const m = gltf.scene.clone(true), b = new THREE.Box3().setFromObject(m); m.scale.setScalar(h / b.getSize(new THREE.Vector3()).y); const b2 = new THREE.Box3().setFromObject(m); m.position.y = -b2.min.y; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); const g = new THREE.Group(); g.add(m); scene.add(g); return g; };
  const throne = fit(models.get('king-throne'), 4.2);
  // The King: rigged and seated (tools/blender-pose-king.py: Sit, Speak, Raise). 3.6 m tall standing;
  // seated, his hips on the throne's seat. KING_SEAT and KING_BACK are tuned by eye on renders.
  const KING_SEAT = 0.6, KING_BACK = 0.35;
  const kingGltf = models.get('king-croc');
  const kingSkin = kingGltf ? new ModelSkin(kingGltf, { height: 3.6 }) : null;
  let king = null;
  if (kingSkin) {
    king = new THREE.Group(); king.add(kingSkin.root); scene.add(king);
    kingSkin.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } if (o.isSkinnedMesh) o.frustumCulled = false; });
    kingSkin.play('Sit');
  }
  const top = START.y + 1.0;
  if (throne) { throne.position.set(X, top, COURT.throneZ); throne.rotation.y = Math.PI; }
  if (king) { king.position.set(X, top + KING_SEAT, COURT.throneZ - KING_BACK); king.rotation.y = Math.PI; }   // on the seat, which is toward Wally (-z)
  // Shafts of light through the canopy onto the throne.
  const shaft = new THREE.SpotLight(0xfff0c8, 120, 40, 0.35, 0.6, 1.2); shaft.position.set(X + 3, 26, COURT.throneZ - 4); shaft.target.position.set(X, top, COURT.throneZ); scene.add(shaft, shaft.target);
  return { trees, king, kingSkin, throne, top };
}

// ---- The play ---------------------------------------------------------------------------------
export function vineCourse({ scene, models, quality, wally, sound, fx, bubbles, toast }) {
  const look = buildForest(scene, quality, models);
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x4d4a2a, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6f2a, roughness: 0.8, side: THREE.DoubleSide });
  const vines = VINES.map(() => makeVine(scene, vineMat, leafMat));
  const swings = VINES.map(() => ({ theta: 0, omega: 0 }));          // each vine sways a little on its own
  const fruit = pawpawSpots().map(s => { const m = pawpaw(); m.position.set(X, s.y, s.z); scene.add(m); return { m, got: false, s }; });
  const st = { state: 'off', vine: -1, swing: null, f: null, gathered: 0, falls: 0, onLanded: null, last: 0 };
  const P = (vz, h) => new THREE.Vector3(X, h.y, h.z);

  function hangWally() {
    const h = handAt(VINES[st.vine], st.swing.theta);
    wally.pos.set(X, h.y - HANG, h.z); wally.root.position.copy(wally.pos);
    wally.root.rotation.set(-st.swing.theta * 0.8, 0, 0);              // his body follows the vine
  }
  function armsUp(t) {                                                // hanging by his hands
    if (wally.skin && wally.skin.currentClip) wally.skin.stop(0);   // the clips start again by themselves when he lands
    if (wally.poser && wally.poser.ok) wally.poser.pose({ time: t, cheer: 1, napping: false });
  }
  function onVine(i, swing) { st.state = 'swing'; st.vine = i; st.last = i; st.swing = swing; sound.play.jump(); }

  return {
    get state() { return st.state; },
    // A good moment to let go: swinging forward, well up the swing (the window the tests check).
    get goodRelease() { return st.state === 'swing' && st.swing.omega > 0.2 && st.swing.theta > 0.3 && st.swing.theta < 0.95; },
    get gathered() { return st.gathered; },
    get falls() { return st.falls; },
    total: fruit.length,
    look,
    start(onLanded) {
      st.onLanded = onLanded; st.state = 'bank'; st.gathered = 0; st.falls = 0;
      wally.pos.set(X, START.y, START.z); wally.root.position.copy(wally.pos); wally.facing = 0; wally.root.rotation.set(0, 0, 0); wally.vel.set(0, 0, 0);
    },
    update(dt, t, k) {
      // Every vine sways, and is drawn from its branch to its end (or to Wally's hands).
      VINES.forEach((vz, i) => {
        const s = st.state === 'swing' && st.vine === i ? st.swing : (swings[i] = { theta: Math.sin(t * 0.6 + i) * 0.05, omega: 0 });
        vines[i].draw(new THREE.Vector3(X, ANCHOR_Y, vz), P(vz, handAt(vz, s.theta)));
      });
      for (const p of fruit) if (!p.got) { p.m.rotation.y += dt * 1.2; p.m.position.y = p.s.y + Math.sin(t * 2 + p.s.z) * 0.08; }
      if (st.state === 'bank' && k.jump) onVine(0, firstSwing());
      else if (st.state === 'swing') {
        for (let a = 0; a < dt; a += DT) st.swing = swingStep(st.swing, k.forward > 0.3 ? 1 : 0, Math.min(DT, dt - a));
        hangWally(); armsUp(t);
        if (k.jump) { st.f = release(VINES[st.vine], st.swing); st.state = 'fly'; sound.play.leap(); }
      } else if (st.state === 'fly') {
        for (let a = 0; a < dt; a += DT) {
          st.f = flyStep(st.f, Math.min(DT, dt - a));
          const next = st.vine + 1;
          if (next < VINES.length && catches(st.f, next)) { onVine(next, grab(st.f, next)); break; }
          if (next >= VINES.length && landed(st.f)) {
            st.state = 'landed'; wally.pos.set(X, START.y, Math.max(st.f.z, END.z - 1)); wally.root.position.copy(wally.pos); wally.root.rotation.set(0, 0, 0);
            sound.play.land(); if (st.onLanded) st.onLanded(); break;
          }
          if (inSwamp(st.f)) {
            st.falls++; st.state = 'swing'; sound.play.splash(); fx.splash(new THREE.Vector3(X, SWAMP_Y, st.f.z), 24);
            toast('Splash! Back up the vine', 'bad'); st.vine = st.last; st.swing = { theta: -0.3, omega: 0 }; break;
          }
        }
        if (st.state === 'fly') { wally.pos.set(X, st.f.y - HANG, st.f.z); wally.root.position.copy(wally.pos); wally.root.rotation.set(-0.3, 0, 0); armsUp(t); }
      }
      // Pawpaws: swing or fly through them to gather them.
      if (st.state === 'swing' || st.state === 'fly') {
        const hy = wally.pos.y + HANG * 0.6;
        for (const p of fruit) if (!p.got && Math.hypot(p.s.z - wally.pos.z, p.s.y - hy) < PAWPAW_REACH) {
          p.got = true; p.m.visible = false; st.gathered++; sound.play.powerup();
          toast(`A pawpaw for the King! ${st.gathered} of ${fruit.length}`, 'good');
          if (st.gathered === 1) bubbles.say(wally.root, 'A ripe pawpaw! The King might like these.', 3);
        }
      }
    },
    // Where the play camera looks: ahead of him along the course, from the side.
    cameraTarget() { return new THREE.Vector3(X, Math.max(wally.pos.y + 1.5, 3), wally.pos.z + 4); },
    // From the side, inside the corridor of trees (not in the undergrowth).
    cameraFrom(at) { return new THREE.Vector3(X + 8.5, at.y + 3.5, at.z - 9); },
  };
}
