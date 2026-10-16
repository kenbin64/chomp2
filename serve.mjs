// serve.mjs
// Runs the game on this computer:  node serve.mjs   then open http://localhost:8090
// The game uses JavaScript modules, which browsers will not load from a file on
// disk, so it needs to be served, even locally. Add --lan to let a phone on the
// same Wi-Fi open it at this computer's address.

import { createServer } from 'node:http';
import { createReadStream, statSync, readdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8090);
const lan = process.argv.includes('--lan');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json' };

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
