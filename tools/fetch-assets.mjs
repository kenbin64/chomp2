// fetch-assets.mjs
// Downloads the realistic sky and surface pictures the game uses when they are
// present (it falls back to its own painted ones when they are not).
// Everything comes from Poly Haven or ambientCG, both CC0: free to use for
// anything, no credit required (credited in assets/CREDITS.md anyway).
//   node tools/fetch-assets.mjs
import { mkdir, writeFile, stat, readdir, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = fileURLToPath(new URL('../assets/', import.meta.url));

// Sky: the HDR lights and reflects the scene; the JPG is what you see behind it.
const SKY = 'kloofendal_48d_partly_cloudy_puresky';

// Surface name in the game -> [library, texture]. Chosen by eye from contact
// sheets for a sunny Cairns look: lush green, light sand, warm boards.
const SURFACES = {
  grass: ['ambientcg', 'Grass006'],
  sand: ['polyhaven', 'dense_sand'],
  planks: ['polyhaven', 'hinoki_planks'],
  rock: ['polyhaven', 'rock_boulder_dry'],
  paving: ['polyhaven', 'concrete_floor'],
  palm: ['polyhaven', 'palm_tree_bark'],
};
// The three maps each surface needs: colour, bumps (normal) and shininess (roughness).
const MAPS = { color: 'Diffuse', normal: 'nor_gl', rough: 'Rough' };

async function get(url, file) {
  try { if ((await stat(file)).size > 0) { console.log('have', file); return; } } catch { /* not there yet */ }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
  console.log('got ', file);
}

const files = (id) => fetch(`https://api.polyhaven.com/files/${id}`).then((r) => r.json());

await mkdir(join(ASSETS, 'sky'), { recursive: true });
const sky = await files(SKY);
await get(sky.hdri['1k'].hdr.url, join(ASSETS, 'sky', 'sky-1k.hdr'));
// The 8K photo is then cut to sky-pc.jpg (4096 x 2048) and sky-phone.jpg (2048 x 1024),
// and the sun's place and the horizon colour are written to sky/sky.json.
await get(sky.tonemapped.url, join(ASSETS, 'sky', 'sky.jpg'));

// ambientCG ships each material as a zip of pictures named <id>_1K-JPG_<Map>.jpg.
const ACG_MAPS = { color: 'Color', normal: 'NormalGL', rough: 'Roughness' };
async function fromAmbientCG(id, dir) {
  try { if ((await stat(join(dir, 'color.jpg'))).size > 0) { console.log('have', dir); return; } } catch { /* fetch it */ }
  const zip = join(dir, `${id}.zip`);
  await get(`https://ambientcg.com/get?file=${id}_1K-JPG.zip`, zip);
  // Windows 10+ ships a tar that opens zips; use it by full path, because Git Bash's
  // own tar reads "C:" in a path as the name of another computer.
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  execFileSync(tar, ['-xf', `${id}.zip`], { cwd: dir });
  const names = await readdir(dir);
  for (const [map, key] of Object.entries(ACG_MAPS)) {
    const f = names.find((n) => n.endsWith(`_${key}.jpg`));
    if (f) await rename(join(dir, f), join(dir, `${map}.jpg`));
  }
  for (const n of await readdir(dir)) if (!/^(color|normal|rough)\.jpg$/.test(n)) await rm(join(dir, n), { recursive: true });
}

for (const [name, [library, id]] of Object.entries(SURFACES)) {
  const dir = join(ASSETS, 'surfaces', name);
  await mkdir(dir, { recursive: true });
  if (library === 'ambientcg') { await fromAmbientCG(id, dir); continue; }
  const f = await files(id);
  for (const [map, key] of Object.entries(MAPS)) await get(f[key]['1k'].jpg.url, join(dir, `${map}.jpg`));
}
