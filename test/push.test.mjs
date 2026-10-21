// Tests for js/levels/push-rules.js: the Great Push.
// Run:  node test/push.test.mjs

import * as P from '../js/levels/push-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

check('on the beat is a perfect heave', P.quality(P.BEAT * 3) === 1 && P.quality(P.BEAT * 3 + 0.05) === 1);
check('a little off is still good, a lot off counts for nothing', P.quality(P.BEAT * 3 + 0.2) > 0 && P.quality(P.BEAT * 3 + 0.2) < 1 && P.quality(P.BEAT * 3 + 0.5) === 0);
check('early and late count the same', Math.abs(P.quality(P.BEAT * 4 - 0.18) - P.quality(P.BEAT * 4 + 0.18)) < 1e-9);
check('the quality falls steadily away from the beat', [0.1, 0.15, 0.2, 0.25, 0.3].every((e, i, a) => i === 0 || P.quality(P.BEAT + e) <= P.quality(P.BEAT + a[i - 1])));
{
  let m = 0, n = 0; while (!P.afloat(m) && n < 100) { m = P.heave(m, 1); n++; }
  check('perfect heaves float it in a handful of beats (5 to 8)', n >= 5 && n <= 8, String(n));
  let half = 0, k = 0; while (!P.afloat(half) && k < 100) { half = P.heave(half, 0.5); k++; }
  check('rough timing takes about twice as long, but still gets there', k > n && k <= 2 * n + 1, String(k));
  check('with fewer crocs pushing it moves less', P.heave(0, 1, 5) < P.heave(0, 1, 10));
  check('it never moves past free', P.heave(P.NEEDED - 0.1, 1) === P.NEEDED);
}
check('a missed beat lets it settle back, never past the start', P.settle(2) < 2 && P.settle(0.1) === 0);
check('each beat is counted once', P.beatOf(P.BEAT * 5 - 0.2) === P.beatOf(P.BEAT * 5 + 0.2) && P.beatOf(P.BEAT * 5) !== P.beatOf(P.BEAT * 6));
check('the park crocs and the wild crocs all push: fifteen', P.CROCS === 15 && P.PARK === 10 && P.WILD === 5);
check('the words for each heave', P.rating(1) === 'Perfect heave!' && P.rating(0) === 'Missed the beat');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
