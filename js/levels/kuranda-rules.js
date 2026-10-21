// kuranda-rules.js
// Kuranda's places that rules depend on, without drawing (no three.js), so they can
// be tested. The boomerang clearing (Ken, 2026-10-20): about halfway down the street,
// a guide teaches Wally to throw a boomerang; catching it wins the air talisman.
//
// Ground coordinates as in kuranda-scene.js: the street runs along +z, x across it.

export const STREET_HALF = 5;
// The clearing off the right-hand side of the street, between the shop stall (z 92)
// and the treats stall (z 130): kept clear of trees, houses and stalls.
export const CLEARING = { x0: STREET_HALF + 0.3, x1: 27, z0: 96, z1: 127 };
// Where Wally stands to throw: a mark in the clearing, facing away from the street (+x).
// Thrown right-handed it curves left (toward -z) and comes home from the street side,
// so the mark is far enough in that the whole loop stays over the clearing.
export const THROW_SPOT = { x: 14, z: 122, aim: Math.PI / 2 };
// The guide stands beside him, on his right.
export const GUIDE_SPOT = { x: 14.3, z: 123.6 };
// Close enough to the mark to begin.
export const nearThrowSpot = (x, z) => Math.hypot(x - THROW_SPOT.x, z - THROW_SPOT.z) < 2.2;

export function inClearing(x, z, pad = 0) {
  return x > CLEARING.x0 - pad && x < CLEARING.x1 + pad && z > CLEARING.z0 - pad && z < CLEARING.z1 + pad;
}
