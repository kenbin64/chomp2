// textures.js
// Everything that needs a picture is painted here on a canvas at start-up,
// so the game ships with no image files: the shirt, the sign, the jar label,
// the sky and the boardwalk planks.

import { fitText } from './signtext.js';
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 16;                 // sharp at a slant; three.js limits it to what the device allows
  return t;
}

// One hibiscus: five rounded petals around a darker centre.
function hibiscus(g, x, y, r, petal, centre) {
  g.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.38, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = centre;
  g.beginPath(); g.arc(x, y, r * 0.22, 0, Math.PI * 2); g.fill();
}

// Wally's orange Hawaiian shirt, as in the promo art.
export function shirtTexture() {
  const [c, g] = canvas(1024, 1024);
  g.scale(2, 2);                     // drawn at 512 and scaled up, so the pattern is crisp
  g.fillStyle = '#f26b1d'; g.fillRect(0, 0, 512, 512);
  const leaf = ['#2f9e44', '#58b947'];
  const petals = [['#ff8fc7', '#c2185b'], ['#ffd43b', '#e8590c'], ['#ffffff', '#f06595'], ['#ff6b6b', '#a61e4d']];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 512, y = rnd() * 512;
    g.fillStyle = leaf[i % 2];
    g.beginPath(); g.ellipse(x + 18, y + 10, 26, 9, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 30; i++) {
    const [p, ctr] = petals[i % petals.length];
    hibiscus(g, rnd() * 512, rnd() * 512, 22 + rnd() * 16, p, ctr);
  }
  return toTexture(c, 1);
}

// The park sign. "DON'T" has been scratched out, which is the whole game: Wally
// does it himself at the start (Ken's storyboard, 2026-10-20). scratched: false
// paints the sign as the park put it up, before he gets to it.
export function signTexture({ scratched = true } = {}) {
  const [c, g] = canvas(2048, 1024);
  g.scale(2, 2);
  // planks
  for (let i = 0; i < 4; i++) {
    g.fillStyle = ['#8a5a2b', '#7d5026', '#94622f', '#83552a'][i];
    g.fillRect(0, i * 128, 1024, 124);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let k = 0; k < 9; k++) g.fillRect(0, i * 128 + 10 + k * 13, 1024, 2);
  }
  g.fillStyle = '#fbf3e4';
  g.textAlign = 'center';
  fitText(g, 'Wally the Cairns Crocodile', 512, 110, 960, 82, 'bold {size}px "Trebuchet MS", sans-serif');
  g.font = 'bold 96px "Trebuchet MS", sans-serif';
  g.fillText("Please DON'T", 512, 290);
  g.fillText('feed the croc.', 512, 420);
  if (!scratched) return toTexture(c);
  // the scratch-out: rough red marker strokes over DON'T
  g.strokeStyle = '#d6212b'; g.lineCap = 'round'; g.lineWidth = 16;
  const x0 = 545, x1 = 820, y = 258;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(x0 - 10, y - 30 + i * 18);
    for (let x = x0; x <= x1; x += 30) g.lineTo(x, y - 34 + i * 18 + (x / 30 % 2 ? 9 : -9));
    g.stroke();
  }
  g.lineWidth = 10;
  g.beginPath(); g.moveTo(x0, y - 60); g.lineTo(x1, y + 20); g.stroke();
  // and a cheeky arrow pointing to the water
  g.font = 'italic bold 54px "Comic Sans MS", "Trebuchet MS", sans-serif';
  g.fillStyle = '#ffe066';
  g.fillText('<- yes please!  - W', 760, 480);
  return toTexture(c);
}

// Kenny's jar of dark spread: a yellow label with a red band, like the jar
// everyone knows, but with no name, words or logo on it (Ken's call, 2026-10-16).
export function jarLabelTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#ffd400'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#d7191c'; g.fillRect(0, 40, 256, 48);
  return toTexture(c);
}

// Late-afternoon sky: blue above, warm peach at the horizon.
export function skyTexture() {
  const [c, g] = canvas(16, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#3d6fb6');
  grad.addColorStop(0.42, '#86b4e0');
  grad.addColorStop(0.47, '#f6c79a');
  grad.addColorStop(0.5, '#ffd8a8');
  grad.addColorStop(1.0, '#ffd8a8');
  g.fillStyle = grad; g.fillRect(0, 0, 16, 512);
  return toTexture(c);
}

// The park's horizon, all the way round: rainforest ranges behind Cairns, and
// open sea with a low island toward the harbour. The strip is wrapped round the
// park on a huge cylinder; x across the strip is the compass angle.
export function horizonTexture() {
  const [c, g] = canvas(4096, 512);
  const W = 4096, H = 512;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // The harbour (toward -z) sits a quarter of the way along; mountains fade out around it.
  const seaCentre = W * 0.75, seaHalf = W * 0.16;
  const mountainWeight = x => {
    const d = Math.abs(((x - seaCentre + W * 1.5) % W) - W / 2);
    return Math.min(1, Math.max(0, (d - seaHalf) / (W * 0.08)));
  };
  // Three ranges, far to near: hazy blue-green to deep rainforest green.
  const ranges = [
    { base: 300, height: 190, colour: [120, 160, 150], rough: 0.004, haze: 0.55 },
    { base: 340, height: 140, colour: [62, 118, 78], rough: 0.007, haze: 0.25 },
    { base: 380, height: 85, colour: [34, 88, 48], rough: 0.012, haze: 0.0 },
  ];
  for (const r of ranges) {
    const phase = rnd() * 100, phase2 = rnd() * 100;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      const ridge = (Math.sin(x * r.rough + phase) * 0.5 + 0.5) * 0.65 + (Math.sin(x * r.rough * 3.1 + phase2) * 0.5 + 0.5) * 0.35;
      const y = r.base - ridge * r.height * mountainWeight(x);
      g.lineTo(x, y);
    }
    g.lineTo(W, H); g.closePath();
    const [cr, cg, cb] = r.colour;
    const grad = g.createLinearGradient(0, r.base - r.height, 0, H);
    grad.addColorStop(0, `rgb(${cr + 30},${cg + 30},${cb + 30})`);
    grad.addColorStop(1, `rgb(${cr},${cg},${cb})`);
    g.fillStyle = grad; g.fill();
    // Rainforest canopy texture on the nearer ranges: little rounded bumps.
    if (r.haze < 0.3) {
      g.save(); g.clip();
      for (let i = 0; i < 2600; i++) {
        const x = rnd() * W, y = r.base - rnd() * r.height;
        g.fillStyle = `rgba(${cr - 20 + rnd() * 50},${cg - 10 + rnd() * 50},${cb - 15 + rnd() * 30},0.35)`;
        g.beginPath(); g.arc(x, y, 3 + rnd() * 6, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    if (r.haze > 0) { g.fillStyle = `rgba(246, 214, 180, ${r.haze * 0.5})`; g.fillRect(0, 0, W, H); }
  }
  // A low island far out on the harbour side, and a strip of sea at the foot.
  g.fillStyle = 'rgba(70, 120, 100, 0.85)';
  g.beginPath(); g.ellipse(seaCentre + 180, 392, 150, 16, 0, Math.PI, 0); g.fill();
  // The foot of the strip: sea toward the harbour, rainforest everywhere else.
  for (let x = 0; x < W; x += 4) {
    const land = mountainWeight(x);
    g.fillStyle = land > 0.5 ? '#2f6b3c' : '#2aa3c4';
    g.fillRect(x, 392, 4, H - 392);
  }
  // Clear sky above the ranges: anything not painted stays see-through.
  return toTexture(c);
}

// Boardwalk planks.
export function plankTexture() {
  const [c, g] = canvas(256, 256);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = ['#a77a4f', '#9b6f45', '#b0845a', '#986a40'][i % 4];
    g.fillRect(0, i * 32, 256, 30);
    g.fillStyle = 'rgba(60,35,15,0.5)'; g.fillRect(0, i * 32 + 30, 256, 2);
  }
  return toTexture(c, 1);
}
