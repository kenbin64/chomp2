// post.js
// The finishing pass that turns a plain render into something closer to an
// animated film: soft ambient occlusion where things meet, a gentle bloom on
// bright highlights, a warm colour grade with a light vignette, and smooth
// edges. Scales with the quality level: all of it on high, bloom and grade on
// medium, none on low (phones), where it simply renders as before.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Colour grade: a touch more saturation and contrast, warm highlights, cooler
// shadows, and a soft darkening toward the corners.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: 1.14 }, contrast: { value: 1.06 }, vignette: { value: 0.28 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation, contrast, vignette; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      c.rgb += vec3(0.025, 0.012, -0.015) * smoothstep(0.4, 1.0, l);      // warm highlights
      c.rgb += vec3(-0.01, 0.0, 0.02) * (1.0 - smoothstep(0.0, 0.4, l));  // cool shadows
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - vignette * smoothstep(0.45, 0.85, d);
      gl_FragColor = c;
    }`,
};

export function createPost(renderer, scene, camera, quality) {
  if (quality.name === 'low') {
    return { render: () => renderer.render(scene, camera), setSize: () => {} };
  }
  // Effects work at the real drawing size: the screen size times the pixel ratio
  // (2 on high, where the game draws at double size for sharpness).
  const size = renderer.getSize(new THREE.Vector2()).multiplyScalar(renderer.getPixelRatio());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality.name === 'high' ? 4 : 0 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  let ao = null;
  if (quality.name === 'high') {
    ao = new GTAOPass(scene, camera, size.x, size.y);
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 });
    ao.blendIntensity = 0.85;
    composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.55, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());                 // tone mapping and colour space, as the plain render had
  composer.addPass(new ShaderPass(GradeShader));
  return {
    render: () => composer.render(),
    setSize: (w, h) => composer.setSize(w, h),          // the composer resizes every effect, pixel ratio included
  };
}
