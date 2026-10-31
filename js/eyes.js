// eyes.js
// Seeing through Wally's eyes whenever he is in the water (Ken, 2026-10-30), as in the boomerang throw: the camera
// eases forward from behind him into his head, he is hidden so we are not inside it, and under the surface the
// picture takes on the water's colour. Coming out, it eases back. Each level says when, and whether he is under.
// The view turns through cam.yaw, the same angle the third-person camera uses, so the guide arrow and the
// controls stay right, a drag still looks around, and there is no swing when the view hands back.

import * as THREE from 'three';
import { ownView } from './bubbles.js';
import { loadModels } from './models.js';

const HIGH = 0.75;                 // eyes above where he floats: just clear of the surface
const FORWARD = 0.4;               // and ahead of his middle, near the front of his head
const TILT_TOP = 0.04, TILT_UNDER = 0.24;   // how far the view looks down (per metre ahead): under, at the bed

// His snout along the bottom of the picture: Ken's model (models/croc-snout.glb, its tip along +z). It stays at the
// bottom of the screen but level, as he swims, pointing the way he faces, with only its top and nose in view: the back
// of it is below the picture. Drawn last and over everything, because he floats so low the water would cut it off (the
// depth is cleared just for it). On its own layer, so it stays out of the water's reflection.
const OVER = 20, SNOUT_LAYER = 1;
const SNOUT = { scale: 0.52, ahead: 0.74, below: 0.49, keepDown: 1.1 };   // keepDown: how far it drops per unit the camera looks down, to stay at the bottom
const SWING = 0.3;                                                       // radians at most off the view: the cut-off back of it must never show (Ken, 2026-10-30)
const CHOMP_TIME = 0.55, RISE = 0.27, REAR = 0.42;                       // a mouthful: up it comes, tip first, and snaps down
export function createSnout(scene, camera) {
  const g = new THREE.Group(); g.name = 'snout-view'; g.visible = false; g.rotation.order = 'YXZ'; scene.add(g);
  camera.layers.enable(SNOUT_LAYER);
  const light = matchMedia('(pointer: coarse)').matches;                  // (a phone: the lighter copy)
  loadModels(['croc-snout'], { light }).then(found => {
    const gltf = found.get('croc-snout');
    if (!gltf) return;
    let first = true;
    gltf.scene.scale.setScalar(SNOUT.scale);
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone(); o.material.transparent = true; o.material.fog = false;
      o.renderOrder = OVER; o.layers.set(SNOUT_LAYER); o.frustumCulled = false; o.castShadow = o.receiveShadow = false;
      if (first) { o.onBeforeRender = renderer => renderer.clearDepth(); first = false; }
    });
    g.add(gltf.scene);
  });
  const look = new THREE.Vector3();
  let chomping = CHOMP_TIME, lift = 0, rear = 0;
  return {
    show(on) { g.visible = on; },
    // He has just eaten. from: how far through it to start (0 to 1), for looking at one moment of it.
    chomp(from = 0) { chomping = from * CHOMP_TIME; },
    update(dt) {
      chomping = Math.min(CHOMP_TIME, chomping + dt);
      const u = chomping / CHOMP_TIME;
      let k;                                                               // 1: right up; 0: at rest
      if (u < 0.45) { const e = u / 0.45; k = e * e * (3 - 2 * e); }       // up it comes
      else if (u < 0.62) { const e = (u - 0.45) / 0.17; k = 1 - e * e; }   // and slams down
      else k = -0.12 * Math.sin((u - 0.62) / 0.38 * Math.PI) * (1 - u);    // with a little bounce in the water
      lift = RISE * k; rear = REAR * k;
    },
    // Once the camera is placed. heading: the way he faces.
    place(heading) {
      camera.getWorldDirection(look);
      const flat = Math.hypot(look.x, look.z) || 1, x = look.x / flat, z = look.z / flat;
      g.position.set(camera.position.x + x * SNOUT.ahead, camera.position.y - SNOUT.below + look.y / flat * SNOUT.keepDown + lift, camera.position.z + z * SNOUT.ahead);
      const view = Math.atan2(x, z), off = Math.atan2(Math.sin(heading - view), Math.cos(heading - view));
      g.rotation.set(-rear, view + Math.max(-SWING, Math.min(SWING, off)), 0);   // level, but for the tip rearing up
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
