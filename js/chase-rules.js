// chase-rules.js
// The break-out from Croc Park (Ken, 2026-10-29): with the key, Wally goes out the gate on the
// boardwalk into the park's grounds, where one croc catcher who works for the park chases him. People
// on the path throw him food to keep his energy up; he dodges in and out of the food stands and the
// keepers' pens until he finds the way out to the cane fields, where nobody follows because of the
// fires. Caught, he is put back inside the gate without losing a life (Ken).
// Pure rules, no three.js and no page, so they can be tested on their own (test/chase.test.mjs).

import { LAGOON, FENCE_D, PATH, BOARDWALK, fencePoint, fenceOffset, pathAngle } from './rules.js';

// The park's outer fence: an oval 22 m out past the croc fence at its ends.
export const OUTER = { rx: LAGOON.rx * FENCE_D + 22, rz: LAGOON.rz * FENCE_D + 22 };
export const OUT_MARGIN = 0.6;               // metres Wally keeps from the croc fence, outside it
const WALL_MARGIN = 0.6;                     // and from the outer fence

export function outerDistance(x, z) { return Math.hypot(x / OUTER.rx, z / OUTER.rz); }
const onOuter = a => ({ x: Math.cos(a) * OUTER.rx, z: Math.sin(a) * OUTER.rz });

// The way out: a gate in the outer fence on the far side from the gate on the boardwalk, so he can go either way
// round the park (park-sections.js), toward the cane.
export const EXIT_ANGLE = 168 * Math.PI / 180;
export const EXIT = onOuter(EXIT_ANGLE);
export const EXIT_HALF = 2;                  // half the gate's width, metres
// Where the machete waits, just inside the gate: picking it up is the way out.
export const EXIT_SPOT = (() => { const k = 1 - 2.5 / Math.min(OUTER.rx, OUTER.rz); return { x: EXIT.x * k, z: EXIT.z * k }; })();

// Where Wally may be once he is out: past the croc fence and inside the outer fence.
export function clampOutside(x, z) {
  if (fenceOffset(x, z) < OUT_MARGIN) ({ x, z } = fencePoint(pathAngle(x, z), OUT_MARGIN));
  const d = outerDistance(x, z), lim = 1 - WALL_MARGIN / Math.min(OUTER.rx, OUTER.rz);
  if (d > lim) { x *= lim / d; z *= lim / d; }
  return { x, z };
}

// ---- The keepers' pens ----------------------------------------------------
// Shade-cloth yards out in the grounds, open at both ends so Wally can run through them, and solid to
// see through: ducking through one breaks the catcher's line of sight. Each lies along the path,
// `out` metres from the croc fence; len along the path, wide across it.
export const PENS = [
  { deg: 215, out: 12, len: 9, wide: 5 },
  { deg: 232, out: 9.5, len: 9, wide: 5 },
  { deg: 248, out: 15, len: 9, wide: 5 },
  { deg: 262, out: 11, len: 9, wide: 5 },
];
// A pen's two long walls as segments [{ax, az, bx, bz}], and its centre and heading.
export function penShape(pen) {
  const a = pen.deg * Math.PI / 180, c = fencePoint(a, pen.out), ahead = fencePoint(a + 0.01, pen.out);
  const tx = ahead.x - c.x, tz = ahead.z - c.z, tn = Math.hypot(tx, tz), ux = tx / tn, uz = tz / tn;   // along the path
  const nx = uz, nz = -ux;                                                                                  // across it
  const walls = [-1, 1].map(s => ({
    ax: c.x + nx * s * pen.wide / 2 - ux * pen.len / 2, az: c.z + nz * s * pen.wide / 2 - uz * pen.len / 2,
    bx: c.x + nx * s * pen.wide / 2 + ux * pen.len / 2, bz: c.z + nz * s * pen.wide / 2 + uz * pen.len / 2,
  }));
  return { x: c.x, z: c.z, rot: Math.atan2(ux, uz), walls };
}

// A food stand's footprint as four edges (park-path.js kioskSpots gives where they stand).
export function boxEdges({ x, z, rot }, w, d) {
  const ux = Math.sin(rot), uz = Math.cos(rot), vx = uz, vz = -ux;     // u: the way it faces, v: across it
  const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => ({ x: x + vx * i * w / 2 + ux * j * d / 2, z: z + vz * i * w / 2 + uz * j * d / 2 }));
  return c.map((p, i) => ({ ax: p.x, az: p.z, bx: c[(i + 1) % 4].x, bz: c[(i + 1) % 4].z }));
}

// ---- Line of sight -----------------------------------------------------------

function cross(ax, az, bx, bz, cx, cz) { return (bx - ax) * (cz - az) - (bz - az) * (cx - ax); }
export function segmentsCross(s, t) {
  const d1 = cross(t.ax, t.az, t.bx, t.bz, s.ax, s.az), d2 = cross(t.ax, t.az, t.bx, t.bz, s.bx, s.bz);
  const d3 = cross(s.ax, s.az, s.bx, s.bz, t.ax, t.az), d4 = cross(s.ax, s.az, s.bx, s.bz, t.bx, t.bz);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
// Can someone at a see someone at b? Not through any of the screens (pen walls, stands).
export function canSee(a, b, screens) {
  const line = { ax: a.x, az: a.z, bx: b.x, bz: b.z };
  return !screens.some(s => segmentsCross(line, s));
}
// How far a point is from a segment.
export function segmentDistance(x, z, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, L = dx * dx + dz * dz;
  const t = L ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L)) : 0;
  return Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t));
}

// ---- The croc catcher ------------------------------------------------------------------
// patrol: walks the path round the park. chase: has seen Wally and runs at him. search: lost sight
// of him and goes to where he was last seen, looks about, then goes back to patrolling.
export const CATCHER = {
  tip: 2.5,         // while Wally is loose, how often people point the catcher his way (Ken, 2026-10-30: "I was never chased")
  shaken: 6,        // and after losing him, how long before he picks up the trail again
  ahead: 0.75,       // how far along Wally's road to the way out he aims for, when Wally is far off
  see: 22,          // metres he can spot Wally from, with nothing in the way
  patrol: 1.8,      // walking speed, metres a second
  chase: 5.0,       // running: a little slower than Wally upright at full energy (5.6), faster when he is tired
  search: 3.2,
  reach: 1.2,       // this close and he has him
  lose: 2.5,        // seconds out of sight before he has lost him
  look: 4,          // seconds he looks about where Wally was last seen
  turn: 7,          // radians a second he can turn
};
export const OUT_DRAIN = 1.4;                // energy drains this much faster outside: running on hot asphalt

// The patrol: round the path's outer lane, a waypoint every 30 degrees.
export const PATROL = Array.from({ length: 12 }, (_, i) => fencePoint(i / 12 * Math.PI * 2, PATH.lanes[1]));

// Where he is when Wally breaks out: on the bridge just past the gate, so whichever way Wally runs he is right behind
// him from the first second (Ken, 2026-10-30: the chase is the boss of the level, and it was possible never to meet him).
export const GATE_POST = { x: 53, z: 2 };

export function newCatcher(at = PATROL[6]) {
  return { x: at.x, z: at.z, heading: 0, mode: 'patrol', wp: PATROL.indexOf(at) >= 0 ? PATROL.indexOf(at) : 0, unseen: 0, last: null, look: 0, speed: 0 };
}

// He hears the gate go (Wally is out): he runs to the spot, and the chase is on once he sees him.
// Challenging, not impossible (Ken, 2026-10-30): each time he catches Wally, Wally gets a longer start and he tires a
// little, so someone who keeps getting caught does get through in the end. (A plain bot slower than him was caught 19
// times and never finished without this: test/sections.test.mjs.)
export function afterCatches(caught) { return { hold: Math.min(10, 3 + caught * 1.2), pace: Math.max(0.78, 1 - caught * 0.03) }; }

// Wally has proved himself (Ken, 2026-10-30): the catcher is on his side now, and goes ahead to the final gate to wait.
export function catcherHelps(c, at) { c.helper = true; c.mode = 'search'; c.last = { x: at.x, z: at.z }; c.hurry = true; c.hold = 0; c.pace = 1; c.plan = null; }

export function alertCatcher(c, at, hold = 0, pace = 1) {
  c.hold = hold; c.pace = pace;
  if (c.mode === 'chase') return;
  c.mode = 'search'; c.last = { x: at.x, z: at.z }; c.look = 0; c.hurry = true; c.tip = CATCHER.tip;
}

// Walk toward (tx, tz), round anything in the way: the straight line first, then turning further
// and further aside until a step is free. Once he has started round something he keeps to that side
// (c.side) until the straight line is clear again, so he never dithers at a wall's face.
// Each way is looked along for LOOK metres, not just one step, so he turns the corner cleanly instead
// of nudging into it again the moment it is out of his way.
const ASIDE = [0.5, 1.0, 1.6, 2.3], LOOK = 1.2, NEAR = 3.5;
function clearAhead(c, h, len, world) {
  for (let d = 0.3; d <= len + 1e-9; d += 0.3) if (!world.free(c.x + Math.sin(h) * d, c.z + Math.cos(h) * d)) return false;
  return true;
}
// The croc enclosure is in the middle of everything: when the straight line to where he is going
// crosses it, he heads round the path instead, the shorter way, a little at a time, until the line is
// clear (the browser test found him grinding against the croc fence, trying to go straight through).
// A line counts as crossing if it dips toward the fence: closer than 1.5 m, or than either end of it
// (less 0.2 m). He is kept 0.6 m out, and a line that only just clears the fence would have him grinding
// along it; but a line to a Wally standing right at the fence must still count as clear, or Wally could
// hide there for ever (both found by test/chase.test.mjs).
function crossesEnclosure(ax, az, bx, bz) {
  const limit = Math.min(1.5, fenceOffset(ax, az) - 0.2, fenceOffset(bx, bz) - 0.2);
  for (let i = 1; i < 24; i++) { const t = i / 24; if (fenceOffset(ax + (bx - ax) * t, az + (bz - az) * t) < limit) return true; }
  return false;
}
export function routeVia(c, tx, tz) {
  if (!crossesEnclosure(c.x, c.z, tx, tz)) return { x: tx, z: tz };
  const mine = pathAngle(c.x, c.z), theirs = pathAngle(tx, tz);
  const d = Math.atan2(Math.sin(theirs - mine), Math.cos(theirs - mine));
  // Along the path's outer lane, in small steps: a long step's straight line cuts inside the curve, and
  // step after step he would drift in against the fence (measured: from 4.6 m out to 0.6 m, then stuck).
  return fencePoint(mine + Math.sign(d) * Math.min(Math.abs(d), 0.15), PATH.lanes[1]);
}
// Trying to go somewhere and getting nowhere: for a moment he stops looking so far ahead and squeezes past. Without this he
// could jitter for minutes in one spot, finding the way and stepping back (the race test found him by the snake pit).
function noteProgress(c, dt) {
  c.watch = (c.watch || 0) + dt; c.squeeze = Math.max(0, (c.squeeze || 0) - dt);
  if (c.watch < 0.8) return;
  if (c.watchX !== undefined && Math.hypot(c.x - c.watchX, c.z - c.watchZ) < 0.8) { c.squeeze = 1.6; c.plan = null; }
  c.watch = 0; c.watchX = c.x; c.watchZ = c.z;
}
function walkToward(c, tx, tz, speed, dt, world) {
  noteProgress(c, dt);
  speed *= c.pace || 1;
  const realX = tx, realZ = tz;
  // (Right beside him, straight at him: the way round a low wall would take him off and back, off and back.)
  if (Math.hypot(tx - c.x, tz - c.z) >= NEAR) ({ x: tx, z: tz } = world.route ? world.route(c, tx, tz) : routeVia(c, tx, tz));   // the park's sections need the full way-finding (nav.js)
  const want = Math.atan2(tx - c.x, tz - c.z), side = c.side || 1;
  const look = c.squeeze > 0 ? 0.3 : Math.max(0.3, Math.min(LOOK, Math.hypot(tx - c.x, tz - c.z)));
  const tries = [0, ...ASIDE.map(a => a * side), ...ASIDE.map(a => -a * side)];
  for (const off of tries) {
    // Right beside his target and only held up by something between them (Wally over a low wall, or up on the boxes): he
    // stands and glares. Stepping aside every frame looked like a glitch (Ken, 2026-10-30).
    if (off && Math.hypot(realX - c.x, realZ - c.z) < NEAR) break;
    const h = want + off, nx = c.x + Math.sin(h) * speed * dt, nz = c.z + Math.cos(h) * speed * dt;
    if (!world.free(nx, nz) || !clearAhead(c, h, off ? Math.min(0.6, look) : look, world)) continue;
    if (off) c.side = Math.sign(off);
    const p = world.clamp(nx, nz);
    c.x = p.x; c.z = p.z;
    const d = Math.atan2(Math.sin(h - c.heading), Math.cos(h - c.heading));
    c.heading += Math.sign(d) * Math.min(Math.abs(d), CATCHER.turn * dt);
    c.speed = speed;
    return true;
  }
  c.speed = 0;
  return false;
}

// Where to run, told where Wally is. Close by: at him. Far off: the park's a ring with the crocs in the middle, and
// running straight at a faster Wally only chases him round it on the far side for ever (8 runs in 24 still missed him).
// So he cuts Wally off: he makes for a point part way along Wally's road to the way out.
function headOff(wally, dist) {
  if (dist < CATCHER.see) return { x: wally.x, z: wally.z };
  const a = pathAngle(wally.x, wally.z), left = Math.atan2(Math.sin(EXIT_ANGLE - a), Math.cos(EXIT_ANGLE - a));
  return fencePoint(a + left * CATCHER.ahead, PATH.lanes[1]);
}

// One step. wally: { x, z, out } (out: past the croc fence, where he can be caught).
// world: { screens: segments that block sight, free(x, z): can he stand there, clamp(x, z) }.
// Returns 'spotted', 'lost', 'caught' or null.
export function catcherStep(c, wally, dt, world) {
  if (c.hold > 0) { c.hold -= dt; c.speed = 0; return null; }            // a moment's start for Wally (alertCatcher)
  const dist = Math.hypot(wally.x - c.x, wally.z - c.z);
  const sees = wally.out && dist < CATCHER.see && canSee(c, wally, world.screens);
  let event = null;
  if (sees) {
    if (c.mode !== 'chase') event = 'spotted';
    c.mode = 'chase'; c.unseen = 0; c.last = { x: wally.x, z: wally.z };
  }
  if (c.mode === 'chase') {
    if (!sees) c.unseen += dt;
    if (!wally.out || c.unseen > CATCHER.lose) { c.mode = 'search'; c.look = 0; c.hurry = false; c.tip = CATCHER.shaken; event = 'lost'; }
    else {
      if (dist < CATCHER.reach && !wally.high) { c.mode = 'patrol'; c.speed = 0; return 'caught'; }   // (up on the boxes, he is out of reach)
      walkToward(c, c.unseen ? c.last.x : wally.x, c.unseen ? c.last.z : wally.z, CATCHER.chase, dt, world);
      return event;
    }
  }
  // Wally is loose and the catcher has no sight of him: people point the way (without it a runner who took the other way
  // round was never found at all: 9 runs in 24, test/sections.test.mjs).
  if (wally.out) {
    c.tip = (c.tip === undefined ? CATCHER.tip : c.tip) - dt;
    if (c.tip <= 0) { c.tip = CATCHER.tip; c.last = headOff(wally, dist); c.mode = 'search'; c.look = 0; }
  }
  if (c.mode === 'search') {
    if (c.last && Math.hypot(c.last.x - c.x, c.last.z - c.z) > 1) walkToward(c, c.last.x, c.last.z, c.hurry ? CATCHER.chase : CATCHER.search, dt, world);
    else {
      c.speed = 0; c.look += dt; c.hurry = false;
      if (c.helper) return event;                               // on Wally's side now: he waits where he said he would
      c.heading += dt * 1.5;                                   // looking about
      if (c.look > CATCHER.look) { c.mode = 'patrol'; c.wp = nearestWaypoint(c); }
    }
    return event;
  }
  // Patrol.
  const w = PATROL[c.wp];
  if (Math.hypot(w.x - c.x, w.z - c.z) < 1.5) c.wp = (c.wp + 1) % PATROL.length;
  walkToward(c, PATROL[c.wp].x, PATROL[c.wp].z, CATCHER.patrol, dt, world);
  return event;
}

function nearestWaypoint(c) {
  let best = 0, bd = Infinity;
  PATROL.forEach((w, i) => { const d = Math.hypot(w.x - c.x, w.z - c.z); if (d < bd) { bd = d; best = i; } });
  return best;
}

// The boardwalk's railings outside the croc fence, which the catcher cannot walk through (he
// can see through them). Openings where the path crosses it: deckOpenAt in rules.js.
export function deckRails(openings) {
  const B = BOARDWALK, out = [];
  for (const side of [-1, 1]) {
    const x0 = side > 0 ? LAGOON.rx * FENCE_D : -B.x1, x1 = side > 0 ? B.x1 : -LAGOON.rx * FENCE_D;
    let from = x0;
    const cuts = openings.filter(o => o.x1 > x0 && o.x0 < x1).sort((a, b) => a.x0 - b.x0);
    for (const o of cuts) { if (o.x0 > from) for (const z of [B.z - B.width / 2, B.z + B.width / 2]) out.push({ ax: from, az: z, bx: o.x0, bz: z }); from = o.x1; }
    if (from < x1) for (const z of [B.z - B.width / 2, B.z + B.width / 2]) out.push({ ax: from, az: z, bx: x1, bz: z });
  }
  return out;
}
