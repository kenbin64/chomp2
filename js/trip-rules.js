// trip-rules.js
// The rules of the whole trip, in one place (Ken, 2026-10-18; MASTER.md), so
// every area obeys the same rules and none keeps its own copy. Plain JavaScript,
// no drawing, tested in test/trip.test.mjs. The levels ask this file:
//
//   may Wally go in?            canEnter(trip, area)
//   talismans in the sceptre     sceptre(trip)
//   start a go at an area        startAttempt(trip, area)
//   something found or earned    gain(attempt, item, n)
//   a trade with someone         trade(trip, attempt, give, get)
//   a life lost                  loseLife(attempt)
//   the area done                completeAttempt(trip, attempt, { objectiveMet })
//   the attempt failed or left   failAttempt(trip, attempt)
//   how hard this go is          attemptLevel(trip, area), target(total, level), drainFactor(trip, area)
//
// The rules (each one tested):
//   1. Seven areas, in order, and no more (Ken: seven is the limit, on purpose).
//      Each quest has two parts: find the key, then the chest with the talisman.
//      An area is completed only with its objective met and what it opens in hand
//      (completeAttempt refuses otherwise).
//   2. To enter an area the first time, Wally needs what the area before it
//      opens (Croc Park: the machete; the cane fields: the fire talisman; and so
//      on), plus, where Ken has decided it, a smaller thing from two areas back
//      (Fibonacci: two roots). After that it is open, to go back to.
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
//   6. The six talismans go into the King's sceptre; the Daintree (the King) is
//      completed only with all six.
//
// A trip is a plain object, saved with the rest of the progress:
//   { difficulty, completed: [areas], items: { item: n }, visits: { area: n }, entered: [areas] }

export const ORDER = ['park', 'cane', 'esplanade', 'reef', 'kuranda', 'mossman', 'daintree'];

// The six talismans, one per setting of the King's sceptre: heaven above (sun,
// moon, air), earth below (earth, water, fire).
export const TALISMANS = ['talisman-sun', 'talisman-moon', 'talisman-air', 'talisman-earth', 'talisman-water', 'talisman-fire'];

// Each area: key, found there, opens its chest (the level checks it); opens,
// what completing the area needs and what the next area needs to come in;
// small, the smaller thing it gives for the area two after it (Fibonacci).
// decided: false marks Ken's open questions, so nothing pretends to be settled.
export const CHAIN = {
  park:      { key: 'park-key',  opens: ['machete'],                      small: 'golden-mango', decided: true },
  cane:      { key: 'machete',   opens: ['talisman-fire'],                small: null,           decided: true },
  esplanade: { key: null,        opens: ['talisman-sun'],                 small: null,           decided: false },  // its key: open
  reef:      { key: 'pearl-key', opens: ['talisman-moon'],                small: null,           decided: true },
  kuranda:   { key: null,        opens: ['talisman-air', 'talisman-water'], small: null,         decided: false },  // the boomerang and the zip line
  mossman:   { key: 'mossman-key', opens: ['talisman-earth'],             small: null,           decided: true },   // the opal, in the last swimming hole
  daintree:  { key: null,        opens: [],                               small: null,           decided: true, needsAll: TALISMANS },  // the King
};

// Areas not built yet are passed over, so the game stays playable while they are
// made: the area after one asks the area before it instead. Remove an area from
// this list the day its level is playable.
export const NOT_BUILT = ['daintree'];

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

// A saved trip, checked: anything missing or broken comes back as null (no trip yet).
export function readTrip(t) {
  if (!t || typeof t !== 'object' || !LEVELS.includes(t.difficulty)) return null;
  const areas = list => Array.isArray(list) ? list.filter(a => ORDER.includes(a)) : [];
  const counts = o => o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([, n]) => Number.isFinite(n) && n > 0)) : {};
  return { difficulty: t.difficulty, completed: areas(t.completed), items: counts(t.items), visits: counts(t.visits), entered: areas(t.entered) };
}

// A save from before these rules: the areas already finished (their postcards)
// count as completed and entered, with what they open, at intermediate, so
// nobody who has played is locked out of where they have been.
export function tripFromProgress(progress) {
  const done = ORDER.filter(a => (progress.postcards || []).includes(a) || ((progress.stars || {})[a] || 0) > 0);
  const trip = freshTrip('intermediate');
  for (const a of done) {
    trip.completed.push(a); trip.entered.push(a); trip.visits[a] = 1;
    for (const item of CHAIN[a].opens) trip.items[item] = 1;
  }
  return trip;
}

// The trip for a saved progress: its own, or one carried over from before the
// rules, or a fresh one (intermediate) for a player who has not chosen yet.
export function tripFor(progress) {
  if (progress.trip) return progress.trip;
  const played = (progress.postcards || []).length || Object.keys(progress.stars || {}).length;
  return played ? tripFromProgress(progress) : freshTrip('intermediate');
}

export const areaIndex = area => ORDER.indexOf(area);
export const previousArea = area => ORDER[areaIndex(area) - 1] || null;
export const nextArea = area => ORDER[areaIndex(area) + 1] || null;
export const isCompleted = (trip, area) => trip.completed.includes(area);
export const have = (trip, item) => (trip.items[item] || 0) > 0;

// The nearest area before this one that is built (rule 2 passes over the rest).
export function areaBefore(area) {
  for (let i = areaIndex(area) - 1; i >= 0; i--) if (!NOT_BUILT.includes(ORDER[i])) return ORDER[i];
  return null;
}

// Rule 2: what the area before opens, and the small thing from two back, the
// first time; open after that.
export function canEnter(trip, area) {
  if (areaIndex(area) < 0) return { ok: false, why: 'unknown' };
  if (trip.entered.includes(area) || areaIndex(area) === 0) return { ok: true };
  const before = areaBefore(area);
  if (!before) return { ok: true };
  if (!isCompleted(trip, before)) return { ok: false, why: 'locked', needs: before };
  const missing = CHAIN[before].opens.find(item => !have(trip, item));
  if (missing) return { ok: false, why: 'item', needs: missing };
  // Two areas back in the trip itself (not counting only built ones: the small
  // thing is meant for the area two after it); an area not built gives nothing yet.
  const twoBack = ORDER[areaIndex(area) - 2];
  const small = twoBack && !NOT_BUILT.includes(twoBack) && CHAIN[twoBack].small;
  if (small && !have(trip, small)) return { ok: false, why: 'item', needs: small };
  return { ok: true };
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

// A go at an area. Throws if the rules say Wally may not go in, unless forced
// (testing only: the ?all address that opens every area).
export function startAttempt(trip, area, { force = false } = {}) {
  const entry = canEnter(trip, area);
  if (!entry.ok && !force) throw new Error(`cannot enter ${area}: ${entry.why}${entry.needs ? ' ' + entry.needs : ''}`);
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

// Rules 1, 3 and 6: the area done. Refused unless the objective is met and
// everything the area opens has been found, on this attempt or before (a
// return visit); the Daintree also needs all six talismans. Then everything
// from the attempt is kept.
export function completeAttempt(trip, attempt, { objectiveMet = false } = {}) {
  if (attempt.over) return { ok: false, why: 'over', trip };
  if (!objectiveMet) return { ok: false, why: 'objective', trip };
  const link = CHAIN[attempt.area];
  const held = item => attempt.pending[item] > 0 || have(trip, item);
  const missing = [...link.opens, ...(link.needsAll || [])].find(item => !held(item));
  if (missing) return { ok: false, why: 'item', needs: missing, trip };
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

// Rule 6: the talismans set in the sceptre so far, in the settings' order.
export function sceptre(trip) { return TALISMANS.filter(t => have(trip, t)); }
