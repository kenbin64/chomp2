// esplanade-rules.js
// The Esplanade Run, as rules only (tested in test/esplanade.test.mjs).
// Wally runs a raised boardwalk along +z toward the Lagoon pool at the far end,
// with the ocean right beside it (x < -half) and the city side beyond +half.
// ground is the boardwalk's height above the sea.

import { PEARL_POINTS, CHEST_POINTS } from './reef-rules.js';

export const PATH = { half: 4.5, start: 0, finish: 480, ground: 1.4 };

// What can be on the path. h: height (jump clear of it); r: reach around it;
// w, d: width and depth for boxes; low: a branch Wally must go under on all fours.
export const KINDS = {
  bin:     { shape: 'round', r: 0.45, h: 1.0 },
  bench:   { shape: 'box', w: 1.8, d: 0.6, h: 0.6 },
  jogger:  { shape: 'round', r: 0.45, h: 1.8, speed: 2.6 },
  pelican: { shape: 'round', r: 0.55, h: 1.25 },
  branch:  { shape: 'bar', d: 0.8, low: 1.15 },
};

// Same seed, same course: every player gets the same run and can learn it.
function rng(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Lays out obstacles and Golden Mangoes. Quiet at the start and the finish,
// busier the further Wally gets.
export function generateCourse(seed = 7) {
  const r = rng(seed);
  const obstacles = [], mangoes = [], shelters = [];
  const lane = () => (r() * 2 - 1) * (PATH.half - 1);
  for (let z = 40; z < PATH.finish - 30; ) {
    const busy = z / PATH.finish;                          // 0 near the start, 1 near the end
    const pick = r();
    if (pick < 0.12 && z > 100) {
      obstacles.push({ kind: 'branch', x: 0, z });
      for (let i = 0; i < 3; i++) mangoes.push({ x: 0, y: PATH.ground + 0.6, z: z - 1.5 + i * 1.5 });   // a reward for ducking
    } else if (pick < 0.32) {
      const x = lane();
      obstacles.push({ kind: 'bench', x, z });
      for (let i = 0; i < 5; i++) mangoes.push({ x, y: PATH.ground + 1.2 + Math.sin((i / 4) * Math.PI) * 1.0, z: z - 3 + i * 1.5 });  // an arc over it
    } else if (pick < 0.52) {
      const gap = lane();
      for (const dx of [-2.6, 2.6]) {
        const x = gap + dx;
        if (Math.abs(x) <= PATH.half - 0.4) obstacles.push({ kind: 'bin', x, z });
      }
      for (let i = 0; i < 4; i++) mangoes.push({ x: gap, y: PATH.ground + 0.8, z: z - 4 + i * 2 });
    } else if (pick < 0.72) {
      obstacles.push({ kind: 'jogger', x: lane(), z: z + 25 });
    } else {
      obstacles.push({ kind: 'pelican', x: lane(), z });
      const x = lane();
      for (let i = 0; i < 5; i++) mangoes.push({ x, y: PATH.ground + 0.8, z: z + 4 + i * 1.6 });
    }
    z += 22 - busy * 9 + r() * 5;
  }
  for (let z = 30; z < PATH.finish - 20; z += 42) shelters.push({ z });          // picnic shelters on the city side
  return { obstacles, mangoes, shelters };
}

// Does Wally (feet at feetY, standing at x, z) run into this obstacle?
// mode 'fours' gets him under a branch; being high enough clears the rest.
export function hits(ob, x, z, feetY, mode) {
  const k = KINDS[ob.kind];
  const radius = 0.4;                                      // Wally's own width, roughly
  if (k.shape === 'bar') {
    if (Math.abs(z - ob.z) > k.d / 2 + radius) return false;
    return mode !== 'fours';                               // upright, or jumping into it
  }
  if (feetY >= PATH.ground + k.h) return false;            // cleared it
  if (k.shape === 'round') return Math.hypot(x - ob.x, z - ob.z) < k.r + radius;
  return Math.abs(x - ob.x) < k.w / 2 + radius && Math.abs(z - ob.z) < k.d / 2 + radius;
}

// Final score and what it is made of.
// food: catch points (ground 1, air 2, jumping 3); a Golden Mango is 1.
// pearls and chest: from the dive to the reef (reef-rules.js scores them).
export function runScore({ food = 0, mangoes = 0, energyLeft = 0, stumbles = 0, finished = false, pearls = 0, chest = false }) {
  const finishBonus = finished ? 20 + Math.round(Math.max(0, energyLeft) / 10) : 0;
  const clean = finished && stumbles === 0 ? 25 : 0;
  const pearlPoints = Math.max(0, pearls) * PEARL_POINTS, chestPoints = chest ? CHEST_POINTS : 0;
  return { food, mangoes, finishBonus, clean, pearls: pearlPoints, chest: chestPoints,
    total: food + mangoes + finishBonus + clean + pearlPoints + chestPoints };
}

export const STARS = [70, 110, 150];      // raised with the reef: pearls and the chest add up to about 100 more
