// gear.js
// Using the item Wally carries (Ken, 2026-10-18: owning an item is not using
// it). One item is equipped at a time, on his page in the Tourist Book; F uses
// it, and each use wears it down (book-rules.js: equip, useGear):
//   Big Net       swings round and scoops up all the tucker near him
//   Tail Swisher  a sweep of the tail pulls in pickups all round him
//   Snorkel       under water, his air stays full for one long dive
//   Spring Step   his next jump goes much higher
// A badge on screen shows what he carries and how many uses are left.
//
//   installGear({ scene, wally, toast, food, mouth: () => Vector3, hasAir, underWater: () => bool })

import * as THREE from 'three';
import { readProgress, saveProgress, PROGRESS_CHANGED } from './progress.js';
import { useGear, ABILITIES, equip, unequip, gearStock, fullUses, buyGear, GEAR_PRICE } from './book-rules.js';

const NET_REACH = 4.5, SWISH_REACH = 4.2;
let cfg = null, badge = null, swishUntil = 0, snorkelUntil = 0, vitaminUntil = 0, modal = null, prop = null, propFor = null;
const load = () => readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })());

// For the rest of the game: is the tail sweeping right now, is the snorkel in?
export function swishing() { return performance.now() < swishUntil; }
export function snorkelling() { return performance.now() < snorkelUntil; }
// Vitamins: how fast the feed-o-meter runs down (1 normally, half while a dose lasts).
export function drainFactor() { return performance.now() < vitaminUntil ? 0.5 : 1; }
export const SWISH = SWISH_REACH;

// A ring sweeping out round Wally: what the net or tail swing looks like.
function sweep(colour, reach) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 48), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = Math.PI / 2; ring.userData.noAO = true;
  ring.position.copy(cfg.wally.pos).add(new THREE.Vector3(0, 1, 0));
  cfg.scene.add(ring);
  const t0 = performance.now();
  const grow = () => {
    const u = (performance.now() - t0) / 450;
    ring.scale.setScalar(0.5 + u * reach); ring.material.opacity = 0.8 * (1 - u);
    ring.position.copy(cfg.wally.pos).add(new THREE.Vector3(0, 1, 0));
    if (u < 1) requestAnimationFrame(grow); else { cfg.scene.remove(ring); ring.material.dispose(); }
  };
  requestAnimationFrame(grow);
}

function drawBadge() {
  if (!badge) return;
  const p = load(), a = ABILITIES.find(x => x.id === p.equipped);
  badge.innerHTML = '';
  if (!a) { badge.append(Object.assign(document.createElement('span'), { textContent: 'No item · B to equip' })); badge.classList.add('empty'); return; }
  badge.classList.remove('empty');
  const big = document.createElement('span'); big.className = 'icon'; big.textContent = a.icon;
  const count = document.createElement('span'); count.className = 'count'; count.textContent = p.uses;      // Ken: a number that counts down with each use
  const name = document.createElement('b'); name.textContent = a.name;
  const left = document.createElement('small'); left.textContent = 'F to use';
  badge.append(big, count, name, left);
  badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump');
}

export function useItem() {
  if (!cfg) return;
  const p = load();
  if (!p.equipped) { cfg.toast('No item equipped: open the book (B) and equip one', 'info'); return; }
  const id = p.equipped, a = ABILITIES.find(x => x.id === id);
  if (id === 'net') {
    if (!cfg.food) { cfg.toast('Nothing to catch here', 'info'); return; }
    const me = cfg.wally.pos, mouth = cfg.mouth();
    let n = 0;
    for (const it of [...cfg.food.items]) {
      if (it.taken || it.claimed) continue;
      if (it.mesh.position.distanceTo(new THREE.Vector3(me.x, me.y + 1, me.z)) < NET_REACH) { it.mesh.position.copy(mouth); n++; }   // into the net, and so to his mouth
    }
    sweep(0x9fe8ff, NET_REACH);
    cfg.toast(n ? `Swoosh! The net got ${n}` : 'Swoosh! Nothing in range that time', n ? 'good' : 'info');
  } else if (id === 'swisher') {
    swishUntil = performance.now() + 700; sweep(0x8fdc6a, SWISH_REACH);
    cfg.toast('Tail swish!', 'good');
  } else if (id === 'snorkel') {
    if (!cfg.hasAir) { cfg.toast('No need for a snorkel here', 'info'); return; }
    if (!cfg.underWater()) { cfg.toast('Dive first, then use the snorkel', 'info'); return; }
    snorkelUntil = performance.now() + 30000;
    cfg.toast('Snorkel in: 30 seconds of air!', 'good');
  } else if (id === 'spring') {
    cfg.wally.springNext = true;
    cfg.toast('Spring Step: jump!', 'good');
  } else if (id === 'vitamins') {
    if (cfg.noFeed) { cfg.toast('No feed-o-meter here: save them for later', 'info'); return; }
    vitaminUntil = performance.now() + 60000;
    cfg.toast('Vitamins! The feed-o-meter runs down at half speed for a minute', 'good');
  }
  const r = useGear(p);
  saveProgress(r.progress);
  if (r.wornOut) cfg.toast(r.progress.equipped ? `${a.name} worn out: a fresh one from the bag` : `${a.name} worn out. Find another, or buy one in the book`, 'info');
  drawBadge();
}

export function installGear(options) {
  cfg = options;
  badge = document.createElement('button'); badge.type = 'button'; badge.className = 'gear-badge'; badge.title = 'The item Wally carries (F to use, B to change)';
  badge.onclick = openGear;
  document.body.append(badge);
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'map-button gear-button'; btn.textContent = '🎒 Gear'; btn.title = "What Wally carries (G)";
  btn.onclick = () => (modal && !modal.hidden ? closeGear() : openGear());
  document.body.append(btn);
  drawBadge(); showProp();
  addEventListener(PROGRESS_CHANGED, () => { drawBadge(); showProp(); if (modal && !modal.hidden) drawGear(); });
  requestAnimationFrame(follow);
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if ((e.key === 'f' || e.key === 'F') && !e.repeat && (!cfg.running || cfg.running())) useItem();
    else if (e.key === 'g' || e.key === 'G') (modal && !modal.hidden ? closeGear() : openGear());
    else if (e.key === 'Escape') closeGear();
  });
}

// ---- The Gear panel (Ken: a button that shows what he has, to equip or use it) -----------------
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function drawGear() {
  const p = load(), body = modal.querySelector('.gear-body'); body.innerHTML = '';
  body.append(el('p', 'book-tokens', `Tourist Tokens: ${p.tokens || 0}`), el('p', 'fine', 'Carry one item at a time. It shows on Wally, and F uses it; the number counts down with each use.'));
  for (const a of ABILITIES) {
    const stock = gearStock(p, a.id), part = (p.partial || {})[a.id] || 0, on = p.equipped === a.id;
    const row = el('div', `book-ability${on ? ' equipped' : ''}`);
    row.append(el('span', 'icon', a.icon), el('div', 'what'), el('span', 'gear-count', on ? String(p.uses) : String(stock + (part ? 1 : 0))));
    row.querySelector('.what').append(el('b', null, a.name + (on ? ' (carrying)' : '')), el('small', null, a.about),
      el('small', 'stock', on ? `${p.uses} uses left in this one · ${stock} more in the bag` : `In the bag: ${stock}${part ? ` (and one part-used, ${part} left)` : ''} · ${fullUses(p, a.id)} uses each`));
    const btns = el('div', 'gear-btns');
    const eq = el('button', 'buy', on ? 'Put away' : 'Equip'); eq.type = 'button'; eq.disabled = !on && !stock && !part;
    eq.onclick = () => { const q = load(); saveProgress(on ? unequip(q) : equip(q, a.id).progress); };
    btns.append(eq);
    if (on) { const use = el('button', 'buy', 'Use it now'); use.type = 'button'; use.onclick = () => { closeGear(); useItem(); }; btns.append(use); }
    const buy = el('button', 'buy alt', `Buy one: ${GEAR_PRICE} tokens`); buy.type = 'button'; buy.disabled = (p.tokens || 0) < GEAR_PRICE;
    buy.onclick = () => { const r = buyGear(load(), a.id); if (r.ok) saveProgress(r.progress); };
    btns.append(buy); row.append(btns); body.append(row);
  }
}
export function openGear() {
  if (!modal) {
    modal = el('div', 'map-modal gear-modal'); modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', 'Gear');
    const card = el('div', 'card book-card');
    const x = el('button', 'map-close', '✕'); x.type = 'button'; x.onclick = closeGear;
    const back = el('button', 'go book-back', 'Back to the game'); back.type = 'button'; back.onclick = closeGear;
    card.append(x, el('h1', null, "Wally's Gear"), el('div', 'gear-body'), back);
    modal.append(card); modal.addEventListener('click', e => { if (e.target === modal) closeGear(); });
    document.body.append(modal);
  }
  drawGear(); modal.hidden = false;
  if (cfg.pause) cfg.pause(true);
}
export function closeGear() { if (!modal || modal.hidden) return; modal.hidden = true; if (cfg.pause) cfg.pause(false); }

// ---- The item, on Wally (Ken: show it on him) -----------------------------------------------------
// Built from shapes and carried on the right bone: the net in his hand, the
// snorkel and mask on his head, springs under his feet, a bright band on his tail.
function makeProp(id) {
  const g = new THREE.Group();
  const m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });
  if (id === 'vitamins') {                                         // a little bottle clipped at his hip
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 12), m(0xff8a3d)); g.add(bottle);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.07, 12), m(0xffffff)); cap.position.y = 0.15; g.add(cap);
  } else if (id === 'net') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 8), m(0x8a5a2b)); handle.position.y = 0.75; g.add(handle);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 32), m(0xffd23a)); hoop.position.y = 1.95; g.add(hoop);
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.49, 0.8, 16, 4, true), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, wireframe: true }));
    mesh.rotation.x = Math.PI / 2; mesh.position.set(0, 1.95, -0.4); g.add(mesh);
  } else if (id === 'snorkel') {
    const mask = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 8, 20), m(0xff7a1a)); mask.scale.set(1.3, 0.8, 1); g.add(mask);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.16, 18), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.5, roughness: 0.05 })); glass.scale.set(1.3, 0.8, 1); g.add(glass);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), m(0xffd23a)); tube.position.set(0.24, 0.25, -0.05); g.add(tube);
  } else if (id === 'spring') {
    for (const s of [-1, 1]) { const coil = new THREE.Mesh(new THREE.TorusKnotGeometry(0.1, 0.02, 48, 6, 1, 6), m(0xc0c4c8)); coil.position.set(s * 0.25, 0, 0); coil.scale.set(1, 2.2, 1); coil.userData.foot = s; g.add(coil); }
  } else {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 20), m(0x8fdc6a)); band.rotation.y = Math.PI / 2; g.add(band);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.45), new THREE.MeshStandardMaterial({ color: [0xff4fa0, 0xffd23a, 0x40c0ff][i], side: THREE.DoubleSide })); r.position.set(0, -0.25, 0); r.rotation.z = (i - 1) * 0.4; g.add(r); }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function bone(pattern) {
  let found = null;
  const root = cfg.wally.skin && cfg.wally.skin.root;
  if (root) root.traverse(o => { if (!found && o.isBone && pattern.test(o.name)) found = o; });
  return found;
}
function showProp() {
  const p = load();
  if (p.equipped === propFor) return;
  if (prop) { cfg.scene.remove(prop); prop = null; }
  propFor = p.equipped;
  if (!propFor) return;
  prop = makeProp(propFor); cfg.scene.add(prop);
}
// Each frame the prop follows its bone (or a spot on Wally when the model has no bones).
const _v = new THREE.Vector3(), _q = new THREE.Quaternion();
function follow() {
  requestAnimationFrame(follow);
  if (!prop || !cfg) return;
  const w = cfg.wally, id = propFor;
  const b = id === 'net' ? bone(/right.*hand/i) : id === 'snorkel' ? bone(/^head$/i) : id === 'swisher' ? bone(/tail4/i) : bone(/hips/i);
  if (id === 'vitamins' && b) { b.getWorldPosition(_v); const f = w.facing || 0; prop.position.set(_v.x + Math.cos(f) * 0.45, _v.y, _v.z - Math.sin(f) * 0.45); prop.rotation.set(0, f, 0); return; }
  if (id === 'spring') {                                           // under his feet, wherever he is
    prop.position.set(w.pos.x, w.pos.y + 0.12, w.pos.z); prop.rotation.set(0, w.facing || 0, 0); return;
  }
  if (b) {
    b.getWorldPosition(_v);
    const f = w.facing || 0, fx = Math.sin(f), fz = Math.cos(f);
    prop.position.copy(_v); prop.rotation.set(0, f, 0);
    if (id === 'snorkel') { prop.position.x += fx * 0.45; prop.position.z += fz * 0.45; prop.position.y += 0.1; }   // over his eyes
    if (id === 'net') { prop.position.y -= 0.5; prop.rotation.set(0, f, -0.35); }                               // held up, over his shoulder
  } else {
    prop.position.set(w.pos.x, w.pos.y + (id === 'snorkel' ? 2.3 : 1.2), w.pos.z); prop.rotation.set(0, w.facing || 0, 0);
  }
}
