// trade-rules.js
// Friendly traders (Ken, 2026-10-18): some groups of visitors do not run away
// when Wally comes close; they offer a trade instead, a special gift for
// something he carries. Which groups is random, a fresh pick every visit, and
// nobody can tell until Wally steps inside their circle. Plain JavaScript, no
// three.js, so it can be tested (test/trade.test.mjs).

import { ABILITIES, giveGear } from './book-rules.js';

// Souvenirs: the keepsakes traders hand over, collected in Wally's Tourist Book.
export const SOUVENIRS = {
  park:      [['croc-tooth', 'Croc tooth necklace'], ['ranger-pin', 'Ranger hat pin'], ['feather', 'Cassowary feather'], ['postcard-park', 'Croc Park postcard']],
  esplanade: [['sea-glass', 'Sea glass'], ['pelican-pin', 'Pelican badge'], ['sun-hat', 'Tiny sun hat'], ['postcard-esp', 'Esplanade postcard']],
  kuranda:   [['butterfly', 'Ulysses butterfly brooch'], ['didj-key', 'Carved key ring'], ['coffee', 'Bag of Tableland coffee'], ['postcard-kur', 'Kuranda postcard']],
};

// What a trader asks for in each land: something the chain has given Wally by then.
export const PRICES = {
  park:      [{ what: 'mangoes', n: 2, name: 'Golden Mangoes' }],
  esplanade: [{ what: 'pearls', n: 1, name: 'pearl' }, { what: 'mangoes', n: 6, name: 'Golden Mangoes' }],
  kuranda:   [{ what: 'mangoes', n: 3, name: 'Golden Mangoes' }, { what: 'shells', n: 2, name: 'seashells' }],
};

// Where each thing the traders take comes from (Ken: a button to go back there,
// so there is a purpose to going back to other lands).
export const SOURCE = {
  mangoes: { land: 'esplanade', page: 'esplanade.html?play', name: 'the Esplanade' },
  pearls:  { land: 'esplanade', page: 'esplanade.html', name: 'the Esplanade' },
  shells:  { land: 'reef', page: 'reef.html', name: 'the Great Barrier Reef' },
  coins:   { land: 'kuranda', page: 'kuranda.html', name: 'the Kuranda markets' },
};

// Which groups are traders this visit: each with chance `chance`, and always at least one.
export function pickTraders(n, rnd, chance = 0.25) {
  if (n <= 0) return [];
  const out = [];
  for (let i = 0; i < n; i++) if (rnd() < chance) out.push(i);
  if (!out.length) out.push(Math.floor(rnd() * n));
  return out;
}

// A trader's offer: a price, a special gift and a souvenir (one not yet collected, when there is one).
export function makeOffer(land, rnd, progress) {
  const prices = PRICES[land] || PRICES.park;
  const price = prices[Math.floor(rnd() * prices.length)];
  const r = rnd();
  const gift = r < 0.4 ? { kind: 'item', id: ABILITIES[Math.floor(rnd() * ABILITIES.length)].id }
    : r < 0.7 ? { kind: 'tokens', n: 3 } : { kind: 'feed' };
  const pool = SOUVENIRS[land] || SOUVENIRS.park, have = progress.souvenirs || [];
  const fresh = pool.filter(([id]) => !have.includes(id));
  const [sid, sname] = (fresh.length ? fresh : pool)[Math.floor(rnd() * (fresh.length ? fresh : pool).length)];
  return { price, gift, souvenir: { id: sid, name: sname } };
}

// What the gift is, in words.
export function giftText(gift) {
  if (gift.kind === 'item') { const a = ABILITIES.find(x => x.id === gift.id); return `a ${a.name}`; }
  if (gift.kind === 'tokens') return `${gift.n} Golden Mangoes`;
  return 'a full feed-o-meter';
}

// The saved side of a trade: the souvenir, and an ability level or Golden Mangoes.
// (Paying, and a full feed-o-meter, belong to the level, which holds what he carries.)
export function receive(progress, offer) {
  return applyGift({ ...progress, souvenirs: [...new Set([...(progress.souvenirs || []), offer.souvenir.id])] }, offer.gift);
}
// The saved side of a gift alone (also a sidequest's thank-you): an ability level or Golden Mangoes.
export function applyGift(progress, g) {
  if (g.kind === 'item') return giveGear(progress, g.id);
  if (g.kind === 'tokens') return { ...progress, mangoes: (progress.mangoes || 0) + g.n };
  return progress;
}

// Paying a trader: first from what Wally has picked up on this visit (run),
// then from what he has banked (progress). Returns { ok, run, progress }.
export function pay(progress, run, price) {
  const fromRun = Math.min(run[price.what] || 0, price.n), rest = price.n - fromRun;
  if ((progress[price.what] || 0) < rest) return { ok: false, run, progress };
  return { ok: true, run: { ...run, [price.what]: (run[price.what] || 0) - fromRun }, progress: { ...progress, [price.what]: (progress[price.what] || 0) - rest } };
}
export function canPay(progress, run, price) { return (run[price.what] || 0) + (progress[price.what] || 0) >= price.n; }
