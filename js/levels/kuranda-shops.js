// kuranda-shops.js
// Ken's Kuranda village shop (models/kuranda-shop.glb, made in Meshy) turned
// into a whole street of different shops (Ken, 2026-10-18: "can we have
// multiple buildings"). Each copy is repainted as it is drawn:
//   walls  the cream weatherboards take a heritage colour of their own
//   roof   the green iron roof becomes red, blue, rust or stays green
// (only the roof, above the eaves: the ferns in their pots stay green), and
// gets its own shop name painted on a board over the original sign. Widths
// vary a little so the row never looks stamped out.

import * as THREE from 'three';

// Heritage colours for weatherboards, iron roofs, and the names on the boards.
export const WALLS = ['#e9dcc0', '#cfe0cf', '#cfdde8', '#f1e3a6', '#e8c3a8', '#e2d2ea', '#f4efe4'];
export const ROOFS = ['#2f5d3a', '#8a2f25', '#2f4e72', '#7a4a2a', '#4a5a5e'];
export const NAMES = ['Tropical Treats', 'Rainforest Gallery', 'Kuranda Coffee House', 'Bush Tucker Pantry', 'Butterfly Books',
  'Leather & Hats', 'Gelato Hut', 'Crystal Cave', 'Rainforest Honey', 'Op Shop', 'Tableland Fudge', 'Gecko Gifts'];

// A painted name board.
function board(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b3a2e'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#e8d9a8'; g.lineWidth = 5; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = '#f3e6c0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${text.length > 16 ? 46 : 56}px Georgia, "Times New Roman", serif`; g.fillText(text.toUpperCase(), 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
}

// Repaint a material: weatherboard walls to `wall`, the iron roof (green, above
// `eave` in the model's own height) to `roof`. Everything else keeps its colour.
function repaint(material, wall, roof, eave) {
  const m = material.clone();
  m.onBeforeCompile = shader => {
    shader.uniforms.wallTint = { value: new THREE.Color(wall) };
    shader.uniforms.roofTint = { value: new THREE.Color(roof) };
    shader.uniforms.eave = { value: eave };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vHeight;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeight = position.y;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 wallTint; uniform vec3 roofTint; uniform float eave; varying float vHeight;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        // The baked texture is dark, so colours are judged by ratios, not brightness.
        vec3 c = diffuseColor.rgb;
        float hi = max(c.r, max(c.g, c.b)), lo = min(c.r, min(c.g, c.b));
        float sat = hi > 0.001 ? (hi - lo) / hi : 0.0, lum = dot(c, vec3(0.299, 0.587, 0.114));
        float above = step(eave, vHeight);
        // The iron roof: clearly greener than it is red or blue, above the eaves.
        float green = smoothstep(1.12, 1.35, c.g / (max(c.r, c.b) + 0.004)) * above;
        // Weatherboards: low colour, not too dark, below the eaves (the ferns are green, so they are left alone).
        float wallness = (1.0 - above) * smoothstep(0.42, 0.22, sat) * smoothstep(0.05, 0.12, lum) * (1.0 - smoothstep(1.1, 1.3, c.g / (max(c.r, c.b) + 0.004)));
        vec3 wallCol = wallTint * clamp(lum / 0.28, 0.25, 1.4);
        vec3 roofCol = roofTint * clamp(lum / 0.07, 0.3, 1.6);
        diffuseColor.rgb = mix(c, wallCol, wallness * 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb, roofCol, green);
      }`);
  };
  m.customProgramCacheKey = () => `shop-${wall}-${roof}`;
  return m;
}

// One shop: a copy of the model, `height` metres tall, repainted, with its own
// name. Faces +z (the caller turns it). Returns the group.
export function shopVariant(gltf, { wall, roof, name, height = 6.4, widen = 1, sign = { x: 0.085, y: 0.615, w: 0.3 } }) {
  const root = gltf.scene.clone(true);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const k = height / size.y;
  const eave = box.min.y + size.y * 0.55;              // in the model's own units
  root.traverse(o => {
    if (!o.isMesh) return;
    o.material = repaint(o.material, wall, roof, eave);
    o.castShadow = true; o.receiveShadow = true;
  });
  root.scale.set(k * widen, k, k);
  root.position.set(-(box.min.x + size.x / 2) * k * widen, -box.min.y * k, -(box.min.z + size.z / 2) * k);
  const g = new THREE.Group(); g.add(root);
  // The name board over the sign on the front gable.
  const b = board(name);
  const w = size.x * k * widen * sign.w * 1.25;
  b.scale.set(w, w, 1);
  b.position.set(size.x * k * widen * sign.x, size.y * k * sign.y, size.z * k / 2 + 0.06);
  g.add(b);
  return g;
}
