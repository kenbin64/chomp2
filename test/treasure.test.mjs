// Croc Park's lagoon treasure (Ken, 2026-10-18): the rules, without the drawing.
import { LOST_THINGS, PARK_TREASURE, TREASURE_REWARD, lostSpots, swimDepth, canTake, chestOpens, crocBites, jellyDepth } from '../js/treasure-rules.js';
import { isWater, terrainHeight } from '../js/rules.js';
import { freshProgress, findTreasure, readProgress } from '../js/progress.js';

let pass = 0, fail = 0;
function check(name, ok) { if (ok) pass++; else { fail++; console.log('FAIL', name); } }
function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

// Every layout, many seeds: all five things, all in deep water, spread out.
let allGood = true, differ = false, first = null;
for (let seed = 1; seed < 200; seed++) {
  const spots = lostSpots(seeded(seed), isWater, terrainHeight);
  if (spots.length !== LOST_THINGS.length) allGood = false;
  for (const s of spots) {
    if (!isWater(s.x, s.z) || terrainHeight(s.x, s.z) > PARK_TREASURE.diveY - 0.3) allGood = false;
    const d = Math.hypot(s.x - PARK_TREASURE.chest.x, s.z - PARK_TREASURE.chest.z);
    if (d < PARK_TREASURE.near * 0.6 || d > PARK_TREASURE.far + 0.1) allGood = false;
  }
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) if (Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z) < 2) allGood = false;
  const key = spots.map(s => s.x.toFixed(1)).join();
  if (first === null) first = key; else if (key !== first) differ = true;
}
check('every layout has all five lost things on the deep bottom, spread out round the chest', allGood);
check('the layout is different from game to game', differ);
check('the chest sits on the deep bottom', isWater(0, 0) && terrainHeight(0, 0) < PARK_TREASURE.diveY - 0.5);

// Swimming depth: never into the bed, never above the surface.
check('down at the bottom in the deep middle', swimDepth(PARK_TREASURE.diveY, -3) === PARK_TREASURE.diveY);
check('over the shallows he rides up off the bed', swimDepth(PARK_TREASURE.diveY, -2.5) === -2.5 + 0.65);
check('in the very shallow edge he is back at the surface', swimDepth(PARK_TREASURE.diveY, -0.8) === PARK_TREASURE.surfaceY);

// Picking things up: at the bottom, not from the surface above.
const thing = { x: 5, z: 0, y: -2.75 };
check('swimming over it at the bottom picks it up', canTake(5.5, 0.3, -2.2, thing));
check('floating at the surface above it does not', !canTake(5, 0, PARK_TREASURE.surfaceY, thing));

// The chest: only with everything found, and only down at it.
check('the chest stays shut until every lost thing is found', !chestOpens(4, 5, 0.5, 0, -2.2));
check('with them all, swimming down to it opens it', chestOpens(5, 5, 0.5, 0, -2.2));
check('not from the surface above it', !chestOpens(5, 5, 0, 0, PARK_TREASURE.surfaceY));

// The guard croc bites under water, near its depth; at the surface it only pushes.
check('the guard bites when he swims into it under water', crocBites(1, 0, -2.2, 0, 0, PARK_TREASURE.guardY));
check('not when he is well clear of it', !crocBites(4, 0, -2.2, 0, 0, PARK_TREASURE.guardY));
check('not at the surface', !crocBites(0, 0, PARK_TREASURE.surfaceY, 0, 0, -0.25));

// Deep jellies drift the whole water column, so there is always a gap.
const ys = Array.from({ length: 400 }, (_, i) => jellyDepth(i * 0.1, 0));
check('a deep jelly reaches near the bottom and near the top', Math.min(...ys) < -2.3 && Math.max(...ys) > -0.3);

// The reward: big the first time, a little after.
const p1 = findTreasure({ ...freshProgress(), mangoes: 3 }, 'park', TREASURE_REWARD);
check('the first find pays the big reward and is remembered', p1.first && p1.progress.mangoes === 13 && p1.progress.treasures.includes('park'));
const p2 = findTreasure(p1.progress, 'park', TREASURE_REWARD);
check('finding it again pays a little', !p2.first && p2.progress.mangoes === 15 && p2.progress.treasures.length === 1);
check('treasures found are saved', readProgress(JSON.stringify(p1.progress)).treasures.join() === 'park');
check('an older save has none yet', readProgress(JSON.stringify({ unlocked: ['park'] })).treasures.length === 0);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
