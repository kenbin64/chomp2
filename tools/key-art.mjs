// Renders the key art (tools/key-art.html) to screens/promo: wide 1920x1080 and square 1080x1080.
//   node tools/key-art.mjs
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files'] });

const src = 'file:///C:/projects/chomp-3d/tools/key-art.html';
for (const [h, w, ht, out] of [['', 1920, 1080, 'chomp-3d-key-art-wide.png'], ['#square', 1080, 1080, 'chomp-3d-key-art-square.png']]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: ht }); await p.goto(src + h); await p.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 1500));
  await p.screenshot({ path: 'C:/projects/chomp-3d/screens/promo/' + out }); await p.close();
}
await b.close();
