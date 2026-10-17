// reef-rules.js
// The rules of the dive under the Esplanade, kept apart from the drawing so
// they can be tested: the coral maze inside the cave, where the pearls and the
// pirate chest go, how Wally bumps into walls, and how his air runs down and
// fills up. Plain JavaScript, no three.js.

// ---- Depths (metres; the sea surface is 0) ------------------------------------
export const SEABED_Y = -12;
export const SWIM_Y = -8.6;        // where Wally swims along the reef, clear of the coral
export const SURFACE_Y = -0.45;    // where he floats at the top, as in the rest of the game
export const WALL_TOP = -5.6;      // maze walls run from the seabed up to here

// ---- Swimming depths (Ken: things to collect at different depths) --------------
// Under water Wally swims at one of three depths, all inside the coral (below
// WALL_TOP, above the seabed): Shift takes him one deeper, Ctrl+Shift one up,
// and from the top one he surfaces.
export const LANES = [-6.6, SWIM_Y, -10.6];
export const LANE_NAMES = ['near the top', 'middle', 'down deep'];
// The next depth to swim at. dir +1 deeper, -1 up. From the surface a dive goes
// to the top lane; up from the top lane is the surface (unless rock is overhead).
export function nextDepth(depth, dir, canSurface = true) {
  const near = LANES.reduce((best, y, i) => Math.abs(y - depth) < Math.abs(LANES[best] - depth) ? i : best, 0);
  if (depth > LANES[0] + 1.5) return dir > 0 ? LANES[0] : depth;                  // at the surface
  const i = near + Math.sign(dir);
  if (i < 0) return canSurface ? SURFACE_Y : LANES[0];
  return LANES[Math.min(LANES.length - 1, i)];
}

// ---- Reef treasures --------------------------------------------------------------
// Scattered along the maze corridors at the three depths, worth more the deeper
// they are: starfish near the top, cowrie shells in the middle, gold coins from
// the pirate wreck down deep.
export const TREASURES = {
  starfish: { lane: 0, points: 2, name: 'Starfish' },
  shell:    { lane: 1, points: 3, name: 'Cowrie shell' },
  coin:     { lane: 2, points: 5, name: 'Gold coin' },
};
// n treasures in different cells of a maze (never the entrance or the chest's
// cell), each a kind chosen at random; the same seed gives the same layout.
export function treasureSpots(maze, n, seed = 1, skip = []) {
  const rnd = seeded(seed * 7 + 3);
  const cells = [];
  for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) {
    if (c === maze.entrance.c && r === maze.entrance.r) continue;
    if (maze.chest && c === maze.chest.c && r === maze.chest.r) continue;
    if (skip.some(k => k.c === c && k.r === r)) continue;
    cells.push({ c, r });
  }
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  // Shells are the most common find (Ken), starfish and gold coins rarer.
  const pick = () => { const r = rnd(); return r < 0.5 ? 'shell' : r < 0.78 ? 'starfish' : 'coin'; };
  return cells.slice(0, n).map(cell => ({ cell, kind: pick() }));
}
// Is Wally close enough to pick one up? Near it across, and at its depth.
export function canCollect(wx, wz, depth, tx, tz, ty) {
  return Math.hypot(wx - tx, wz - tz) < 1.3 && Math.abs(depth - ty) < 1.0;
}

// ---- Air ----------------------------------------------------------------------
export const AIR = {
  max: 100,
  drain: 100 / 55,                 // one breath lasts 55 seconds
  vent: 45,                        // per second, standing in a bubble vent
  surface: 70,                     // per second, floating at the top
  sting: 12,                       // a box jellyfish knocks this much out of him
  pearlTopUp: 35,                  // a pearl traded at a vent, when air is low
};

// One step of the air meter. where: 'surface' | 'vent' | 'under'.
export function airStep(air, where, dt) {
  if (where === 'surface') return Math.min(AIR.max, air + AIR.surface * dt);
  if (where === 'vent') return Math.min(AIR.max, air + AIR.vent * dt);
  return Math.max(0, air - AIR.drain * dt);
}

// ---- Scoring ------------------------------------------------------------------
export const PEARL_POINTS = 5;
export const CHEST_POINTS = 30;
export function reefScore({ pearls = 0, chest = false }) {
  return pearls * PEARL_POINTS + (chest ? CHEST_POINTS : 0);
}

// ---- The maze -------------------------------------------------------------------
export const CHEST_DEPTH = 0.6;    // how far toward the deepest cell the chest sits
// A grid of cols x rows cells. Each cell records which of its four sides are
// open. Directions: 0 east (+x), 1 south (+z), 2 west (-x), 3 north (-z).
const DX = [1, 0, -1, 0], DZ = [0, 1, 0, -1];

function seeded(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// A perfect maze (exactly one way between any two cells), carved by walking
// at random and backing up at dead ends. The entrance is a gap in the east
// wall of the given row. The chest goes in the cell furthest from the entrance,
// so the whole maze has to be explored to reach it.
export function makeMaze(cols, rows, seed = 1, entranceRow = Math.floor(rows / 2)) {
  const rnd = seeded(seed);
  const open = Array.from({ length: cols * rows }, () => [false, false, false, false]);
  const seen = new Array(cols * rows).fill(false);
  const at = (c, r) => r * cols + c;
  const stack = [[cols - 1, entranceRow]];
  seen[at(cols - 1, entranceRow)] = true;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const ways = [0, 1, 2, 3].filter(d => {
      const nc = c + DX[d], nr = r + DZ[d];
      return nc >= 0 && nc < cols && nr >= 0 && nr < rows && !seen[at(nc, nr)];
    });
    if (!ways.length) { stack.pop(); continue; }
    const d = ways[Math.floor(rnd() * ways.length)];
    const nc = c + DX[d], nr = r + DZ[d];
    open[at(c, r)][d] = true;
    open[at(nc, nr)][(d + 2) % 4] = true;
    seen[at(nc, nr)] = true;
    stack.push([nc, nr]);
  }
  const entrance = { c: cols - 1, r: entranceRow };
  open[at(entrance.c, entrance.r)][0] = true;          // the gap in the outside wall
  const dist = distances(cols, rows, open, entrance);
  // The chest goes about CHEST_DEPTH of the way to the furthest cell (Ken: the
  // furthest cell made a 30-second swim that felt endless), preferring a dead
  // end there, so finding it is still a search.
  const far = Math.max(...dist), want = Math.max(4, Math.round(far * CHEST_DEPTH));
  let chest = entrance, best = 1e9;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const d = dist[at(c, r)], deadEnd = open[at(c, r)].filter(Boolean).length === 1;
    const score = Math.abs(d - want) + (deadEnd ? 0 : 1.5);
    if (d > 0 && score < best) { best = score; chest = { c, r }; }
  }
  return { cols, rows, open, entrance, chest, dist };
}

// Steps from the entrance to every cell, through open sides only.
export function distances(cols, rows, open, from) {
  const dist = new Array(cols * rows).fill(-1);
  const q = [from]; dist[from.r * cols + from.c] = 0;
  while (q.length) {
    const { c, r } = q.shift();
    for (let d = 0; d < 4; d++) {
      if (!open[r * cols + c][d]) continue;
      const nc = c + DX[d], nr = r + DZ[d];
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows || dist[nr * cols + nc] >= 0) continue;
      dist[nr * cols + nc] = dist[r * cols + c] + 1;
      q.push({ c: nc, r: nr });
    }
  }
  return dist;
}

// Dead ends (one open side), the natural place to hide a pearl, apart from the
// entrance and the chest's own cell.
export function deadEnds(maze) {
  const out = [];
  for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) {
    if (c === maze.entrance.c && r === maze.entrance.r) continue;
    if (c === maze.chest.c && r === maze.chest.r) continue;
    if (maze.open[r * maze.cols + c].filter(Boolean).length === 1) out.push({ c, r });
  }
  return out;
}

// The walls as boxes on the ground plan: { x0, z0, x1, z1 } in metres, for the
// maze placed with its north-west corner at (ox, oz) and cells `size` wide.
// Shared walls appear once. thick: wall thickness.
export function wallBoxes(maze, ox, oz, size, thick = 1.1) {
  const boxes = [], h = thick / 2;
  for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) {
    const o = maze.open[r * maze.cols + c];
    const x0 = ox + c * size, z0 = oz + r * size, x1 = x0 + size, z1 = z0 + size;
    if (!o[3]) boxes.push({ x0: x0 - h, z0: z0 - h, x1: x1 + h, z1: z0 + h });                 // north
    if (!o[2]) boxes.push({ x0: x0 - h, z0: z0 - h, x1: x0 + h, z1: z1 + h });                 // west
    if (r === maze.rows - 1 && !o[1]) boxes.push({ x0: x0 - h, z0: z1 - h, x1: x1 + h, z1: z1 + h });   // south edge
    if (c === maze.cols - 1 && !o[0]) boxes.push({ x0: x1 - h, z0: z0 - h, x1: x1 + h, z1: z1 + h });   // east edge
  }
  return boxes;
}

// The centre of a cell, in metres.
export function cellCentre(maze, cell, ox, oz, size) {
  return { x: ox + (cell.c + 0.5) * size, z: oz + (cell.r + 0.5) * size };
}

// A step from (x, z) toward (nx, nz) for a body of radius rad, stopped by the
// boxes. Each axis is tried on its own, so he slides along a wall rather than
// sticking to it.
export function collide(x, z, nx, nz, boxes, rad = 0.6) {
  const blocked = (px, pz) => boxes.some(b => px > b.x0 - rad && px < b.x1 + rad && pz > b.z0 - rad && pz < b.z1 + rad);
  let rx = x, rz = z;
  if (!blocked(nx, rz)) rx = nx;
  if (!blocked(rx, nz)) rz = nz;
  return { x: rx, z: rz };
}

// Whether a point is inside the maze's rectangle (the cave).
export function inMaze(maze, x, z, ox, oz, size, margin = 0) {
  return x > ox - margin && x < ox + maze.cols * size + margin && z > oz - margin && z < oz + maze.rows * size + margin;
}

// Where to put n pearls in the cave: dead ends first (the reward for exploring),
// then cells spread evenly along the way in, never the entrance or the chest.
export function pearlCells(maze, n) {
  const key = (p) => `${p.c},${p.r}`;
  const out = deadEnds(maze).slice(0, n), used = new Set(out.map(key));
  used.add(key(maze.entrance)); used.add(key(maze.chest));
  const rest = [];
  for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) if (!used.has(`${c},${r}`)) rest.push({ c, r, d: maze.dist[r * maze.cols + c] });
  rest.sort((a, b) => a.d - b.d);
  for (let i = 0; out.length < n && rest.length; i++) {
    const pick = rest.splice(Math.floor((i * 0.618 % 1) * rest.length), 1)[0];   // spread through the range of distances
    out.push({ c: pick.c, r: pick.r });
  }
  return out;
}

// ---- The coral maze on the open reef, between the jetty and the cave ------------
// A maze like the cave's, but walled in coral and open to the sky: in from the
// east (the jetty side) and out on the west side, in the row that faces the cave
// mouth. The way through is long enough to need finding (tested).
export function makeReefMaze(cols, rows, seed = 1, row = Math.floor(rows / 2)) {
  const m = makeMaze(cols, rows, seed, row);
  m.exit = { c: 0, r: row };
  m.open[row * cols][2] = true;                      // the gap in the west wall, toward the cave
  return m;
}

// The cells from one cell to another, through open sides only, both ends
// included. The guide fish swims this route.
export function mazePath(maze, from, to) {
  const key = (c, r) => r * maze.cols + c;
  const prev = new Array(maze.cols * maze.rows).fill(-1), seen = new Array(maze.cols * maze.rows).fill(false);
  const q = [from]; seen[key(from.c, from.r)] = true;
  while (q.length) {
    const cur = q.shift();
    if (cur.c === to.c && cur.r === to.r) break;
    for (let d = 0; d < 4; d++) {
      if (!maze.open[key(cur.c, cur.r)][d]) continue;
      const nc = cur.c + DX[d], nr = cur.r + DZ[d];
      if (nc < 0 || nc >= maze.cols || nr < 0 || nr >= maze.rows || seen[key(nc, nr)]) continue;
      seen[key(nc, nr)] = true; prev[key(nc, nr)] = key(cur.c, cur.r); q.push({ c: nc, r: nr });
    }
  }
  if (!seen[key(to.c, to.r)]) return [];
  const out = [];
  for (let k = key(to.c, to.r); k !== -1; k = prev[k]) out.unshift({ c: k % maze.cols, r: Math.floor(k / maze.cols) });
  return out;
}

// Which cell a point is in (or null outside the maze).
export function cellAt(maze, x, z, ox, oz, size) {
  const c = Math.floor((x - ox) / size), r = Math.floor((z - oz) / size);
  return c >= 0 && c < maze.cols && r >= 0 && r < maze.rows ? { c, r } : null;
}

// ---- The reef level's score ------------------------------------------------------
// Pearls found and the chest, plus a bonus for finishing with air to spare.
export const REEF_STARS = [80, 140, 190];   // raised with the treasures (about 100 more points on a full run)
// treasure: points from the starfish, shells and coins picked up.
export function reefRunScore({ found = 0, chest = false, airLeft = 0, finished = false, treasure = 0 }) {
  const pearls = Math.max(0, found) * PEARL_POINTS, chestPts = chest ? CHEST_POINTS : 0;
  const finishBonus = finished ? 20 + Math.round(Math.max(0, airLeft) / 5) : 0;
  const tr = Math.max(0, treasure);
  return { pearls, chest: chestPts, treasure: tr, finishBonus, total: pearls + chestPts + tr + finishBonus };
}
