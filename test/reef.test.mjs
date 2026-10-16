// Tests for js/levels/reef-rules.js. Run:  node test/reef.test.mjs

import { makeMaze, distances, deadEnds, pearlCells, wallBoxes, cellCentre, collide, inMaze, airStep, AIR, reefScore, PEARL_POINTS, CHEST_POINTS } from '../js/levels/reef-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

// ---- The maze ----
for (const seed of [1, 2, 3, 7, 42, 99]) {
  const m = makeMaze(7, 7, seed);
  const dist = distances(m.cols, m.rows, m.open, m.entrance);
  check(`seed ${seed}: every cell can be reached`, dist.every(d => d >= 0));
  // A perfect maze on n cells has exactly n - 1 openings between cells.
  let links = 0;
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    if (c < m.cols - 1 && m.open[r * m.cols + c][0]) links++;
    if (r < m.rows - 1 && m.open[r * m.cols + c][1]) links++;
  }
  check(`seed ${seed}: one way only between any two cells`, links === m.cols * m.rows - 1, `${links} links`);
  // Openings agree from both sides.
  let agree = true;
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols - 1; c++) if (m.open[r * m.cols + c][0] !== m.open[r * m.cols + c + 1][2]) agree = false;
  check(`seed ${seed}: walls are the same from both sides`, agree);
  check(`seed ${seed}: the entrance is a gap in the east wall`, m.entrance.c === m.cols - 1 && m.open[m.entrance.r * m.cols + m.entrance.c][0]);
  const far = Math.max(...dist);
  check(`seed ${seed}: the chest is in the furthest cell`, dist[m.chest.r * m.cols + m.chest.c] === far);
  check(`seed ${seed}: the chest is a real trek in`, far >= 8, `${far} steps`);
  const pc = pearlCells(m, 6), keys = new Set(pc.map(p => `${p.c},${p.r}`));
  check(`seed ${seed}: six pearls find six different cells`, pc.length === 6 && keys.size === 6);
  check(`seed ${seed}: no pearl on the entrance or the chest`, !keys.has(`${m.entrance.c},${m.entrance.r}`) && !keys.has(`${m.chest.c},${m.chest.r}`));
  check(`seed ${seed}: dead ends get pearls first`, deadEnds(m).slice(0, 6).every(d => keys.has(`${d.c},${d.r}`)));
}
check('the same seed gives the same maze', JSON.stringify(makeMaze(7, 7, 5).open) === JSON.stringify(makeMaze(7, 7, 5).open));
check('a different seed gives a different maze', JSON.stringify(makeMaze(7, 7, 5).open) !== JSON.stringify(makeMaze(7, 7, 6).open));

// ---- Walls and bumping into them ----
{
  const m = makeMaze(5, 5, 3), size = 5, ox = 0, oz = 0;
  const boxes = wallBoxes(m, ox, oz, size);
  const e = cellCentre(m, m.entrance, ox, oz, size);
  // Swimming in through the entrance gap from outside is not blocked.
  const inFromOutside = collide(e.x + size, e.z, e.x + size - 0.5, e.z, boxes);
  check('the entrance gap lets him in', inFromOutside.x < e.x + size);
  // Every closed side of a cell stops him; every open side lets him through.
  let stops = true, passes = true;
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    const p = cellCentre(m, { c, r }, ox, oz, size), o = m.open[r * m.cols + c];
    for (const [d, dx, dz] of [[0, 1, 0], [1, 0, 1], [2, -1, 0], [3, 0, -1]]) {
      // Walk from the centre toward that side in small steps.
      let x = p.x, z = p.z;
      for (let i = 0; i < 40; i++) { const n = collide(x, z, x + dx * 0.1, z + dz * 0.1, boxes); x = n.x; z = n.z; }
      const crossed = Math.abs(x - p.x) > size / 2 || Math.abs(z - p.z) > size / 2;
      if (o[d] && !crossed && !(c === m.entrance.c && r === m.entrance.r && d === 0) ) passes = false;
      if (!o[d] && crossed) stops = false;
    }
  }
  check('closed sides stop him', stops);
  check('open sides let him through', passes);
  check('sliding along a wall still moves him', (() => {
    const b = [{ x0: -10, z0: 1, x1: 10, z1: 2 }];                      // a wall just north of him... south in +z
    const n = collide(0, 0, 0.5, 0.8, b);                                // pushing diagonally into it
    return n.x === 0.5 && n.z === 0;
  })());
  check('inside the cave is detected', inMaze(m, 2, 2, ox, oz, size) && !inMaze(m, -3, 2, ox, oz, size));
}

// ---- Air ----
check('air runs down under water', airStep(50, 'under', 1) < 50);
check('one breath lasts 55 seconds', Math.abs(airStep(AIR.max, 'under', 55)) < 1e-9);
check('air never goes below empty', airStep(1, 'under', 10) === 0);
check('a vent fills him up', airStep(10, 'vent', 1) === 10 + AIR.vent);
check('the surface fills him fastest', AIR.surface > AIR.vent);
check('air never goes above full', airStep(95, 'surface', 1) === AIR.max);

// ---- Score ----
check('pearls and the chest score', reefScore({ pearls: 4, chest: true }) === 4 * PEARL_POINTS + CHEST_POINTS);
check('nothing scores nothing', reefScore({}) === 0);

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
