// In the water the view is Wally's own, level by level, and on land (or anywhere on the coast) it is not. In real Chrome.
// Needs the server: node serve.mjs. Pass a folder to keep the pictures.
import puppeteer from 'puppeteer-core';
const S = process.argv[2];
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, info = '') => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) failed++; };
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });

async function open(page) {
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 760 });
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  await p.goto('http://localhost:8090/about.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('chomp-tips-off', '1'); localStorage.setItem('chomp-settings', JSON.stringify({ tips: false })); });
  await p.goto(`http://localhost:8090/${page}`);
  await p.waitForFunction(() => window.chomp && window.chomp.wally, { timeout: 120000, polling: 250 }); await wait(5000);
  await p.evaluate(() => { if (window.chompStartHere) window.chompStartHere(); });
  await p.waitForFunction(() => window.chomp.game.running && !(window.chomp.game.intro > 0), { timeout: 40000, polling: 250 }).catch(() => {});
  await wait(1000);
  return p;
}
// Walks a grid until he is standing in the given surface. Returns where.
const findSurface = (p, want) => p.evaluate(async want => {
  const c = window.chomp, w = c.wally, frame = () => new Promise(r => requestAnimationFrame(r)), x0 = w.pos.x, z0 = w.pos.z;   // (the reef is a long way from the origin)
  for (const [ox, oz] of [[0, 0], [x0, z0]]) for (let dx = -100; dx <= 100; dx += 8) for (let dz = -100; dz <= 100; dz += 8) {
    const x = ox + dx, z = oz + dz;
    w.pos.set(x, 0.2, z); w.vel.set(0, 0, 0); await frame(); await frame();
    if (w.surface === want && Math.hypot(w.pos.x - x, w.pos.z - z) < 0.5) return { x, z };
  }
  return null;
}, want);
const state = p => p.evaluate(() => { const c = window.chomp, w = c.wally; return { seen: w.root.visible, surface: w.surface, running: c.game.running, tint: +(document.querySelector('.dive-tint')?.style.opacity || 0) }; });
const hold = (p, at, ms) => p.evaluate(async (at, ms) => { const w = window.chomp.wally, t0 = performance.now(); while (performance.now() - t0 < ms) { w.pos.x = at.x; w.pos.z = at.z; w.vel.set(0, 0, 0); await new Promise(r => requestAnimationFrame(r)); } }, at, ms);

// Water with room all round, so nothing but the steering decides where he goes: the start if that will do, else nearby.
const openWater = (p, R) => p.evaluate(async R => {
  const c = window.chomp, w = c.wally, { ground } = await import('/js/ground.js'), x0 = w.pos.x, z0 = w.pos.z;
  const open = (x, z) => [0, 1, 2, 3, 4, 5, 6, 7].every(i => {
    const a = i * Math.PI / 4;
    for (let d = 0; d <= R; d += 1.5) {
      const nx = x + Math.sin(a) * d, nz = z + Math.cos(a) * d;
      if (ground.stand(nx, nz, 0.2).surface !== 'water') return false;
      const m = ground.move(x, z, nx, nz, -0.45);
      if (Math.hypot(m.x - nx, m.z - nz) > 0.01) return false;
    }
    return true;
  });
  for (let r = 0; r < 200; r += 6) for (let i = 0; i < 16; i++) { const x = x0 + Math.sin(i / 8 * Math.PI) * r, z = z0 + Math.cos(i / 8 * Math.PI) * r; if (open(x, z)) return { x, z }; }
  return null;
}, R);
// Up is forward the way he faces, whichever way that is, in his own view as anywhere.
async function upIsForward(p, name) {
  const water = await openWater(p, 6) || await openWater(p, 4.5);      // (Mossman's pools are small)
  check(`${name}: open water to test in`, !!water, JSON.stringify(water));
  if (!water) return;
  await p.evaluate(at => { const w = window.chomp.wally; w.pos.set(at.x, 0.2, at.z); w.vel.set(0, 0, 0); }, water);
  await wait(1200);
  for (const f of [0, 1.57, 3.14, -1.57, 0.8]) {
    // Kept fed and in air: the search above is slow, and running out would have Kenny reviving him with the controls off.
    await p.evaluate((at, f) => { const c = window.chomp, w = c.wally, g = c.game; g.energy = 100; g.air = 100; w.pos.x = at.x; w.pos.z = at.z; w.vel.set(0, 0, 0); w.facing = f; }, water, f);
    await wait(500);
    const a = await p.evaluate(() => { const w = window.chomp.wally; return { x: w.pos.x, z: w.pos.z, f: w.facing }; });
    await p.keyboard.down('ArrowUp'); await wait(900); await p.keyboard.up('ArrowUp');
    const b = await p.evaluate(() => { const w = window.chomp.wally; return { x: w.pos.x, z: w.pos.z, f: w.facing }; });
    const d = Math.hypot(b.x - a.x, b.z - a.z), along = ((b.x - a.x) * Math.sin(a.f) + (b.z - a.z) * Math.cos(a.f)) / (d || 1);
    check(`${name}, facing ${f}: up goes forward`, d > 0.3 && along > 0.9, `${d.toFixed(1)} m, ${along.toFixed(2)} along`);
  }
}
{
  // The very start of the game: the cinematic is left alone, he is seen as a full croc, and only then the view is his.
  console.log('The opening');
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 760 });
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  await p.goto('http://localhost:8090/about.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('chomp-tips-off', '1'); localStorage.setItem('chomp-settings', JSON.stringify({ tips: false })); });
  await p.goto('http://localhost:8090/index.html?opening&play', { timeout: 90000 });
  await p.waitForFunction(() => window.chomp && window.chomp.opening && window.chomp.opening.active, { timeout: 120000, polling: 200 });
  const st = () => p.evaluate(() => { const c = window.chomp, o = c.opening; return { phase: o.phase, t: +o.phaseTime.toFixed(1), eyes: +(c.cam.eyes || 0).toFixed(2), seen: c.wally.root.visible, croc: !!o.croc.parent }; });
  await wait(2500);
  let q = await st(); check('during the cinematic: the view is left alone, and he is a regular croc', q.phase === 'intro' && q.eyes === 0 && q.seen && q.croc, JSON.stringify(q));
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.chomp.opening.phase === 'croc', { timeout: 15000, polling: 100 });
  await p.waitForFunction(() => window.chomp.opening.phaseTime > 1.5, { timeout: 30000, polling: 100 });
  q = await st(); check('then: seen as the full croc, swimming', q.phase === 'croc' && q.eyes === 0 && q.seen && q.croc, JSON.stringify(q));
  if (S) await p.screenshot({ path: `${S}/opening-croc.png` });
  await p.waitForFunction(() => window.chomp.cam.eyes > 0.9, { timeout: 40000, polling: 100 }).catch(() => {});
  q = await st(); check('and after a few seconds, the view is his own', q.eyes >= 0.9 && !q.seen && q.t > 4.5, JSON.stringify(q));
  if (S) await p.screenshot({ path: `${S}/opening-eyes.png` });
  check('no page errors', !p.errors.length, p.errors.slice(0, 2).join(' | '));
  await p.close();
}
{
  console.log('Croc Park');
  const p = await open('index.html?noopening');
  await p.evaluate(() => { const w = window.chomp.wally; w.pos.set(3, -0.45, -8); w.vel.set(0, 0, 0); });
  await hold(p, { x: 3, z: -8 }, 2500);
  await p.waitForFunction(() => !window.chomp.wally.root.visible, { timeout: 25000, polling: 100 }).catch(() => {});   // (on game time: a slow machine takes longer)
  const q = await state(p); check('in the lagoon: his own eyes', !q.seen, JSON.stringify(q));
  const nose = () => p.evaluate(() => { const c = window.chomp, g = c.scene.getObjectByName('snout-view'), w = c.wally; return { loaded: g.children.length > 0, seen: g.visible, level: g.rotation.x - (g.userData.rear || 0), off: Math.atan2(Math.sin(g.rotation.y - w.facing), Math.cos(g.rotation.y - w.facing)) }; });
  let n = await nose();
  check('his snout is there, level, pointing the way he faces', n.loaded && n.seen && Math.abs(n.level) < 0.01 && Math.abs(n.off) < 0.05, JSON.stringify(n));
  await p.evaluate(() => { const w = window.chomp.wally; w.facing = 2.2; window.chomp.eyes.chomp(0.3); });
  await p.waitForFunction(() => window.chomp.scene.getObjectByName('snout-view').userData.rear > 0.2, { timeout: 8000, polling: 'raf' }).catch(() => {});
  n = await nose(); check('eating: it rears up', n.level < -0.2, JSON.stringify(n));
  await wait(2500); n = await nose(); check('and snaps back down, level', Math.abs(n.level) < 0.01, JSON.stringify(n));
  // The back of the snout stays off the screen, at rest and at every moment of a bite (Ken, 2026-10-31).
  {
    const r = await p.evaluate(async () => {
      const THREE = await import('three'), c = window.chomp, g = c.scene.getObjectByName('snout-view'), v = new THREE.Vector3(), frame = () => new Promise(q => requestAnimationFrame(q));
      let mesh = null; g.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      const pos = mesh.geometry.attributes.position; mesh.geometry.computeBoundingBox(); const bb = mesh.geometry.boundingBox, cut = bb.min.z + (bb.max.z - bb.min.z) * 0.06;
      const back = []; for (let i = 0; i < pos.count; i++) if (pos.getZ(i) < cut) back.push(i);
      let seen = 0, tested = 0, topY = -9;
      const look = () => { c.camera.updateMatrixWorld(); mesh.updateMatrixWorld(true); for (const i of back.filter((_, n) => n % 3 === 0)) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(c.camera); tested++; topY = Math.max(topY, v.y); if (v.z < 1 && v.y > -1 && Math.abs(v.x) < 1) seen++; } };
      await frame(); look();
      for (const u of [0.05, 0.15, 0.3, 0.4, 0.45, 0.55, 0.7]) { c.eyes.chomp(u); await frame(); await frame(); look(); }
      return { seen, tested, topY: +topY.toFixed(2), points: back.length };
    });
    check('he is a whole croc: the far end of him never shows, at rest or in a bite', r.points > 0 && r.seen === 0, JSON.stringify(r));
  }
  // Turning the view with the mouse: he turns with it, and the back of the snout never comes into view.
  {
    const r = await p.evaluate(async () => {
      const c = window.chomp, g = c.scene.getObjectByName('snout-view'), wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), look = c.camera.position.clone();
      let worst = 0, off = 0; const t0 = performance.now(); let n = 0;
      while (performance.now() - t0 < 2500) {
        c.cam.manual = 1; c.cam.yaw += 0.15;                     // a big sweep of the mouse, every frame
        await new Promise(q => requestAnimationFrame(q)); n++;
        c.camera.getWorldDirection(look);
        worst = Math.max(worst, Math.abs(wrap(g.rotation.y - Math.atan2(look.x, look.z))));
        off = Math.max(off, Math.abs(wrap(c.wally.facing - (c.cam.yaw + Math.PI))));
      }
      c.cam.manual = 0; c.wally.facing = c.cam.yaw + Math.PI;     // an about-face, with the view left behind for a moment
      c.wally.facing += Math.PI; await new Promise(q => requestAnimationFrame(q));
      c.camera.getWorldDirection(look); worst = Math.max(worst, Math.abs(wrap(g.rotation.y - Math.atan2(look.x, look.z))));
      return { worst, off, frames: n };
    });
    check('sweeping the mouse: the snout stays pointing ahead, its back never in view', r.worst <= 0.31 && r.frames > 3, JSON.stringify(r));
    check('and he turns with the view', r.off < 0.2, JSON.stringify(r));
  }
  await upIsForward(p, 'Croc Park');
  check('no page errors', !p.errors.length, p.errors.slice(0, 2).join(' | '));
  await p.close();
}
for (const [name, page] of [['Esplanade', 'esplanade.html?all&play&stay'], ['Reef', 'reef.html?all&play&stay'], ['Mossman', 'mossman.html?all&play&stay'], ['Daintree', 'daintree.html?all&play&stay']]) {
  console.log(name);
  const p = await open(page);
  const land = await findSurface(p, 'land');
  if (land) { await hold(p, land, 1800); const q = await state(p); check('on land: he is in view', q.seen, JSON.stringify(q)); }
  const water = await findSurface(p, 'water');
  check('there is water to swim in', !!water, JSON.stringify(water));
  if (water) {
    await hold(p, water, 1800); const q = await state(p);
    check('in the water: his own eyes', !q.seen, JSON.stringify(q));
    if (S) await p.screenshot({ path: `${S}/eyes-${name}.png` });
  }
  await upIsForward(p, name);
  check('no page errors', !p.errors.length, p.errors.slice(0, 2).join(' | '));
  await p.close();
}
{
  console.log('Coral maze');
  const p = await open('reef.html?all&play&stay');
  const water = await findSurface(p, 'water');
  await p.evaluate(async at => { const c = window.chomp, w = c.wally, m = c.reef.mouth; const t0 = performance.now(); while (performance.now() - t0 < 2600) { c.game.depth = c.game.wantDepth = -3; w.pos.x = at.x; w.pos.z = at.z; w.vel.set(0, 0, 0); await new Promise(r => requestAnimationFrame(r)); } }, water);
  const q = await state(p); check('down in the coral: his own eyes', !q.seen, JSON.stringify(q));
  if (S) await p.screenshot({ path: `${S}/eyes-maze.png` });
  await p.close();
}
{
  console.log('Coast');
  const p = await open('coast.html?play');
  const water = await findSurface(p, 'water');
  if (water) await hold(p, water, 1800);
  const q = await state(p);
  check('up the coast he stays in view, the crocs lined up behind him', q.seen, JSON.stringify(q));
  await p.close();
}
{
  console.log('Zip line');
  const p = await open('zipline.html?all&free&play&stay');
  const before = await state(p);
  check('the ride has begun', before.running, JSON.stringify(before));
  await wait(2500);
  const q = await state(p);
  check('riding: his own eyes', q.running && !q.seen, JSON.stringify(q));
  if (S) await p.screenshot({ path: `${S}/eyes-zipline.png` });
  await p.evaluate(() => window.chomp.finish()); await wait(800);
  const after = await state(p);
  check('after the ride: he is back', after.seen, JSON.stringify(after));
  check('no page errors', !p.errors.length, p.errors.slice(0, 2).join(' | '));
  await p.close();
}
await b.close();
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
