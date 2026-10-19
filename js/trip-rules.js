// trip-rules.js
// The rules of the whole trip, in one place (Ken, 2026-10-18; MASTER.md), so
// every area obeys the same rules and none keeps its own copy. Plain JavaScript,
// no drawing, tested in test/trip.test.mjs. The levels ask this file:
//
//   may Wally go in?            canEnter(trip, area)
//   start a go at an area        startAttempt(trip, area)
//   something found or earned    gain(attempt, item, n)
//   a trade with someone         trade(trip, attempt, give, get)
//   a life lost                  loseLife(attempt)
//   the area done                completeAttempt(trip, attempt, { objectiveMet, mainItem })
//   the attempt failed or left   failAttempt(trip, attempt)
//   how hard this go is          attemptLevel(trip, area), target(total, level), drainFactor(trip, area)
//
// The rules (each one tested):
//   1. Areas go in order. Each has an objective and a main item in its chest;
//      the next area opens only when both are done (completeAttempt refuses otherwise).
//   2. Every area needs the main item of the area before it to enter the first
//      time; after that it is open, to go back to.
//   3. Nothing gained on an attempt is kept until the area is completed: points,
//      finds, trades, everything. A failed attempt keeps nothing, and trades made
//      on it are undone; but what was earned in another area can never be taken:
//      it comes back to Wally ("crocs hide things": it was hidden already).
//   4. Three lives an attempt; with none left the attempt fails, and the player
//      tries the same area again. Nobody is ever sent back to an earlier area.
//   5. Difficulty: easy, intermediate or hard, chosen once. Each return to an
//      area is one level harder than the visit before; past hard, one condition
//      is added per visit. "Collect enough" goals need 50%, 70% or 90% of what
//      the area holds, rounded up. Easy runs the life meters slow.
//
// A trip is a plain object, saved with the rest of the progress:
//   { difficulty, completed: [areas], items: { item: n }, visits: { area: n }, entered: [areas] }

export const ORDER = ['park', 'esplanade', 'reef', 'kuranda', 'mossman', 'daintree'];

// What each area's chest holds (its main item) and what it gives for the areas
// after it. decided: false marks Ken's open questions, so nothing pretends to be settled.
export const CHAIN = {
  park:      { main: 'gate-key',         gives: ['golden-mango'],               decided: true },
  esplanade: { main: 'big-golden-mango', gives: ['golden-mango'],               decided: true },
  reef:      { main: 'skyrail-pass',     gives: ['pearl', 'seashell'],          decided: true },
  kuranda:   { main: 'gorge-pass',       gives: ['gold'],                       decided: false },   // Proposed: the Mossman Gorge shuttle pass, from the bungee
  mossman:   { main: 'boat-ticket',      gives: [],                             decided: false },   // Proposed: the Daintree river-boat ticket
  daintree:  { main: 'finale',           gives: [],                             decided: false },   // the end of the game
};

export const LEVELS = ['easy', 'intermediate', 'hard'];
export const SHARE = { easy: 0.5, intermediate: 0.7, hard: 0.9 };       // of what an area holds, for "collect enough"
export const LIVES = 3;
// Life-meter speed by difficulty. Easy: half speed in areas 1 to 3, then three
// quarters (Ken's example). Hard: 1.25 is a first guess, not yet decided.
const DRAIN = { intermediate: 1, hard: 1.25 };

export function freshTrip(difficulty = 'intermediate') {
  if (!LEVELS.includes(difficulty)) throw new Error(`no such difficulty: ${difficulty}`);
  return { difficulty, completed: [], items: {}, visits: {}, entered: [] };
}

export const areaIndex = area => ORDER.indexOf(area);
export const previousArea = area => ORDER[areaIndex(area) - 1] || null;
export const nextArea = area => ORDER[areaIndex(area) + 1] || null;
export const isCompleted = (trip, area) => trip.completed.includes(area);
export const have = (trip, item) => (trip.items[item] || 0) > 0;

// Rule 2: the main item of the area before, the first time; open after that.
export function canEnter(trip, area) {
  if (areaIndex(area) < 0) return { ok: false, why: 'unknown' };
  if (trip.entered.includes(area) || areaIndex(area) === 0) return { ok: true };
  const before = previousArea(area);
  if (!isCompleted(trip, before)) return { ok: false, why: 'locked', needs: before };
  const item = CHAIN[before].main;
  return have(trip, item) ? { ok: true } : { ok: false, why: 'item', needs: item };
}

// Rule 5: the level for the next visit to an area, and any extra conditions.
export function attemptLevel(trip, area) {
  const visit = (trip.visits[area] || 0) + 1;
  const step = LEVELS.indexOf(trip.difficulty) + (visit - 1);
  return { visit, level: LEVELS[Math.min(step, LEVELS.length - 1)], extras: Math.max(0, step - (LEVELS.length - 1)) };
}

// "Collect enough": the share of what the area holds for this level, rounded up.
export function target(total, level) { return Math.ceil(total * SHARE[level] - 1e-9); }

export function drainFactor(trip, area, level = attemptLevel(trip, area).level) {
  if (level === 'easy') return areaIndex(area) <= 2 ? 0.5 : 0.75;
  return DRAIN[level];
}

// A go at an area. Throws if the rules say Wally may not go in.
export function startAttempt(trip, area) {
  const entry = canEnter(trip, area);
  if (!entry.ok) throw new Error(`cannot enter ${area}: ${entry.why}${entry.needs ? ' ' + entry.needs : ''}`);
  const { visit, level, extras } = attemptLevel(trip, area);
  return { area, visit, level, extras, lives: LIVES, points: 0, pending: {}, spent: {}, over: false };
}

// Rule 3: found on this attempt, kept only if the area is completed.
export function gain(attempt, item, n = 1) {
  if (attempt.over || n <= 0) return attempt;
  return { ...attempt, pending: { ...attempt.pending, [item]: (attempt.pending[item] || 0) + n } };
}
export function addPoints(attempt, n) { return attempt.over ? attempt : { ...attempt, points: attempt.points + n }; }

// How many of an item Wally can use right now: hidden away from other areas,
// less what this attempt has spent, plus what this attempt has found.
export function available(trip, attempt, item) {
  return (trip.items[item] || 0) - (attempt.spent[item] || 0) + (attempt.pending[item] || 0);
}

// A trade: give { item, n }, get { item, n }. What he gives comes from this
// attempt's finds first, then from what he hid in other areas (recorded as
// spent, so a failed attempt can give it back). What he gets is a find of this
// attempt. Refused if he does not have enough.
export function trade(trip, attempt, give, get) {
  if (attempt.over) return { ok: false, why: 'over', attempt };
  if (available(trip, attempt, give.item) < give.n) return { ok: false, why: 'not-enough', attempt };
  const pending = { ...attempt.pending }, spent = { ...attempt.spent };
  const fromHere = Math.min(pending[give.item] || 0, give.n);
  pending[give.item] = (pending[give.item] || 0) - fromHere;
  spent[give.item] = (spent[give.item] || 0) + (give.n - fromHere);
  pending[get.item] = (pending[get.item] || 0) + get.n;
  return { ok: true, attempt: { ...attempt, pending, spent } };
}

// Rule 4: a life lost. out: true when none are left (the attempt has failed).
export function loseLife(attempt) {
  const lives = Math.max(0, attempt.lives - 1);
  return { attempt: { ...attempt, lives }, out: lives === 0 };
}

function visited(trip, area) {
  return { ...trip, visits: { ...trip.visits, [area]: (trip.visits[area] || 0) + 1 },
           entered: trip.entered.includes(area) ? trip.entered : [...trip.entered, area] };
}

// Rule 1 and 3: the area done. Refused unless the objective is met and the
// area's main item has been found on this attempt (or was found before, on a
// return visit). Then everything from the attempt is kept.
export function completeAttempt(trip, attempt, { objectiveMet = false } = {}) {
  if (attempt.over) return { ok: false, why: 'over', trip };
  const main = CHAIN[attempt.area].main;
  if (!objectiveMet) return { ok: false, why: 'objective', trip };
  if (!(attempt.pending[main] > 0) && !have(trip, main)) return { ok: false, why: 'main-item', needs: main, trip };
  const items = { ...trip.items };
  for (const [k, n] of Object.entries(attempt.spent)) items[k] = (items[k] || 0) - n;
  for (const [k, n] of Object.entries(attempt.pending)) items[k] = (items[k] || 0) + n;
  for (const k of Object.keys(items)) if (items[k] <= 0) delete items[k];
  const t = visited(trip, attempt.area);
  return { ok: true, trip: { ...t, items, completed: t.completed.includes(attempt.area) ? t.completed : [...t.completed, attempt.area] },
           points: attempt.points };
}

// Rule 3 and 4: the attempt failed (out of lives) or he left partway. Nothing
// from it is kept; what was spent from other areas is simply never taken, so
// it is all still there. A failed attempt is not a visit: trying again is at
// the same level (only a completed visit makes the next return harder), so
// failing is never punished twice. He has been in, though, so the area stays open.
export function failAttempt(trip, attempt) {
  const entered = trip.entered.includes(attempt.area) ? trip.entered : [...trip.entered, attempt.area];
  return { trip: { ...trip, entered }, attempt: { ...attempt, over: true } };
}
