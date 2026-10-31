// parktreasure.js
// The treasure on the bottom of the Croc Park lagoon (Ken, 2026-10-18): a chest
// in the middle, the things visitors have dropped over the rail lying on the
// bed round it, and a trail of bubbles rising from the chest so a sharp-eyed
// player spots that something is down there. The rules are in treasure-rules.js.

import * as THREE from 'three';
import { chestModel } from './chest.js';
import { PARK_TREASURE as T, lostSpots, canTake, chestOpens } from './treasure-rules.js';
import { isWater, terrainHeight } from './rules.js';
import { ModelSkin } from './models.js';

const GOLD = () => new THREE.MeshStandardMaterial({ color: 0xe8b62e, metalness: 0.9, roughness: 0.25 });

// The key to the park gate (Ken, 2026-10-18: the lagoon chest holds it): an
// old gold key, a ring for a bow, a shaft and two teeth.
export function gateKey() {
  const g = new THREE.Group(), gold = GOLD();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 12, 28), gold); bow.position.y = 0.28; g.add(bow);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 12), gold); g.add(shaft);
  for (const [y, w] of [[-0.14, 0.1], [-0.2, 0.07]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.03), gold); t.position.set(w / 2, y, 0); g.add(t); }
  g.scale.setScalar(1.6);
  return g;
}

// Each lost thing, a little larger than life so it reads from above the water.
function lostModel(id) {
  const g = new THREE.Group();
  if (id === 'sunnies') {
    const lens = new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.6, roughness: 0.1 });
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 20), lens); l.position.x = s * 0.2; g.add(l); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), lens); g.add(bar);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.36), lens); arm.position.set(s * 0.36, 0, -0.18); g.add(arm); }
  } else if (id === 'ring') {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 12, 28), GOLD()); r.rotation.x = Math.PI / 2.4; g.add(r);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, metalness: 0.2, roughness: 0.05, emissive: 0x2a6070 }));
    gem.position.set(0, 0.06, 0.15); g.add(gem);
  } else if (id === 'watch') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 10, 28), new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.6 }));
    band.rotation.x = Math.PI / 2; band.scale.y = 1.4; g.add(band);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 24), GOLD()); face.position.set(0, 0.03, 0.17); g.add(face);
  } else if (id === 'phone') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: 0x20242c, metalness: 0.5, roughness: 0.2 })); g.add(body);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.44), new THREE.MeshStandardMaterial({ color: 0x2a6fb5, emissive: 0x1d4f88, emissiveIntensity: 0.8, roughness: 0.1 }));
    screen.rotation.x = -Math.PI / 2; screen.position.y = 0.021; g.add(screen);
  } else {
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 12, 28), new THREE.MeshStandardMaterial({ color: 0xd8467a, metalness: 0.3, roughness: 0.3 }));
    b.rotation.x = Math.PI / 2; g.add(b);
  }
  g.scale.setScalar(1.6);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// A soft glint that pulses over each lost thing, so it can be seen through the water.
let glintTexture = null;
function glint() {
  if (!glintTexture) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,250,210,1)'); grd.addColorStop(0.25, 'rgba(255,230,140,0.6)'); grd.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    glintTexture = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.userData.noAO = true;
  return s;
}

export class LagoonTreasure {
  // mango: the Golden Mango model (if loaded) that rises out of the chest;
  // prize: anything else to rise out of it instead (the gate key, gateKey()).
  constructor(scene, mango = null, prize = null) {
    this.scene = scene;
    if (!prize) prize = mango ? new ModelSkin(mango, { height: 0.5 }).root : new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), GOLD());
    this.chest = chestModel(prize);
    this.chest.group.position.set(T.chest.x, terrainHeight(T.chest.x, T.chest.z), T.chest.z);
    this.chest.group.rotation.y = 0.4;
    scene.add(this.chest.group);
    this.opened = false; this.open = 0;

    this.things = lostSpots(Math.random, isWater, terrainHeight).map(spot => {
      const g = lostModel(spot.id);
      g.position.set(spot.x, spot.y, spot.z); g.rotation.y = Math.random() * Math.PI * 2;
      const shine = glint(); shine.scale.setScalar(1.1); shine.position.set(spot.x, spot.y + 0.3, spot.z);
      scene.add(g, shine);
      return { ...spot, mesh: g, shine, taken: false, phase: Math.random() * 6 };
    });

    // Bubbles rising from the chest to the surface: the hint that something is down there.
    const n = 24, geo = new THREE.SphereGeometry(0.07, 8, 6);
    this.bubbles = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xe6fbff, transparent: true, opacity: 0.6, roughness: 0.1 }), n);
    this.bubbles.userData.noAO = true;
    this.bubbleState = Array.from({ length: n }, (_, i) => ({ y: Math.random(), dx: (Math.random() - 0.5) * 0.6, dz: (Math.random() - 0.5) * 0.6, s: 0.6 + Math.random() * 0.8, phase: i }));
    scene.add(this.bubbles);
    this.m = new THREE.Matrix4();
  }

  get found() { return this.things.filter(x => x.taken).length; }
  get total() { return this.things.length; }

  // Each frame. Returns events: { type: 'found', thing } and { type: 'open' }.
  update(dt, t, wx, wz, wy) {
    const events = [];
    for (const x of this.things) {
      if (x.taken) {
        // Carried up and away with a little spin, then gone.
        if (x.mesh.visible) { x.mesh.position.y += dt * 2.5; x.mesh.rotation.y += dt * 8; x.mesh.scale.multiplyScalar(1 - dt * 2); if (x.mesh.scale.x < 0.2) x.mesh.visible = false; }
        x.shine.visible = false;
        continue;
      }
      const p = 0.5 + 0.5 * Math.sin(t * 3 + x.phase);
      x.shine.material.opacity = 0.35 + 0.5 * p; x.shine.scale.setScalar(0.8 + 0.5 * p);
      if (canTake(wx, wz, wy, x)) { x.taken = true; events.push({ type: 'found', thing: x }); }
    }
    if (!this.opened && chestOpens(this.found, this.total, wx, wz, wy)) { this.opened = true; events.push({ type: 'open' }); }

    const c = this.chest;
    if (this.opened && this.open < 1) { this.open = Math.min(1, this.open + dt * 1.5); c.lid.rotation.x = -this.open * 1.9; c.glow.intensity = this.open * 6; c.mango.visible = true; }
    if (c.mango.visible) { c.mango.rotation.y += dt * 2; c.mango.position.y = 1.2 + this.open * 0.6 + Math.sin(t * 2) * 0.12; this.shown = (this.shown || 0) + dt; if (this.shown > 3) c.mango.visible = false; }   // on show, then he has it (carried.js): the chest stays open

    // Bubbles: rising from the chest, wobbling, popping at the surface.
    const base = c.group.position, top = -0.05, h = top - base.y;
    this.bubbleState.forEach((b, i) => {
      b.y += dt * 0.35 * b.s; if (b.y > 1) b.y -= 1;
      const y = base.y + 0.9 + b.y * (h - 0.9), w = Math.sin(t * 4 + b.phase) * 0.12;
      this.m.makeScale(b.s, b.s, b.s).setPosition(base.x + b.dx + w, y, base.z + b.dz);
      this.bubbles.setMatrixAt(i, this.m);
    });
    this.bubbles.instanceMatrix.needsUpdate = true;
    return events;
  }
}
