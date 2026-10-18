// boomerang-rules.js
// Boomerang throwing (Ken, 2026-10-18): throw at targets (things, never
// animals) and catch it as it comes back round. Plain JavaScript, no three.js,
// so it can be tested (test/boomerang.test.mjs). Ground coordinates: x and z
// flat, y up; Wally throws from `from` facing the direction `aim` (radians,
// 0 = -z, turning toward +x).
//
// A right-handed throw curves round to the LEFT and comes back. Three things
// set the flight:
//   aim    which way it leaves: a little right of the target, since it curves left
//   power  how big the loop is (0 to 1): a bigger loop reaches further targets
//   angle  the release angle in degrees: about IDEAL_ANGLE brings it back to
//          hand; lower and it falls short and drops; higher and it climbs and
//          sails over his head

export const IDEAL_ANGLE = 15;
export const ANGLE_RANGE = [0, 40];
export const THROWS = 6;
export const CATCH_REACH = 2.2;            // metres from Wally's hands
export const POINTS = { hit: 50, catch: 100, both: 50 };

// The flight for a throw: everything needed to say where the boomerang is.
export function flight(from, aim, power, angle) {
  const p = Math.min(1, Math.max(0, power));
  const R = 5 + 9 * p;                                // radius of the loop
  const T = 2.4 + 1.4 * p;                            // seconds in the air
  const err = (angle - IDEAL_ANGLE) / 15;             // 0 just right; - too low; + too high
  const dir = [Math.sin(aim), -Math.cos(aim)];        // which way it leaves
  const left = [dir[1], -dir[0]];                     // the side it curves toward
  const centre = [from.x + left[0] * R, from.z + left[1] * R];
  const H = 2.2 + Math.max(0, angle) * 0.12;          // how high it climbs
  const drop = err < 0 ? -err * 6.5 : 0;              // too low: it sinks as it goes
  const over = err > 0 ? err * R * 0.55 : 0;          // too high: it sails past behind him
  return { from, aim, power: p, angle, R, T, dir, left, centre, H, drop, over };
}

// Where it is at u (0 at release, 1 when it is back at Wally), or on the ground once it has dropped.
export function positionAt(f, u) {
  const th = Math.PI * 2 * u;
  // Start at Wally, round the centre, curving to the left.
  const rx = -f.left[0] * f.R, rz = -f.left[1] * f.R;          // from the centre back to Wally
  const c = Math.cos(th), s = Math.sin(th);
  // Rotating rx,rz by th (the way that sends it off along dir first).
  const sign = (f.dir[0] * (-rz) + f.dir[1] * rx) >= 0 ? 1 : -1;
  const x = f.centre[0] + rx * c - sign * rz * s;
  const z = f.centre[1] + sign * rx * s + rz * c;
  const back = f.over * u * u;                                 // sailing past, behind him
  const y = 1.6 + Math.sin(Math.PI * u) * f.H - f.drop * u * u;
  return { x: x - f.dir[0] * back, y: Math.max(0, y), z: z - f.dir[1] * back };
}

// Has it hit the ground (fallen short)? The first u where it touches down, or null.
export function landsAt(f, steps = 200) {
  for (let i = 1; i <= steps; i++) { const u = i / steps; if (positionAt(f, u).y <= 0.05) return u; }
  return null;
}

// Targets hit on the way round: any whose centre it passes within (r + 0.35) of.
export function hits(f, targets, steps = 240) {
  const end = landsAt(f) ?? 1, out = new Set();
  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * end, p = positionAt(f, u);
    targets.forEach((t, k) => { if (Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z) < t.r + 0.35) out.add(k); });
  }
  return [...out];
}

// Can Wally catch it at u? Late in the flight, still in the air, within reach of his hands.
export function catchable(f, u, hands) {
  if (u < 0.85) return false;
  const l = landsAt(f); if (l !== null && u >= l) return false;
  const p = positionAt(f, u);
  return Math.hypot(p.x - hands.x, p.y - hands.y, p.z - hands.z) < CATCH_REACH;
}

// Points for one throw.
export function throwPoints(hitCount, caught) {
  return hitCount * POINTS.hit + (caught ? POINTS.catch : 0) + (hitCount && caught ? POINTS.both : 0);
}
