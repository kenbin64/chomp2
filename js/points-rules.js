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
//   run changes nothing. A failed run banks nothing: an area's points are kept only by completing
//   it. The whole game never has to be finished for the personal best or the leaderboard (Ken,
//   2026-10-21: many sittings, many tries); each area completed counts at once.
//   Going back to an area already completed (Ken, 2026-10-21): what he picks up there counts, and the
//   area need not be completed again (bankExtra). So it cannot be farmed for ever, an area's extra
//   points stop at its own completed score: going back can at most double it.
//   Each run counts at its own level (Ken, 2026-10-21): going back to an area steps it up a level
//   (trip-rules.js attemptLevel: easy, then intermediate, then hard), so a harder go is worth more.
//   The trip score is the sum of the areas' bests and extras.
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

export function freshRun(area, level = 'intermediate') { return { area, level: level in DIFFICULTY_BONUS ? level : 'intermediate', pts: 0, counts: {} }; }
// A run's points at its level.
const atLevel = (pts, run) => Math.round(pts * (DIFFICULTY_BONUS[run.level] || DIFFICULTY_BONUS.intermediate));

// Points for something done in a run. Returns the new run and how many points it gave.
export function award(run, kind, n = 1) {
  if (!run || !(kind in POINTS) || !Number.isFinite(n) || n <= 0) return { run, gained: 0 };
  const gained = POINTS[kind] * n;
  return { run: { ...run, pts: run.pts + gained, counts: { ...run.counts, [kind]: (run.counts[kind] || 0) + n } }, gained };
}

export function freshBook() { return { areas: {}, extras: {}, best: 0, trips: 0 }; }

// A saved points book, keeping only what makes sense.
export function readBook(b) {
  const f = freshBook();
  if (!b || typeof b !== 'object') return f;
  const areas = {};
  for (const a of AREAS) if (Number.isInteger(b.areas?.[a]) && b.areas[a] >= 0) areas[a] = b.areas[a];
  const extras = {};
  for (const a of Object.keys(areas)) if (Number.isInteger(b.extras?.[a]) && b.extras[a] > 0) extras[a] = Math.min(b.extras[a], areas[a]);
  return { areas, extras, best: Number.isInteger(b.best) && b.best >= 0 ? b.best : 0, trips: Number.isInteger(b.trips) && b.trips >= 0 ? b.trips : 0 };
}

// The trip score: every area's best and its extras (each already counted at its run's level).
export function tripScore(book) {
  return Object.values(book.areas).reduce((s, v) => s + v, 0) + Object.values(book.extras || {}).reduce((s, v) => s + v, 0);
}

// An area completed: the run's points, plus the completion and its stars, banked as the area's
// best if it beats the old one. Returns { book, total, areaBest, newAreaBest, trip, newBest }.
export function bank(book, run, { stars = 0 } = {}) {
  if (!run || !AREAS.includes(run.area)) return { book, total: 0, areaBest: 0, newAreaBest: false, trip: tripScore(book), newBest: false };
  const total = atLevel(run.pts + POINTS.area + POINTS.star * Math.max(0, Math.min(3, stars | 0)), run);
  const old = book.areas[run.area] || 0, newAreaBest = total > old;
  const areas = newAreaBest ? { ...book.areas, [run.area]: total } : book.areas;
  const next = { ...book, areas };
  const trip = tripScore(next), newBest = trip > book.best;
  if (newBest) next.best = trip;
  return { book: next, total, areaBest: Math.max(old, total), newAreaBest, trip, newBest };
}

// Has this area been completed on this trip? (Then going back is a revisit.)
export const completed = (book, area) => book.areas[area] != null;

// A revisit's points (the area completed before; this time it need not be): added to the area's
// extras, up to the area's completed score. Returns { book, gained, trip, newBest }.
export function bankExtra(book, run) {
  if (!run || !completed(book, run.area) || !(run.pts > 0)) return { book, gained: 0, trip: tripScore(book), newBest: false };
  const have = (book.extras || {})[run.area] || 0, gained = Math.max(0, Math.min(atLevel(run.pts, run), book.areas[run.area] - have));
  const next = { ...book, extras: { ...(book.extras || {}), [run.area]: have + gained } };
  const trip = tripScore(next), newBest = trip > book.best;
  if (newBest) next.best = trip;
  return { book: next, gained, trip, newBest };
}

// A new game: this trip's areas are cleared; the personal best is kept.
export function newTripBook(book) { return { ...book, areas: {}, extras: {}, trips: (book.trips || 0) + 1 }; }
