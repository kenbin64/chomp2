// Aim help: it helps only when it should, never more than the keys, and never past the food.
import assert from 'node:assert';
import { aimTurn, aimSlow, AIM, SLOW } from '../js/aim-rules.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ok   ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); } };
const at = (x, z) => [{ x, z }];
const base = { pos: { x: 0, z: 0 }, facing: 0, running: true, dt: 1 / 60 };

console.log('aim help');
test('leans toward food a little to his left, ahead', () => {
  const t = aimTurn({ ...base, landings: at(1, 4) });        // to +x of straight ahead (+z): a positive angle
  assert.ok(t > 0, `turn was ${t}`);
});
test('leans the other way for food on the other side', () => {
  assert.ok(aimTurn({ ...base, landings: at(-1, 4) }) < 0);
});
test('no help when he is standing still', () => {
  assert.strictEqual(aimTurn({ ...base, running: false, landings: at(1, 4) }), 0);
});
test('no help for food behind him or far to the side', () => {
  assert.strictEqual(aimTurn({ ...base, landings: at(0, -4) }), 0);
  assert.strictEqual(aimTurn({ ...base, landings: at(4, 1) }), 0);
});
test('no help for food out of reach', () => {
  assert.strictEqual(aimTurn({ ...base, landings: at(0.5, AIM.reach + 1) }), 0);
});
test('never turns faster than its limit, which is under the keys', () => {
  const t = aimTurn({ ...base, landings: at(0.2, 3) });
  assert.ok(Math.abs(t) <= AIM.rate * base.dt + 1e-12 && AIM.rate < 3.4);
});
test('never turns past the food', () => {
  const err = Math.atan2(0.001, 3);
  assert.ok(aimTurn({ ...base, dt: 10, landings: at(0.001, 3) }) <= err + 1e-12);
});
test('picks the nearest piece when there are several', () => {
  const t = aimTurn({ ...base, landings: [{ x: -1, z: 5 }, { x: 0.5, z: 2 }] });
  assert.ok(t > 0, 'the nearer piece is to the positive side');
});
console.log('aim slowdown');
// Facing 0 is +z. Food at a small positive angle (to +x). input.right > 0 makes the facing angle smaller.
test('slows a turn that is carrying him onto nearby food', () => {
  const keep = aimSlow({ pos: { x: 0, z: 0 }, facing: 0, turning: -1, landings: at(0.3, 4) });   // turning toward +angle
  assert.ok(keep < 1 && keep >= SLOW.keep, `kept ${keep}`);
});
test('does not slow a turn away from the food', () => {
  assert.strictEqual(aimSlow({ pos: { x: 0, z: 0 }, facing: 0, turning: 1, landings: at(0.3, 4) }), 1);
});
test('does not slow when the food is far off his heading', () => {
  assert.strictEqual(aimSlow({ pos: { x: 0, z: 0 }, facing: 0, turning: -1, landings: at(3, 3) }), 1);
});
test('does nothing when he is not turning', () => {
  assert.strictEqual(aimSlow({ pos: { x: 0, z: 0 }, facing: 0, turning: 0, landings: at(0.1, 4) }), 1);
});
test('slows most when lined up exactly, never below the floor', () => {
  const keep = aimSlow({ pos: { x: 0, z: 0 }, facing: 0, turning: -1, landings: at(0, 4) });
  assert.ok(Math.abs(keep - SLOW.keep) < 1e-9, `kept ${keep}`);
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
