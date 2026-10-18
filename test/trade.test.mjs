// Friendly traders (Ken, 2026-10-18): random groups that offer a trade for a special gift.
import { pickTraders, makeOffer, receive, giftText, SOUVENIRS, PRICES, pay, canPay } from '../js/trade-rules.js';
import { freshProgress, readProgress } from '../js/progress.js';
import { MAX_LEVEL, ABILITIES } from '../js/book-rules.js';

let pass = 0, fail = 0;
function check(name, ok, detail = '') { if (ok) pass++; else { fail++; console.log('FAIL', name, detail); } }
function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

// Which groups trade: random, never none.
let always = true, differ = false, first = null, some = 0;
for (let seed = 1; seed < 300; seed++) {
  const t = pickTraders(8, seeded(seed));
  if (!t.length) always = false;
  if (t.some(i => i < 0 || i >= 8)) always = false;
  some += t.length;
  const k = t.join(); if (first === null) first = k; else if (k !== first) differ = true;
}
check('there is always at least one trader', always);
check('which groups trade changes from visit to visit', differ);
check('about a quarter of the groups trade, on average', some / 299 > 1.5 && some / 299 < 3.2, some / 299);
check('no groups, no traders', pickTraders(0, Math.random).length === 0);

// Offers.
const p = freshProgress();
for (const land of ['park', 'esplanade', 'kuranda']) {
  const o = makeOffer(land, seeded(7), p);
  check(`${land}: the price is something that land's chain gives`, PRICES[land].some(x => x.what === o.price.what && x.n === o.price.n));
  check(`${land}: a souvenir from that land`, SOUVENIRS[land].some(([id]) => id === o.souvenir.id));
  check(`${land}: the gift can be put in words`, giftText(o.gift).length > 3);
}
// A new souvenir while any are left.
const almost = { ...p, souvenirs: SOUVENIRS.park.slice(0, 3).map(([id]) => id) };
check('the souvenir is one not yet collected', [1, 2, 3, 4, 5].every(s => makeOffer('park', seeded(s), almost).souvenir.id === SOUVENIRS.park[3][0]));
// Receiving.
const ab = receive(p, { gift: { kind: 'item', id: 'net' }, souvenir: { id: 'croc-tooth' } });
check('an item gift goes in the bag and the souvenir is kept', ab.gear.net === 1 && ab.souvenirs.includes('croc-tooth'));
check('a tokens gift adds tokens', receive(p, { gift: { kind: 'tokens', n: 3 }, souvenir: { id: 'feather' } }).tokens === 3);
const maxed = { ...p, abilities: Object.fromEntries(ABILITIES.map(a => [a.id, MAX_LEVEL])) };
check('gifts are items, tokens or a full feed-o-meter', [1, 2, 3, 4, 5, 6, 7, 8].every(s => ['item', 'tokens', 'feed'].includes(makeOffer('park', seeded(s), maxed).gift.kind)));
check('souvenirs are saved', readProgress(JSON.stringify(ab)).souvenirs.includes('croc-tooth'));

// Paying: this visit's finds first, then the bank.
const price = { what: 'mangoes', n: 3 };
const r1 = pay({ mangoes: 5 }, { mangoes: 2 }, price);
check('pays from this visit first, then the bank', r1.ok && r1.run.mangoes === 0 && r1.progress.mangoes === 4);
check('cannot pay with too little', !pay({ mangoes: 1 }, { mangoes: 1 }, price).ok && !canPay({ mangoes: 1 }, { mangoes: 1 }, price));
check('can pay entirely from this visit', pay({ mangoes: 0 }, { mangoes: 4 }, price).run.mangoes === 1);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
