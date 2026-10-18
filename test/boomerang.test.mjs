// Boomerang throwing (Ken, 2026-10-18): the flight, hitting targets, catching it back.
import { flight, positionAt, landsAt, hits, catchable, throwPoints, IDEAL_ANGLE } from '../js/levels/boomerang-rules.js';

let pass = 0, fail = 0;
function check(name, ok, detail = '') { if (ok) pass++; else { fail++; console.log('FAIL', name, detail); } }
const from = { x: 0, y: 1.6, z: 0 }, hands = { x: 0, y: 1.6, z: 0 };

const good = flight(from, 0, 0.6, IDEAL_ANGLE);
const p0 = positionAt(good, 0), p1 = positionAt(good, 0.01);
check('it starts in his hand', Math.hypot(p0.x, p0.z) < 0.01);
check('it leaves the way he aims (forward, -z)', p1.z < 0 && Math.abs(p1.x) < Math.abs(p1.z) * 0.5, JSON.stringify(p1));
const quarter = positionAt(good, 0.25);
check('it curves round to the left (-x when facing -z)', quarter.x < -1, JSON.stringify(quarter));
const end = positionAt(good, 1);
check('thrown at the right angle it comes back to him', Math.hypot(end.x, end.z) < 0.5 && end.y > 1 && end.y < 2.5, JSON.stringify(end));
check('and does not fall short', landsAt(good) === null);
check('it can be caught as it comes back', catchable(good, 0.97, hands) && catchable(good, 1, hands));
check('but not while it is still out on its loop', !catchable(good, 0.5, hands));

const low = flight(from, 0, 0.6, 3);
check('thrown too low it drops short', landsAt(low) !== null && landsAt(low) < 1);
check('and cannot be caught', !catchable(low, 0.98, hands));
const high = flight(from, 0, 0.6, 35);
const hEnd = positionAt(high, 1);
check('thrown too high it sails past behind him', Math.hypot(hEnd.x, hEnd.z) > 2.5 && hEnd.z > 0, JSON.stringify(hEnd));
check('and cannot be caught', !catchable(high, 1, hands));

const small = flight(from, 0, 0, IDEAL_ANGLE), big = flight(from, 0, 1, IDEAL_ANGLE);
const reach = f => Math.max(...Array.from({ length: 50 }, (_, i) => { const p = positionAt(f, i / 49); return Math.hypot(p.x, p.z); }));
check('more power, a bigger loop that reaches further', reach(big) > reach(small) + 5);

// Targets: on its path they are hit, off it they are not.
const onPath = positionAt(good, 0.3);
check('a target on its path is hit', hits(good, [{ x: onPath.x, y: onPath.y, z: onPath.z, r: 0.4 }]).length === 1);
check('one well off its path is not', hits(good, [{ x: 30, y: 1, z: 30, r: 0.4 }]).length === 0);
check('turning the aim swings the whole loop round', positionAt(flight(from, Math.PI / 2, 0.6, IDEAL_ANGLE), 0.01).x > 0);

check('points: a hit, a catch, and a bonus for both', throwPoints(1, true) === 200 && throwPoints(2, false) === 100 && throwPoints(0, true) === 100 && throwPoints(0, false) === 0);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
