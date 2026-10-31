// Tests for js/ground.js: rocks and posts block Wally, but can never trap him.
// Run:  node test/ground.test.mjs

import { solidBlocks } from '../js/ground.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

const rock = [{ x: 0, z: 0, r: 1, top: 2 }];          // with Wally's half-width, he is held off at 1.45 m
check('walking into a rock is blocked', !!solidBlocks(-2, 0, -1.3, 0, 0, rock));
check('walking past it is not', !solidBlocks(-2, 3, -1.9, 3, 0, rock));
check('regression: inside its edge (dived beside it), a step straight out is allowed', !solidBlocks(-1.0, 0, -1.1, 0, -1, rock));
check('and a step along it, edging out, is allowed', !solidBlocks(-1.0, 0, -1.02, 0.25, -1, rock));
check('but a step further into it is still blocked', !!solidBlocks(-1.0, 0, -0.9, 0, -1, rock));
check('above the rock (jumped onto it), nothing blocks', !solidBlocks(-1.0, 0, -0.5, 0, 2, rock));
check('nothing to hit, nothing blocks', !solidBlocks(0, 0, 1, 1, 0, []));

// Under the boardwalk (Ken, 2026-10-30): he can go under wherever there is the room, not only at the openings.
{
  const { parkGround, setParkMode } = await import('../js/ground.js');
  const { BOARDWALK: B, deckHeight, deckOpenAt } = await import('../js/rules.js');
  const across = (x, y, from = B.z + B.width / 2 + 1, to = B.z - B.width / 2 - 1) => { let px = x, pz = from; for (let i = 0; i < 200 && pz > to; i++) { const r = parkGround.move(px, pz, px, pz - 0.05, y); if (r.z === pz) break; px = r.x; pz = r.z; } return pz <= to; };
  let open = 0, tried = 0;
  for (let x = -22; x <= 22; x += 1) { tried++; if (across(x, -0.45)) open++; }
  check('swimming: under the boardwalk anywhere over the water', open === tried, `${open} of ${tried}`);
  check('at the planks\' level the railing still stops him', !across(0, deckHeight(0)));
  { const r = parkGround.move(0, B.z + B.width / 2 + 0.02, 0, B.z + B.width / 2 - 0.1, deckHeight(0) + 1.2); check('and a big jump clears it, onto the deck', r.z < B.z + B.width / 2); }
  setParkMode('outside');      // (the low ends are outside the croc fence)
  check('where the deck is low over the bank, he cannot walk under it', !across(50, 0.35));
  setParkMode('park');
  const c = parkGround.ceiling(5, B.z, -0.45);
  check('leaping under it, his head stops at the planks', c !== null && c < deckHeight(5) - 1, c);
  const gap = 13;
  check('through an opening nothing stops him leaping up', deckOpenAt(gap) && parkGround.ceiling(gap, B.z, -0.45) === null);
  check('up on the deck there is nothing overhead', parkGround.ceiling(5, B.z, deckHeight(5)) === null);
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
