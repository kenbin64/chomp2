// marlin-rules.js
// Catching a black marlin with real physics (Ken, 2026-10-31: realistic, within the limits of a game). Pure numbers, no
// three.js (test/marlin.test.mjs; marlin-fight.js draws it). Three parts:
//
//   The cast: the lure is a projectile with air drag, thrown at the angle and force the player chooses. Because of the
//     drag the best angle is well under 45 degrees. Too much force overruns the reel: a backlash, and a short cast.
//   Trolling: the boat moves on with the lure out behind. The tension gauge shows the lure working, then nibbles, then
//     a bite; the player sets the hook on the bite, and striking at a nibble spooks him.
//   The fight: a fish, a line and a drag. The line is a spring: it pulls in proportion to how far it is stretched, and a
//     long line stretches more, so it forgives more. The fish has mass, thrust and water drag, and the line pulls back on
//     him. The drag lets line slip above its setting, but only so fast.
//       Reel: takes line in, stalling as the tension rises.
//       Release: backs off the drag, so line runs out freely.
//       Neither: the drag holds.
//     Tension in units of the line's breaking strength: 1 and it starts to go.

// ---- The cast ------------------------------------------------------------------------------------
export const CAST = {
  gravity: 9.8, drag: 0.012,      // air drag per metre, on the lure and the line behind it
  speed: 62,                      // metres a second at full force
  height: 3.4,                    // the rod tip above the water at release
  backlash: 0.93, tangled: 0.45,  // above this force the reel overruns, and the cast comes up this short
  minLine: 30,                    // closer than this the lure is in the boat's wake: cast again
};
export const CAST_ANGLES = { min: 5, max: 75, start: 25 };   // degrees

export function newCast(angleDeg, force) {
  const a = angleDeg * Math.PI / 180, tangled = force > CAST.backlash, v = CAST.speed * force * (tangled ? CAST.tangled : 1);
  return { x: 0, y: CAST.height, vx: v * Math.cos(a), vy: v * Math.sin(a), time: 0, landed: false, tangled };
}
export function castStep(c, dt) {
  if (c.landed) return c;
  const h = 1 / 240;
  for (let t = 0; t < dt && !c.landed; t += h) {
    const sp = Math.hypot(c.vx, c.vy);
    c.vx -= CAST.drag * sp * c.vx * h; c.vy -= (CAST.gravity + CAST.drag * sp * c.vy) * h;
    c.x += c.vx * h; c.y += c.vy * h; c.time += h;
    if (c.y <= 0) { c.y = 0; c.landed = true; }
  }
  return c;
}
// Where a cast would land.
export function castReach(angleDeg, force) { const c = newCast(angleDeg, force); while (!c.landed) castStep(c, 1 / 30); return c.x; }
// The force meter: hold, and it climbs and falls.
export function forceAt(heldSeconds) { const u = (heldSeconds * 0.7) % 2; return u < 1 ? u : 2 - u; }

// ---- Trolling ------------------------------------------------------------------------------------
export const TROLL = { boat: 3.5, nibbleAfter: [2, 4], nibbles: [1, 3], biteWindow: 1.8, spooked: 5 };
const between = (rng, [a, b]) => a + rng() * (b - a);
export function newTroll(rng = Math.random) {
  return { rng, time: 0, tension: 0.1, state: 'working', next: between(rng, TROLL.nibbleAfter), nibblesLeft: Math.round(between(rng, TROLL.nibbles)), spike: 0, result: null, justBit: false };
}
// strike: the player is striking this frame. Sets t.result: 'hooked'. A strike too soon spooks him for a while; a bite
// let go by means he drops it, and comes back.
export function trollStep(t, strike, dt) {
  t.time += dt; t.next -= dt; t.justBit = false;
  t.spike = Math.max(0, t.spike - dt * 3);
  const work = 0.1 + Math.sin(t.time * 5) * 0.02 + Math.sin(t.time * 13) * 0.01;   // the lure working through the water
  if (t.state === 'working' && t.next <= 0) {
    if (t.nibblesLeft > 0) { t.nibblesLeft--; t.spike = 0.3; t.next = between(t.rng, [1.2, 2.6]); }
    else { t.state = 'bite'; t.next = TROLL.biteWindow; t.justBit = true; }
  } else if (t.state === 'bite' && t.next <= 0) { t.state = 'working'; t.next = between(t.rng, TROLL.nibbleAfter); t.nibblesLeft = 1; }
  if (strike) {
    if (t.state === 'bite') { t.result = 'hooked'; return t; }
    t.next = Math.max(t.next, TROLL.spooked); t.nibblesLeft = Math.max(1, t.nibblesLeft); t.scared = true;
  } else t.scared = false;
  const want = t.state === 'bite' ? 0.62 + Math.sin(t.time * 21) * 0.08 : work + t.spike;
  t.tension += (want - t.tension) * Math.min(1, dt * 14);
  return t;
}

// ---- The fight -----------------------------------------------------------------------------------
export const LINE = {
  spool: 340, stretch: 40, damp: 0.36,   // tension for each metre of stretch, on a metre of line; how it loses energy
  reel: 6.5, reelStall: 1.5,        // metres a second, with nothing pulling back; the tension it can wind no further against
  dragSlip: 0.72, slipRate: 2,    // the drag starts to slip here, and lets line go at most this fast
  freeDrag: 0.14, freeRate: 30,   // with the drag backed off
  snapAfter: 0.5,                 // seconds at breaking strength before it goes
  slackAt: 0.04, slackAfter: 2.5, // the hook falls out of a fish given slack for this long
  boat: 14, tired: 0.2,           // this close and this tired: alongside
};
const FISH = { mass: 0.22, water: 0.009, linear: 0.03 };
// What he does: seconds [least, most], thrust away from the boat (fresh), and how much the water holds him.
const MODES = {
  run:    { time: [3.5, 6], thrust: 1.28 },
  rest:   { time: [3, 5.5], thrust: 0.2 },
  jump:   { time: [1.5, 2.1], thrust: 1.3, air: true },      // out of the water, shaking his head: nothing holds him but the line
  shake:  { time: [1.2, 2], thrust: 0.5, wobble: 0.32 },
  charge: { time: [2.5, 4], thrust: -0.45 },                 // straight at the boat
};

export function newFight(rng = Math.random, cast = 70) {
  return { rng, line: cast, dist: cast, speed: 0, stamina: 1, tension: 0.3, mode: 'run', modeLeft: between(rng, MODES.run.time), red: 0, slack: 0, side: 0, sideGoal: rng() < 0.5 ? -0.7 : 0.7, jumps: 0, time: 0, result: null, why: null, justLeapt: false, slipping: false };
}

function nextMode(f) {
  const fresh = f.stamina, r = f.rng(), was = f.mode;
  let m = 'rest';
  if (was === 'rest') m = r < 0.2 + 0.25 * fresh ? 'run' : r < 0.55 + 0.25 * fresh ? 'jump' : r < 0.75 + 0.15 * fresh ? 'charge' : 'shake';
  else if (was === 'jump') m = r < 0.5 ? 'shake' : 'rest';
  if (f.line <= LINE.boat && f.stamina > LINE.tired) m = 'run';      // not ready to come alongside: off he goes
  return m;
}

function physics(f, input, dt) {
  const M = MODES[f.mode], k = 0.5 + 0.5 * f.stamina;                // a tired fish has less in him
  const reel = !!input.reel, release = !!input.release && !reel, rod = input.rod || 0;
  // The rod to the side he is heading: the line pulls harder. To the other side: it turns his head (below).
  const across = -rod * Math.sign(f.side) * Math.min(1, Math.abs(f.side) * 1.5);
  // The line: a spring, softer the more of it is out.
  const stretch = f.dist - f.line;
  // (It is damped, as real line is: a stretched line loses energy, rather than bouncing him back and forth.)
  const give = (stretch - (f.lastStretch ?? stretch)) / dt; f.lastStretch = stretch;
  const T = Math.max(0, stretch * LINE.stretch / Math.max(f.line, 5)) * (across < 0 ? 1 - across * 0.12 : 1);
  const lost = stretch > 0 ? give * LINE.damp : 0;
  // The reel and the drag.
  f.slipping = false;
  // (Winding against him he is pulling on the reel, not the drag: that is what breaks a line. It only stalls past breaking.)
  if (reel) f.line -= LINE.reel * Math.max(0, 1 - T / LINE.reelStall) * dt;
  else if (release) { if (T > LINE.freeDrag) f.line += Math.min(LINE.freeRate, (T - LINE.freeDrag) * 60) * dt; f.slipping = T > LINE.freeDrag; }
  if (!release && !reel && T > LINE.dragSlip) { f.line += Math.min(LINE.slipRate, (T - LINE.dragSlip) * 30) * dt; f.slipping = true; }
  // The fish: thrust, the line pulling back, the water.
  const wobble = M.wobble ? Math.sin(f.time * 17) * M.wobble : 0, thrust = (M.thrust + wobble) * (M.thrust > 0 ? k : 1);
  const water = (FISH.water * Math.abs(f.speed) + FISH.linear) * f.speed * (M.air ? 0.25 : 1);
  f.speed += (thrust - T - lost - water) / FISH.mass * dt;
  f.dist = Math.max(LINE.boat * 0.5, f.dist + f.speed * dt);
  if (f.dist <= LINE.boat * 0.5) f.speed = Math.max(0, f.speed);
  f.line = Math.max(LINE.boat * 0.5, f.line);
  f.tension += (T - f.tension) * Math.min(1, dt * 12);
  // Steady pressure wears him down, and more with his head turned; a jump takes it out of him too.
  f.stamina = Math.max(0, f.stamina - (0.004 + f.tension * 0.024 + (M.air ? 0.02 : 0)) * (1 + Math.max(0, across) * 0.8) * dt);
}

// One step. input: { reel, release, rod: -1 left to 1 right }. Sets f.result: 'landed', or 'lost' with f.why: 'snapped',
// 'slack' or 'spooled'.
export function fightStep(f, input, dt) {
  if (f.result) return f;
  f.time += dt; f.justLeapt = false; f.modeLeft -= dt;
  if (f.modeLeft <= 0) {
    f.mode = nextMode(f); f.modeLeft = between(f.rng, MODES[f.mode].time);
    f.sideGoal = (f.rng() < 0.5 ? -1 : 1) * (0.3 + f.rng() * 0.6);
    if (f.mode === 'jump') { f.jumps++; f.justLeapt = true; }
  }
  f.side += (f.sideGoal - f.side) * Math.min(1, dt * 0.8);
  const n = Math.ceil(dt * 240), h = dt / n;
  for (let i = 0; i < n; i++) physics(f, input, h);
  f.red = f.tension >= 1 ? f.red + dt : 0;
  f.slack = f.tension < LINE.slackAt ? f.slack + dt : 0;
  if (f.red >= LINE.snapAfter) { f.result = 'lost'; f.why = 'snapped'; }
  else if (f.slack >= LINE.slackAfter) { f.result = 'lost'; f.why = 'slack'; }
  else if (f.line >= LINE.spool) { f.result = 'lost'; f.why = 'spooled'; }
  else if (f.line <= LINE.boat && f.stamina <= LINE.tired) f.result = 'landed';
  return f;
}

// The gauge's zones.
export function tensionZone(t) { return t >= 0.85 ? 'danger' : t >= 0.62 ? 'careful' : t < LINE.slackAt ? 'slack' : 'safe'; }
