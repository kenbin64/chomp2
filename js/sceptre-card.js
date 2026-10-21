// sceptre-card.js
// The sceptre card (Ken, 2026-10-21): which talismans are set in the King's sceptre so far. Each one
// won sits in its own setting and shines; the empty settings wait; with all six in place the whole
// sceptre glows. Opened from the Sceptre button beside the Map, in every area (installed by the
// map, mapmodal.js).

import * as Trip from './trip-rules.js';
import { readProgress } from './progress.js';
import { CARD } from './sceptre-model.js';

const WHERE = {
  'talisman-sun': ['Sun', 'the Esplanade'], 'talisman-moon': ['Moon', 'the reef'], 'talisman-air': ['Air', 'Kuranda: the boomerang'],
  'talisman-earth': ['Earth', 'Mossman Gorge: the opal'], 'talisman-fire': ['Fire', 'the cane fields'], 'talisman-water': ['Water', 'Kuranda: the zip line'],
};
const ORDER = ['talisman-sun', 'talisman-moon', 'talisman-air', 'talisman-earth', 'talisman-fire', 'talisman-water'];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
let box = null, onPause = null;

function held() {
  const p = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());
  if (!p.trip) return [];
  return new URLSearchParams(location.search).has('allsceptre') ? ORDER : Trip.sceptre(p.trip);   // ?allsceptre: all six, to see it full
}

// added: a talisman just found (Ken, 2026-10-21): the card opens on it, set in its place, marked New.
// (It is kept for good when the area is completed; until then it counts here as found.)
export function openSceptre(added = null) {
  if (!box) {
    box = el('div', 'map-modal sceptre-card'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', "The King's sceptre");
    box.addEventListener('click', e => { if (e.target === box) closeSceptre(); });
    document.body.append(box);
  }
  const have = [...new Set([...held(), ...(added ? [added] : [])])], all = have.length === 6;
  box.innerHTML = '';
  const card = el('div', 'card');
  card.append(el('h1', null, added ? `The ${WHERE[added][0]} Talisman!` : "The King's Sceptre"), el('p', 'sceptre-sub', added ? (held().includes(added) ? `Already sealed in the King's sceptre. ${have.length} of 6.` : `Found! Complete this area to seal it in the sceptre. If this run fails, it is lost and you will need to find it again; what you sealed before is kept.`) : all ? 'All six talismans are in place, and the sceptre glows.' : `${have.length} of 6 talismans in place. Heaven above, earth below.`));
  const art = el('div', 'sceptre-art' + (all ? ' all' : ''));
  const img = el('img'); img.src = 'screens/guide/sceptre-head.png'; img.alt = "The head of the King's sceptre"; art.append(img);
  for (const id of ORDER) {
    const c = CARD[id], spot = el('div', 'sceptre-spot' + (have.includes(id) ? ' in' : '') + (id === added ? ' new' : ''));
    spot.style.left = `${c.left * 100}%`; spot.style.top = `${c.top * 100}%`; spot.style.width = spot.style.height = `${c.size * 100}%`;
    if (have.includes(id)) { const t = el('img'); t.src = `screens/guide/${id}.png`; t.alt = WHERE[id][0]; spot.append(t); }
    spot.title = WHERE[id][0];
    art.append(spot);
  }
  card.append(art);
  const list = el('ul', 'sceptre-list');
  for (const id of ORDER) { const li = el('li', have.includes(id) ? 'in' : ''); li.append(el('b', null, (have.includes(id) ? '✓ ' : '○ ') + WHERE[id][0]), el('span', null, ` ${WHERE[id][1]}`)); list.append(li); }
  card.append(list);
  const close = el('button', 'go', 'Close'); close.type = 'button'; close.onclick = closeSceptre; card.append(close);
  box.append(card); box.hidden = false;
  if (onPause) onPause(true);
}
export function closeSceptre() { if (box && !box.hidden) { box.hidden = true; if (onPause) onPause(false); } }

export function installSceptre({ pause = null } = {}) {
  onPause = pause;
  const b = el('button', 'sceptre-button', '✦ Sceptre'); b.type = 'button'; b.title = "The King's sceptre: the talismans set in it";
  b.onclick = () => (box && !box.hidden ? closeSceptre() : openSceptre());
  document.body.append(b);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeSceptre(); });
}
