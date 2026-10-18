// trade.js
// The trade panel (Ken, 2026-10-18): when Wally steps inside a trader group's
// circle, their offer slides up: a special gift and a souvenir for something he
// carries. T (or the button) takes it; walking away leaves it. The rules are in
// trade-rules.js; each level says how it pays and what a full feed-o-meter means.
//
//   startTrading({ land, run: () => counts picked up this visit, setRun(counts),
//                  feed: () => fill the feed-o-meter, say(text), toast(text) })
//   then each frame: tradeStep(events from clusters.update, Wally's position)

import { readProgress, saveProgress } from './progress.js';
import { makeOffer, giftText, pay, canPay, receive } from './trade-rules.js';
import { bookEvent, bookFound } from './book.js';
import { CLUSTER } from './rules.js';

let panel = null, cfg = null, open = null;      // open: the cluster whose offer is showing
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function load() { return readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); }
function save(p) { saveProgress(p); }

function build() {
  panel = el('div', 'trade-panel'); panel.hidden = true;
  panel.append(el('b', 'trade-title', 'A trade!'), el('p', 'trade-text'), el('div', 'trade-buttons'));
  document.body.append(panel);
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if ((e.key === 't' || e.key === 'T') && open) accept();
  });
}

function show(c) {
  open = c;
  const p = load(), o = c.offer, able = canPay(p, cfg.run(), o.price);
  panel.querySelector('.trade-text').textContent = `"G'day, Wally! Swap you ${giftText(o.gift)} and a ${o.souvenir.name} for ${o.price.n} ${o.price.name}?"`;
  const bs = panel.querySelector('.trade-buttons'); bs.innerHTML = '';
  const yes = el('button', 'buy', able ? 'Trade (T)' : `Need ${o.price.n} ${o.price.name}`); yes.type = 'button'; yes.disabled = !able; yes.onclick = accept;
  const no = el('button', 'link', 'No thanks'); no.type = 'button'; no.onclick = () => { panel.hidden = true; c.declined = true; open = null; };
  bs.append(yes, no);
  panel.hidden = false;
}

function accept() {
  const c = open; if (!c || c.traded) return;
  const r = pay(load(), cfg.run(), c.offer.price);
  if (!r.ok) return;
  cfg.setRun(r.run);
  save(receive(r.progress, c.offer));
  if (c.offer.gift.kind === 'feed') cfg.feed();
  c.traded = true; open = null; panel.hidden = true;
  if (c.tradeSign) c.tradeSign.visible = false;
  cfg.toast(`Traded! ${giftText(c.offer.gift)} and a ${c.offer.souvenir.name}`);
  cfg.say(c, 'Pleasure doing business, mate!');
  bookEvent('gift');
  if (c.offer.gift.kind === 'ability') bookFound(c.offer.gift.id); else if (c.offer.gift.kind === 'tokens') bookFound('token');
}

export function startTrading(options) { cfg = options; if (!panel) build(); }

// events: what clusters.update returned this frame. pos: Wally.
export function tradeStep(events, pos) {
  if (!cfg) return;
  for (const e of events) {
    if (e.type !== 'trade' || e.cluster.traded || e.cluster.declined) continue;
    if (!e.cluster.offer) e.cluster.offer = makeOffer(cfg.land, Math.random, load());
    show(e.cluster);
  }
  // Walking away leaves the offer (it is made again on coming back).
  if (open) {
    const q = open.root.position;
    if (Math.hypot(pos.x - q.x, pos.z - q.z) > CLUSTER.near + 2.5) { panel.hidden = true; open.declined = false; open = null; }
  }
}
