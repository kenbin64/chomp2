// outfit.js
// Shows the clothes bought at the Kuranda markets (progress.js WARDROBE) on
// Wally and Kenny, in every level. Their shirt and vest are painted into one
// picture with the rest of them, so a new colour is put on in the shader: the
// parts of the picture in the clothing's colour range (bright reds and oranges
// on Wally's shirt and shorts; the tan and khaki of Kenny's vest) are turned to
// the new colour, keeping the pattern, shading and highlights.
//
//   dressOutfit(wally.skin.root, wearing(progress, 'wally').shirt)

import * as THREE from 'three';

// The colour range each one's clothes are painted in (hue 0 to 1), and how
// saturated a pixel must be to count as cloth rather than skin or fur.
const RANGE = {
  wally: { lo: 0.94, hi: 0.13, sat: 0.45 },     // red through orange (the range wraps past red)
  kenny: { lo: 0.07, hi: 0.15, sat: 0.28 },     // tan and khaki
};

export function dressOutfit(root, who, item) {
  if (!root) return;
  // Always start from their own clothes, so changing outfit never stacks colours.
  root.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.ownMaterial) o.userData.ownMaterial = o.material;
    else o.material = o.userData.ownMaterial;
  });
  if (!item || item.colour == null) return;
  const hsl = {}; new THREE.Color(item.colour).getHSL(hsl);
  const r = RANGE[who];
  root.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      if (!m || !m.map) return;
      const before = m.onBeforeCompile;
      const n = m.clone();
      n.onBeforeCompile = (shader, renderer) => {
        if (before) before.call(n, shader, renderer);
        shader.uniforms.outfitHue = { value: hsl.h };
        shader.uniforms.outfitSat = { value: hsl.s };
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            uniform float outfitHue, outfitSat;
            vec3 outfitRgb2hsv(vec3 c) {
              vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
              vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
              vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
              float d = q.x - min(q.w, q.y);
              return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
            }
            vec3 outfitHsv2rgb(vec3 c) {
              vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
              return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
            }`)
          .replace('#include <map_fragment>', `#include <map_fragment>
            {
              vec3 hsv = outfitRgb2hsv(diffuseColor.rgb);
              bool inRange = ${r.lo > r.hi ? `(hsv.x >= ${r.lo.toFixed(3)} || hsv.x <= ${r.hi.toFixed(3)})` : `(hsv.x >= ${r.lo.toFixed(3)} && hsv.x <= ${r.hi.toFixed(3)})`};
              if (inRange && hsv.y > ${r.sat.toFixed(2)}) {
                float s = clamp(hsv.y * (0.55 + outfitSat * 0.6), 0.0, 1.0);
                diffuseColor.rgb = outfitHsv2rgb(vec3(outfitHue, s, hsv.z));
              }
            }`);
      };
      n.customProgramCacheKey = () => `outfit-${who}-${item.id}-${m.customProgramCacheKey ? m.customProgramCacheKey() : ''}`;
      n.needsUpdate = true;
      if (Array.isArray(o.material)) o.material[i] = n; else o.material = n;
    });
  });
}
