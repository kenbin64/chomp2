// points.js
// The trip's points on screen (Ken, 2026-10-21: a point system that makes people want to play
// again, to beat their best or compare scores with others). The rules are in points-rules.js.
//
//   startRun('cane')                    at the start of an area (a new run, unless carrying on
//                                       one begun on another page: { carry: true })
//   addPoints('air')                    as he does things; shows on the score pill
//   bankRun({ stars })                  when the area is completed: the area's best and the trip
//   failRun()                           when a run ends without finishing: its points still count
//   installScore()                      the score pill (second row, beside the Sceptre) and the
//                                       Scoreboard card it opens: this trip by area, the
//                                       personal best, and the leaderboard for the whole game
//
// The book (each area's best this trip, and the personal best) is kept on this device under its
// own key, so a new game clears the trip but never the personal best. The run in progress is kept
// for this browser tab, so an area that spans pages (Kuranda and the zip line; the finale)
// counts as one run.

import * as R from './points-rules.js';
import { showLeaderboard, postBest } from './leaderboard.js';

const BOOK_KEY = 'chomp-points', RUN_KEY = 'chomp-points-run';
const NAMES = { park: 'Croc Park', cane: 'The cane fields', esplanade: 'The Esplanade', reef: 'The reef', kuranda: 'Kuranda and the zip line', mossman: 'Mossman Gorge', finale: 'The Daintree and the rescue' };
let run = null, pill = null, box = null, onPause = null;

export function readBook() { try { return R.readBook(JSON.parse(localStorage.getItem(BOOK_KEY))); } catch { return R.freshBook(); } }
function saveBook(b) { try { localStorage.setItem(BOOK_KEY, JSON.stringify(b)); } catch { /* not kept */ } }
function saveRun() { try { sessionStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch { /* not kept */ } }
function difficulty() { try { return JSON.parse(localStorage.getItem('chomp-progress')).trip.difficulty || 'intermediate'; } catch { return 'intermediate'; } }

export function startRun(area, { carry = false } = {}) {
  let old = null; try { old = JSON.parse(sessionStorage.getItem(RUN_KEY)); } catch { /* none */ }
  run = carry && old && old.area === area && Number.isInteger(old.pts) ? old : R.freshRun(area);
  saveRun(); draw();
  return run;
}

export function addPoints(kind, n = 1) {
  if (!run) return 0;
  const r = R.award(run, kind, n);
  if (!r.gained) return 0;
  run = r.run; saveRun(); draw(r.gained);
  return r.gained;
}
export function runPoints() { return run ? run.pts : 0; }

export function bankRun({ stars = 0, finished = true } = {}) {
  if (!run) return null;
  const area = run.area, r = R.bank(readBook(), run, { stars, difficulty: difficulty(), finished });
  saveBook(r.book);
  run = null; try { sessionStorage.removeItem(RUN_KEY); } catch { /* none */ }
  draw();
  if (pill) pill.title = r.newBest ? 'A new personal best!' : 'Your points';
  if (r.newBest) celebrate(`New personal best: ${r.trip.toLocaleString()} points!`);
  else if (r.newAreaBest) celebrate(`New best for ${NAMES[area] || 'this area'}: ${r.areaBest} points!`);
  if (r.newBest) postBest(r.book.best);                // on the leaderboard straight away (a name saved on this device)
  return r;
}
// A run that ends without finishing the area: its points still count (no completion bonus).
export function failRun() { return bankRun({ finished: false }); }

// A new game (mapmodal.js newTrip): this trip's points cleared, the personal best kept.
export function clearTrip() { saveBook(R.newTripBook(readBook())); try { sessionStorage.removeItem(RUN_KEY); } catch { /* none */ } }

// ---- On screen -------------------------------------------------------------------------------
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function draw(gained = 0) {
  if (!pill) return;
  const book = readBook(), trip = R.tripScore(book, difficulty());
  pill.innerHTML = '';
  pill.append(el('span', 'score-icon', '🏆'), el('b', 'score-run', run ? String(run.pts) : String(trip)), el('small', null, run ? `trip ${trip}` : `best ${book.best}`));
  if (gained) {
    const pop = el('span', 'score-pop', `+${gained}`); pill.append(pop);
    pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    setTimeout(() => pop.remove(), 900);
  }
}

function celebrate(text) {
  const c = el('div', 'score-cheer', text); document.body.append(c);
  setTimeout(() => c.remove(), 3200);
}

export function openScore() {
  if (!box) {
    box = el('div', 'map-modal score-card'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Scoreboard');
    box.addEventListener('click', e => { if (e.target === box) closeScore(); });
    document.body.append(box);
  }
  const book = readBook(), d = difficulty(), trip = R.tripScore(book, d);
  box.innerHTML = '';
  const card = el('div', 'card');
  card.append(el('h1', null, 'Scoreboard'));
  const top = el('div', 'score-top');
  const stat = (label, value) => { const s = el('div', 'score-stat'); s.append(el('small', null, label), el('b', null, value)); return s; };
  top.append(stat('This trip', trip.toLocaleString()), stat('Personal best', book.best.toLocaleString()), ...(run ? [stat('This run', String(run.pts))] : []));
  card.append(top);
  const table = el('table', 'score-areas');
  for (const a of R.AREAS) {
    const tr = el('tr', book.areas[a] != null ? '' : 'todo');
    tr.append(el('td', null, NAMES[a]), el('td', null, book.areas[a] != null ? String(book.areas[a]) : '...'));
    table.append(tr);
  }
  card.append(table);
  card.append(el('p', 'fine', `Each area keeps its best run of this trip, so playing an area again and doing better raises your trip score. ${d === 'easy' ? 'Easy trips count as they are' : d === 'hard' ? 'Hard trips count double' : 'Intermediate trips count one and a half times'}.`));
  const how = el('details', 'score-how'); how.append(el('summary', null, 'How points are won'));
  const ul = el('ul');
  for (const [k, t] of [['ground', 'Food caught off the ground'], ['air', 'Food caught in the air'], ['leap', 'Food caught in a leap'], ['pickup', 'Anything picked up'], ['talisman', 'A talisman'], ['catch', 'The boomerang caught'], ['croc', 'A croc that joins Wally'], ['heave', 'A heave on the beat'], ['star', 'Each star'], ['area', 'An area completed']])
    ul.append(el('li', null, `${t}: ${R.POINTS[k]}`));
  how.append(ul); card.append(how);
  const board = el('div', 'score-board'); card.append(board);
  showLeaderboard(board, 'trip', book.best, 0);       // the whole game's top ten (the personal best is what is posted)
  const close = el('button', 'go', 'Close'); close.type = 'button'; close.onclick = closeScore; card.append(close);
  box.append(card); box.hidden = false;
  if (onPause) onPause(true);
}
export function closeScore() { if (box && !box.hidden) { box.hidden = true; if (onPause) onPause(false); } }

export function installScore({ pause = null } = {}) {
  onPause = pause;
  if (pill) return;
  pill = el('button', 'score-button'); pill.type = 'button'; pill.title = 'Your points (the Scoreboard)';
  pill.onclick = () => (box && !box.hidden ? closeScore() : openScore());
  document.body.append(pill);
  draw();
  addEventListener('keydown', e => { if (e.key === 'Escape') closeScore(); });
}
