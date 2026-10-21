// sceptre-model.js
// The King's sceptre with its talismans set in it (Ken, 2026-10-21): each talisman won sits in its
// own setting and shines; with all six in place the whole sceptre glows. Used wherever the sceptre
// is seen once the talismans are won (the King's court, Croc Park, up the coast, the push, the
// ending), and its SETTINGS place them on the sceptre card (sceptre-card.js).
//
// Ken's layout, heaven above and earth below: the sun at the top, the moon to its right, the air to
// its left; the earth at the bottom, the fire to its right, the water to its left (as you face it).
// SETTINGS are measured from a straight-on picture of Ken's model (screens/guide/sceptre-head.png),
// in units of the sceptre's height, from its centre: x across (+ to the right as you face it), y up.
//
//   const s = makeSceptre(models, { height: 1.6, held: TALISMANS });
//   scene.add(s.group); ... s.update(t) each frame

import * as THREE from 'three';

export const SETTINGS = {
  'talisman-sun':   { x: 0,        y: 0.409, size: 0.115 },
  'talisman-moon':  { x: 0.05625,  y: 0.369, size: 0.095 },
  'talisman-air':   { x: -0.05625, y: 0.366, size: 0.095 },
  'talisman-fire':  { x: 0.0469,   y: 0.291, size: 0.095 },
  'talisman-water': { x: -0.05,    y: 0.294, size: 0.095 },
  'talisman-earth': { x: 0,        y: 0.238, size: 0.085 },
};
// On the card's picture (640 x 640, sceptre-head.png): where each setting is, as fractions.
export const CARD = Object.fromEntries(Object.entries(SETTINGS).map(([k, s]) => [k, { left: (s.x / 0.4 + 0.5), top: (0.53 - s.y) / 0.4, size: s.size * 2.5 }]));

const waterTex = (() => { if (typeof document === 'undefined') return null; const t = new THREE.TextureLoader().load('assets/talismans/talisman-water.png'); t.colorSpace = THREE.SRGBColorSpace; return t; })();

export function makeSceptre(models, { height = 1.6, held = [] } = {}) {
  const group = new THREE.Group();
  const gl = models.get('sceptre-hero') || models.get('sceptre');
  if (gl) {
    const m = gl.scene.clone(true), b = new THREE.Box3().setFromObject(m), size = b.getSize(new THREE.Vector3());
    m.scale.setScalar(height / size.y);
    const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()); m.position.sub(c);
    m.traverse(o => { if (o.isMesh) o.castShadow = true; });
    group.add(m);
  }
  // Each talisman in its setting: Ken's model (the water one is his picture), its own materials
  // copied so they can shine.
  const pieces = [];
  const rim = (() => { if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 14, 32, 32, 32); r.addColorStop(0, 'rgba(255,240,190,0.9)'); r.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  for (const [id, s] of Object.entries(SETTINGS)) {
    let piece;
    if (id === 'talisman-water' || !models.get(id)) {
      const mat = new THREE.SpriteMaterial({ map: id === 'talisman-water' ? waterTex : null, color: id === 'talisman-water' ? 0xffffff : 0xffd166, transparent: true, depthWrite: false });
      piece = new THREE.Sprite(mat); piece.scale.setScalar(s.size * height * 1.15);
    } else {
      piece = models.get(id).scene.clone(true);
      const b = new THREE.Box3().setFromObject(piece), sz = b.getSize(new THREE.Vector3());
      piece.scale.setScalar(s.size * height / Math.max(sz.x, sz.y));
      const c = new THREE.Box3().setFromObject(piece).getCenter(new THREE.Vector3()); piece.position.sub(c);
      const holder = new THREE.Group(); holder.add(piece);
      piece = holder;
    }
    // No glow of their own (Ken, 2026-10-21: the talismans are shiny by themselves); the rim is off.
    if (false && rim) { const r = new THREE.Sprite(new THREE.SpriteMaterial({ map: rim, transparent: true, depthWrite: false, opacity: 0.3, toneMapped: false })); r.scale.setScalar(s.size * height * 1.7); r.position.z = -0.01 * height; r.userData.rim = true; piece.add(r); }
    piece.position.set(s.x * height, s.y * height, 0.012 * height);
    piece.visible = held.includes(id);
    group.add(piece); pieces.push({ id, piece });
  }
  // The glow when all six are in place: a warm light and a soft halo round the head.
  const light = new THREE.PointLight(0xffe2a0, 0, 10 * height); light.position.set(0, 0.33 * height, 0.15 * height); group.add(light);
  const halo = (() => {
    if (typeof document === 'undefined') return new THREE.Group();
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,236,170,0.9)'); r.addColorStop(0.4, 'rgba(255,214,120,0.35)'); r.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    s.position.set(0, 0.33 * height, -0.04 * height); s.scale.setScalar(0.42 * height); return s;   // behind the head, so the talismans show in front of it
  })();
  group.add(halo);
  let all = held.length === 6, boost = 0;
  return {
    group, light,
    setHeld(list) { for (const p of pieces) p.piece.visible = list.includes(p.id); all = list.length === 6; },
    flare(k = 1) { boost = Math.max(boost, k); },                  // a burst of light (the change in the ending)
    update(t) {
      boost = Math.max(0, boost - 0.02);
      // Each talisman in place shines, gently, out of step with the others.
      pieces.forEach((p, i) => {
        if (!p.piece.visible) return;
        // As they are: shiny by themselves (Ken), no glow added.
      });
      // All six in place: the sceptre glows.
      light.intensity = all ? 0.6 + Math.sin(t * 1.6) * 0.2 + boost * 40 : 0;
      halo.visible = all; if (all) halo.material.opacity = Math.min(1, 0.16 + Math.sin(t * 1.6) * 0.05 + boost * 0.6);   // a warm glow, not a blaze (until the change)
    },
  };
}
export const ALL_TALISMANS = Object.keys(SETTINGS);
