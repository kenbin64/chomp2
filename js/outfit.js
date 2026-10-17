// outfit.js
// Shows the clothes bought at the Kuranda markets (progress.js WARDROBE) on
// Wally and Kenny, in every level. Their clothes are painted into one picture
// with the rest of them, so a new look is put on in the shader: the parts of
// the picture in the clothing's colour range (bright reds and oranges on
// Wally's shirt and shorts; the tan and khaki of Kenny's vest) take the new
// colour, keeping the printed pattern, the shading and the highlights.
// Wally's shirt and shorts are told apart by height on his body (measured from
// the model: the shorts are below his hips), so each can be chosen separately.
//
// Styles: plain (the pattern in a new colour), stripes (two colours in bands),
// neon (bright and glowing), disco (shimmering through the colours, sparkling).
//
//   dressOutfit(wally.skin.root, 'wally', wearing(progress, 'wally'))

import * as THREE from 'three';

// The colour range the clothes are painted in (hue 0 to 1, wrapping past red),
// how saturated a pixel must be to count as cloth, and where things are on the
// body (bind-pose height, model units): below WAIST is shorts; above HEAD is
// his head and hat, left alone.
const RANGE = {
  wally: { lo: 0.94, hi: 0.13, sat: 0.45, waist: -0.22, head: 0.42 },   // head: his collar; above is his mouth and hat
  kenny: { lo: 0.07, hi: 0.15, sat: 0.28, waist: -99, head: 99 },
};

// One clock for every disco outfit.
const clock = { value: 0 };
(function tick() { clock.value = performance.now() / 1000; requestAnimationFrame(tick); })();

const STYLE = { plain: 0, stripes: 1, neon: 2, disco: 3 };
function look(item) {
  if (!item || item.colour == null) return null;
  const a = {}, b = {};
  new THREE.Color(item.colour).getHSL(a);
  new THREE.Color(item.colour2 ?? item.colour).getHSL(b);
  return { hue: a.h, sat: a.s, light: a.l, hue2: b.h, sat2: b.s, light2: b.l, style: STYLE[item.style || 'plain'] };
}

// worn: { shirt, shorts } for Wally, { vest } for Kenny (items from wearing()).
export function dressOutfit(root, who, worn) {
  if (!root) return;
  // Always start from their own clothes, so changing outfit never stacks.
  root.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.ownMaterial) o.userData.ownMaterial = o.material;
    else o.material = o.userData.ownMaterial;
  });
  if (!worn) return;
  const upper = look(who === 'kenny' ? worn.vest : worn.shirt), lower = look(who === 'kenny' ? null : worn.shorts);
  if (!upper && !lower) return;
  const r = RANGE[who];
  const key = `outfit-${who}-${JSON.stringify(upper)}-${JSON.stringify(lower)}`;
  const glsl = (name, l) => l
    ? `vec4 ${name} = vec4(${l.hue.toFixed(4)}, ${l.sat.toFixed(4)}, ${l.light.toFixed(4)}, ${l.style.toFixed(1)}); vec3 ${name}B = vec3(${l.hue2.toFixed(4)}, ${l.sat2.toFixed(4)}, ${l.light2.toFixed(4)}); bool ${name}On = true;`
    : `vec4 ${name} = vec4(0.0); vec3 ${name}B = vec3(0.0); bool ${name}On = false;`;
  root.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map(m => {
      if (!m || !m.map) return m;
      const before = m.onBeforeCompile;
      const n = m.clone();
      n.onBeforeCompile = (shader, renderer) => {
        if (before) before.call(n, shader, renderer);
        shader.uniforms.outfitTime = clock;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vBindY;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindY = position.y;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            uniform float outfitTime;
            varying float vBindY;
            vec3 oRgb2hsv(vec3 c) {
              vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
              vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
              vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
              float d = q.x - min(q.w, q.y);
              return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
            }
            vec3 oHsv2rgb(vec3 c) {
              vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
              return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
            }
            // The new cloth colour for a pixel: style w (0 plain, 1 stripes, 2 neon, 3 disco).
            vec3 oCloth(vec3 hsv, vec4 a, vec3 b, float y, out float glow) {
              glow = 0.0;
              float shade = clamp(hsv.z * 1.15, 0.0, 1.0);           // the printed pattern and the shading
              float sat = clamp(hsv.y * (0.55 + a.y * 0.6), 0.0, 1.0);
              if (a.w > 2.5) {                                          // disco: colours roll round, glitter sparkles
                float h = fract(a.x + outfitTime * 0.15 + y * 1.5);
                float spark = step(0.985, fract(sin(dot(floor(gl_FragCoord.xy / 3.0), vec2(12.9898, 78.233)) + floor(outfitTime * 8.0)) * 43758.5453));
                glow = 0.35 + spark * 1.5;
                return oHsv2rgb(vec3(h, 0.85, max(shade, 0.55))) + spark;
              }
              if (a.w > 1.5) {                                          // neon: full colour, glowing
                glow = 0.55;
                return oHsv2rgb(vec3(a.x, 1.0, max(shade, 0.75)));
              }
              if (a.w > 0.5) {                                          // stripes: bands around the body
                float band = step(0.5, fract(y * 9.0));
                vec3 c = mix(a.xyz, b, band);
                return oHsv2rgb(vec3(c.x, clamp(c.y * 1.1, 0.0, 1.0), clamp(c.z * 2.0, 0.0, 1.0) * (0.55 + 0.45 * shade)));
              }
              if (a.y < 0.25) return oHsv2rgb(vec3(a.x, a.y, clamp(a.z * 2.0, 0.0, 1.0) * (0.45 + 0.55 * shade)));   // near-black, white or grey: keep its own tone
              return oHsv2rgb(vec3(a.x, sat, hsv.z));                   // plain
            }`)
          .replace('#include <map_fragment>', `#include <map_fragment>
            {
              ${glsl('oUp', upper)}
              ${glsl('oLo', lower)}
              vec3 hsv = oRgb2hsv(diffuseColor.rgb);
              bool cloth = ${r.lo > r.hi ? `(hsv.x >= ${r.lo.toFixed(3)} || hsv.x <= ${r.hi.toFixed(3)})` : `(hsv.x >= ${r.lo.toFixed(3)} && hsv.x <= ${r.hi.toFixed(3)})`} && hsv.y > ${r.sat.toFixed(2)};
              outfitGlow = 0.0;
              if (cloth && vBindY < ${r.head.toFixed(3)}) {
                bool lowerPart = vBindY < ${r.waist.toFixed(3)};
                if (lowerPart && oLoOn) diffuseColor.rgb = oCloth(hsv, oLo, oLoB, vBindY, outfitGlow) ;
                else if (!lowerPart && oUpOn) diffuseColor.rgb = oCloth(hsv, oUp, oUpB, vBindY, outfitGlow);
              }
            }`)
          .replace('void main() {', 'float outfitGlow = 0.0;\nvoid main() {')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * outfitGlow;');
      };
      n.customProgramCacheKey = () => `${key}-${m.customProgramCacheKey ? m.customProgramCacheKey() : ''}`;
      n.needsUpdate = true;
      return n;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
}
