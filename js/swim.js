// swim.js
// A crocodile swimming without a rig (Ken's regular croc, models/croc-regular.glb,
// has no skeleton yet): the tail sways side to side in the vertex shader, more
// toward the tip, the way a croc drives itself through the water, while the head
// stays steady. One clock for every croc: call tickSwim(t) once a frame.
//
//   addSwimSway(root, { speed })   root: the croc's model (head toward +z)

import 'three';

const clock = { value: 0 };
export function tickSwim(t) { clock.value = t; }

export function addSwimSway(root, { speed = 3.2, amount = 0.11 } = {}) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox, head = b.max.z, length = b.max.z - b.min.z;
    const rate = { value: speed };
    o.material = o.material.clone();
    o.material.onBeforeCompile = shader => {
      shader.uniforms.swimTime = clock; shader.uniforms.swimRate = rate;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float swimTime, swimRate;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          // 0 at the snout, 1 at the tip of the tail; the sway grows toward the tip.
          float alongTail = clamp((${head.toFixed(4)} - position.z) / ${length.toFixed(4)}, 0.0, 1.0);
          float reach = smoothstep(0.25, 1.0, alongTail);
          transformed.x += sin(swimTime * swimRate - alongTail * 4.5) * ${(amount * length).toFixed(4)} * reach * reach;`);
    };
    o.material.customProgramCacheKey = () => `swim-${head.toFixed(3)}-${length.toFixed(3)}`;
    o.userData.swimRate = rate;
  });
  // How hard it is swimming: faster strokes when it moves faster.
  return { setPace(p) { root.traverse(o => { if (o.userData.swimRate) o.userData.swimRate.value = speed * (0.4 + p); }); } };
}
