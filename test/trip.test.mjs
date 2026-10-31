// Tests for js/trip-rules.js: each rule of the trip, and attempts to break it.
// Run:  node test/trip.test.mjs

import * as T from '../js/trip-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}
const throws = f => { try { f(); return false; } catch { return true; } };

// Play an area to the end: find what it opens, meet the objective, complete.
function clear(trip, area, finds = {}) {
  let a = T.startAttempt(trip, area);
  for (const item of T.CHAIN[area].opens) a = T.gain(a, item);
  for (const [k, n] of Object.entries(finds)) a = T.gain(a, k, n);
  const r = T.completeAttempt(trip, a, { objectiveMet: true });
  if (!r.ok) throw new Error(`could not clear ${area}: ${r.why} ${r.needs || ''}`);
  return r.trip;
}

// ---- The chain ---------------------------------------------------------------------------
check('seven areas, in Ken\'s order', T.ORDER.join() === 'park,cane,esplanade,reef,kuranda,mossman,daintree');
check('seven is the limit', T.ORDER.length === 7);
check('six talismans, one per sceptre setting', T.TALISMANS.length === 6 && new Set(T.TALISMANS).size === 6);
check('the four elements and the sun and moon', ['sun', 'moon', 'air', 'earth', 'water', 'fire'].every(e => T.TALISMANS.includes(`talisman-${e}`)));
check('every area but the last opens something', T.ORDER.slice(0, -1).every(a => T.CHAIN[a].opens.length > 0));
check('Croc Park opens the machete, not a talisman', T.CHAIN.park.opens.join() === 'machete');
check('the cane fields: the machete is the key, the fire talisman what it opens',
  T.CHAIN.cane.key === 'machete' && T.CHAIN.cane.opens.join() === 'talisman-fire');
check('Kuranda opens two talismans, air and water', T.CHAIN.kuranda.opens.join() === 'talisman-air,talisman-water');
check('every talisman comes from exactly one area', T.TALISMANS.every(t => T.ORDER.filter(a => T.CHAIN[a].opens.includes(t)).length === 1));
check('no key is a talisman (keys are just keys)', T.ORDER.every(a => !T.TALISMANS.includes(T.CHAIN[a].key)));
check('the Daintree needs all six talismans', T.CHAIN.daintree.needsAll.join() === T.TALISMANS.join());
check('open questions are marked undecided', !T.CHAIN.esplanade.decided && !T.CHAIN.kuranda.decided && T.CHAIN.mossman.decided && T.CHAIN.park.decided);
check('Mossman: the key, then the opal (the earth talisman)', T.CHAIN.mossman.key === 'mossman-key' && T.CHAIN.mossman.opens.join() === 'talisman-earth');
check('the Fibonacci small thing: golden mangoes from the Esplanade, none from the park', T.CHAIN.esplanade.small === 'golden-mango' && T.CHAIN.park.small === null);

// ---- Areas not built yet are passed over -------------------------------------------------
check('the cane fields are built: on the trip', !T.NOT_BUILT.includes('cane'));
check('...so the Esplanade asks the cane fields', T.areaBefore('esplanade') === 'cane');
check('every area is built now: the Daintree is the last stop', T.NOT_BUILT.length === 0);
check('the reef asks the Esplanade', T.areaBefore('reef') === 'esplanade');
check('the first area has nothing before it', T.areaBefore('park') === null);
{
  // The small thing is counted two areas back in the trip, not two built areas back.
  const t = { ...T.freshTrip(), completed: ['park', 'cane', 'esplanade'], entered: ['park', 'cane', 'esplanade'], items: { machete: 1, 'talisman-fire': 1, 'talisman-sun': 1 } };
  check('the reef does not ask for Croc Park\'s golden mangoes (they are for the Esplanade)',T.canEnter(t, 'reef').ok);
  const noMango = { ...T.freshTrip(), completed: ['park', 'cane'], entered: ['park', 'cane'], items: { machete: 1, 'talisman-fire': 1 } };
  check('missing every golden mango in Croc Park never locks the Esplanade (a bonus, not a lock)', T.canEnter(noMango, 'esplanade').ok);
}

// ---- Rule 2: entry -----------------------------------------------------------------------
let trip = T.freshTrip();
check('the park is open from the start', T.canEnter(trip, 'park').ok);
check('the Esplanade is locked before the park is done', !T.canEnter(trip, 'esplanade').ok && T.canEnter(trip, 'esplanade').why === 'locked');
check('starting a locked area is refused', throws(() => T.startAttempt(trip, 'esplanade')));
check('an unknown area is refused', !T.canEnter(trip, 'narnia').ok);
check('no skipping ahead: the reef is locked too', !T.canEnter(trip, 'reef').ok);
trip = clear(trip, 'park', { 'golden-mango': 8, 'park-key': 1 });
check('with the machete, the cane fields open', T.canEnter(trip, 'cane').ok);
check('...but not the Esplanade: the cane fields come first', !T.canEnter(trip, 'esplanade').ok && T.canEnter(trip, 'esplanade').needs === 'cane');
{ // Completed the park but somehow without the machete: still locked.
  const noMachete = { ...trip, items: {} };
  const e = T.canEnter(noMachete, 'cane');
  check('without the machete the cane fields stay locked, and say why', !e.ok && e.why === 'item' && e.needs === 'machete');
}
trip = clear(trip, 'cane');
check("with the fire talisman (and Croc Park's golden mangoes), the Esplanade opens", T.canEnter(trip, 'esplanade').ok);
{
  const noFire = { ...trip, items: { ...trip.items } }; delete noFire.items['talisman-fire'];
  check('without the fire talisman the Esplanade stays locked', T.canEnter(noFire, 'esplanade').needs === 'talisman-fire');
}

// ---- Rule 1: completing needs the objective and what the area opens ----------------------
{
  const a = T.startAttempt(trip, 'esplanade');
  check('objective not met: refused', T.completeAttempt(trip, a, { objectiveMet: false }).why === 'objective');
  const r = T.completeAttempt(trip, a, { objectiveMet: true });
  check('talisman not found: refused, and says which', !r.ok && r.why === 'item' && r.needs === 'talisman-sun');
  check('a refused completion changes nothing', !T.isCompleted(r.trip, 'esplanade') && r.trip === trip);
  const keyOnly = T.completeAttempt(trip, T.gain(a, 'park-key'), { objectiveMet: true });
  check('a key alone does not complete an area', !keyOnly.ok);
}
trip = clear(trip, 'esplanade', { 'golden-mango': 30, 'big-golden-mango': 1 });
check('Esplanade done: the reef opens', T.canEnter(trip, 'reef').ok);
check('its finds are kept', trip.items['golden-mango'] === 38 && T.have(trip, 'big-golden-mango') && T.have(trip, 'talisman-sun'));
check('the sceptre so far: fire and sun', T.sceptre(trip).join() === 'talisman-sun,talisman-fire');

// ---- Rule 3: keep only on completion ------------------------------------------------------
{
  let a = T.startAttempt(trip, 'reef');
  a = T.gain(a, 'pearl', 4); a = T.gain(a, 'seashell', 6); a = T.gain(a, 'talisman-moon'); a = T.addPoints(a, 120);
  const f = T.failAttempt(trip, a);
  check('a failed attempt keeps no finds', !f.trip.items.pearl && !f.trip.items.seashell);
  check('a failed attempt keeps no talisman', !T.have(f.trip, 'talisman-moon'));
  check('a failed attempt keeps no points (none are returned)', !('points' in f));
  check('a failed attempt does not complete the area', !T.isCompleted(f.trip, 'reef'));
  check('earlier areas\' things are untouched', f.trip.items['golden-mango'] === 38 && T.have(f.trip, 'big-golden-mango') && T.have(f.trip, 'talisman-sun'));
  check('after failing, gaining more does nothing', T.gain(f.attempt, 'pearl', 9) === f.attempt);
}

// ---- Rule 3: trades are undone on failure, but other areas' things come back -------------
{
  // At the reef: the Big Golden Mango (a trade item from the Esplanade) paid to the clam for the pearl key.
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
  const r = T.trade(trip, T.startAttempt(trip, 'reef'), { item: 'golden-mango', n: 39 }, { item: 'x', n: 1 });
  check('a trade for more than he has is refused', !r.ok && r.why === 'not-enough');
}
{
  // Completing keeps the trade's result and spends what was given.
  let a = T.startAttempt(trip, 'reef');
  a = T.trade(trip, a, { item: 'big-golden-mango', n: 1 }, { item: 'pearl-key', n: 1 }).attempt;
  a = T.gain(a, 'talisman-moon'); a = T.gain(a, 'skyrail-pass'); a = T.gain(a, 'seashell', 6);
  const r = T.completeAttempt(trip, a, { objectiveMet: true });
  check('completing keeps the pearl key, the moon talisman and the shells', r.ok && T.have(r.trip, 'pearl-key') && T.have(r.trip, 'talisman-moon') && r.trip.items.seashell === 6);
  check('...and the Big Golden Mango is spent', !T.have(r.trip, 'big-golden-mango'));
  trip = r.trip;
}

// ---- Rule 2: once entered, open to go back to (and no item needed again) -----------------
check('the reef, once entered, stays open without the Big Golden Mango', T.canEnter(trip, 'reef').ok);
check('Kuranda opens with the moon talisman', T.canEnter(trip, 'kuranda').ok);
{
  const noMoon = { ...trip, items: { ...trip.items } }; delete noMoon.items['talisman-moon'];
  check('...and not without it', T.canEnter(noMoon, 'kuranda').needs === 'talisman-moon');
}

// ---- Kuranda: both talismans (Ken, for consistency) ---------------------------------------
{
  let a = T.startAttempt(trip, 'kuranda');
  a = T.gain(a, 'talisman-air');
  const r = T.completeAttempt(trip, a, { objectiveMet: true });
  check('Kuranda with only the air talisman is not done', !r.ok && r.needs === 'talisman-water');
}

// ---- Rule 2: the Fibonacci small thing from two areas back --------------------------------
{
  // Built in full (nothing passed over), the Esplanade needs the fire talisman from the cane
  // fields and golden mangoes from Croc Park. Simulated by entering the cane fields directly.
  let t = clear(T.freshTrip(), 'park', { 'golden-mango': 3 });
  const viaCane = { ...t, entered: [...t.entered, 'cane'] };
  check('the cane fields open with the machete', T.canEnter(t, 'cane').ok);
  check('the cane fields need the machete', T.canEnter({ ...t, items: {} }, 'cane').needs === 'machete');
  let a = T.startAttempt(viaCane, 'cane');
  a = T.gain(a, 'talisman-fire');
  const done = T.completeAttempt(viaCane, a, { objectiveMet: true });
  check('the cane fields completed with the fire talisman', done.ok && T.have(done.trip, 'talisman-fire'));
}

// ---- Rule 4: lives ------------------------------------------------------------------------
{
  let a = T.startAttempt(trip, 'kuranda'), out = false;
  check('three lives an attempt', a.lives === T.LIVES && T.LIVES === 3);
  for (let i = 0; i < 3; i++) ({ attempt: a, out } = T.loseLife(a));
  check('the third life lost ends the attempt', out && a.lives === 0);
  check('lives never go below zero', T.loseLife(a).attempt.lives === 0);
  const f = T.failAttempt(trip, a);
  check('out of lives: try the same area again (it stays open)', T.canEnter(f.trip, 'kuranda').ok);
  check('nobody is sent back: earlier areas stay completed', ['park', 'cane', 'esplanade', 'reef'].every(x => T.isCompleted(f.trip, x)));
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
  check('easy: half-speed meters in the first three areas', ['park', 'cane', 'esplanade'].every(a => T.drainFactor(e, a) === 0.5));
  check('easy: three-quarter speed after that', T.drainFactor(e, 'reef') === 0.75 && T.drainFactor(e, 'kuranda') === 0.75);
  check('intermediate: the game as it plays now', T.drainFactor(T.freshTrip('intermediate'), 'park') === 1);
  check('hard: faster', T.drainFactor(T.freshTrip('hard'), 'park') > 1);
}

// ---- Rule 6: the sceptre ------------------------------------------------------------------
{
  check('a fresh trip has an empty sceptre', T.sceptre(T.freshTrip()).length === 0);
  check('the sceptre holds what has been won, in the settings\' order', T.sceptre(trip).join() === 'talisman-sun,talisman-moon,talisman-fire');
  const five = { ...T.freshTrip(), entered: ['daintree'], items: Object.fromEntries(T.TALISMANS.slice(0, 5).map(t => [t, 1])) };
  const r = T.completeAttempt(five, T.startAttempt(five, 'daintree'), { objectiveMet: true });
  check('the King needs all six: five is refused, and says which is missing', !r.ok && r.needs === 'talisman-fire');
}

// ---- The whole trip, start to finish ------------------------------------------------------
{
  // Every area played in full, as if all were built: entered in order, each opening the next.
  let t = T.freshTrip('intermediate');
  for (const a of T.ORDER) { t = { ...t, entered: t.entered.includes(a) ? t.entered : [...t.entered, a] }; t = clear(t, a); }
  check('the whole trip can be completed, area by area', T.ORDER.every(a => T.isCompleted(t, a)));
  check('at the end the sceptre is full', T.sceptre(t).length === 6);
}
{
  // Only what is built today, through the rules with nothing forced.
  let t = T.freshTrip('intermediate');
  for (const a of T.ORDER.filter(x => !T.NOT_BUILT.includes(x))) {
    check(`today's game: ${a} can be entered in turn`, T.canEnter(t, a).ok, JSON.stringify(T.canEnter(t, a)));
    t = clear(t, a, a === 'park' ? { 'golden-mango': 8 } : {});   // (Croc Park's golden mangoes open the Esplanade, two on)
  }
}
check('the rules do not change a trip in place', (() => { const t = T.freshTrip(); const a = T.startAttempt(t, 'park'); T.completeAttempt(t, T.gain(a, 'machete'), { objectiveMet: true }); return t.completed.length === 0 && !t.items.machete; })());

// ---- Saved trips ---------------------------------------------------------------------------
check('no saved trip reads as none', T.readTrip(undefined) === null && T.readTrip({}) === null);
check('a trip with a made-up difficulty is refused', T.readTrip({ difficulty: 'nightmare' }) === null);
{
  const r = T.readTrip({ difficulty: 'easy', completed: ['park', 'narnia'], items: { machete: 1, bad: -2, junk: 'x' }, visits: { park: 1 }, entered: ['park'] });
  check('a saved trip keeps real areas and counts only', r.completed.join() === 'park' && r.items.machete === 1 && !('bad' in r.items) && !('junk' in r.items));
}
{
  const t = T.tripFromProgress({ postcards: ['park', 'esplanade'], stars: { reef: 2 } });
  check('an old save carries over: finished areas stay finished', ['park', 'esplanade', 'reef'].every(a => T.isCompleted(t, a)));
  check('...with what they open, so the next area opens', T.canEnter(t, 'kuranda').ok && T.have(t, 'talisman-moon'));
  check('...and the cane fields are not forced on them (the Esplanade, once entered, stays open)', !T.isCompleted(t, 'cane') && T.canEnter(t, 'esplanade').ok);
  check('...at intermediate', t.difficulty === 'intermediate');
  check('a brand-new save carries over as an empty trip', T.tripFromProgress({}).completed.length === 0);
}
{
  // A trip saved under the old six-area rules (main items) still reads, and nobody is locked out.
  const old = T.readTrip({ difficulty: 'intermediate', completed: ['park', 'esplanade'], entered: ['park', 'esplanade'], items: { 'gate-key': 1, 'big-golden-mango': 1 }, visits: { park: 1, esplanade: 1 } });
  check('an old trip keeps its areas', T.isCompleted(old, 'esplanade') && T.canEnter(old, 'esplanade').ok);
}

check('tripFor: a save with its own trip keeps it', (() => { const t = T.freshTrip('hard'); return T.tripFor({ trip: t }) === t; })());
check('tripFor: an old save is carried over', T.isCompleted(T.tripFor({ postcards: ['park'] }), 'park'));
check('tripFor: a new player gets a fresh trip', T.tripFor({}).completed.length === 0 && T.tripFor({}).difficulty === 'intermediate');
check('forcing a locked area is for testing only: it works but changes no rules', (() => { const t = T.freshTrip(); const a = T.startAttempt(t, 'reef', { force: true }); return a.area === 'reef' && !T.canEnter(t, 'reef').ok; })());

// ---- The whole trip can always be walked: complete an area and the next one opens -------------
{
  let trip = T.tripFor({});
  const order = T.ORDER, broken = [];
  for (let i = 0; i < order.length; i++) {
    const area = order[i];
    if (!T.canEnter(trip, area).ok) { broken.push(`${area} locked`); break; }
    let a = T.startAttempt(trip, area);
    const link = T.CHAIN[area];
    for (const item of [...(link.key ? [link.key] : []), ...link.opens]) a = T.gain(a, item);
    const done = T.completeAttempt(trip, a, { objectiveMet: true });
    if (!done.ok) { broken.push(`${area} would not complete: ${done.why} ${done.needs || ''}`); break; }
    trip = done.trip;
  }
  check('playing the trip in order, every area opens once the one before is completed', broken.length === 0, broken.join('; '));
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
