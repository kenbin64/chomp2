// revisit.js
// Going back to an area (Ken, 2026-10-21): a talisman already sealed in the sceptre is never needed
// again, but redoing things there is still worth it. Where the talisman (or an activity's own prize)
// would be, a random useful prize is given instead: a gear item or Tourist Tokens (book-rules.js).
//
//   foundTalisman(id, toast)   at the talisman's moment: the sceptre card if it is new, a prize if
//                               it is already sealed
//   givePrize(toast, why)      a random useful prize, saved at once; returns its name

import * as Trip from './trip-rules.js';
import { readProgress, saveProgress } from './progress.js';
import { hiddenReward, applyReward, ABILITIES } from './book-rules.js';
import { openSceptre } from './sceptre-card.js';

const load = () => readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());

export function alreadySealed(id) { const p = load(); return !!(p.trip && Trip.have(p.trip, id)); }

export function givePrize(toast, why = 'A prize') {
  let p = load();
  const r = hiddenReward(Math.random, p);
  p = applyReward(p, r); saveProgress(p);
  const name = r.kind === 'item' ? (ABILITIES.find(a => a.id === r.id) || {}).name || 'an item' : `${r.n} Tourist Token${r.n > 1 ? 's' : ''}`;
  if (toast) toast(`${why}: ${name}!`, 'good');
  return name;
}

export function foundTalisman(id, toast) {
  if (alreadySealed(id)) givePrize(toast, 'Already sealed in the sceptre. A prize instead');
  else openSceptre(id);
}
