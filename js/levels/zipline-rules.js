// zipline-rules.js
// The Barron Gorge zip line (Ken, 2026-10-18): ride down the gorge past the
// falls, swing and tuck to collect what hangs along the line, duck the
// branches, and brake to land cleanly on the far platform. Plain JavaScript,
// no three.js, so it can be tested (test/zipline.test.mjs).
//
// The line runs from its top platform (s = 0) to the far platform (s = 1),
// along -z, sagging in the middle. Wally hangs below the trolley; Left/Right
// swing him to the side, Up tucks his legs up, Down lets him dangle low, Space
// brakes.

export const LINES = {
  practice: { name: 'Practice line', length: 220, top: 48, bottom: 30, sag: 4, items: 14, branches: 3, night: false },
  falls:    { name: 'Falls line',    length: 320, top: 70, bottom: 36, sag: 6, items: 22, branches: 6, night: false, spray: true },
  night:    { name: 'Night line',    length: 320, top: 70, bottom: 36, sag: 6, items: 26, branches: 7, night: true },
};
export const HANG = 2.0;           // metres from the cable down to Wally's middle
export const SWAY = 1.6;           // how far to either side he can swing
export const TUCK = 0.7, DANGLE = 0.9;
export const BRAKE_ZONE = 60;      // metres before the end where braking works best
export const LAND = { perfect: 3, padSpeed: 4.5 };
export const POINTS = { mango: 10, gold: 15, token: 25, gear: 40, perfect: 100, pad: 20, branch: -15 };

// The cable's height at s (0 to 1): a straight run from top to bottom, sagging in the middle.
export function cableY(line, s) { return line.top + (line.bottom - line.top) * s - line.sag * 4 * s * (1 - s); }
// The slope at s (how steeply it falls, metres down per metre along).
export function slope(line, s) { const e = 0.001; return (cableY(line, Math.max(0, s - e)) - cableY(line, Math.min(1, s + e))) / (2 * e * line.length); }

// One step of the ride: gravity down the slope, air drag, and the brake.
export function ride(state, line, dt, braking) {
  const g = 9.8 * slope(line, state.s), drag = 0.006 * state.v * state.v;
  const left = (1 - state.s) * line.length, inZone = left < BRAKE_ZONE;
  // In the brake zone the brake does just what it takes to stop him at the
  // platform, so holding Space through the zone lands him (Ken: fair, readable);
  // let go too soon and he comes in hot, brake out of the zone and he stops short.
  const ideal = state.v * state.v / (2 * Math.max(0.6, left - 1.2)) - g + drag;
  const brake = braking ? (inZone ? Math.min(9, Math.max(0.4, ideal)) : 2.5) : 0;
  state.v = Math.max(0, state.v + (g - drag - brake) * dt);
  state.s = Math.min(1, state.s + state.v * dt / line.length);
  return state;
}

// How he lands: 'perfect' (stopped right at the platform, or came in gently),
// 'pad' (too fast: into the safety pad), 'short' (stopped well before it:
// hand over hand the rest), or null while still riding.
export function landing(state, line) {
  const left = (1 - state.s) * line.length;
  if (state.s >= 1) return state.v > LAND.padSpeed ? 'pad' : 'perfect';
  if (state.v <= 0.05 && state.started) return left <= LAND.perfect ? 'perfect' : 'short';
  return null;
}

// Things along the line: what kind, how far along, how far to the side, and
// high or low (some need him to tuck up or dangle). Same seed, same line.
export function layout(line, seed = 1) {
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const items = [];
  for (let i = 0; i < line.items; i++) {
    const s = 0.08 + (i + rnd() * 0.6) / line.items * 0.8;
    const k = rnd(), kind = k < 0.55 ? 'mango' : k < 0.85 ? 'gold' : k < 0.97 ? 'token' : 'gear';
    const v = rnd(), height = v < 0.25 ? TUCK : v < 0.5 ? -DANGLE : 0;
    items.push({ kind, s, side: (rnd() * 2 - 1) * SWAY, height });
  }
  const branches = [];
  for (let i = 0; i < line.branches; i++) {
    const s = 0.15 + (i + 0.3 + rnd() * 0.4) / line.branches * 0.7;
    branches.push({ s, side: rnd() < 0.5 ? -1 : 1 });              // a branch reaching in from one side, at body height
  }
  return { items, branches };
}

// Does he collect it, passing it at his side offset and height?
export function reaches(item, side, height) { return Math.abs(item.side - side) < 0.75 && Math.abs(item.height - height) < 0.6; }
// Does a branch catch him? Only if he is not tucked up, and on its side of the line.
export function hitsBranch(branch, side, height) { return height < TUCK * 0.6 && Math.sign(side || 0.001) === branch.side && Math.abs(side) > 0.2 || (height < TUCK * 0.6 && Math.abs(side) <= 0.2); }

// Points for a ride.
export function score(got, branchesHit, land) {
  let p = 0;
  for (const [k, n] of Object.entries(got)) p += (POINTS[k] || 0) * n;
  p += branchesHit * POINTS.branch;
  if (land === 'perfect') p += POINTS.perfect; else if (land === 'pad') p += POINTS.pad;
  return Math.max(0, p);
}
