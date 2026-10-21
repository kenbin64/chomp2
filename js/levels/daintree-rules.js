// daintree-rules.js
// The Daintree River (Ken, 2026-10-20; MASTER.md section 6, the finale's fourth version):
// the rules of the place, no drawing. Tested in test/daintree.test.mjs.
//
// A wide, slow, tea-green tidal river between mud banks lined with mangroves, the
// rainforest behind them and the ranges beyond. The tour boat (the same riverboat seen
// earlier in the trip) cruises down it; Wally swims alongside and the passengers feed
// him. Then the boat runs aground on a sandbar, and the story moves on (the sandbar
// scene, then the rainforest and the King).
//
// The course runs along +z. Heights in metres; the water's surface is y = 0.

export const HALF = 26;                    // half the river's width
export const MUD = 9;                      // the mud bank past the water, where the mangroves stand
export const FOREST = HALF + MUD;          // past this from the river's line, the rainforest: no way on
export const SURFACE_DROP = 0.45;          // where Wally floats, below the surface
export const START_Z = 6;                  // Wally starts here, the boat a little ahead
export const BOAT_START_Z = 22;
export const BOAT_SIDE = 5;                // the boat keeps to this side of the river's line (+x)
export const BOAT_SPEED = 3.2;             // metres a second, cruising
export const BOAT_LENGTH = 10;
export const SANDBAR = { z: 372, rx: 9, rz: 16, top: 0.3 };   // its centre is on the boat's line
export const AGROUND_Z = SANDBAR.z - SANDBAR.rz - BOAT_LENGTH / 2 + 2;   // where the boat's bow runs onto it
export const THROW_NEAR = 3.5, THROW_FAR = 15;   // the passengers throw when he is this far from the boat
export const LEAD_SLOW = 18;               // the boat this far ahead of him: it slows, so he can catch up
export const LEAD_WAIT = 32;               // this far: it all but stops

// The river winds: its centre line at z.
export const riverX = z => Math.sin(z * 0.011) * 16 + Math.sin(z * 0.029 + 1) * 6;
export const boatX = z => riverX(z) + BOAT_SIDE;
export const SANDBAR_X = boatX(SANDBAR.z);

// How far across from the river's line (0 in the middle).
export const across = (x, z) => Math.abs(x - riverX(z));

export function onSandbar(x, z) {
  const dx = (x - SANDBAR_X) / SANDBAR.rx, dz = (z - SANDBAR.z) / SANDBAR.rz;
  return dx * dx + dz * dz <= 1;
}

// What is under (x, z): { surface: 'water' | 'sand' | 'mud', y }. In the water, y is
// where he floats; on land, the ground.
export function groundAt(x, z) {
  if (onSandbar(x, z)) {
    const dx = (x - SANDBAR_X) / SANDBAR.rx, dz = (z - SANDBAR.z) / SANDBAR.rz;
    return { surface: 'sand', y: SANDBAR.top * (1 - (dx * dx + dz * dz)) + 0.02 };
  }
  const d = across(x, z);
  if (d < HALF) return { surface: 'water', y: -SURFACE_DROP };
  return { surface: 'mud', y: 0.15 + (d - HALF) * 0.12 };        // the bank rises gently out of the water
}
// The river bed under the water (for drawing): deepest in the middle.
export const bedAt = (x, z) => -1.2 - 2.4 * Math.max(0, 1 - across(x, z) / HALF);

// Inside the river and its banks: never into the rainforest, never back past the start.
export const insideRiver = (x, z) => across(x, z) < FOREST && z > -4 && z < SANDBAR.z + SANDBAR.rz + 20;

// The boat's speed: cruising, slower when he has fallen behind (so the feeding goes on),
// a little quicker when he is out in front. lead = boat z less his z.
export function boatSpeed(lead) {
  if (lead >= LEAD_WAIT) return BOAT_SPEED * 0.08;
  if (lead > LEAD_SLOW) return BOAT_SPEED * (1 - 0.92 * (lead - LEAD_SLOW) / (LEAD_WAIT - LEAD_SLOW));
  if (lead < -4) return BOAT_SPEED * 1.25;
  return BOAT_SPEED;
}

// The boat moves on by dt; it stops where it runs aground. Returns the new z.
export const boatStep = (z, lead, dt) => Math.min(AGROUND_Z, z + boatSpeed(lead) * dt);
export const aground = z => z >= AGROUND_Z - 1e-9;

// Do the passengers throw to him? Near enough to reach, not so near they shy away.
export function inThrowRange(wx, wz, bz) {
  const d = Math.hypot(wx - boatX(bz), wz - bz);
  return d >= THROW_NEAR && d <= THROW_FAR;
}

// Wild crocs along the banks, at the water's edge: [{ x, z, side }].
export function crocSpots() {
  const out = [];
  for (let z = 50, i = 0; z < SANDBAR.z - 40; z += 58, i++) {
    const side = i % 2 ? 1 : -1;
    out.push({ x: riverX(z) + side * (HALF - 3), z, side });
  }
  return out;
}
// Where the crocs come up round the stuck boat (the sandbar scene): a ring on the open water side.
export function crocsRoundBoat(n = 5) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.85 + (i / (n - 1)) * Math.PI * 0.7;   // round the stern and the port side
    out.push({ x: boatX(AGROUND_Z) + Math.cos(a) * 9, z: AGROUND_Z + Math.sin(a) * 9 });
  }
  return out;
}
