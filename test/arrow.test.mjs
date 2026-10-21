// Tests for js/guide-arrow.js: choosing where to point.
// Run:  node test/arrow.test.mjs

import { nearest } from '../js/guide-arrow.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

const here = { x: 0, z: 0 };
check('it points at the nearest thing still to do', nearest([{ x: 10, z: 0 }, { x: 0, z: 3 }, { x: -6, z: 0 }], here).z === 3);
check('nothing left: no arrow', nearest([], here) === null);
check('one thing: that one', nearest([{ x: 50, z: 50 }], here).x === 50);
check('standing on it: still that one', nearest([{ x: 0, z: 0 }, { x: 1, z: 0 }], here).x === 0);
check('a tie goes to the first listed (steady, never flickering)', nearest([{ x: 2, z: 0, id: 'a' }, { x: -2, z: 0, id: 'b' }], here).id === 'a');

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
