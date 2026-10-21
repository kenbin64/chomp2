// Tests for js/points-rules.js: the trip's points and the personal best.
// Run:  node test/points.test.mjs

import * as P from '../js/points-rules.js';
import { LEVELS, validScore, MAX_SCORE } from '../js/leaderboard-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

check("Ken's values: ground 1, air 2, a pickup 1, a talisman 3", P.POINTS.ground === 1 && P.POINTS.air === 2 && P.POINTS.pickup === 1 && P.POINTS.talisman === 3);
{
  let run = P.freshRun('park', 'easy'), g;
  ({ run } = P.award(run, 'ground')); ({ run } = P.award(run, 'air')); ({ run, gained: g } = P.award(run, 'pickup', 4));
  check('a run adds its points up', run.pts === 1 + 2 + 4, String(run.pts));
  check('and counts each kind', run.counts.pickup === 4 && run.counts.air === 1);
  check('an unknown kind or a bad count gives nothing', P.award(run, 'cheat').gained === 0 && P.award(run, 'air', -3).gained === 0 && P.award(run, 'air', NaN).gained === 0);
  check('awarding never changes the run passed in', P.award(run, 'air').run !== run && run.pts === 7);
}
{
  const run = { ...P.freshRun('cane', 'easy'), pts: 20 };
  const a = P.bank(P.freshBook(), run, { stars: 2 });
  check('banking adds the completion and the stars', a.total === 20 + P.POINTS.area + 2 * P.POINTS.star, String(a.total));
  check('the first completion is a new best for the area and the trip', a.newAreaBest && a.newBest && a.book.best === a.trip);
  const worse = P.bank(a.book, { ...run, pts: 5 }, { stars: 1 });
  check('a worse redo changes nothing (no farming)', !worse.newAreaBest && worse.trip === a.trip && worse.book.areas.cane === a.book.areas.cane);
  const better = P.bank(a.book, { ...run, pts: 40 }, { stars: 3 });
  check('a better redo raises the area and the trip', better.newAreaBest && better.trip > a.trip && better.newBest);
  const two = P.bank(better.book, { ...P.freshRun('park', 'easy'), pts: 10 }, {});
  check('the trip score is the sum of every area\'s best', two.trip === better.book.areas.cane + 10 + P.POINTS.area);
  const lv = l => P.bank(P.freshBook(), { ...P.freshRun('cane', l), pts: 20 }).total;
  check('a harder go is worth more: easy x1, intermediate x1.5, hard x2', lv('easy') === 25 && lv('intermediate') === 38 && lv('hard') === 50);
  const rv = P.bankExtra(P.bank(P.freshBook(), { ...P.freshRun('reef', 'easy'), pts: 20 }).book, { ...P.freshRun('reef', 'hard'), pts: 6 });
  check('going back at a harder level, the pickups count at that level', rv.gained === 12);
  const fresh = P.newTripBook(two.book);
  check('a new game clears the trip but keeps the personal best', Object.keys(fresh.areas).length === 0 && fresh.best === two.book.best && fresh.trips === 1);
  const low = P.bank(fresh, { ...P.freshRun('park', 'easy'), pts: 1 }, {});
  check('a lower trip score is not a new personal best', !low.newBest && low.book.best === two.book.best);
  const one = P.bank(P.freshBook(), { ...P.freshRun('park', 'easy'), pts: 12 }, {});
  check('one area completed is already a personal best (the game need not be finished)', one.newBest && one.book.best === one.trip && one.trip > 0);
  {
    const done = P.bank(P.freshBook(), { ...P.freshRun('reef', 'easy'), pts: 20 }, {}).book;   // the reef completed: 25
    const back = P.bankExtra(done, { ...P.freshRun('reef', 'easy'), pts: 6 }, {});
    check('going back to a completed area, what he picks up counts without completing it again', back.gained === 6 && back.trip === P.tripScore(done) + 6 && back.newBest);
    let b = back.book; for (let i = 0; i < 20; i++) b = P.bankExtra(b, { ...P.freshRun('reef', 'easy'), pts: 6 }, {}).book;
    check('but going back can at most double an area (no farming for ever)', b.extras.reef === b.areas.reef);
    check('an area never completed gets no revisit points', P.bankExtra(P.freshBook(), { ...P.freshRun('cane', 'easy'), pts: 9 }).gained === 0);
    check('a new game clears the extras too', Object.keys(P.newTripBook(b).extras).length === 0);
    check('saved extras are kept, never past the cap', P.readBook({ areas: { reef: 25 }, extras: { reef: 99, cane: 5 } }).extras.reef === 25 && !('cane' in P.readBook({ areas: { reef: 25 }, extras: { cane: 5 } }).extras));
  }
  check('an unknown area banks nothing', P.bank(fresh, { ...P.freshRun('moon'), pts: 99 }).total === 0);
}
{
  const b = P.readBook({ areas: { park: 12, cane: -4, moon: 50, reef: 2.5 }, best: 99, trips: 'x' });
  check('a saved book keeps only real areas and whole points', b.areas.park === 12 && !('cane' in b.areas) && !('moon' in b.areas) && !('reef' in b.areas) && b.best === 99 && b.trips === 0);
  check('nonsense reads as a fresh book', P.readBook('junk').best === 0 && P.readBook(null).trips === 0);
}
check('the trip has its own leaderboard', LEVELS.includes('trip') && validScore('trip', 500, 0) && !validScore('trip', MAX_SCORE.trip + 1, 0));

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
