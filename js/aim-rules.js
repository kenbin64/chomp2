// aim-rules.js
// Aim help for the keyboard (Ken, 2026-10-26: "aim help is great"). While Wally runs and a piece of food is
// coming down close by and roughly ahead, his heading leans gently toward where it will land, so a near miss
// becomes a catch. It never turns him on its own when he is standing, never pulls toward food behind him, and
// is weaker than the keys, so the player is always the one steering.

export const AIM = {
  reach: 7,          // metres: food landing further away than this gets no help
  cone: 0.7,         // radians either side of straight ahead (about 40 degrees)
  rate: 1.8,         // the most it turns him, radians a second (the keys turn up to 3.4)
};

// Aim slowdown, the way console games help a thumb stop on a target: while the player turns him toward a piece
// of food close by, the turn slows as his heading reaches it, so he stops on the food instead of swinging past
// and back (measured 2026-10-26: about 60 turn reversals a minute). It only ever slows a turn the player is
// making; it never turns him.
//   turning: the player's turn this frame, as input.right (+ turns him one way, - the other; 0 none)
// Returns the share of the turn to keep, 0.3 to 1.
export const SLOW = { near: 0.2, keep: 0.6 };    // radians from the food where slowing starts; the least kept
export function aimSlow({ pos, facing, turning, landings }) {
  if (!turning || !landings || !landings.length) return 1;
  const dir = -Math.sign(turning);                // input.right > 0 makes the facing angle smaller (wally.js)
  let keep = 1;
  for (const l of landings) {
    const dx = l.x - pos.x, dz = l.z - pos.z, d = Math.hypot(dx, dz);
    if (d > AIM.reach || d < 0.3) continue;
    const err = Math.atan2(Math.sin(Math.atan2(dx, dz) - facing), Math.cos(Math.atan2(dx, dz) - facing));
    // Only when the turn is carrying him onto the food (or just past it), and close to it.
    if (Math.abs(err) > SLOW.near || (Math.sign(err) !== dir && Math.abs(err) > 0.05)) continue;
    keep = Math.min(keep, SLOW.keep + (1 - SLOW.keep) * Math.abs(err) / SLOW.near);
  }
  return keep;
}

// How far to turn him this frame (radians, + is the same way as the facing angle grows), or 0.
//   pos: { x, z }      facing: radians (0 is +z)      running: is the player moving him forward?
//   landings: [{ x, z }] where each falling piece will come down to his mouth height
export function aimTurn({ pos, facing, running, landings, dt }) {
  if (!running || !landings || !landings.length) return 0;
  let best = null;
  for (const l of landings) {
    const dx = l.x - pos.x, dz = l.z - pos.z, d = Math.hypot(dx, dz);
    if (d > AIM.reach || d < 0.3) continue;
    const err = Math.atan2(Math.sin(Math.atan2(dx, dz) - facing), Math.cos(Math.atan2(dx, dz) - facing));
    if (Math.abs(err) > AIM.cone) continue;
    if (!best || d < best.d) best = { d, err };
  }
  if (!best) return 0;
  // Stronger when nearly lined up, fading to nothing at the edge of the cone, and never past the target.
  const strength = 1 - Math.abs(best.err) / AIM.cone;
  const step = AIM.rate * strength * dt;
  return Math.sign(best.err) * Math.min(Math.abs(best.err), step);
}
