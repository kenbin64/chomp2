// Controls probe (Ken, 2026-10-30), in a real browser. His rules, from every controller: up goes forward the way Wally
// faces; right turns him right, the longer the more; up and right together curve; down is an about-face. The mouse: left
// down goes, moving it turns him. A stick and touch do the same, smoothly: no jumps in his speed or his heading.
//   node serve.mjs   then   node test/controls-probe.mjs
import puppeteer from 'puppeteer-core';
const BASE = process.env.CHOMP_URL || 'http://localhost:8090/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(ok ? '  ok  ' : '  FAIL', name, detail); };
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });

async function park(settings = { tips: false }, opts = {}) {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage();
  await p.setViewport({ width: 1100, height: 700, ...opts });
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  await p.goto(BASE + 'about.html');
  await p.evaluate(s => { localStorage.clear(); localStorage.setItem('chomp-tips-off', '1'); localStorage.setItem('chomp-settings', JSON.stringify(s)); }, settings);
  await p.goto(BASE + 'index.html?noopening');
  await p.waitForFunction(() => window.chomp && window.chomp.cam, { timeout: 90000, polling: 250 });
  await wait(4000);
  await p.evaluate(() => window.chompStartHere());
  await p.waitForFunction(() => window.chomp.game.running && window.chomp.game.intro <= 0, { timeout: 30000, polling: 250 });
  await wait(400);
  p.done = () => ctx.close();
  return p;
}
const home = p => p.evaluate(() => { const w = window.chomp.wally; w.pos.set(0, 0.35, 21); w.vel.set(0, 0, 0); w.facing = Math.PI; w.turnLeft = 0; w.spin = null; });
const state = p => p.evaluate(() => { const w = window.chomp.wally; return { f: w.facing, x: w.pos.x, z: w.pos.z, sp: Math.hypot(w.vel.x, w.vel.z), t: performance.now() }; });
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// Samples of him over a while.
async function watch(p, ms, every = 100) { const out = [await state(p)]; for (let t = 0; t < ms; t += every) { await wait(every); out.push(await state(p)); } return out; }
const moved = s => Math.hypot(s[s.length - 1].x - s[0].x, s[s.length - 1].z - s[0].z);
const turned = s => { let a = 0; for (let i = 1; i < s.length; i++) a += wrap(s[i].f - s[i - 1].f); return a; };
// The biggest jump between samples, as a rate: a smooth control has none.
const jolt = (s, key) => { let m = 0; for (let i = 2; i < s.length; i++) m = Math.max(m, Math.abs(wrap ? (s[i][key] - s[i - 1][key]) - (s[i - 1][key] - s[i - 2][key]) : 0)); return m; };

{ // ---- Keys ----
  const p = await park({ tips: false, v2: true, v3: true, controls: 'camera' });
  check('a save from the one camera-relative day moves back to steering', (await p.evaluate(async () => (await import('./js/settings.js')).settings.controls)) === 'classic');
  await home(p); const f0 = (await state(p)).f;
  await p.keyboard.down('KeyW'); const up = await watch(p, 1500); await p.keyboard.up('KeyW'); await wait(500);
  const dx = up[up.length - 1].x - up[0].x, dz = up[up.length - 1].z - up[0].z;
  check('up: forward the way he faces', Math.abs(wrap(Math.atan2(dx, dz) - f0)) < 0.1 && moved(up) > 5, `${Math.atan2(dx, dz).toFixed(2)} vs ${f0.toFixed(2)}, ${moved(up).toFixed(1)} m`);
  check('up: his heading does not change', Math.abs(turned(up)) < 0.02, turned(up).toFixed(3));

  await home(p); await p.keyboard.down('KeyD'); const right = await watch(p, 1200); await p.keyboard.up('KeyD'); await wait(400);
  check('right alone: he turns, without walking off', Math.abs(turned(right)) > 1 && moved(right) < 0.6, `${turned(right).toFixed(2)} rad, ${moved(right).toFixed(2)} m`);
  check('right turns him right', turned(right) < 0, turned(right).toFixed(2));
  const early = Math.abs(turned(right.slice(0, 4))), late = Math.abs(turned(right.slice(-4)));
  check('the longer it is pushed, the faster he turns', late > early * 1.5, `${early.toFixed(2)} then ${late.toFixed(2)} rad`);

  await home(p); await p.keyboard.down('KeyW'); await p.keyboard.down('KeyD'); const curve = await watch(p, 1500); await p.keyboard.up('KeyW'); await p.keyboard.up('KeyD'); await wait(500);
  // (Measured along his way: the net distance says little when he curves right round.)
  const along = s => s.slice(1).reduce((n, q, i) => n + Math.hypot(q.x - s[i].x, q.z - s[i].z), 0);
  check('up and right: forward, curving right', along(curve) > 4 && turned(curve) < -0.8, `${along(curve).toFixed(1)} m along, ${turned(curve).toFixed(2)} rad`);

  await home(p); const a = await state(p);
  await p.keyboard.down('KeyS'); await wait(900); const held = await state(p); await p.keyboard.up('KeyS'); await wait(300); const b = await state(p);
  check('down: an about-face, half a circle', Math.abs(Math.abs(wrap(b.f - a.f)) - Math.PI) < 0.1, wrap(b.f - a.f).toFixed(2));
  check('down: he stays where he is', Math.hypot(held.x - a.x, held.z - a.z) < 0.4, Math.hypot(held.x - a.x, held.z - a.z).toFixed(2));
  await p.keyboard.down('KeyW'); await wait(50); const u0 = await state(p); const after = await watch(p, 1000); await p.keyboard.up('KeyW'); await wait(400);
  const ax = after[after.length - 1].x - after[0].x, az = after[after.length - 1].z - after[0].z;
  check('then up: forward the new way, no spinning back', Math.abs(wrap(u0.f - b.f)) < 0.25 && Math.abs(wrap(Math.atan2(ax, az) - b.f)) < 0.25, `${wrap(u0.f - b.f).toFixed(2)}, ${wrap(Math.atan2(ax, az) - b.f).toFixed(2)}`);

  // ---- A click never takes the cursor, and the mouse does not steer (Ken, 2026-10-31: all keyboard, on a computer). ----
  await home(p);
  const m = await p.evaluate(async () => {
    const c = document.querySelector('canvas'); let asked = 0; c.requestPointerLock = () => { asked++; return Promise.resolve(); };
    const w = window.chomp.wally, f0 = w.facing, x0 = w.pos.x, z0 = w.pos.z;
    for (const type of ['mousedown', 'mouseup', 'click']) c.dispatchEvent(new MouseEvent(type, { button: 0, bubbles: true }));
    for (let i = 0; i < 10; i++) { window.dispatchEvent(new MouseEvent('mousemove', { movementX: 40, bubbles: true })); await new Promise(r => setTimeout(r, 25)); }
    await new Promise(r => setTimeout(r, 300));
    return { asked, turned: Math.abs(w.facing - f0), moved: Math.hypot(w.pos.x - x0, w.pos.z - z0), orb: !!document.querySelector('.mouse-orb') };
  });
  check('clicking the game never takes the cursor', m.asked === 0, JSON.stringify(m));
  check('the mouse does not steer him', m.turned < 0.02 && m.moved < 0.3, JSON.stringify(m));
  check('no mouse orb on a computer', !m.orb);
  check('no page errors', !p.errors.length, p.errors.join(' | '));
  await p.done();
}
{ // ---- A game controller, or a VR controller, which reads the same way. ----
  const p = await park();
  await p.evaluate(() => { window.__axes = [0, 0, 0, 0]; const fake = () => [{ mapping: 'standard', axes: window.__axes, buttons: Array.from({ length: 17 }, () => ({ pressed: false })) }]; Object.defineProperty(navigator, 'getGamepads', { value: fake, configurable: true }); });
  const stick = (x, y) => p.evaluate((x, y) => { window.__axes[0] = x; window.__axes[1] = y; }, x, y);
  await home(p); await stick(0, -1); const up = await watch(p, 1400, 50); await stick(0, 0); await wait(600);
  check('stick up: he goes forward', moved(up) > 4 && Math.abs(turned(up)) < 0.02, moved(up).toFixed(1));
  const steps = up.slice(1).map((s, i) => s.sp - up[i].sp), biggest = Math.max(...steps);
  check('stick: he eases up to speed, no sudden jump', biggest < 3, biggest.toFixed(2));
  await home(p); await stick(0.4, 0); const small = await watch(p, 800); await stick(1, 0); const big = await watch(p, 800); await stick(0, 0); await wait(400);
  check('stick: a small push turns gently, a full push sharply', Math.abs(turned(big)) > Math.abs(turned(small)) * 2 && turned(big) < 0, `${turned(small).toFixed(2)} then ${turned(big).toFixed(2)}`);
  await home(p); const a = await state(p); await stick(0, 1); await wait(800); await stick(0, 0); await wait(300); const b = await state(p);
  check('stick down: one about-face', Math.abs(Math.abs(wrap(b.f - a.f)) - Math.PI) < 0.12, wrap(b.f - a.f).toFixed(2));
  await home(p); const c0 = await state(p); await stick(0.15, 0.2); await wait(500); await stick(0, 0); await wait(200); const c1 = await state(p);
  check('stick: a slight pull back does not spin him round', Math.abs(wrap(c1.f - c0.f)) < 1, wrap(c1.f - c0.f).toFixed(2));
  await p.done();
}
{ // ---- Touch: a phone. ----
  const p = await park({ tips: false }, { width: 844, height: 390, isMobile: true, hasTouch: true });
  // The middle of the fixed circle, where the right thumb goes.
  const { sx, sy } = await p.evaluate(() => { const r = document.getElementById('stick').getBoundingClientRect(); return { sx: r.left + r.width / 2, sy: r.top + r.height / 2 }; });
  check('touch: the circle is on the right, the buttons on the left', await p.evaluate(() => { const b = id => document.getElementById(id).getBoundingClientRect(); return b('stick').left > innerWidth / 2 && b('t-jump').right < innerWidth / 2 && b('t-fours').right < innerWidth / 2 && getComputedStyle(document.getElementById('t-jump')).display !== 'none'; }));
  await home(p); const t = await p.touchscreen.touchStart(sx, sy);
  await t.move(sx, sy - 70); const up = await watch(p, 1400, 50);
  check('touch, drag up: he goes forward, straight', moved(up) > 4 && Math.abs(turned(up)) < 0.02, `${moved(up).toFixed(1)} m, ${turned(up).toFixed(3)} rad`);
  const steps = up.slice(1).map((s, i) => s.sp - up[i].sp);
  check('touch: he eases up to speed, no sudden jump', Math.max(...steps) < 3, Math.max(...steps).toFixed(2));
  { const r = await p.evaluate(() => { const b = document.getElementById('stick').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }); check('touch: the circle stays where it is under the thumb', Math.abs(r.x - sx) < 1 && Math.abs(r.y - sy) < 1, JSON.stringify(r)); }
  // Curving: slide the thumb from up to up and right, little by little, and his heading follows without a jolt.
  await home(p);
  for (let i = 1; i <= 8; i++) { await t.move(sx + i * 6, sy - 60); await wait(40); }
  const curve = await watch(p, 1000, 50);
  check('touch, up and right: forward, curving right', moved(curve) > 2 && turned(curve) < -0.5, `${moved(curve).toFixed(1)} m, ${turned(curve).toFixed(2)} rad`);
  // Measured on every drawn frame: sampling between frames shows noise that is not there. A frame the browser ran slow, or the part-frame the measuring starts on, is left out.
  const frames = await p.evaluate(() => new Promise(done => { const w = window.chomp.wally, out = []; let last = performance.now(), f = w.facing, n = 0; const tick = now => { const dt = (now - last) / 1000; if (dt > 0.012 && dt < 0.04) out.push(Math.atan2(Math.sin(w.facing - f), Math.cos(w.facing - f)) / dt); else out.push(null); last = now; f = w.facing; if (++n < 40) requestAnimationFrame(tick); else done(out); }; requestAnimationFrame(tick); }));
  const steps2 = frames.slice(1).map((r, i) => r === null || frames[i] === null ? 0 : Math.abs(r - frames[i])), judder = [...steps2].sort((a, b) => a - b)[Math.floor(steps2.length * 0.9)], counted = frames.filter(r => r !== null).length;
  check('touch: the turn is smooth, no judder', counted > 10 && judder < 0.5, `${judder.toFixed(2)} rad/s frame to frame (nine frames in ten), over ${counted} frames`);
  await t.end(); await wait(100); const lifted = await watch(p, 700, 50);
  check('touch, let go: he eases to a stop', lifted[0].sp > 0.2 && lifted[lifted.length - 1].sp < 0.3, `${lifted[0].sp.toFixed(1)} to ${lifted[lifted.length - 1].sp.toFixed(1)}`);
  await home(p); const a = await state(p); const d = await p.touchscreen.touchStart(sx, sy - 60); await d.move(sx, sy + 55); await wait(900); await d.end(); await wait(300); const b = await state(p);
  check('touch, drag down: one about-face', Math.abs(Math.abs(wrap(b.f - a.f)) - Math.PI) < 0.12, wrap(b.f - a.f).toFixed(2));
  // Two thumbs at once: steering with the right, jumping with the left, neither disturbing the other.
  const btn = id => p.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  await home(p); await wait(100);
  await p.touchscreen.tap(sx, sy); await wait(150);
  check('touch: a tap on the circle does not jump', await p.evaluate(() => window.chomp.wally.grounded));
  const J = await btn('t-jump'); const right = await p.touchscreen.touchStart(sx, sy); await right.move(sx, sy - 70); const go0 = await state(p); await wait(500);
  const left = await p.touchscreen.touchStart(J.x, J.y); await left.end(); await wait(120);
  check('two thumbs: he jumps while the right thumb keeps him going', await p.evaluate(() => !window.chomp.wally.grounded));
  await wait(500); const go1 = await state(p); await right.end();
  check('two thumbs: and he kept going', Math.hypot(go1.x - go0.x, go1.z - go0.z) > 2, Math.hypot(go1.x - go0.x, go1.z - go0.z).toFixed(1));
  const D = await btn('t-fours'); const f0 = await p.evaluate(() => window.chomp.wally.mode);
  await home(p); await wait(200); const hold = await p.touchscreen.touchStart(D.x, D.y); await wait(400);
  check('touch: Dive held, as Shift is held', await p.evaluate(() => window.chomp.wally.mode === 'fours' || document.getElementById('t-fours').classList.contains('on')), f0);
  await hold.end(); await wait(200);
  check('touch: let go, it lets go', await p.evaluate(() => !document.getElementById('t-fours').classList.contains('on')));
  const before = await p.evaluate(() => window.chomp.cam.yaw); const look = await p.touchscreen.touchStart(422, 120); await look.move(362, 120); await wait(100); await look.end();
  check('touch: a finger anywhere else turns the camera', await p.evaluate(b => Math.abs(window.chomp.cam.yaw - b) > 0.1, before));
  check('no page errors', !p.errors.length, p.errors.join(' | '));
  await p.done();
}
{ // ---- Straight on keeps him on the path (Ken, 2026-11-01): the curved one round the park, and off it when he turns. ----
  const p = await park({ tips: false });
  const on = await p.evaluate(async () => { const G = await import('./js/ground.js'), R = await import('./js/rules.js'); G.setParkMode('outside'); window.R = R; const a = 2.1, q = R.fencePoint(a, 3.5), w = window.chomp.wally; w.pos.set(q.x, R.BANK_Y, q.z); w.vel.set(0, 0, 0); w.facing = R.pathTangent(a) + 0.35; return R.pathTangent(a); });
  const read = () => p.evaluate(() => { const w = window.chomp.wally, a = window.R.pathAngle(w.pos.x, w.pos.z), t = window.R.pathTangent(a); return { a, out: window.R.fenceOffset(w.pos.x, w.pos.z), off: Math.abs(Math.atan2(Math.sin(w.facing - t), Math.cos(w.facing - t))) }; });
  await p.keyboard.down('ArrowUp'); await wait(600); const s0 = await read(); let worst = 0; for (let i = 0; i < 10; i++) { await wait(300); worst = Math.max(worst, Math.abs((await read()).out - 3.5)); } const s1 = await read();
  check('up on the curved path: he comes round to it, and faces along it', s0.off < 0.12 && s1.off < 0.12, `${s0.off.toFixed(2)}, ${s1.off.toFixed(2)} rad`);
  check('and goes round the curve, staying on it', Math.abs(s1.a - s0.a) > 0.15 && worst < 1.2, `${(s1.a - s0.a).toFixed(2)} rad round, ${s1.out.toFixed(1)} m out (worst ${worst.toFixed(1)})`);
  await p.keyboard.down('ArrowLeft'); await wait(500); await p.keyboard.up('ArrowLeft'); await wait(1400); const s2 = await read(); await p.keyboard.up('ArrowUp');
  check('a real turn takes him off it', s2.out > 5.5 || s2.out < 1.5, s2.out.toFixed(1));
  check('no page errors', !p.errors.length, p.errors.join(' | '));
  await p.done();
}
await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
