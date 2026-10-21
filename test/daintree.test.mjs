// Tests for js/levels/daintree-rules.js: the river, the boat, the sandbar, and attempts to break them.
// Run:  node test/daintree.test.mjs

import * as D from '../js/levels/daintree-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

// ---- The river ---------------------------------------------------------------------------
check('the middle of the river is water, where he floats', D.groundAt(D.riverX(100), 100).surface === 'water' && D.groundAt(D.riverX(100), 100).y === -D.SURFACE_DROP);
check('past the water, the mud bank, above the water', (() => { const g = D.groundAt(D.riverX(100) + D.HALF + 2, 100); return g.surface === 'mud' && g.y > 0; })());
check('the bank rises away from the water', D.groundAt(D.riverX(80) - D.HALF - 6, 80).y > D.groundAt(D.riverX(80) - D.HALF - 1, 80).y);
check('the rainforest stops him', !D.insideRiver(D.riverX(90) + D.FOREST + 1, 90) && D.insideRiver(D.riverX(90), 90));
check('he cannot swim back past the start', !D.insideRiver(D.riverX(0), -10));
check('the river bed is under the water, deepest in the middle', D.bedAt(D.riverX(60), 60) < D.bedAt(D.riverX(60) + D.HALF - 2, 60) && D.bedAt(D.riverX(60) + D.HALF - 2, 60) < -D.SURFACE_DROP);
check('the river winds, but never so sharply its banks cross', (() => { for (let z = 0; z < 400; z += 1) if (Math.abs(D.riverX(z + 1) - D.riverX(z)) > 0.6) return false; return true; })());

// ---- The boat ----------------------------------------------------------------------------
check('the boat keeps to the water, well clear of the banks', (() => { for (let z = D.BOAT_START_Z; z <= D.AGROUND_Z; z += 1) if (D.across(D.boatX(z), z) > D.HALF - 6) return false; return true; })());
check('it cruises at its speed with him alongside', D.boatSpeed(5) === D.BOAT_SPEED);
check('it slows when he falls behind, and all but waits', D.boatSpeed(D.LEAD_SLOW + 5) < D.BOAT_SPEED && D.boatSpeed(D.LEAD_WAIT + 10) < D.BOAT_SPEED * 0.1 && D.boatSpeed(D.LEAD_WAIT + 10) > 0);
check('slowing is smooth, never faster the further behind he is', (() => { let last = Infinity; for (let l = 0; l < 50; l += 0.5) { const s = D.boatSpeed(l); if (s > last + 1e-9) return false; last = s; } return true; })());
check('it never goes backwards', [-50, -5, 0, 20, 40, 100].every(l => D.boatSpeed(l) > 0));
{
  let z = D.BOAT_START_Z, t = 0;
  while (!D.aground(z) && t < 600) { z = D.boatStep(z, 6, 0.05); t += 0.05; }
  check('with him alongside, it reaches the sandbar in about two minutes', D.aground(z) && t > 80 && t < 160, `${t.toFixed(0)} s`);
  check('and stops there, never past it', D.boatStep(z, 0, 10) === D.AGROUND_Z);
}
check('it runs aground on the sandbar: its bow is on the sand there', D.onSandbar(D.boatX(D.AGROUND_Z), D.AGROUND_Z + D.BOAT_LENGTH / 2 - 0.5));
check('the sandbar stands in the water, on the boat\'s line', D.across(D.SANDBAR_X, D.SANDBAR.z) < D.HALF - D.SANDBAR.rx && D.groundAt(D.SANDBAR_X, D.SANDBAR.z).surface === 'sand');
check('the sand is just above the water', (() => { const g = D.groundAt(D.SANDBAR_X, D.SANDBAR.z); return g.y > 0 && g.y < 0.5; })());

// ---- Feeding -------------------------------------------------------------------------------
check('alongside the boat, they throw to him', D.inThrowRange(D.boatX(100) - 8, 100, 100));
check('too close, they shy away and do not throw', !D.inThrowRange(D.boatX(100) - 1, 100, 100));
check('too far, they cannot reach him', !D.inThrowRange(D.boatX(100) - 30, 100, 100));

// ---- The crocs -------------------------------------------------------------------------------
check('wild crocs along both banks, in the water', (() => { const c = D.crocSpots(); return c.length >= 4 && c.some(s => s.side < 0) && c.some(s => s.side > 0) && c.every(s => D.groundAt(s.x, s.z).surface === 'water'); })());
check('the crocs come up round the stuck boat, in the water, not on the sand', D.crocsRoundBoat().every(c => D.groundAt(c.x, c.z).surface === 'water' && Math.hypot(c.x - D.boatX(D.AGROUND_Z), c.z - D.AGROUND_Z) > 6));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
