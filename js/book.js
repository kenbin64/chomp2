// book.js
// Wally's Tourist Book (Ken, 2026-10-18), on every page: a Book button (and the
// B key) opens the stamp album and Wally's own page. Each land notices what
// happens (bookEvent) and stamps the book the moment a challenge is met; the
// rules are in book-rules.js (tested).
//
//   Stamps  one page per land: stamped, still to earn, or "come back" for the
//           tiers that open on later visits
//   Wally   his abilities and their levels (upgraded with Tourist Tokens), and
//           everything he has banked on the trip
//
// Hidden finds (HiddenFinds) lie about each land, unseen until he is close, and
// hold Tourist Tokens or an ability level.

import * as THREE from 'three';
import { readProgress, OUTFITS, saveProgress } from './progress.js';
import { SOUVENIRS } from './trade-rules.js';
import { STAMPS, LANDS, ABILITIES, MAX_LEVEL, abilityLevel, abilityValue, upgradeAbility, upgradeCost,
         countVisit, tierFor, openStamps, award, StampRun, hiddenReward, applyReward, ITEMS, discover, EVENT_ITEM } from './book-rules.js';

const LAND_NAMES = { park: 'Croc Park', esplanade: 'The Esplanade', reef: 'Great Barrier Reef', kuranda: 'Kuranda' };
let modal = null, onPause = null, land = null, run = null, tab = 'stamps';
// What the book has to show the player (Ken): a stamp going in, or a thing found for the first time.
const queue = []; let focus = null;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function load() { return readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); }
let known = null;                                   // the abilities, kept to hand (asked for every frame)
function save(p) { known = p.abilities || {}; saveProgress(p); }

// ---- What the game asks ----------------------------------------------------------------
// The value an ability gives now (1 when he does not have it).
export function ability(id) { if (!known) known = load().abilities || {}; return abilityValue({ abilities: known }, id); }

// Something happened in this land. The first of each kind of thing opens the
// book on it, and any stamp it earns is stamped in the book in front of the
// player (Ken: the book comes up and stamps it, so they can see it).
export function bookEvent(event, n = 1) {
  if (EVENT_ITEM[event]) bookFound(EVENT_ITEM[event]);
  if (!run) return [];
  let p = load();
  const ids = run.record(event, openStamps(p, land), n);
  for (const id of ids) { p = award(p, id); queue.push({ stamp: id }); }
  if (ids.length) { save(p); bookFound('token'); }
  showNext();
  return ids;
}

// A thing got for the first time: the book opens on what it is and what it does. Only the first time.
export function bookFound(id) {
  const r = discover(load(), id);
  if (!r.first) return false;
  save(r.progress);
  queue.push({ item: id });
  showNext();
  return true;
}

// Show what is waiting, one at a time (the next when the book is closed).
function showNext() {
  if (!queue.length || (modal && !modal.hidden)) return;
  focus = queue.shift();
  openBook(focus.stamp ? 'stamps' : 'items');
}

// ---- The book --------------------------------------------------------------------------
function build() {
  modal = el('div', 'map-modal book-modal'); modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', "Wally's Tourist Book");
  const card = el('div', 'card book-card');
  const close = el('button', 'map-close', '✕'); close.type = 'button'; close.setAttribute('aria-label', 'Close the book'); close.onclick = closeBook;
  const tabs = el('div', 'book-tabs');
  for (const [id, label] of [['stamps', 'Stamps'], ['items', 'Things found'], ['wally', "Wally's page"]]) {
    const b = el('button', 'book-tab', label); b.type = 'button'; b.dataset.tab = id; b.onclick = () => { tab = id; render(); }; tabs.append(b);
  }
  card.append(close, el('h1', null, "Wally's Tourist Book"), tabs, el('div', 'book-body'));
  modal.append(card);
  modal.addEventListener('click', e => { if (e.target === modal) closeBook(); });
  document.body.append(modal);
}

function stampsPage(p, body) {
  const have = p.stamps || [];
  body.append(el('p', 'fine', `${have.length} of ${STAMPS.length} stamps · each new visit to a land opens new challenges`));
  for (const L of LANDS) {
    const tier = tierFor(p, L), visits = (p.visits || {})[L] || 0;
    const page = el('section', 'book-land');
    page.append(el('h2', null, `${LAND_NAMES[L]}`), el('p', 'fine', visits ? `Visits: ${visits}` : 'Not visited yet'));
    const grid = el('div', 'book-grid');
    for (const s of STAMPS.filter(x => x.land === L)) {
      const got = have.includes(s.id), locked = s.visit > tier;
      const c = el('div', `book-stamp ${got ? 'got' : locked ? 'locked' : 'open'}${focus && focus.stamp === s.id ? ' fresh' : ''}`); c.dataset.stamp = s.id;
      if (got) c.append(el('span', 'ink', '✓'), el('b', null, s.name), el('small', null, s.how));
      else if (locked) c.append(el('span', 'ink', '?'), el('b', null, `Visit ${s.visit}`), el('small', null, 'Come back to open this one'));
      else c.append(el('span', 'ink', '○'), el('b', null, s.name), el('small', null, s.how));
      grid.append(c);
    }
    page.append(grid); body.append(page);
  }
}

function wallyPage(p, body) {
  body.append(el('p', 'book-tokens', `Tourist Tokens: ${p.tokens || 0}`),
    el('p', 'fine', 'Earn tokens with stamps and hidden finds; spend them to grow an ability.'));
  for (const a of ABILITIES) {
    const L = abilityLevel(p, a.id), cost = upgradeCost(p, a.id);
    const row = el('div', 'book-ability');
    const pips = el('span', 'pips', '●'.repeat(L) + '○'.repeat(MAX_LEVEL - L));
    row.append(el('span', 'icon', a.icon), el('div', 'what'), pips);
    row.querySelector('.what').append(el('b', null, a.name), el('small', null, a.about));
    const b = el('button', 'buy', cost === null ? 'Top level' : `Level ${L + 1}: ${cost} tokens`); b.type = 'button';
    b.disabled = cost === null || (p.tokens || 0) < cost;
    b.onclick = () => { const r = upgradeAbility(load(), a.id); if (r.ok) { save(r.progress); render(); } };
    row.append(b); body.append(row);
  }
  const bank = el('div', 'book-bank');
  const owned = (p.wardrobe && p.wardrobe.owned || []).length;
  for (const [label, v] of [['Golden Mangoes', p.mangoes || 0], ['Pearls', p.pearls || 0], ['Seashells', p.shells || 0], ['Gold', p.coins || 0],
                            ['Treasures found', (p.treasures || []).length], ['Outfits owned', `${owned} of ${OUTFITS.filter(o => !o.needs).length}`]]) {
    const r = el('div'); r.append(el('span', null, label), el('b', null, String(v))); bank.append(r);
  }
  const passes = [p.badge && 'Ranger badge', p.pier && 'Pier pass', p.skyrail && 'Skyrail pass', p.boatTicket && 'River-boat ticket'].filter(Boolean);
  body.append(el('h2', null, 'Banked on the trip'), bank, el('p', 'fine', passes.length ? `Passes: ${passes.join(', ')}` : 'No passes yet'));
  // Souvenirs from the friendly traders, a shelf for each land.
  const have = p.souvenirs || [], all = Object.values(SOUVENIRS).flat();
  body.append(el('h2', null, `Souvenirs (${have.length} of ${all.length})`), el('p', 'fine', 'Swapped with friendly traders: some groups trade instead of running off.'));
  const shelf = el('div', 'book-grid');
  for (const [id, name] of all) { const got = have.includes(id); const c = el('div', `book-stamp ${got ? 'got' : 'locked'}`); c.append(el('span', 'ink', got ? '★' : '?'), el('b', null, got ? name : 'Not yet'), el('small', null, got ? 'From a trader' : 'Find a trader')); shelf.append(c); }
  body.append(shelf);
}

// Things found: what each is and what it can do, once he has had one.
function itemsPage(p, body) {
  const have = p.discovered || [];
  body.append(el('p', 'fine', `${have.length} of ${ITEMS.length} things found`));
  if (focus && focus.item) {
    const it = ITEMS.find(i => i.id === focus.item);
    const news = el('div', 'book-news');
    news.append(el('span', 'big', it.icon), el('div'));
    news.lastChild.append(el('b', null, `New: ${it.name}`), el('p', null, it.is), el('p', 'does', it.does));
    body.append(news);
  }
  const grid = el('div', 'book-grid');
  for (const it of ITEMS) {
    const got = have.includes(it.id);
    const c = el('div', `book-stamp book-item ${got ? 'got' : 'locked'}${focus && focus.item === it.id ? ' fresh' : ''}`);
    if (got) c.append(el('span', 'ink', it.icon), el('b', null, it.name), el('small', null, it.does));
    else c.append(el('span', 'ink', '?'), el('b', null, 'Not found yet'), el('small', null, 'Keep exploring'));
    grid.append(c);
  }
  body.append(grid);
}

function render() {
  const p = load(), body = modal.querySelector('.book-body'); body.innerHTML = '';
  modal.querySelectorAll('.book-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'stamps') stampsPage(p, body); else if (tab === 'items') itemsPage(p, body); else wallyPage(p, body);
  const fresh = body.querySelector('.fresh');
  if (fresh) requestAnimationFrame(() => fresh.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

export function openBook(which = null) {
  if (!modal) build();
  if (which) tab = which;
  render(); modal.hidden = false;
  if (onPause) onPause(true);
}
export function closeBook() {
  if (!modal || modal.hidden) return;
  modal.hidden = true; focus = null;
  if (onPause) onPause(false);
  if (queue.length) setTimeout(showNext, 350);           // the next stamp or thing, if more are waiting
}

// On every page. here: the land being played (or null on menus). pause(on): the page's own pause.
// Counts this as a visit (opening the next tier of challenges on a return).
export function installBook({ here = null, pause = null } = {}) {
  onPause = pause; land = here;
  if (land) { save(countVisit(load(), land)); run = new StampRun(land); }
  const b = el('button', 'map-button book-button', '📖 Book'); b.type = 'button'; b.title = "Wally's Tourist Book (B)";
  b.onclick = () => (modal && !modal.hidden ? closeBook() : openBook());
  document.body.append(b);
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'b' || e.key === 'B') { modal && !modal.hidden ? closeBook() : openBook(); }
    else if (e.key === 'Escape') closeBook();
  });
}

// ---- Hidden finds ----------------------------------------------------------------------
// A small wooden crate tucked away; it only shows (with a sparkle) once Wally is
// within a few metres, and opens when he touches it.
function crate() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b3c, roughness: 0.85 }), band = new THREE.MeshStandardMaterial({ color: 0x5a3c20, roughness: 0.8 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), wood));
  for (const y of [-0.2, 0.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.57), band); b.position.y = y; g.add(b); }
  const q = document.createElement('canvas'); q.width = q.height = 64; const c = q.getContext('2d');
  c.fillStyle = '#ffe08a'; c.font = 'bold 50px sans-serif'; c.textAlign = 'center'; c.fillText('?', 32, 50);
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(q), transparent: true }));
  mark.position.set(0, 0, 0.281); g.add(mark);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class HiddenFinds {
  // spots: candidate places [{ x, y, z }]; n of them are used, at random, each visit.
  constructor(scene, spots, n = 3) {
    const pick = [...spots].sort(() => Math.random() - 0.5).slice(0, n);
    this.list = pick.map(s => { const m = crate(); m.position.set(s.x, s.y + 0.28, s.z); m.rotation.y = Math.random() * 6; m.visible = false; scene.add(m); return { ...s, mesh: m, found: false }; });
  }
  get found() { return this.list.filter(f => f.found).length; }
  // pos: Wally's feet. Returns rewards found this frame ({ text }).
  update(dt, t, pos) {
    const out = [];
    for (const f of this.list) {
      if (f.found) { if (f.mesh.visible) { f.mesh.scale.multiplyScalar(1 - dt * 3); if (f.mesh.scale.x < 0.05) f.mesh.visible = false; } continue; }
      const d = Math.hypot(pos.x - f.x, pos.z - f.z);
      f.mesh.visible = d < 6;                                       // hidden until he is close
      if (f.mesh.visible) f.mesh.position.y = f.y + 0.28 + Math.abs(Math.sin(t * 3)) * 0.06;
      if (d < 1.3 * ability('swisher') && Math.abs(pos.y - f.y) < 2) {
        f.found = true;
        let p = load(); const r = hiddenReward(Math.random, p); p = applyReward(p, r); save(p);
        const a = r.kind === 'ability' && ABILITIES.find(x => x.id === r.id);
        out.push({ text: a ? `Hidden find: ${a.name}, now level ${abilityLevel(p, a.id)}!` : `Hidden find: ${r.n} Tourist Token${r.n > 1 ? 's' : ''}!` });
        bookEvent('hidden');
        bookFound(a ? a.id : 'token');
        if (this.found === this.list.length) bookEvent('hiddenAll');
      }
    }
    return out;
  }
}
