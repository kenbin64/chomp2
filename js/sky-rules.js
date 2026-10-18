// sky-rules.js
// Day and night (Ken, 2026-10-18): the levels go dark now and then, the street
// lamps light the scene, and the moon is up the way it really looks from
// Cairns. Plain JavaScript, no three.js, so it can be tested (test/sky.test.mjs).
// Directions are [x, y, z] with y up; each level says which way is north.

// ---- The cycle --------------------------------------------------------------------
// Seconds of each part of a day in the game. Long enough days to play in, nights
// long enough to matter, and a dusk and a dawn so it never just snaps.
export const CYCLE = { day: 150, dusk: 18, night: 70, dawn: 18 };
export const CYCLE_LENGTH = CYCLE.day + CYCLE.dusk + CYCLE.night + CYCLE.dawn;

const ease = u => u * u * (3 - 2 * u);

// How dark it is at time t (seconds into the cycle): 0 full day, 1 full night.
export function nightAmount(t, c = CYCLE) {
  const len = c.day + c.dusk + c.night + c.dawn;
  let u = ((t % len) + len) % len;
  if (u < c.day) return 0;
  u -= c.day;
  if (u < c.dusk) return ease(u / c.dusk);
  u -= c.dusk;
  if (u < c.night) return 1;
  u -= c.night;
  return 1 - ease(u / c.dawn);
}

// How far through the dark part (dusk to dawn) we are, 0 to 1: where the moon is on its way across.
export function nightProgress(t, c = CYCLE) {
  const len = c.day + c.dusk + c.night + c.dawn;
  const u = ((t % len) + len) % len - c.day;
  return Math.min(1, Math.max(0, u / (c.dusk + c.night + c.dawn)));
}

// ---- The moon, as it really is tonight ----------------------------------------------
// Its age in days since new moon, from a known new moon (6 Jan 2000, 18:14 UTC)
// and the average length of a lunar month.
export const SYNODIC = 29.530588853;
const NEW_MOON_2000 = Date.UTC(2000, 0, 6, 18, 14);
export function moonAge(date) {
  const days = (date.getTime() - NEW_MOON_2000) / 86400000;
  return ((days % SYNODIC) + SYNODIC) % SYNODIC;
}
// The angle between the moon and the sun seen from Earth (0 new, PI full, back to 2 PI).
export function moonElongation(date) { return (moonAge(date) / SYNODIC) * Math.PI * 2; }
// How much of the face is lit, 0 to 1.
export function moonLit(date) { return (1 - Math.cos(moonElongation(date))) / 2; }
export function waxing(date) { return moonElongation(date) < Math.PI; }

const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Where the moon is in the sky at progress u through the night, for a level
// whose north is the direction `north` (flat, y = 0). From Cairns (about 17
// degrees south) the moon rises in the east, crosses high in the NORTHERN sky
// and sets in the west. It is kept a little lower than in life (top about 55
// degrees) so it is in the picture more often.
export function moonDirection(u, north = [0, 0, -1], top = 55) {
  const n = norm(north), up = [0, 1, 0], east = cross(n, up);
  const az = Math.PI * u;                                   // 0 east, PI/2 north, PI west
  const alt = (top * Math.PI / 180) * Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
  const h = [east[0] * Math.cos(az) + n[0] * Math.sin(az), 0, east[2] * Math.cos(az) + n[2] * Math.sin(az)];
  return norm([h[0] * Math.cos(alt), Math.sin(alt), h[2] * Math.cos(alt)]);
}

// Which way the sunlight falls on the moon's face. The sun lies along the sky
// from the moon by the elongation: to the WEST of a waxing moon and to the EAST
// of a waning one. Facing north from Cairns, west is on the left, so a waxing
// moon is lit on its left side: the "upside down" moon of the south, by
// geometry rather than by flipping a picture.
export function moonSunDirection(moon, elongation, north = [0, 0, -1]) {
  const n = norm(north), east = cross(n, [0, 1, 0]);
  const toward = elongation < Math.PI ? [-east[0], -east[1], -east[2]] : east;   // west when waxing
  const e = elongation < Math.PI ? elongation : Math.PI * 2 - elongation;
  // The part of that direction square to the moon's direction.
  const d = dot(toward, moon);
  const side = norm([toward[0] - moon[0] * d, toward[1] - moon[1] * d, toward[2] - moon[2] * d]);
  return norm([moon[0] * Math.cos(e) + side[0] * Math.sin(e), moon[1] * Math.cos(e) + side[1] * Math.sin(e), moon[2] * Math.cos(e) + side[2] * Math.sin(e)]);
}
