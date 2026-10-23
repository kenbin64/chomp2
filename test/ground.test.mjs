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

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
