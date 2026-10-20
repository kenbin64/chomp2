// Tests for js/levels/cane-rules.js: the sugar cane field, and attempts to break it.
// Run:  node test/cane.test.mjs

import * as C from '../js/levels/cane-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}
const LEVELS = ['easy', 'intermediate', 'hard'];
const SEEDS = Array.from({ length: 60 }, (_, k) => 1 + k * 7919);

// ---- The grid --------------------------------------------------------------------------
check('an odd number of cells a side, so there is a middle', C.CANE.size % 2 === 1 && C.middle() === (C.CANE.size - 1) / 2);
{
  let round = true;
  for (let i = 0; i < C.CANE.size; i++) for (let j = 0; j < C.CANE.size; j++) {
    const w = C.cellToWorld(i, j), c = C.worldToCell(w.x, w.z);
    if (c.i !== i || c.j !== j) round = false;
  }
  check('cell to world and back is the same cell, everywhere', round);
  const m = C.cellToWorld(C.middle(), C.middle());
  check('the middle cell is at the origin', Math.abs(m.x) < 1e-9 && Math.abs(m.z) < 1e-9);
}

// ---- Every field, every level ---------------------------------------------------------
for (const level of LEVELS) {
  let always = true, startCut = true, middleCut = true, notStraight = true, fireEverywhereOk = true, lyingOk = true;
  for (const seed of SEEDS) {
    const f = C.makeField(seed, level);
    if (!C.wayThrough(f)) always = false;
    const s = C.startCell();
    if (C.at(f, s.i, s.j) !== 'cut') startCut = false;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (C.at(f, C.middle() + di, C.middle() + dj) !== 'cut') middleCut = false;
    // Not a straight line: the way through needs a turn (a straight cut up the middle column would hit fire).
    let straight = true;
    for (let j = 0; j <= C.middle(); j++) if (C.at(f, C.middle(), j) === 'fire') straight = false;
    if (straight) notStraight = false;
    if (C.fireCells(f).some(c => c.j < C.CANE.headland)) fireEverywhereOk = false;
    if (f.lying.some(p => C.at(f, p.i, p.j) === 'fire')) lyingOk = false;
  }
  check(`${level}: there is always a way through to the middle`, always);
  check(`${level}: he starts on cut ground`, startCut);
  check(`${level}: the middle is a clearing`, middleCut);
  check(`${level}: the way is never a straight line up the middle`, notStraight);
  check(`${level}: no fire on the headland where he starts`, fireEverywhereOk);
  check(`${level}: no cane piece lies in fire`, lyingOk);
}
{
  const avg = level => SEEDS.reduce((s, seed) => s + C.cutsNeeded(C.makeField(seed, level)), 0) / SEEDS.length;
  const e = avg('easy'), i = avg('intermediate'), h = avg('hard');
  check('harder levels have more fire rings', C.ringsFor('easy').length < C.ringsFor('intermediate').length && C.ringsFor('intermediate').length < C.ringsFor('hard').length);
  check('every way through needs some cutting', SEEDS.every(seed => C.cutsNeeded(C.makeField(seed, 'easy')) > 3));
  check('the job is never endless (fewer cuts than cells to the middle and back)', SEEDS.every(seed => LEVELS.every(l => C.cutsNeeded(C.makeField(seed, l)) < C.CANE.size * 3)), `${e} ${i} ${h}`);
  check('easy leaves more cane lying about than hard', C.CANE.lying.easy > C.CANE.lying.hard && C.makeField(5, 'easy').lying.length > C.makeField(5, 'hard').lying.length);
}
check('the same seed makes the same field', JSON.stringify(C.makeField(42)) === JSON.stringify(C.makeField(42)));
check('different seeds make different fields', JSON.stringify(C.makeField(42).cells) !== JSON.stringify(C.makeField(43).cells));

// ---- Walking, cutting and the fire -----------------------------------------------------
{
  const f = C.makeField(7, 'intermediate');
  const s = C.startCell();
  check('he can stand on cut ground', C.walkable(f, s.i, s.j));
  // Find a cane cell next to the headland.
  const ci = s.i, cj = C.CANE.headland;
  const caneHere = C.at(f, ci, cj) === 'cane';
  check('cane cannot be walked through before it is cut', !caneHere || !C.walkable(f, ci, cj));
  const r = C.cut(f, ci, cj, 0);
  check('a swing of the machete cuts cane', !caneHere || (r.cut && C.walkable(r.field, ci, cj)));
  check('cutting does not change the old field', !caneHere || C.at(f, ci, cj) === 'cane');
  check('a lucky cut drops a piece of cane', !caneHere || r.piece === true);
  check('an unlucky cut drops none', !caneHere || C.cut(f, ci, cj, 0.999).piece === false);
  check('cut ground cannot be cut again', C.cut(f, s.i, s.j).cut === false);
  const fire = C.fireCells(f)[0];
  check('fire cannot be walked into', !C.walkable(f, fire.i, fire.j));
  check('fire cannot be cut', C.cut(f, fire.i, fire.j, 0).cut === false);
  check('the edge of the field cannot be walked past', !C.walkable(f, -1, 0) && !C.walkable(f, 0, C.CANE.size));
  // Cut every cane cell: the fire is just where it was laid (it never spreads to him).
  let all = f;
  for (let j = 0; j < C.CANE.size; j++) for (let i = 0; i < C.CANE.size; i++) all = C.cut(all, i, j, 1).field;
  check('fire never spreads: cutting everything leaves the fire just as laid', JSON.stringify(C.fireCells(all)) === JSON.stringify(C.fireCells(f)));
  check('...and with everything cut, no more cutting is needed', C.cutsNeeded(all) === 0);
}
{
  // A field walled off entirely by fire has no way through (the check itself works).
  const f = C.makeField(3);
  const walled = { ...f, cells: f.cells.map((row, j) => row.map((c, i) => Math.max(Math.abs(i - C.middle()), Math.abs(j - C.middle())) === 4 ? 'fire' : c)) };
  check('a ring of fire with no gap is caught: no way through', !C.wayThrough(walled) && C.cutsNeeded(walled) === Infinity);
}
check('the random generator is the same for the same seed', (() => { const a = C.rng(9), b = C.rng(9); return [1, 2, 3].every(() => a() === b()); })());
check('the random generator stays between 0 and 1', (() => { const r = C.rng(123); for (let k = 0; k < 1000; k++) { const v = r(); if (v < 0 || v >= 1) return false; } return true; })());

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
