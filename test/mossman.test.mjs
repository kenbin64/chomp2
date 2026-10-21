// Tests for js/levels/mossman-rules.js: the gorge, and attempts to break it.
// Run:  node test/mossman.test.mjs

import * as M from '../js/levels/mossman-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

// ---- The holes -------------------------------------------------------------------------
check('five swimming holes', M.POOLS.length === 5);
check('each hole is lower than the one before (the river runs downhill)', M.POOLS.every((p, i) => i === 0 || p.level < M.POOLS[i - 1].level));
check('the holes do not overlap', M.POOLS.every((p, i) => i === 0 || p.z - p.r > M.POOLS[i - 1].z + M.POOLS[i - 1].r));
check('the key and the chest are in different holes, the chest in the last', M.KEY_POOL !== M.CHEST_POOL && M.CHEST_POOL === M.POOLS.length - 1);
check('the middle of every hole is in the hole', M.POOLS.every((p, i) => M.poolAt(M.riverX(p.z), p.z) === i));
check('the rock beside a hole is not in it', M.POOLS.every(p => M.poolAt(M.riverX(p.z) + p.r + 2, p.z) === -1));
check('a hole is deep enough to dive in, with room off the bottom', M.POOL_DEPTH - M.DIVE_DROP > 0.5 && M.DIVE_DROP > M.SURFACE_DROP);

// ---- The slides ------------------------------------------------------------------------
for (let i = 0; i < M.POOLS.length - 1; i++) {
  const s = M.slideEnds(i);
  const zm = (s.z0 + s.z1) / 2, on = M.slideAt(M.riverX(zm), zm);
  check(`slide ${i + 1} runs from hole ${i + 1} down into hole ${i + 2}`, on && on.i === i && s.y0 > s.y1);
  check(`slide ${i + 1} is downhill all the way`, (() => { let last = Infinity; for (let z = s.z0; z <= s.z1; z += 0.5) { const g = M.slideAt(M.riverX(z), z); if (!g || g.y > last + 1e-9) return false; last = g.y; } return true; })());
  check(`slide ${i + 1} starts at the top hole's water and ends at the next one's`, Math.abs(s.y0 - M.POOLS[i].level) < 1e-9 && Math.abs(s.y1 - M.POOLS[i + 1].level) < 1e-9);
  check(`slide ${i + 1} is not too steep to ride (under 40 degrees)`, Math.atan2(s.y0 - s.y1, s.z1 - s.z0) * 180 / Math.PI < 40);
  check(`off to the side of slide ${i + 1} is rock, not slide`, M.slideAt(M.riverX(zm) + M.SLIDE_HALF + 1, zm) === null);
}

// ---- The ground ------------------------------------------------------------------------
{
  const p = M.POOLS[1], x = M.riverX(p.z);
  const top = M.groundAt(x, p.z), down = M.groundAt(x, p.z, true);
  check('in a hole: water, floating just under the surface', top.surface === 'water' && Math.abs(top.y - (p.level - M.SURFACE_DROP)) < 1e-9);
  check('dived: deeper, still above the bottom', down.y < top.y && down.y > down.bottom);
  const bank = M.groundAt(x + p.r + 3, p.z);
  check('beside a hole: rock, above the water', bank.surface === 'rock' && bank.y > p.level);
}
check('the bank rises toward the gorge walls', (() => { const z = 90, x = M.riverX(z); return M.bankHeight(x + 20, z) > M.bankHeight(x + 8, z); })());
check('the gorge walls stop him', !M.insideGorge(M.riverX(100) + M.WALL + 1, 100) && M.insideGorge(M.riverX(100), 100));
check('he starts on rock, at the head of the first hole', M.groundAt(M.START.x, M.START.z).surface === 'rock' && M.START.z < M.POOLS[0].z);
check('the track out is past the last hole', M.FINISH_Z > M.POOLS[M.POOLS.length - 1].z + M.POOLS[M.POOLS.length - 1].r);

// ---- Walking the whole way down never leaves the gorge or falls through ---------------
{
  let ok = true, last = Infinity;
  for (let z = M.START.z; z < M.FINISH_Z; z += 0.25) {
    const g = M.groundAt(M.riverX(z), z);
    if (!Number.isFinite(g.y)) ok = false;
    if (!M.insideGorge(M.riverX(z), z)) ok = false;
    last = g.y;
  }
  check('down the middle of the river, there is always ground or water', ok);
}

// ---- The key, the chest, and reaching them ---------------------------------------------
{
  const k = M.bottomSpot(M.KEY_POOL, 1), c = M.bottomSpot(M.CHEST_POOL, -1);
  check('the key lies in its hole', M.poolAt(k.x, k.z) === M.KEY_POOL);
  check('the chest lies in the last hole', M.poolAt(c.x, c.z) === M.CHEST_POOL);
  check('both lie on the bottom', Math.abs(k.y - (M.POOLS[M.KEY_POOL].level - M.POOL_DEPTH + 0.2)) < 1e-9);
  check('reached only by diving', M.canReach(k.x, k.z, true, k.x, k.z) && !M.canReach(k.x, k.z, false, k.x, k.z));
  check('and only close to it', !M.canReach(k.x + 3, k.z, true, k.x, k.z));
}
check('a group of visitors at every hole, on the rock', M.groupSpots().length === M.POOLS.length && M.groupSpots().every(s => M.groundAt(s.x, s.z).surface === 'rock'));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
