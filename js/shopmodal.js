// shopmodal.js
// The outfit catalogue (Ken, 2026-10-17): one shopping list of complete
// outfits instead of separate stalls, opened from any screen (the Outfits
// button) and at the Kuranda market stalls. A live 3D preview shows the croc
// turning in whichever outfit is picked. Buy with Golden Mangoes (one day an
// in-app purchase), wear what you own, and give your croc a name.

import * as THREE from 'three';
import { readProgress, OUTFITS, buyItem, wearItem, outfitOn, outfitModel, wearing, crocName, setCrocName, EXTRAS, hasExtra, buyExtra } from './progress.js';
import { loadModels, ModelSkin } from './models.js';
import { dressOutfit } from './outfit.js';
import { cleanName } from './leaderboard-rules.js';

let modal = null, onPause = null, preview = null, picked = null, startModel = null;
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function load() { return readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); }
function save(p) { try { localStorage.setItem('chomp-progress', JSON.stringify(p)); } catch { /* not saved */ } }
const hex = c => '#' + c.toString(16).padStart(6, '0');

// The swatch for an outfit card: its colours, or a picture marker for a model outfit.
function swatch(o) {
  const s = el('span', 'sw');
  const L = o.look || {}, a = L.shirt || L.vest, b = L.shorts;
  if (o.model) { s.textContent = o.needs ? '…' : '★'; s.classList.add('sw-model'); }
  else if (!a) s.style.background = o.who === 'wally' ? 'linear-gradient(135deg,#f06a2a 50%,#f06a2a 50%)' : '#8a6a48';
  else if (a.style === 'disco') s.style.background = 'linear-gradient(135deg,#ff2fa8,#ffd23a,#39ff6a,#40c0ff,#d040ff)';
  else s.style.background = `linear-gradient(135deg, ${hex(a.colour)} 0 55%, ${hex((b || a).colour)} 55% 100%)`;
  if (a && a.style === 'neon') s.style.boxShadow = `0 0 10px ${hex(a.colour)}`;
  return s;
}

// ---- The 3D preview ---------------------------------------------------------------
async function makePreview(box) {
  const canvas = el('canvas', 'shop-canvas'); box.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6a50, 2.2));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4); sun.position.set(2, 4, 3); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 1.5, 6.2); camera.lookAt(0, 1.25, 0);
  const holder = new THREE.Group(); scene.add(holder);
  const models = await loadModels(['wally', 'wally-explorer', 'kenny'], { light: true });
  let skin = null, who = null, t0 = performance.now();
  const size = () => { const w = box.clientWidth || 300, h = Math.round(w * 1.15); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size(); addEventListener('resize', size);
  const show = o => {
    holder.clear(); skin = null; who = o.who;
    const gltf = models.get(o.who === 'kenny' ? 'kenny' : (o.model && !o.needs ? o.model : 'wally'));
    if (!gltf) return;
    skin = new ModelSkin(gltf, { height: o.who === 'kenny' ? 1.6 : 2.6 });
    holder.add(skin.root);
    if (!o.model || o.who === 'kenny') dressOutfit(skin.root, o.who, (o.look) || {});
    skin.play('idle', { alternatives: ['walk'] });
  };
  let last = performance.now();
  const tick = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (modal && !modal.hidden) {
      holder.rotation.y = Math.sin((now - t0) / 1600) * 0.9;
      if (skin) skin.update(dt);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { show };
}

// ---- The list ------------------------------------------------------------------------
function render() {
  const progress = load(), owned = progress.wardrobe.owned;
  modal.querySelector('.shop-mangoes').textContent = progress.mangoes || 0;
  const name = modal.querySelector('.shop-name input');
  if (document.activeElement !== name) name.value = progress.crocName || '';
  for (const who of ['wally', 'kenny']) {
    const list = modal.querySelector(`.shop-grid[data-who="${who}"]`); list.innerHTML = '';
    const on = outfitOn(progress, who);
    for (const o of OUTFITS.filter(i => i.who === who)) {
      const card = el('button', `shop-item${o.id === (picked && picked.id) ? ' picked' : ''}${o.needs ? ' soon' : ''}`);
      card.type = 'button';
      card.append(swatch(o), el('b', null, o.name));
      const state = o.needs ? 'Coming soon' : on.id === o.id ? 'Wearing' : owned.includes(o.id) ? 'Owned' : `🥭 ${o.price}`;
      card.append(el('span', `st${on.id === o.id ? ' on' : ''}`, state));
      card.onclick = () => { picked = o; if (preview) preview.show(o); render(); };
      list.append(card);
    }
  }
  // Gear and tickets: things that are separate or do not move with him (Ken).
  const xl = modal.querySelector('.shop-grid[data-who="extras"]'); xl.innerHTML = '';
  for (const x of EXTRAS) {
    const card = el('div', `shop-item extra${x.ready ? '' : ' soon'}`);
    const icon = el('span', 'sw sw-model', x.kind === 'gear' ? '🪃' : '🎟');
    card.append(icon, el('b', null, x.name), el('small', null, x.about));
    if (hasExtra(progress, x.id)) card.append(el('span', 'st on', 'Got it'));
    else if (!x.ready) card.append(el('span', 'st', 'Coming soon'));
    else {
      const b = el('button', 'buy', `🥭 ${x.price}`); b.type = 'button'; b.disabled = (progress.mangoes || 0) < x.price;
      b.onclick = () => { const r = buyExtra(load(), x.id); if (r.ok) { save(r.progress); modal.querySelector('.shop-msg').textContent = `${x.name}: got it!`; render(); } };
      card.append(b);
    }
    xl.append(card);
  }
  // The picked outfit's details and its button.
  const d = modal.querySelector('.shop-detail'); d.innerHTML = '';
  const o = picked || outfitOn(progress, 'wally');
  d.append(el('h3', null, o.name), el('p', null, o.about || ''));
  const msg = modal.querySelector('.shop-msg');
  if (o.needs) d.append(el('p', 'fine', 'Coming soon: her model is on the way.'));
  else if (outfitOn(progress, o.who).id === o.id) d.append(el('p', 'fine', 'Wearing it now.'));
  else if (owned.includes(o.id)) {
    const b = el('button', 'go', 'Wear it'); b.type = 'button';
    b.onclick = () => { save(wearItem(load(), o.id)); after(); };
    d.append(b);
  } else {
    const b = el('button', 'go', `Buy for 🥭 ${o.price}`); b.type = 'button';
    b.disabled = (progress.mangoes || 0) < o.price;
    b.onclick = () => { const r = buyItem(load(), o.id); if (r.ok) { save(wearItem(r.progress, o.id)); after(); } };
    d.append(b);
    if (b.disabled) d.append(el('p', 'fine', 'Not enough Golden Mangoes yet: collect them on the Esplanade.'));
  }
  function after() {
    render();
    const p = load();
    if (outfitModel(p) !== startModel) {
      msg.innerHTML = '';
      msg.append(el('span', null, "That's a whole new look: it goes on at the start of the next level. "));
      const r = el('button', 'link', 'Start this level again in it'); r.type = 'button'; r.onclick = () => location.reload();
      msg.append(r);
    } else { msg.textContent = 'Ripper! Looking good.'; if (window.chompDress) window.chompDress(); }
  }
}

function build() {
  modal = el('div', 'map-modal shop-modal'); modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', 'Outfits');
  const card = el('div', 'card shop-cat');
  const close = el('button', 'map-close', '✕'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.onclick = closeShop;
  card.append(close, el('h1', null, 'Outfits'));
  const top = el('div', 'shop-top');
  const nm = el('label', 'shop-name'); nm.append(el('span', null, 'Your croc\'s name '));
  const input = el('input'); input.maxLength = 16; input.placeholder = 'Wally'; nm.append(input);
  const saveName = el('button', 'link', 'Save'); saveName.type = 'button';
  saveName.onclick = () => {
    const raw = input.value.trim(), n = raw ? cleanName(raw) : null;
    if (raw && !n) { modal.querySelector('.shop-msg').textContent = 'Use 2 to 16 letters or numbers (and keep it friendly).'; return; }
    save(setCrocName(load(), n)); modal.querySelector('.shop-msg').textContent = n ? `G'day, ${n}!` : 'Back to Wally.';
  };
  nm.append(saveName);
  top.append(nm, el('span', 'shop-bank', ''));
  top.querySelector('.shop-bank').innerHTML = 'Golden Mangoes: <b class="shop-mangoes">0</b>';
  card.append(top);
  const body = el('div', 'shop-body');
  const lists = el('div', 'shop-lists');
  lists.append(el('h3', null, 'Wally'), el('div', 'shop-grid'));
  lists.lastChild.dataset.who = 'wally';
  lists.append(el('h3', null, 'Kenny'), el('div', 'shop-grid')); lists.lastChild.dataset.who = 'kenny';
  lists.append(el('h3', null, 'Gear and tickets'), el('div', 'shop-grid extras')); lists.lastChild.dataset.who = 'extras';
  const side = el('div', 'shop-side'); const pv = el('div', 'shop-preview'); side.append(pv, el('div', 'shop-detail'));
  body.append(lists, side); card.append(body, el('p', 'shop-msg fine'));
  modal.append(card);
  modal.addEventListener('click', e => { if (e.target === modal) closeShop(); });
  document.body.append(modal);
  makePreview(pv).then(p => { preview = p; preview.show(picked || outfitOn(load(), 'wally')); });
}

export function openShop() {
  if (!modal) build();
  startModel = startModel || outfitModel(load());
  picked = picked || outfitOn(load(), 'wally');
  modal.querySelector('.shop-msg').textContent = '';
  render(); modal.hidden = false;
  if (onPause) onPause(true);
}
export function closeShop() { if (!modal || modal.hidden) return; modal.hidden = true; if (onPause) onPause(false); }

// The Outfits button, on every page. pause(on): the page's own pause.
export function installShop({ pause = null } = {}) {
  onPause = pause;
  startModel = outfitModel(load());
  const b = el('button', 'map-button shop-button', '🛍 Outfits'); b.type = 'button';
  b.onclick = () => (modal && !modal.hidden ? closeShop() : openShop());
  document.body.append(b);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeShop(); });
}
