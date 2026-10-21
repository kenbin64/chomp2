// Tests for js/levels/train-rules.js: the Kuranda Scenic Railway's line, and attempts to break it.
// Run:  node test/train.test.mjs

import * as T from '../js/levels/train-rules.js';
import { TOP, GORGE } from '../js/levels/range-height.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}
const line = T.buildLine(), first = line[0], last = line[line.length - 1];

check('it starts up on the Tableland at Kuranda', first.y > TOP - 20, first.y.toFixed(0));
check('it ends down on the coastal plain at Cairns', last.y < 12 && T.onLand(last.x, last.z), last.y.toFixed(1));
check('it never climbs more than gently (1 in 40)', line.every((p, i) => i === 0 || (p.y - line[i - 1].y) <= T.CLIMB * (p.s - line[i - 1].s) + 1e-9));
{
  let worst = 0;
  for (let i = 10; i < line.length; i += 10) worst = Math.max(worst, (line[i - 10].y - line[i].y) / (line[i].s - line[i - 10].s));
  check('the grade stays one a train could run (under 1 in 7)', worst < 1 / 7, (worst * 100).toFixed(1) + '%');
}
check('it never crosses the Barron Gorge (as the real line does not)', line.every(p => !T.nearGorge(p.x, p.z)));
{
  const stop = T.ROUTE[T.FALLS_STOP], d = Math.hypot(stop[0] - GORGE.x, stop[1] - GORGE.head);
  check('the Barron Falls stop is close above the falls, on the far side from the gorge', d < 200 && stop[1] < GORGE.head);
}
check('every point stays on land, never out in the sea', line.every(p => T.onLand(p.x, p.z)));
{
  const r = T.runs(line), tunnels = r.filter(x => x.kind === 'tunnel'), bridges = r.filter(x => x.kind === 'bridge');
  check('there are tunnels through the spurs of the range', tunnels.length >= 2, String(tunnels.length));
  check('and bridges over the gullies', bridges.length >= 1, String(bridges.length));
  check('in a tunnel the land is above the train', tunnels.every(t => line.slice(t.from, t.to + 1).every(p => p.ground > p.y)));
  const len = r => line[r.to].s - line[r.from].s, high = r => Math.max(...line.slice(r.from, r.to + 1).map(p => p.y - p.ground));
  check('no bridge is longer than a real one could be (under 350 m)', bridges.every(b => len(b) < 350), bridges.map(len).map(Math.round).join(','));
  check('no bridge stands absurdly high (under 45 m)', bridges.every(b => high(b) < 45), bridges.map(high).map(Math.round).join(','));
  check('no tunnel is absurdly long (under 400 m)', tunnels.every(t => len(t) < 400), tunnels.map(len).map(Math.round).join(','));
  const sc = T.stoneyCreek(line);
  check('the Stoney Creek bridge is a real span (over 30 m)', sc && line[sc.to].s - line[sc.from].s > 30, sc ? (line[sc.to].s - line[sc.from].s).toFixed(0) : 'none');
}
check('the line is long enough for a ride (4 to 9 km in the game; the real line is 37 km)', last.s > 4000 && last.s < 9000, last.s.toFixed(0));
{
  const p = T.at(line, last.s / 2);
  check('a point along the line has a place and a heading', [p.x, p.y, p.z, p.heading].every(Number.isFinite));
  check('past the ends, it holds at the ends', T.at(line, -50).x === first.x && T.at(line, last.s + 99).x === last.x);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
