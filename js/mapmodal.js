// mapmodal.js
// The trip map as a pop-up (Ken, 2026-10-17): every page has a Map button (and
// the Tab key) that opens it over whatever is on screen; during play the game
// pauses while it is open. Only places the player can really go are active:
// areas visited or completed, and the next area once it is earned (unlocked by
// finishing the one before, with what it needs in hand). Everything else is
// shown, greyed, with what it takes to get there. ?all opens everything, for
// testing.

import { AREAS } from './quests.js';
import { readProgress, isOpen, entryNeeds, ACTIVITIES, totalStars, activityOpen } from './progress.js';
import { mapSvg, pinXY, markerXY, MARKERS } from './tripmap.js';

const PAGES = { park: 'index.html?play', esplanade: 'esplanade.html', reef: 'reef.html', kuranda: 'kuranda.html' };
const HERE = { 'index.html': 'park', '': 'park', 'esplanade.html': 'esplanade', 'reef.html': 'reef', 'kuranda.html': 'kuranda' }[location.pathname.split('/').pop()];
const testing = new URLSearchParams(location.search).has('all');

function progressNow() { return readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); }
function visitedNow() { try { return JSON.parse(localStorage.getItem('chomp-visited') || '[]'); } catch { return []; } }

// Remember a visit (each level calls this when play starts).
export function recordVisit(id) {
  const v = visitedNow();
  if (!v.includes(id)) { v.push(id); try { localStorage.setItem('chomp-visited', JSON.stringify(v)); } catch { /* not kept */ } }
}

// Can the player go to this area from the map?
export function mapActive(progress, visited, id) {
  const a = AREAS.find(x => x.id === id);
  if (!a || !a.ready) return false;
  if (testing) return true;
  if (visited.includes(id) || (progress.stars[id] || 0) > 0 || progress.postcards.includes(id)) return true;
  return isOpen(progress, id) && !entryNeeds(progress, id);           // the next one, earned
}

let modal = null, onPause = null;
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function build() {
  modal = el('div', 'map-modal'); modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', "Wally's Big Trip map");
  const card = el('div', 'card map-card');
  const close = el('button', 'map-close', '✕'); close.type = 'button'; close.setAttribute('aria-label', 'Close the map'); close.onclick = closeMap;
  card.append(close, el('h1', null, "Wally's Big Trip"), el('p', 'sub', 'Click a place to see it; click again (or Play) to go there.'));
  const wrap = el('div', 'tripmap'), art = el('div', 'tripmap-art'), info = el('div', 'tripmap-info');
  art.innerHTML = mapSvg(); wrap.append(art, info); card.append(wrap);
  card.append(el('p', 'fine map-bank'));
  modal.append(card);
  modal.addEventListener('click', e => { if (e.target === modal) closeMap(); });
  document.body.append(modal);
}

function render() {
  const progress = progressNow(), visited = visitedNow();
  modal.querySelector('h1').textContent = `${progress.crocName || 'Wally'}'s Big Trip`;
  const art = modal.querySelector('.tripmap-art'), box = modal.querySelector('.tripmap-info');
  const pins = art.querySelector('#tripmap-pins'), marks = art.querySelector('#tripmap-markers');
  pins.innerHTML = ''; marks.innerHTML = '';
  const go = a => {
    if (a.id === HERE) { closeMap(); if (window.chompStartHere) window.chompStartHere(); return; }
    location.href = PAGES[a.id];
  };
  const show = a => {
    const active = mapActive(progress, visited, a.id), needs = entryNeeds(progress, a.id), stars = progress.stars[a.id] || 0;
    box.innerHTML = '';
    box.append(el('h2', null, a.name), el('p', 'place', a.ready ? (a.place || '') : 'Coming soon'));
    if (a.ready) box.append(el('p', 'stars', '★'.repeat(stars) + '☆'.repeat(3 - stars)));
    if (a.objective) box.append(el('p', 'goal', a.objective));
    if (active) {
      const b = el('button', 'go', a.id === HERE ? 'Back to it' : stars ? 'Play again' : 'Go there'); b.type = 'button'; b.onclick = () => go(a); box.append(b);
    } else if (a.ready) {
      box.append(el('p', 'needs', needs ? `Needs ${needs.text}` : 'Finish the area before it to open this one.'));
    }
    pins.querySelectorAll('.pin').forEach(p => p.classList.toggle('picked', p.dataset.id === a.id));
  };
  for (const a of AREAS) {
    const active = mapActive(progress, visited, a.id), { x, y, dx, dy } = pinXY(a.id), stars = progress.stars[a.id] || 0;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `pin ${active ? 'open' : a.ready ? 'locked' : 'soon'}${a.id === HERE ? ' here' : ''}`); g.dataset.id = a.id;
    g.setAttribute('transform', `translate(${x.toFixed(0)},${y.toFixed(0)})`); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
    g.innerHTML = `<circle r="24" class="halo"/><path d="M0,-6 C-14,-26 -22,-6 0,18 C22,-6 14,-26 0,-6 Z" class="drop" transform="translate(0,-26) scale(1.5)"/><circle r="7" cy="-35" class="dot"/>
      <text x="${dx}" y="${44 + dy}" class="pin-label"></text><text x="${dx}" y="${66 + dy}" class="pin-stars"></text>`;
    g.querySelector('.pin-label').textContent = a.name + (a.id === HERE ? ' (here)' : '');
    g.querySelector('.pin-stars').textContent = !a.ready ? 'coming soon' : active ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '🔒';
    const pick = () => { if (active && g.classList.contains('picked')) go(a); else show(a); };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', e => { if (e.key === 'Enter') pick(); });
    pins.appendChild(g);
  }
  // Barron Falls and the adventure markers.
  const have = totalStars(progress);
  const kuranda = AREAS.find(x => x.id === 'kuranda');
  const addMark = (id, icon, label, active, onPick) => {
    const { x, y } = markerXY(id);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `mark ${active ? 'open' : 'locked'}`); g.setAttribute('transform', `translate(${x.toFixed(0)},${y.toFixed(0)})`); g.setAttribute('tabindex', '0');
    g.innerHTML = `<circle r="17" class="mark-bg"/><text y="7" class="mark-icon"></text><text y="34" class="mark-label"></text>`;
    g.querySelector('.mark-icon').textContent = icon; g.querySelector('.mark-label').textContent = label;
    g.addEventListener('click', onPick); marks.appendChild(g);
  };
  addMark('barron', '💦', 'Barron Falls', mapActive(progress, visited, 'kuranda'), () => {
    box.innerHTML = '';
    box.append(el('h2', null, 'Barron Falls'), el('p', 'goal', 'The gorge below Kuranda, roaring after the wet season rains. The trail from the end of the Kuranda markets street leads here: home of the zip line and the bungee jump.'));
  });
  for (const a of ACTIVITIES) {
    const m = MARKERS[a.id]; if (!m) continue;
    const area = AREAS.find(x => x.id === a.area);
    const active = activityOpen(progress, a.id) && mapActive(progress, visited, a.area);
    addMark(a.id, m.icon, m.label, active, () => {
      box.innerHTML = '';
      box.append(el('h2', null, a.name), el('p', 'place', area ? area.name : ''), el('p', 'goal', a.about));
      box.append(el('p', active ? 'place' : 'needs', active ? 'Open!' : a.stars > have ? `★ ${a.stars} needed (${a.stars - have} to go)` : !area || !area.ready ? 'Coming soon' : `Reach ${area.name} to open`));
      if (a.id === 'shop' && active && kuranda) { const b = el('button', 'go', 'Go shopping'); b.type = 'button'; b.onclick = () => go(kuranda); box.append(b); }
    });
  }
  modal.querySelector('.map-bank').textContent = `★ ${have} · Golden Mangoes ${progress.mangoes || 0} · Pearls ${progress.pearls || 0} · Seashells ${progress.shells || 0} · Gold ${progress.coins || 0}`
    + (progress.badge ? ' · Ranger badge ✓' : '') + (progress.pier ? ' · Pier open ✓' : '') + (progress.skyrail ? ' · Skyrail pass ✓' : '') + (progress.boatTicket ? ' · Boat ticket ✓' : '');
  // Start on where the player is, or the next place to go.
  show(AREAS.find(a => a.id === HERE) || AREAS.find(a => mapActive(progress, visited, a.id) && !progress.stars[a.id]) || AREAS[0]);
}

export function openMap() {
  if (!modal) build();
  render();
  modal.hidden = false;
  if (onPause) onPause(true);
}
export function closeMap() {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  if (onPause) onPause(false);
}

// Put the Map button on the page. pause(on): the page's own pause, used while the map is open.
export function installMap({ pause = null } = {}) {
  onPause = pause;
  const b = el('button', 'map-button', '🗺 Map'); b.type = 'button'; b.title = 'The map (Tab)';
  b.onclick = () => (modal && !modal.hidden ? closeMap() : openMap());
  document.body.append(b);
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Tab') { e.preventDefault(); modal && !modal.hidden ? closeMap() : openMap(); }
    else if (e.key === 'Escape') closeMap();
  });
}
