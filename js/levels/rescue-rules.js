// rescue-rules.js
// Back in Croc Park (Ken, 2026-10-21; MASTER.md section 6, the rescue): with the sceptre at full
// power, Wally calls out every croc in the park and leads them to the sea, on their way up the coast
// to the Daintree. The rules of it, no drawing; tested in test/rescue.test.mjs.
//
//   - Walk up to a croc and the sceptre calls it: it joins the line following Wally.
//   - Each croc in the line follows his trail, a few metres behind the one in front, so the line
//     snakes after him the way he went (not cutting corners across the lagoon).
//   - With every croc called, the fence opens on the harbour side (north, -z).
//   - Out through the gap, over the sand and into the sea; when the whole line is in the water
//     out past the beach, the crocs are free.
// The park is world.js's: the lagoon at the middle, the fence round it, the harbour beyond z = -64.

import { LAGOON } from '../rules.js';

export const CALL = 6;                       // metres: the sceptre calls a croc this close
export const SPACING = 3.2;                  // metres between crocs in the line
export const FENCE = { rx: LAGOON.rx * 1.42, rz: LAGOON.rz * 1.42 };   // the fence's oval (world.js)
export const GAP = { x: 0, half: 4 };        // the opening in the fence, on the harbour side
export const BEACH_Z = -64, SEA_Z = -72;     // the sand begins at the fence's edge of the harbour; past SEA_Z, open water
export const SHORE = { x0: -60, x1: 60 };    // how far along the beach he may go

// Where the crocs are when he arrives: some in the lagoon, some basking on the banks.
export function startingCrocs() {
  const out = [];
  [[0.2, 0.55], [1.3, 0.4], [2.4, 0.65], [3.5, 0.3], [4.6, 0.6], [5.6, 0.45]].forEach(([a, d]) => out.push({ x: Math.cos(a) * LAGOON.rx * d, z: Math.sin(a) * LAGOON.rz * d, place: 'lagoon' }));
  [[0.9, 1.15], [2.0, 1.2], [3.9, 1.15], [5.2, 1.2]].forEach(([a, d]) => out.push({ x: Math.cos(a) * LAGOON.rx * d, z: Math.sin(a) * LAGOON.rz * d, place: 'bank' }));
  return out;
}

// Inside the fence's oval (the park), 1 at the fence.
export const fenceDistance = (x, z) => Math.hypot(x / FENCE.rx, z / FENCE.rz);
// In the gap's corridor: through the fence on the harbour side.
export const inGap = (x, z) => Math.abs(x - GAP.x) < GAP.half && z < 0 && fenceDistance(x, z) > 0.85;
// Out on the beach side of the fence, between the fence and the sea.
export const onShore = (x, z) => z < 0 && fenceDistance(x, z) >= 1 && x > SHORE.x0 && x < SHORE.x1 && z > SEA_Z - 30;
export const inSea = (x, z) => z < SEA_Z;

// Where Wally may be: inside the fence as always; once it is open, out through the gap and along
// the shore into the sea too. Returns the place he ends up stepping from (x, z) toward (nx, nz).
export function step(x, z, nx, nz, open, inside = (px, pz) => fenceDistance(px, pz) < 0.95) {
  const ok = (px, pz) => inside(px, pz) || (open && (inGap(px, pz) || onShore(px, pz)));
  if (ok(nx, nz)) return { x: nx, z: nz };
  if (ok(nx, z)) return { x: nx, z };
  if (ok(x, nz)) return { x, z: nz };
  return { x, z };
}

// His trail: points every TRAIL metres, newest first, as long as the line needs.
export const TRAIL = 0.4;
export function addToTrail(trail, x, z, length) {
  if (!trail.length || Math.hypot(trail[0].x - x, trail[0].z - z) >= TRAIL) trail.unshift({ x, z });
  const keep = Math.ceil(length / TRAIL) + 4;
  if (trail.length > keep) trail.length = keep;
  return trail;
}
// Where the k-th croc in the line wants to be (k from 1): SPACING * k back along the trail.
export function placeInLine(trail, k) {
  if (!trail.length) return null;
  let need = SPACING * k;
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i], d = Math.hypot(b.x - a.x, b.z - a.z);
    if (need <= d) { const u = need / d; return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }; }
    need -= d;
  }
  return trail[trail.length - 1];
}
// A croc moving toward its place: no faster than it can swim or walk, and it stops short so the line
// does not bunch. Returns its new { x, z, heading } and whether it is moving.
export const CROC_SPEED = 5.5;
export function follow(c, target, dt) {
  const dx = target.x - c.x, dz = target.z - c.z, d = Math.hypot(dx, dz);
  if (d < 0.4) return { x: c.x, z: c.z, heading: c.heading, moving: false };
  const go = Math.min(d - 0.3, CROC_SPEED * dt);
  return { x: c.x + dx / d * go, z: c.z + dz / d * go, heading: Math.atan2(dx, dz), moving: true };
}

export const allCalled = crocs => crocs.every(c => c.called);
export const allInSea = crocs => crocs.every(c => inSea(c.x, c.z));
