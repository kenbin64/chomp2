// Catching the black marlin (marlin-rules.js, Ken 2026-10-31). What must hold: the cast behaves like a thrown thing in air;
// the gauge shows the bite; the fight can be won in a fair time by watching nothing but the gauge, using both reel and
// release; and each real mistake loses him the way it would in real life.
import { CAST, LINE, TROLL, newCast, castStep, castReach, forceAt, newTroll, trollStep, newFight, fightStep, tensionZone } from '../js/levels/marlin-rules.js';

let passed = 0, failed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log('  FAIL', name, detail); } };
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const DT = 1 / 30, median = a => [...a].sort((x, y) => x - y)[a.length >> 1];

// ---- The cast
{
  let best = 0, bestAt = 0;
  for (let a = 5; a <= 75; a++) { const d = castReach(a, 0.9); if (d > best) { best = d; bestAt = a; } }
  console.log(`  the best cast: ${bestAt} degrees, ${best.toFixed(0)} m`);
  check('with air drag, the best angle is well under 45 degrees', bestAt < 42 && bestAt > 20, bestAt);
  check('a good cast gets the lure well out', best > 60 && best < 130, best);
  check('too low falls short', castReach(5, 0.9) < best * 0.6, castReach(5, 0.9));
  check('too high falls short', castReach(75, 0.9) < best * 0.7, castReach(75, 0.9));
  check('more force goes further', castReach(30, 0.8) > castReach(30, 0.5) && castReach(30, 0.5) > castReach(30, 0.25));
  check('too much force: a backlash, and a short cast', castReach(30, 0.98) < castReach(30, 0.9) * 0.6 && newCast(30, 0.98).tangled);
  check('a weak cast lands in the wake', castReach(30, 0.3) < CAST.minLine, castReach(30, 0.3));
  const c = newCast(30, 0.9); let up = 0; while (!c.landed) { castStep(c, DT); up = Math.max(up, c.y); }
  check('the flight goes up and comes down, in a believable time', up > CAST.height + 3 && c.time > 1.5 && c.time < 8, `${up.toFixed(1)} m, ${c.time.toFixed(1)} s`);
  const fs = Array.from({ length: 100 }, (_, i) => forceAt(i * 0.05));
  check('the force meter swings between none and full', fs.every(f => f >= 0 && f <= 1) && Math.max(...fs) > 0.9 && Math.min(...fs) < 0.1);
}

// ---- Trolling
{
  const run = seed => { const t = newTroll(seeded(seed)); let peakIdle = 0, nibble = 0, bitAt = null; for (let s = 0; s < 40 && bitAt === null; s += DT) { trollStep(t, false, DT); if (t.state === 'bite') bitAt = s; else { peakIdle = Math.max(peakIdle, t.tension); if (t.spike > 0.2) nibble++; } } return { t, peakIdle, bitAt, nibble }; };
  const rs = Array.from({ length: 50 }, (_, i) => run(i + 1));
  check('a bite always comes, in fair time', rs.every(r => r.bitAt !== null && r.bitAt < 25), median(rs.map(r => r.bitAt)));
  check('nibbles show on the gauge first', rs.filter(r => r.nibble > 0).length > 40);
  // On the bite, the gauge jumps well above any nibble.
  const r = rs[0]; for (let s = 0; s < 0.5; s += DT) trollStep(r.t, false, DT);
  check('the bite stands out on the gauge', r.t.state === 'bite' && r.t.tension > r.peakIdle + 0.1, `${r.t.tension.toFixed(2)} v ${r.peakIdle.toFixed(2)}`);
  trollStep(r.t, true, DT); check('striking on the bite sets the hook', r.t.result === 'hooked');
  const t2 = newTroll(seeded(3)); trollStep(t2, true, DT);
  check('striking too soon does not, and spooks him for a while', !t2.result && t2.next >= TROLL.spooked - 0.1);
  const t3 = newTroll(seeded(4)); t3.state = 'bite'; t3.next = 0.1; for (let s = 0; s < 0.3; s += DT) trollStep(t3, false, DT);
  check('a bite let go: he drops it, and it can come again', t3.state === 'working' && !t3.result);
}

// ---- The fight
function play(player, seed, cast = 70, limit = 500) {
  const f = newFight(seeded(seed), cast); let peak = 0, released = 0, reeled = 0;
  while (!f.result && f.time < limit) { const i = player(f); if (i.release) released++; if (i.reel) reeled++; fightStep(f, i, DT); peak = Math.max(peak, f.tension); }
  return { ...f, rng: null, peak, released, reeled };
}
const many = (mk, n = 150, base = 1000) => Array.from({ length: n }, (_, i) => play(mk(), base + i * 7));
const share = (rs, test) => rs.filter(test).length / rs.length;
// Only watching the gauge: reel while it is low, nothing as it climbs, release when it gets high.
const gauge = (reelBelow, releaseAbove) => () => { let letting = false; return f => { if (f.tension > releaseAbove) letting = true; else if (f.tension < releaseAbove * 0.55) letting = false; return { reel: !letting && f.tension < reelBelow, release: letting }; }; };
{
  const rs = many(gauge(0.55, 0.78)), won = share(rs, r => r.result === 'landed'), times = rs.filter(r => r.result === 'landed').map(r => r.time);
  console.log(`  watching the gauge: lands him ${(won * 100).toFixed(0)}%, in ${times.length ? median(times).toFixed(0) : '-'} s; ${(rs.reduce((n, r) => n + r.jumps, 0) / rs.length).toFixed(1)} leaps; lost: ${['snapped', 'slack', 'spooled'].map(w => `${w} ${rs.filter(r => r.why === w).length}`).join(', ')}`);
  check('careful play with the gauge usually lands him', won > 0.75, won);
  check('the fight is a real fight, not over in moments', median(times) > 40, median(times));
  check('and does not drag on', median(times) < 180, median(times));
  check('he leaps in a typical fight', rs.reduce((n, r) => n + r.jumps, 0) / rs.length >= 1.5);
  check('it takes both: reeling and releasing', rs.every(r => r.released > 0 && r.reeled > 0));
}
{
  const rs = many(() => () => ({ reel: true }));
  console.log(`  only reeling: lost after ${median(rs.map(r => r.time)).toFixed(1)} s`);
  check('only reeling snaps the line', share(rs, r => r.why === 'snapped') > 0.9, share(rs, r => r.why === 'snapped'));
  check('and not instantly: there is time to see the gauge climb', median(rs.map(r => r.time)) > 1, median(rs.map(r => r.time)));
}
{
  const rs = many(gauge(0.55, 2));
  console.log(`  reeling but never releasing: lands him ${(share(rs, r => r.result === 'landed') * 100).toFixed(0)}%`);
  check('without ever releasing he mostly breaks you off', share(rs, r => r.why === 'snapped') > 0.6, share(rs, r => r.why === 'snapped'));
}
{
  const rs = many(() => () => ({}));
  check('never touching anything, he is never landed', share(rs, r => r.result === 'landed') === 0);
  const rr = many(() => () => ({ release: true }));
  check('only releasing: he takes it all, or throws the hook', share(rr, r => r.why === 'spooled' || r.why === 'slack') === 1, JSON.stringify(rr[0].why));
}
// The real lessons, one at a time.
const scene = (mode, input, secs, setup = {}) => { const f = newFight(seeded(6)); Object.assign(f, { mode, modeLeft: secs + 1, tension: 0.3, ...setup }); const a = f.line; for (let t = 0; t < secs && !f.result; t += DT) fightStep(f, input, DT); f.gained = a - f.line; return f; };
{
  check('reeling through a leap snaps the line', scene('jump', { reel: true }, 2).why === 'snapped');
  check('holding the drag through a fresh leap is on the edge', scene('jump', {}, 2, { dist: 70, line: 70 }).tension > 0.7);
  const bow = scene('jump', { release: true }, 2);
  check('bowing to him, releasing, keeps him on with the line easy', !bow.result && bow.tension < 0.5, bow.tension);
  check('a charge with no reeling: slack, and the hook falls out', scene('charge', {}, 3.4, { line: 120, dist: 120 }).why === 'slack');
  const ch = scene('charge', { reel: true }, 3.4, { line: 120, dist: 120 });
  check('reeling through a charge keeps him on', !ch.result, ch.why);
  check('reeling against a fresh run snaps the line', scene('run', { reel: true }, 5).why === 'snapped');
  const held = scene('run', {}, 6);
  check('only the drag against a fresh run: it climbs into the red', held.why === 'snapped' || held.tension > 0.85, held.tension);
  const let_ = scene('run', { release: true }, 5);
  check('releasing on a run is safe, and costs line', !let_.result && let_.gained < -15, let_.gained);
  const rest = scene('rest', { reel: true }, 4, { line: 100, dist: 100, tension: 0.2 });
  check('when he rests, reeling wins line in the safe part of the gauge', !rest.result && rest.gained > 10 && tensionZone(rest.tension) === 'safe', `${rest.gained.toFixed(1)} m at ${rest.tension.toFixed(2)}`);
  const tired = scene('run', {}, 5, { stamina: 0.1 });
  check('a tired fish cannot break it on the drag alone', !tired.result, tired.why);
  // A long line forgives more than a short one: the same surge.
  const longLine = scene('run', {}, 0.5, { line: 200, dist: 200, tension: 0, speed: 0 }), shortLine = scene('run', {}, 0.5, { line: 25, dist: 25, tension: 0, speed: 0 });
  check('a short line takes up faster than a long one', shortLine.tension > longLine.tension, `${shortLine.tension.toFixed(2)} v ${longLine.tension.toFixed(2)}`);
  // The rod.
  const rod = r => { const f = newFight(seeded(9)); Object.assign(f, { side: 0.8, sideGoal: 0.8, mode: 'rest', modeLeft: 8 }); for (let t = 0; t < 5; t += DT) { f.sideGoal = 0.8; fightStep(f, { rod: r }, DT); } return f; };
  check('rod held across him tires him faster', rod(-1).stamina < rod(0).stamina);
  check('rod to his side pulls harder', rod(1).tension > rod(0).tension);
  // Fresh and alongside: not yet.
  const f = newFight(seeded(10), LINE.boat); Object.assign(f, { stamina: 0.9, mode: 'rest', modeLeft: 0.01 }); for (let t = 0; t < 0.2; t += DT) fightStep(f, {}, DT);
  check('still fresh at the boat: he is not landed, and off he goes', !f.result && f.mode === 'run', f.mode);
  const g = newFight(seeded(11), LINE.spool - 2); Object.assign(g, { mode: 'run', modeLeft: 5 }); for (let t = 0; t < 3 && !g.result; t += DT) fightStep(g, { release: true }, DT);
  check('all the line gone: he has it', g.why === 'spooled', g.why);
}
check('the gauge has its zones', tensionZone(0) === 'slack' && tensionZone(0.4) === 'safe' && tensionZone(0.7) === 'careful' && tensionZone(0.95) === 'danger');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
