// see-through.js
// Keeping Wally in view (Ken, 2026-10-30: the bridge gets in the way of seeing what he is doing). Whatever part of a
// marked thing lies between the camera and him dissolves, in a soft circle round him. Only what is nearer the
// camera than he is goes, so the rest of it stays solid, and its shadow is untouched. Worked out in the camera's own
// view, so it does not care what size the picture is, and scattered rather than see-through glass, so nothing
// has to be sorted or drawn twice.

import * as THREE from 'three';

const focus = { value: new THREE.Vector3() }, on = { value: 0 };
const RADIUS = 2.0;                 // metres round him, at his distance
const scratch = new THREE.Vector3();

// Mark a material: anything using it dissolves in front of him.
export function seeThrough(material) {
  if (material.userData.seeThrough) return material;
  material.userData.seeThrough = true;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (before) before(shader, renderer);
    shader.uniforms.uFocus = focus; shader.uniforms.uFocusOn = on;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `uniform vec3 uFocus; uniform float uFocusOn;
void main() {
  if (uFocusOn > 0.5) {
    vec3 here = -vViewPosition;
    if (-here.z < -uFocus.z - 0.3) {
      float apart = length(here.xy / -here.z - uFocus.xy / -uFocus.z) * -uFocus.z;
      float keep = smoothstep(${(RADIUS * 0.55).toFixed(2)}, ${RADIUS.toFixed(2)}, apart);
      float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      if (grain > keep) discard;
    }
  }`);
  };
  material.customProgramCacheKey = () => 'see-through';
  material.needsUpdate = true;
  return material;
}
export function seeThroughAll(object) {
  object.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) seeThrough(m); });
}

// Each frame, once the camera is placed: where he is, in its view. (x, y, z: his middle.)
export function focusOn(camera, x, y, z) {
  camera.updateMatrixWorld();
  focus.value.copy(scratch.set(x, y, z)).applyMatrix4(camera.matrixWorldInverse);
  on.value = focus.value.z < -0.5 ? 1 : 0;
}
