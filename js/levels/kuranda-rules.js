// kuranda-rules.js
// Kuranda's places that rules depend on, without drawing (no three.js), so they can
// be tested. The boomerang clearing (Ken, 2026-10-20): about halfway down the street,
// a guide teaches Wally to throw a boomerang; catching it wins the air talisman.
//
// Ground coordinates as in kuranda-scene.js: the street runs along +z, x across it.

export const STREET_HALF = 5;
// The clearing off the street, on Wally's left as he walks down it (the +x side), between
// the shop stall (z 92) and the treats stall (z 130): kept clear of trees, houses and stalls.
export const CLEARING = { x0: STREET_HALF + 0.3, x1: 27, z0: 96, z1: 127 };
// Where Wally stands to throw: a mark in the clearing, facing away from the street (+x).
// Thrown right-handed it curves left (toward -z) and comes home from the street side,
// so the mark is far enough in that the whole loop stays over the clearing.
export const THROW_SPOT = { x: 14, z: 122, aim: Math.PI / 2 };
// Visitors learning at the far side of the clearing, throwing while nobody is at the mark
// (Ken: other people throwing boomerangs). aim as for THROW_SPOT; their loops stay over the clearing.
export const THROWERS = [{ x: 23, z: 100, aim: -Math.PI / 2 }, { x: 23, z: 114, aim: -Math.PI / 2 }];
// The instructor walks up from across the clearing to stand beside Wally.
export const GUIDE_FROM = { x: 20, z: 119.5 };
// The guide stands beside him, on his right.
export const GUIDE_SPOT = { x: 14.3, z: 123.6 };
// Close enough to the mark to begin.
export const nearThrowSpot = (x, z) => Math.hypot(x - THROW_SPOT.x, z - THROW_SPOT.z) < 2.2;
// The way in from the street: under the archway, centred at z, half its width each way.
export const ENTRY = { z: (CLEARING.z0 + CLEARING.z1) / 2, half: 5 };
// Stepping into the clearing (a metre past its edge) starts the throw, in first person.
export const enteredClearing = (x, z) => inClearing(x, z, -1);

export function inClearing(x, z, pad = 0) {
  return x > CLEARING.x0 - pad && x < CLEARING.x1 + pad && z > CLEARING.z0 - pad && z < CLEARING.z1 + pad;
}
