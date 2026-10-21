// Tests for js/area-path.js: knowing the area from the page address, hosted or local.
// Run:  node test/area-path.test.mjs

import { areaForPath } from '../js/area-path.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

check('local pages, with .html', areaForPath('/cane.html') === 'cane' && areaForPath('/index.html') === 'park');
check('the hosted site, without .html (it redirects there)', areaForPath('/chomp/cane') === 'cane' && areaForPath('/chomp/mossman') === 'mossman' && areaForPath('/chomp/kuranda') === 'kuranda');
check('the folder alone is the park', areaForPath('/chomp/') === 'park' && areaForPath('/chomp') === 'park' && areaForPath('/') === 'park');
check('pages that are not areas are none', areaForPath('/chomp/guide') === undefined && areaForPath('/chomp/train.html') === undefined);
check('nothing at all does not throw', areaForPath() === 'park' && areaForPath(null) === undefined);

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
