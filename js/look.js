// look.js
// The finishing touches that make characters read like an animated film:
// a rim light around their edges, and a soft contact shadow under their feet.

import * as THREE from 'three';

// Adds a glow around a material's silhouette, brighter where the surface turns
// away from the camera. Cheap: a few lines added to the standard shader.
export function addRim(material, { color = 0xfff2dd, power = 2.6, strength = 0.32 } = {}) {
  if (!material || material.userData.rim) return material;
  material.userData.rim = true;
  const rimColor = new THREE.Color(color);
  material.onBeforeCompile = shader => {
    shader.uniforms.rimColor = { value: rimColor };
    shader.uniforms.rimPower = { value: power };
    shader.uniforms.rimStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimStrength;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
          totalEmissiveRadiance += rimColor * pow(1.0 - facing, rimPower) * rimStrength;
        }`);
  };
  material.customProgramCacheKey = () => `rim-${power}-${strength}`;
  material.needsUpdate = true;
  return material;
}

// Rim-light every standard material in a model.
export function rimAll(object, opts) {
  object.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) addRim(m, opts);
    }
  });
}

// A soft dark spot on the ground under a character, so they sit on the ground
// even where real shadows are switched off (phones on low graphics).
let blobTexture = null;
export function contactShadow(radius = 0.5, opacity = 0.35) {
  if (!blobTexture) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    blobTexture = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = 2;
  return m;
}

// Flaps the wings of an unrigged flyer in the vertex shader, with no bones.
// The model is in its front view: wingspan along x, head up +y, face toward +z.
// Every point outside the body (|x| > body) swings about the body's long axis,
// more the further out it is, so the wing bends smoothly from shoulder to tip.
// span: half the wingspan, body: half the body width, both in the mesh's own units.
// Returns the uniform to drive: flap.value = angle in radians (positive = wings up).
export function addFlap(material, { span, body, centre = 0 }) {
  const flap = { value: 0 };
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (before) before(shader, renderer);
    shader.uniforms.flap = flap;
    const bend = `
      float side = sign(position.x - ${centre.toFixed(4)});
      float outward = abs(position.x - ${centre.toFixed(4)});
      float reach = max(outward - ${body.toFixed(4)}, 0.0);
      float w = smoothstep(${body.toFixed(4)}, ${span.toFixed(4)}, outward);
      float a = flap * (0.35 + 0.65 * w);
      float ca = cos(a), sa = sin(a);`;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float flap;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        ${bend}
        if (reach > 0.0) objectNormal = vec3(ca * objectNormal.x + side * sa * objectNormal.z, objectNormal.y, -side * sa * objectNormal.x + ca * objectNormal.z);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (reach > 0.0) {
          // swing about the shoulder line: wings up means tips move toward the back (-z)
          transformed.x = ${centre.toFixed(4)} + side * (${body.toFixed(4)} + reach * ca);
          transformed.z = position.z - reach * sa;
        }`);
  };
  const key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => `${key}-flap-${span}-${body}`;
  material.needsUpdate = true;
  return flap;
}

// Walks the legs of an unrigged bird in the vertex shader, with no bones.
// Points near the ground (between legTop and ground, in the mesh's own units)
// swing forward and back along +z, the left side and the right side in turn,
// and each foot lifts as it swings forward. The model faces +z.
// Returns the uniforms to drive: phase.value (radians, advancing as it walks)
// and amount.value (0 standing or swimming, 1 walking).
export function addStride(material, { ground, legTop, centre = 0, reach, lift }) {
  const phase = { value: 0 }, amount = { value: 0 };
  const before = material.onBeforeCompile;
  const f = (v) => v.toFixed(4);
  material.onBeforeCompile = (shader, renderer) => {
    if (before) before(shader, renderer);
    shader.uniforms.stridePhase = phase;
    shader.uniforms.strideAmount = amount;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float stridePhase;\nuniform float strideAmount;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // 0 at the top of the legs, 1 at the feet.
          float w = clamp((${f(legTop)} - position.y) / (${f(legTop - ground)}), 0.0, 1.0);
          float right = position.x > ${f(centre)} ? 1.0 : 0.0;
          float s = sin(stridePhase + right * 3.14159);   // the two feet half a step apart
          transformed.z += strideAmount * w * s * ${f(reach)};
          transformed.y += strideAmount * w * max(0.0, s) * ${f(lift)};
        }`);
  };
  const key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => `${key}-stride-${f(ground)}-${f(legTop)}`;
  material.needsUpdate = true;
  return { phase, amount };
}
