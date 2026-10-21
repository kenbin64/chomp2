// coast-rules.js
// Up the coast to the Daintree (Ken, 2026-10-21; MASTER.md section 6, the rescue): Wally leads the
// crocs of Croc Park north along the coast from Cairns to the mouth of the Daintree River. Boats come
// alongside and throw him food, since he is still part human. The rules, no drawing; tested in
// test/coast.test.mjs. The crocs' line is rescue-rules.js's (his trail, a spacing apart).
//
// The course runs north along +z; facing north the land is on his left (+x here, as the camera
// sees it), the open sea to the right. Distances
// are compressed: the real way is about 100 km.

export const LENGTH = 720;                  // metres from the start off Cairns to the river mouth
export const START_Z = 0, MOUTH_Z = LENGTH;
export const BEACH = 6;                     // the sand between the water's edge and the trees
export const LANE = 34;                     // how far out to sea he may swim from the water's edge
export const SURFACE_DROP = 0.45;

// The water's edge (x) at z: a long coast with headlands and bays, the river mouth at the end.
export const shoreX = z => 30 + Math.sin(z * 0.009) * 14 + Math.sin(z * 0.023 + 1) * 6 + Math.max(0, (z - (MOUTH_Z - 60)) * 0.15);
// Places along the way (shown as they pass): [z, name].
export const PLACES = [[-Infinity, 'Off Cairns'], [230, 'Palm Cove'], [470, 'Port Douglas'], [MOUTH_Z - 40, 'The Daintree River mouth']];
export const placeAt = z => PLACES.filter(p => z >= p[0]).pop()[1];

export const inWater = (x, z) => x < shoreX(z);
// Where he may swim: in the water, no further out than the lane, between the start and the mouth.
export function swimStep(x, z, nx, nz) {
  const ok = (px, pz) => px < shoreX(pz) - 1 && px > shoreX(pz) - LANE && pz > START_Z - 10 && pz < MOUTH_Z + 30;
  if (ok(nx, nz)) return { x: nx, z: nz };
  if (ok(nx, z)) return { x: nx, z };
  if (ok(x, nz)) return { x, z: nz };
  return { x, z };
}
export const reachedMouth = z => z >= MOUTH_Z;

// The boats: each keeps alongside Wally, out to sea of him, a little ahead or behind, at a boat's
// speed; they space themselves out along the line. A boat's place for Wally at (wx, wz):
export const BOAT_OUT = 11, BOAT_SPEED = 7;
export const BOATS = [{ ahead: 6 }, { ahead: -16 }, { ahead: 26 }];
export function boatTarget(b, wx, wz) {
  const z = wz + b.ahead;
  return { x: Math.max(wx - BOAT_OUT, shoreX(z) - LANE - 8), z };
}
export function boatStep(p, target, dt) {
  const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.3) return { ...p };
  const go = Math.min(d, BOAT_SPEED * dt);
  return { x: p.x + dx / d * go, z: p.z + dz / d * go, heading: Math.atan2(dx, dz) };
}
// The passengers throw when he is in reach of their boat, not right under its bow.
export const inThrowRange = (bx, bz, wx, wz) => { const d = Math.hypot(bx - wx, bz - wz); return d > 4 && d < 16; };
