// Each activity's own thumb controls on a phone held sideways (thumbs.js, Ken 2026-11-01): only the buttons in use show,
// the walking controls go away, every button sits in a bottom corner, and pressing one does its job. In real Chrome, with real
// touches. Needs the server: node serve.mjs. Pass a folder to keep the pictures.
import puppeteer from 'puppeteer-core';
const S = process.argv[2];
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, info = '') => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) failed++; };
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const W = 844, H = 390;
async function open(url, ready) {
  const p = await b.newPage(); await p.setViewport({ width: W, height: H, isMobile: true, hasTouch: true });
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  await p.goto('http://localhost:8090/about.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('chomp-tips-off', '1'); localStorage.setItem('chomp-settings', JSON.stringify({ tips: false })); });
  await p.goto('http://localhost:8090/' + url, { timeout: 60000 });
  await p.waitForFunction(ready, { timeout: 90000, polling: 200 }); await wait(1200);
  return p;
}
// What is showing: the names of the thumb controls on screen, and whether the walking controls are.
const seen = p => p.evaluate(() => ({
  thumbs: [...document.querySelectorAll('[data-thumb]')].filter(e => !e.hidden && e.getBoundingClientRect().width > 0).map(e => e.dataset.thumb).sort(),
  walking: (() => { const t = document.getElementById('touch'); return !!t && !t.hidden && getComputedStyle(t).display !== 'none'; })(),
  boxes: [...document.querySelectorAll('[data-thumb]')].filter(e => !e.hidden).map(e => { const r = e.getBoundingClientRect(); return { n: e.dataset.thumb, l: r.left, r: r.right, t: r.top, b: r.bottom }; }),
}));
const showing = async (p, name, want) => {
  const q = await seen(p), got = q.thumbs.join();
  check(`${name}: shows only ${want.join(', ') || 'nothing'}`, got === [...want].sort().join() && !q.walking, `${got}${q.walking ? ' + walking' : ''}`);
  const out = q.boxes.filter(r => r.r > W + 1 || r.b > H + 1 || r.l < -1 || r.t < 0);
  if (want.length) check(`${name}: all on the screen, within thumb reach of a side`, !out.length && q.boxes.every(r => r.r < W * 0.36 || r.l > W * 0.64), JSON.stringify(q.boxes.map(r => [r.n, Math.round(r.l), Math.round(r.t)])));
};
const at = (p, name) => p.evaluate(n => { const r = document.querySelector(`[data-thumb="${n}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, name);
const tap = async (p, name) => { const c = await at(p, name); const t = await p.touchscreen.touchStart(c.x, c.y); await wait(90); await t.end(); await wait(120); };
const shot = async (p, n) => { if (S) await p.screenshot({ path: `${S}/thumbs-${n}.png` }); };

try {
  { console.log('Zip line');
    const p = await open('zipline.html?all&free&play&stay', () => window.chomp && window.chomp.game.running);
    await showing(p, 'riding', ['swing', 'brake']); await shot(p, 'zip');
    check('the circle has its arrows', await p.evaluate(() => document.querySelectorAll('[data-thumb="swing"] .orb-arrows polygon').length === 4));
    const c = await at(p, 'swing'), B = await at(p, 'brake');
    const r = await p.touchscreen.touchStart(c.x, c.y); await r.move(c.x + 50, c.y); await wait(600);
    check('right thumb: he swings out', await p.evaluate(() => Math.abs(window.chomp.game.side) > 0.1 && window.chomp.game.keys.has('ArrowRight')));
    const l = await p.touchscreen.touchStart(B.x, B.y); await wait(200);
    check('left thumb at once: the brake is on, and he still swings', await p.evaluate(() => window.chomp.game.keys.has(' ') && window.chomp.game.keys.has('ArrowRight')));
    await l.end(); await r.end(); await wait(200);
    check('both let go: nothing stuck on', await p.evaluate(() => window.chomp.game.keys.size === 0));
    check('no page errors', !p.errors.length, p.errors[0]); await p.close(); }
  { console.log('Vines');
    const p = await open('daintree.html?all&play&stay', () => window.chomp && window.chomp.game.running);
    await p.evaluate(() => { document.getElementById('fade').classList.remove('on'); window.chomp.enterForest(); }); await wait(900);
    await showing(p, 'on the bank', ['leap']); await tap(p, 'leap'); await wait(300);
    await showing(p, 'on a vine', ['leap', 'swing']); await shot(p, 'vines');
    const c = await at(p, 'swing'), s0 = await p.evaluate(() => JSON.stringify(window.chomp.forest.state));
    const t = await p.touchscreen.touchStart(c.x, c.y); await wait(500); await t.end();
    check('SWING and LEAP work: he is on the vine', s0 === '"swing"', s0);
    check('no page errors', !p.errors.length, p.errors[0]); await p.close(); }
  { console.log('Boomerang');
    const p = await open('kuranda.html?all&play&stay', () => window.chomp && window.chomp.station && window.chomp.game.running);
    await p.evaluate(() => window.chomp.station.begin(true)); await wait(800);
    await showing(p, 'setting the angle', ['set', 'up', 'down']); await shot(p, 'boom');
    await tap(p, 'set'); await wait(200);
    await showing(p, 'the force', ['throw']); await tap(p, 'throw'); await wait(300);
    await showing(p, 'in flight', ['catch']);
    check('no page errors', !p.errors.length, p.errors[0]); await p.close(); }
  { console.log('Heaving the boat');
    const p = await open('push.html?play', () => window.chomp && window.chomp.game.running);
    await p.evaluate(() => window.chomp.startPush()); await wait(300);
    await showing(p, 'the heave', ['heave']);
    check('no page errors', !p.errors.length, p.errors[0]); await p.close(); }
  { console.log('Fishing');
    const p = await open('esplanade.html?all&play&stay&marlin', () => window.chomp && window.chomp.fishing && window.chomp.fishing.active);
    const F = fn => p.evaluate(fn);
    await showing(p, 'aiming', ['set', 'up', 'down']); await shot(p, 'aim');
    const a0 = await F(() => window.chomp.fishing.state.angle), U = await at(p, 'up'); const hu = await p.touchscreen.touchStart(U.x, U.y); await wait(500); await hu.end();
    check('the up arrow raises the angle', await p.evaluate(a => window.chomp.fishing.state.angle > a + 2, a0));
    await tap(p, 'set'); check('SET: on to the force', await F(() => window.chomp.fishing.phase === 'force'));
    await showing(p, 'the force', ['cast']);
    await p.evaluate(() => window.chomp.fishing.testHook(70)); await wait(500);
    await showing(p, 'the fight', ['release', 'reel', 'rodLeft', 'rodRight']); await shot(p, 'fight');
    await p.evaluate(() => { const f = window.chomp.fishing.state.fight; f.mode = 'rest'; f.modeLeft = 8; f.tension = 0.2; });
    const line0 = await F(() => window.chomp.fishing.state.fight.line), R = await at(p, 'reel'); const hr = await p.touchscreen.touchStart(R.x, R.y); await wait(1000); await hr.end();
    check('holding REEL winds line in', await p.evaluate(l => window.chomp.fishing.state.fight.line < l - 1, line0));
    await p.evaluate(() => { const f = window.chomp.fishing.state.fight; f.mode = 'run'; f.modeLeft = 8; f.stamina = 1; });
    const line1 = await F(() => window.chomp.fishing.state.fight.line), L = await at(p, 'release'); const hl = await p.touchscreen.touchStart(L.x, L.y); await wait(1200); await hl.end();
    check('holding RELEASE lets line run', await p.evaluate(l => window.chomp.fishing.state.fight.line > l + 1, line1));
    check('no page errors', !p.errors.length, p.errors[0]); await p.close(); }
  { console.log('Walking');
    const p = await open('index.html?noopening', () => window.chomp && window.chomp.cam);
    await p.evaluate(() => window.chompStartHere()); await p.waitForFunction(() => window.chomp.game.intro <= 0, { timeout: 30000, polling: 200 }); await wait(800);
    // The left thumb: only what works here, the main move on the big button, and really on the screen.
    const left = () => p.evaluate(() => { const b = id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return getComputedStyle(e).display === 'none' || !r.width ? null : { says: e.textContent, w: r.width }; }; const a = [b('t-jump'), b('t-fours')].filter(Boolean).sort((x, y) => y.w - x.w); return a.map(x => x.says).join(); });
    check('on land: Jump is the big button, Duck beside it', (await left()) === 'Jump,Duck', await left());
    await shot(p, 'land');
    // Further out is faster: a walk near the middle, about the keys' pace at the rim, a sprint past it, and a top speed.
    const S = await p.evaluate(() => { const r = document.getElementById('stick').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const speed = async () => { await p.evaluate(() => { const w = window.chomp.wally; w.pos.set(0, w.pos.y, 18); }); return p.evaluate(() => new Promise(done => { const w = window.chomp.wally; setTimeout(() => done({ v: Math.hypot(w.vel.x, w.vel.z), m: w.mode }), 60); })); };
    const at = async (y, ms = 700) => { await th.move(S.x, S.y - y); await wait(ms); return speed(); };
    const th = await p.touchscreen.touchStart(S.x, S.y - 18); await wait(700);
    const walk = await speed(), rim = await at(66), sprint = await at(110), past = await at(200), back = await at(10);
    console.log('  speeds m/s', [walk, rim, sprint, past, back].map(s => `${s.v.toFixed(1)} ${s.m}`).join(', '));
    check('near the middle he walks', walk.v > 1.5 && walk.v < 3.5, walk.v.toFixed(1));
    check('at the rim, about the pace of the keys (5.6)', rim.v > 4.6 && rim.v < 6.2, rim.v.toFixed(1));
    check('past the rim he sprints (a running sprint, or a slower swimming one)', sprint.v > (sprint.m === 'swim' ? 6.4 : 7.3), `${sprint.v.toFixed(1)} ${sprint.m}`);
    check('further out still: the top speed holds', past.v <= 8.5 && Math.abs(past.v - sprint.v) < 0.6, past.v.toFixed(1));
    check('thumb back toward the middle: back to a walk, still going', back.v > 1.5 && back.v < 3.5, back.v.toFixed(1));
    { const o = await p.evaluate(() => { const c = document.getElementById('stick').getBoundingClientRect(), r = document.querySelector('.orb-heading').getBoundingClientRect(), w = window.chomp.wally, y = window.chomp.cam.yaw;
        const dx = r.left + r.width / 2 - (c.left + c.width / 2), dy = r.top + r.height / 2 - (c.top + c.height / 2), hx = Math.sin(w.facing), hz = Math.cos(w.facing);
        return { got: Math.atan2(dx, -dy), want: Math.atan2(hx * Math.cos(y) - hz * Math.sin(y), -(hx * Math.sin(y) + hz * Math.cos(y))), inside: Math.hypot(dx, dy) + r.width / 2 < c.width / 2 }; });
      const off = Math.abs(Math.atan2(Math.sin(o.got - o.want), Math.cos(o.got - o.want)));
      check('the orb sits inside the circle, the way he faces on screen', o.inside && off < 0.35, `${o.got.toFixed(2)} vs ${o.want.toFixed(2)}`); }
    check('the up arrow is lit while he goes', await p.evaluate(() => document.querySelector('#stick .orb-arrows').classList.contains('orb-go')));
    await at(110, 200); await shot(p, 'sprint');
    const orbAt = () => p.evaluate(() => { const c = document.getElementById('stick').getBoundingClientRect(), r = document.querySelector('.orb-heading').getBoundingClientRect(); return { x: r.left + r.width / 2 - c.left - c.width / 2, y: r.top + r.height / 2 - c.top - c.height / 2 }; });
    const straight = await orbAt();
    await th.move(S.x + 60, S.y - 45); await wait(450); const turning = await orbAt(); await shot(p, 'turning');
    check('going straight the orb is at the top; turning right it swings right', Math.abs(straight.x) < 8 && straight.y < -25 && turning.x > 15, `${Math.round(straight.x)},${Math.round(straight.y)} then ${Math.round(turning.x)},${Math.round(turning.y)}`);
    await th.move(S.x, S.y - 110); await wait(300);
    check('the chevrons all light at a sprint', await p.evaluate(() => document.querySelector('.orb-run').dataset.run === '3'));
    await th.end(); await wait(400);
    // No swivelling on the spot (Ken, 2026-11-01): a push to the side from a standstill sets him off round the corner, quickly.
    const put = () => p.evaluate(() => { const w = window.chomp.wally; w.pos.set(0, 0.35, 21); w.vel.set(0, 0, 0); w.facing = Math.PI; w.turnRate = 0; });
    await put(); await wait(300);
    const side = await p.touchscreen.touchStart(S.x + 60, S.y); await wait(350);
    const c = await p.evaluate(() => { const w = window.chomp.wally; return { f: w.facing, sp: Math.hypot(w.vel.x, w.vel.z), m: Math.hypot(w.pos.x, w.pos.z - 21) }; }); await side.end(); await wait(300);
    check('a full push to the side: a sharp turn in a third of a second, and he is moving', Math.abs(Math.PI - c.f) > 0.6 && c.sp > 2 && c.m > 0.3, `${Math.abs(Math.PI - c.f).toFixed(2)} rad, ${c.sp.toFixed(1)} m/s, ${c.m.toFixed(1)} m`);
    await put(); await wait(300);
    const run = await p.touchscreen.touchStart(S.x, S.y - 66); await wait(500); const r0 = await speed(); const f0 = await p.evaluate(() => window.chomp.wally.facing);
    await run.move(S.x + 66, S.y - 8); await wait(300); const r1 = await p.evaluate(() => { const w = window.chomp.wally; return { f: w.facing, v: Math.hypot(w.vel.x, w.vel.z) }; });
    check('running, then a hard corner: he turns sharply and keeps his speed', Math.abs(r1.f - f0) > 0.6 && r1.v > r0.v * 0.9, `${Math.abs(r1.f - f0).toFixed(2)} rad, ${r0.v.toFixed(1)} to ${r1.v.toFixed(1)} m/s`);
    { await run.move(S.x + 58, S.y + 34); const low0 = await p.evaluate(() => window.chomp.wally.facing); await wait(350); const low = await p.evaluate(() => { const w = window.chomp.wally; return { f: w.facing, v: Math.hypot(w.vel.x, w.vel.z), spin: Math.abs(w.turnLeft || 0) }; });
      check('the thumb arcs low on a hard turn: he keeps running and turning, with no stop and no about-face', low.v > 3 && low.spin === 0 && Math.abs(low.f - low0) > 0.7, `${low.v.toFixed(1)} m/s, ${Math.abs(low.f - low0).toFixed(2)} rad, spin ${low.spin.toFixed(2)}`); }
    { await run.move(S.x + 62, S.y - 10); await wait(400); const t0 = await p.evaluate(() => window.chomp.wally.facing); await run.move(S.x, S.y - 66); await wait(120);
      const t1 = await p.evaluate(() => window.chomp.wally.facing); await wait(900); const t2 = await p.evaluate(() => window.chomp.wally.facing);
      check('turning, then the thumb straight: the turn stops at once, and never swings back', Math.abs(t1 - t0) < 0.2 && Math.abs(t2 - t1) < 0.02, `ran on ${Math.abs(t1 - t0).toFixed(3)}, then ${(t2 - t1).toFixed(3)} rad`);
      await run.move(S.x + 62, S.y - 10); await wait(350); await run.move(S.x, S.y - 66); await wait(550);
      const b = await p.evaluate(() => { const w = window.chomp.wally, y = window.chomp.cam.yaw + Math.PI, f0 = w.facing; return { side: Math.abs(Math.atan2(Math.sin(f0 - y), Math.cos(f0 - y))) }; });
      const f1 = await p.evaluate(() => window.chomp.wally.facing); await wait(300); const f2 = await p.evaluate(() => window.chomp.wally.facing);
      check('a sharp turn, then straight: he is right ahead on the screen, not left side on', b.side < 0.3, `${b.side.toFixed(2)} rad off`);
      check('and straight stays straight, with no flipping', Math.abs(f2 - f1) < 0.05, Math.abs(f2 - f1).toFixed(3)); }
    await run.move(S.x + 10, S.y - 66); await wait(150); { const a0 = await p.evaluate(() => window.chomp.wally.facing); await wait(400); const a1 = await p.evaluate(() => window.chomp.wally.facing); check('a thumb a little off straight: he still runs straight, no twitch', Math.abs(a1 - a0) < 0.01, Math.abs(a1 - a0).toFixed(3)); }
    await run.move(S.x + 24, S.y - 66); await wait(100); const s0 = await p.evaluate(() => window.chomp.wally.facing); await wait(400); const s1 = await p.evaluate(() => window.chomp.wally.facing);
    check('a slight lean on the run: a gentle change of course', Math.abs(s1 - s0) > 0.01 && Math.abs(s1 - s0) < 0.5, Math.abs(s1 - s0).toFixed(2));
    await run.end(); await wait(400);
    await p.evaluate(() => { const w = window.chomp.wally; w.pos.set(3, -0.45, -8); w.vel.set(0, 0, 0); });
    check('in the water: Dive is the big button, Leap beside it', await p.waitForFunction(() => document.getElementById('t-fours').textContent === 'Dive', { timeout: 8000, polling: 100 }).then(() => true).catch(() => false) && (await left()) === 'Dive,Leap', await left());
    await shot(p, 'water');
    const F = await p.evaluate(() => { const r = document.getElementById('t-fours').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.touchscreen.tap(F.x, F.y);
    check('tap Dive once and he goes under and stays: the big button is now Up', await p.waitForFunction(() => document.getElementById('t-jump').textContent === 'Up', { timeout: 4000, polling: 100 }).then(() => true).catch(() => false) && (await left()) === 'Up', await left());
    await wait(1200);
    check('still under, with the thumb off', await p.evaluate(() => document.getElementById('t-jump').textContent === 'Up'));
    await shot(p, 'under');
    await p.touchscreen.tap(F.x, F.y);
    check('tap Up, in the same place: back to the top', await p.waitForFunction(() => document.getElementById('t-fours').textContent === 'Dive' && document.getElementById('t-fours').dataset.slot === 'big', { timeout: 4000, polling: 100 }).then(() => true).catch(() => false));
    check('no page errors', !p.errors.length, p.errors[0]); await p.close(); }
} finally { await b.close(); }
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
