// Tests for js/levels/esplanade-rules.js. Run:  node test/esplanade.test.mjs

import { PATH, KINDS, generateCourse, hits, runScore, STARS } from '../js/levels/esplanade-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

const c = generateCourse(7);
check('the same seed gives the same course', JSON.stringify(c) === JSON.stringify(generateCourse(7)));
check('a different seed gives a different course', JSON.stringify(c) !== JSON.stringify(generateCourse(8)));
check('there is a course', c.obstacles.length > 15 && c.mangoes.length > 40);
check('nothing in the first 30 m', c.obstacles.every(o => o.z >= 30));
check('nothing in the last 15 m before the pool', c.obstacles.every(o => o.kind === 'jogger' || o.z <= PATH.finish - 15));
check('everything is on the path', c.obstacles.every(o => Math.abs(o.x) <= PATH.half));
check('mangoes are on the path', c.mangoes.every(m => Math.abs(m.x) <= PATH.half));
check('it gets busier toward the end', c.obstacles.filter(o => o.z > 300).length / 180 >= c.obstacles.filter(o => o.z < 180).length / 150);

// Every obstacle can be beaten: jumped, ducked under, or gone round.
const HOP = 8.5 ** 2 / 44;                                     // Wally's land jump height, from wally.js
for (const [name, k] of Object.entries(KINDS)) {
  if (k.shape === 'bar') check(`${name}: ducking gets under`, !hits({ kind: name, x: 0, z: 10 }, 0, 10, PATH.ground, 'fours'));
  else check(`${name}: can be jumped or gone round`, k.h < HOP - 0.2 || k.speed > 0);
}
// No row of the course is blocked from side to side, except branches (duck).
for (const o of c.obstacles) {
  if (o.kind === 'branch') continue;
  const row = c.obstacles.filter(p => p.kind !== 'branch' && Math.abs(p.z - o.z) < 1.5 && p.kind !== 'jogger');
  let open = false;
  for (let x = -PATH.half + 0.4; x <= PATH.half - 0.4; x += 0.1) {
    if (row.every(p => !hits(p, x, o.z, PATH.ground, 'upright'))) { open = true; break; }
  }
  if (!open) { check(`row at z=${o.z.toFixed(1)} has a way through`, false); break; }
}
check('every row has a way through on foot', true);

// Collisions
check('running into a bin hits', hits({ kind: 'bin', x: 0, z: 50 }, 0.3, 50, PATH.ground, 'upright'));
check('jumping over a bin clears it', !hits({ kind: 'bin', x: 0, z: 50 }, 0, 50, PATH.ground + 1.1, 'upright'));
check('passing a bin with room to spare is clear', !hits({ kind: 'bin', x: 0, z: 50 }, 1.2, 50, PATH.ground, 'upright'));
check('a branch hits him upright', hits({ kind: 'branch', x: 0, z: 80 }, 3, 80, PATH.ground, 'upright'));
check('a branch hits him mid-jump too', hits({ kind: 'branch', x: 0, z: 80 }, 0, 80, PATH.ground + 1, 'upright'));
check('a branch is clear once past it', !hits({ kind: 'branch', x: 0, z: 80 }, 0, 82, PATH.ground, 'upright'));
check('a bench end-on is avoidable', !hits({ kind: 'bench', x: 0, z: 40 }, 1.4, 40, PATH.ground, 'upright'));

// Scoring
const fin = runScore({ food: 400, mangoes: 30, energyLeft: 50, stumbles: 0, finished: true });
check('a clean finish adds the bonuses', fin.total === 400 + 30 + 25 + 25);
check('stumbling loses the clean bonus', runScore({ food: 400, mangoes: 30, energyLeft: 50, stumbles: 1, finished: true }).clean === 0);
check('not finishing earns no finish bonus', runScore({ food: 400, mangoes: 30, finished: false }).finishBonus === 0);
check('star thresholds rise', STARS[0] < STARS[1] && STARS[1] < STARS[2]);
{
  const plain = runScore({ food: 100, finished: true }), dived = runScore({ food: 100, finished: true, pearls: 6, chest: true });
  check('pearls and the pirate chest add to the score', dived.total === plain.total + 6 * 5 + 30, `${plain.total} -> ${dived.total}`);
}
const best = runScore({ food: 15 * 3, mangoes: c.mangoes.length, energyLeft: 60, finished: true }).total;
check('three stars are reachable on this course', best >= STARS[2], best);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
