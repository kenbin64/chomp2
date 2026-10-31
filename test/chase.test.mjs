// The break-out and the chase (chase-rules.js, Ken 2026-10-29). These checks try to break the rules the
// catcher and the grounds rely on: where Wally may be, what the catcher sees, and whether he can be outrun.
import { PATH, DECK_OPENINGS, fenceOffset, fencePoint, BOARDWALK, STAND } from '../js/rules.js';
import { kioskSpots } from '../js/rules.js';
import * as C from '../js/chase-rules.js';

let passed = 0, failed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log('  FAIL', name, detail); } };
const same = (p, q) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.z - q.z) < 1e-9;

// ---- Where Wally may be, outside ----
const inside = C.clampOutside(10, 5);
check('a point inside the croc fence is pushed out past it', fenceOffset(inside.x, inside.z) >= C.OUT_MARGIN - 0.02, fenceOffset(inside.x, inside.z).toFixed(2));
const far = C.clampOutside(200, 150);
check('a point past the outer fence is pulled back in', C.outerDistance(far.x, far.z) < 1);
const onPathPt = fencePoint(1, 3);
check('a point on the path is left alone', same(C.clampOutside(onPathPt.x, onPathPt.z), onPathPt));
check('the way out can be reached', same(C.clampOutside(C.EXIT_SPOT.x, C.EXIT_SPOT.z), C.EXIT_SPOT));
check('the way out is off the path', fenceOffset(C.EXIT_SPOT.x, C.EXIT_SPOT.z) > PATH.outer + 5);

// ---- The pens and stands ----
const pens = C.PENS.map(C.penShape);
const wallPoints = pens.flatMap(p => p.walls.flatMap(w => [{ x: w.ax, z: w.az }, { x: w.bx, z: w.bz }, { x: (w.ax + w.bx) / 2, z: (w.az + w.bz) / 2 }]));
check('no pen wall is on the path', wallPoints.every(q => fenceOffset(q.x, q.z) > PATH.outer + 1));
check('every pen is inside the outer fence', wallPoints.every(q => C.outerDistance(q.x, q.z) < 0.97));
const stands = kioskSpots();
check('no pen is on top of a stand', pens.every(p => stands.every(k => Math.hypot(p.x - k.x, p.z - k.z) > 8)));
check('no pen is in front of the way out', pens.every(p => Math.hypot(p.x - C.EXIT.x, p.z - C.EXIT.z) > 15));
check('a pen is long enough to run through (open both ends)', pens.every(p => p.walls.length === 2));

// ---- Seeing ----
const pen = pens[0], [w0] = pen.walls;
const mid = { x: (w0.ax + w0.bx) / 2, z: (w0.az + w0.bz) / 2 }, dx = pen.x - mid.x, dz = pen.z - mid.z;
const before = { x: mid.x - dx, z: mid.z - dz }, behind = { x: pen.x, z: pen.z };
check('a pen wall blocks sight', !C.canSee(before, behind, pens.flatMap(p => p.walls)));
check('open ground does not', C.canSee({ x: 0, z: 40 }, { x: 10, z: 40 }, pens.flatMap(p => p.walls)));
const standEdges = stands.flatMap(k => C.boxEdges(k, STAND.w, STAND.d));
const k0 = stands[0], ux = Math.sin(k0.rot), uz = Math.cos(k0.rot);
check('a stand blocks sight straight through it', !C.canSee({ x: k0.x - ux * 3, z: k0.z - uz * 3 }, { x: k0.x + ux * 3, z: k0.z + uz * 3 }, standEdges));

// ---- The boardwalk's railings let the path through ----
const rails = C.deckRails(DECK_OPENINGS);
const crossing = fencePoint(0.07, PATH.lanes[1]);       // where the patrol lane meets the boardwalk
check('the patrol lane crosses the boardwalk at an opening', rails.every(r => C.segmentDistance(crossing.x, BOARDWALK.z, r) > 0.4 || Math.abs(crossing.x) < 39));

// ---- The catcher, in open ground (nothing in the way) ----
const open = { screens: [], free: () => true, clamp: (x, z) => ({ x, z }) };
function run(wallyAt, wallySpeed, seconds, startAt = { x: 0, z: 40 }, world = open, out = true) {
  const c = C.newCatcher(startAt); c.mode = 'patrol';
  const w = { ...wallyAt, out };
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const away = Math.atan2(w.x - c.x, w.z - c.z);
    w.x += Math.sin(away) * wallySpeed / 60; w.z += Math.cos(away) * wallySpeed / 60;
    const e = C.catcherStep(c, w, 1 / 60, world);
    if (e) events.push({ e, t });
    if (e === 'caught') break;
  }
  return { c, events };
}
const still = run({ x: 15, z: 40 }, 0, 10);
check('he spots Wally standing in the open', still.events[0] && still.events[0].e === 'spotted');
const caughtAt = still.events.find(e => e.e === 'caught');
check('and catches him in about 3 s', caughtAt && caughtAt.t > 2 && caughtAt.t < 4, caughtAt && caughtAt.t.toFixed(2));
const fast = run({ x: 15, z: 40 }, 5.6, 30);
check('Wally at full speed (5.6 m/s) is never caught', !fast.events.some(e => e.e === 'caught'));
const tired = run({ x: 15, z: 40 }, 3.5, 30);
check('a tired Wally (3.5 m/s) is caught', tired.events.some(e => e.e === 'caught'));
const inPark = run({ x: 15, z: 40 }, 0, 10, { x: 0, z: 40 }, open, false);
check('he never chases Wally while Wally is inside the croc fence', !inPark.events.length && inPark.c.mode === 'patrol');

// Out of sight long enough, and he has lost him.
// (A wall he can neither see nor walk through, as the pens are.)
const blind = { screens: [{ ax: -100, az: 45, bx: 100, bz: 45 }], free: (x, z) => z < 44.6, clamp: (x, z) => ({ x, z }) };
const c = C.newCatcher({ x: 0, z: 40 }); c.mode = 'chase'; c.last = { x: 0, z: 50 };
let lostAt = null;
for (let t = 0; t < 6; t += 1 / 60) { const e = C.catcherStep(c, { x: 0, z: 60, out: true }, 1 / 60, blind); if (e === 'lost') { lostAt = t; break; } }
check(`behind cover, he loses Wally after ${C.CATCHER.lose} s`, lostAt !== null && Math.abs(lostAt - C.CATCHER.lose) < 0.1, lostAt);

// Alerted, he runs to the spot at full speed.
const a = C.newCatcher({ x: 0, z: 40 });
C.alertCatcher(a, { x: 30, z: 40 });
C.catcherStep(a, { x: 0, z: 0, out: false }, 0.1, open);
check('alerted, he runs (chase speed) to where Wally came out', a.mode === 'search' && Math.abs(a.speed - C.CATCHER.chase) < 1e-9 && a.x > 0.4);

// Blocked straight ahead, he goes round.
const wall = { screens: [], free: (x, z) => !(Math.abs(x - 5) < 0.3 && Math.abs(z - 40) < 2), clamp: (x, z) => ({ x, z }) };
const r = C.newCatcher({ x: 0, z: 40 }); C.alertCatcher(r, { x: 10, z: 40 });
// (Closest he gets: once there he looks about, then goes back to his patrol, so where he ends up says nothing.)
let closest = Infinity;
for (let t = 0; t < 10; t += 1 / 60) { C.catcherStep(r, { x: 0, z: 0, out: false }, 1 / 60, wall); closest = Math.min(closest, Math.hypot(r.x - 10, r.z - 40)); }
check('he walks round something in his way, to the spot', closest < 1.05, closest.toFixed(2));

// Across the park: the straight line runs through the croc enclosure, so he goes round by the path
// (the browser probe found him stuck against the croc fence before this), and never sets foot inside.
const ring = { screens: [], free: () => true, clamp: C.clampOutside };
const west = fencePoint(Math.PI, 4.6), east = fencePoint(0.05, 4.6);
const g = C.newCatcher(west); C.alertCatcher(g, east);
let wentIn = false, best = Infinity, tookS = null;
for (let t = 0; t < 40; t += 1 / 60) {
  C.catcherStep(g, { x: 0, z: 0, out: false }, 1 / 60, ring);
  if (fenceOffset(g.x, g.z) < 0.5) wentIn = true;
  const d = Math.hypot(g.x - east.x, g.z - east.z); if (d < best) best = d;
  if (d < 1.05 && tookS === null) tookS = t;
}
check('across the park he goes round, not through', !wentIn);
check('and gets there, round the path at full run', tookS !== null && tookS < 25, tookS === null ? best.toFixed(1) + ' m short' : tookS.toFixed(1) + ' s');

// No hiding against the croc fence: a Wally standing right at it, the catcher a few metres out, is caught.
{
  const hug = fencePoint(1.4, C.OUT_MARGIN), from = fencePoint(1.25, 5);
  const h = C.newCatcher(from); h.mode = 'patrol';
  let got = false;
  for (let t = 0; t < 15 && !got; t += 1 / 60) got = C.catcherStep(h, { ...hug, out: true }, 1 / 60, ring) === 'caught';
  check('Wally hugging the croc fence is still caught', got, `${h.x.toFixed(1)}, ${h.z.toFixed(1)} vs ${hug.x.toFixed(1)}, ${hug.z.toFixed(1)}`);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
