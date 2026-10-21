// mapmodal.js
// The trip map as a pop-up (Ken, 2026-10-17): every page has a Map button (and
// the Tab key) that opens it over whatever is on screen; during play the game
// pauses while it is open. Only places the player can really go are active:
// areas visited or completed, and the next area once it is earned (unlocked by
// finishing the one before, with what it needs in hand). Everything else is
// shown, greyed, with what it takes to get there. ?all opens everything, for
// testing.

import { installScore, clearTrip } from './points.js';
import { AREAS } from './quests.js';
import { resetAreaIntros } from './area-intro.js';
import { installSceptre } from './sceptre-card.js';
import { readProgress, freshProgress, isOpen, entryNeeds, ACTIVITIES, totalStars, activityOpen } from './progress.js';
import { mapSvg, pinXY, markerXY, MARKERS } from './tripmap.js';

const PAGES = { park: 'index.html?play', cane: 'cane.html', esplanade: 'esplanade.html', reef: 'reef.html', kuranda: 'kuranda.html', mossman: 'mossman.html', daintree: 'daintree.html' };
// The page that takes Wally to an area. The first time he heads for Kuranda he rides the
// Skyrail up the range (skyrail.html, which goes on to the village), as in the real trip.
export function pageFor(id) {
  if (id === 'kuranda') { let seen = null; try { seen = localStorage.getItem('chomp-skyrail-seen'); } catch { /* not kept */ } if (!seen) return 'skyrail.html'; }
  return PAGES[id];
}
const HERE = { 'index.html': 'park', '': 'park', 'cane.html': 'cane', 'mossman.html': 'mossman', 'esplanade.html': 'esplanade', 'reef.html': 'reef', 'kuranda.html': 'kuranda' }[location.pathname.split('/').pop()];
const testing = new URLSearchParams(location.search).has('all');

function progressNow() { return readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); }
function visitedNow() { try { return JSON.parse(localStorage.getItem('chomp-visited') || '[]'); } catch { return []; } }

// Remember a visit (each level calls this when play starts).
export function recordVisit(id) {
  const v = visitedNow();
  if (!v.includes(id)) { v.push(id); try { localStorage.setItem('chomp-visited', JSON.stringify(v)); } catch { /* not kept */ } }
}

// A padlock, drawn on the pin of every place that is not open yet.
const LOCK = '<g class="pin-lock" transform="translate(0,-37)"><path d="M-6,-3 v-5 a6,6 0 0 1 12,0 v5" /><rect x="-9" y="-3" width="18" height="14" rx="3"/><circle cy="3" r="2.2"/></g>';

// On an area's end screen, once the area is done and the next one is open:
// "On to <next area>", straight there. Added to every end screen here, so no
// level repeats it; it updates whenever an end screen is shown.
let refreshNext = () => {};
export function addNextStop() {
  const here = HERE; if (!here) return;
  const refresh = buttons => {
    buttons.querySelector('.next-stop')?.remove();
    if (buttons.dataset.won !== '1') return;                     // only when this run completed the area (Ken)
    const progress = progressNow(), i = AREAS.findIndex(a => a.id === here), next = AREAS[i + 1];
    const done = (progress.stars[here] || 0) > 0 || progress.postcards.includes(here);
    if (!done || !next || !next.ready || !PAGES[next.id] || !mapActive(progress, visitedNow(), next.id)) return;
    const a = el('a', 'go next-stop', `Continue on to ${next.name} \u203a`); const page = pageFor(next.id); a.href = page + (testing ? (page.includes('?') ? '&all' : '?all') : '');
    buttons.prepend(a);
  };
  for (const buttons of document.querySelectorAll('.end-buttons')) {
    const overlay = buttons.closest('.overlay'); if (!overlay) continue;
    new MutationObserver(() => { if (!overlay.hidden) refresh(buttons); }).observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
  }
  refreshNext = buttons => refresh(buttons);
}

// Out of lives (Ken, 2026-10-20): start this area again from its beginning. What was
// gained here this time is lost; everything from other areas is kept, so the game is
// never started all over again (trip-rules.js does the keeping). Each level calls this
// when its end screen comes up; on a win it leaves the button as it was.
// Completed (Ken, 2026-10-21): the card says so, the area is open on the map from now on, and it
// offers Continue on to <next area> (added by addNextStop), Redo <area>, Save game and Start a new
// game. A redo keeps everything gained before; what the redo finds is kept only if it is completed
// too (trip-rules.js); a redo that fails shows no way on. overlayId: the end screen (default 'result').
export function markRetry(won, areaName, overlayId = 'result') {
  const overlay = document.getElementById(overlayId);
  const again = (overlay && overlay.querySelector('#again')) || document.getElementById('again');
  const card = overlay ? overlay.querySelector('.card') : again && again.closest('.card');
  const buttons = card && card.querySelector('.end-buttons'); if (!buttons) return;
  buttons.dataset.won = won ? '1' : '0';
  const doneBefore = HERE && (() => { const p = progressNow(); return (p.stars[HERE] || 0) > 0 || p.postcards.includes(HERE); })();
  let note = card.querySelector('.retry-note');
  if (!note) { note = el('p', 'fine retry-note'); buttons.before(note); }
  for (const b of buttons.querySelectorAll('.new-trip, .save-game, .redo-area')) b.remove();
  if (won) {
    note.hidden = false; note.className = 'retry-note done-note';
    note.textContent = `You've completed ${areaName}! It's unlocked on your map now: come back to it any time from the map, if you need what it gives.`;
    // Redo: the page's own again button, or one added here.
    let redo = again && buttons.contains(again) ? again : null;
    if (!redo) { redo = el('button', 'go ghost redo-area'); redo.type = 'button'; redo.onclick = () => { location.href = HERE === 'park' ? 'index.html?play' : location.href; }; buttons.append(redo); }
    redo.dataset.label = redo.dataset.label || redo.textContent; redo.textContent = `Redo ${areaName}`; redo.classList.add('ghost');
    const save = el('button', 'go ghost save-game', 'Save game'); save.type = 'button';
    save.onclick = () => { try { localStorage.setItem('chomp-progress', JSON.stringify(progressNow())); localStorage.setItem('chomp-saved-at', new Date().toISOString()); save.textContent = 'Game saved \u2713'; } catch { save.textContent = 'Could not save here'; } };
    buttons.append(save);
    const fresh = el('button', 'go ghost new-trip', 'Start a new game'); fresh.type = 'button'; fresh.onclick = () => askNewTrip();
    buttons.append(fresh);
    refreshNext(buttons);
    return;
  }
  if (!again) return;
  again.dataset.label = again.dataset.label || again.textContent;
  again.textContent = `Start ${areaName} again`;
  if (card && !note) { note = el('p', 'fine retry-note'); again.closest('.end-buttons').before(note); }
  note.hidden = false; note.className = 'fine retry-note';
  note.textContent = doneBefore
    ? `Not this time. You keep everything you gained when you completed ${areaName} before; anything found on this try is lost. Try again, or carry on from the map.`
    : `Back to the start of ${areaName}. Anything found here this time is lost; everything from the rest of the trip is kept. The next area opens when you complete this one.`;
  refreshNext(buttons);
  // Or the whole game from the very beginning (Ken: give them that choice too),
  // asked once more first, since it wipes the whole trip.
  if (!buttons.querySelector('.new-trip')) {
    const fresh = el('button', 'go ghost new-trip', 'Start the whole game again'); fresh.type = 'button';
    fresh.onclick = () => askNewTrip();
    buttons.append(fresh);
  }
}

// "Are you sure?" (Ken, 2026-10-20), in the game's own style, before anything is wiped.
export function askNewTrip() {
  let box = document.querySelector('.confirm-reset');
  if (!box) {
    box = el('div', 'map-modal confirm-reset'); box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-label', 'Reset the game');
    const card = el('div', 'card');
    card.append(el('h1', null, 'Reset the game?'),
                el('p', null, 'Are you sure you want to reset the game? All progress is lost and a new game begins.'));
    const row = el('div', 'end-buttons');
    const yes = el('button', 'go danger', 'Yes, start a new game'); yes.type = 'button'; yes.onclick = newTrip;
    const no = el('button', 'go ghost', 'No, go back'); no.type = 'button'; no.onclick = () => { box.hidden = true; };
    row.append(no, yes); card.append(row); box.append(card); document.body.append(box);
    box.addEventListener('keydown', e => { if (e.key === 'Escape') box.hidden = true; });
  }
  box.hidden = false; box.querySelector('.ghost').focus();      // No has the focus: Enter never wipes by accident
}

// A brand-new trip: every save of the trip wiped (settings such as sound and tips
// are kept), then the opening screen, where Play asks for the difficulty again.
export function newTrip() {
  // (Kept: the best score, the leaderboard name, the settings and which tips were seen.)
  clearTrip();                             // this trip's points go; the personal best stays (points.js)
  const wardrobe = readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()).wardrobe;
  for (const k of ['chomp-progress', 'chomp-visited', 'chomp-opening-done', 'chomp-skyrail-seen', 'chomp-zipline-intro']) { try { localStorage.removeItem(k); } catch { /* nothing kept */ } }
  resetAreaIntros();                       // every area's fly-over plays again
  try { localStorage.setItem('chomp-progress', JSON.stringify({ ...freshProgress(), wardrobe })); } catch { /* not kept */ }   // the clothes and hats bought stay theirs (Ken: changes stick)
  location.href = 'index.html';
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
  card.append(close, el('h1', null, "Wally's Big Trip"), el('p', 'sub', 'Click an open place to go there. Locked places show what they need.'));
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
    location.href = pageFor(a.id);
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
    g.innerHTML = `<circle r="24" class="halo"/><path d="M0,-6 C-14,-26 -22,-6 0,18 C22,-6 14,-26 0,-6 Z" class="drop" transform="translate(0,-26) scale(1.5)"/><circle r="7" cy="-35" class="dot"/>${!active && a.ready ? LOCK : ''}
      <text x="${dx}" y="${44 + dy}" class="pin-label"></text><text x="${dx}" y="${66 + dy}" class="pin-stars"></text>`;
    g.querySelector('.pin-label').textContent = a.name + (a.id === HERE ? ' (here)' : '');
    g.querySelector('.pin-stars').textContent = !a.ready ? 'coming soon' : active ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '🔒';
    const pick = () => { if (active) go(a); else show(a); };          // Ken: one click on an open area goes there
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
    g.innerHTML = `<circle r="17" class="mark-bg"/><text y="7" class="mark-icon"></text><text y="34" class="mark-label"></text>${active ? '' : `<g transform="translate(12,-12) scale(0.8)">${LOCK.replace('translate(0,-37)', 'translate(0,0)')}</g>`}`;
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
    const pages = { zipline: 'zipline.html', boomerang: 'boomerang.html' };
    addMark(a.id, m.icon, m.label, active, () => {
      if ((active || testing) && pages[a.id]) { location.href = pages[a.id] + (testing ? '?all' : ''); return; }
      box.innerHTML = '';
      box.append(el('h2', null, a.name), el('p', 'place', area ? area.name : ''), el('p', 'goal', a.about));
      box.append(el('p', active ? 'place' : 'needs', active ? 'Open!' : a.stars > have ? `★ ${a.stars} needed (${a.stars - have} to go)` : !area || !area.ready ? 'Coming soon' : `Reach ${area.name} to open`));
      if (a.id === 'shop' && active && kuranda) { const b = el('button', 'go', 'Go shopping'); b.type = 'button'; b.onclick = () => go(kuranda); box.append(b); }
      if (a.id === 'zipline' && (active || testing)) { const b = el('button', 'go', 'Ride the zip line'); b.type = 'button'; b.onclick = () => { location.href = 'zipline.html' + (testing ? '?all' : ''); }; box.append(b); }
      if (a.id === 'boomerang' && (active || testing)) { const b = el('button', 'go', 'Throw a boomerang'); b.type = 'button'; b.onclick = () => { location.href = 'boomerang.html' + (testing ? '?all' : ''); }; box.append(b); }
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
  addNextStop();
  installSceptre({ pause });                                    // the sceptre card, beside the map, in every area
  installScore({ pause });                                      // the points and the Scoreboard (points.js)
  const b = el('button', 'map-button', '🗺 Map'); b.type = 'button'; b.title = 'The map (Tab)';
  b.onclick = () => (modal && !modal.hidden ? closeMap() : openMap());
  document.body.append(b);
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Tab') { e.preventDefault(); modal && !modal.hidden ? closeMap() : openMap(); }
    else if (e.key === 'Escape') closeMap();
  });
}
