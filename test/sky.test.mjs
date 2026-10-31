// Day and night, and the moon as seen from Cairns (Ken, 2026-10-18).
import { CYCLE, CYCLE_LENGTH, nightAmount, nightProgress, moonLit, waxing, moonElongation, moonDirection, moonSunDirection } from '../js/sky-rules.js';

let pass = 0, fail = 0;
function check(name, ok, detail = '') { if (ok) pass++; else { fail++; console.log('FAIL', name, detail); } }
const close = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// The cycle.
check('the day starts bright', nightAmount(0) === 0 && nightAmount(CYCLE.day - 1) === 0);
check('dusk darkens smoothly', nightAmount(CYCLE.day + CYCLE.dusk / 2) > 0.3 && nightAmount(CYCLE.day + CYCLE.dusk / 2) < 0.7);
check('the middle of the night is fully dark', nightAmount(CYCLE.day + CYCLE.dusk + CYCLE.night / 2) === 1);
check('dawn brightens back to day', nightAmount(CYCLE_LENGTH - 0.01) < 0.01);
check('it keeps coming round', close(nightAmount(5), nightAmount(5 + CYCLE_LENGTH * 3)));
let jump = 0; for (let t = 0; t < CYCLE_LENGTH; t += 0.1) jump = Math.max(jump, Math.abs(nightAmount(t + 0.1) - nightAmount(t)));
check('never snaps from day to night', jump < 0.05, jump);
check('the moon crosses during the dark', nightProgress(CYCLE.day) === 0 && nightProgress(CYCLE_LENGTH - 0.001) > 0.99);

// The moon's phase from the date.
check('a known full moon is full (25 Dec 2015)', moonLit(new Date(Date.UTC(2015, 11, 25, 11, 11))) > 0.98);
check('a known new moon is dark (11 Aug 2018)', moonLit(new Date(Date.UTC(2018, 7, 11, 9, 58))) < 0.02);
// The mean lunar month puts a quarter up to about a day early or late (the real
// orbit is not a circle), so a quarter reads roughly, not exactly, half lit.
const fq = new Date(Date.UTC(2023, 0, 28, 15, 19));         // a first quarter
check('a first quarter is roughly half lit, and waxing', Math.abs(moonLit(fq) - 0.5) < 0.12 && waxing(fq));

// Where the moon is: from Cairns it crosses the NORTHERN sky.
const N = [0, 0, -1];
const rise = moonDirection(0, N), mid = moonDirection(0.5, N), set = moonDirection(1, N);
check('it rises in the east, low', rise[0] > 0.99 && rise[1] < 0.01);
check('half way through the night it is high in the north', mid[2] < -0.5 && mid[1] > 0.7);
check('it sets in the west', set[0] < -0.99);
check('another level\'s north is respected', moonDirection(0.5, [1, 0, 0])[0] > 0.5);

// The lit side: facing north, a waxing moon is lit on its LEFT (west), the
// southern hemisphere's "upside down" moon; a waning one on its right.
const m = moonDirection(0.5, N);
const west = [-1, 0, 0];
const litWax = moonSunDirection(m, Math.PI / 2, N), litWane = moonSunDirection(m, Math.PI * 1.5, N);
check('a waxing quarter moon is lit from the west (the left, facing north)', litWax[0] < -0.9, litWax);
check('a waning quarter moon is lit from the east (the right)', litWane[0] > 0.9, litWane);
check('a full moon is lit from straight in front', moonSunDirection(m, Math.PI, N).every((v, i) => close(v, -m[i], 1e-6)));
check('a new moon is lit from behind', moonSunDirection(m, 0.0001, N).every((v, i) => close(v, m[i], 1e-3)));
check('the elongation goes all the way round in a month', close(moonElongation(new Date(Date.UTC(2000, 0, 6, 18, 14))), 0, 1e-6));

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
