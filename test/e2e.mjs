// End-to-end and regression tests: the real game in Chrome, driven like a player (and through the
// window.chomp test hooks where a player's hands would take minutes). Happy paths, unhappy paths and
// edge cases across the pages.
//
//   node serve.mjs            (the game server, on http://localhost:8090)
//   npm run e2e               (or: node test/e2e.mjs [name-filter])
//
// Needs Google Chrome installed (puppeteer-core drives it; nothing is downloaded).

import puppeteer from 'puppeteer-core';

const BASE = process.env.CHOMP_URL || 'http://localhost:8090/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const only = process.argv[2] || '';
const wait = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
const fails = [];
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log('  ok  ', name); } else { failed++; fails.push(name); console.log('  FAIL', name, detail); }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

// A fresh page with a clean save (or the given one), watching for errors.
async function page({ save = null, points = null, size = [1100, 700], phone = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: size[0], height: size[1], isMobile: phone, hasTouch: phone });
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|net::ERR/.test(m.text())) p.errors.push(m.text().slice(0, 200)); });
  await p.goto(BASE + 'about.html');                   // somewhere light, to set the save before the real page
  await p.evaluate((save, points) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('chomp-tips-off', '1'); localStorage.setItem('chomp-settings', JSON.stringify({ tips: false }));
    if (save) localStorage.setItem('chomp-progress', JSON.stringify(save));
    if (points) localStorage.setItem('chomp-points', JSON.stringify(points));
  }, save, points);
  p.done = () => ctx.close();
  return p;
}
// Open a page and wait for it: until the game has loaded (its models can take a while over the
// internet), then a moment more for it to settle.
const go = async (p, url, ms = 7000) => {
  await p.goto(BASE + url);
  await p.waitForFunction(() => window.chomp || !document.querySelector('script[src*="js/levels/"], script[src*="js/main.js"]'), { timeout: 90000 }).catch(() => {});
  await wait(ms);
};
const store = (p, key) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---- Regression: every page loads clean, desktop and phone ------------------------------------
const PAGES = ['index.html?noopening', 'cane.html?all&play', 'esplanade.html?all&play', 'reef.html?all&play', 'kuranda.html?all&play',
  'zipline.html?all&play', 'boomerang.html?all&play', 'mossman.html?all&play', 'daintree.html?all&play', 'train.html?play', 'skyrail.html?play',
  'rescue.html?all&play', 'coast.html?play', 'push.html?play', 'ending.html', 'guide.html', 'about.html'];
test('every page loads without errors (desktop)', async () => {
  const p = await page();
  for (const u of PAGES) { p.errors = []; await go(p, u, 6000); check(`desktop: ${u}`, !p.errors.length, p.errors.join(' | ')); }
  await p.done();
});
test('every page loads without errors (phone, touch)', async () => {
  const p = await page({ size: [390, 844], phone: true });
  for (const u of PAGES) { p.errors = []; await go(p, u, 6000); check(`phone: ${u}`, !p.errors.length, p.errors.join(' | ')); }
  await p.done();
});

// ---- One currency (edge: old saves) --------------------------------------------------------------
test('an old save with tokens and gold opens as Golden Mangoes', async () => {
  const p = await page({ save: { unlocked: ['park'], mangoes: 2, tokens: 3, coins: 4 } });
  await go(p, 'index.html?noopening', 4000);
  const s = await p.evaluate(async () => (await import('./js/progress.js')).readProgress(localStorage.getItem('chomp-progress')));
  check('tokens and gold became mangoes (2 + 3 + 4)', s.mangoes === 9 && s.tokens === 0 && s.coins === 0, JSON.stringify({ m: s.mangoes, t: s.tokens, c: s.coins }));
  await p.done();
});

// ---- Outfits and hats stick (happy) ------------------------------------------------------------
test('a hat and an outfit bought stay on in another area', async () => {
  const p = await page({ save: { unlocked: ['park'], mangoes: 0, wardrobe: { owned: ['classic', 'reef', 'vest-ranger', 'own', 'cork'], wear: { wally: 'reef', kenny: 'vest-ranger', hat: 'cork' } } } });
  for (const u of ['cane.html?all&play', 'mossman.html?all&play', 'coast.html?play']) {
    await go(p, u, 7000);
    const hat = await p.evaluate(() => { let h = null; window.chomp.wally.skin.root.traverse(o => { if (o.name === 'WallyHat') h = o.userData.hat; }); return h; });
    check(`the cork hat is on in ${u.split('.')[0]}`, hat === 'cork', String(hat));
  }
  await p.done();
});
test('the shop: a hat bought with mangoes is worn and saved; with none, it cannot be bought', async () => {
  const p = await page({ save: { unlocked: ['park'], mangoes: 50 } });
  await go(p, 'index.html?noopening', 5000);
  await p.evaluate(() => document.querySelector('.shop-button').click()); await wait(3000);
  await p.evaluate(() => [...document.querySelectorAll('.shop-grid[data-who="hat"] .shop-item')].find(x => x.textContent.includes('Top hat')).click()); await wait(800);
  await p.evaluate(() => [...document.querySelectorAll('.shop-detail button')].find(b => /Buy/.test(b.textContent)).click()); await wait(800);
  const s = await store(p, 'chomp-progress');
  check('bought and worn: mangoes 50 - 30, the top hat on', s.mangoes === 20 && s.wardrobe.wear.hat === 'tophat', JSON.stringify({ m: s.mangoes, w: s.wardrobe && s.wardrobe.wear }));
  await p.evaluate(() => [...document.querySelectorAll('.shop-grid[data-who="hat"] .shop-item')].find(x => x.textContent.includes('Crown')).click()); await wait(500);
  const crown = await p.evaluate(() => document.querySelector('.shop-detail').textContent);
  check('the crown is won, not sold', /Not for sale/.test(crown), crown.slice(0, 80));
  await p.evaluate(() => [...document.querySelectorAll('.shop-grid[data-who="hat"] .shop-item')].find(x => x.textContent.includes('Bush hat') && !x.textContent.includes('Golden')).click()); await wait(500);
  const poor = await p.evaluate(() => { const b = [...document.querySelectorAll('.shop-detail button')].find(b => /Buy/.test(b.textContent)); return b ? b.disabled : null; });
  check('with 20 mangoes a 15 hat can be bought (enabled)', poor === false, String(poor));
  await p.done();
});

// ---- Where to go next ---------------------------------------------------------------------------
const trip = (visits = {}) => ({ difficulty: 'easy', completed: [], items: {}, visits, entered: [] });
test('the arrow shows on a first visit and not on a return visit', async () => {
  let p = await page({ save: { unlocked: ['park'], trip: trip() } });
  await go(p, 'kuranda.html?all&play', 8000);
  let a = await p.evaluate(() => { const e = document.getElementById('arrow'); return e && !e.hidden ? e.textContent : null; });
  check('first visit: the arrow points somewhere', !!a, String(a));
  await p.done();
  p = await page({ save: { unlocked: ['park'], trip: trip({ kuranda: 1 }) } });
  await go(p, 'kuranda.html?all&play', 8000);
  a = await p.evaluate(() => { const e = document.getElementById('arrow'); return e && !e.hidden ? e.textContent : null; });
  check('return visit (harder): no arrow', a === null, String(a));
  await p.done();
});

test('Croc Park first visit is gentle and builds; a return visit is not', async () => {
  let p = await page({ save: { unlocked: ['park'], trip: trip() } });
  await go(p, 'index.html?noopening', 5000);
  await p.evaluate(() => window.chompStartHere()); await wait(1500);
  const shown = () => p.evaluate(() => ({ pel: window.chomp.pelicans.list.length, toad: window.chomp.toads.list.length,
    croc: window.chomp.crocs.list.filter(c => !c.guard).length, guard: window.chomp.crocs.list.some(c => c.guard),
    need: window.chomp.game.quest.goals[0].need, drain: window.chomp.game.tripDrain }));
  let s = await shown();
  check('first visit: six groups, slow drain, no thieves yet, the treasure guard still there', s.need === 6 && s.drain <= 0.4 && s.pel === 0 && s.toad === 0 && s.croc === 0 && s.guard, JSON.stringify(s));
  await p.evaluate(() => { const q = window.chomp.game.quest; q.record('groupDone'); q.record('groupDone'); q.record('groupDone'); });
  await p.waitForFunction(() => window.chomp.pelicans.list.length > 0, { timeout: 15000 }).catch(() => {}); await wait(500);   // after the start-of-level moment
  s = await shown();
  check('after three groups: pelicans, toads and a croc have turned up', s.pel === 2 && s.toad >= 1 && s.croc === 1, JSON.stringify(s));
  check('no errors on the first visit', !p.errors.length, p.errors.join(' | '));
  await p.done();
  p = await page({ save: { unlocked: ['park'], trip: trip({ park: 1 }) } });
  await go(p, 'index.html?noopening', 5000);
  await p.evaluate(() => window.chompStartHere()); await wait(1500);
  s = await shown();
  check('return visit: all eight groups and every thief from the start', s.need === 8 && s.pel >= 1 && s.toad >= 1 && s.croc === 3, JSON.stringify(s));
  await p.done();
});

test('phone: the pad bottom turns Wally round; Duck sits by the backpack; no Cam button', async () => {
  const p = await page({ save: { unlocked: ['park'], trip: trip({ park: 1 }) }, size: [844, 390], phone: true });
  await go(p, 'index.html?noopening', 5000);
  await p.evaluate(() => window.chompStartHere());
  await p.waitForFunction(() => window.chomp.game.intro <= 0 && document.querySelector('#dpad .pad-down').getBoundingClientRect().width > 0, { timeout: 20000 }).catch(() => {}); await wait(500);
  const before = await p.evaluate(() => window.chomp.wally.facing);
  const r = await p.evaluate(() => { const e = document.querySelector('#dpad .pad-down').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; });
  await p.touchscreen.tap(r.x, r.y); await wait(1500);
  const turned = Math.abs(await p.evaluate(() => window.chomp.wally.facing) - before) / Math.PI;
  check('one tap turns him right round (half a circle)', Math.abs(turned - 1) < 0.1, turned.toFixed(2));
  const v = await p.evaluate(() => {
    const box = e => { if (!e) return null; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && !e.hidden && r.width > 0 ? r : null; };
    const duck = box(document.getElementById('t-fours')), gear = box(document.querySelector('.gear-badge')), pad = box(document.getElementById('dpad'));
    return { cam: !!box(document.getElementById('t-cam')), duck: !!duck, besideGear: !!(duck && gear && duck.left > gear.left && duck.left < pad.left && Math.abs(duck.bottom - gear.bottom) < 40) };
  });
  check('no Cam button on a phone', !v.cam, JSON.stringify(v));
  check('Duck shows on land, beside the backpack, away from the pad', v.duck && v.besideGear, JSON.stringify(v));
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  check('no errors', !p.errors.length, p.errors.join(' | '));
  await p.done();
});

test('VR: the button shows only with a headset, and waits for play to start', async () => {
  let p = await page({ save: { unlocked: ['park'], trip: trip({ park: 1 }) } });
  await go(p, 'index.html?noopening', 5000);
  check('no headset: no VR button', !(await p.$('.vr-button')));
  await p.done();
  p = await page({ save: { unlocked: ['park'], trip: trip({ park: 1 }) } });
  await p.evaluateOnNewDocument(() => {                       // a pretend headset: supported, but no real session
    Object.defineProperty(navigator, 'xr', { value: { isSessionSupported: async () => true, requestSession: async () => { throw new Error('no headset here'); } } });
  });
  await go(p, 'index.html?noopening', 5000);
  await p.evaluate(() => window.chompStartHere()); await wait(3000);
  const shown = await p.evaluate(() => { const b = document.querySelector('.vr-button'); return !!b && getComputedStyle(b).display !== 'none'; });
  check('with a headset: the VR button shows during play', shown);
  await p.evaluate(() => document.querySelector('.vr-button').click()); await wait(800);
  const said = await p.evaluate(() => document.getElementById('toasts').textContent);
  check('a headset that will not start says so, and the game carries on', /VR could not start/.test(said), said.slice(0, 120));
  check('still playing after the failed start', await p.evaluate(() => window.chomp.game.running && !window.chomp.game.paused));
  check('no errors', !p.errors.length, p.errors.join(' | '));
  await p.done();
  p = await page({ save: { unlocked: ['park'], trip: trip({ kuranda: 0 }) } });
  await p.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'xr', { value: { isSessionSupported: async () => true, requestSession: async () => { throw new Error('x'); } } }));
  await go(p, 'cane.html?all&play', 7000);
  check('a level page gets the VR button too, without errors', !!(await p.$('.vr-button')) && !p.errors.length, p.errors.join(' | '));
  await p.done();
});

// ---- A whole area, start to finish (happy) and failing it (unhappy) ------------------------------
async function playMossman(p) {
  return p.evaluate(async () => {
    const M = await import('./js/levels/mossman-rules.js'), c = window.chomp, w = c.wally;
    const to = (x, z) => { w.pos.x = x; w.pos.z = z; };
    const until = async (ok, ms = 8000) => { const t0 = performance.now(); while (!ok() && performance.now() - t0 < ms) await new Promise(r => setTimeout(r, 100)); };
    c.dive.depth = 1.5; to(c.keySpot.x, c.keySpot.z); await until(() => c.game.hasKey);          // held there until each thing is done (a busy machine is slow)
    to(c.chestSpot.x, c.chestSpot.z); await until(() => { c.dive.depth = 1.5; to(c.chestSpot.x, c.chestSpot.z); return c.game.talisman; });
    c.dive.depth = 0; to(M.riverX(M.FINISH_Z + 2), M.FINISH_Z + 2); await until(() => c.result, 10000);
    return { won: c.result && c.result.won, hasKey: c.game.hasKey, talisman: c.game.talisman };
  });
}
test('Mossman Gorge: key, chest, out: completed, points banked, on the board', async () => {
  const p = await page({ save: { unlocked: ['park'], trip: trip() } });
  await go(p, 'mossman.html?all&play&stay', 8000);
  const r = await playMossman(p);
  check('the key and the opal found', r.hasKey && r.talisman, JSON.stringify(r));
  check('the area is completed', r.won === true, JSON.stringify(r));
  const book = await store(p, 'chomp-points');
  check('its points are banked (the key, the talisman, the completion)', book && book.areas.mossman >= 5 + 1 + 3, JSON.stringify(book));
  check('the personal best is set without finishing the game', book && book.best === book.areas.mossman);
  check('the area leaderboard shows on the end card', await p.evaluate(() => !!document.querySelector('#board .board-title')));
  check('no errors on the way', !p.errors.length, p.errors.join(' | '));
  await p.done();
});
test('Mossman Gorge: out of puff with no lives: nothing kept, no points', async () => {
  const p = await page({ save: { unlocked: ['park'], trip: trip() } });
  await go(p, 'mossman.html?all&play&stay', 8000);
  await p.evaluate(() => { const c = window.chomp; c.dive.depth = 1.5; c.wally.pos.x = c.keySpot.x; c.wally.pos.z = c.keySpot.z; });
  await wait(700);
  await p.evaluate(() => { const g = window.chomp.game; g.lives = 1; g.energy = 0; });
  await wait(6000);
  const r = await p.evaluate(() => window.chomp.result);
  check('the run is lost', r && r.won === false, JSON.stringify(r));
  const book = await store(p, 'chomp-points');
  check('a failed first run keeps no points', !book || book.areas.mossman == null, JSON.stringify(book));
  await p.done();
});
test('going back to a completed area: pickups count, capped, without completing again', async () => {
  const p = await page({ save: { unlocked: ['park'], trip: trip({ mossman: 1 }) }, points: { areas: { mossman: 20 }, extras: {}, best: 20, trips: 0 } });
  await go(p, 'mossman.html?all&play&stay', 8000);
  await p.evaluate(async () => { const c = window.chomp, t0 = performance.now(); while (!c.game.hasKey && performance.now() - t0 < 8000) { c.dive.depth = 1.5; c.wally.pos.x = c.keySpot.x; c.wally.pos.z = c.keySpot.z; await new Promise(r => setTimeout(r, 100)); } });
  await p.goto(BASE + 'about.html'); await wait(800);  // leaving partway (the map, a closed tab)
  const book = await store(p, 'chomp-points');
  check('the key picked up on the revisit counts, at hard (x2)', book && book.extras.mossman === 2, JSON.stringify(book));
  check('the trip score and best include it', book && book.best === 22, JSON.stringify(book));
  await p.done();
});

// ---- The finale: beat game, coast, auto-start --------------------------------------------------
test('the Great Push: pressing on the beat floats the boat; missing it does not', async () => {
  const p = await page();
  await go(p, 'push.html?play&stay', 7000);
  await p.evaluate(() => { const c = window.chomp; for (const w of c.wild) w.called = true; const s = c.stern(); c.wally.pos.x = s.x; c.wally.pos.z = s.z; });
  await wait(2000);
  check('the push begins at the stern with every croc', await p.evaluate(() => window.chomp.game.phase) === 'push');
  check('the beat arrow is there', await p.evaluate(() => !!document.querySelector('.push-meter .push-arrow')));
  const before = await p.evaluate(() => window.chomp.boat.moved);
  await wait(4000);
  const idle = await p.evaluate(() => window.chomp.boat.moved);
  check('no presses: the boat does not move', idle <= before + 1e-6, `${before} -> ${idle}`);
  const out = await p.evaluate(async () => {
    const R = await import('./js/levels/push-rules.js'), c = window.chomp;
    const t0 = performance.now(); let last = -1;
    while (performance.now() - t0 < 40000 && c.game.phase === 'push') {
      const e = R.offBeat(c.game.beatT), b = R.beatOf(c.game.beatT);
      if (Math.abs(e) < 0.04 && b !== last) { last = b; dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); }
      await new Promise(r => requestAnimationFrame(r));
    }
    return { phase: c.game.phase, perfect: c.game.perfect, heaves: c.game.heaves };
  });
  check('on the beat: she floats', out.phase === 'afloat' || out.phase === 'done' || (await p.evaluate(() => !!window.chomp.result)), JSON.stringify(out));
  check('the presses counted as heaves', out.heaves >= 3, JSON.stringify(out));
  await p.done();
});
test('up the coast: swimming straight on reaches the river mouth in about a minute', async () => {
  const p = await page();
  await go(p, 'coast.html?play&stay', 6000);
  await p.keyboard.down('KeyW');
  const t0 = Date.now(); let r = null;
  while (Date.now() - t0 < 90000 && !(r = await p.evaluate(() => window.chomp.result))) await wait(2000);
  await p.keyboard.up('KeyW');
  const secs = (Date.now() - t0) / 1000;
  check('the swim ends at the mouth (no dead stop on the way)', !!(r && r.won), JSON.stringify(r));
  check('in about a minute (under 80 s)', secs < 80, `${secs.toFixed(0)} s`);
  await p.done();
});
test('mid-story pages start by themselves (?go), no Play click', async () => {
  const p = await page();
  for (const u of ['rescue.html?go&nointro', 'coast.html?go&nointro', 'push.html?go&nointro']) {
    await go(p, u, 6000);
    check(`${u.split('.')[0]} is running`, await p.evaluate(() => window.chomp.game.running === true));
  }
  await p.done();
});

// ---- Unhappy: an area that is not open yet ----------------------------------------------------
test('the Daintree will not start without the six talismans', async () => {
  const p = await page({ save: { unlocked: ['park'], trip: trip() } });
  await go(p, 'daintree.html', 6000);
  await p.evaluate(() => document.getElementById('play').click()); await wait(1500);
  const r = await p.evaluate(() => ({ running: window.chomp.game.running, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ') }));
  check('it does not start', !r.running, JSON.stringify(r));
  check('and says why', /six talismans/.test(r.toast), r.toast);
  check('the Be Crocwise line is on the title card', await p.evaluate(() => /Never feed a real crocodile/.test(document.getElementById('title').textContent)));
  await p.done();
});

// ---- The Scoreboard -----------------------------------------------------------------------------
test('the Scoreboard opens, shows the trip by area and switches boards', async () => {
  const p = await page({ points: { areas: { park: 12, cane: 30 }, extras: { cane: 4 }, best: 46, trips: 0 } });
  await go(p, 'cane.html?all', 5000);
  await p.evaluate(() => document.querySelector('.score-button').click()); await wait(1200);
  const t = await p.evaluate(() => document.querySelector('.score-card').textContent);
  check('the trip total and the personal best', /This trip\s*46/.test(t) && /Personal best\s*46/.test(t), t.slice(0, 120));
  check('an area with revisit extras shows them', /34 \(\+4 going back\)/.test(t));
  await p.evaluate(() => [...document.querySelectorAll('.score-tab')].find(b => b.dataset.id === 'reef').click()); await wait(1200);
  check('the reef tab is chosen and a board is drawn', await p.evaluate(() => document.querySelector('.score-tab.on').dataset.id === 'reef' && !!document.querySelector('.score-board .board-title')));
  await p.done();
});

// ---- The map and the cards: a clear way back -------------------------------------------------
test('the front screen is the title: one Play button, and it starts the game', async () => {
  const p = await page();
  await go(p, 'index.html', 3000);
  const t = await p.evaluate(() => ({ title: !document.getElementById('title').hidden, landing: !!document.getElementById('landing'), plays: [...document.querySelectorAll('button')].filter(b => b.offsetParent && /^\s*play\s*$/i.test(b.textContent)).length, text: document.getElementById('title').textContent }));
  check('it opens on the title, with no page before it', t.title && !t.landing);
  check('exactly one Play button', t.plays === 1, String(t.plays));
  check('How to play and where it begins are there', /How to play/.test(t.text) && /Begin at Croc Park in Cairns, Australia/.test(t.text));
  check('no in-game buttons over it', await p.evaluate(() => [...document.querySelectorAll('.paws-button, .sceptre-button, .score-button')].every(b => getComputedStyle(b).display === 'none')));
  await p.evaluate(() => document.getElementById('play').click());
  let running = false; for (let i = 0; i < 40 && !running; i++) { await wait(1000); running = await p.evaluate(() => !!(window.chomp && window.chomp.game && window.chomp.game.running)); }
  check('Play goes straight into the game', running);
  await p.done();
});
test('the map stays away until the first level is complete', async () => {
  const p = await page({ save: { unlocked: ['park'], trip: { difficulty: 'easy', completed: [], items: {}, visits: {}, entered: [] } } });
  await go(p, 'cane.html?all', 5000);
  check('a new game: no Map button yet (one less before play)', await p.evaluate(() => { const b = document.querySelector('.trip-map-button'); return !!b && b.hidden; }));
  await p.done();
});
test('the map names the level on its button and has Back to the game; so do the other cards', async () => {
  const p = await page({ save: { unlocked: ['park', 'cane'], mangoes: 5, trip: { difficulty: 'easy', completed: ['park'], items: {}, visits: { park: 1 }, entered: ['park'] } } });
  await go(p, 'cane.html?all', 5000);
  await p.evaluate(() => document.querySelector('.map-button').click()); await wait(800);
  const btns = await p.evaluate(() => [...document.querySelectorAll('.map-modal:not([hidden]) button.go')].map(b => b.textContent));
  check('the level and its name on the button', btns.some(t => /Level 2: The Cane Fields/.test(t)), JSON.stringify(btns));
  check('Back to the game on the map', btns.includes('Back to the game'));
  await p.evaluate(() => [...document.querySelectorAll('.map-modal:not([hidden]) button.go')].find(b => b.textContent === 'Back to the game').click()); await wait(400);
  check('and it closes the map', await p.evaluate(() => [...document.querySelectorAll('.map-modal')].every(m => m.hidden)));
  for (const [btn, name] of [['.sceptre-button', 'sceptre card'], ['.score-button', 'Scoreboard']]) {
    await p.evaluate(s => document.querySelector(s).click(), btn); await wait(800);
    const ok = await p.evaluate(() => [...document.querySelectorAll('.map-modal:not([hidden]) button')].some(b => b.textContent === 'Back to the game'));
    check(`Back to the game on the ${name}`, ok);
    await p.evaluate(() => [...document.querySelectorAll('.map-modal:not([hidden]) button')].find(b => b.textContent === 'Back to the game').click()); await wait(300);
  }
  await p.done();
});

test('regression: the map that opens on arrival, closed with the X, brings back the title screen', async () => {
  for (const how of ['X', 'Back to the game', 'outside']) {
    const p = await page({ save: { unlocked: ['park'], trip: { difficulty: 'easy', completed: [], items: {}, visits: {}, entered: [] } } });
    await go(p, 'index.html?map', 6000);
    check(`(${how}) the map is open on arrival`, await p.evaluate(() => [...document.querySelectorAll('.map-modal')].some(m => !m.hidden)));
    await p.evaluate(how => { const m = [...document.querySelectorAll('.map-modal')].find(m => !m.hidden);
      if (how === 'X') m.querySelector('.map-close').click(); else if (how === 'outside') m.click(); else [...m.querySelectorAll('button')].find(b => b.textContent === 'Back to the game').click(); }, how);
    await wait(800);
    check(`(${how}) closed: the title screen is back, ready for Play`, await p.evaluate(() => !document.getElementById('title').hidden));
    await p.done();
  }
});

// ---- The feedback and takedown form ----------------------------------------------------------
test('the feedback form: sends a message; refuses an empty one, a takedown with no email, and robots', async () => {
  if (!/localhost|127[.]0[.]0[.]1/.test(BASE)) { console.log('  (skipped on the hosted site: it would email Ken)'); return; }
  const { readFileSync, existsSync } = await import('node:fs');
  const log = new URL('../feedback.log', import.meta.url);
  const before = existsSync(log) ? readFileSync(log, 'utf8').length : 0;
  const p = await page();
  await go(p, 'feedback.html?from=e2e', 2500);
  check('the form page shows no email address', await p.evaluate(() => !/@gmail|mailto:/.test(document.documentElement.innerHTML)));
  await p.click('#send'); await wait(400);
  check('an empty message is refused, with a reason', /few words/.test(await p.$eval('#status', e => e.textContent)));
  await p.select('#kind', 'takedown'); await p.type('#message', 'This is my photograph.'); await p.click('#send'); await wait(400);
  check('a takedown with no reply email is refused', /email/.test(await p.$eval('#status', e => e.textContent)));
  await p.select('#kind', 'feedback'); await p.type('#name', 'E2E test'); await p.click('#send'); await wait(1500);
  check('a good message is sent', /Sent/.test(await p.$eval('#status', e => e.textContent)));
  const after = existsSync(log) ? readFileSync(log, 'utf8') : '';
  check('and it arrives (here, the local feedback.log)', after.length > before && after.slice(before).includes('E2E test') && after.slice(before).includes('Page: e2e'));
  const bot = await p.evaluate(async () => (await fetch('api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'feedback', message: 'Buy cheap pills now', website: 'http://spam' }) })).json());
  const after2 = readFileSync(log, 'utf8');
  check('a robot that fills the hidden field is told ok, and nothing is kept', bot.ok === true && !after2.includes('cheap pills'));
  const bad = await p.evaluate(async () => (await fetch('api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' })).status);
  check('a broken request is refused', bad === 400, String(bad));
  await p.done();
});

// ---- Run --------------------------------------------------------------------------------------
try { const r = await fetch(BASE + 'index.html'); if (!r.ok) throw new Error(r.status); }
catch { console.log(`The game server is not running at ${BASE}: start it with node serve.mjs`); await browser.close(); process.exit(1); }
for (const t of tests) {
  if (only && !t.name.includes(only)) continue;
  console.log(t.name);
  try { await t.fn(); } catch (e) { failed++; fails.push(t.name); console.log('  FAIL (threw)', e.message); }
}
await browser.close();
console.log(`\n${passed} passed, ${failed} failed${fails.length ? '\n  ' + fails.join('\n  ') : ''}`);
process.exit(failed ? 1 : 0);
