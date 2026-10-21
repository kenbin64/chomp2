// tools/release.mjs
// Publishing a new version of Chomp 3D (Ken, 2026-10-21: version it and keep track on GitHub, so a
// problem can be undone). One command does the lot, and stops at the first thing that is not right:
//
//   node tools/release.mjs patch      a fix              1.0.0 -> 1.0.1
//   node tools/release.mjs minor      something new      1.0.0 -> 1.1.0
//   node tools/release.mjs major      a big change       1.0.0 -> 2.0.0
//   node tools/release.mjs beta       the next beta update     1.0.0-beta.1 -> 1.0.0-beta.2
//   node tools/release.mjs 1.0.0-beta.1   an exact version (the first beta)
//   add --no-e2e to skip the browser suite (it needs the local server running: node serve.mjs)
//
// It: checks nothing is left uncommitted; runs the unit tests and the browser suite; sets the version in
// package.json; turns the CHANGELOG's "Unreleased" section into this version with today's date; commits,
// tags vX.Y.Z and pushes both to GitHub; then builds and publishes the site (playbutterflyfx), labelling
// the Cloudflare deployment with the version so it can be found and rolled back. See RELEASING.md.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const GAME = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTAL = join(GAME, '..', 'playbutterflyfx');
const args = process.argv.slice(2), bump = args.find(a => !a.startsWith('--')), e2e = !args.includes('--no-e2e');
const run = (cmd, cwd = GAME) => { console.log(`> ${cmd}`); return execSync(cmd, { cwd, stdio: 'inherit' }); };
const out = (cmd, cwd = GAME) => execSync(cmd, { cwd }).toString().trim();
const stop = why => { console.error(`\nNot released: ${why}`); process.exit(1); };

if (!bump) stop('say patch, minor, major or an exact version, e.g. node tools/release.mjs patch');
if (out('git status --porcelain')) stop('there are uncommitted changes. Commit them first, so the release is exactly what is on GitHub.');

// The new version.
const pkgPath = join(GAME, 'package.json'), pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
// A version is X.Y.Z, or X.Y.Z-beta.N while in beta (Ken, 2026-10-21: the official beta release).
const cur = pkg.version || '0.0.0', [core, pre] = cur.split('-'), [M, m, p] = core.split('.').map(Number);
const betaN = pre && /^beta\.(\d+)$/.test(pre) ? Number(pre.split('.')[1]) : null;
const next = /^\d+\.\d+\.\d+(-beta\.\d+)?$/.test(bump) ? bump
  : bump === 'beta' ? (betaN !== null ? `${core}-beta.${betaN + 1}` : `${M}.${m}.${p + 1}-beta.1`)
  : bump === 'major' ? `${M + 1}.0.0` : bump === 'minor' ? `${M}.${m + 1}.0` : bump === 'patch' ? (betaN !== null ? core : `${M}.${m}.${p + 1}`) : null;
if (!next) stop(`"${bump}" is not beta, patch, minor, major or a version like 1.2.3 or 1.2.3-beta.1`);
if (out('git tag --list').split('\n').includes(`v${next}`)) stop(`v${next} already exists`);

// The tests: nothing goes out that fails them.
try { run('npm test'); } catch { stop('a unit test failed'); }
if (e2e) { try { run('npm run e2e'); } catch { stop('the browser suite failed (is node serve.mjs running?)'); } }

// The version and the changelog.
pkg.version = next; writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
const logPath = join(GAME, 'CHANGELOG.md'), today = new Date().toISOString().slice(0, 10);
let log = readFileSync(logPath, 'utf8');
if (!/## Unreleased/.test(log)) stop('CHANGELOG.md has no "## Unreleased" section saying what changed');
log = log.replace('## Unreleased', `## Unreleased\n\n## v${next} (${today})`);
writeFileSync(logPath, log);

// GitHub: the release commit and its tag.
run('git add package.json CHANGELOG.md');
run(`git commit -m "Release v${next}"`);
run(`git tag -a v${next} -m "Chomp 3D v${next}${next.includes('beta') ? ' (beta)' : ''}"`);
run('git push');
run(`git push origin v${next}`);

// The site, labelled with the version.
const commit = out('git rev-parse --short HEAD');
run('node build.mjs', PORTAL);
run(`npx wrangler deploy --tag v${next} --message "Chomp 3D v${next} (${commit})"`, PORTAL);
console.log(`\nReleased Chomp 3D v${next} (${commit}): tagged on GitHub and live on playbutterflyfx.com.`);
