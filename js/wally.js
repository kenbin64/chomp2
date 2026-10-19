// wally.js
// Wally the Cairns Crocodile: built from simple shapes to match the promo art
// (orange hibiscus shirt, orange board shorts, cream helmet with a flower),
// and the controls that move him.
//
// He has three ways of getting about, picked by where he is:
//   upright  on the bank, slower, mouth high for catching
//   fours    on the bank while Shift is held, faster, mouth low
//   swim     in the water; Space here is a croc leap, much higher than a land jump

import * as THREE from 'three';
import { ground } from './ground.js';
import { shirtTexture } from './textures.js';
import { dress } from './models.js';
import { rigWally, WallyMotion, shapeFor, HumanoidPoser } from './rig.js';

const SPEED = { upright: 6.5, fours: 9.5, swim: 5.5 };
const JUMP = { land: 8.5, water: 13, show: 11 };   // show: jumping on the spot, for the big Jump move
const TURN = 2.8;                // keyboard steering: how fast left and right turn him (radians a second)
const SPIN = 14;                 // and how fast down spins him round
const FALL = 22;                 // Wally's own gravity: snappier than the food's
const FLOAT_Y = -0.45;           // root height while swimming
const HIP = 1.1;                 // where a model is pivoted for leaning and swimming
const SWIM_LIFT = -0.92;         // Blender model, swimming: body just under the surface, eyes and snout above (Ken: like a real croc)

// Body shape for each way of moving. lean tips the torso forward,
// hipY is the height of the hips, tail is how steeply the tail drops.
const POSES = {
  upright: { lean: 0.12, hipY: 1.0, tail: 0.45 },
  fours:   { lean: 1.35, hipY: 0.72, tail: 0.06 },
  swim:    { lean: 1.5,  hipY: 0.2,  tail: 0.0 },
  leap:    { lean: -0.05, hipY: 1.0, tail: 0.9 },
};

const GREEN = 0x5f8f3e, BELLY = 0xe8dcb0, ORANGE = 0xf08a3c;

function m(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
}
function part(geo, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// ---- Model --------------------------------------------------------------

// A rounded bar: a capsule laid along the snout and squashed to size, so jaws
// read as smooth rather than boxy. w, h, d are its full width, height and length.
function rod(w, h, d) {
  const g = new THREE.CapsuleGeometry(0.5, 1, 8, 24);
  g.rotateX(Math.PI / 2);
  g.scale(w, h, d / 2);
  return g;
}


function buildHead(skin) {
  const head = new THREE.Group();
  const pink = m(0xd96b7a), tooth = m(0xfffaf0, { roughness: 0.4 });

  const skull = part(new THREE.SphereGeometry(0.42, 36, 28), skin, 0, 0.25, 0.05);
  skull.scale.set(1, 0.82, 1.1);
  const snout = part(rod(0.62, 0.26, 1.4), skin, 0, 0.17, 0.78);
  const palate = part(rod(0.5, 0.05, 1.2), pink, 0, 0.05, 0.78);
  head.add(skull, snout, palate);

  // The lower jaw hangs from a hinge so it can open and snap.
  const jaw = new THREE.Group();
  jaw.position.set(0, 0.05, 0.15);
  jaw.add(part(rod(0.58, 0.2, 1.28), skin, 0, -0.1, 0.62));
  jaw.add(part(rod(0.46, 0.05, 1.1), pink, 0, 0, 0.6));
  head.add(jaw);

  const cone = new THREE.ConeGeometry(0.045, 0.14, 10);
  for (let i = 0; i < 7; i++) {
    const z = 0.32 + i * 0.16;
    for (const s of [-1, 1]) {
      const up = part(cone, tooth, s * 0.27, 0.0, z); up.rotation.x = Math.PI; head.add(up);
      const low = part(cone, tooth, s * 0.25, 0.04, z - 0.15 + 0.08); jaw.add(low);
    }
  }

  for (const s of [-1, 1]) {
    head.add(part(new THREE.SphereGeometry(0.15, 24, 20), m(0xffffff), s * 0.19, 0.5, 0.22));
    head.add(part(new THREE.SphereGeometry(0.075, 20, 16), m(0x1b1b1b), s * 0.2, 0.52, 0.34));
    head.add(part(new THREE.SphereGeometry(0.03, 12, 12), m(0x2a2a2a), s * 0.1, 0.3, 1.43));
  }

  // Cream helmet with a dark band, a green badge and a pink flower.
  const hat = new THREE.Group();
  const cream = m(0xf3eedf);
  const dome = part(new THREE.SphereGeometry(0.46, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2), cream, 0, 0, 0);
  const brim = part(new THREE.CylinderGeometry(0.72, 0.72, 0.04, 40), cream, 0, 0.02, 0);
  const band = part(new THREE.CylinderGeometry(0.465, 0.465, 0.12, 40, 1, true), m(0x2b2b2b, { side: THREE.DoubleSide }), 0, 0.08, 0);
  const badge = part(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 32), m(0x3f9b3f), 0, 0.22, 0.43);
  badge.rotation.x = Math.PI / 2 - 0.3;
  hat.add(dome, brim, band, badge);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    hat.add(part(new THREE.SphereGeometry(0.07, 16, 12), m(0xff9fcf), 0.42 + Math.cos(a) * 0.06, 0.15 + Math.sin(a) * 0.06, 0.18));
  }
  hat.add(part(new THREE.SphereGeometry(0.04, 12, 12), m(0xffd43b), 0.45, 0.15, 0.2));
  hat.position.set(0, 0.48, 0.02);
  hat.rotation.x = -0.12;
  head.add(hat);

  // The point that catches food: between the jaws, near the tip.
  const mouth = new THREE.Object3D();
  mouth.position.set(0, 0.05, 1.0);
  head.add(mouth);

  return { head, jaw, mouth };
}

function buildWally() {
  const root = new THREE.Group();
  const skin = m(GREEN, { roughness: 0.8 });
  const shirt = m(0xffffff, { map: shirtTexture(), side: THREE.DoubleSide });
  const shorts = m(ORANGE);

  // Hips do not tip, so legs and tail stay underneath and behind him.
  const pelvis = new THREE.Group();
  root.add(pelvis);
  pelvis.add(part(new THREE.CylinderGeometry(0.62, 0.58, 0.5, 36), shorts, 0, 0.05, 0));

  const legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(s * 0.32, 0, 0);
    hip.add(part(new THREE.CylinderGeometry(0.22, 0.2, 1, 20), skin, 0, -0.5, 0));
    hip.add(part(new THREE.CylinderGeometry(0.25, 0.25, 0.32, 20), shorts, 0, -0.12, 0)); // short leg of the board shorts
    const foot = part(new THREE.BoxGeometry(0.34, 0.14, 0.55), skin, 0, -1, 0.16);
    hip.add(foot);
    pelvis.add(hip);
    return hip;
  });

  const tail = [];
  let parent = pelvis, len = 0.75;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? -0.05 : 0, i === 0 ? -0.35 : -len);
    const r = 0.36 - i * 0.055;
    const body = part(new THREE.CylinderGeometry(Math.max(0.05, r - 0.05), r, len, 10), skin, 0, 0, -len / 2);
    body.rotation.x = Math.PI / 2;
    seg.add(body);
    seg.add(part(new THREE.ConeGeometry(0.06, 0.18, 8), skin, 0, r - 0.02, -len / 2));
    parent.add(seg); tail.push(seg); parent = seg; len *= 0.92;
  }

  // Everything above the hips tips forward as one piece.
  const torso = new THREE.Group();
  pelvis.add(torso);
  const trunk = part(new THREE.CapsuleGeometry(0.52, 1.0, 8, 24), skin, 0, 0.85, 0);
  const belly = part(new THREE.SphereGeometry(0.5, 32, 24), m(BELLY), 0, 0.85, 0.12);
  belly.scale.set(0.82, 1.35, 0.8);
  const shirtBody = part(new THREE.CylinderGeometry(0.6, 0.63, 1.05, 40, 1, true), shirt, 0, 0.95, 0);
  shirtBody.material.side = THREE.DoubleSide;
  // Open shirt: the belly shows down the front, so cut the front of the cylinder away.
  shirtBody.geometry = new THREE.CylinderGeometry(0.6, 0.63, 1.05, 40, 1, true, 0.55, Math.PI * 2 - 1.1);
  torso.add(trunk, belly, shirtBody);

  const arms = [-1, 1].map(s => {
    const shoulder = new THREE.Group(); shoulder.position.set(s * 0.66, 1.35, 0);
    shoulder.add(part(new THREE.CylinderGeometry(0.27, 0.27, 0.36, 24, 1, true), shirt, 0, -0.1, 0));
    shoulder.add(part(new THREE.CylinderGeometry(0.15, 0.13, 0.85, 20), skin, 0, -0.45, 0));
    shoulder.add(part(new THREE.SphereGeometry(0.17, 20, 16), skin, 0, -0.9, 0.04));
    shoulder.rotation.z = s * 0.15;
    torso.add(shoulder);
    return shoulder;
  });

  const { head, jaw, mouth } = buildHead(skin);
  const neck = new THREE.Group(); neck.position.set(0, 1.78, 0.05);
  neck.add(head);
  torso.add(neck);

  return { root, pelvis, torso, legs, arms, tail, neck, jaw, mouth };
}

// ---- Controller ---------------------------------------------------------

export class Wally {
  constructor(scene) {
    this.parts = buildWally();
    this.root = this.parts.root;
    scene.add(this.root);
    const s = ground.start();
    this.pos = new THREE.Vector3(s.x, s.y, s.z);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.grounded = true;
    this.surface = 'land';      // water, land, deck or rock
    this.fromWater = false;
    this.facing = Math.PI;      // looking at the lagoon
    this.mode = 'upright';
    this.pose = { ...POSES.upright };
    this.walk = 0;
    this.jawOpen = 0; this.jawWant = 0.1; this.snap = 0;
    this.cheer = 0; this.napping = false;
    this.time = 0;
  }

  get airborne() { return !this.grounded; }

  // Wear Ken's model if there is one (models/wally.glb).
  useModel(gltf) {
    this.skin = dress(this.root, gltf, { height: 2.7 });
    if (!this.skin) return;
    this.skin.source = gltf;
    // Hang the model from a pivot at hip height, so it can lean, lie forward to
    // swim and tip back for a leap like a body, not like a post.
    const pivot = new THREE.Group();
    pivot.position.y = HIP;
    this.skin.root.position.y -= HIP;
    this.root.add(pivot);
    pivot.add(this.skin.root);
    this.skin.pivot = pivot;

    // A rigged model with clips: the clips do running, jumping and swimming, and
    // code poses him for moves it has no clip for (standing, cheering, napping).
    if (this.skin.clips.size > 0) this.poser = new HumanoidPoser(this.skin.root);

    // A model with no skeleton of its own gets one in code (rig.js), so his
    // legs, arms, jaw and tail move with what he does.
    if (this.skin.clips.size === 0) {
      let mesh = null;
      this.skin.root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && !mesh) mesh = o; });
      if (mesh) {
        mesh.geometry.computeBoundingBox();
        const shapeName = shapeFor(mesh.geometry.boundingBox.getSize(new THREE.Vector3()));
        const { skinned, bones, shape } = rigWally(mesh, shapeName);
        mesh.parent.add(skinned);
        mesh.parent.remove(mesh);
        this.motion = new WallyMotion(bones, shape);
      }
    }
  }

  // Put on a different model in the middle of a level (Ken: a whole-model
  // outfit from the catalogue, like the safari explorer, goes on straight away).
  // The old model and its pivot go; the soft shadow under him stays just one.
  changeModel(gltf) {
    if (!gltf || (this.skin && this.skin.source === gltf)) return false;
    const keep = new Set(this.root.children);
    if (this.skin) { keep.delete(this.skin.pivot); this.skin.pivot.removeFromParent(); }
    this.skin = null; this.poser = null; this.motion = null;
    this.useModel(gltf);
    const hadShadow = [...keep].some(o => o.userData && o.userData.contactShadow);
    for (const o of [...this.root.children]) if (!keep.has(o) && o !== (this.skin && this.skin.pivot) && hadShadow && o.userData && o.userData.contactShadow) o.removeFromParent();
    return true;
  }

  // Bones do the limbs; the pivot still lays him along the water to swim and
  // over on his side for a nap, which no leg movement can do.
  moveRigged(dt, speed) {
    const p = this.skin.pivot;
    let pitch = 0, roll = 0, lift = 0;
    if (this.napping) { roll = 1.35; lift = -HIP + 0.35; }
    else if (this.mode === 'swim' && !this.airborne) { pitch = 1.35; lift = -HIP + 0.55; }
    else if (this.mode === 'fours' && !this.airborne) { pitch = 0.9; lift = -0.6; }
    const k = Math.min(1, dt * 10);
    p.rotation.x += (pitch - p.rotation.x) * k;
    p.rotation.z += (roll - p.rotation.z) * k;
    p.rotation.y += (0 - p.rotation.y) * k;
    p.position.y += (HIP + lift - p.position.y) * k;
    this.motion.update({
      mode: this.mode, speed: this.napping ? 0 : Math.min(1, speed / 5), walk: this.walk, time: this.time,
      airborne: this.airborne, fromWater: this.fromWater, cheer: this.cheer, napping: this.napping, jaw: this.jawOpen,
    });
  }

  // For a model with no animations yet: move the whole of it by what he is
  // doing. A stopgap until the model is rigged; it still reads as alive.
  moveWhole(dt, speed) {
    const p = this.skin.pivot, t = this.time;
    const moving = Math.min(1, speed / 5);
    let pitch = 0, roll = 0, yaw = 0, lift = 0;
    if (this.napping) { roll = 1.35; lift = -HIP + 0.35; }
    else if (this.mode === 'swim' && !this.airborne) {
      pitch = 1.35; lift = -HIP + 0.55;                       // lying along the water
      yaw = Math.sin(t * 5) * 0.12 * (0.3 + moving);
      roll = Math.sin(t * 2.5) * 0.05;
    } else if (this.airborne) {
      pitch = this.fromWater ? -0.15 : -0.1;
      roll = Math.sin(t * 9) * 0.06;
    } else {
      const step = Math.sin(this.walk);
      lift = Math.abs(step) * 0.22 * moving + Math.sin(t * 3) * 0.03;
      pitch = 0.18 * moving;
      roll = step * 0.1 * moving;
      yaw = step * 0.08 * moving + (moving < 0.2 ? Math.sin(t * 1.3) * 0.15 : 0);
      if (this.mode === 'fours') { pitch = 0.9; lift -= 0.6; }
    }
    if (this.cheer > 0) { lift += Math.sin((0.8 - this.cheer) / 0.8 * Math.PI) * 0.45; yaw += Math.sin(t * 25) * 0.15; }
    const k = Math.min(1, dt * 10);
    p.rotation.x += (pitch - p.rotation.x) * k;
    p.rotation.z += (roll - p.rotation.z) * k;
    p.rotation.y += (yaw - p.rotation.y) * k;
    p.position.y += (HIP + lift - p.position.y) * k;
  }

  // Pick the model's animation from what he is doing. Missing clips fall back
  // to the nearest one the model has.
  playModel(dt, speed) {
    const s = this.skin;
    if (!s) return;
    if (this.motion) { this.moveRigged(dt, speed); return; }
    if (s.clips.size === 0) { this.moveWhole(dt, speed); return; }
    // Air time of a hop and of a croc leap, from the jump speeds above, so the
    // jump clip lasts exactly as long as he is off the ground.
    const airTime = (this.fromWater ? JUMP.water : this.standingJump ? JUMP.show : JUMP.land) * 2 / FALL;
    // Wally's Blender model has every move as a clip, Celebrate for cheering,
    // and Chomp, Grab and GroundPick for eating. Older models fall back.
    const blender = s.has('chomp');
    this.picking = Math.max(0, (this.picking || 0) - dt);
    this.hurt = Math.max(0, (this.hurt || 0) - dt);
    if (this.eat && blender) {
      if (this.eat === 'ground' && this.mode !== 'swim' && !this.airborne) this.picking = 1.0;
      else if (this.mode !== 'swim' && Math.random() < 0.45) s.overlay('grab', { speed: 1.4 });   // hands, then mouth
      else s.overlay('chomp');                                                                   // straight in the jaws
    }
    this.eat = null;
    let playing = false;
    if (this.napping) playing = s.play('nap');
    else if (this.airborne) playing = s.play(this.standingJump ? 'jump' : 'leap', { once: true, alternatives: ['jump'], fit: airTime });
    else if (this.hurt > 0 && blender && this.mode !== 'swim') playing = s.play('hurt', { once: true });   // in the water a sting keeps him swimming
    else if (this.picking > 0) playing = s.play('groundpick', { once: true });
    // Catches set cheer to 0.8 and the eating moves show those; Celebrate is for
    // the big moments (level done, treasure), which set it to 1.2 or more.
    else if (this.cheer > (blender ? 0.85 : 0)) playing = s.play('cheer', { alternatives: ['celebrate'] });
    else if (this.mode === 'swim') playing = s.play('swim', { speed: 0.6 + Math.min(1, speed / 5) });
    else if (speed > 3.5) playing = s.play(this.mode === 'fours' ? 'run_fours' : 'run', { alternatives: ['run'], speed: speed / 6.5 });
    else if (speed > 0.6) playing = s.play('walk', { alternatives: ['run'], speed: Math.max(0.6, speed / 3) });
    else playing = s.play('idle');
    if (!playing) s.stop();
    s.update(dt);
    if (!playing && this.poser && this.poser.ok) this.poser.pose({ time: this.time, cheer: this.cheer, napping: this.napping });
    if (!blender) {
      if (playing && this.mode === 'swim' && !this.airborne && this.poser && this.poser.ok) this.poser.chinUp(0.8);   // head up, looking ahead
      if (s.jaw) s.jaw.rotation.x += this.jawOpen;        // the catch still opens his jaw
    }

    // Lying down for a nap is the pivot's job, as no clip does it.
    const p = s.pivot, k = Math.min(1, dt * 10);
    // The Blender Swim clip lays him flat at hip height (about 1 m up); lower
    // him so his back is at the water line with eyes and snout just above it.
    const swimming = blender && this.mode === 'swim' && !this.airborne;
    const roll = this.napping ? 1.35 : 0, lift = this.napping ? -HIP + 0.35 : (swimming ? SWIM_LIFT : 0);
    p.rotation.z += (roll - p.rotation.z) * k;
    p.position.y += (HIP + lift - p.position.y) * k;
  }

  // Where food has to be to be caught.
  mouthPosition(out = new THREE.Vector3()) {
    return this.parts.mouth.getWorldPosition(out);
  }

  // Called by the game on a catch: jaws slam shut.
  // A catch. how: 'air', 'leap' or 'ground' (see rules.catchPoints). With
  // Wally's Blender moves he snaps it out of the air with his jaws, or catches it
  // in his hands and brings it to his mouth, or bends down for food on the ground.
  chomp(how = 'air') { this.snap = 0.25; this.cheer = 0.8; this.eat = how; }

  // Out of puff: he flops down for a nap (costs a life), then gets back up.
  setNapping(on) { this.napping = on; }

  // input: { forward, right, jump, fours } ; camYaw: which way the camera looks ;
  // pace: multiplier from energy and power-ups. Returns events for sound.
  update(dt, input, camYaw, pace) {
    const events = [];
    this.time += dt;
    const inWater = this.surface === 'water';
    // His way of moving follows where he is: swimming in water, upright on the
    // boardwalk, and on the banks upright unless the player drops him to all fours.
    const onBoards = this.surface === 'deck';
    this.mode = inWater ? 'swim' : (input.fours && !onBoards ? 'fours' : 'upright');

    let want;
    if (input.steer) {
      // Keyboard (Ken, 2026-10-17): Left and Right turn him smoothly for as long
      // as they are held, at any angle, not in steps. On their own he turns on
      // the spot; with Up held he runs and steers. Up runs ahead the way he
      // faces. Down spins him round once and he runs the other way while held.
      if (input.forward < 0 && !(this.lastForward < 0)) this.turnLeft = (this.turnLeft || 0) + Math.PI;
      this.lastForward = input.forward;
      if (this.turnLeft) {
        const step = Math.sign(this.turnLeft) * Math.min(Math.abs(this.turnLeft), SPIN * dt);
        this.facing += step; this.turnLeft -= step;
        if (Math.abs(this.turnLeft) < 1e-4) this.turnLeft = 0;
      }
      // Turning eases in over a moment, so a tap nudges him a little and a hold sweeps round.
      this.turnRate = (this.turnRate || 0) + ((-input.right * TURN) - (this.turnRate || 0)) * Math.min(1, dt * 10);
      this.facing += this.turnRate * dt;
      const going = input.forward !== 0 && Math.abs(this.turnLeft || 0) < 0.3 ? 1 : 0;
      want = new THREE.Vector3(Math.sin(this.facing) * going, 0, Math.cos(this.facing) * going);
    } else {
      // Phone stick: relative to the camera, forward is away from it.
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      want = new THREE.Vector3(fx * input.forward + Math.cos(camYaw) * input.right, 0,
                               fz * input.forward - Math.sin(camYaw) * input.right);
      if (want.lengthSq() > 1) want.normalize();
    }
    want.multiplyScalar(SPEED[this.mode] * pace);
    this.vel.lerp(want, Math.min(1, dt * (this.airborne ? 2 : 8)));
    this.moveFlat(dt);

    // Jumping: a hop on land, a full croc leap out of the water. Forgiving, as
    // platform games are: a press up to 0.15 s before landing still counts when
    // he lands (a jump buffer), and he can still jump for 0.12 s after stepping
    // off an edge ("coyote time").
    this.jumpBuffer = input.jump ? 0.15 : Math.max(0, (this.jumpBuffer || 0) - dt);
    this.coyote = this.grounded ? 0.12 : Math.max(0, (this.coyote || 0) - dt);
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0) && this.vy <= 0) {
      this.jumpBuffer = 0; this.coyote = 0;
      // Standing still, he puts on a show: a big high jump (the Jump move, with a
      // spin). On the run it is a quick straight leap forward (the Leap move).
      this.standingJump = !inWater && Math.hypot(this.vel.x, this.vel.z) < 1.5;
      this.vy = (inWater ? JUMP.water : (this.standingJump ? JUMP.show : JUMP.land)) * (this.springNext ? 1.8 : 1);   // Spring Step (gear.js): one big jump
      this.springNext = false;
      this.fromWater = inWater;
      this.grounded = false;
      events.push(inWater ? 'leap' : 'jump');
    }

    // Fall onto whatever is underneath: water, bank, boardwalk or rock.
    if (!this.grounded) { this.vy -= FALL * dt; this.pos.y += this.vy * dt; }
    const under = ground.stand(this.pos.x, this.pos.z, this.pos.y, FLOAT_Y, this.airborne && this.fromWater);
    if (this.pos.y <= under.y + 0.001 && this.vy <= 0) {
      if (!this.grounded && under.surface === 'water') events.push('splash');
      if (!this.grounded && under.surface !== 'water') events.push('land');
      this.pos.y = under.y; this.vy = 0; this.grounded = true; this.surface = under.surface;
    } else if (this.grounded && under.y < this.pos.y - 0.4) {
      this.grounded = false; this.vy = 0; this.fromWater = false;   // walked off an edge
    } else if (this.grounded) {
      this.pos.y = under.y; this.surface = under.surface;           // follow slopes and ramps
    }
    this.root.position.copy(this.pos);

    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.4 && !input.steer) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 10);
    }
    this.root.rotation.y = this.facing;

    this.animate(dt, speed);
    this.playModel(dt, speed);
    return events;
  }

  // Horizontal move. The park edge is a wall everywhere; up on the boardwalk the
  // railings are too, except at a gap or the steps (rules.railClamp).
  moveFlat(dt) {
    const nx = this.pos.x + this.vel.x * dt;
    let nz = this.pos.z + this.vel.z * dt;
    const c = ground.move(this.pos.x, this.pos.z, nx, nz, this.pos.y);
    this.pos.x = c.x; this.pos.z = c.z;
  }

  // Knocked back and dazed, e.g. by a jellyfish sting.
  knock(fromX, fromZ) {
    this.hurt = 0.8;                             // the Hurt move, if the model has one
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
    this.vel.set(dx / d * 7, 0, dz / d * 7);
    if (this.grounded) { this.vy = 5; this.grounded = false; this.fromWater = false; }
  }

  // Wally is an excitable bloke and moves like one: big arm flails, a bounce in
  // every step, arms up when he jumps, a celebration on every catch.
  animate(dt, speed) {
    const P = this.parts, t = this.time;
    const target = this.napping ? POSES.swim : (this.airborne && this.fromWater ? POSES.leap : POSES[this.mode]);
    const k = Math.min(1, dt * 7);
    for (const key of ['lean', 'hipY', 'tail']) this.pose[key] += (target[key] - this.pose[key]) * k;

    const moving = this.napping ? 0 : Math.min(1, speed / 5);
    this.walk += dt * (5 + speed * 1.6);
    const step = Math.sin(this.walk);
    const upright = this.mode === 'upright' && !this.napping;
    const bounce = upright ? Math.abs(step) * 0.18 * moving + Math.sin(t * 4) * 0.03 : 0;

    P.pelvis.position.y = this.pose.hipY + bounce;
    P.torso.rotation.x = this.pose.lean + (upright ? 0.12 * moving : 0);
    P.torso.rotation.y = upright ? step * 0.22 * moving : 0;                  // shoulders twist as he runs
    P.neck.rotation.x = -this.pose.lean * 0.95 + (upright ? Math.sin(this.walk * 2) * 0.08 * moving : 0);
    P.neck.rotation.y = upright && !moving ? Math.sin(t * 1.3) * 0.35 : 0;   // looking about when standing

    const swing = step * 1.1 * moving;
    const legScale = Math.max(0.2, this.pose.hipY);
    P.legs.forEach((leg, i) => {
      leg.scale.y = legScale;
      let x = (i ? swing : -swing);
      if (this.airborne) x = -0.9 + (i ? 0.3 : -0.3);                         // knees tucked in the air
      if (this.mode === 'swim') x = Math.sin(t * 6 + i * Math.PI) * 0.5 - this.pose.lean * 0.75;
      leg.rotation.x = x;
    });

    this.cheer = Math.max(0, this.cheer - dt);
    const onFours = this.mode === 'fours';
    P.arms.forEach((arm, i) => {
      const side = i ? 1 : -1;
      let x, z;
      if (this.napping) { x = 0.2; z = side * 0.3; }
      else if (this.cheer > 0) { x = -3.0 + Math.sin(t * 30) * 0.25; z = side * 0.35; }       // arms up, shaking
      else if (this.airborne) { x = -2.6; z = side * 0.6; }                                        // arms flung up
      else if (onFours) { x = -this.pose.lean + (i ? -swing : swing); z = side * 0.15; }
      else if (this.mode === 'swim') { x = 1.2 + Math.sin(t * 6 + i * Math.PI) * 0.6; z = side * 0.4; }
      else if (moving > 0.2) { x = (i ? -swing : swing) * 1.2 - 0.3; z = side * (0.45 + Math.abs(step) * 0.3); } // flailing run
      else { x = -0.7 + Math.sin(t * 3.2 + i * 1.7) * 0.5; z = side * (0.5 + Math.sin(t * 2.1 + i) * 0.2); }  // talking with his hands
      arm.rotation.x = x; arm.rotation.z = z;
    });

    const sway = this.mode === 'swim' ? 0.5 : 0.18 + moving * 0.2;
    P.tail.forEach((seg, i) => {
      seg.rotation.y = Math.sin(t * (this.mode === 'swim' ? 6 : 4) - i * 0.7) * sway;
      seg.rotation.x = i === 0 ? this.pose.tail : -this.pose.tail / 4;
    });

    // Jaw: open when food is near, slam shut on a catch, a big grin otherwise.
    this.snap = Math.max(0, this.snap - dt);
    const want = this.napping ? 0 : (this.snap > 0.15 ? 0 : Math.max(this.jawWant, upright && !moving ? 0.18 + Math.max(0, Math.sin(t * 5)) * 0.15 : 0));
    this.jawOpen += (want - this.jawOpen) * Math.min(1, dt * (this.snap > 0 ? 40 : 10));
    P.jaw.rotation.x = this.jawOpen;
    P.neck.rotation.z = this.snap > 0 ? Math.sin(this.snap * 60) * 0.18 : (this.cheer > 0 ? Math.sin(t * 18) * 0.12 : 0);
  }
}
