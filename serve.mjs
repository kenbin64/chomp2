// serve.mjs
// Runs the game on this computer:  node serve.mjs   then open http://localhost:8090
// The game uses JavaScript modules, which browsers will not load from a file on
// disk, so it needs to be served, even locally. Add --lan to let a phone on the
// same Wi-Fi open it at this computer's address.

import { createServer } from 'node:http';
import { createReadStream, statSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { LEVELS, cleanName, validScore, addScore } from './js/leaderboard-rules.js';
import { checkFeedback, emailText } from './js/feedback-rules.js';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8090);
const lan = process.argv.includes('--lan');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json' };

// The leaderboard, kept in scores.json beside the game (Ken, 2026-10-17). The
// same rules as an online one would use (js/leaderboard-rules.js).
const SCORES = join(root, 'scores.json');
function loadScores() { try { return JSON.parse(readFileSync(SCORES, 'utf8')); } catch { return {}; } }
function leaderboard(req, res, url) {
  const send = (code, body) => res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }).end(JSON.stringify(body));
  const level = url.searchParams.get('level');
  if (!LEVELS.includes(level)) return send(400, { error: 'unknown level' });
  const all = loadScores();
  if (req.method === 'GET') return send(200, { board: all[level] || [] });
  if (req.method !== 'POST') return send(405, { error: 'GET or POST' });
  let body = '';
  req.on('data', c => { body += c; if (body.length > 2000) req.destroy(); });
  req.on('end', () => {
    let entry;
    try { entry = JSON.parse(body); } catch { return send(400, { error: 'not JSON' }); }
    const name = cleanName(entry.name);
    if (!name) return send(400, { error: 'name' });
    if (!validScore(level, entry.score, entry.stars || 0)) return send(400, { error: 'score' });
    const r = addScore(all[level] || [], { name, score: entry.score, stars: entry.stars || 0 });
    all[level] = r.board;
    try { writeFileSync(SCORES, JSON.stringify(all, null, 1)); } catch { return send(500, { error: 'not saved' }); }
    send(200, { board: r.board, rank: r.rank, best: r.best, name });
  });
}

// The feedback and takedown form (js/feedback-rules.js). Here on this computer the messages go in
// feedback.log beside the game (never committed); on the hosted site they are emailed to Ken.
function feedback(req, res) {
  const send = (code, body) => res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }).end(JSON.stringify(body));
  if (req.method !== 'POST') return send(405, { error: 'POST' });
  let body = '';
  req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
  req.on('end', () => {
    let data; try { data = JSON.parse(body); } catch { return send(400, { error: 'not JSON' }); }
    const r = checkFeedback(data);
    if (!r.ok) return send(r.error === 'spam' ? 200 : 400, r.error === 'spam' ? { ok: true } : { error: r.error });   // a robot is told it worked
    const mail = emailText(r.entry);
    try { appendFileSync(join(root, 'feedback.log'), `${mail.subject}
${mail.text}
----
`); } catch { return send(500, { error: 'not saved' }); }
    send(200, { ok: true });
  });
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/api/scores') { leaderboard(req, res, url); return; }
  if (path === '/api/feedback') { feedback(req, res); return; }
  // The list of model and backdrop files present, so the game only asks for those.
  if (path === '/models/index.json' || path === '/backdrops/index.json') {
    const folder = path.split('/')[1];
    let list = [];
    try { list = readdirSync(join(root, folder)).filter(f => /\.(glb|png|jpg)$/.test(f)); } catch { /* no folder yet */ }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }).end(JSON.stringify(list));
    return;
  }
  const file = normalize(join(root, path === '/' ? 'index.html' : path));
  if (!file.startsWith(normalize(root))) { res.writeHead(403).end(); return; }      // stay inside the game folder
  let size;
  try { const st = statSync(file); if (!st.isFile()) throw new Error(); size = st.size; }
  catch { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': size, 'Cache-Control': 'no-cache' });
  if (req.method === 'HEAD') { res.end(); return; }      // a HEAD request asks only whether it exists
  createReadStream(file).pipe(res);
}).listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Chomp! is running: http://localhost:${port}`);
  if (lan) for (const list of Object.values(networkInterfaces())) for (const a of list) {
    if (a.family === 'IPv4' && !a.internal) console.log(`On a phone on the same Wi-Fi: http://${a.address}:${port}`);
  }
});
