// mossman-rules.js
// Mossman Gorge (Ken, 2026-10-20; MASTER.md): the rules of the place, no drawing.
// Tested in test/mossman.test.mjs.
//
// The Mossman River runs down the gorge over granite. Wally works his way down
// it: clear swimming holes, each a little lower than the last, joined by smooth
// rock slicks he slides down from one hole into the next. Visitors sit on the
// boulders round the holes. The key lies on the bottom of one hole; the chest
// with the opal (the earth talisman) on the bottom of the last.
//
// The course runs along +z, downhill. Every height here is in metres.

export const POOLS = [
  { z: 18,  r: 10, level: 32 },
  { z: 66,  r: 11, level: 25 },
  { z: 116, r: 12, level: 18 },    // the key is on the bottom of this one
  { z: 166, r: 10, level: 11 },
  { z: 220, r: 14, level: 4 },     // the last hole: the chest with the opal
];
export const KEY_POOL = 2, CHEST_POOL = 4;
export const POOL_DEPTH = 3.4;             // surface to bottom
export const SURFACE_DROP = 0.45;          // where he floats, below the water's surface
export const DIVE_DROP = 2.6;              // where he swims when he has dived (clear of the bottom)
export const SLIDE_HALF = 3.2;             // half the width of a rock slide: the whole riverbed, as at a real rock slide
export const SLIDE_SPEED = 8;              // how fast a slide carries him down (metres a second)
export const BANK_WIDTH = 9;               // flat-ish rock beside the river, where people sit
export const WALL = 24;                    // past this from the river's line, the gorge walls: no way on
export const START = { x: 0, z: 2 };       // on the rocks at the head of the first hole
export const FINISH_Z = POOLS[POOLS.length - 1].z + POOLS[POOLS.length - 1].r + 6;   // the track out, past the last hole

// The river winds a little: its centre line at z.
export const riverX = z => Math.sin(z * 0.022) * 7 + Math.sin(z * 0.051 + 1) * 2.5;

// Which hole (x, z) is in, or -1. Holes are ovals, a little longer than wide.
export function poolAt(x, z) {
  for (let i = 0; i < POOLS.length; i++) {
    const p = POOLS[i], dx = (x - riverX(p.z)) / (p.r * 0.8), dz = (z - p.z) / p.r;
    if (dx * dx + dz * dz <= 1) return i;
  }
  return -1;
}

// The rock slide from hole i to hole i + 1: where it starts and ends (on the holes' rims).
export function slideEnds(i) {
  const a = POOLS[i], b = POOLS[i + 1];
  return { z0: a.z + a.r * 0.92, z1: b.z - b.r * 0.92, y0: a.level, y1: b.level };
}
// On a slide: { i, t, y } (t 0 at the top, 1 at the bottom; y the rock's surface), or null.
export function slideAt(x, z) {
  for (let i = 0; i < POOLS.length - 1; i++) {
    const s = slideEnds(i);
    if (z < s.z0 || z > s.z1) continue;
    if (Math.abs(x - riverX(z)) > SLIDE_HALF) continue;
    const t = (z - s.z0) / (s.z1 - s.z0);
    return { i, t, y: s.y0 + (s.y1 - s.y0) * t };
  }
  return null;
}

// The river's level along the course: a hole's surface, or down a slide between them.
export function levelAt(z) {
  if (z <= POOLS[0].z) return POOLS[0].level;
  for (let i = 0; i < POOLS.length - 1; i++) {
    const s = slideEnds(i);
    if (z <= s.z0) return POOLS[i].level;
    if (z <= s.z1) return s.y0 + (s.y1 - s.y0) * (z - s.z0) / (s.z1 - s.z0);
  }
  return POOLS[POOLS.length - 1].level;
}

// The rock beside the river: just above the water at the edge, rising gently to the
// gorge walls, steeply at the walls themselves.
export function bankHeight(x, z) {
  const d = Math.abs(x - riverX(z));
  const base = levelAt(z) + 0.7;
  return base + Math.max(0, d - 4) * 0.12 + Math.max(0, d - BANK_WIDTH - 6) ** 2 * 0.25;
}

// What is under (x, z): { surface: 'water' | 'slide' | 'rock', y }. In a hole, y is the
// water's surface; under=true means he has dived.
export function groundAt(x, z, under = false) {
  const p = poolAt(x, z);
  if (p >= 0) {
    const L = POOLS[p].level;
    return { surface: 'water', y: L - (under ? DIVE_DROP : SURFACE_DROP), pool: p, bottom: L - POOL_DEPTH };
  }
  const s = slideAt(x, z);
  if (s) return { surface: 'slide', y: s.y, slide: s };
  return { surface: 'rock', y: bankHeight(x, z) };
}

// Inside the gorge: never past its walls, never back above the first hole.
export function insideGorge(x, z) {
  return Math.abs(x - riverX(z)) < WALL && z > -6 && z < FINISH_Z + 10;
}

// Where things lie on the bottom: the key (in KEY_POOL) and the chest (in CHEST_POOL),
// a little off the middle so they have to be looked for.
export function bottomSpot(pool, side) {
  const p = POOLS[pool];
  return { x: riverX(p.z) + side * p.r * 0.35, z: p.z + p.r * 0.25, y: p.level - POOL_DEPTH + 0.2 };
}
// Close enough to pick up or open: dived, and within reach across.
export const canReach = (wx, wz, under, sx, sz) => under && Math.hypot(wx - sx, wz - sz) < 1.8;

// Where groups of visitors sit: on the bank beside each hole, both sides taking turns.
export function groupSpots() {
  return POOLS.map((p, i) => {
    const side = i % 2 ? 1 : -1, x = riverX(p.z) + side * (p.r * 0.8 + 3.5);
    return { x, z: p.z, side };
  });
}
