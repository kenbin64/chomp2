// Tests for js/rules.js. Run:  node test/rules.test.mjs
// Each check tries to break a rule, not just repeat it.

import * as R from '../js/rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// Lagoon geometry
check('centre is distance 0', R.lagoonDistance(0, 0) === 0);
check('waterline on x axis is 1', near(R.lagoonDistance(R.LAGOON.rx, 0), 1));
check('waterline on z axis is 1', near(R.lagoonDistance(0, R.LAGOON.rz), 1));
check('centre is water', R.isWater(0, 0));
check('far bank is land', !R.isWater(R.LAGOON.rx * 1.2, 0));
check('bank is flat at BANK_Y', R.terrainHeight(R.LAGOON.rx * 1.3, 0) === R.BANK_Y);

// Terrain never jumps: walk out from the centre in small steps.
let worst = 0, prev = R.terrainHeight(0, 0);
for (let i = 1; i <= 2000; i++) {
  const h = R.terrainHeight(i * 0.02, 0);
  worst = Math.max(worst, Math.abs(h - prev)); prev = h;
}
check('terrain is continuous (no step over 5 cm per 2 cm)', worst < 0.05, worst);

// Exactly one shoreline crossing along each direction.
for (const ang of [0, 0.7, 1.57, 2.5, 4]) {
  let flips = 0, was = true;
  for (let r = 0; r < 50; r += 0.05) {
    const w = R.isWater(Math.cos(ang) * r, Math.sin(ang) * r);
    if (w !== was) { flips++; was = w; }
  }
  check(`one shoreline at angle ${ang}`, flips === 1, flips);
}

// Park bounds
const inside = R.clampToPark(3, 4);
check('inside point unchanged', inside.x === 3 && inside.z === 4);
const out = R.clampToPark(500, 300);
check('outside point lands on the edge', near(R.lagoonDistance(out.x, out.z), R.PARK_EDGE));
check('clamp keeps direction', near(out.x / out.z, 500 / 300));

// Energy
check('full energy is full speed', R.speedFactor(100) === 1);
check('speed holds to 40', R.speedFactor(40) === 1);
check('empty is 0.45', near(R.speedFactor(0), 0.45));
check('negative energy does not go below 0.45', near(R.speedFactor(-10), 0.45));
let mono = true;
for (let e = 0; e < 100; e++) if (R.speedFactor(e + 1) < R.speedFactor(e)) mono = false;
check('more energy is never slower', mono);
check('running on fours costs more than upright', R.energyDrain('fours', true) > R.energyDrain('upright', true));
check('moving costs more than standing', R.energyDrain('swim', true) > R.energyDrain('swim', false));

// Scoring
check('no streak, no multiplier', R.comboMultiplier(0) === 1);
check('5 in a row is x1.5', R.comboMultiplier(5) === 1.5);
check('multiplier caps at 3', R.comboMultiplier(1000) === 3);
check('Kenny toast doubles points', R.scoreFor('burger', 0, true) === 2 * R.scoreFor('burger', 0, false));
check('burger base is its points', R.scoreFor('burger', 0, false) === R.FOODS.burger.points);

// Throwing: the launch velocity really lands the food on target.
for (let i = 0; i < 200; i++) {
  const from = { x: Math.random() * 60 - 30, y: 4.5, z: Math.random() * 6 - 3 };
  const to = { x: Math.random() * 40 - 20, y: Math.random() * 4, z: Math.random() * 30 - 15 };
  const t = 0.8 + Math.random() * 2;
  const v = R.launchVelocity(from, to, t);
  const p = R.positionAt(from, v, t);
  if (!(near(p.x, to.x, 1e-9) && near(p.y, to.y, 1e-9) && near(p.z, to.z, 1e-9))) {
    check('throw lands on target', false, JSON.stringify({ from, to, t, p })); break;
  }
  if (i === 199) check('200 random throws all land on target', true);
}

// Difficulty
const easy = R.difficulty(0), hard = R.difficulty(180), later = R.difficulty(10000);
check('throws speed up', hard.throwEvery < easy.throwEvery);
check('aim spreads out', hard.spread > easy.spread);
check('difficulty stops growing after 3 minutes', JSON.stringify(hard) === JSON.stringify(later));
check('never throws faster than once a second', later.throwEvery >= 1 - 1e-9);


// Boardwalk and rocks
const B = R.BOARDWALK;
check('deck is flat over the middle', R.deckHeight(0) === B.top && R.deckHeight(B.flat) === B.top);
check('deck ends low', R.deckHeight(B.x1) === B.low && R.deckHeight(-B.x1) === B.low);
let rampOk = true;
for (let x = B.flat; x < B.rampEnd; x += 0.1) if (R.deckHeight(x + 0.1) > R.deckHeight(x) + 1e-12) rampOk = false;
check('ramp only goes down toward the ends', rampOk);
check('ramp is symmetric', near(R.deckHeight(31.3), R.deckHeight(-31.3)));
check('on deck at its centre line', R.onDeck(0, B.z));
check('off deck just past its edge', !R.onDeck(0, B.z + B.width / 2 + 0.01));

const under = R.standHeight(0, B.z, -0.45);
check('swimming under the boardwalk stays in the water', under.surface === 'water');
const leapt = R.standHeight(0, B.z, B.top + 0.5);
check('coming down onto the deck lands on it', leapt.surface === 'deck' && leapt.y === B.top);
const justBelow = R.standHeight(0, B.z, B.top - 0.2);
check('a small step up onto the deck counts', justBelow.surface === 'deck');
const tooLow = R.standHeight(0, B.z, B.top - 1);
check('a metre below the deck does not', tooLow.surface !== 'deck');

// The deck ramp can be walked onto from the bank somewhere inside the park.
let rampEntry = false;
for (let x = 20; x < 60; x += 0.1) {
  const z = B.z + B.width / 2 - 0.1;
  if (R.lagoonDistance(x, z) > R.PARK_EDGE || R.isWater(x, z)) continue;
  if (R.deckHeight(x) - R.terrainHeight(x, z) <= 0.35) { rampEntry = true; break; }
}
const reachJump = (() => { for (let x = 20; x < 60; x += 0.1) { const z = B.z; if (R.lagoonDistance(x, z) <= R.PARK_EDGE && !R.isWater(x, z) && R.deckHeight(x) - R.terrainHeight(x, z) < 1.6) return true; } return false; })();
check('Wally can get onto the deck from the bank (step or hop)', rampEntry || reachJump);

for (const r of R.ROCKS) {
  const top = R.standHeight(r.x, r.z, r.top + 0.1);
  const bottom = R.standHeight(r.x, r.z, R.terrainHeight(r.x, r.z));
  check(`rock at ${r.x},${r.z} can be stood on from above`, top.surface === 'rock');
  check(`rock at ${r.x},${r.z} needs a jump from below`, r.top - bottom.y <= 0.35 || bottom.surface !== 'rock');
  check(`rock at ${r.x},${r.z} is inside the park`, R.lagoonDistance(r.x, r.z) <= R.PARK_EDGE);
}
// Every rock must be reachable: by a land hop from the ground beside it, a hop
// from a neighbouring rock, or a croc leap from water beside it.
// Peak heights from wally.js: land 8.5^2/(2*22) = 1.64 m, leap 13^2/(2*22) = 3.84 m from -0.45.
const HOP = 8.5 ** 2 / 44 - 0.1, LEAP_TOP = 13 ** 2 / 44 - 0.45 - 0.1;
for (const r of R.ROCKS) {
  let ok = false;
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const x = r.x + Math.cos(a) * (r.r + 0.3), z = r.z + Math.sin(a) * (r.r + 0.3);
    if (R.isWater(x, z) ? r.top <= LEAP_TOP : r.top - R.terrainHeight(x, z) <= HOP) ok = true;
  }
  for (const o of R.ROCKS) if (o !== r && Math.hypot(o.x - r.x, o.z - r.z) <= o.r + r.r + 1.5 && r.top - o.top <= HOP) ok = true;
  check(`rock at ${r.x},${r.z} is reachable`, ok);
}
check('food falling on the deck stops on the deck', R.foodSurface(0, B.z, B.top + 1) === B.top);

// Railings and openings
const half = B.width / 2 - 0.45;
check('rails stop him walking off the side mid-lagoon', R.railClamp(0, B.z, B.z + 5) === B.z + half);
check('rails stop him on the other side too', R.railClamp(0, B.z, B.z - 5) === B.z - half);
check('a gap in the rail lets him off', R.railClamp(-8.5, B.z, B.z + 5) === B.z + 5);
check('the steps let him off onto the bank', R.railClamp(34, B.z, B.z - 5) === B.z - 5);
check('off the deck the rails do nothing', R.railClamp(0, B.z + 6, B.z + 7) === B.z + 7);
for (const o of R.DECK_OPENINGS) {
  const mid = (o.x0 + o.x1) / 2;
  if (o.kind === 'gap') check(`gap at ${mid} is over water`, R.isWater(mid, B.z + B.width));
  if (o.kind === 'steps') check(`steps at ${mid} lead to bank inside the park`, !R.isWater(mid, B.z + B.width) && R.lagoonDistance(mid, B.z + B.width) <= R.PARK_EDGE);
}
check('leaping up mid-lagoon is blocked by the rails', R.standHeight(0, B.z, B.top + 0.2, -0.45, true).surface !== 'deck');
check('leaping up at a gap lands on the deck', R.standHeight(-8.5, B.z, B.top + 0.2, -0.45, true).surface === 'deck');
check('a gap is low enough to leap up to', B.top <= 13 ** 2 / 44 - 0.45);
check('Kenny toast is not tourist food', !('toast' in R.FOODS));
check('every food has points and energy', Object.values(R.FOODS).every(f => f.points > 0 && f.energy > 0));
// Food on the ground
check('landed food starts whole', R.groundSize(0) === 1);
check('it stays whole until the fade', R.groundSize(R.GROUND_LIFE - R.FADE_TIME) === 1);
check('it is half gone halfway through the fade', near(R.groundSize(R.GROUND_LIFE - R.FADE_TIME / 2), 0.5));
check('it is gone at GROUND_LIFE', R.groundSize(R.GROUND_LIFE) === 0 && R.groundSize(R.GROUND_LIFE + 5) === 0);
let shrinks = true;
for (let a = 0; a < R.GROUND_LIFE; a += 0.01) if (R.groundSize(a + 0.01) > R.groundSize(a)) shrinks = false;
check('it never grows back', shrinks);

// Groups of people: the sweet spot
{
  const C = R.CLUSTER, fresh = () => ({ nerves: 0, cooldown: 0 });
  check('far away they have not noticed', R.clusterStep(fresh(), C.far + 1, 0.1, 5) === 'unaware');
  check('in the sweet spot they throw', R.clusterStep(fresh(), (C.near + C.far) / 2, 0.1, 5) === 'throw');
  const s1 = fresh(); R.clusterStep(s1, 10, 0.1, 5);
  check('then they wait before the next throw', R.clusterStep(s1, 10, 0.1, 5) === 'wait');
  let s2 = fresh(), got = null;
  for (let t = 0; t < 3 && got !== 'throw'; t += 0.1) got = R.clusterStep(s2, 10, 0.1, 5);
  check('and throw again after a while', got === 'throw');
  check('with no food left they do nothing', R.clusterStep(fresh(), 10, 0.1, 0) === 'unaware');
  check('stepping inside the inner ring makes them nervous first', R.clusterStep(fresh(), C.near - 1, 0.1, 5) === 'nervous');
  let s3 = fresh(), r3 = null, time = 0;
  while (r3 !== 'flee' && time < 5) { r3 = R.clusterStep(s3, C.near - 1, 0.1, 5); time += 0.1; }
  check('staying too close makes them bolt, after about a second', r3 === 'flee' && Math.abs(time - C.nerve) < 0.15, time);
  check('charging right up makes them bolt at once', R.clusterStep(fresh(), C.panic - 0.1, 0.1, 5) === 'flee');
  const s4 = fresh(); for (let i = 0; i < 6; i++) R.clusterStep(s4, C.near - 1, 0.1, 5);
  R.clusterStep(s4, 10, 2, 5);
  check('backing off lets them calm down', s4.nerves < 0.2, s4.nerves);
  check('the rings make sense', C.panic < C.near && C.near < C.far);
}

// Catch points: ground 1, air 2, jumping 3
check('ground scoop is 1', R.catchPoints('ground', 0, false) === 1);
check('air catch is 2', R.catchPoints('air', 0, false) === 2);
check('jumping catch is 3', R.catchPoints('leap', 0, false) === 3);
check('the order rewards skill', R.CATCH_POINTS.leap > R.CATCH_POINTS.air && R.CATCH_POINTS.air > R.CATCH_POINTS.ground);
check('a streak still multiplies', R.catchPoints('air', 10, false) === 4);
check("Kenny's jar doubles", R.catchPoints('leap', 0, true) === 6);

// Feed-o-meter
check('red zone starts below FEED_RED', R.inRedZone(R.FEED_RED - 0.01) && !R.inRedZone(R.FEED_RED));
check('red zone is where he is already slowing', R.speedFactor(R.FEED_RED) < 1);
check('waking from a nap is out of the red', !R.inRedZone(R.REVIVE_ENERGY));
check('three lives', R.LIVES === 3);
check('food passing under the deck carries on to the water', R.foodSurface(0, B.z, 1) === R.WATER_Y);

// The boardwalk is solid from the side (Ken): jump onto it, or swim under where it is high.
{
  const { deckBlocks, deckHeight: dh, BOARDWALK: B, WALLY_TALL } = await import('../js/rules.js');
  const lowX = B.flat + 4;                                   // on a ramp, part way down (clear of the steps)
  check('walking into a low part of the boardwalk is blocked', deckBlocks(lowX, B.z, 0.0, false));
  check('jumped up level with it, he is not blocked', !deckBlocks(lowX, B.z, dh(lowX) - 0.1, false));
  check('swimming under the high middle is allowed', !deckBlocks(0, B.z, -0.45, true));
  check('standing upright under the high middle is too low for him', deckBlocks(0, B.z, -0.45, false) === (dh(0) - 0.35 + 0.45 < WALLY_TALL));
  check('beside the boardwalk nothing blocks', !deckBlocks(lowX, B.z + B.width, 0.0, false));
  check('the steps are a way up', !deckBlocks(-34, B.z, 0.0, false));
  const { standHeight: sh } = await import('../js/rules.js');
  check('at the steps he walks up onto the deck', sh(-34, B.z, 0.0).surface === 'deck');
  check('away from the steps, from the ground he stays on the ground', sh(B.flat + 4, B.z, 0.0).surface !== 'deck');
}

// The first level is the training level: the meter lasts longest there, and each level after drains a little faster (Ken).
{
  const { energyDrain: d, LEVEL_DRAIN: L } = await import('../js/rules.js');
  const secs = lvl => 100 / d('upright', true, lvl);
  check('Croc Park gives the most time on the meter', secs('park') > secs('esplanade') && secs('esplanade') > secs('reef'));
  check('running flat out in Croc Park, a full meter lasts over a minute', secs('park') > 60);
  check('levels get harder in trip order', ['park', 'esplanade', 'reef', 'kuranda', 'daintree', 'mossman'].every((k, i, a) => i === 0 || L[k] >= L[a[i - 1]]));
  check('no level given means the full rate', d('upright', true) === d('upright', true, 'reef'));
}

// Ken: under half, Wally can go to Kenny for a scoop from his jar.
check('under half and next to Kenny: he can ask', R.canAskKenny(R.FEED_HALF - 1, 0, 1));
check('at half or more he cannot', !R.canAskKenny(R.FEED_HALF, 0, 1));
check('not from across the park', !R.canAskKenny(20, 0, R.ASK_RANGE + 1));
check('not while Kenny is filling the jar again', !R.canAskKenny(20, 5, 1));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
