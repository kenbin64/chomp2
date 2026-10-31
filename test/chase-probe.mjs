// Chase probe (Ken, 2026-10-29): the break-out from Croc Park in a real browser. Out of the gate, the
// catcher comes running; standing still, Wally is caught and put back inside the gate without losing a
// life; he cannot get back into the croc enclosure or past the outer fence; and the machete at the way
// out to the cane fields ends the level.
//   node serve.mjs   then   node test/chase-probe.mjs [screenshot-folder]
import puppeteer from 'puppeteer-core';
const BASE = process.env.CHOMP_URL || 'http://localhost:8090/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = process.argv[2] || '';
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(ok ? '  ok  ' : '  FAIL', name, detail); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const p = await browser.newPage(); await p.setViewport({ width: 1280, height: 760 });
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(BASE + 'about.html');
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('chomp-tips-off', '1'); localStorage.setItem('chomp-settings', JSON.stringify({ tips: false })); });
await p.goto(BASE + 'index.html?play&chase&noopening');
await p.waitForFunction(() => window.chomp && window.chomp.catcher && window.chomp.game.running, { timeout: 90000, polling: 250 });
await p.waitForFunction(() => window.chomp.game.intro <= 0, { timeout: 30000, polling: 250 });
const shot = async name => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png` }); };
const st = () => p.evaluate(() => { const c = window.chomp; return { out: c.game.out, mode: c.catcher.mode, cx: c.catcher.pos.x, cz: c.catcher.pos.z, wx: c.wally.pos.x, wz: c.wally.pos.z, lives: c.game.lives, caught: c.game.caught || 0, model: !!c.catcher.skin }; });

let s = await st();
check("the wrangler model is loaded", s.model);
check('Wally is out, and the catcher heard the gate', s.out && (s.mode === 'search' || s.mode === 'chase'), JSON.stringify(s));
const lives0 = s.lives;
// Stand still: he comes, sees, and catches.
let seen = false;
for (let i = 0; i < 200; i++) { await wait(250); s = await st(); if (s.mode === 'chase') seen = true; if (s.caught) break; if (seen && i % 8 === 0) await shot('chase-' + i); }
check('he spots Wally', seen);
check('he catches a Wally who stands still', s.caught === 1, JSON.stringify(s));
check('caught: back inside the gate, not outside', !s.out && s.wx < 35.5 && Math.abs(s.wz - 2) < 1, `${s.wx.toFixed(1)}, ${s.wz.toFixed(1)}`);
check('caught: no life lost', s.lives === lives0, `${lives0} -> ${s.lives}`);

// Out again, then try to walk back into the enclosure, and out past the outer fence.
// (Inside the gate, the only way out is along the boardwalk: put him on it, past the croc fence.)
await p.evaluate(async () => { const { deckHeight } = await import('./js/rules.js'); window.chomp.wally.pos.set(43.5, deckHeight(43.5), 2); });
await wait(400);
await p.evaluate(() => window.chomp.wally.pos.set(50, 0.35, 8));      // and off it onto the grass
await wait(200);
s = await st();
check('stepping out again: outside', s.out, JSON.stringify(s));
const tryMove = (x, z) => p.evaluate(async (x, z) => { const { ground } = await import('./js/ground.js'); const w = window.chomp.wally; return ground.move(w.pos.x, w.pos.z, x, z, w.pos.y); }, x, z);
const back = await tryMove(20, 4);                       // a step to the bank inside the fence
const offs = await p.evaluate(async (x, z) => (await import('./js/rules.js')).fenceOffset(x, z), back.x, back.z);
check('he cannot get back inside the croc fence', offs >= 0.55, offs.toFixed(2));
const past = await tryMove(120, 8);
const od = await p.evaluate(async (x, z) => (await import('./js/chase-rules.js')).outerDistance(x, z), past.x, past.z);
check('he cannot get past the outer fence', od < 1, od.toFixed(3));

// The way out: the machete there ends the level, won.
await p.evaluate(async () => { const { EXIT_SPOT } = await import('./js/chase-rules.js'); const c = window.chomp; c.catcher.reset(); c.wally.pos.set(EXIT_SPOT.x + 3, 0.35, EXIT_SPOT.z - 3); c.cam.yaw = -0.9; c.cam.pitch = 0.25; c.cam.dist = 12; c.cam.manual = 99; });
await wait(900); await shot('exit');
await p.evaluate(async () => { const { EXIT_SPOT } = await import('./js/chase-rules.js'); window.chomp.wally.pos.set(EXIT_SPOT.x, 0.35, EXIT_SPOT.z); });
await wait(1500);
const won = await p.evaluate(() => !window.chomp.game.running && !document.getElementById('win').hidden);
check('the machete at the way out ends the level, won', won);
check('no page errors', !errors.length, errors.join(' | '));
await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
