// lamps.js
// Street lamps (Ken's model, models/streetlamp.glb) that really light the scene
// at night (Ken, 2026-10-18). The glass globe under each shade is the light's
// source: it glows, a soft halo sits round it, a warm pool of light falls on the
// ground beneath, and real lights shine from the globes nearest the player.
// A fixed handful of real lights (moved to the nearest lamps as the player goes)
// keeps the cost the same however many lamps a level has.

import * as THREE from 'three';

const WARM = new THREE.Color(0xffd29a);
const HEIGHT = 4.2;                     // metres, ground to the top of the shade
const GLOBE_Y = 0.9, GLOBE_R = 0.06;    // the globe: its height and radius, as a share of the lamp's height

let poolTex = null, haloTex = null;
function radial(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [at, col] of stops) grd.addColorStop(at, col);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// A plain lamp for when the model file is missing: post, shade and globe.
function standIn() {
  const g = new THREE.Group(), green = new THREE.MeshStandardMaterial({ color: 0x1d3b30, roughness: 0.5, metalness: 0.4 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, HEIGHT * 0.88, 12), green); post.position.y = HEIGHT * 0.44; g.add(post);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.22, 24, 1, true), green); shade.position.y = HEIGHT * 0.97; g.add(shade);
  return g;
}

export class StreetLamps {
  // spots: [{ x, y, z }] where each lamp stands (y: the ground there).
  // real: how many real lights to move round the nearest lamps.
  constructor(scene, model, spots, { real = 6 } = {}) {
    this.scene = scene; this.spots = spots;
    // The lamps themselves, drawn as one batch (instanced): every lamp is the same
    // model, so each part of it is drawn once for all of them, not once a lamp
    // (2026-10-20: 25 lamps were 25 draws, and again for the shadows).
    const proto = model ? model.scene.clone(true) : standIn();
    if (model) {
      const box = new THREE.Box3().setFromObject(proto), h = box.max.y - box.min.y;
      proto.scale.setScalar(HEIGHT / h); proto.position.y = -box.min.y * HEIGHT / h;
    }
    proto.updateMatrixWorld(true);
    const place = new THREE.Matrix4(), turn = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    proto.traverse(o => {
      if (!o.isMesh) return;
      const part = new THREE.InstancedMesh(o.geometry.clone().applyMatrix4(o.matrixWorld), o.material, spots.length);
      spots.forEach((s, i) => { place.compose(new THREE.Vector3(s.x, s.y, s.z), turn.setFromAxisAngle(up, s.rot || 0), one); part.setMatrixAt(i, place); });
      part.instanceMatrix.needsUpdate = true; part.computeBoundingSphere();
      part.castShadow = true; part.receiveShadow = true;
      scene.add(part);
    });
    const n = spots.length, m = new THREE.Matrix4();
    // The globes: glowing at night, over the model's own glass.
    this.globes = new THREE.InstancedMesh(new THREE.SphereGeometry(HEIGHT * GLOBE_R * 1.08, 16, 12), new THREE.MeshBasicMaterial({ color: WARM.clone(), toneMapped: false }), n);
    this.globes.userData.noAO = true; this.globes.userData.glow = true;
    // Halos round the globes, and pools of light on the ground.
    haloTex = haloTex || radial([[0, 'rgba(255,225,170,0.9)'], [0.25, 'rgba(255,200,130,0.35)'], [1, 'rgba(255,190,120,0)']]);
    poolTex = poolTex || radial([[0, 'rgba(255,215,150,0.7)'], [0.5, 'rgba(255,200,130,0.25)'], [1, 'rgba(255,190,120,0)']]);
    const haloPos = new Float32Array(n * 3);
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), n);
    this.pools.userData.noAO = true; this.pools.userData.glow = true; this.pools.renderOrder = 1;
    spots.forEach((s, i) => {
      m.makeTranslation(s.x, s.y + HEIGHT * GLOBE_Y, s.z); this.globes.setMatrixAt(i, m);
      haloPos.set([s.x, s.y + HEIGHT * GLOBE_Y, s.z], i * 3);
      m.makeScale(11, 1, 11).setPosition(s.x, s.y + 0.06, s.z); this.pools.setMatrixAt(i, m);
    });
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
    this.halos = new THREE.Points(hg, new THREE.PointsMaterial({ map: haloTex, size: 3.2, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    this.halos.userData.noAO = true; this.halos.userData.glow = true;
    this.globes.visible = this.halos.visible = this.pools.visible = false;
    scene.add(this.globes, this.halos, this.pools);
    // The real lights, always present (switching lights on and off would make
    // every material rebuild), just dark by day.
    this.lights = Array.from({ length: Math.min(real, n) }, () => {
      const L = new THREE.PointLight(WARM, 0, 18, 1.6); L.userData.lamp = true; scene.add(L); return L;
    });
    this.reassignIn = 0;
  }

  // night: 0 day to 1 night. Lamps come on at dusk, a little before full dark.
  update(dt, night, near) {
    const on = Math.min(1, Math.max(0, (night - 0.15) / 0.35));
    const lit = on > 0.001;
    this.globes.visible = this.halos.visible = this.pools.visible = lit;
    this.globes.material.color.copy(WARM).multiplyScalar(0.6 + 2.2 * on);
    this.halos.material.opacity = on; this.pools.material.opacity = 0.75 * on;
    // Give the real lights to the lamps nearest the player.
    if ((this.reassignIn -= dt) <= 0 && near) {
      this.reassignIn = 0.4;
      const order = this.spots.map((s, i) => ({ i, d: (s.x - near.x) ** 2 + (s.z - near.z) ** 2 })).sort((a, b) => a.d - b.d);
      this.lights.forEach((L, k) => { const s = this.spots[order[k].i]; L.position.set(s.x, s.y + HEIGHT * GLOBE_Y - 0.15, s.z); });
    }
    for (const L of this.lights) L.intensity = 38 * on;
  }
}

