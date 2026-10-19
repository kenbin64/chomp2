// forest-tiles.js
// Where Ken's rainforest tiles go: grid cells in a band either side of a
// straight route, a little jittered so the rows do not show. The tiles
// themselves are drawn as impostor cards by trees.js (kind 'rainforest'),
// not as the Meshy model, which is 1.25 million triangles a copy.

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
