// Tests for js/progress.js. Run:  node test/progress.test.mjs

import { freshProgress, starsFor, completeArea, isOpen, readProgress, POSTCARDS } from '../js/progress.js';
import { AREAS } from '../js/quests.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

const p0 = freshProgress();
check('a new player has only the park open', p0.unlocked.join() === 'park' && isOpen(p0, 'park'));
check('the second area starts locked', !isOpen(p0, AREAS[1].id));

check('no stars below the first threshold', starsFor(99, [100, 200, 300]) === 0);
check('exactly on a threshold earns it', starsFor(200, [100, 200, 300]) === 2);
check('three is the most', starsFor(1e9, [100, 200, 300]) === 3);

const p1 = completeArea(p0, 'park', { score: 500, stars: 2, mangoes: 12 });
check('finishing the park records stars, best and mangoes', p1.stars.park === 2 && p1.best.park === 500 && p1.mangoes === 12);
check('finishing the park collects its postcard', p1.postcards.includes('park'));
check('it does not change the old progress', p0.unlocked.length === 1 && !p0.stars.park);
const next = AREAS[1];
check('the next area opens only if it is built', isOpen(p1, next.id) === next.ready);

const p2 = completeArea(p1, 'park', { score: 300, stars: 1, mangoes: 5 });
check('a worse run never lowers stars or best', p2.stars.park === 2 && p2.best.park === 500);
check('mangoes still add up', p2.mangoes === 17);
check('the postcard is not collected twice', p2.postcards.filter(x => x === 'park').length === 1);
check('negative mangoes are ignored', completeArea(p0, 'park', { mangoes: -50 }).mangoes === 0);

check('broken saved data starts fresh', JSON.stringify(readProgress('not json')) === JSON.stringify(freshProgress()));
check('saved data without the park is repaired', readProgress('{"unlocked":["reef"]}').unlocked.join() === 'park');
const round = readProgress(JSON.stringify(p2));
check('progress survives saving and loading', JSON.stringify(round) === JSON.stringify(p2));

check('every area has a postcard', AREAS.every(a => typeof POSTCARDS[a.id] === 'string' && POSTCARDS[a.id].length > 20));

// Pearls, from the Esplanade on, are kept across the whole trip.
{
  const a = completeArea(p0, 'esplanade', { pearls: 7 }), b = completeArea(a, 'esplanade', { pearls: 3 });
  check('pearls add up across runs', a.pearls === 7 && b.pearls === 10);
  check('negative pearls are ignored', completeArea(p0, 'park', { pearls: -4 }).pearls === 0);
  check('pearls survive saving and loading', readProgress(JSON.stringify(b)).pearls === 10);
  check('an old save without pearls loads with none', readProgress(JSON.stringify({ unlocked: ['park'] })).pearls === 0);
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
