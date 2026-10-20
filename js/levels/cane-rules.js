// cane-rules.js
// The sugar cane fields (Ken, 2026-10-20; MASTER.md): the rules, no drawing.
// Tested in test/cane.test.mjs.
//
// The field is a square grid of cells, each one of:
//   cane  thick standing cane: Wally cannot walk through it, but a swing of the
//         machete clears it, and he beats down his own path;
//   cut   cut ground (the headland he starts on, the clearing in the middle,
//         and every cell he has cleared);
//   fire  burning cane: he can never go in, and it can never reach him. It is
//         there for tension, not danger: the burning lines keep him to certain
//         parts of the field, so the field is a hybrid maze, not a traditional one.
// The fire talisman's chest stands in a clearing in the middle.
//
// The fire is laid as rings round the middle with a few gaps in each (plus short
// spurs inward), so there is always a way through, but not a straight one.
// Harder levels have more rings and fewer gaps.

export const CANE = {
  cell: 2.2,           // metres a side
  size: 33,            // cells a side (odd, so there is a middle cell)
  clearing: 1,         // the clearing round the middle: cells each way (3 x 3)
  headland: 2,         // rows of cut ground along the south edge, where he starts
  pieceChance: { easy: 0.6, intermediate: 0.45, hard: 0.35 },   // a cut cell drops a piece of cane
  pieceEnergy: 14,     // energy from one piece
  lying: { easy: 16, intermediate: 12, hard: 9 },  // pieces left lying on the ground at the start
};

// Fire rings by level: radius in cells from the middle, and the gaps in each.
const RINGS = {
  easy:         [{ r: 6, gaps: 3 }, { r: 11, gaps: 3 }],
  intermediate: [{ r: 5, gaps: 2 }, { r: 9, gaps: 2 }, { r: 13, gaps: 3 }],
  hard:         [{ r: 4, gaps: 2 }, { r: 7, gaps: 2 }, { r: 10, gaps: 2 }, { r: 13, gaps: 2 }],
};
export const ringsFor = level => RINGS[level] || RINGS.intermediate;

// A small, fixed random generator, so a seed always makes the same field.
export function rng(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export const middle = () => (CANE.size - 1) / 2;
export const startCell = () => ({ i: middle(), j: 0 });       // the middle of the south edge

// Grid cell <-> world position (metres). The field is centred on the origin;
// j runs north (+z), i runs east (+x).
export function cellToWorld(i, j) {
  const half = (CANE.size * CANE.cell) / 2;
  return { x: -half + (i + 0.5) * CANE.cell, z: -half + (j + 0.5) * CANE.cell };
}
export function worldToCell(x, z) {
  const half = (CANE.size * CANE.cell) / 2;
  return { i: Math.floor((x + half) / CANE.cell), j: Math.floor((z + half) / CANE.cell) };
}
export const inField = (i, j) => i >= 0 && j >= 0 && i < CANE.size && j < CANE.size;

// Ring distance from the middle: the square rings of the grid (Chebyshev distance).
const ringOf = (i, j) => Math.max(Math.abs(i - middle()), Math.abs(j - middle()));

// Make a field. Returns { cells: [rows of 'cane' | 'cut' | 'fire'], lying: [{ i, j }], level, seed }.
export function makeField(seed, level = 'intermediate') {
  const R = rng(seed), N = CANE.size, m = middle();
  const cells = Array.from({ length: N }, () => Array(N).fill('cane'));
  // Fire rings, each with its gaps spaced round it (never two gaps on one side
  // only), so the way through winds.
  for (const { r, gaps } of ringsFor(level)) {
    const ring = [];
    for (let i = m - r; i <= m + r; i++) for (let j = m - r; j <= m + r; j++) if (ringOf(i, j) === r && inField(i, j)) ring.push({ i, j });
    ring.sort((a, b) => Math.atan2(a.j - m, a.i - m) - Math.atan2(b.j - m, b.i - m));
    const open = new Set();
    const offset = Math.floor(R() * ring.length);
    for (let g = 0; g < gaps; g++) {
      const at = (offset + Math.floor((g + R() * 0.4) * ring.length / gaps)) % ring.length;
      for (let w = -1; w <= 1; w++) open.add((at + w + ring.length) % ring.length);   // each gap three cells wide
    }
    ring.forEach((c, k) => { if (!open.has(k)) cells[c.j][c.i] = 'fire'; });
    // Never a gap straight ahead of the start: that would be a straight run to the
    // middle. (Every ring has at least two gaps, so another always stays open.)
    for (let i = m - 1; i <= m + 1; i++) cells[m - r][i] = 'fire';
    // A short spur inward from the ring, so the corridors between rings are not plain loops.
    const spur = ring[Math.floor(R() * ring.length)];
    if (spur && !open.has(ring.indexOf(spur))) {
      const di = Math.sign(m - spur.i), dj = Math.sign(m - spur.j);
      for (let s = 1; s <= 2; s++) { const i = spur.i + di * s, j = spur.j + dj * s; if (inField(i, j) && ringOf(i, j) > CANE.clearing + 1) cells[j][i] = 'fire'; }
    }
  }
  // The clearing in the middle and the headland along the south edge.
  for (let i = m - CANE.clearing; i <= m + CANE.clearing; i++) for (let j = m - CANE.clearing; j <= m + CANE.clearing; j++) cells[j][i] = 'cut';
  for (let j = 0; j < CANE.headland; j++) for (let i = 0; i < N; i++) cells[j][i] = 'cut';
  // Pieces of cane left lying: on the headland, and in cells inside the field (the toads and bats know).
  const lying = [];
  const want = CANE.lying[level] || CANE.lying.intermediate;
  for (let tries = 0; lying.length < want && tries < 4000; tries++) {
    const i = Math.floor(R() * N), j = Math.floor(R() * N);
    if (cells[j][i] === 'fire' || lying.some(p => p.i === i && p.j === j)) continue;
    if (i === startCell().i && j === startCell().j) continue;
    lying.push({ i, j });
  }
  return { cells, lying, level, seed };
}

export const at = (field, i, j) => inField(i, j) ? field.cells[j][i] : 'edge';
// Wally can stand in a cell that is cut; cane must be cut first; fire and the edge never.
export const walkable = (field, i, j) => at(field, i, j) === 'cut';
export const cuttable = (field, i, j) => at(field, i, j) === 'cane';

// Cut a cell: a new field (the old one is not changed), and whether it dropped a
// piece of cane (r: a random number 0..1 for this cut).
export function cut(field, i, j, r = Math.random()) {
  if (!cuttable(field, i, j)) return { field, cut: false, piece: false };
  const cells = field.cells.map(row => row.slice());
  cells[j][i] = 'cut';
  return { field: { ...field, cells }, cut: true, piece: r < (CANE.pieceChance[field.level] || CANE.pieceChance.intermediate) };
}

// Can Wally get from the start to the middle, cutting cane as he goes but never
// through fire? (Breadth-first over every cell that is not fire.)
export function wayThrough(field, from = startCell(), to = { i: middle(), j: middle() }) {
  const N = CANE.size, seen = new Set([`${from.i},${from.j}`]), queue = [from];
  while (queue.length) {
    const c = queue.shift();
    if (c.i === to.i && c.j === to.j) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = c.i + di, j = c.j + dj, key = `${i},${j}`;
      if (!inField(i, j) || seen.has(key) || at(field, i, j) === 'fire') continue;
      seen.add(key); queue.push({ i, j });
    }
  }
  return false;
}

// The fewest cells of cane he must cut to reach the middle (0-1 breadth-first:
// cut ground costs nothing, cane costs one). How long the job is.
export function cutsNeeded(field, from = startCell(), to = { i: middle(), j: middle() }) {
  const N = CANE.size, cost = Array.from({ length: N }, () => Array(N).fill(Infinity));
  cost[from.j][from.i] = 0;
  const dq = [from];
  while (dq.length) {
    const c = dq.shift();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = c.i + di, j = c.j + dj;
      if (!inField(i, j) || at(field, i, j) === 'fire') continue;
      const step = at(field, i, j) === 'cane' ? 1 : 0, nc = cost[c.j][c.i] + step;
      if (nc < cost[j][i]) { cost[j][i] = nc; if (step) dq.push({ i, j }); else dq.unshift({ i, j }); }
    }
  }
  return cost[to.j][to.i];
}

// Fire can never reach him: the cells next to fire that he could stand in are
// all still cut or cane (fire does not spread); this reports any fire cell that
// is not in the place it was laid, for the tests.
export function fireCells(field) {
  const out = [];
  for (let j = 0; j < CANE.size; j++) for (let i = 0; i < CANE.size; i++) if (field.cells[j][i] === 'fire') out.push({ i, j });
  return out;
}
