// points-rules.js
// The trip's points (Ken, 2026-10-21): one simple score across the whole game, so a player wants
// to beat their own best and compare it with others. Plain JavaScript, no three.js, and tested
// (test/points.test.mjs).
//
// Ken's values: food caught off the ground 1, caught in the air 2, each thing picked up 1, a
// talisman 3. The rest follow the same scale.
//
// How it adds up:
//   A run is one go at an area. Its points count up as he plays (award).
//   Completing the area banks the run (bank). Each area keeps its BEST run of this trip, so
//   redoing an area to play it better raises the trip score, but farming it does not: a worse
//   run changes nothing. A failed run banks nothing.
//   The trip score is the sum of the areas' bests, times the difficulty bonus.
//   The personal best (best) is the highest trip score ever, kept through a new game.

export const POINTS = {
  ground: 1,      // food caught off the ground
  air: 2,         // food caught in the air
  leap: 3,        // food caught in the air while he leaps for it
  pickup: 1,      // anything picked up: a mango, a pearl, a shell, a key, a pawpaw, a cane piece
  talisman: 3,    // a talisman
  croc: 1,        // a croc that joins him (Croc Park, the push)
  heave: 1,       // a heave right on the beat (the Great Push)
  catch: 3,       // the boomerang caught on its way back
  star: 1,        // each star an area is completed with
  area: 5,        // an area completed
};
export const DIFFICULTY_BONUS = { easy: 1, intermediate: 1.5, hard: 2 };
export const AREAS = ['park', 'cane', 'esplanade', 'reef', 'kuranda', 'mossman', 'finale'];

export function freshRun(area) { return { area, pts: 0, counts: {} }; }

// Points for something done in a run. Returns the new run and how many points it gave.
export function award(run, kind, n = 1) {
  if (!run || !(kind in POINTS) || !Number.isFinite(n) || n <= 0) return { run, gained: 0 };
  const gained = POINTS[kind] * n;
  return { run: { ...run, pts: run.pts + gained, counts: { ...run.counts, [kind]: (run.counts[kind] || 0) + n } }, gained };
}

export function freshBook() { return { areas: {}, best: 0, trips: 0 }; }

// A saved points book, keeping only what makes sense.
export function readBook(b) {
  const f = freshBook();
  if (!b || typeof b !== 'object') return f;
  const areas = {};
  for (const a of AREAS) if (Number.isInteger(b.areas?.[a]) && b.areas[a] >= 0) areas[a] = b.areas[a];
  return { areas, best: Number.isInteger(b.best) && b.best >= 0 ? b.best : 0, trips: Number.isInteger(b.trips) && b.trips >= 0 ? b.trips : 0 };
}

// The trip score: every area's best, times the difficulty bonus, rounded.
export function tripScore(book, difficulty = 'intermediate') {
  const sum = Object.values(book.areas).reduce((s, v) => s + v, 0);
  return Math.round(sum * (DIFFICULTY_BONUS[difficulty] || 1));
}

// An area completed: the run's points, plus the completion and its stars, banked as the area's
// best if it beats the old one. Returns { book, total, areaBest, newAreaBest, trip, newBest }.
export function bank(book, run, { stars = 0, difficulty = 'intermediate' } = {}) {
  if (!run || !AREAS.includes(run.area)) return { book, total: 0, areaBest: 0, newAreaBest: false, trip: tripScore(book, difficulty), newBest: false };
  const total = run.pts + POINTS.area + POINTS.star * Math.max(0, Math.min(3, stars | 0));
  const old = book.areas[run.area] || 0, newAreaBest = total > old;
  const areas = newAreaBest ? { ...book.areas, [run.area]: total } : book.areas;
  const next = { ...book, areas };
  const trip = tripScore(next, difficulty), newBest = trip > book.best;
  if (newBest) next.best = trip;
  return { book: next, total, areaBest: Math.max(old, total), newAreaBest, trip, newBest };
}

// A new game: this trip's areas are cleared; the personal best is kept.
export function newTripBook(book) { return { ...book, areas: {}, trips: (book.trips || 0) + 1 }; }
