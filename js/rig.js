// rig.js
// Gives Ken's Wally model a skeleton in code, so the game can move him: legs,
// arms, spine, head, a jaw that snaps, and a five-bone tail. No outside rigging
// tool knows about a crocodile's tail or jaw, so this does it directly.
//
// How it works:
//   1. Joint positions are taken from the model itself, measured once from plots
//      of his shape (model units: y up, facing +z, feet at y = -0.66).
//   2. Every point of his skin is given to the bones of the part it belongs to
//      (an arm point only to that arm's bones, a tail point only to the tail),
//      shared between neighbouring bones by how close it is to each.
//   3. The game turns the bones each frame (WallyMotion below).

import * as THREE from 'three';

// Joint positions in each model's own units (y up, facing +z), measured from
// plots of its shape. Ken has made two Wallys:
//   run:   the first, caught mid-run (right arm and leg forward), mouth open, feet at y -0.66
//   tpose: the second, standing straight with arms out, mouth shut, feet at y -0.86
const SHAPES = {
  run: {
    P: {
      hips: [0, -0.25, 0.3], spine: [0, -0.02, 0.3], chest: [0, 0.17, 0.31], neck: [0, 0.29, 0.33],
      head: [0, 0.38, 0.37], headTip: [0, 0.42, 0.9], jaw: [0, 0.33, 0.43], jawTip: [0, 0.28, 0.88],
      shoulderL: [-0.2, 0.2, 0.27], elbowL: [-0.4, 0.22, 0.2], handL: [-0.55, 0.26, 0.15], handTipL: [-0.64, 0.29, 0.12],
      shoulderR: [0.2, 0.18, 0.4], elbowR: [0.4, 0.16, 0.5], handR: [0.55, 0.18, 0.58], handTipR: [0.64, 0.18, 0.62],
      hipL: [-0.11, -0.3, 0.24], kneeL: [-0.12, -0.45, 0.12], ankleL: [-0.13, -0.6, -0.02], toeL: [-0.13, -0.65, -0.14],
      hipR: [0.1, -0.3, 0.36], kneeR: [0.1, -0.43, 0.5], ankleR: [0.11, -0.58, 0.55], toeR: [0.12, -0.55, 0.7],
      tail0: [0, -0.25, 0.08], tail1: [0, -0.24, -0.15], tail2: [0, -0.2, -0.4], tail3: [0, -0.14, -0.62],
      tail4: [0, -0.14, -0.82], tailTip: [0, -0.19, -0.98],
    },
    // Which part of him a skin point belongs to. Only parts that sit close together
    // but must move apart get a hard line: the two jaws, and the arms from the body.
    partOf(x, y, z) {
      if (z > 0.43 && y < 0.345 && y > 0.2 && Math.abs(x) < 0.14) return 'jaw';
      if (Math.abs(x) > 0.27 && y > 0.0 && y < 0.42) return x < 0 ? 'armL' : 'armR';
      if (y > 0.28 && z > 0.12) return 'head';
      if (y < -0.15 || z < 0.1) return 'lower';
      return 'torso';
    },
    armNear: 0.33, shoulderX: 0.18, chestY: 0.05, thighY: -0.25,
    jawRest: -0.14,      // the mouth is open at rest; this closes it
    armDrop: 0,          // arms are already in a running pose
  },
  tpose: {
    P: {
      hips: [0, -0.3, 0.12], spine: [0, -0.05, 0.13], chest: [0, 0.2, 0.12], neck: [0, 0.4, 0.12],
      head: [0, 0.5, 0.13], headTip: [0, 0.62, 0.48], jaw: [0, 0.5, 0.2], jawTip: [0, 0.46, 0.5],
      shoulderL: [-0.24, 0.26, 0.1], elbowL: [-0.55, 0.25, 0.1], handL: [-0.83, 0.25, 0.1], handTipL: [-0.96, 0.25, 0.1],
      shoulderR: [0.24, 0.26, 0.1], elbowR: [0.55, 0.25, 0.1], handR: [0.83, 0.25, 0.1], handTipR: [0.96, 0.25, 0.1],
      hipL: [-0.17, -0.38, 0.12], kneeL: [-0.17, -0.58, 0.13], ankleL: [-0.17, -0.78, 0.1], toeL: [-0.17, -0.84, 0.3],
      hipR: [0.17, -0.38, 0.12], kneeR: [0.17, -0.58, 0.13], ankleR: [0.17, -0.78, 0.1], toeR: [0.17, -0.84, 0.3],
      tail0: [0, -0.2, -0.05], tail1: [0, -0.35, -0.15], tail2: [0, -0.5, -0.27], tail3: [0, -0.63, -0.38],
      tail4: [0, -0.75, -0.5], tailTip: [0, -0.85, -0.6],
    },
    partOf(x, y, z) {
      if (z > 0.2 && y < 0.515 && y > 0.4 && Math.abs(x) < 0.15) return 'jaw';
      if (Math.abs(x) > 0.3 && y > 0.1 && y < 0.42) return x < 0 ? 'armL' : 'armR';
      if (y > 0.42) return 'head';
      if (y < -0.2 || z < -0.02) return 'lower';
      return 'torso';
    },
    armNear: 0.36, shoulderX: 0.2, chestY: 0.1, thighY: -0.3,
    jawRest: 0,          // the mouth is shut at rest
    armDrop: -0.55,      // bring the T-pose arms down so he doesn't run like a scarecrow
  },
};

// A model standing in a T-pose is wider (arm to arm) than it is long; the
// running Wally is longer (snout to tail tip) than he is wide.
export function shapeFor(size) {
  return size.x > size.z ? 'tpose' : 'run';
}

// Each bone: [name, parent, the joint it turns at, the point its segment runs to].
const BONES = [
  ['hips', null, 'hips', 'spine'],
  ['spine', 'hips', 'spine', 'chest'],
  ['chest', 'spine', 'chest', 'neck'],
  ['neck', 'chest', 'neck', 'head'],
  ['head', 'neck', 'head', 'headTip'],
  ['jaw', 'head', 'jaw', 'jawTip'],
  ['shoulderL', 'chest', 'shoulderL', 'elbowL'], ['elbowL', 'shoulderL', 'elbowL', 'handL'], ['handL', 'elbowL', 'handL', 'handTipL'],
  ['shoulderR', 'chest', 'shoulderR', 'elbowR'], ['elbowR', 'shoulderR', 'elbowR', 'handR'], ['handR', 'elbowR', 'handR', 'handTipR'],
  ['thighL', 'hips', 'hipL', 'kneeL'], ['shinL', 'thighL', 'kneeL', 'ankleL'], ['footL', 'shinL', 'ankleL', 'toeL'],
  ['thighR', 'hips', 'hipR', 'kneeR'], ['shinR', 'thighR', 'kneeR', 'ankleR'], ['footR', 'shinR', 'ankleR', 'toeR'],
  ['tail0', 'hips', 'tail0', 'tail1'], ['tail1', 'tail0', 'tail1', 'tail2'], ['tail2', 'tail1', 'tail2', 'tail3'],
  ['tail3', 'tail2', 'tail3', 'tail4'], ['tail4', 'tail3', 'tail4', 'tailTip'],
];

// Which part of him a skin point belongs to, from where it is. Only parts that
// sit close together but must move apart get a hard line: the two jaws, and the
// arms from the body. Hips, legs and tail are left to distance (see 'lower').
export function partOf(x, y, z) {
  if (z > 0.43 && y < 0.345 && y > 0.2 && Math.abs(x) < 0.14) return 'jaw';
  if (Math.abs(x) > 0.27 && y > 0.0 && y < 0.42) return x < 0 ? 'armL' : 'armR';
  if (y > 0.28 && z > 0.12) return 'head';
  if (y < -0.15 || z < 0.1) return 'lower';
  return 'torso';
}

// The bones a point of each part may follow.
function candidates(S, part, x, y, z) {
  const jawStart = S.P.jaw[2] + 0.07;
  switch (part) {
    case 'jaw': return z < jawStart ? ['jaw', 'head'] : ['jaw'];
    case 'armL': return Math.abs(x) < S.armNear ? ['shoulderL', 'elbowL', 'handL', 'chest'] : ['shoulderL', 'elbowL', 'handL'];
    case 'armR': return Math.abs(x) < S.armNear ? ['shoulderR', 'elbowR', 'handR', 'chest'] : ['shoulderR', 'elbowR', 'handR'];
    case 'lower': return ['hips', 'spine', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'tail0', 'tail1', 'tail2', 'tail3', 'tail4'];
    case 'head': return ['head', 'neck'];
    default: {
      const list = ['hips', 'spine', 'chest', 'neck'];
      if (Math.abs(x) > S.shoulderX && y > S.chestY) list.push(x < 0 ? 'shoulderL' : 'shoulderR');
      if (y < S.thighY) list.push(x < 0 ? 'thighL' : 'thighR');
      return list;
    }
  }
}

const v3 = a => new THREE.Vector3(a[0], a[1], a[2]);

// Distance from a point to a bone's segment.
function segmentDistance(p, a, b) {
  const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

// Blends each point's bone pulls with its neighbours', a few times over, so
// skin crossing from one bone to the next bends instead of tearing. Points at the
// same place (split for the texture) are treated as one.
function smoothWeights(geo, W, B, rounds) {
  const pos = geo.attributes.position, n = pos.count;
  const key = new Map(), same = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    if (!key.has(k)) key.set(k, i);
    same[i] = key.get(k);
  }
  const idx = geo.index ? geo.index.array : Array.from({ length: n }, (_, i) => i);
  const nbr = Array.from({ length: n }, () => []);
  for (let t = 0; t < idx.length; t += 3) {
    const a = same[idx[t]], b = same[idx[t + 1]], c = same[idx[t + 2]];
    nbr[a].push(b, c); nbr[b].push(a, c); nbr[c].push(a, b);
  }
  // Copies of one place share the first copy's weights while smoothing.
  for (let i = 0; i < n; i++) if (same[i] !== i) for (let b = 0; b < B; b++) W[same[i] * B + b] = Math.max(W[same[i] * B + b], W[i * B + b]);
  const next = new Float32Array(W.length);
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n; i++) {
      if (same[i] !== i) continue;
      const list = nbr[i];
      for (let b = 0; b < B; b++) {
        let s = 0; for (const j of list) s += W[j * B + b];
        next[i * B + b] = list.length ? 0.5 * W[i * B + b] + 0.5 * s / list.length : W[i * B + b];
      }
    }
    for (let i = 0; i < n; i++) if (same[i] === i) for (let b = 0; b < B; b++) W[i * B + b] = next[i * B + b];
  }
  for (let i = 0; i < n; i++) if (same[i] !== i) for (let b = 0; b < B; b++) W[i * B + b] = W[same[i] * B + b];
}

// Turns Wally's plain mesh into one that bends with a skeleton.
// mesh: his THREE.Mesh, in the model's own units. Returns { skinned, bones }.
export function rigWally(mesh, shape = 'run') {
  const S = SHAPES[shape], P = S.P;
  const bones = {}, list = [];
  for (const [name, parent, joint] of BONES) {
    const b = new THREE.Bone(); b.name = name;
    const at = v3(P[joint]);
    b.position.copy(parent ? at.clone().sub(v3(P[BONES.find(r => r[0] === parent)[2]])) : at);
    if (parent) bones[parent].add(b);
    bones[name] = b; list.push(b);
  }
  const index = Object.fromEntries(list.map((b, i) => [b.name, i]));
  const seg = Object.fromEntries(BONES.map(([name, , joint, end]) => [name, [v3(P[joint]), v3(P[end])]]));

  const geo = mesh.geometry.clone();
  const pos = geo.attributes.position, n = pos.count, B = list.length;
  const W = new Float32Array(n * B);            // every bone's pull on every point
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    const names = candidates(S, S.partOf(p.x, p.y, p.z), p.x, p.y, p.z);
    // Closer bones pull harder; the falloff is steep so joints stay tidy.
    let total = 0;
    for (const name of names) {
      const d = segmentDistance(p, seg[name][0], seg[name][1]);
      const w = 1 / Math.pow(d * d + 0.0004, 2);
      W[i * B + index[name]] = w; total += w;
    }
    for (const name of names) W[i * B + index[name]] /= total;
  }
  smoothWeights(geo, W, B, 3);

  // Keep each point's four strongest bones.
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const top = [];
    for (let b = 0; b < B; b++) { const w = W[i * B + b]; if (w > 0.001) top.push([b, w]); }
    top.sort((a, b) => b[1] - a[1]).splice(4);
    const total = top.reduce((s, e) => s + e[1], 0) || 1;
    top.forEach(([b, w], k) => { skinIndex[i * 4 + k] = b; skinWeight[i * 4 + k] = w / total; });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  const skinned = new THREE.SkinnedMesh(geo, mesh.material);
  skinned.castShadow = true; skinned.receiveShadow = true;
  skinned.add(bones.hips);
  skinned.bind(new THREE.Skeleton(list));
  skinned.position.copy(mesh.position); skinned.quaternion.copy(mesh.quaternion); skinned.scale.copy(mesh.scale);
  // Remember each bone's rest turn, so moves are added on top of the rest pose.
  for (const b of list) b.userData.rest = b.quaternion.clone();
  return { skinned, bones, shape: S };
}

// ---- Moving the bones -----------------------------------------------------

// The angle a limb segment leans forward from straight down, in the rest pose.
function forwardLean(P, from, to) {
  const d = v3(P[to]).sub(v3(P[from]));
  return Math.atan2(d.z, -d.y);
}
function restAngles(P) {
  return {
    thighL: forwardLean(P, 'hipL', 'kneeL'), thighR: forwardLean(P, 'hipR', 'kneeR'),
    shinL: forwardLean(P, 'kneeL', 'ankleL') - forwardLean(P, 'hipL', 'kneeL'),
    shinR: forwardLean(P, 'kneeR', 'ankleR') - forwardLean(P, 'hipR', 'kneeR'),
  };
}

const e = new THREE.Euler(), q = new THREE.Quaternion();
function turn(bone, x = 0, y = 0, z = 0) {
  e.set(x, y, z, 'XYZ');
  bone.quaternion.copy(bone.userData.rest).multiply(q.setFromEuler(e));
}

// Drives the skeleton from what Wally is doing in the game. All big and bouncy:
// he is an excitable bloke.
export class WallyMotion {
  constructor(bones, shape) {
    this.b = bones; this.S = shape; this.REST = restAngles(shape.P);
    this.hipsRest = bones.hips.position.clone();
  }

  // s: { mode, speed (0..1), walk (stride phase), time, airborne, fromWater, cheer, napping, jaw (0..0.75) }
  update(s) {
    const B = this.b, REST = this.REST, S = this.S, t = s.time, m = s.speed, step = Math.sin(s.walk);
    const swim = s.mode === 'swim' && !s.airborne;

    // Legs: set how far each thigh swings forward, measured from straight down,
    // so his mid-stride rest pose becomes a proper running cycle.
    const legSwing = (side) => {
      const phase = side === 'L' ? step : -step;
      let thigh = phase * 0.75 * m, knee = Math.max(0, -Math.cos(s.walk + (side === 'L' ? 0 : Math.PI))) * 0.9 * m;
      if (m < 0.15 && !swim) { thigh = 0; knee = 0.1; }                       // standing
      if (s.airborne) { thigh = 0.7; knee = 1.1; }                            // knees tucked
      if (swim) { thigh = Math.sin(t * 7 + (side === 'L' ? 0 : Math.PI)) * 0.35; knee = 0.3; }
      if (s.napping) { thigh = 1.2; knee = 0.2; }
      turn(B[`thigh${side}`], -(thigh - REST[`thigh${side}`]));
      turn(B[`shin${side}`], (knee + REST[`shin${side}`]) * 0.9);
    };
    legSwing('L'); legSwing('R');

    // Body: bounce, lean into the run, shoulders twisting against the legs.
    const bounce = Math.abs(step) * 0.05 * m;
    B.hips.position.copy(this.hipsRest).add(new THREE.Vector3(0, bounce, 0));
    turn(B.spine, 0.12 * m, step * 0.15 * m, 0);
    turn(B.chest, 0.05 * m, step * 0.12 * m, Math.sin(t * 2) * 0.03);
    turn(B.neck, -0.12 * m, 0, 0);
    turn(B.head, Math.sin(s.walk * 2) * 0.06 * m, m < 0.15 ? Math.sin(t * 1.3) * 0.3 : 0, s.cheer > 0 ? Math.sin(t * 18) * 0.12 : 0);

    // Arms: his rest pose already has them flung out. Swing them hard when he
    // runs, wave them about when he stands, straight up when he cheers or jumps.
    const arm = (side) => {
      const sgn = side === 'L' ? 1 : -1;            // L is -x
      let up = 0, fwd = 0, bend = 0;
      if (s.cheer > 0 || s.airborne) { up = 1.0 + Math.sin(t * 25) * 0.1; }
      else if (swim) { fwd = Math.sin(t * 6 + (side === 'L' ? 0 : Math.PI)) * 0.9; up = -0.3; }
      else if (m > 0.15) { fwd = (side === 'L' ? -step : step) * 0.8 * m; up = -0.15; bend = 0.3; }
      else { up = Math.sin(t * 3.1 + sgn) * 0.35; fwd = Math.sin(t * 2.2 + sgn * 2) * 0.3; bend = 0.2 + Math.sin(t * 3.7) * 0.2; }
      if (s.napping) { up = -0.9; fwd = 0; }
      if (!(s.cheer > 0 || s.airborne)) up += S.armDrop;
      turn(B[`shoulder${side}`], 0, fwd * sgn, up * -sgn);
      turn(B[`elbow${side}`], 0, bend * sgn, 0);
    };
    arm('L'); arm('R');

    // Jaw: his rest pose has it open; it closes for a snap and opens wider for food.
    turn(B.jaw, S.jawRest + s.jaw * 0.55);

    // Tail: a wave runs down it, bigger when swimming; it lifts in a leap.
    const wag = swim ? 0.35 : 0.12 + m * 0.12;
    for (let i = 0; i < 5; i++) {
      const lift = s.airborne && s.fromWater ? -0.18 : (s.napping ? 0.05 : 0);
      turn(B[`tail${i}`], lift, Math.sin(t * (swim ? 6 : 4) - i * 0.8) * wag * (0.5 + i * 0.2), 0);
    }
  }
}

// ---- Moves for a rigged humanoid model that has no clip for them ---------------
// Meshy's Wally comes with run, walk, jump and swim, but no standing-still or
// cheering. For those the game moves his bones itself. Turns are given in the
// model's own frame (x his left, y up, z forward), so they mean the same thing
// whatever way each bone happens to point.

export class HumanoidPoser {
  constructor(modelRoot) {
    this.root = modelRoot;
    this.bones = {};
    modelRoot.updateWorldMatrix(true, true);
    const rootInv = modelRoot.getWorldQuaternion(new THREE.Quaternion()).invert();
    modelRoot.traverse(o => {
      if (!o.isBone) return;
      // 'mixamorig:LeftArm' in the file; the loader drops the colon, giving 'mixamorigLeftArm'.
      const key = o.name.replace(/^.*[:|]/, '').replace(/^mixamorig/, '');
      const parentQ = o.parent ? rootInv.clone().multiply(o.parent.getWorldQuaternion(new THREE.Quaternion())) : new THREE.Quaternion();
      this.bones[key] = { bone: o, rest: o.quaternion.clone(), parentQ, parentQInv: parentQ.clone().invert() };
    });
    this.ok = !!(this.bones.LeftArm && this.bones.RightArm && this.bones.Hips);
    // Which way each arm points at rest (+1 toward +x, -1 toward -x), measured
    // rather than assumed, so 'down' and 'forward' turn the right way.
    const side = (arm, fore) => {
      if (!this.bones[arm] || !this.bones[fore]) return arm.startsWith('Left') ? 1 : -1;
      const a = this.bones[arm].bone.getWorldPosition(new THREE.Vector3()), f = this.bones[fore].bone.getWorldPosition(new THREE.Vector3());
      const d = f.sub(a).applyQuaternion(rootInv);
      return Math.sign(d.x) || 1;
    };
    this.side = { Left: side('LeftArm', 'LeftForeArm'), Right: side('RightArm', 'RightForeArm') };
    this.rootInv = rootInv;
    this.hipsRest = this.bones.Hips ? this.bones.Hips.bone.position.clone() : null;
  }

  // Turn a bone by (x, y, z) radians about the model's own axes, on top of its rest pose.
  turn(name, x, y, z) {
    const b = this.bones[name];
    if (!b) return;
    const r = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
    b.bone.quaternion.copy(b.parentQInv).multiply(r).multiply(b.parentQ).multiply(b.rest);
  }

  // Add a turn (model axes) on top of whatever the clip has just posed, using the
  // parent's current direction. Used to lift his chin while he swims.
  tilt(name, x, y, z) {
    const b = this.bones[name];
    if (!b) return;
    const rootInv = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const parentQ = rootInv.multiply(b.bone.parent.getWorldQuaternion(new THREE.Quaternion()));
    const r = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
    b.bone.quaternion.premultiply(parentQ.clone().invert().multiply(r).multiply(parentQ));
  }

  // Chin up: he swims looking ahead, head out of the water.
  chinUp(amount = 0.7) {
    this.tilt('Neck', -amount * 0.5, 0, 0);
    this.tilt('Head', -amount * 0.5, 0, 0);
  }

  // s: { time, cheer, napping, look }
  pose(s) {
    const t = s.time, up = s.cheer > 0;
    const bounce = Math.abs(Math.sin(t * 4)) * 0.02;
    // Skeletons exported in centimetres keep a hip height near 100; in metres, near 1.
    const unit = this.hipsRest && Math.abs(this.hipsRest.y) > 5 ? 100 : 1;
    if (this.hipsRest) this.bones.Hips.bone.position.copy(this.hipsRest).add(new THREE.Vector3(0, bounce * unit, 0));
    // Standing: arms hanging naturally at his sides, elbows softly bent, hands
    // just in front of his hips, with a slow breath and a little weight shift.
    // Cheering: arms flung up.
    const breath = Math.sin(t * 1.6) * 0.03, shift = Math.sin(t * 0.7) * 0.04;
    // For an arm pointing along +x, turning about z by a negative angle lowers it;
    // mirrored for -x. Once it hangs down, turning about x swings it forward.
    for (const sideName of ['Left', 'Right']) {
      const k = this.side[sideName];
      if (up) {
        this.turn(`${sideName}Arm`, 0, 0, k * (0.9 + Math.sin(t * 25) * 0.15));
        this.turn(`${sideName}ForeArm`, 0, 0, 0);
      } else {
        const down = s.napping ? 1.45 : 1.35;
        // Lowered first (about z), then swung a little forward (about x) so the
        // hands hang just in front of his hips rather than behind.
        this.turn(`${sideName}Arm`, -0.55 - breath, 0, -k * (down - breath));
        this.turn(`${sideName}ForeArm`, 0, -k * 0.3, 0);
      }
    }
    this.turn('Spine', breath, 0, shift);
    this.turn('Head', up ? -0.2 : breath, up ? 0 : Math.sin(t * 0.5) * 0.35 + (s.look || 0), up ? Math.sin(t * 18) * 0.12 : -shift);
    for (const n of ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'Spine1', 'Spine2', 'Neck']) this.turn(n, 0, 0, 0);
  }
}
