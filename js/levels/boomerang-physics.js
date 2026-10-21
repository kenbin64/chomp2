// boomerang-physics.js
// The boomerang's flight by its forces (Ken, 2026-10-20): Wally lifts the boomerang
// to a tilt (the angle meter) and throws it with a force (the force meter); the
// physics says whether it comes back to his hand or veers off. Plain JavaScript, no
// three.js, so it can be tested (test/boomerang-physics.test.mjs).
//
// A simplified model of a real returning boomerang, thrown right-handed:
//   - The spinning wings make LIFT at right angles to the boomerang's plane, growing
//     with the square of its speed. Thrown near upright and tilted a little to the
//     left (the "layover"), most of the lift pushes sideways, to the left: that is
//     what bends the flight into a circle. The little that points up holds it up.
//   - Gyroscopic precession turns the boomerang's plane with its flight, so the lift
//     keeps pointing into the circle. (Modelled directly: the plane follows the heading.)
//   - It lays over a little more as it flies (it flattens), and it loses speed to drag
//     and spin to the air.
// What falls out, with nothing scripted: the circle's size hardly depends on how hard
// it is thrown (both lift and the turn grow with speed squared), as with a real one.
// Too upright and nothing holds it up: it dives into the ground. Too flat, or thrown
// too hard, and the upward lift wins: it climbs and sails off over his head. Too soft
// and it sinks short. About right, and it comes round to his hand. A flatter throw
// needs less force (more of its lift holds it up). The spinning wings keep some lift
// as it slows, so it comes home slowly enough to catch.
//
// Ground coordinates: x and z flat, y up. Angles in degrees at the edges, radians inside.

export const HAND_Y = 1.6;               // where Wally holds it, and catches it
export const TILT_RANGE = [0, 60];       // the angle meter: degrees of layover from upright
export const IDEAL_TILT = 20;            // about here it comes back,
export const IDEAL_FORCE = 0.42;         // thrown about this hard (the guide's demonstration)
export const SPEED = [10, 26];           // the force meter, 0 to 1, as metres a second
export const CATCH_REACH = 1.6;          // it came back: it passed this close to his hands
export const HANDS_REACH = 2.2;          // and he can catch it this far out (a step and a reach)
export const G = 9.8;
// The air: tuned (a search over these, by simulation) so the throws that come back sit
// round the middle of both meters, with room either side. fly() takes overrides for testing.
export const AIR = {
  lift: 0.14,            // lift per (m/s)^2, per kilogram: sets the circle
  drag: 0.025,           // drag per (m/s)^2
  spinLoss: 0.05,        // the share of spin lost each second
  spinLift: 9,           // the spinning wings' own airspeed (m/s): lift that stays when it slows, so it hovers in
  layoverRate: 6,        // degrees it flattens each second
  maxLayover: 45,        // and no flatter than this
  elevation: 0,          // degrees above level that he throws
};
const DT = 1 / 120;

const rad = d => d * Math.PI / 180;
export const speedFor = force => SPEED[0] + (SPEED[1] - SPEED[0]) * Math.min(1, Math.max(0, force));

// Throws from `from` ({x, y, z}) toward heading `aim` (radians, 0 = -z, turning toward +x),
// tilted `tilt` degrees, with force 0 to 1. Returns the flight sampled every DT seconds
// until it lands or comes back past him: [{ t, x, y, z, tilt }].
export function fly(from, aim, tilt, force, { maxT = 8, air = {} } = {}) {
  const A = { ...AIR, ...air };
  const v0 = speedFor(force), el = rad(A.elevation);
  let x = from.x, y = from.y, z = from.z;
  let vx = Math.sin(aim) * Math.cos(el) * v0, vz = -Math.cos(aim) * Math.cos(el) * v0, vy = Math.sin(el) * v0;
  let phi = rad(Math.min(TILT_RANGE[1], Math.max(TILT_RANGE[0], tilt))), spin = 1;
  const path = [{ t: 0, x, y, z, tilt: phi * 180 / Math.PI }];
  for (let t = DT; t <= maxT; t += DT) {
    const sp2 = vx * vx + vy * vy + vz * vz, sp = Math.sqrt(sp2), h = Math.hypot(vx, vz) || 1e-6;
    // The plane follows the heading (precession): "left" is the horizontal left of the flight.
    const lx = vz / h, lz = -vx / h;                                     // left of (vx, vz), for heading 0 = -z
    // The plane's normal: mostly to the left, tilted up by the layover. Lift acts at right
    // angles to the airflow, so only the part of the normal across the flight counts (lift
    // then never adds energy: a climb is paid for in speed, and the flight cannot run away).
    let nx = Math.cos(phi) * lx, ny = Math.sin(phi), nz = Math.cos(phi) * lz;
    const along = (nx * vx + ny * vy + nz * vz) / (sp || 1e-6);
    nx -= along * vx / (sp || 1e-6); ny -= along * vy / (sp || 1e-6); nz -= along * vz / (sp || 1e-6);
    const L = A.lift * (sp2 + A.spinLift * A.spinLift) * spin;
    const ax = L * nx - A.drag * sp * vx;
    const az = L * nz - A.drag * sp * vz;
    const ay = L * ny - G - A.drag * sp * vy;
    vx += ax * DT; vy += ay * DT; vz += az * DT;
    x += vx * DT; y += vy * DT; z += vz * DT;
    phi = Math.min(rad(A.maxLayover), phi + rad(A.layoverRate) * DT);
    spin *= 1 - A.spinLoss * DT;
    path.push({ t, x, y, z, tilt: phi * 180 / Math.PI });
    if (y <= 0) { path[path.length - 1].y = 0; break; }                 // on the ground
  }
  return path;
}

// What became of a throw: 'back' (it came within reach of his hands, in the air, after
// going out), 'short' (it came down before getting back), 'over' (it went up and
// past or round over his head) or 'away' (it veered off and never came near).
// Also the closest it came on the way back, and when.
export function outcome(path, hands, reach = CATCH_REACH) {
  // The way back starts at its farthest point out; the closest it comes after that.
  let far = 0, farAt = 0;
  path.forEach((p, i) => { const d = Math.hypot(p.x - hands.x, p.z - hands.z); if (d > far) { far = d; farAt = i; } });
  let best = Infinity, bestAt = -1;
  for (let i = farAt; i < path.length; i++) {
    const p = path[i], d = Math.hypot(p.x - hands.x, p.y - hands.y, p.z - hands.z);
    if (d < best) { best = d; bestAt = i; }
  }
  const landed = path[path.length - 1].y <= 0;
  const pass = path[Math.max(0, bestAt)];
  let kind;
  if (best < reach) kind = 'back';
  else if (pass.y > hands.y + 0.5) kind = 'over';       // high over his head, or round him up in the air
  else if (landed) kind = 'short';                     // down on the ground before it got back
  else kind = 'away';                                  // off on its own, never near him
  return { kind, closest: best, at: bestAt, far, landed };
}

// Can he catch it at sample i? Coming back, still in the air, within reach.
export function catchableAt(path, i, hands, reach = HANDS_REACH) {
  const p = path[Math.min(i, path.length - 1)];
  if (!p || p.y <= 0 || p.t < 1) return false;
  return Math.hypot(p.x - hands.x, p.y - hands.y, p.z - hands.z) < reach;
}

export const sampleAt = (path, t) => path[Math.min(path.length - 1, Math.max(0, Math.round(t / DT)))];
export const STEP = DT;
