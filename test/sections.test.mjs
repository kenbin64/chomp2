// The park's sections and the catcher's way-finding (park-sections.js, nav.js, Ken 2026-10-30). What must hold: both
// ways round reach the way out, about equally far; the gates are wide enough; the walls really shut the path;
// nothing stands on anything else; and the catcher finds his way through, as he could not by steering alone.
import { PATH, STAND, DECK_OPENINGS, fencePoint, fenceOffset, kioskSpots } from '../js/rules.js';
import { OUTER, EXIT_SPOT, EXIT_ANGLE, GATE_POST, afterCatches, PENS, penShape, boxEdges, deckRails, segmentDistance, clampOutside, newCatcher, alertCatcher, catcherStep } from '../js/chase-rules.js';
import { DIVIDERS, ironWalls, gates, lowWalls, sectionSolids, sectionHops, sectionScreens, placed, TABLES, CRATES, UTE, REPTILE, BAR_H, STACKS, stackBoxes, allBoxes, clearOfSections, pathShutAt, setLockdown, wallSolids, dressingSolids, gateBarSolids } from '../js/park-sections.js';
setLockdown(true);                 // these are the grounds as they are in the chase; the loop before it is tested below
import { Nav, nextStep, solidsIndex } from '../js/nav.js';
import { MANGO_NEED, GIVE_REACH, MANGO_COUNTS, mangoSpots, giantChestSpot } from '../js/escape-rules.js';
import { parkGround, setParkMode, addSolid, SOLIDS } from '../js/ground.js';

let passed = 0, failed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log('  FAIL', name, detail); } };

// The solid world, as the catcher has it (no trees or lamps here: they stand clear of the sections, see below).
const solids = [...sectionSolids()];
for (const p of PENS) for (const w of penShape(p).walls) for (let t = 0; t <= 1; t += 0.05) solids.push({ x: w.ax + (w.bx - w.ax) * t, z: w.az + (w.bz - w.az) * t, r: 0.12, top: Infinity });
for (const k of kioskSpots()) for (const i of [-1, 0, 1]) solids.push({ x: k.x + Math.cos(k.rot) * i * STAND.w / 3, z: k.z - Math.sin(k.rot) * i * STAND.w / 3, r: STAND.d / 2, top: Infinity });
// The lamps on the boardwalk's rail, as main.js puts them: one of these wedged him in a pocket by the rail, in the game.
{ let side = 1; for (let x = -54; x <= 54; x += 12) { solids.push({ x, z: 2 + side * 2.38, r: 0.2, top: Infinity }); side = -side; } }
const rails = [...deckRails(DECK_OPENINGS), ...sectionHops()];
const solid = solidsIndex(solids, 0.35);
const free = extra => (x, z) => { const p = clampOutside(x, z); return p.x === x && p.z === z && !solid(x, z) && !rails.some(r => segmentDistance(x, z, r) < 0.35) && !(extra && extra(x, z)); };
const bounds = { x0: -OUTER.rx, x1: OUTER.rx, z0: -OUTER.rz, z1: OUTER.rz };
// (Planned with more room than he walks with, as in chase.js.)
const roomySolid = solidsIndex(solids, 0.7);
const nav = new Nav(bounds, (x, z) => { const p = clampOutside(x, z); return p.x === x && p.z === z && !roomySolid(x, z) && !rails.some(r => segmentDistance(x, z, r) < 0.7); });
const START = fencePoint(0.07, 4), angleOf = (x, z) => Math.atan2(z / 18, x / 28);

const all = nav.path(START.x, START.z, EXIT_SPOT.x, EXIT_SPOT.z);
check('there is a way from the bridge to the way out', !!all);
check('his post at the gate is somewhere he can stand', free()(GATE_POST.x, GATE_POST.z));

// Each way round, with the other shut off.
const shut = (deg, wide = 0.12) => { const a = deg * Math.PI / 180; return (x, z) => Math.abs(Math.atan2(Math.sin(angleOf(x, z) - a), Math.cos(angleOf(x, z) - a))) < wide; };
const south = new Nav(bounds, free(shut(315))).path(START.x, START.z, EXIT_SPOT.x, EXIT_SPOT.z);
const north = new Nav(bounds, free(shut(50))).path(START.x, START.z, EXIT_SPOT.x, EXIT_SPOT.z);
check('the south way round reaches the way out', !!south);
check('the north way round reaches the way out', !!north);
if (south && north) {
  const a = Nav.length(south), b = Nav.length(north);
  console.log(`  south ${a.toFixed(0)} m, north ${b.toFixed(0)} m (at 5.6 m/s: ${(a / 5.6).toFixed(0)} s, ${(b / 5.6).toFixed(0)} s)`);
  check('neither way round is hugely shorter', Math.max(a, b) / Math.min(a, b) < 1.4, `${a.toFixed(0)} vs ${b.toFixed(0)}`);
  check('the run is a real run, at least 20 s flat out', Math.min(a, b) / 5.6 > 20, (Math.min(a, b) / 5.6).toFixed(1));
}

// No slipping through walls: a grid search must not cross a wall that the walker cannot.
{
  const pts = all || [], crossing = pts.slice(1).filter((p, i) => ironWalls().some(s => segmentDistance((p.x + pts[i].x) / 2, (p.z + pts[i].z) / 2, s) < 0.1));
  check('the way found never crosses an iron wall', pts.length > 0 && !crossing.length, crossing.length);
  const t0 = performance.now(); for (let i = 0; i < 5; i++) nav.path(START.x, START.z, EXIT_SPOT.x, EXIT_SPOT.z);
  const ms = (performance.now() - t0) / 5; console.log(`  a full-length search takes ${ms.toFixed(1)} ms`);
  check('a search is quick enough to run during play', ms < 30, ms.toFixed(1));
}

// The gates and walls.
check('every gate is wide enough for Wally and a chase', gates().every(g => g.wide >= 2.5));
for (const d of DIVIDERS.filter(d => d.gates.length === 1)) {
  const lane = fencePoint(d.deg * Math.PI / 180, PATH.lanes[1]);
  check(`the wall at ${d.deg} shuts the path`, ironWalls().some(s => segmentDistance(lane.x, lane.z, s) < 0.05));
  check(`strollers turn back at ${d.deg}`, pathShutAt(d.deg * Math.PI / 180));
}
for (const d of DIVIDERS.filter(d => d.gates.length === 2)) check(`the path stays open at ${d.deg}`, !pathShutAt(d.deg * Math.PI / 180));
setLockdown(false);
check('before he breaks out, the patrons walk the whole loop', Array.from({ length: 720 }, (_, i) => i / 720 * Math.PI * 2).every(a => !pathShutAt(a)));
setLockdown(true);
check('the walls are solid only once they are up: nothing else in the grounds is them', wallSolids().length > 100 && dressingSolids().every(s => s.r > 0) && sectionSolids().length === wallSolids().length + dressingSolids().length);
check('every wall reaches the outer fence side', DIVIDERS.every(d => { const a = d.deg * Math.PI / 180; return ironWalls().some(s => Math.hypot(s.bx / OUTER.rx, s.bz / OUTER.rz) > 0.98 && Math.abs(Math.atan2(s.bz / 18, s.bx / 28) - Math.atan2(Math.sin(a), Math.cos(a))) < 0.2); }));

// Nothing on top of anything else.
const stands = kioskSpots(), pens = PENS.map(penShape);
const things = [...TABLES.map(t => ({ ...placed(t.deg, t.out), r: 1.5, n: 'table' })), ...CRATES.map(c => ({ ...placed(c.deg, c.out), r: 1.6, n: 'crate' })), { ...placed(UTE.deg, UTE.out), r: 2.6, n: 'ute' }, { ...placed(REPTILE.deg, REPTILE.out), r: 4.5, n: 'reptile' }];
check('nothing out in the grounds stands on the path', things.every(t => fenceOffset(t.x, t.z) > PATH.outer));
check('nothing stands on a shop', things.every(t => stands.every(k => Math.hypot(t.x - k.x, t.z - k.z) > t.r + 2)));
check('nothing stands in a gate', things.every(t => gates().every(g => Math.hypot(t.x - g.x, t.z - g.z) > t.r + g.wide / 2)));
check('no wall runs through a shop', stands.every(k => ironWalls().every(s => segmentDistance(k.x, k.z, s) > 3.2)));
check('no wall runs through a pen', pens.every(p => ironWalls().every(s => segmentDistance(p.x, p.z, s) > 3.2)));
check('the way out is clear of the walls', ironWalls().every(s => segmentDistance(EXIT_SPOT.x, EXIT_SPOT.z, s) > 3));
check('and of everything out there', things.every(t => Math.hypot(t.x - EXIT_SPOT.x, t.z - EXIT_SPOT.z) > t.r + 3));
check('trees keep off the walls', !clearOfSections(ironWalls()[0].ax, ironWalls()[0].az));

// Low walls: a blocker for the catcher, a hop for Wally.
check('the low walls are hoppable: solid only up to their tops', sectionSolids().filter(s => s.r < 0.5 && s.top !== Infinity).length > 10 && sectionSolids().filter(s => s.r < 0.5 && s.top !== Infinity).every(s => s.top - 0.35 < 1.3));
const hop = lowWalls()[0], m = { x: (hop.ax + hop.bx) / 2, z: (hop.az + hop.bz) / 2 };
check('the catcher cannot cross one', !free()(m.x, m.z));

// The catcher's views are blocked by the iron walls.
check('there are walls to hide behind', sectionScreens().length > 15);

// The catcher running it for real, with the same world: from the far side to the bridge, without getting stuck.
const world = { screens: sectionScreens(), free: free(), clamp: clampOutside, route: (c, tx, tz) => nextStep(nav, c, tx, tz) };
const trip = (from, to) => {
  const c = newCatcher(from); alertCatcher(c, to);
  let closest = Infinity, took = null;
  for (let t = 0; t < 90; t += 1 / 30) {
    catcherStep(c, { x: 0, z: 0, out: false }, 1 / 30, world);
    const d = Math.hypot(c.x - to.x, c.z - to.z); if (d < closest) closest = d;
    if (d < 1.1) { took = t; break; }
  }
  return { took, closest };
};
for (const [name, a, b] of [['the far side to the bridge', fencePoint(Math.PI, 4.6), START], ['the Food Court into the Reptile House', placed(60, 12), placed(120, 18)], ['the Service Yard into the Keepers\' Yards', placed(310, 16), placed(255, 6.5)], ['the bridge to the way out', START, EXIT_SPOT]]) {
  const r = trip(a, b);
  check(`he finds his way: ${name}`, r.took !== null, `${r.closest.toFixed(1)} m short`);
  if (r.took !== null) console.log(`  ${name}: ${r.took.toFixed(1)} s`);
}
// Out of the pocket the game found him wedged in, between the boardwalk's rail and the croc fence, heading for a
// point he can no longer see.
{
  const c = newCatcher({ x: -39.83, z: 4.23 }); alertCatcher(c, START);
  c.plan = [{ x: -36.26, z: 13.19 }, { x: -30, z: 18 }]; c.planFor = { x: START.x, z: START.z };
  let far = 0;
  for (let t = 0; t < 8; t += 1 / 30) { catcherStep(c, { x: 0, z: 0, out: false }, 1 / 30, world); far = Math.max(far, Math.hypot(c.x + 39.83, c.z - 4.23)); }
  check('he gets out of the pocket by the rail', far > 10, far.toFixed(1));
}
// And a chase through a gate: Wally runs from him along the way round, and he keeps coming.
{
  const c = newCatcher(placed(65, 12)); c.mode = 'chase'; c.last = placed(100, 12);
  const w = { ...placed(100, 12), out: true };
  let moved = 0, px = c.x, pz = c.z, stuck = 0;
  for (let t = 0; t < 12; t += 1 / 30) { catcherStep(c, w, 1 / 30, world); const d = Math.hypot(c.x - px, c.z - pz); moved += d; if (d < 0.02) stuck++; px = c.x; pz = c.z; if (c.mode === 'patrol') break; }
  check('he goes after Wally through a wall\'s gate, not stuck at it', stuck < 30 && moved > 10, `moved ${moved.toFixed(1)} m, stuck ${stuck} frames`);
}

// Wally himself, by the game's own movement (ground.js), along each way round: he gets through every gate. Walking
// the found way in small steps, stopped by anything solid.
setParkMode('outside');
for (const s of solids) addSolid(s.x, s.z, s.r, s.top);
const walk = pts => {
  let x = pts[0].x, z = pts[0].z, worst = 0;
  for (const p of pts) {
    for (let k = 0; k < 40 && Math.hypot(p.x - x, p.z - z) > 0.05; k++) {
      const d = Math.hypot(p.x - x, p.z - z), st = Math.min(0.1, d), r = parkGround.move(x, z, x + (p.x - x) / d * st, z + (p.z - z) / d * st, 0.35);
      x = r.x; z = r.z;
    }
    worst = Math.max(worst, Math.hypot(p.x - x, p.z - z));
  }
  return { x, z, worst };
};
// (Planned for his width: he is wider than the catcher, and the catcher's way hugs the walls closer than he fits.)
const wide = solidsIndex(solids, 0.65);
const freeWally = extra => (x, z) => { const p = clampOutside(x, z); return p.x === x && p.z === z && !wide(x, z) && !rails.some(r => segmentDistance(x, z, r) < 0.65) && !(extra && extra(x, z)); };
const wallySouth = new Nav(bounds, freeWally(shut(315))).path(START.x, START.z, EXIT_SPOT.x, EXIT_SPOT.z);
const wallyNorth = new Nav(bounds, freeWally(shut(50))).path(START.x, START.z, EXIT_SPOT.x, EXIT_SPOT.z);
check('there is room for Wally both ways round', !!wallySouth && !!wallyNorth);
for (const [name, pts] of [['south', wallySouth], ['north', wallyNorth]]) {
  const w = walk(pts);
  check(`Wally walks the ${name} way to the way out, never held up for long`, Math.hypot(w.x - EXIT_SPOT.x, w.z - EXIT_SPOT.z) < 2.5 && w.worst < 2.5, `ended ${Math.hypot(w.x - EXIT_SPOT.x, w.z - EXIT_SPOT.z).toFixed(1)} m off, worst ${w.worst.toFixed(1)} m`);
}
// The boss must actually be a boss (Ken, 2026-10-30: "I was never chased"). From his post at the gate, whichever way
// Wally runs flat out, he spots Wally at once and is still after him well into the run.
const along = (pts, d) => { for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); if (d <= L) return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * d / L, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * d / L }; d -= L; } return pts[pts.length - 1]; };
for (const [name, pts] of [['south', wallySouth], ['north', wallyNorth]]) {
  const c = newCatcher(GATE_POST); alertCatcher(c, START);
  const len = Nav.length(pts); let spotted = null, inChase = 0, caught = false, gap = 0;
  for (let t = 0; t * 5.6 < len; t += 1 / 30) {
    const w = along(pts, t * 5.6), e = catcherStep(c, { ...w, out: true }, 1 / 30, world);
    if (e === 'spotted' && spotted === null) spotted = t;
    if (c.mode === 'chase') inChase += 1 / 30;
    gap = Math.hypot(w.x - c.x, w.z - c.z);
    if (e === 'caught') { caught = true; break; }
  }
  console.log(`  running ${name}: spotted after ${spotted === null ? '-' : spotted.toFixed(1)} s, chased for ${inChase.toFixed(1)} s of ${(len / 5.6).toFixed(0)} s, ${caught ? 'caught' : `${gap.toFixed(0)} m behind at the way out`}`);
  check(`running ${name}: the catcher is after him at once`, spotted !== null && spotted < 2, spotted);
  check(`running ${name}: and it is a real chase`, inChase > 5 || caught, inChase.toFixed(1));
  check(`running ${name}: flat out at full energy he can still get away`, !caught);
}
// The race itself (escape-rules.js): either way round has the mangoes to do it, and a plain bot that only goes for the
// nearest thing, never dodging, can finish it against the catcher: challenging, not impossible.
{
  // (The bot keeps to the ground and goes through the gates, the hardest way: it neither jumps bars nor climbs boxes.)
  const spots = mangoSpots().filter(p => !p.up), chest = giantChestSpot(), barsIn = found => gates().filter(g => g.need > found).flatMap(gateBarSolids).map(s => ({ ...s, top: Infinity }));
  const openFree = freeWally();
  check('every mango can be reached', spots.every(p => openFree(p.x, p.z)), spots.filter(p => !openFree(p.x, p.z)).map(p => `${p.x.toFixed(0)},${p.z.toFixed(0)}`).join(' '));
  const chestFree = openFree(chest.x + 2, chest.z) || openFree(chest.x - 2, chest.z) || openFree(chest.x, chest.z + 2) || openFree(chest.x, chest.z - 2);
  check('the chest can be reached', chestFree);
  const C = MANGO_COUNTS;
  check('going south there are enough mangoes for each gate', C.bridge >= 4 && C.bridge + C.foodCourt >= 11 && C.bridge + C.foodCourt + C.wayOut >= MANGO_NEED, JSON.stringify(C));
  check('going north too', C.bridge >= 4 && C.bridge + C.serviceYard >= 11 && C.bridge + C.serviceYard + C.keepersYards >= 15 && C.bridge + C.serviceYard + C.keepersYards + C.wayOut >= MANGO_NEED);
  check('it takes more than the start of the park', C.bridge < MANGO_NEED);
  const navFor = found => { const bars = solidsIndex(barsIn(found), 0.65); return new Nav(bounds, freeWally((x, z) => bars(x, z))); };
  const race = (speed, wait) => {
    let x = START.x, z = START.z, found = 0, giant = false, given = false, caught = 0, t = 0, plan = null, d = 0, nav = navFor(0);
    const left = new Set(spots), catcher = newCatcher(GATE_POST); alertCatcher(catcher, START, 1.5);
    let c = catcher, pause = 0, watchAt = 0, watchX = c.x, watchZ = c.z, stuck = 0;
    const planTo = () => {
      if (found >= MANGO_NEED && !giant) return nav.path(x, z, chest.x, chest.z);
      if (giant) return nav.path(x, z, EXIT_SPOT.x, EXIT_SPOT.z);
      let best = null, bl = Infinity;
      for (const m of [...left].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, 8)) { const q = nav.path(x, z, m.x, m.z); if (q && Nav.length(q) < bl) { best = q; bl = Nav.length(q); } }
      return best;
    };
    for (; t < 300; t += 1 / 30) {
      if (!plan) { plan = planTo(); d = 0; if (!plan) return { stuck: true, t, found, caught }; }
      if (pause > 0) pause -= 1 / 30;
      else {
        d += speed / 30;
        const q = along(plan, d); x = q.x; z = q.z;
        if (d >= Nav.length(plan)) plan = null;
      }
      if (giant && !given && Math.hypot(c.x - x, c.z - z) < GIVE_REACH) { given = true; plan = null; }      // handing it over
      const w = { x, z, out: !given }, e = catcherStep(c, w, 1 / 30, world);
      if (c.hold > 0) { watchAt = t; watchX = c.x; watchZ = c.z; }     // (waiting on purpose: Wally's head start)
      if (t - watchAt >= 3) { if (!given && c.hold <= 0 && c.speed > 0 && c.mode !== 'patrol' && Math.hypot(c.x - watchX, c.z - watchZ) < 1.5 && Math.hypot(c.x - c.last.x, c.z - c.last.z) > 3) stuck++; watchAt = t; watchX = c.x; watchZ = c.z; }
      if (e === 'caught') { caught++; x = START.x; z = START.z; plan = null; c = newCatcher(GATE_POST); { const a = afterCatches(caught); alertCatcher(c, START, a.hold, a.pace); } pause = 1.5; continue; }
      for (const m of [...left]) if (Math.hypot(m.x - x, m.z - z) < 1.5) {
        left.delete(m); found++; plan = null; pause = wait;
        if (gates().some(g => g.need === found)) nav = navFor(found);
      }
      if (found >= MANGO_NEED && !giant && Math.hypot(chest.x - x, chest.z - z) < 2.6) { giant = true; plan = null; }
      if (given && Math.hypot(EXIT_SPOT.x - x, EXIT_SPOT.z - z) < 1.3) return { done: true, t, found, caught, stuck };
    }
    return { done: false, t, found, caught, stuck };
  };
  for (const [name, speed, wait] of [['flat out', 5.6, 0], ['a good player', 5.2, 0.15], ['a beginner', 4.4, 0.4]]) {
    const r = race(speed, wait);
    console.log(`  ${name}: ${r.done ? `finished in ${r.t.toFixed(0)} s` : r.stuck ? 'STUCK' : 'not finished'}, ${r.found} mangoes, caught ${r.caught} times`);
    check(`${name} can finish the race`, r.done, JSON.stringify(r));
    check(`${name}: the catcher never gets stuck on the way`, !r.stuck, JSON.stringify(r));
  }
}
// The boxes: nothing stands where they are; each is a jump from the last, up to a mango; the catcher cannot get up.
{
  const boxes = allBoxes(), stacks = STACKS.map(stackBoxes), APEX = 8.5 * 8.5 / (2 * 22), REACH = 8.5 * 2 / 22 * 5.6;
  const others = [...wallSolids(), ...solids.filter(q => q.top === Infinity && !wallSolids().some(w => w.x === q.x && w.z === q.z))];
  const clash = boxes.filter(b => others.some(q => Math.hypot(q.x - b.x, q.z - b.z) < q.r + 1.4));
  check('no box stands in anything', !clash.length, clash.map(b => `${b.x.toFixed(0)},${b.z.toFixed(0)}`).join(' '));
  check('no box stands on the path', boxes.every(b => !(fenceOffset(b.x, b.z) > PATH.inner - 1.4 && fenceOffset(b.x, b.z) < PATH.outer + 1.4)));
  check('every box is inside the grounds', boxes.every(b => { const p = clampOutside(b.x, b.z); return p.x === b.x && p.z === b.z; }));
  check('each is a jump up from the last', stacks.every(st => st.every((b, i) => { const from = i ? st[i - 1].top : 0; return b.top - from < APEX + 0.3; })), APEX.toFixed(2));
  check('and within a running jump across', stacks.every(st => st.slice(1).every((b, i) => Math.hypot(b.x - st[i].x, b.z - st[i].z) < REACH)), REACH.toFixed(1));
  check('a running jump clears shut bars', 0.35 + APEX >= 0.35 + BAR_H - 0.35 && 0.35 + APEX > BAR_H, APEX.toFixed(2));
  check('bars are a jump, not a walk or a hop', BAR_H + 0.35 - 0.35 > 1.3);
  check('there are mangoes up on the boxes', mangoSpots().filter(p => p.up).length === STACKS.length * 2);
  // Up on a box, Wally is out of the catcher's reach, even standing right over him.
  const c = newCatcher({ x: boxes[0].x + 1.6, z: boxes[0].z }); c.mode = 'chase'; c.last = { x: boxes[0].x, z: boxes[0].z };
  let got = false; for (let t = 0; t < 3; t += 1 / 30) if (catcherStep(c, { x: boxes[0].x, z: boxes[0].z, out: true, high: true }, 1 / 30, world) === 'caught') got = true;
  check('up on the boxes, he cannot be caught', !got);
}
// Landed on a barrier (Ken, 2026-10-30: stuck on one, and could not get off): whichever way he pushes, he gets clear.
{
  const low0 = lowWalls()[0], m0 = { x: (low0.ax + low0.bx) / 2, z: (low0.az + low0.bz) / 2 };
  let trapped = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2; let x = m0.x, z = m0.z;
    for (let k = 0; k < 60; k++) { const r = parkGround.move(x, z, x + Math.sin(a) * 0.1, z + Math.cos(a) * 0.1, 0.35); x = r.x; z = r.z; }
    if (Math.hypot(x - m0.x, z - m0.z) < 1) trapped.push(i);
  }
  check('down on a low wall, he can walk off it, whichever way he pushes', !trapped.length, `stuck pushing ${trapped.length} of 16 ways`);
}
// The catcher, with Wally just over a low wall that he cannot cross: he stands and glares, he does not jitter about.
{
  const low0 = lowWalls()[0], m0 = { x: (low0.ax + low0.bx) / 2, z: (low0.az + low0.bz) / 2 }, L = Math.hypot(low0.bx - low0.ax, low0.bz - low0.az), nx0 = -(low0.bz - low0.az) / L, nz0 = (low0.bx - low0.ax) / L;
  const c = newCatcher({ x: m0.x + nx0 * 1.6, z: m0.z + nz0 * 1.6 }); c.mode = 'chase';
  const w = { x: m0.x - nx0 * 1.3, z: m0.z - nz0 * 1.3, out: true };
  let flips = 0, last = c.heading; 
  for (let t = 0; t < 3; t += 1 / 30) { catcherStep(c, w, 1 / 30, world); if (Math.abs(Math.atan2(Math.sin(c.heading - last), Math.cos(c.heading - last))) > 0.1) flips++; last = c.heading; }
  check('held up by a wall right beside Wally, the catcher does not dither', flips < 8, `${flips} jerks in 3 s`);
}
// A low wall stops him on the flat, and he passes it in the air; an iron wall stops him either way.
const low = lowWalls()[0], mid = { x: (low.ax + low.bx) / 2, z: (low.az + low.bz) / 2 }, ln = Math.hypot(low.bx - low.ax, low.bz - low.az), nx = -(low.bz - low.az) / ln, nz = (low.bx - low.ax) / ln;
const from = { x: mid.x - nx * 0.8, z: mid.z - nz * 0.8 }, to = { x: mid.x + nx * 0.8, z: mid.z + nz * 0.8 };
const across = y => { let x = from.x, z = from.z; for (let k = 0; k < 40; k++) { const r = parkGround.move(x, z, x + nx * 0.05, z + nz * 0.05, y); x = r.x; z = r.z; } return Math.hypot(x - to.x, z - to.z); };
check('a low wall stops him on the flat', across(0.35) > 0.5, across(0.35).toFixed(2));
check('and he clears it in a hop', across(1.0) < 0.5, across(1.0).toFixed(2));
const ir = ironWalls()[1], im = { x: (ir.ax + ir.bx) / 2, z: (ir.az + ir.bz) / 2 }, il = Math.hypot(ir.bx - ir.ax, ir.bz - ir.az), inx = -(ir.bz - ir.az) / il, inz = (ir.bx - ir.ax) / il;
{ let x = im.x - inx, z = im.z - inz; for (let k = 0; k < 40; k++) { const r = parkGround.move(x, z, x + inx * 0.05, z + inz * 0.05, 1.9); x = r.x; z = r.z; } check('an iron wall stops him even in a jump', (x - im.x) * inx + (z - im.z) * inz < 0, ((x - im.x) * inx + (z - im.z) * inz).toFixed(2)); }

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
