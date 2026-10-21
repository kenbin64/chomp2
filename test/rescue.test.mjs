// Tests for js/levels/rescue-rules.js: calling the crocs and leading them to the sea.
// Run:  node test/rescue.test.mjs

import * as R from '../js/levels/rescue-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

const crocs = R.startingCrocs();
check('ten crocs to call, in the lagoon and on its banks', crocs.length === 10 && crocs.some(c => c.place === 'lagoon') && crocs.some(c => c.place === 'bank'));
check('every croc starts inside the fence', crocs.every(c => R.fenceDistance(c.x, c.z) < 0.95));
check('they start spread out, not on top of each other', crocs.every((a, i) => crocs.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) > 5)));

// ---- The fence -------------------------------------------------------------------------
{
  const inPark = { x: 0, z: -R.FENCE.rz * 0.9 }, outside = { x: 0, z: -R.FENCE.rz - 6 };
  check('with the fence shut he cannot walk out, even at the gap', R.step(inPark.x, inPark.z, outside.x, outside.z, false).z === inPark.z);
  let p = { ...inPark }; for (let i = 0; i < 120; i++) p = R.step(p.x, p.z, p.x, p.z - 0.5, true);
  check('with it open he walks out through the gap, over the sand, into the sea', R.inSea(p.x, p.z), p.z.toFixed(1));
  const side = { x: R.FENCE.rx * 0.6, z: -R.FENCE.rz * 0.78 };
  let q = { ...side }; for (let i = 0; i < 80; i++) q = R.step(q.x, q.z, q.x, q.z - 0.5, true);
  check('away from the gap the fence still stops him', R.fenceDistance(q.x, q.z) < 1, R.fenceDistance(q.x, q.z).toFixed(2));
  check('out on the shore he can walk along the beach', R.onShore(20, -55) && R.step(0, -55, 5, -55, true).x === 5);
}

// ---- Calling and following -----------------------------------------------------------------
{
  const trail = [];
  for (let z = 0; z >= -40; z -= 0.1) R.addToTrail(trail, Math.sin(z * 0.2) * 6, z, 10 * R.SPACING);
  const places = [1, 2, 3, 5].map(k => R.placeInLine(trail, k));
  check('each croc\'s place is a spacing further back along his trail', places.every((p, i) => i === 0 || p.z > places[i - 1].z));
  const along = Math.hypot(places[0].x - trail[0].x, places[0].z - trail[0].z);
  check('the first is about one spacing behind him', along > R.SPACING * 0.8 && along < R.SPACING * 1.2, along.toFixed(2));
  check('the trail is kept only as long as the line needs', trail.length <= Math.ceil(10 * R.SPACING / R.TRAIL) + 4);
  // The line follows the way he went: a croc's place is on his path, not a straight cut.
  const onPath = places.every(p => Math.abs(p.x - Math.sin(p.z * 0.2) * 6) < 0.6);
  check('the line snakes after him along his path', onPath);
}
{
  let c = { x: 0, z: 0, heading: 0 };
  for (let i = 0; i < 100; i++) c = { ...c, ...R.follow(c, { x: 10, z: 0 }, 0.05) };
  check('a croc catches up with its place and stops just short', Math.abs(c.x - 10) < 0.8 && !R.follow(c, { x: 10, z: 0 }, 0.05).moving);
  const one = R.follow({ x: 0, z: 0, heading: 0 }, { x: 100, z: 0 }, 0.1);
  check('no faster than a croc can go', one.x <= R.CROC_SPEED * 0.1 + 1e-9);
}
check('the gap opens only when all are called', !R.allCalled([{ called: true }, { called: false }]) && R.allCalled([{ called: true }, { called: true }]));
check('free only when every croc is out in the sea', !R.allInSea([{ x: 0, z: -80 }, { x: 0, z: -60 }]) && R.allInSea([{ x: 0, z: -80 }, { x: 3, z: -75 }]));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
