// vendormodal.js
// The shell and mango trader at the Kuranda markets (Ken, 2026-10-18): the
// chain's third link. Wally sells the Golden Mangoes from Croc Park and the
// seashells from the reef for gold pieces, and gold buys the river-boat ticket
// to the Daintree (in the Outfits catalogue, under Gear and tickets).

import { readProgress, sellToVendor, VENDOR_PAYS, BOAT_TICKET_PRICE, saveProgress } from './progress.js';
import { bookEvent } from './book.js';

let modal = null, onPause = null, onChange = null;
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function load() { return readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); }
function save(p) { saveProgress(p); }

function build() {
  modal = el('div', 'map-modal vendor-modal'); modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', 'The shell and mango trader');
  const card = el('div', 'card vendor-card');
  const close = el('button', 'map-close', '✕'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.onclick = closeVendor;
  card.append(close, el('h1', null, 'Shell and mango trader'),
    el('p', 'sub', `"G'day! I'll give you gold for your Golden Mangoes and seashells."`),
    el('div', 'vendor-rows'), el('p', 'vendor-bank'), el('p', 'vendor-msg fine'),
    el('p', 'fine', `Gold buys the river-boat ticket to the Daintree (${BOAT_TICKET_PRICE} gold): Outfits, then Gear and tickets.`));
  modal.append(card);
  modal.addEventListener('click', e => { if (e.target === modal) closeVendor(); });
  document.body.append(modal);
}

function render(message = '') {
  const p = load();
  const rows = modal.querySelector('.vendor-rows'); rows.innerHTML = '';
  for (const [kind, name, icon, have] of [['mangoes', 'Golden Mangoes', '🥭', p.mangoes || 0], ['shells', 'Seashells', '🐚', p.shells || 0]]) {
    const row = el('div', 'vendor-row');
    row.append(el('span', 'vendor-what', `${icon} ${name}: ${have}`), el('span', 'vendor-rate', `${VENDOR_PAYS[kind]} gold each`));
    for (const [label, n] of [['Sell 1', 1], ['Sell all', have]]) {
      const b = el('button', 'buy', label); b.type = 'button'; b.disabled = have < 1;
      b.onclick = () => {
        const r = sellToVendor(load(), { [kind]: n });
        save(r.progress); if (onChange) onChange(r.progress); if (r.gold > 0) bookEvent('sell');
        render(`Sold for ${r.gold} gold. Pleasure doing business, mate!`);
      };
      row.append(b);
    }
    rows.append(row);
  }
  modal.querySelector('.vendor-bank').textContent = `Your gold: ${p.coins || 0}`;
  modal.querySelector('.vendor-msg').textContent = message;
}

export function openVendor() {
  if (!modal) build();
  render(); modal.hidden = false;
  if (onPause) onPause(true);
}
export function closeVendor() { if (!modal || modal.hidden) return; modal.hidden = true; if (onPause) onPause(false); }

// pause(on): the page's own pause. change(progress): called after a sale.
export function installVendor({ pause = null, change = null } = {}) {
  onPause = pause; onChange = change;
  addEventListener('keydown', e => { if (e.key === 'Escape') closeVendor(); });
}
