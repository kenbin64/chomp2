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
import { fitText } from '../signtext.js';

export const ROOFS = ['#3f6a48', '#8a4a38', '#4a5f72', '#8a6a4a', '#5f686a'];   // heritage iron: green, Indian red, blue-grey, rust, galvanised
export const NAMES = ['Tropical Treats', 'Rainforest Gallery', 'Kuranda Coffee House', 'Bush Tucker Pantry', 'Butterfly Books',
  'Leather & Hats', 'Gelato Hut', 'Crystal Cave', 'Rainforest Honey', 'Op Shop', 'Tableland Fudge', 'Gecko Gifts'];

// A painted name board.
function board(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b3a2e'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#e8d9a8'; g.lineWidth = 5; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = '#f3e6c0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, text.toUpperCase(), 256, 66, 460, 58, 'bold {size}px Georgia, "Times New Roman", serif');   // always fits inside the frame
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
        vec3 c = min(diffuseColor.rgb * 1.75, vec3(1.0));                      // the bake came out dark: lift it
        float hi = max(c.r, max(c.g, c.b)), lo = min(c.r, min(c.g, c.b));
        float sat = hi > 0.001 ? (hi - lo) / hi : 0.0, lum = dot(c, vec3(0.299, 0.587, 0.114));
        float above = step(eave, vHeight);
        // The iron roof: clearly greener than it is red or blue, above the eaves.
        float green = smoothstep(1.12, 1.35, c.g / (max(c.r, c.b) + 0.004)) * above;
        // Weatherboards: low colour, not too dark, below the eaves (the ferns are green, so they are left alone).
        float wallness = (1.0 - above) * smoothstep(0.42, 0.22, sat) * smoothstep(0.05, 0.12, lum) * (1.0 - smoothstep(1.1, 1.3, c.g / (max(c.r, c.b) + 0.004)));
        vec3 wallCol = wallTint * clamp(0.75 + lum, 0.8, 1.15);                // clean paint, lightly shaded by the bake
        vec3 roofCol = roofTint * clamp(0.6 + lum * 1.5, 0.6, 1.3);
        diffuseColor.rgb = mix(c, wallCol, wallness);
        diffuseColor.rgb = mix(diffuseColor.rgb, roofCol, green);
      }`);
  };
  m.customProgramCacheKey = () => `shop-${wall}-${roof}`;
  return m;
}

