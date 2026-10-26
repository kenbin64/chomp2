// A controlled trial of Chomp's keyboard controls. Wally is put at the same spot facing the same way, and real
// food is thrown to land at fixed places around him: 8 directions x 2 distances, each arriving 1.6 s later.
// A scripted player (keys A, D, W only; it sees the game 0.2 s late, like a person) goes for that piece alone.
//
//   node controls-trial.mjs <url> <rounds> <label>
//
// Per trial: caught or not, turning done (radians), turn reversals. The tourists' own throwing is ignored.
import puppeteer from 'puppeteer-core';
// Chrome's location on Windows; set CHROME to use another.
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [url, rounds = '3', label = 'run'] = process.argv.slice(2);

const b = await puppeteer.launch({ executablePath: CHROME, headless: false,
  args: ['--window-size=1300,800', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.setViewport({ width: 1280, height: 720 });
await p.evaluateOnNewDocument(() => { try { localStorage.setItem('chomp-opening-done', '1'); localStorage.setItem('chomp-visited', JSON.stringify(['park'])); localStorage.removeItem('chomp-progress'); } catch {} });
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.chomp && window.chomp.game, { timeout: 120000 });
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => document.getElementById('play').click());
await p.waitForFunction(() => window.chomp.game.running && window.chomp.game.intro <= 0, { timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));

const out = await p.evaluate(async (rounds) => {
  const { game, wally, food } = window.chomp;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const press = (key, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, bubbles: true }));
  const held = new Set(); const set = (key, on) => { if (on && !held.has(key)) { held.add(key); press(key, true); } if (!on && held.has(key)) { held.delete(key); press(key, false); } };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const home = { x: wally.pos.x, y: wally.pos.y, z: wally.pos.z };
  const trials = [];
  for (const deg of [0, 45, 90, 135, 180, -135, -90, -45]) for (const dist of [3, 5]) trials.push({ deg, dist });
  const results = [];
  for (let r = 0; r < rounds; r++) for (const tr of trials) {
    for (const k of [...held]) set(k, false);
    await wait(250);
    // Put him back: same place, facing +z, standing still.
    wally.pos.set(home.x, home.y, home.z); wally.vel.set(0, 0, 0); wally.facing = 0; wally.turnRate = 0; wally.heading = undefined;
    await wait(300);
    const mouthY = wally.mouthPosition().y, a = tr.deg * Math.PI / 180;
    const to = { x: home.x + Math.sin(a) * tr.dist, y: mouthY, z: home.z + Math.cos(a) * tr.dist };
    const from = new wally.pos.constructor(to.x + 2, to.y + 4, to.z + 2), T = 1.6, G = 9.8;
    const caught0 = game.catches;
    const item = food.throw('fries', from, { x: (to.x - from.x) / T, y: (to.y - from.y + 0.5 * G * T * T) / T, z: (to.z - from.z) / T });
    let turned = 0, last = wally.facing, reversals = 0, lastKey = null, lastEnd = 0; const hist = [];
    const t0 = performance.now(); let caught = false;
    while (performance.now() - t0 < 2600) {
      const now = performance.now();
      turned += Math.abs(wrap(wally.facing - last)); last = wally.facing;
      hist.push({ now, x: wally.pos.x, z: wally.pos.z, f: wally.facing }); while (hist.length && hist[0].now < now - 600) hist.shift();
      const seen = hist.find(h => h.now >= now - 200) || hist[0];
      if (game.catches > caught0) { caught = true; break; }
      if (item.taken || item.landed) break;
      const dx = to.x - seen.x, dz = to.z - seen.z, d = Math.hypot(dx, dz), err = wrap(Math.atan2(dx, dz) - seen.f);
      const turning = held.has('a') || held.has('d');
      const need = d < 0.5 ? 0 : (turning ? Math.abs(err) > 0.12 : Math.abs(err) > 0.25) ? Math.sign(err) : 0;
      const key = need > 0 ? 'a' : need < 0 ? 'd' : null;
      if (key && lastKey && key !== lastKey && now - lastEnd < 500) reversals++;
      if (turning && !key) lastEnd = now;
      if (key) lastKey = key;
      set('a', key === 'a'); set('d', key === 'd'); set('w', d > 0.4 && Math.abs(err) < 0.6);
      await wait(16);
    }
    if (!item.taken) food.take(item, 'gone');
    results.push({ ...tr, caught, turned, reversals, needed: Math.abs(a) });
  }
  for (const k of [...held]) set(k, false);
  return results;
}, Number(rounds));
await b.close();

const n = out.length, caught = out.filter(r => r.caught).length;
const waste = out.reduce((s, r) => s + Math.max(0, r.turned - r.needed), 0) / n;
const byDir = {};
for (const r of out) { const k = Math.abs(r.deg); (byDir[k] ||= { n: 0, c: 0 }); byDir[k].n++; if (r.caught) byDir[k].c++; }
console.log(JSON.stringify({ label, trials: n, caughtShare: +(caught / n).toFixed(3), wastedTurnPerTrial: +waste.toFixed(2),
  reversalsPerTrial: +(out.reduce((s, r) => s + r.reversals, 0) / n).toFixed(2),
  byDirection: Object.fromEntries(Object.entries(byDir).map(([k, v]) => [k + 'deg', `${v.c}/${v.n}`])), errors: errs }));
