// The visitors' path outside the croc fence (Ken, 2026-10-29): people stand and stroll outside the
// fence, not on the bank. These checks try to break the geometry the people, lamps and kiosks rely on.
import { LAGOON, PARK_EDGE, FENCE_D, PATH, CLUSTER, BOARDWALK, fencePoint, fenceOffset, onPath, clampToPark, fenceRuns, overDeck } from '../js/rules.js';

let passed = 0, failed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log('  FAIL', name, detail); } };

const around = n => Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2);
// The places Wally can reach at the very edge of the park.
const edge = around(1440).map(a => ({ x: Math.cos(a) * LAGOON.rx * PARK_EDGE, z: Math.sin(a) * LAGOON.rz * PARK_EDGE }));
const nearestEdge = p => Math.min(...edge.map(e => Math.hypot(e.x - p.x, e.z - p.z)));

// fenceOffset undoes fencePoint, to within about 8 cm across the path (measured 0.080 m at its outer edge).
let worst = 0;
for (const a of around(720)) for (const o of [PATH.inner, PATH.stand, ...PATH.lanes, PATH.outer]) { const p = fencePoint(a, o); worst = Math.max(worst, Math.abs(fenceOffset(p.x, p.z) - o)); }
check('fenceOffset is within about 8 cm across the path', worst < 0.085, worst.toFixed(3));
check('the fence itself is at offset 0', around(90).every(a => { const p = fencePoint(a, 0); return Math.abs(fenceOffset(p.x, p.z)) < 1e-6; }));

// Wally can never set foot on the path: its inner edge is outside where he is kept.
check('the path is wholly outside the park edge', around(720).every(a => { const p = fencePoint(a, PATH.inner); const c = clampToPark(p.x, p.z); return c.x !== p.x || c.z !== p.z; }));
check('the fence is outside the park edge', FENCE_D > PARK_EDGE);
check('a point on the bank is not on the path', !onPath(LAGOON.rx * 1.2, 0));
check('a point well past the path is not on it', !onPath(fencePoint(1, PATH.outer + 3).x, fencePoint(1, PATH.outer + 3).z));
check('the walking lanes are on the path', around(90).every(a => PATH.lanes.every(l => { const p = fencePoint(a, l); return onPath(p.x, p.z); })));

// The groups at the fence: from the edge of the park Wally can make them nervous but never make them bolt
// on the spot, all the way round.
const stand = around(360).map(a => fencePoint(a, PATH.stand));
const gaps = stand.map(nearestEdge), lo = Math.min(...gaps), hi = Math.max(...gaps);
check('Wally can never get inside the bolt-at-once range', lo > CLUSTER.panic, lo.toFixed(2));
check('Wally can always get inside the nervous ring', hi < CLUSTER.near, hi.toFixed(2));
check('the gap is 3.8 to 4.5 m, as the code comment says', lo > 3.75 && hi < 4.55, `${lo.toFixed(2)} to ${hi.toFixed(2)}`);

// The boardwalk crosses the path at both ends.
const crosses = [-1, 1].map(s => around(720).some(a => { const p = fencePoint(a, PATH.stand); return Math.sign(p.x) === s && Math.abs(p.z - BOARDWALK.z) < BOARDWALK.width / 2 && Math.abs(p.x) < BOARDWALK.x1; }));
check('the boardwalk reaches the path at both ends', crosses.every(Boolean));

// The croc fence stops at the boardwalk: Wally must never run through it on his way out.
const runs = fenceRuns(LAGOON.rx * FENCE_D, LAGOON.rz * FENCE_D, overDeck, 2.6);
const chords = runs.flatMap(r => r.slice(1).map((p, i) => [r[i], p]));
check('the boardwalk crossing leaves two runs of fence', runs.length === 2, runs.length);
check('no fence post stands on the boardwalk', runs.flat().every(p => !overDeck(p)));
check('no fence panel crosses the boardwalk', chords.every(([a, b]) => [0.25, 0.5, 0.75].every(t => !overDeck({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }))));
check('the panels are about 2.6 m long', chords.every(([a, b]) => Math.hypot(a.x - b.x, a.z - b.z) < 2.7), Math.max(...chords.map(([a, b]) => Math.hypot(a.x - b.x, a.z - b.z))).toFixed(2));
const covered = chords.reduce((n, [a, b]) => n + Math.hypot(a.x - b.x, a.z - b.z), 0);
check('the fence goes nearly all the way round', covered > 190, covered.toFixed(0));
const gapRuns = fenceRuns(LAGOON.rx * FENCE_D, LAGOON.rz * FENCE_D, p => overDeck(p) || Math.abs(Math.atan2(Math.sin(p.a + Math.PI / 2), Math.cos(p.a + Math.PI / 2))) < 0.3, 2.6);
check('a harbour gap leaves a third run', gapRuns.length === 3, gapRuns.length);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
