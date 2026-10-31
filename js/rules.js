// rules.js
// The rules of the park, kept apart from the drawing so they can be tested on
// their own (test/rules.test.mjs). Nothing in here touches three.js or the page.
//
// The enclosure is an oval lagoon. Distance from the centre is measured in
// "lagoon units": 0 at the centre, 1 at the waterline, so one function can ask
// "how far out is this point?" whatever the oval's proportions.

export const LAGOON = { rx: 28, rz: 18 };   // half-widths of the oval, metres
export const WATER_Y = 0;                    // the water surface
export const BANK_Y = 0.35;                  // the flat bank around it
export const PARK_EDGE = 1.35;               // Wally may roam out to here (water or near water)
export const GRAVITY = 9.8;                  // for thrown food

// How far out a point is, in lagoon units.
export function lagoonDistance(x, z) {
  return Math.hypot(x / LAGOON.rx, z / LAGOON.rz);
}

function smooth(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// Height of the ground (the lagoon bed under water, the bank on land).
export function terrainHeight(x, z) {
  const d = lagoonDistance(x, z);
  if (d >= 1.08) return BANK_Y;
  if (d >= 0.85) return -1.5 + (BANK_Y + 1.5) * smooth((d - 0.85) / 0.23);
  return Math.max(-3, -1.5 - (0.85 - d) * 2);
}

// Deep enough to swim. The shallow edge counts as land so he walks out of the water.
export function isWater(x, z) {
  return terrainHeight(x, z) < -0.35;
}

// Keep Wally inside the park: water, or the bank close to it.
// Returns the same point if it is allowed, otherwise the nearest allowed point
// on the same line from the centre.
export function clampToPark(x, z) {
  const d = lagoonDistance(x, z);
  if (d <= PARK_EDGE) return { x, z };
  const k = PARK_EDGE / d;
  return { x: x * k, z: z * k };
}

// ---- The visitors' path -------------------------------------------------
// People watch from a path outside the fence, as at a real croc park, not from
// the bank inside it (Ken, 2026-10-29). Distances on the path are in metres out
// from the fence, so the path is the same width all the way round the oval.
export const FENCE_D = 1.42;                 // where the fence stands, in lagoon units
export const PATH = { inner: 1.5, outer: 5.5, stand: 2.5, lanes: [3.2, 4.6] };   // metres out from the fence

// The point `out` metres outside the fence, at angle a round the oval.
export function fencePoint(a, out = 0) {
  const nx = Math.cos(a) / LAGOON.rx, nz = Math.sin(a) / LAGOON.rz, n = Math.hypot(nx, nz);
  return { x: Math.cos(a) * LAGOON.rx * FENCE_D + nx / n * out, z: Math.sin(a) * LAGOON.rz * FENCE_D + nz / n * out };
}

// The angle round the oval a point is at (the one fencePoint takes).
export function pathAngle(x, z) {
  return Math.atan2(z / LAGOON.rz, x / LAGOON.rx);
}

// How many metres outside the fence a point is (negative: inside). Across the
// path it is within about 8 cm (measured: 0.7 cm at its inner edge, 8.0 cm at its outer).
export function fenceOffset(x, z) {
  const a = pathAngle(x, z), f = fencePoint(a);
  const nx = Math.cos(a) / LAGOON.rx, nz = Math.sin(a) / LAGOON.rz, n = Math.hypot(nx, nz);
  return (x - f.x) * nx / n + (z - f.z) * nz / n;
}

// Where a fence goes round an oval: runs of posts about `spacing` metres apart, with gaps wherever
// blocked({ x, z, a }) says. a is the angle round the oval.
export function fenceRuns(rx, rz, blocked, spacing) {
  const N = 6000, at = a => { const p = { x: Math.cos(a) * rx, z: Math.sin(a) * rz, a }; return p; };
  let a0 = 0;
  for (let i = 0; i < N; i++) { a0 = i / N * Math.PI * 2; if (!blocked(at(a0))) break; }
  const runs = [];
  let run = null, last = null, prev = null;
  const finish = () => {
    if (!run) return;
    if (prev && prev !== last && Math.hypot(prev.x - last.x, prev.z - last.z) > spacing * 0.3) run.push(prev);
    if (run.length > 1) runs.push(run);
    run = null;
  };
  for (let i = 0; i <= N; i++) {
    const p = at(a0 + i / N * Math.PI * 2);
    if (blocked(p)) { finish(); prev = null; continue; }
    if (!run) { run = [p]; last = p; }
    else if (Math.hypot(p.x - last.x, p.z - last.z) >= spacing) { run.push(p); last = p; }
    prev = p;
  }
  finish();
  return runs;
}
// The croc fence stops at the boardwalk, which crosses it at both ends.
export function overDeck(p) {
  return Math.abs(p.z - BOARDWALK.z) < BOARDWALK.width / 2 + 0.3 && Math.abs(p.x) < BOARDWALK.x1;
}

// The shops on the path's outer edge (shops.js draws them, each its own), in the gaps between the groups'
// places and clear of the boardwalk. The food stands sell foods from FOODS; the souvenir shop is just
// before the way out. Angles in degrees.
export const STANDS = [
  { deg: 30, kind: 'grill' },       // the Food Court (park-sections.js)
  { deg: 50, kind: 'fryer' },
  { deg: 70, kind: 'oven' },
  { deg: 138, kind: 'drinks' },
  { deg: 158, kind: 'souvenir' },   // just before the way out
  { deg: 285, kind: 'fruit' },      // the far side of the path, so there are vendors all the way round (Ken, 2026-10-30)
  { deg: 322, kind: 'icecream' },
];
export const STAND = { w: 3.3, d: 2.75 };    // the ground a shop takes, metres
export function kioskSpots() {
  return STANDS.map(k => {
    const a = k.deg * Math.PI / 180, p = fencePoint(a, PATH.outer + STAND.d / 2 + 1.0), in_ = fencePoint(a, 0);
    return { ...k, x: p.x, z: p.z, rot: Math.atan2(in_.x - p.x, in_.z - p.z) };   // its front (+z) toward the crocs
  });
}

export function onPath(x, z, margin = 0) {
  const o = fenceOffset(x, z);
  return o >= PATH.inner - margin && o <= PATH.outer + margin;
}

// ---- Energy -------------------------------------------------------------

export const ENERGY_MAX = 100;

// Energy used per second for what he is doing.
// How fast the feed-o-meter runs down on each level (Ken: the first level is
// the training level, so it gives the most time, and each level after is a
// little harder). 1 is the full rate.
export const LEVEL_DRAIN = { park: 0.6, cane: 0.55, esplanade: 0.8, reef: 1, kuranda: 1.1, daintree: 0.86, mossman: 1.2 };

export function energyDrain(mode, moving, level = null) {
  const base = { upright: 1.6, fours: 2.6, swim: 1.3 }[mode] ?? 1.6;
  return (moving ? base * 1.4 : base) * (LEVEL_DRAIN[level] ?? 1);
}

// Below 40 energy he slows down, to just under half speed when empty.
export function speedFactor(energy) {
  if (energy >= 40) return 1;
  return 0.45 + 0.55 * Math.max(0, energy) / 40;
}

// ---- Food and scoring ---------------------------------------------------

// What tourists throw. Kenny's toast is not here: only Kenny brings that.
export const FOODS = {
  fries:   { name: 'Fries',        points: 20, energy: 8 },
  pizza:   { name: 'Pizza slice',  points: 35, energy: 12 },
  taco:    { name: 'Taco',         points: 30, energy: 10 },
  hotdog:  { name: 'Hot dog',      points: 35, energy: 12 },
  shrimp:  { name: 'Shrimp',       points: 25, energy: 6 },
  chicken: { name: 'Chicken leg',  points: 40, energy: 14 },
  hoagie:  { name: 'Hoagie',       points: 45, energy: 16 },
  burger:  { name: 'Hamburger',    points: 50, energy: 18 },
  steak:   { name: 'Steak',        points: 60, energy: 22 },
};

// Every 5 catches in a row adds half a multiplier, up to triple points.
export function comboMultiplier(streak) {
  return Math.min(3, 1 + Math.floor(streak / 5) * 0.5);
}

// boosted: Kenny's toast power-up is running.
// Points for a catch depend on how Wally got it (Ken's rule, 2026-10-16):
//   'ground' 1, scooped off the ground or water
//   'air'    2, caught in the air in his jaws
//   'leap'   3, caught in the air while jumping or leaping
// The streak multiplier and Kenny's jar (boosted, double) still apply.
export const CATCH_POINTS = { ground: 1, air: 2, leap: 3 };
export function catchPoints(how, streak, boosted) {
  const base = CATCH_POINTS[how] * comboMultiplier(streak);
  return Math.round(boosted ? base * 2 : base);
}

// Older food-value scoring, kept for reference by the tests; the game uses catchPoints.
export function scoreFor(kind, streak, boosted) {
  const base = FOODS[kind].points * comboMultiplier(streak);
  return Math.round(boosted ? base * 2 : base);
}

// ---- Throwing -----------------------------------------------------------

// Starting velocity that carries food from `from` to `to` in `seconds`,
// under gravity. Each axis is independent, so this is three one-line answers
// rather than a search.
// How far off Wally a throw lands: mostly close, now and then out to `spread`
// (the square of a random number leans toward small). Ken: food thrown toward
// him, so it is all reachable, without taking away the challenge.
export function aimOffset(rnd, spread) { return spread * rnd() * rnd(); }

export function launchVelocity(from, to, seconds) {
  const t = seconds;
  return {
    x: (to.x - from.x) / t,
    y: (to.y - from.y + 0.5 * GRAVITY * t * t) / t,
    z: (to.z - from.z) / t,
  };
}

// Where the food is after `t` seconds.
export function positionAt(from, velocity, t) {
  return {
    x: from.x + velocity.x * t,
    y: from.y + velocity.y * t - 0.5 * GRAVITY * t * t,
    z: from.z + velocity.z * t,
  };
}

// The game gets busier the longer Wally lasts. `seconds` is time survived.
export function difficulty(seconds) {
  const p = Math.min(1, seconds / 180);
  return {
    throwEvery: 2.6 - 1.6 * p,   // seconds between throws
    spread: 1.0 + 2.2 * p,       // how far from Wally the food is aimed (Ken: within reach, still a stretch later)
    flight: 2.0 - 0.6 * p,       // seconds in the air
    doubleChance: 0.35 * p,      // chance a second tourist throws at once
  };
}

// ---- Boardwalk and rocks: things to stand on -----------------------------

// The boardwalk crosses the lagoon high enough to swim under and leap onto.
// Its ends slope down to the banks so Wally can hop on from dry land.
export const BOARDWALK = { z: 2, width: 5, x0: -58, x1: 58, top: 3.2, flat: 24, rampEnd: 40, low: 0.6 };

export function deckHeight(x) {
  const B = BOARDWALK, a = Math.abs(x);
  if (a <= B.flat) return B.top;
  if (a >= B.rampEnd) return B.low;
  return B.top + (B.low - B.top) * (a - B.flat) / (B.rampEnd - B.flat);
}

// Places Wally can pass the boardwalk's edge: gaps in the railing over the water,
// and the steps down to the bank at each end. Everywhere else the rails hold him.
export const GATE_X = 35.5;                  // the gate on the boardwalk (world.js draws it)

export const DECK_OPENINGS = [
  { x0: -38, x1: -31, kind: 'steps' },
  { x0: -10, x1: -7, kind: 'gap' },
  { x0: 12, x1: 15, kind: 'gap' },
  { x0: 31, x1: 38, kind: 'steps' },
  // Where the visitors' path outside the fence meets it (it crosses x 41.15 to 45.18 at the deck's middle):
  // people step up onto it there, and Wally, once out of the gate, steps off onto the path (chase-rules.js).
  { x0: -45, x1: -41.4, kind: 'path' },
  { x0: 41.4, x1: 45, kind: 'path' },
];

export function deckOpenAt(x) {
  return DECK_OPENINGS.some(o => x >= o.x0 && x <= o.x1);
}

export function onDeck(x, z) {
  const B = BOARDWALK;
  return x >= B.x0 && x <= B.x1 && Math.abs(z - B.z) <= B.width / 2;
}

// Boulders on the banks and stepping stones at the water's edge.
// Each is a flat-topped circle: x, z, radius, height of its top.
export const ROCKS = [
  { x: -14, z: 17.5, r: 1.6, top: 1.3 },
  { x: -16.5, z: 15.6, r: 1.2, top: 2.2 },
  { x: 16, z: 18.5, r: 1.8, top: 1.4 },
  { x: 25, z: -10, r: 1.5, top: 1.2 },
  { x: -27, z: -6, r: 1.4, top: 1.5 },
  { x: 8, z: -17.5, r: 1.3, top: 0.9 },
];

const STEP = 0.35;    // how far below a surface the feet may be and still step onto it

// What Wally is standing on at (x, z) with his feet at feetY.
// A deck or rock only counts once his feet are at or above it (less a small step),
// so he can swim under the boardwalk and has to jump onto rocks.
// fromBelow: he is coming up from lower down (e.g. a croc leap), so the rails block him except at an opening.
export function standHeight(x, z, feetY, floatY = -0.45, fromBelow = false) {
  let best = isWater(x, z) ? { y: floatY, surface: 'water' } : { y: terrainHeight(x, z), surface: 'land' };
  if (onDeck(x, z)) {
    const d = deckHeight(x);
    const blocked = fromBelow && !canClimbDeckAt(x);
    // At the steps he walks up onto the deck from the ground; elsewhere he has to
    // be up level with it already (jumped, or walking along it).
    const onSteps = DECK_OPENINGS.some(o => o.kind === 'steps' && x >= o.x0 && x <= o.x1) && !fromBelow;
    if (!blocked && (feetY >= d - STEP || onSteps) && d > best.y) best = { y: d, surface: 'deck' };
  }
  for (const r of ROCKS) {
    if (Math.hypot(x - r.x, z - r.z) <= r.r && feetY >= r.top - STEP && r.top > best.y) best = { y: r.top, surface: 'rock' };
  }
  return best;
}

// The boardwalk is solid (Ken): from the bank or the water Wally cannot walk
// into it where it is lower than he is tall; he has to jump up onto it (or use
// the steps). Where it is high enough over the water he can swim underneath.
// feetY: his feet; swimming: lying flat in the water, so he needs less room.
export const WALLY_TALL = 2.5, WALLY_SWIM_TALL = 1.2, DECK_THICK = 0.35;
export function deckBlocks(x, z, feetY, swimming = false) {
  if (!onDeck(x, z)) return false;
  const top = deckHeight(x);
  if (feetY >= top - STEP) return false;                       // up on it, or landing on it
  if (DECK_OPENINGS.some(o => o.kind === 'steps' && x >= o.x0 && x <= o.x1)) return false;   // the steps up
  const underside = top - DECK_THICK;
  return underside - feetY < (swimming ? WALLY_SWIM_TALL : WALLY_TALL);   // not enough room to pass under
}

// Keeps Wally inside the railings while he is up on the boardwalk.
// fromZ is where he was, toZ where he wants to go. Through an opening he may leave.
export function railClamp(x, fromZ, toZ) {
  const B = BOARDWALK, half = B.width / 2 - 0.45;
  if (deckOpenAt(x) || Math.abs(fromZ - B.z) > half + 0.01) return toZ;
  return Math.min(B.z + half, Math.max(B.z - half, toZ));
}

// Coming up from the water, the railings are in the way except at an opening.
export function canClimbDeckAt(x) {
  return deckOpenAt(x);
}

// Where thrown food stops: the deck if it comes down onto it, otherwise water or ground.
export function foodSurface(x, z, prevY) {
  if (onDeck(x, z) && prevY >= deckHeight(x)) return deckHeight(x);
  return isWater(x, z) ? WATER_Y : terrainHeight(x, z);
}

// ---- Feed-o-meter and lives ------------------------------------------------

// Below this the meter shows red: Wally is flagging, and Kenny sets off with toast.
export const FEED_RED = 25;
export const LIVES = 3;
// Energy Wally gets back up with after a nap that cost a life.
export const REVIVE_ENERGY = 60;

export function inRedZone(energy) {
  return energy < FEED_RED;
}

// Ken (2026-10-18): once the feed-o-meter is under half, Wally can go and find
// Kenny himself for a scoop from his jar, without waiting for the red zone.
// Kenny needs a while to fill the jar again between scoops.
export const FEED_HALF = 50;
export const ASK_RANGE = 2.6;          // m: close enough to Kenny to ask
export const ASK_COOLDOWN = 40;        // s between scoops he hands over this way
export function canAskKenny(energy, cool, distance) {
  return energy < FEED_HALF && cool <= 0 && distance < ASK_RANGE;
}

// ---- Food on the ground ------------------------------------------------------

// Food that lands is still good for a while: it floats on the water or sits on
// the bank until it dissolves. Wally can still grab it, and so can everything else.
export const GROUND_LIFE = 6;        // seconds before it dissolves
export const FADE_TIME = 1.5;        // the last part of that, shrinking away

// How big a landed piece still looks, 1 = whole, 0 = gone.
export function groundSize(age) {
  const left = GROUND_LIFE - age;
  if (left <= 0) return 0;
  return Math.min(1, left / FADE_TIME);
}

// ---- Groups of people: the sweet spot ------------------------------------------
// People throw food only when Wally is close enough to notice but not so close
// they get frightened. Hang about inside the inner ring and they run away, and
// their food goes with them. Each group has only so much food.
export const CLUSTER = {
  far: 18,          // beyond this they have not noticed him
  near: 6,          // inside this they get nervous
  panic: 3.2,       // this close and they bolt at once
  nerve: 3.6,       // seconds up close before they get too jumpy and bolt
  throwEvery: 1.3,  // seconds between throws while he is in the sweet spot
  handEvery: 1.5,   // seconds between handouts while he is up close
};

// One step of a group's mood. state: { nerves, cooldown }. Returns what they do:
// 'unaware', 'throw', 'wait' (in the sweet spot between throws), 'hand' (up close:
// a gentle handout straight to him), 'nervous' (up close, between handouts) or 'flee'.
// Ken: up close the food still comes (more accessible), but stay too long and
// they get jumpy and bolt; charging right up still makes them bolt at once.
// calm stretches their patience and panic sets how close is "right on them" (park-ease.js: a gentler
// first visit); left out, they are as above.
export function clusterStep(state, dist, dt, foodLeft, calm = 1, panic = CLUSTER.panic) {
  state.cooldown = Math.max(0, state.cooldown - dt);
  const nerve = CLUSTER.nerve * calm;
  if (dist <= panic) { state.nerves = nerve; return 'flee'; }
  if (dist <= CLUSTER.near) {
    state.nerves += dt;
    if (state.nerves >= nerve) return 'flee';
    if (foodLeft > 0 && state.cooldown <= 0) { state.cooldown = CLUSTER.handEvery; return 'hand'; }
    return 'nervous';
  }
  state.nerves = Math.max(0, state.nerves - dt * 0.5);       // they calm down again, slowly
  if (dist > CLUSTER.far || foodLeft <= 0) return 'unaware';
  if (state.cooldown > 0) return 'wait';
  state.cooldown = CLUSTER.throwEvery;
  return 'throw';
}
