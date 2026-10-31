// The black marlin in the real game, in real Chrome (Ken, 2026-10-31): the skipper's scene; no mangoes, no boat; the cast,
// troll and strike with real keys; a lost fish and another go; landing him; the release and the medallion; a thief taking a
// mango and giving it back. Needs the server: node serve.mjs. Pass a folder to keep the pictures.
import puppeteer from 'puppeteer-core';
const S = process.argv[2];
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, info = '') => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) failed++; };
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const until = (p, fn, ms = 40000) => p.waitForFunction(fn, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
const shot = async (p, n) => { if (S) await p.screenshot({ path: `${S}/${n}.png` }); };
try {
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8090/about.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('chomp-tips-off', '1'); localStorage.setItem('chomp-settings', JSON.stringify({ tips: false })); });
  await p.goto('http://localhost:8090/esplanade.html?all&play&stay', { timeout: 60000 });
  check('it loads', await until(p, () => window.chomp && window.chomp.fishing && window.chomp.game.running, 90000));
  await wait(1500);
  check('a new level opens with its cut scene: the skipper', await p.evaluate(() => window.chomp.cut.active && /Skipper|Wally/.test(document.querySelector('.escape-line').textContent)));
  await shot(p, 'pm-skipper');
  await p.evaluate(() => window.chomp.cut.end()); await wait(400);
  const toBoat = () => p.evaluate(() => { const c = window.chomp, w = c.wally; c.game.energy = 100; w.pos.set(c.boatAt.x + 5.5, 1.4, c.boatAt.z); w.vel.set(0, 0, 0); });
  await p.evaluate(() => { window.chomp.game.mangoes = 0; }); await toBoat(); await wait(700);
  check('no mangoes: no boat', await p.evaluate(() => !window.chomp.fishing.active));
  await shot(p, 'pm-boat');
  await p.evaluate(() => { window.chomp.game.mangoes = 20; }); await toBoat();
  check("with the fare: aboard, in Wally's own view", await until(p, () => window.chomp.fishing.phase === 'aim', 20000) && await p.evaluate(() => !window.chomp.wally.root.visible));
  // The cast, with real keys.
  const before = await p.evaluate(() => window.chomp.fishing.state.angle);
  await p.keyboard.down('ArrowUp'); await wait(800); await p.keyboard.up('ArrowUp');
  check('Up raises the angle', await p.evaluate(a => window.chomp.fishing.state.angle > a + 2, before));
  await p.evaluate(() => { window.chomp.fishing.state.angle = 33; });
  await shot(p, 'pm-aim');
  await p.keyboard.press('Space');
  check('Space sets it: the force meter', await until(p, () => window.chomp.fishing.phase === 'force', 8000));
  // A cast too weak: into the wake, and another go.
  await until(p, () => { const s = window.chomp.fishing.state; return s.force > 0.1 && s.force < 0.3; }, 8000); await p.keyboard.press('Space');
  await until(p, () => window.chomp.fishing.phase === 'flight', 5000);
  check('too weak: in the wake, cast again', await until(p, () => window.chomp.fishing.phase === 'aim', 15000));
  await p.evaluate(() => { window.chomp.fishing.state.angle = 33; }); await p.keyboard.press('Space'); await until(p, () => window.chomp.fishing.phase === 'force', 5000);
  await until(p, () => { const s = window.chomp.fishing.state; return s.force > 0.7 && s.force < 0.9; }, 8000); await p.keyboard.press('Space');
  check('a good cast flies', await until(p, () => window.chomp.fishing.phase === 'flight', 5000));
  await wait(500); await shot(p, 'pm-flight');
  check('and lands: the boat trolls', await until(p, () => window.chomp.fishing.phase === 'troll', 20000), JSON.stringify(await p.evaluate(() => Math.round(window.chomp.fishing.state.cast.x))));
  check('the gauge shows a bite', await until(p, () => window.chomp.fishing.state.troll && window.chomp.fishing.state.troll.state === 'bite', 40000));
  await shot(p, 'pm-bite');
  await p.keyboard.press('Space');
  check('striking on it: fish on', await until(p, () => window.chomp.fishing.phase === 'fight', 6000));
  await wait(1200); await shot(p, 'pm-fight');
  // Only reeling, as a new player might: the line goes.
  await p.evaluate(() => { const f = window.chomp.fishing.state.fight; f.mode = 'run'; f.modeLeft = 8; f.stamina = 1; });
  await p.keyboard.down('ArrowDown');
  check('Down reels: reeling against a run: the line snaps', await until(p, () => { const c = window.chomp.fishing; return c.phase === 'lost' && c.state.fight.why === 'snapped'; }, 15000));
  await p.keyboard.up('ArrowDown'); await shot(p, 'pm-lost');
  await p.keyboard.press('Space');
  check('cast again', await until(p, () => window.chomp.fishing.phase === 'aim', 4000));
  // Fight him by the gauge, with both controls, through real key events. (Started part way through, to save time.)
  await p.evaluate(() => { const c = window.chomp.fishing; c.testHook(40); c.state.fight.stamina = 0.32; });
  let shotLeap = false, reel = false, rel = false, usedReel = 0, usedRelease = 0;
  for (let i = 0; i < 900; i++) {
    const q = await p.evaluate(() => { const c = window.chomp.fishing; if (c.phase !== 'fight') return { over: true }; const f = c.state.fight; return { t: f.tension, mode: f.mode }; });
    if (q.over) break;
    const wantRel = q.t > 0.75 || q.mode === 'jump' || (rel && q.t > 0.43), wantReel = !wantRel && q.t < 0.55;
    if (wantRel !== rel) { rel = wantRel; await (rel ? p.keyboard.down('ArrowUp') : p.keyboard.up('ArrowUp')); }
    if (wantReel !== reel) { reel = wantReel; await (reel ? p.keyboard.down('ArrowDown') : p.keyboard.up('ArrowDown')); }
    if (rel) usedRelease++; if (reel) usedReel++;
    if (q.mode === 'jump' && !shotLeap) { shotLeap = true; await wait(600); await shot(p, 'pm-leap'); }
    await wait(50);
  }
  if (rel) await p.keyboard.up('ArrowUp'); if (reel) await p.keyboard.up('ArrowDown');
  check('played by the gauge with both controls, he comes alongside', await p.evaluate(() => window.chomp.fishing.state.fight && window.chomp.fishing.state.fight.result === 'landed'), `reel ${usedReel}, release ${usedRelease}`);
  check('then the release plays', await until(p, () => window.chomp.fishing.phase === 'release' && window.chomp.cut.active, 6000));
  await wait(800); await shot(p, 'pm-alongside');
  // Through the lines: a key goes on one.
  await p.keyboard.press('KeyZ'); await wait(700); await p.keyboard.press('KeyZ'); await wait(2200); await shot(p, 'pm-medal');
  check('the medallion comes up with him', await p.evaluate(() => window.chomp.fishing.state.medalT > 0));
  await p.keyboard.press('KeyZ'); await wait(500); await p.keyboard.press('KeyZ');
  check('he has the sun medallion', await until(p, () => window.chomp.game.hasMedal, 8000));
  await wait(1000); await shot(p, 'pm-away');
  await p.keyboard.press('KeyZ');
  check('back on the pier, in view', await until(p, () => !window.chomp.fishing.active, 12000) && await p.evaluate(() => window.chomp.wally.root.visible && Math.abs(window.chomp.wally.pos.y - 1.4) < 0.5));
  await wait(500); check('the boat does not take him again', await p.evaluate(() => !window.chomp.fishing.active));
  // The thieves.
  const r = await p.evaluate(async () => {
    const c = window.chomp, T = c.thieves, w = c.wally, g = c.game, sleep = ms => new Promise(q => setTimeout(q, ms));
    w.pos.set(0, 1.4, 100); w.vel.set(0, 0, 0); g.mangoes = 5; g.energy = 100; await sleep(400);
    T.next = 99; T.launch(T.birds[0], w.pos);
    const t0 = performance.now(); while (performance.now() - t0 < 15000 && g.mangoes === 5) { w.pos.x = 0; w.pos.z = 100; w.vel.set(0, 0, 0); g.energy = 100; await sleep(30); }
    const stole = g.mangoes, t1 = performance.now();
    while (performance.now() - t1 < 15000 && !T.drops.some(d => d.landed)) { g.energy = 100; await sleep(50); }
    const d = T.drops.find(x => x.landed); if (d) { w.pos.x = d.x; w.pos.z = d.z; w.vel.set(0, 0, 0); }
    await sleep(800);
    return { stole, back: g.mangoes, dropped: !!d };
  });
  check('a thief snatches a mango, and drops it down the walk', r.stole === 4 && r.dropped, JSON.stringify(r));
  check("he can run it down and get it back", r.back >= 5, JSON.stringify(r));
  // The way off: the boat, with the clam's mango. The Lagoon is only for swimming now.
  const atBoat = () => p.evaluate(() => { const c = window.chomp, w = c.wally; c.game.energy = 100; w.pos.set(c.boatAt.x + 5.5, 1.4, c.boatAt.z); w.vel.set(0, 0, 0); });
  await p.evaluate(async () => { const c = window.chomp, w = c.wally; c.game.energy = 100; w.pos.set(0, 1.4, 495); w.vel.set(0, 0, 0); await new Promise(r => setTimeout(r, 1200)); });
  check('walking into the Lagoon does not end the level', await p.evaluate(() => !window.chomp.game.done));
  await p.evaluate(() => { window.chomp.game.hasBigMango = false; }); await atBoat(); await wait(800);
  check('the boat will not leave without the clam\'s mango', await p.evaluate(() => !window.chomp.game.done));
  await p.evaluate(() => { window.chomp.game.hasBigMango = true; }); await atBoat();
  check('with the medallion and the mango: the skipper takes him', await until(p, () => window.chomp.game.leaving && window.chomp.cut.active, 8000));
  await wait(1200); await shot(p, 'pm-leaving');
  await p.keyboard.press('Escape');
  check('and the level is won', await until(p, () => !document.getElementById('result').hidden, 15000), await p.evaluate(() => document.getElementById('result-title').textContent));
  check('no page errors', !errors.length, errors.slice(0, 2).join(' | '));
} finally { await b.close(); }
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
