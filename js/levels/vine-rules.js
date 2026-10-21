// vine-rules.js
// The vine swing into the Daintree rainforest (Ken, 2026-10-20; MASTER.md section 6, the
// finale's fourth version, step 3): Wally swings from vine to vine over a swamp, gathering
// pawpaws for the King, to the King's court. Plain JavaScript, no three.js; tested in
// test/vines.test.mjs.
//
// The course runs along +z in its own patch of forest (COURSE.x0, COURSE.z0). Each vine
// hangs from a branch ANCHOR_Y up; Wally hangs by his hands at the end of it. Swinging is
// a pendulum in the y-z plane:
//   theta   the vine's angle from hanging straight down, + toward the next vine (+z)
//   omega   how fast it turns (radians a second)
// Holding forward pumps the swing (it gains height, as a child pumps a swing); letting go
// throws him off along the vine's swing at its speed; in the air he falls; he catches the
// next vine if his hands pass close to it. Miss, and he drops into the swamp.

export const G = 9.8;
export const COURSE = { x: -620, z0: 0 };                 // where the patch of forest is
export const ANCHOR_Y = 12.5;                             // the branches the vines hang from
export const VINE_LENGTH = 9;                             // so his hands hang 3.5 m up
export const SWAMP_Y = -0.4;                              // the swamp's surface, under the vines
export const START = { z: -4, y: 1.2 };                   // the bank he sets off from
export const SPACING = 16;                                // between vines: further than one swing reaches, so he has to fly
export const VINES = [4, 20, 36, 52, 68, 84];             // where each vine hangs (z)
export const END = { z: 98, y: 1.2 };                     // the far bank: the King's court is beyond
export const MAX_SWING = 1.15;                            // radians: about 66 degrees, as high as it goes
export const PUMP = 0.5;                                  // holding forward: a push near the bottom of each swing, building height
export const DAMP = 0.12;                                 // the swing dies away slowly without pumping
export const CATCH = 1.5;                                 // his hands this close to a vine: he grabs it
export const LEAP = 1.1;                                 // letting go, he pushes off the vine: his speed times this
export const LEAP_UP = 1.5;                               // and a little upward spring (m/s)
export const LAND = 3;                                    // on the far bank, this close to the edge: he lands
export const DT = 1 / 120;

export const handAt = (vz, theta) => ({ z: vz + Math.sin(theta) * VINE_LENGTH, y: ANCHOR_Y - Math.cos(theta) * VINE_LENGTH });

// One step of the swing. pump: 1 holding forward, 0 not.
export function swingStep(s, pump, dt) {
  let { theta, omega } = s;
  // Pumping adds energy in the direction it is already swinging (and a nudge from rest).
  // Only near the bottom, as a child pumps a swing: the swing grows over a few passes, never like a motor.
  const push = pump && Math.abs(theta) < 0.45 ? PUMP * (Math.abs(omega) < 0.05 ? 1 : Math.sign(omega)) : 0;
  omega += (-(G / VINE_LENGTH) * Math.sin(theta) - DAMP * omega + push) * dt;
  theta += omega * dt;
  if (theta > MAX_SWING) { theta = MAX_SWING; omega = Math.min(omega, 0); }     // as high as a vine can go
  if (theta < -MAX_SWING) { theta = -MAX_SWING; omega = Math.max(omega, 0); }
  return { theta, omega };
}

// Letting go: his hands leave along the swing, at its speed. Returns { z, y, vz, vy }.
export function release(vz, s) {
  const h = handAt(vz, s.theta), v = s.omega * VINE_LENGTH * LEAP;
  return { z: h.z, y: h.y, vz: Math.cos(s.theta) * v, vy: Math.sin(s.theta) * v + LEAP_UP };
}
export const flyStep = (f, dt) => ({ z: f.z + f.vz * dt, y: f.y + f.vy * dt, vz: f.vz, vy: f.vy - G * dt });

// Does he catch vine i? His hands near the vine anywhere along its hanging length
// (the vine hangs straight down where nobody holds it).
export function catches(f, i) {
  const vz = VINES[i], lowest = ANCHOR_Y - VINE_LENGTH;
  if (f.y < lowest - 0.8 || f.y > lowest + 5) return false;     // its lower part, where he can reach it
  return Math.abs(f.z - vz) < CATCH;
}
// On catching, the swing it starts: the angle where his hands are, the speed his flight gives it.
export function grab(f, i) {
  const vz = VINES[i], dz = f.z - vz, dy = ANCHOR_Y - Math.max(f.y, ANCHOR_Y - VINE_LENGTH);
  const theta = Math.atan2(dz, Math.max(0.5, dy));
  const omega = (f.vz * Math.cos(theta) + f.vy * Math.sin(theta)) / VINE_LENGTH;   // the part of his speed across the vine
  return { theta, omega };
}
// Has he reached the far bank (past the last vine, low enough to land)?
export const landed = f => f.z >= END.z - LAND && f.y <= END.y + 2.2;
// Fallen into the swamp (his hands at the water: his feet went in well before).
export const inSwamp = f => f.y <= SWAMP_Y + 3;

// A whole flight from letting go, for tests and for drawing the pawpaws on good paths:
// 'vine' (caught the next one), 'bank' (landed on the far bank), or 'swamp'.
export function flight(fromVine, s, maxT = 4) {
  let f = release(VINES[fromVine], s);
  const next = fromVine + 1;
  for (let t = 0; t < maxT; t += DT) {
    f = flyStep(f, DT);
    if (next < VINES.length && catches(f, next)) return { end: 'vine', f, t };
    if (next >= VINES.length && landed(f)) return { end: 'bank', f, t };
    if (inSwamp(f)) return { end: 'swamp', f, t };
  }
  return { end: 'swamp', f, t: maxT };
}

// The first vine: from the bank, he runs and leaps for it; this is the swing it gives him.
export const firstSwing = () => ({ theta: -0.6, omega: 1.2 });

// A full forward swing, at the top of what pumping builds, caught at the angle given: the
// state of the swing as it passes that angle going forward.
export function fullSwingAt(angle) {
  let s = { theta: -MAX_SWING, omega: 0 };
  for (let t = 0; t < 6; t += DT) { s = swingStep(s, 1, DT); if (s.omega > 0 && s.theta >= angle) return s; }
  return s;
}
export const GOOD_RELEASE = 0.6;                          // about here, on the forward swing, is a good time to let go

// Pawpaws: one on the flight path between each pair of vines (and on to the far bank), on a
// good throw, so a well-timed swing gathers them.
export function pawpawSpots() {
  const out = [];
  for (let i = 0; i < VINES.length; i++) {
    const s = fullSwingAt(GOOD_RELEASE), r = flight(i, s);
    let g = release(VINES[i], s);
    for (let t = 0; t < r.t * 0.5; t += DT) g = flyStep(g, DT);
    out.push({ z: g.z, y: g.y, after: i });
  }
  return out;
}
export const PAWPAW_REACH = 1.5;
