// The Barron Gorge zip line (Ken, 2026-10-18): the ride, the things along it, the brake and the landing.
import { LINES, cableY, slope, ride, landing, layout, reaches, hitsBranch, score, BRAKE_ZONE, TUCK, DANGLE, SWAY } from '../js/levels/zipline-rules.js';

let pass = 0, fail = 0;
function check(name, ok, detail = '') { if (ok) pass++; else { fail++; console.log('FAIL', name, detail); } }
const L = LINES.falls;

check('the cable starts at the top platform and ends at the bottom one', cableY(L, 0) === L.top && cableY(L, 1) === L.bottom);
check('it sags in the middle, below a straight line', cableY(L, 0.5) < (L.top + L.bottom) / 2);
check('it runs downhill at the start', slope(L, 0.05) > 0);

// A ride with no braking: he picks up speed and comes in too fast, into the pad.
let st = { s: 0, v: 2, started: true }, top = 0;
for (let i = 0; i < 4000 && st.s < 1; i++) { ride(st, L, 0.02, false); top = Math.max(top, st.v); }
check('it is a fast ride (over 40 km/h)', top > 11, top);
check('no braking: into the safety pad', landing(st, L) === 'pad', st.v);

// Braking through the brake zone brings him in gently.
const brakeRide = (from) => { const t = { s: 0, v: 2, started: true }; let land = null;
  for (let i = 0; i < 20000 && !land; i++) { const left = (1 - t.s) * L.length; ride(t, L, 0.02, left < from); land = landing(t, L); } return { land, t }; };
let best = null;
for (let from = 70; from >= 10 && !best; from -= 2) { const r = brakeRide(from); if (r.land === 'perfect') best = from; }
check('braking at the right moment lands perfectly', best !== null, best);
check('braking far too early stops him short of the platform', brakeRide(BRAKE_ZONE + 80).land === 'short');
check('braking far too late is still the pad', brakeRide(2).land === 'pad');

// Things along the line.
const lay = layout(L, 3);
check('the line has its things and branches', lay.items.length === L.items && lay.branches.length === L.branches);
check('everything is between the platforms and within reach to the side', lay.items.every(i => i.s > 0 && i.s < 1 && Math.abs(i.side) <= SWAY));
check('some need a tuck, some a dangle', lay.items.some(i => i.height === TUCK) && lay.items.some(i => i.height === -DANGLE));
check('the same line lays out the same way', JSON.stringify(layout(L, 3)) === JSON.stringify(lay));
check('a different seed, a different layout', JSON.stringify(layout(L, 4)) !== JSON.stringify(lay));
check('swinging to its side collects it', reaches({ side: 1.2, height: 0 }, 1.0, 0));
check('on the other side he misses it', !reaches({ side: 1.2, height: 0 }, -1.2, 0));
check('a high one needs a tuck', !reaches({ side: 0, height: TUCK }, 0, 0) && reaches({ side: 0, height: TUCK }, 0, TUCK));
check('a branch catches him if he is not tucked', hitsBranch({ side: 1 }, 1.0, 0));
check('tucked up he clears it', !hitsBranch({ side: 1 }, 1.0, TUCK));
check('leaning away from it he clears it', !hitsBranch({ side: 1 }, -1.2, 0));

check('points: things, branches off, landing bonus', score({ mango: 2, gold: 1 }, 1, 'perfect') === 20 + 15 - 15 + 100 && score({}, 5, 'short') === 0);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
