// Tests for js/trip-rules.js: each rule of the trip, and attempts to break it.
// Run:  node test/trip.test.mjs

import * as T from '../js/trip-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}
const throws = f => { try { f(); return false; } catch { return true; } };

// Play an area to the end: find its main item, meet the objective, complete.
function clear(trip, area, finds = {}) {
  let a = T.startAttempt(trip, area);
  a = T.gain(a, T.CHAIN[area].main);
  for (const [k, n] of Object.entries(finds)) a = T.gain(a, k, n);
  const r = T.completeAttempt(trip, a, { objectiveMet: true });
  if (!r.ok) throw new Error(`could not clear ${area}: ${r.why}`);
  return r.trip;
}

// ---- The chain ---------------------------------------------------------------------------
check('six areas, in Ken\'s order', T.ORDER.join() === 'park,esplanade,reef,kuranda,mossman,daintree');
check('every area has a main item', T.ORDER.every(a => T.CHAIN[a] && T.CHAIN[a].main));
check('no two areas share a main item', new Set(T.ORDER.map(a => T.CHAIN[a].main)).size === T.ORDER.length);
check('open questions are marked undecided', !T.CHAIN.kuranda.decided && !T.CHAIN.mossman.decided && T.CHAIN.reef.decided);

// ---- Rule 2: entry -----------------------------------------------------------------------
let trip = T.freshTrip();
check('the park is open from the start', T.canEnter(trip, 'park').ok);
check('the Esplanade is locked before the park is done', !T.canEnter(trip, 'esplanade').ok && T.canEnter(trip, 'esplanade').why === 'locked');
check('starting a locked area is refused', throws(() => T.startAttempt(trip, 'esplanade')));
check('an unknown area is refused', !T.canEnter(trip, 'narnia').ok);
check('no skipping ahead: the reef is locked too', !T.canEnter(trip, 'reef').ok);
trip = clear(trip, 'park');
check('with the gate key, the Esplanade opens', T.canEnter(trip, 'esplanade').ok);
{ // Completed the park but somehow without the key: still locked.
  const noKey = { ...trip, items: {} };
  const e = T.canEnter(noKey, 'esplanade');
  check('without the gate key the Esplanade stays locked', !e.ok && e.why === 'item' && e.needs === 'gate-key');
}

// ---- Rule 1: completing needs the objective and the main item ----------------------------
{
  const a = T.startAttempt(trip, 'esplanade');
  check('objective not met: refused', T.completeAttempt(trip, a, { objectiveMet: false }).why === 'objective');
  const r = T.completeAttempt(trip, a, { objectiveMet: true });
  check('main item not found: refused, and says which', !r.ok && r.why === 'main-item' && r.needs === 'big-golden-mango');
  check('a refused completion changes nothing', !T.isCompleted(r.trip, 'esplanade') && r.trip === trip);
}
trip = clear(trip, 'esplanade', { 'golden-mango': 30 });
check('Esplanade done: the reef opens', T.canEnter(trip, 'reef').ok);
check('its finds are kept', trip.items['golden-mango'] === 30 && T.have(trip, 'big-golden-mango'));

// ---- Rule 3: keep only on completion ------------------------------------------------------
{
  let a = T.startAttempt(trip, 'reef');
  a = T.gain(a, 'pearl', 4); a = T.gain(a, 'seashell', 6); a = T.addPoints(a, 120);
  const f = T.failAttempt(trip, a);
  check('a failed attempt keeps no finds', !f.trip.items.pearl && !f.trip.items.seashell);
  check('a failed attempt keeps no points (none are returned)', !('points' in f));
  check('a failed attempt does not complete the area', !T.isCompleted(f.trip, 'reef'));
  check('earlier areas\' things are untouched', f.trip.items['golden-mango'] === 30 && T.have(f.trip, 'big-golden-mango'));
  check('after failing, gaining more does nothing', T.gain(f.attempt, 'pearl', 9) === f.attempt);
}

// ---- Rule 3: trades are undone on failure, but other areas' things come back -------------
{
  // At the reef: the Big Golden Mango (from the Esplanade) paid to the clam for the pearl key.
  let a = T.startAttempt(trip, 'reef');
  const t1 = T.trade(trip, a, { item: 'big-golden-mango', n: 1 }, { item: 'pearl-key', n: 1 });
  check('the clam trade goes through', t1.ok && T.available(trip, t1.attempt, 'pearl-key') === 1 && T.available(trip, t1.attempt, 'big-golden-mango') === 0);
  check('a second Big Golden Mango cannot be paid (he has one)', !T.trade(trip, t1.attempt, { item: 'big-golden-mango', n: 1 }, { item: 'x', n: 1 }).ok);
  const f = T.failAttempt(trip, t1.attempt);
  check('failing undoes the trade: no pearl key kept', !T.have(f.trip, 'pearl-key'));
  check('failing gives the Big Golden Mango back (earned in another area)', T.have(f.trip, 'big-golden-mango'));
}
{
  // Finds from this attempt traded away, then failure: nothing from it survives.
  let a = T.startAttempt(trip, 'reef');
  a = T.gain(a, 'seashell', 5);
  const t = T.trade(trip, a, { item: 'seashell', n: 3 }, { item: 'souvenir', n: 1 });
  check('trading uses this attempt\'s finds first', t.ok && !t.attempt.spent.seashell && t.attempt.pending.seashell === 2);
  const f = T.failAttempt(trip, t.attempt);
  check('...and failing keeps neither the shells nor the souvenir', !f.trip.items.seashell && !f.trip.items.souvenir);
}
{
  const r = T.trade(trip, T.startAttempt(trip, 'reef'), { item: 'golden-mango', n: 31 }, { item: 'x', n: 1 });
  check('a trade for more than he has is refused', !r.ok && r.why === 'not-enough');
}
{
  // Completing keeps the trade's result and spends what was given.
  let a = T.startAttempt(trip, 'reef');
  a = T.trade(trip, a, { item: 'big-golden-mango', n: 1 }, { item: 'pearl-key', n: 1 }).attempt;
  a = T.gain(a, 'skyrail-pass'); a = T.gain(a, 'seashell', 6);
  const r = T.completeAttempt(trip, a, { objectiveMet: true });
  check('completing keeps the pearl key, the pass and the shells', r.ok && T.have(r.trip, 'pearl-key') && T.have(r.trip, 'skyrail-pass') && r.trip.items.seashell === 6);
  check('...and the Big Golden Mango is spent', !T.have(r.trip, 'big-golden-mango'));
  trip = r.trip;
}

// ---- Rule 2: once entered, open to go back to (and no item needed again) -----------------
check('the reef, once entered, stays open without the Big Golden Mango', T.canEnter(trip, 'reef').ok);
check('Kuranda opens with the Skyrail pass', T.canEnter(trip, 'kuranda').ok);

// ---- Rule 4: lives ------------------------------------------------------------------------
{
  let a = T.startAttempt(trip, 'kuranda'), out = false;
  check('three lives an attempt', a.lives === T.LIVES && T.LIVES === 3);
  for (let i = 0; i < 3; i++) ({ attempt: a, out } = T.loseLife(a));
  check('the third life lost ends the attempt', out && a.lives === 0);
  check('lives never go below zero', T.loseLife(a).attempt.lives === 0);
  const f = T.failAttempt(trip, a);
  check('out of lives: try the same area again (it stays open)', T.canEnter(f.trip, 'kuranda').ok);
  check('nobody is sent back: earlier areas stay completed', ['park', 'esplanade', 'reef'].every(x => T.isCompleted(f.trip, x)));
}

// ---- Rule 5: difficulty -------------------------------------------------------------------
check('an unknown difficulty is refused', throws(() => T.freshTrip('nightmare')));
{
  let e = T.freshTrip('easy');
  check('first visit on easy is easy', T.attemptLevel(e, 'park').level === 'easy');
  e = clear(e, 'park');
  check('second visit is one level up', T.attemptLevel(e, 'park').level === 'intermediate');
  e = clear(e, 'park');
  check('third visit is hard', T.attemptLevel(e, 'park').level === 'hard' && T.attemptLevel(e, 'park').extras === 0);
  e = clear(e, 'park');
  check('past hard, one condition is added per visit', T.attemptLevel(e, 'park').level === 'hard' && T.attemptLevel(e, 'park').extras === 1);
  check('each area counts its own visits', T.attemptLevel(e, 'esplanade').visit === 1 && T.attemptLevel(e, 'esplanade').level === 'easy');
  let f = T.freshTrip('easy');
  const failed1 = T.failAttempt(f, T.startAttempt(f, 'park')).trip;
  check('a failed attempt does not make the next try harder', T.attemptLevel(failed1, 'park').level === 'easy');
  const h = T.freshTrip('hard');
  check('starting on hard: the first visit is hard', T.attemptLevel(h, 'park').level === 'hard' && T.attemptLevel(h, 'park').extras === 0);
}
check('targets: 50% on easy, rounded up', T.target(9, 'easy') === 5 && T.target(10, 'easy') === 5);
check('targets: 70% on intermediate, rounded up', T.target(8, 'intermediate') === 6 && T.target(10, 'intermediate') === 7);
check('targets: 90% on hard, rounded up', T.target(8, 'hard') === 8 && T.target(10, 'hard') === 9 && T.target(60, 'hard') === 54);
check('a target is never more than what there is', [1, 3, 8, 13, 60].every(n => T.LEVELS.every(l => T.target(n, l) <= n && T.target(n, l) >= 1)));
{
  const e = T.freshTrip('easy');
  check('easy: half-speed meters in the first three areas', ['park', 'esplanade', 'reef'].every(a => T.drainFactor(e, a) === 0.5));
  check('easy: three-quarter speed after that', T.drainFactor(e, 'kuranda') === 0.75);
  check('intermediate: the game as it plays now', T.drainFactor(T.freshTrip('intermediate'), 'park') === 1);
  check('hard: faster', T.drainFactor(T.freshTrip('hard'), 'park') > 1);
}

// ---- The whole trip, start to finish ------------------------------------------------------
{
  let t = T.freshTrip('intermediate');
  for (const a of T.ORDER) t = clear(t, a);
  check('the whole trip can be completed, area by area', T.ORDER.every(a => T.isCompleted(t, a)));
  check('the trip never skipped: each needed the one before', T.ORDER.slice(1).every(a => T.isCompleted(t, T.previousArea(a))));
}
check('the rules do not change a trip in place', (() => { const t = T.freshTrip(); const a = T.startAttempt(t, 'park'); T.completeAttempt(t, T.gain(a, 'gate-key'), { objectiveMet: true }); return t.completed.length === 0 && !t.items['gate-key']; })());

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
