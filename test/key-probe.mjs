// Key probe (Ken, 2026-10-30), in a real browser: the key to the park is in the chest on the lagoon bed. The gate stays
// shut without it; finding everything the visitors dropped opens the chest; the key opens the gate and starts the
// chase; food keeps coming for as long as he is in there; and a return visit starts with the key.
//   node serve.mjs   then   node test/key-probe.mjs
import puppeteer from 'puppeteer-core';
const BASE = process.env.CHOMP_URL || 'http://localhost:8090/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(ok ? '  ok  ' : '  FAIL', name, detail); };
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });

async function park(save = null) {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage();
  await p.setViewport({ width: 1100, height: 700 });
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  await p.goto(BASE + 'about.html');
  await p.evaluate(s => { localStorage.clear(); localStorage.setItem('chomp-tips-off', '1'); localStorage.setItem('chomp-settings', JSON.stringify({ tips: false })); if (s) localStorage.setItem('chomp-progress', JSON.stringify(s)); }, save);
  await p.goto(BASE + 'index.html?noopening');
  await p.waitForFunction(() => window.chomp && window.chomp.cam, { timeout: 90000, polling: 250 });
  await wait(4000);
  await p.evaluate(() => window.chompStartHere());
  await p.waitForFunction(() => window.chomp.game.running && window.chomp.game.intro <= 0, { timeout: 30000, polling: 250 });
  await wait(500);
  p.done = () => ctx.close();
  return p;
}
const state = p => p.evaluate(() => { const c = window.chomp, g = c.game; return { key: g.hasKey, stage: g.quest.stage, out: !!g.out, found: c.treasure.found, opened: c.treasure.opened, mangoes: g.mangoes, goals: [...document.querySelectorAll('#goals li')].map(l => l.textContent), title: document.getElementById('quest-title').textContent, x: c.wally.pos.x, z: c.wally.pos.z }; });
// Hold him down at the bottom at a spot for a moment, as if he had swum there.
const diveTo = (p, x, z) => p.evaluate(async (x, z) => {
  const c = window.chomp, t0 = performance.now();
  while (performance.now() - t0 < 500) { c.game.depth = -2.3; c.game.wantDepth = -2.3; c.wally.pos.x = x; c.wally.pos.z = z; c.wally.pos.y = -1.9; c.wally.vel.set(0, 0, 0); await new Promise(r => requestAnimationFrame(r)); }
}, x, z);

{
  const p = await park();
  let s = await state(p);
  check('it starts by asking for the lost things and the chest', s.goals.some(g => /dropped in the lagoon/.test(g)) && s.goals.some(g => /chest/i.test(g)), JSON.stringify(s.goals));
  check('no more feed-every-group goal', !s.goals.some(g => /every group/i.test(g)));
  check('no mangoes in Croc Park: none on the goals', !s.goals.some(g => /mango/i.test(g)), JSON.stringify(s.goals));
  check('before he is out: no iron walls', await p.evaluate(() => window.chomp.scene.getObjectByName('lockdown-walls').visible === false));
  // The camera in the water: his own eyes at the surface and under it; the water's colour only under.
  {
    const q = await p.evaluate(async () => {
      const c = window.chomp, w = c.wally, wait = ms => new Promise(r => setTimeout(r, ms));
      w.pos.set(3, -0.45, -6); w.vel.set(0, 0, 0); w.facing = 0; { const t0 = performance.now(); while (performance.now() - t0 < 20000 && !(c.cam.eyes > 0.96)) await wait(100); }
      const top = { eyes: c.cam.eyes || 0, seen: w.root.visible, near: c.camera.position.distanceTo(w.pos), tint: +document.querySelector('.dive-tint').style.opacity };
      c.game.wantDepth = -2.2; { const t0 = performance.now(); while (performance.now() - t0 < 20000 && !(+document.querySelector('.dive-tint').style.opacity > 0.3)) await wait(100); }   // (it runs on game time: a slow machine takes longer)
      const under = { eyes: c.cam.eyes, seen: w.root.visible, near: c.camera.position.distanceTo(w.pos), tint: +document.querySelector('.dive-tint').style.opacity };
      const dir = c.camera.getWorldDirection(w.pos.clone());
      under.along = dir.x * Math.sin(w.facing) + dir.z * Math.cos(w.facing);
      c.game.wantDepth = -0.45; { const t0 = performance.now(); while (performance.now() - t0 < 20000 && !(+document.querySelector('.dive-tint').style.opacity < 0.05)) await wait(100); }
      const surfaced = { eyes: c.cam.eyes, tint: +document.querySelector('.dive-tint').style.opacity };
      w.pos.set(-30, 0.4, 10); w.vel.set(0, 0, 0); { const t0 = performance.now(); while (performance.now() - t0 < 20000 && !(c.cam.eyes < 0.1 && w.root.visible)) await wait(100); }
      const back = { eyes: c.cam.eyes, seen: w.root.visible, tint: +document.querySelector('.dive-tint').style.opacity };
      return { top, under, surfaced, back };
    });
    check('at the surface: his own eyes, and no tint yet', q.top.eyes > 0.95 && !q.top.seen && q.top.near < 2 && q.top.tint < 0.05, JSON.stringify(q.top));
    check('diving: his own eyes, looking where he is going', q.under.eyes > 0.95 && !q.under.seen && q.under.near < 2 && q.under.along > 0.8, JSON.stringify(q.under));
    check('diving: the water colours the picture', q.under.tint > 0.3, q.under.tint);
    check('coming up: still his eyes, the colour gone', q.surfaced.eyes > 0.95 && q.surfaced.tint < 0.05, JSON.stringify(q.surfaced));
    check('on land: back to seeing him', q.back.eyes < 0.1 && q.back.seen && q.back.tint < 0.05, JSON.stringify(q.back));
  }
  // Without the key, the gate stays shut: he cannot walk past it along the boardwalk.
  const gx = await p.evaluate(() => window.chomp.GATE.x);
  await p.evaluate(gx => { const w = window.chomp.wally; w.pos.set(gx - 1, 3, 2); }, gx);
  await wait(300);
  const tried = await p.evaluate(async () => { const { ground } = await import('./js/ground.js'); const w = window.chomp.wally; return ground.move(w.pos.x, w.pos.z, 44, 2, w.pos.y); });
  check('no key: the boardwalk does not let him out', tried.x < 39, tried.x.toFixed(1));
  check('no key: still inside', !(await state(p)).out);
  // The chest stays shut until everything is found.
  await diveTo(p, 0, 0);
  s = await state(p);
  check('the chest stays shut with nothing found', !s.opened && !s.key);
  const things = await p.evaluate(() => window.chomp.treasure.things.map(t => ({ x: t.x, z: t.z })));
  check('there are five things to find', things.length === 5, things.length);
  for (const t of things.slice(0, 4)) await diveTo(p, t.x, t.z);
  await diveTo(p, 0, 0);
  s = await state(p);
  check('four found: still shut', s.found === 4 && !s.opened, JSON.stringify({ f: s.found, o: s.opened }));
  await diveTo(p, things[4].x, things[4].z);
  await diveTo(p, 0, 0);
  s = await state(p);
  check('all five found: the chest opens', s.found === 5 && s.opened, JSON.stringify({ f: s.found, o: s.opened }));
  check('and he has the key', s.key);
  const icon = id => p.evaluate(id => !!document.querySelector(`.carried-item[data-id="${id}"]:not(.used)`), id);
  check('its icon is at the upper left', await icon('key'));
  await wait(2500);
  check('the chest stands open, lid up', await p.evaluate(() => window.chomp.treasure.chest.lid.rotation.x < -1.5));
  check('and no mangoes with it', !s.mangoes, s.mangoes);
  await wait(300);
  s = await state(p);
  check('the way is now the gate', s.stage === 'gate' && /gate/i.test(s.title), s.title);
  // Back on land with the key: Kenny says what comes next.
  await p.evaluate(() => { const w = window.chomp.wally; w.pos.set(-20, 0.4, 16); w.vel.set(0, 0, 0); });
  await p.waitForFunction(() => window.chomp.escapeScene.active, { timeout: 20000, polling: 100 }).catch(() => {});
  check('on land with the key: Kenny\'s cut scene', await p.evaluate(() => window.chomp.escapeScene.active && /Kenny/.test(document.querySelector('.escape-line').textContent)));
  await wait(600);
  check('and Wally is in view in it, not hidden by his own view', await p.evaluate(() => window.chomp.wally.root.visible));
  if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/kenny-scene.png` });
  await p.evaluate(() => window.chomp.escapeScene.end());
  // Out through the gate, along the boardwalk: the chase starts.
  await p.evaluate(gx => { const w = window.chomp.wally; w.pos.set(gx, 2.5, 2); w.vel.set(0, 0, 0); }, gx);
  await wait(300);
  await p.evaluate(async () => { const R = await import('./js/rules.js'); window.chomp.wally.pos.set(43.5, R.deckHeight(43.5), 2); });
  await wait(400);
  s = await state(p);
  check('used at the gate, the key icon has gone', !(await icon('key')));
  check('breaking out: the cut scene plays first', await p.evaluate(() => window.chomp.escapeScene.active));
  check('and the wrangler waits for it', await p.evaluate(() => window.chomp.catcher.state.hold > 100));
  // A key goes on one line, not the whole scene; every line stays up long enough to read.
  {
    const line = () => p.evaluate(() => document.querySelector('.escape-line').textContent);
    await wait(900); const before = await line();
    await p.keyboard.press('KeyZ'); await wait(300);
    check('a key goes on to the next line, and the scene plays on', before !== await line() && await p.evaluate(() => window.chomp.escapeScene.active), before);
    const { readSeconds } = await import('../js/read-time.js');
    check('a long line gets time to be read', readSeconds('You must bring it to him in the Daintree, as a token of bravery, right now') > 6);
  }
  await p.evaluate(() => window.chomp.escapeScene.end());
  await wait(300);
  check('with the key: past the fence, and the chase is on', s.out, JSON.stringify({ x: s.x, z: s.z }));
  check('the catcher heard', await p.evaluate(() => ['search', 'chase'].includes(window.chomp.catcher.mode)));
  s = await state(p);
  check('the goal now says escape', /escape/i.test(s.title), s.title);
  check('the boss banner comes up', await p.evaluate(() => /wrangler/i.test((document.querySelector('.boss-banner') || {}).textContent || '')));
  await p.waitForFunction(() => Math.abs(window.chomp.scene.getObjectByName('lockdown-walls').position.y) < 0.01, { timeout: 20000, polling: 200 }).catch(() => {});
  check('out: the iron walls have come up', await p.evaluate(() => { const w = window.chomp.scene.getObjectByName('lockdown-walls'); return w.visible && Math.abs(w.position.y) < 0.01; }));
  // The race's chest: shut until 20 mangoes, then the Giant Mango, its icon, and the way out takes it.
  {
    const at = await p.evaluate(() => window.chomp.escape.chestAt), put = (x, z) => p.evaluate((x, z) => { const w = window.chomp.wally; w.pos.x = x; w.pos.z = z; w.vel.set(0, 0, 0); }, x, z);
    await p.evaluate(() => { const c = window.chomp; c.catcher.state.hold = 1e9; c.game.energy = 100; });
    await put(at.x + 2, at.z); await wait(500);
    check('the chest stays shut without 20 mangoes', await p.evaluate(() => !window.chomp.escape.giant));
    await p.evaluate(() => { const e = window.chomp.escape; e.found = 20; }); await put(at.x + 2, at.z);
    await p.waitForFunction(() => window.chomp.escape.giant && window.chomp.escape.open >= 1, { timeout: 20000, polling: 100 }).catch(() => {});
    check('with 20: it opens, lid up, with the golden mango', await p.evaluate(() => { const e = window.chomp.escape; return e.giant && e.chest.lid.rotation.x < -1.5 && e.chest.mango.visible; }));
    check('the golden mango icon is at the upper left', await icon('giant-mango'));
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/giant-chest.png` });
    // The way out is locked until he has shown it to the wrangler.
    const giveIt = await p.evaluate(() => { const c = window.chomp; c.catcher.state.hold = 0; c.wally.pos.x = c.catcher.pos.x + 1.5; c.wally.pos.z = c.catcher.pos.z; c.wally.vel.set(0, 0, 0); return c.escape.given; });
    await p.waitForFunction(() => window.chomp.escape.given, { timeout: 15000, polling: 50 }).catch(() => {});
    check('meeting the wrangler with it: he recognises it', await p.evaluate(() => window.chomp.escape.given));
    check('it stays his: the icon is still there, for the Croc King', await icon('giant-mango'));
    await p.waitForFunction(() => /Wrangler/.test(document.querySelector('.escape-line').textContent), { timeout: 5000, polling: 100 }).catch(() => {});
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/give-scene.png` });
    await p.evaluate(() => window.chomp.escapeScene.end());
    check('and he is on Wally\'s side now: off to the final gate', await p.evaluate(async () => { const c = window.chomp, a = c.catcher.pos.clone(), t0 = performance.now(); while (performance.now() - t0 < 15000 && c.catcher.pos.distanceTo(a) < 2) await new Promise(r => setTimeout(r, 100)); return c.catcher.mode !== 'chase' && c.catcher.state.helper && c.catcher.pos.distanceTo(a) >= 2; }));
  }
  check('no page errors', !p.errors.length, p.errors.join(' | '));
  await p.done();
}
{ // Food keeps coming, however long he takes.
  const p = await park();
  const r = await p.evaluate(async () => {
    const c = window.chomp, g = c.game;
    g.groupsArrived = 99; g.tourGroup = true;
    for (const k of c.clusters.active) { k.counted = true; k.food = 0; }
    g.newGroupIn = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 2500) { if (c.clusters.active.some(k => !k.counted && k.food > 0)) return true; await new Promise(q => setTimeout(q, 100)); }
    return false;
  });
  check('after the last group has gone, more visitors with food arrive', r);
  await p.done();
}
{ // The pier, on a first visit to the Esplanade: paid for with mangoes found on this run, nothing brought.
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage();
  await p.setViewport({ width: 1100, height: 700 });
  await p.goto(BASE + 'about.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('chomp-tips-off', '1'); localStorage.setItem('chomp-settings', JSON.stringify({ tips: false })); });
  await p.goto(BASE + 'esplanade.html?all&play');
  await p.waitForFunction(() => window.chomp && window.chomp.game && window.chomp.game.running, { timeout: 90000, polling: 250 }).catch(() => {});
  await wait(5000);
  const atGate = n => p.evaluate(async n => {
    const R = await import('./js/levels/esplanade-rules.js'), c = window.chomp, g = c.game;
    g.mangoes = n; const t0 = performance.now();
    while (performance.now() - t0 < 4600 && !g.pierOpen) { c.wally.pos.x = -R.PATH.half + 0.6; c.wally.pos.z = R.SPUR.z; g.energy = 90; await new Promise(q => requestAnimationFrame(q)); }
    return { open: !!g.pierOpen, running: g.running, y: c.wally.pos.y };
  }, n);
  let r = await atGate(0);
  check('the pier stays shut with no mangoes', !r.open, JSON.stringify(r));
  r = await atGate(8);
  check('eight found on this run open it, with none brought', r.open, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
