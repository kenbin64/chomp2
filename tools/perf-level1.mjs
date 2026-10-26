// Measures Chomp level 1 (Croc Park) while the test pilot plays it. Changes nothing in the game.
//
//   node perf-level1.mjs <url> <seconds> <label>
//
// Per frame it records: the game code's own time (each requestAnimationFrame callback, timed from outside),
// the time between frames, and the draw calls sent to the GPU (counted by wrapping WebGL's draw functions).
// It also records the detail level at the start and the end, so a run where the game lowered its own detail
// is flagged instead of silently compared.
import puppeteer from 'puppeteer-core';
// Chrome's location on Windows; set CHROME to use another.
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [url, seconds = '30', label = 'run'] = process.argv.slice(2);

const b = await puppeteer.launch({ executablePath: CHROME, headless: false,
  args: ['--window-size=1300,800', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.setViewport({ width: 1280, height: 720 });
await p.evaluateOnNewDocument(() => {
  // Several callbacks can run in one screen frame (the game loop plus smaller loops); they all receive the same
  // frame timestamp. So work is added up per timestamp, and one screen frame is one entry.
  const M = window.__perf = { on: false, js: [], gap: [], draws: [], tris: [], cur: 0, curTris: 0, ts: null, fJs: 0, fDraws: 0, fTris: 0 };
  const flush = () => { if (M.on && M.ts !== null) { M.js.push(M.fJs); M.draws.push(M.fDraws); M.tris.push(M.fTris); } };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => {
    if (ts !== M.ts) { flush(); if (M.on && M.ts !== null) M.gap.push(ts - M.ts); M.ts = ts; M.fJs = 0; M.fDraws = 0; M.fTris = 0; }
    M.cur = 0; M.curTris = 0;
    const t0 = performance.now(); cb(ts); M.fJs += performance.now() - t0;
    M.fDraws += M.cur; M.fTris += M.curTris;
  });
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const orig = C.prototype[fn]; if (!orig) continue;
      C.prototype[fn] = function (...a) {
        M.cur++;
        const count = fn.startsWith('drawElements') ? a[1] : a[2], inst = fn.endsWith('Instanced') ? a[a.length - 1] : 1;
        if (a[0] === this.TRIANGLES) M.curTris += (count / 3) * inst;
        return orig.apply(this, a);
      };
    }
  }
});
await p.goto(url, { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => window.chomp && window.chomp.game, { timeout: 120000 });
await p.evaluate(() => { try { localStorage.setItem('chomp-progress', JSON.stringify({ trip: null, postcards: [], stars: {} })); } catch {} });
await new Promise(r => setTimeout(r, 3000));
await p.evaluate(() => document.getElementById('play').click());
await new Promise(r => setTimeout(r, 6000));                          // let the level load and settle
const q0 = await p.evaluate(() => window.chomp.quality().name);
await p.evaluate(() => { window.__perf.on = true; });
await new Promise(r => setTimeout(r, Number(seconds) * 1000));
const out = await p.evaluate(() => { const M = window.__perf; M.on = false; return { js: M.js, gap: M.gap, draws: M.draws, tris: M.tris, q1: window.chomp.quality().name, running: window.chomp.game.running }; });
await b.close();

const stat = a => { const s = [...a].sort((x, y) => x - y), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))]; return { mean: a.reduce((x, y) => x + y, 0) / a.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: s[s.length - 1] }; };
const js = stat(out.js), gap = stat(out.gap), draws = stat(out.draws), tris = stat(out.tris);
const r = { label, frames: out.js.length, fps: 1000 / gap.mean, stutters: out.gap.filter(g => g > 50).length, jsMs: js, drawCalls: draws, triangles: tris,
  detail: q0 === out.q1 ? q0 : `${q0} -> ${out.q1} (LOWERED: not comparable)`, playing: out.running, errors: errs };
console.log(JSON.stringify(r, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v, 1));
