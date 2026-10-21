// Tests for js/levels/coast-rules.js: up the coast to the Daintree.
// Run:  node test/coast.test.mjs

import * as C from '../js/levels/coast-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

check('the land is on his left going north, the sea on his right, all the way', [0, 200, 400, 700].every(z => !C.inWater(C.shoreX(z) + 5, z) && C.inWater(C.shoreX(z) - 5, z)));
check('the coast has headlands and bays (not a straight line)', Math.max(...[0, 100, 200, 300, 400, 500].map(C.shoreX)) - Math.min(...[0, 100, 200, 300, 400, 500].map(C.shoreX)) > 10);
check('the places come in order: Cairns, Palm Cove, Port Douglas, the river mouth', C.PLACES.every((p, i) => i === 0 || p[0] > C.PLACES[i - 1][0]) && C.placeAt(230) === 'Port Douglas' && C.placeAt(10) === 'Off Cairns');
{
  let p = { x: C.shoreX(0) - 10, z: 0 };
  for (let i = 0; i < 4000; i++) p = C.swimStep(p.x, p.z, C.shoreX(p.z + 0.25) - 10, p.z + 0.25);   // following the coast, as a player steers
  check('swimming north he reaches the river mouth', C.reachedMouth(p.z), p.z.toFixed(0));
  check('the swim ends at the mouth, before the hills behind it, and when its name shows', C.END_Z < C.MOUTH_Z && C.placeAt(C.END_Z) === 'The Daintree River mouth' && !C.reachedMouth(C.END_Z - 1));
  let n = { x: C.shoreX(0) - 10, z: 0 };
  for (let i = 0; i < 4000; i++) n = C.swimStep(n.x, n.z, n.x, n.z + 0.25);   // holding straight north, never steering
  check('swimming straight on he slides round the bends and still gets there', C.reachedMouth(n.z) && C.inWater(n.x, n.z), n.z.toFixed(0));
  let q = { x: C.shoreX(100) - 5, z: 100 };
  for (let i = 0; i < 100; i++) q = C.swimStep(q.x, q.z, q.x + 0.5, q.z);
  check('he cannot swim up onto the land', C.inWater(q.x, q.z));
  let r = { x: C.shoreX(100) - 10, z: 100 };
  for (let i = 0; i < 400; i++) r = C.swimStep(r.x, r.z, r.x - 0.5, r.z);
  check('nor out past the lane to the open sea', r.x > C.shoreX(100) - C.LANE);
}
{
  const w = { x: C.shoreX(300) - 10, z: 300 };
  const targets = C.BOATS.map(b => C.boatTarget(b, w.x, w.z));
  check('the boats keep out to sea of him', targets.every(t => t.x < w.x));
  check('and spread along the line, not on top of each other', targets.every((a, i) => targets.every((b, j) => i === j || Math.abs(a.z - b.z) > 8)));
  check('a boat alongside is in throwing range', C.inThrowRange(targets[0].x, targets[0].z, w.x, w.z));
  check('right on top of him it is not', !C.inThrowRange(w.x + 1, w.z, w.x, w.z));
  let b = { x: w.x - 40, z: w.z - 40, heading: 0 };
  for (let i = 0; i < 400; i++) b = C.boatStep(b, targets[0], 0.05);
  check('a boat catches up with its place alongside', Math.hypot(b.x - targets[0].x, b.z - targets[0].z) < 0.5);
  const one = C.boatStep({ x: 0, z: 0 }, { x: 0, z: 100 }, 0.1);
  check('no faster than a boat goes', one.z <= C.BOAT_SPEED * 0.1 + 1e-9);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
