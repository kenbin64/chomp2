// train-rules.js
// The Kuranda Scenic Railway (Ken, 2026-10-21; MASTER.md section 6, the rescue): the historic
// train from Kuranda down the range to Cairns, past Barron Falls, over the Stoney Creek
// bridge and through the tunnels. The route only, no drawing: tested in test/train.test.mjs.
//
// The land is range-height.js. The Barron Gorge runs down +z from the falls at its head, so
// the railway does as the real one does and never crosses the gorge: it leaves Kuranda,
// passes the top of the falls (the Barron Falls stop, the gorge and the falls below), then
// winds down the face of the range in loops to the coastal plain and Cairns.
//
// The track's height is the land's, smoothed along the way so the train runs on a steady
// grade: where the land rises above the track the train is in a TUNNEL, where it falls well
// below, on a BRIDGE. Those are found from the shape of the land, not placed by hand.

import { height, GORGE, coastAt } from './range-height.js';

// Where the line runs (x, z), Kuranda first.
// Down the face of the range it loops back and forth (as the real line does), tighter where
// the range is steepest, so the grade holds; the loops were chosen by trying shapes against
// the tests (no bridge over 350 m or 45 m high, no tunnel over 400 m).
export const ROUTE = [
  [1760, -120], [1680, -300], [1520, -420], [1390, -450], [1250, -430], [1130, -780],
  [1068, -440], [1006, -780], [944, -440], [882, -780], [820, -440], [758, -780],
  [696, -440], [634, -780], [572, -440], [510, -780], [448, -440], [386, -780],
  [324, -440], [262, -780], [142, -440], [60, -380], [0, -200], [-110, -60],
];
export const FALLS_STOP = 3;                     // the Barron Falls stop: ROUTE[3], above the falls
export const SAMPLES = 900;                      // points along the line
const RISE = 1.5;                                // the rails above the smoothed ground
const SMOOTH = 70;                               // metres each way the ground is averaged over
export const TUNNEL = 5, BRIDGE = 6;
export const MAX_GRADE = 1 / 8;
export const CLIMB = 1 / 40;                     // it may climb this gently where the land rises (trains can)                 // steeper than the real line's 1 in 50 (the distances are compressed)             // metres of land above (tunnel) or air below (bridge)

// A smooth curve through the route (centripetal Catmull-Rom in x-z).
function catmull(p0, p1, p2, p3, t) {
  const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-6;
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), u = t1 + (t2 - t1) * t;
  const lerp = (a, b, ta, tb) => [0, 1].map(i => ((tb - u) * a[i] + (u - ta) * b[i]) / (tb - ta));
  const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
  const B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3);
  return lerp(B1, B2, t1, t2);
}

// The line: SAMPLES points { x, z, y, ground, s, kind } with s the distance along it and kind
// 'open', 'tunnel' or 'bridge'.
export function buildLine() {
  const P = ROUTE, raw = [];
  for (let i = 0; i < SAMPLES; i++) {
    const f = i / (SAMPLES - 1) * (P.length - 1), k = Math.min(P.length - 2, Math.floor(f));
    const p = catmull(P[Math.max(0, k - 1)], P[k], P[k + 1], P[Math.min(P.length - 1, k + 2)], f - k);
    raw.push({ x: p[0], z: p[1] });
  }
  let s = 0;
  raw.forEach((p, i) => { if (i) s += Math.hypot(p.x - raw[i - 1].x, p.z - raw[i - 1].z); p.s = s; p.ground = height(p.x, p.z); });
  // The grade: the ground averaged along the line, climbing at most gently (CLIMB), and
  // never dropping faster than MAX_GRADE: where the land falls away faster, the line runs out on
  // bridges and embankments; where a spur rises in the way, it goes through in a tunnel.
  const avg = raw.map(p => { let sum = 0, n = 0; for (const q of raw) if (Math.abs(q.s - p.s) <= SMOOTH) { sum += q.ground; n++; } return sum / n; });
  let y = Math.max(avg[0], 0.5);
  raw.forEach((p, i) => {
    const ds = i ? p.s - raw[i - 1].s : 0;
    if (i) y = Math.max(Math.min(y + CLIMB * ds, Math.max(avg[i], 0.5)), y - MAX_GRADE * ds);
    p.y = y + RISE;
  });
  for (const p of raw) p.kind = p.ground - p.y > TUNNEL ? 'tunnel' : p.y - p.ground > BRIDGE ? 'bridge' : 'open';
  return raw;
}

// Runs of the same kind: [{ kind, from, to }] (indices into the line).
export function runs(line) {
  const out = []; let start = 0;
  for (let i = 1; i <= line.length; i++) if (i === line.length || line[i].kind !== line[start].kind) { out.push({ kind: line[start].kind, from: start, to: i - 1 }); start = i; }
  return out;
}
// The longest bridge: the Stoney Creek bridge, with its falls.
export function stoneyCreek(line) {
  const len = r => line[r.to].s - line[r.from].s;
  return runs(line).filter(r => r.kind === 'bridge').sort((a, b) => len(b) - len(a))[0] || null;
}
// Where the train is at distance s (interpolated): { x, y, z, heading (radians, 0 = +z) }.
export function at(line, s) {
  s = Math.max(0, Math.min(line[line.length - 1].s, s));
  let lo = 0, hi = line.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (line[m].s < s) lo = m; else hi = m; }
  const a = line[lo], b = line[hi], u = (s - a.s) / ((b.s - a.s) || 1);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}
export const nearGorge = (x, z) => Math.abs(x - GORGE.x) < 140 && z > GORGE.head;   // in or over the gorge
export const onLand = (x, z) => x > coastAt(z) + 20;
