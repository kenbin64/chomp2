// Tests for js/levels/vine-rules.js: the vine swing, and attempts to break it.
// Run:  node test/vines.test.mjs

import * as V from '../js/levels/vine-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

// ---- The swing ---------------------------------------------------------------------------
{
  let s = { theta: 0.5, omega: 0 }, top = 0;
  for (let t = 0; t < 4; t += V.DT) { s = V.swingStep(s, 0, V.DT); top = Math.max(top, Math.abs(s.theta)); }
  check('let go of nothing, it swings like a pendulum and dies away slowly', top <= 0.5 + 1e-9 && top > 0.35);
  let p = { theta: 0, omega: 0 }, t = 0, high = 0;
  while (t < 15 && high < 1) { p = V.swingStep(p, 1, V.DT); t += V.DT; high = Math.max(high, p.theta); }
  check('pumping builds the swing up over a few passes, not at once', high >= 1 && t > 3 && t < 12, `${t.toFixed(1)} s`);
  let q = { theta: 0, omega: 0 };
  for (let k = 0; k < 60 / V.DT; k++) q = V.swingStep(q, 1, V.DT);
  check('it never goes higher than a vine can swing', Math.abs(q.theta) <= V.MAX_SWING + 1e-9);
  const vMax = Math.max(...Array.from({ length: 300 }, (_, k) => { q = V.swingStep(q, 1, V.DT); return Math.abs(q.omega) * V.VINE_LENGTH; }));
  check('pumped as hard as he can, the swing stays a believable speed (under 14 m/s)', vMax < 14, vMax.toFixed(1));
}
check('his hands hang 3.5 m above the swamp where nobody swings', Math.abs(V.handAt(V.VINES[0], 0).y - 3.5) < 1e-9 && V.handAt(V.VINES[0], 0).y > V.SWAMP_Y);

// ---- Letting go: timing is the skill --------------------------------------------------------
{
  const result = a => V.flight(0, V.fullSwingAt(a)).end;
  check('let go at a good moment on the forward swing, and he reaches the next vine', result(V.GOOD_RELEASE) === 'vine');
  check('a window of good timing, not one exact moment', [0.35, 0.5, 0.7, 0.9].every(a => result(a) === 'vine'));
  check('let go at the bottom, and he falls short into the swamp', result(0.02) === 'swamp');
  // On the back swing he goes the wrong way.
  let s = { theta: V.MAX_SWING, omega: 0 }; for (let t = 0; t < 0.6; t += V.DT) s = V.swingStep(s, 1, V.DT);
  check('let go on the back swing, and he drops into the swamp', s.omega < 0 && V.flight(0, s).end === 'swamp');
  check('the vines are further apart than one swing reaches: he has to fly', V.VINES.every((z, i) => i === 0 || z - V.VINES[i - 1] > 2 * V.VINE_LENGTH * Math.sin(V.MAX_SWING) * 0.75));
}

// ---- The whole course can be done -------------------------------------------------------------
{
  let ok = true;
  for (let i = 0; i < V.VINES.length; i++) {
    const r = V.flight(i, V.fullSwingAt(V.GOOD_RELEASE));
    if (r.end !== (i === V.VINES.length - 1 ? 'bank' : 'vine')) { ok = false; console.log('  vine', i, '->', r.end); }
  }
  check('good swings all the way: vine to vine, and the last onto the far bank', ok);
  // Catching a vine carries the flight's speed into the new swing: it swings on, forward.
  const r = V.flight(0, V.fullSwingAt(V.GOOD_RELEASE)), g = V.grab(r.f, 1);
  check('catching a vine, he swings on forward with the speed he brought', g.omega > 0.3 && Math.abs(g.theta) < V.MAX_SWING);
  check('from the bank, the first leap starts him swinging forward', V.firstSwing().omega > 0);
}

// ---- Paw paws ---------------------------------------------------------------------------------
{
  const spots = V.pawpawSpots();
  check('a paw paw after every vine', spots.length === V.VINES.length);
  check('each hangs between its vine and the next, above the swamp', spots.every((p, i) => p.z > V.VINES[i] && p.z < (V.VINES[i + 1] ?? V.END.z) && p.y > V.SWAMP_Y + 2));
  // A good swing passes through it.
  const s = V.fullSwingAt(V.GOOD_RELEASE); let f = V.release(V.VINES[0], s), near = Infinity;
  for (let t = 0; t < 2; t += V.DT) { f = V.flyStep(f, V.DT); near = Math.min(near, Math.hypot(f.z - spots[0].z, f.y - spots[0].y)); }
  check('a good swing gathers it', near < V.PAWPAW_REACH);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
