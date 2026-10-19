// trees.js
// Ken's trees (Meshy models: a ghost gum, a coconut palm and a Daintree umbrella
// tree) drawn as "impostors", the way big open-world games draw their forests.
// Each full-detail model, millions of triangles, was rendered from 8 directions
// round it (tools/blender-impostor.py, tools/impostor-atlas.py). In the game each
// tree is one card that turns to face the camera and shows the picture for the
// direction it is seen from, lit by the game's sun through a normal picture (which
// way each leaf faces). So a tree looks like the original and costs 2 triangles,
// and every tree of a kind is drawn in one go.
//
// The tops sway a little in the breeze, and each card casts a tree-shaped shadow.
// Phones get pictures half the size.
//
//   const trees = new Trees(scene, { light });
//   trees.add('eucalyptus', x, y, z, height, yaw);   // as many as wanted
//   trees.build();                                     // once, after adding
//   trees.update(time);                                // every frame, for the breeze

import * as THREE from 'three';

// From each tree's assets/trees/<kind>.json: the card is `size` model units
// square for a tree `height` tall, its base `base` of the way up the card.
const KINDS = {
  eucalyptus: { frames: 8, cols: 4, rows: 2, size: 1.98494, height: 1.90860, base: 0.01923 },
  palm:       { frames: 8, cols: 4, rows: 2, size: 1.97984, height: 1.90369, base: 0.01923 },
  umbrella:   { frames: 8, cols: 4, rows: 2, size: 1.97950, height: 1.90337, base: 0.01923 },
  rainforest: { frames: 8, cols: 4, rows: 2, size: 1.97548, height: 1.89950, base: 0.01923 },   // Ken's Kuranda rainforest tile
};

const loader = new THREE.TextureLoader();

// The card's vertex work: turn to the camera, choose the picture for the
// direction, sway in the breeze. Shared by the colour and the shadow materials.
function cardVertex(shader, kind, time) {
  shader.uniforms.treeTime = time;
  const k = KINDS[kind];
  // All the card's work happens at the uv step, which every material (colour and
  // shadow) runs before anything else that needs it.
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      uniform float treeTime;`)
    .replace('#include <uv_vertex>', `#include <uv_vertex>
      // Where this tree stands and which way it was turned.
      vec3 treePos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float treeYaw = atan(-instanceMatrix[0].z, instanceMatrix[0].x);
      vec3 toCam = cameraPosition - treePos; toCam.y = 0.0; toCam = normalize(toCam + vec3(1e-5, 0.0, 0.0));
      // In the tree's own (turned) frame: face the camera, side to side across it.
      float cy = cos(-treeYaw), sy = sin(-treeYaw);
      vec3 cardFacing = vec3(cy * toCam.x + sy * toCam.z, 0.0, -sy * toCam.x + cy * toCam.z);
      vec3 cardRight = vec3(cardFacing.z, 0.0, -cardFacing.x);
      // The picture taken from the nearest of the ${k.frames} directions round the tree.
      float around = atan(cardFacing.x, cardFacing.z);
      float frame = mod(floor(around / ${(2 * Math.PI / k.frames).toFixed(6)} + 0.5) + ${k.frames}.0, ${k.frames}.0);
      float col = mod(frame, ${k.cols}.0), row = floor(frame / ${k.cols}.0);
      vec2 cardUv = vec2((col + uv.x) / ${k.cols}.0, (${k.rows - 1}.0 - row + uv.y) / ${k.rows}.0);
      #ifdef USE_MAP
        vMapUv = cardUv;
      #endif
      #ifdef USE_NORMALMAP
        vNormalMapUv = cardUv;
      #endif`)
    .replace('#include <beginnormal_vertex>', `vec3 objectNormal = cardFacing;`)
    .replace('#include <begin_vertex>', `
      // The card stands upright facing the camera; the top sways in the breeze.
      float up = position.y;
      float sway = sin(treeTime * 1.1 + treePos.x * 0.37 + treePos.z * 0.23) * 0.018 * up * up;
      vec3 transformed = cardRight * (position.x + sway) + vec3(0.0, up, 0.0);`);
}

export class Trees {
  constructor(scene, { light = false } = {}) {
    this.scene = scene;
    this.light = light;
    this.time = { value: 0 };
    this.lists = {};          // kind -> [{ x, y, z, height, yaw }]
    this.meshes = [];
  }

  add(kind, x, y, z, height, yaw = Math.random() * Math.PI * 2) {
    (this.lists[kind] = this.lists[kind] || []).push({ x, y, z, height, yaw });
  }

  build() {
    const suffix = this.light ? '-phone' : '';
    for (const [kind, list] of Object.entries(this.lists)) {
      const k = KINDS[kind];
      const colour = loader.load(`assets/trees/${kind}-colour${suffix}.webp`);
      colour.colorSpace = THREE.SRGBColorSpace; colour.anisotropy = 4;
      const normal = loader.load(`assets/trees/${kind}-normal${suffix}.webp`);
      const material = new THREE.MeshStandardMaterial({
        map: colour, normalMap: normal, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, metalness: 0,
      });
      material.onBeforeCompile = shader => cardVertex(shader, kind, this.time);
      material.customProgramCacheKey = () => 'tree-' + kind;
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: colour, alphaTest: 0.5 });
      depth.onBeforeCompile = shader => cardVertex(shader, kind, this.time);
      depth.customProgramCacheKey = () => 'tree-depth-' + kind;

      // A unit card with its foot where the tree's base is in the picture.
      const card = new THREE.PlaneGeometry(1, 1).translate(0, 0.5 - k.base, 0);
      const mesh = new THREE.InstancedMesh(card, material, list.length);
      mesh.customDepthMaterial = depth;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.noAO = true;                  // a cut-out card: the shading pass would see a solid square
      mesh.frustumCulled = false;                 // cards turn in the shader; the box three.js works out cannot know that
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      list.forEach((t, i) => {
        const side = k.size * t.height / k.height;          // card size for a tree this tall
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw);
        mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q, sc.set(side, side, side)));
      });
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    return this;
  }

  update(time) { this.time.value = time; }
}
