// forest-tiles.js
// Ken's rainforest tile (models/rainforest-tile.glb): a square patch of
// rainforest (a buttressed fig with vines, palms, ferns) laid in a grid to make
// a continuous canopy. Each tile is turned a quarter-turn at random, sometimes
// mirrored and sized a little differently, so the repeats do not show. Drawn
// as instances: hundreds of tiles cost about as much as one.

import * as THREE from 'three';

// cells: [{ x, z }] tile centres. size: how wide a tile is on the ground, in metres.
export function forestTiles(scene, gltf, cells, size = 14) {
  if (!gltf || !cells.length) return null;
  const src = gltf.scene.clone(true);
  src.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src), dims = box.getSize(new THREE.Vector3());
  const k = size / Math.max(dims.x, dims.z);
  // The tile's own transform: scaled to `size`, centred, standing on the ground.
  const base = new THREE.Matrix4().makeScale(k, k, k).premultiply(new THREE.Matrix4().makeTranslation(0, 0, 0));
  const centre = new THREE.Matrix4().makeTranslation(-(box.min.x + dims.x / 2), -box.min.y, -(box.min.z + dims.z / 2));
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  src.traverse(o => {
    if (!o.isMesh) return;
    const inst = new THREE.InstancedMesh(o.geometry, o.material, cells.length);
    const own = o.matrixWorld.clone();
    cells.forEach((c, i) => {
      const s = 0.92 + Math.random() * 0.2, flip = Math.random() < 0.5 ? -1 : 1;
      q.setFromAxisAngle(up, Math.floor(Math.random() * 4) * Math.PI / 2);
      const place = new THREE.Matrix4().compose(new THREE.Vector3(c.x, c.y || 0, c.z), q, new THREE.Vector3(s * flip, s, s));
      m.copy(place).multiply(base).multiply(centre).multiply(own);
      inst.setMatrixAt(i, m);
    });
    inst.castShadow = true; inst.receiveShadow = true;
    inst.frustumCulled = false;                                  // spread over the whole level
    group.add(inst);
  });
  scene.add(group);
  return group;
}

// Grid cells in a band beside a straight route along z: from `inner` to `outer`
// metres either side, from z0 to z1, `size` apart, leaving out any cell `skip` rejects.
export function bandCells(inner, outer, z0, z1, size, skip = () => false) {
  const cells = [];
  for (const side of [-1, 1]) for (let x = inner + size / 2; x < outer; x += size * 0.9) for (let z = z0; z < z1; z += size * 0.9) {
    const c = { x: side * x + (Math.random() - 0.5) * 2, z: z + (Math.random() - 0.5) * 2 };
    if (!skip(c)) cells.push(c);
  }
  return cells;
}
