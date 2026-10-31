// eyes.js
// Seeing through Wally's eyes whenever he is in the water (Ken, 2026-10-30), as in the boomerang throw: the camera
// eases forward from behind him into his head, he is hidden so we are not inside it, and under the surface the
// picture takes on the water's colour. Coming out, it eases back. Each level says when, and whether he is under.
// The view turns through cam.yaw, the same angle the third-person camera uses, so the guide arrow and the
// controls stay right, a drag still looks around, and there is no swing when the view hands back.

import * as THREE from 'three';
import { ownView } from './bubbles.js';
import { loadModels, ModelSkin } from './models.js';

const HIGH = 0.75;                 // eyes above where he floats: just clear of the surface
const FORWARD = 0.4;               // and ahead of his middle, near the front of his head
const TILT_TOP = 0.04, TILT_UNDER = 0.24;   // how far the view looks down (per metre ahead): under, at the bed

// What Wally sees of himself: a whole crocodile, Ken's croc-regular (Ken, 2026-10-31: "that way there is no way to just
// show the back"), with the camera over his head. His snout runs out ahead along the bottom of the picture and the rest of
// him carries on behind the camera, so there is no end to see. Level, as he swims, pointing the way he faces. Eating, the
// head rears up on its neck and snaps down. His right arm can reach forward, to hold a fishing rod (marlin-fight.js).
// Drawn last and over everything, because he floats so low the water would cut him off (the depth is cleared just for
// him). On his own layer, so he stays out of the water's reflection.
const OVER = 20, SNOUT_LAYER = 1;
const SEAT = { up: 0.86, back: 0.7 };                                    // the camera, above and behind his nose's end of him, in the fitted model's metres
const SWING = 0.3;                                                       // radians at most off the view
const CHOMP_TIME = 0.55, REAR = 0.5;
const ARM = { yaw: 1.4, lift: -0.3, fore: -0.45 };                     // his right arm, holding the rod
const axis = new THREE.Vector3(), turnQ = new THREE.Quaternion(), upQ = new THREE.Quaternion();
// Turn a bone by an angle about an axis given in the group's own terms, whatever its own axes are.
function turnBone(bone, group, x, y, z, angle) {
  bone.parent.getWorldQuaternion(upQ).invert();
  axis.set(x, y, z).applyQuaternion(group.getWorldQuaternion(turnQ)).applyQuaternion(upQ).normalize();
  bone.quaternion.premultiply(turnQ.setFromAxisAngle(axis, angle));
}
export function createSnout(scene, camera) {
  const g = new THREE.Group(); g.name = 'snout-view'; g.visible = false; g.rotation.order = 'YXZ'; g.userData.ARM = ARM; scene.add(g);
  camera.layers.enable(SNOUT_LAYER);
  const light = matchMedia('(pointer: coarse)').matches;                  // (a phone: the lighter copy)
  let skin = null, bones = {}, holding = false;
  const rest = new Map();                                                 // each bone as modelled: a pose starts from this each frame, or the turns would add up
  loadModels(['croc-regular'], { light }).then(found => {
    const gltf = found.get('croc-regular');
    if (!gltf) return;
    skin = new ModelSkin(gltf, { length: 3.6 });
    let first = true;
    skin.root.traverse(o => {
      if (o.isBone) { bones[o.name] = o; rest.set(o, o.quaternion.clone()); }
      if (!o.isMesh) return;
      o.material = o.material.clone(); o.material.transparent = true; o.material.fog = false; o.material.color.set(0x9ed47a);   // green, as Wally is
      o.renderOrder = OVER; o.layers.set(SNOUT_LAYER); o.frustumCulled = false; o.castShadow = o.receiveShadow = false;
      if (first) { o.onBeforeRender = renderer => renderer.clearDepth(); first = false; }
    });
    const seat = new THREE.Group(); seat.position.set(0, -SEAT.up, -SEAT.back); seat.add(skin.root); g.add(seat);
  });
  const look = new THREE.Vector3();
  let chomping = CHOMP_TIME, rear = 0;
  return {
    show(on) { g.visible = on; },
    // He has just eaten. from: how far through it to start (0 to 1), for looking at one moment of it.
    chomp(from = 0) { chomping = from * CHOMP_TIME; },
    // His right arm up and forward, or back to swimming.
    holdRod(on) { holding = on; },
    // Where his right hand is, into v. False if the model is not there.
    handAt(v) { if (!bones.RightHand) return false; g.updateMatrixWorld(true); bones.RightHand.getWorldPosition(v); return true; },
    update(dt) {
      chomping = Math.min(CHOMP_TIME, chomping + dt);
      const u = chomping / CHOMP_TIME;
      let k;                                                               // 1: right up; 0: at rest
      if (u < 0.45) { const e = u / 0.45; k = e * e * (3 - 2 * e); }       // up it comes
      else if (u < 0.62) { const e = (u - 0.45) / 0.17; k = 1 - e * e; }   // and slams down
      else k = -0.12 * Math.sin((u - 0.62) / 0.38 * Math.PI) * (1 - u);    // with a little bounce in the water
      rear = REAR * k; g.userData.rear = rear;
      if (!skin) return;
      if (!holding) { skin.play('idle', { alternatives: ['swim'] }); skin.update(dt); }   // (fishing, he holds still: the rod must not wander)
      g.updateMatrixWorld(true);
      // (On top of whatever the clip has done, each frame.) The head rears: a little from the neck, more from the head.
      if (rear && bones.Neck) { bones.Neck.quaternion.copy(rest.get(bones.Neck)); g.updateMatrixWorld(true); turnBone(bones.Neck, g, 1, 0, 0, -rear * 0.45); g.updateMatrixWorld(true); }
      if (rear && bones.Head) { bones.Head.quaternion.copy(rest.get(bones.Head)); g.updateMatrixWorld(true); turnBone(bones.Head, g, 1, 0, 0, -rear * 0.55); }
      if (holding && bones.RightArm) {
        bones.RightArm.quaternion.copy(rest.get(bones.RightArm)); if (bones.RightForeArm) bones.RightForeArm.quaternion.copy(rest.get(bones.RightForeArm));
        g.updateMatrixWorld(true);
        turnBone(bones.RightArm, g, 0, 1, 0, ARM.yaw); g.updateMatrixWorld(true);        // from out at his side, round to the front
        turnBone(bones.RightArm, g, 1, 0, 0, ARM.lift); g.updateMatrixWorld(true);       // and up
        if (bones.RightForeArm) turnBone(bones.RightForeArm, g, 1, 0, 0, ARM.fore);      // the hand higher still, in view
      }
      g.updateMatrixWorld(true);
    },
    // Once the camera is placed. heading: the way he faces.
    place(heading) {
      camera.getWorldDirection(look);
      const view = Math.atan2(look.x, look.z), off = Math.atan2(Math.sin(heading - view), Math.cos(heading - view));
      g.position.copy(camera.position);
      g.rotation.set(0, view + Math.max(-SWING, Math.min(SWING, off)), 0);  // level, whichever way the view tips
      g.scale.setScalar(Math.min(1, 0.55 + camera.aspect * 0.35));         // smaller on a tall, narrow phone screen, clear of the buttons
    },
  };
}

export function createEyes({ camera, wally, cam, canvas }) {
  const tint = document.createElement('div'); tint.className = 'dive-tint'; canvas.after(tint);   // over the picture, under the buttons
  const probe = new THREE.PerspectiveCamera(), pos = new THREE.Vector3(), look = new THREE.Vector3(), from = new THREE.Quaternion();
  let under = 0, hidden = false;
  const snout = createSnout(wally.root.parent, camera);
  const hide = h => { if (h !== hidden) { hidden = h; wally.root.visible = !h; snout.show(h); ownView(h ? wally.root : null, camera); } };

  return {
    // Each frame, once the camera is placed behind him. want: in the water and playing. isUnder: below the surface.
    step(dt, want, isUnder = false) {
      cam.eyes = (cam.eyes || 0) + ((want ? 1 : 0) - (cam.eyes || 0)) * Math.min(1, dt * 4);
      if (cam.eyes < 0.004) cam.eyes = 0;
      under += ((want && isUnder ? 1 : 0) - under) * Math.min(1, dt * 4);
      hide(cam.eyes > 0.6);
      tint.style.opacity = (cam.eyes * under * 0.42).toFixed(3);
      if (!cam.eyes) return;
      if (want && cam.manual > 0) wally.facing = cam.yaw + Math.PI;   // through his eyes, turning the view (the mouse) turns him: he goes where we look
      else if (want) {                     // the view follows the way he faces, turning rather than snapping
        const behind = wally.facing + Math.PI;
        cam.yaw += Math.atan2(Math.sin(behind - cam.yaw), Math.cos(behind - cam.yaw)) * Math.min(1, dt * 5);
      }
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      pos.set(wally.pos.x + fx * FORWARD, wally.pos.y + HIGH, wally.pos.z + fz * FORWARD);
      look.set(pos.x + fx, pos.y - (TILT_TOP + (TILT_UNDER - TILT_TOP) * under), pos.z + fz);
      from.copy(camera.quaternion);
      probe.position.copy(pos); probe.lookAt(look);
      camera.position.lerp(pos, cam.eyes);
      camera.quaternion.slerpQuaternions(from, probe.quaternion, cam.eyes);
      snout.update(dt); snout.place(wally.facing);
    },
    // He has just eaten: if we are looking through his eyes, the snout comes up and chomps.
    chomp(from = 0) { if (hidden) snout.chomp(from); },
    // At once, for a scene that takes the camera over.
    off() { cam.eyes = 0; under = 0; hide(false); tint.style.opacity = 0; },
  };
}
