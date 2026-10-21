// Tests for js/levels/boomerang-physics.js: the flight by its forces, and attempts to break it.
// Run:  node test/boomerang-physics.test.mjs

import * as B from '../js/levels/boomerang-physics.js';
import { CLEARING, THROW_SPOT, GUIDE_SPOT, THROWERS, inClearing, nearThrowSpot } from '../js/levels/kuranda-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}
const hands = { x: 0, y: B.HAND_Y, z: 0 }, from = { x: 0.3, y: B.HAND_Y, z: 0 };
const throwIt = (tilt, force, aim = 0) => { const p = B.fly(from, aim, tilt, force); return { p, o: B.outcome(p, hands) }; };

// ---- What a real boomerang does -------------------------------------------------------
check("the guide's throw (the ideal tilt and force) comes back to his hand", throwIt(B.IDEAL_TILT, B.IDEAL_FORCE).o.kind === 'back', JSON.stringify(throwIt(B.IDEAL_TILT, B.IDEAL_FORCE).o));
check('too upright (0 degrees): nothing holds it up, it comes down short', [0.3, 0.6, 0.9].every(f => throwIt(0, f).o.kind === 'short'));
check('too soft: it sinks before it gets back', [10, 22, 35].every(tl => throwIt(tl, 0).o.kind === 'short'));
check('too hard: it climbs and goes over him', [15, 22, 30].every(tl => throwIt(tl, 1).o.kind === 'over'));
check('a flatter throw needs less force: thrown as hard as an upright one it climbs over, softer it comes back',
  throwIt(15, 0.6).o.kind === 'back' && throwIt(25, 0.6).o.kind === 'over' && throwIt(25, 0.35).o.kind === 'back');
{
  // There is a band to learn, not one magic setting: several tilts have a force that brings it back.
  const tilts = [15, 17.5, 20, 22.5, 25];
  const ok = tilts.filter(tl => [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6].some(f => throwIt(tl, f).o.kind === 'back'));
  check('a band of tilts can be brought back, each with its own force', ok.length === tilts.length, ok.join(','));
  // ...and it is a skill: most of the meters' range does not come back.
  let back = 0, all = 0;
  for (let tl = 0; tl <= 60; tl += 5) for (let f = 0; f <= 1.001; f += 0.1) { all++; if (throwIt(tl, f).o.kind === 'back') back++; }
  check('most throws do not come back (it takes skill)', back > 0 && back / all < 0.2, `${back}/${all}`);
}

// ---- The circle -----------------------------------------------------------------------
{
  // Thrown right-handed it curves LEFT: heading -z, it swings out to -x.
  const { p } = throwIt(B.IDEAL_TILT, B.IDEAL_FORCE);
  check('it curves to the left', Math.min(...p.map(q => q.x)) < -6 && Math.max(...p.map(q => q.x)) < 2);
  const span = q => Math.max(...q.map(s => s.x)) - Math.min(...q.map(s => s.x));
  const a = span(throwIt(B.IDEAL_TILT, 0.35).p), b = span(throwIt(B.IDEAL_TILT, 0.5).p);
  check('the loop is about the same size thrown softer or harder (lift and the turn both grow with speed)', Math.abs(a - b) / Math.max(a, b) < 0.3, `${a.toFixed(1)} vs ${b.toFixed(1)}`);
  check('the loop is a size that fits a clearing (6 to 30 metres)', a > 6 && a < 30, a.toFixed(1));
  const o0 = B.outcome(p, hands);
  check('it is back within a few seconds, not an instant or forever', p[o0.at].t > 2.5 && p[o0.at].t < 8, p[o0.at].t.toFixed(1));
  const back = p[o0.at], before = p[o0.at - 1], v = Math.hypot(back.x - before.x, back.y - before.y, back.z - before.z) / B.STEP;
  check('it comes home slowly enough to catch (under 9 metres a second)', v < 9, v.toFixed(1));
  check('it comes home about hand height, not along the ground', back.y > 0.6 && back.y < 3, back.y.toFixed(2));
  const turned = B.fly(from, Math.PI / 2, B.IDEAL_TILT, B.IDEAL_FORCE), o = B.outcome(turned, hands);
  check('aimed another way, it still comes back (nothing depends on facing north)', o.kind === 'back', JSON.stringify(o));
}

// ---- The physics cannot cheat ----------------------------------------------------------
{
  // Lift acts across the flight and does no work: speed and height together never gain energy.
  let ok = true;
  for (const [tl, f] of [[20, 0.42], [45, 1], [5, 0.3], [30, 0.8]]) {
    const p = B.fly(from, 0, tl, f);
    // Energy per kilogram at each step (speed from the step), compared with the step before.
    const energy = i => { const vx = (p[i].x - p[i - 1].x) / B.STEP, vy = (p[i].y - p[i - 1].y) / B.STEP, vz = (p[i].z - p[i - 1].z) / B.STEP;
      return 0.5 * (vx * vx + vy * vy + vz * vz) + B.G * p[i].y; };
    for (let i = 2; i < p.length - 1; i++) if (energy(i) > energy(i - 1) + 0.05) { ok = false; break; }   // slack for the stepping
  }
  check('it never gains energy in the air (no runaway climbs)', ok);
  check('every point is a number, even at the meters\' ends', [[0, 0], [60, 1], [0, 1], [60, 0]].every(([tl, f]) => B.fly(from, 0, tl, f).every(q => [q.x, q.y, q.z].every(Number.isFinite))));
  check('it never goes under the ground', B.fly(from, 0, 0, 1).every(q => q.y >= 0));
  check('tilt past the meter is held to the meter', JSON.stringify(B.fly(from, 0, 99, 0.6).slice(-1)) === JSON.stringify(B.fly(from, 0, 60, 0.6).slice(-1)));
  check('the same throw flies the same way every time', JSON.stringify(B.fly(from, 0.3, 20, 0.42)) === JSON.stringify(B.fly(from, 0.3, 20, 0.42)));
  check('it lays over (flattens) as it flies, but no flatter than the limit', (() => { const p = B.fly(from, 0, 20, 0.42); return p[p.length - 1].tilt > 20 && p.every(q => q.tilt <= B.AIR.maxLayover + 1e-9); })());
}

// ---- Catching --------------------------------------------------------------------------
{
  const { p, o } = throwIt(B.IDEAL_TILT, B.IDEAL_FORCE);
  check('it can be caught when it comes back', B.catchableAt(p, o.at, hands));
  check('not as it leaves his hand', !B.catchableAt(p, 5, hands));
  check('not once it is on the ground', (() => { const s = throwIt(0, 0.5).p; return !B.catchableAt(s, s.length - 1, hands); })());
  check('the force meter runs from a lob to a hard throw', B.speedFor(0) === B.SPEED[0] && B.speedFor(1) === B.SPEED[1] && B.speedFor(2) === B.SPEED[1]);
}


// ---- The clearing in Kuranda: a throw that comes back stays in it ---------------------
{
  const spot = { x: THROW_SPOT.x, y: B.HAND_Y, z: THROW_SPOT.z }, at = { x: THROW_SPOT.x, y: B.HAND_Y, z: THROW_SPOT.z };
  let backs = 0, outside = 0;
  for (let tl = 10; tl <= 40; tl += 2.5) for (let f = 0.4; f <= 0.9; f += 0.05) {
    const p = B.fly(spot, THROW_SPOT.aim, tl, f);
    if (B.outcome(p, at).kind !== 'back') continue;
    backs++;
    if (p.some(q => !inClearing(q.x, q.z, 1.5))) outside++;      // 1.5 m: over the clearing's edge plants at most
  }
  check('every throw that comes back stays over the clearing', backs > 5 && outside === 0, `${outside} of ${backs} leave it`);
  check('the thrower stands in the clearing', nearThrowSpot(THROW_SPOT.x, THROW_SPOT.z) && inClearing(THROW_SPOT.x, THROW_SPOT.z));
  check('the visitors\' throws come back to them, over the clearing', THROWERS.every(w => { const from = { x: w.x, y: B.HAND_Y, z: w.z }, p = B.fly(from, w.aim, B.IDEAL_TILT, B.IDEAL_FORCE);
    const o = B.outcome(p, from);                                 // up to the catch: they catch it there
    return o.kind === 'back' && p.slice(0, o.at + 1).every(q => inClearing(q.x, q.z, 3)); }));
  check('the visitors stand in the clearing, away from Wally\'s mark', THROWERS.every(w => inClearing(w.x, w.z) && Math.hypot(w.x - THROW_SPOT.x, w.z - THROW_SPOT.z) > 8));
  check('the guide stands beside him, not in the throw', Math.hypot(GUIDE_SPOT.x - THROW_SPOT.x, GUIDE_SPOT.z - THROW_SPOT.z) < 2.5 && GUIDE_SPOT.z > THROW_SPOT.z);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
