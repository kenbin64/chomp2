// treasure-rules.js
// A treasure in every level (Ken, 2026-10-18). Croc Park's is first: a chest on
// the bottom of the lagoon, right in the middle. Wally swims out, dives down,
// finds the things visitors have dropped over the rail that lie on the lagoon
// bed, and once he has them all the chest opens. Box jellies drift up and down
// through the water and a croc guards the chest, so he has to time it.
// Plain JavaScript, no three.js, so it can be tested (test/treasure.test.mjs).

// The things on the bottom: dropped over the boardwalk rail by visitors.
// Not gold coins: those are the reef's, and pay the Skyrail fare.
export const LOST_THINGS = [
  { id: 'sunnies', name: 'Sunnies' },
  { id: 'ring',    name: 'Gold ring' },
  { id: 'watch',   name: 'Watch' },
  { id: 'phone',   name: 'Phone' },
  { id: 'bangle',  name: 'Bangle' },
];

export const PARK_TREASURE = {
  chest: { x: 0, z: 0 },          // the middle of the lagoon
  diveY: -2.2,                    // how deep Wally swims along the bottom
  surfaceY: -0.45,                // where he floats at the top (as everywhere)
  near: 4.5, far: 10,             // how far from the chest the lost things lie
  guardR: 5.5, guardY: -1.3,      // the croc that circles the chest, under water
};

// The treasure's reward in Golden Mangoes: a big one the first time, a small
// one on every later visit (Ken: you can go back to any level).
export const TREASURE_REWARD = { first: 10, again: 2 };

// Where the lost things lie this time: spread round the chest at different
// angles, a new layout every game (Ken: never the same twice). isWater and
// bedY describe the lagoon; every spot is deep water, with room to swim over it.
export function lostSpots(rnd, isWater, bedY, t = PARK_TREASURE, n = LOST_THINGS.length) {
  const spots = [];
  const start = rnd() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const a = start + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
      const r = t.near + rnd() * (t.far - t.near);
      const x = t.chest.x + Math.cos(a) * r, z = t.chest.z + Math.sin(a) * r * 0.65;   // the lagoon is an oval
      if (isWater(x, z) && bedY(x, z) < t.diveY - 0.3) { spots.push({ ...LOST_THINGS[i], x, z, y: bedY(x, z) + 0.25 }); break; }
    }
  }
  return spots;
}

// How deep he swims at (x, z) when he wants to be at wantY: never into the bed.
export function swimDepth(wantY, bed, surfaceY = PARK_TREASURE.surfaceY) {
  return Math.min(surfaceY, Math.max(wantY, bed + 0.65));
}

// Picked up by swimming over it at the bottom.
export function canTake(wx, wz, wy, thing) {
  return Math.hypot(wx - thing.x, wz - thing.z) < 1.4 && Math.abs(wy - thing.y) < 1.1;
}

// The chest opens once every lost thing is found, and Wally is at it.
export function chestOpens(found, total, wx, wz, wy, t = PARK_TREASURE) {
  return found >= total && Math.hypot(wx - t.chest.x, wz - t.chest.z) < 1.8 && wy < t.surfaceY - 1;
}

// A bite from a croc under water: near it, and near its depth. At the surface
// Wally is only pushed aside (crocs.js); down here they mean it.
export function crocBites(wx, wz, wy, cx, cz, cy) {
  return wy < -1 && Math.hypot(wx - cx, wz - cz) < 1.8 && Math.abs(wy - cy) < 1.3;
}

// A deep jelly's height at time t: drifting slowly from just under the surface
// to near the bottom and back, so there is always a moment to slip past.
export function jellyDepth(t, phase, top = -0.15, bottom = -2.4) {
  const u = 0.5 + 0.5 * Math.sin(t * 0.35 + phase);
  return top + (bottom - top) * u;
}
