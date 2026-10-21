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
  // Each setting won glows in the sceptre's own warm colour (Ken, 2026-10-21: no need to draw the
  // talismans in the scenes; the holes glow). A soft disc of light in each, front and back, since the
  // settings go right through the head. (The sceptre card shows the talismans themselves.)
  const glowTex = (() => { if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(255,240,200,0.75)'); r.addColorStop(0.5, 'rgba(240,200,110,0.35)'); r.addColorStop(1, 'rgba(200,170,80,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const pieces = [];
  for (const [id, s] of Object.entries(SETTINGS)) {
    for (const z of [0.045, -0.045]) {                              // just out past the face of the head, front and back
      const piece = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc860, transparent: true, depthWrite: false, opacity: 1, toneMapped: false }));
      piece.scale.setScalar(s.size * height * 0.72);
      piece.position.set(s.x * height, s.y * height, z * height);
      piece.visible = held.includes(id);
      group.add(piece); pieces.push({ id, piece });
    }
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
        p.piece.material.opacity = 0.6 + 0.2 * Math.sin(t * 2 + i * 0.7);   // a gentle pulse
      });
      // All six in place: the sceptre glows.
      light.intensity = all ? 0.6 + Math.sin(t * 1.6) * 0.2 + boost * 40 : 0;
      halo.visible = all; if (all) halo.material.opacity = Math.min(1, 0.16 + Math.sin(t * 1.6) * 0.05 + boost * 0.6);   // a warm glow, not a blaze (until the change)
    },
  };
}
export const ALL_TALISMANS = Object.keys(SETTINGS);

// Wally holding the sceptre high in his right hand (Ken), steady. The arm is set to a fixed raised pose
// each frame (an absolute turn from its rest, so it can never add up and spin), and the sceptre follows
// the hand smoothly, standing upright. Call after wally.update each frame.
const _hand = new THREE.Vector3();
export function holdHigh(wally, sceptre, dt = 1 / 60) {
  const P = wally.poser;
  if (P && P.ok) { const k = P.side.Right; P.turn('RightArm', -0.2, 0, k * 1.25); P.turn('RightForeArm', 0, 0, k * 0.15); }
  if (!wally._handBone && wally.skin) wally.skin.root.traverse(o => { if (o.isBone && /RightHand$/.test(o.name)) wally._handBone = o; });
  if (wally.skin) wally.skin.root.updateMatrixWorld(true);
  if (wally._handBone) wally._handBone.getWorldPosition(_hand); else _hand.copy(wally.pos).add(new THREE.Vector3(0.5, 2.6, 0));
  if (!sceptre.userData.held) { sceptre.position.copy(_hand); sceptre.userData.held = true; }
  sceptre.position.lerp(_hand, Math.min(1, dt * 14));
  sceptre.rotation.set(0, wally.facing, 0);
}
