// progress.js
// Wally's Big Trip across Cairns: which areas are open, the stars and best
// score for each, the postcards collected and the Golden Mangoes banked.
// Pure functions, tested in test/progress.test.mjs; the page saves the result.

import { AREAS } from './quests.js';
import { readTrip, canEnter } from './trip-rules.js';

// Several parts of a page write the save (the book, trades, the trader, the
// outfit shop) while a level holds its own copy; each writes through
// saveProgress, which tells the page, so the level can reload its copy and
// never write back an older one over theirs.
export const PROGRESS_CHANGED = 'chomp-progress-changed';
const GEAR_IDS = ['swisher', 'net', 'snorkel', 'spring', 'vitamins'];
export function saveProgress(p) {
  try { localStorage.setItem('chomp-progress', JSON.stringify(p)); } catch { /* not saved */ }
  if (typeof dispatchEvent === 'function') dispatchEvent(new Event(PROGRESS_CHANGED));
}

export function freshProgress() {
  return { unlocked: ['park'], stars: {}, best: {}, postcards: [], mangoes: 0, pearls: 0, coins: 0, shells: 0, pier: false,
           badge: false, skyrail: false, boatTicket: false, wardrobe: freshWardrobe(), extras: [], crocName: null, treasures: [],
           stamps: [], tokens: 0, abilities: {}, visits: {}, souvenirs: [], sidequests: 0, discovered: [],
           gear: {}, equipped: null, uses: 0, partial: {}, tickets: {}, trip: null };
}

// Stars from a score: thresholds are [one, two, three].
export function starsFor(score, thresholds) {
  return thresholds.filter(t => score >= t).length;
}

// Record a finished area. Never lowers stars or best score; opens the next
// area that is built; the area's postcard is collected once.
export function completeArea(progress, id, { score = 0, stars = 0, mangoes = 0, pearls = 0, coins = 0, shells = 0 } = {}) {
  const p = bankFinds({ ...progress, stars: { ...progress.stars }, best: { ...progress.best }, unlocked: [...progress.unlocked], postcards: [...progress.postcards] },
                      { mangoes, pearls, coins, shells });
  p.stars[id] = Math.max(p.stars[id] || 0, stars);
  p.best[id] = Math.max(p.best[id] || 0, score);
  if (id === 'park') p.badge = true;                     // the Croc Park ranger badge: the way onto the Esplanade
  if (id === 'reef') p.skyrail = true;                   // clearing the reef earns the Skyrail pass up to Kuranda
  if (!p.postcards.includes(id)) p.postcards.push(id);
  const i = AREAS.findIndex(a => a.id === id);
  const next = AREAS[i + 1];
  if (next && next.ready && !p.unlocked.includes(next.id)) p.unlocked.push(next.id);
  return p;
}

// A level's treasure found (Ken: a treasure in every level). The first time
// pays the big reward; going back for it again pays a little.
export function findTreasure(progress, id, reward = { first: 10, again: 2 }) {
  const had = (progress.treasures || []).includes(id);
  const mangoes = had ? reward.again : reward.first;
  return { first: !had, mangoes,
           progress: { ...bankFinds(progress, { mangoes }), treasures: had ? [...progress.treasures] : [...(progress.treasures || []), id] } };
}

// Keep what was collected, finished or not (Ken: go back for more of something).
export function bankFinds(progress, { mangoes = 0, pearls = 0, coins = 0, shells = 0 } = {}) {
  return { ...progress, mangoes: (progress.mangoes || 0) + Math.max(0, mangoes),
           pearls: (progress.pearls || 0) + Math.max(0, pearls), coins: (progress.coins || 0) + Math.max(0, coins),
           shells: (progress.shells || 0) + Math.max(0, shells) };
}

// ---- The chain (Ken, 2026-10-18): each level builds on the one before ----------
//   Croc Park  -> Golden Mangoes (and the ranger badge onto the Esplanade)
//   Esplanade  -> the pier opens for mangoes brought from earlier (PIER_PRICE); pearls
//   Reef       -> a pearl opens the giant clam; seashells; clearing it earns the Skyrail pass
//   Kuranda    -> sell mangoes and shells to the market vendor for gold, and find
//                 the gold pieces visitors have dropped
//   Daintree   -> a river-boat ticket, bought with gold
// "coins" in the save are the gold pieces.
export const PIER_PRICE = 8;
export const VENDOR_PAYS = { mangoes: 1, shells: 2 };      // gold pieces for each one sold
export const BOAT_TICKET_PRICE = 20;                       // gold pieces
// Kept for older pages: the Skyrail no longer has a fare.
export const SKYRAIL_FARE = 0;

// What each main item is and where it comes from, for the map's "Needs ...".
const NEED_TEXT = {
  'gate-key': 'the gate key, from the chest on the bottom of the Croc Park lagoon',
  'big-golden-mango': 'the Big Golden Mango, from the chest by the Esplanade Lagoon',
  'skyrail-pass': "the Skyrail pass, from the reef's pirate chest",
  'gorge-pass': 'the pass from the bottom of the Barron Falls bungee',
  'boat-ticket': 'the Daintree river-boat ticket',
};

// What an area still needs before Wally can go in, or null when he can. With a
// trip (trip-rules.js), the trip's rules decide; a save without one keeps the old checks.
export function entryNeeds(progress, id) {
  if (progress.trip) {
    const e = canEnter(progress.trip, id);
    if (e.ok) return null;
    const area = AREAS.find(a => a.id === e.needs);
    return { what: e.needs || e.why, text: NEED_TEXT[e.needs] || (area ? `${area.name} finished first` : 'the area before it finished') };
  }
  if (id === 'esplanade' && !progress.badge) return { what: 'badge', text: 'a Croc Park ranger badge: finish Croc Park' };
  if (id === 'reef' && (progress.pearls || 0) < 1) return { what: 'pearls', text: 'a pearl for the giant clam: find pearls on the Esplanade and out on its pier' };
  if (id === 'kuranda' && !progress.skyrail) return { what: 'skyrail', text: 'the Skyrail pass: clear the reef' };
  if (id === 'daintree' && !progress.boatTicket) return { what: 'ticket', text: `a river-boat ticket: ${BOAT_TICKET_PRICE} gold pieces at the Kuranda markets` };
  return null;
}
// Nothing to pay at the gate any more (the Skyrail pass is earned); kept for the pages that call it.
export function payEntry(progress) { return progress; }

// The Esplanade pier: opened once, with Golden Mangoes banked from earlier
// (Ken: the second land needs what the first gave).
export function openPier(progress, price = PIER_PRICE) {
  if (progress.pier) return { progress, ok: false, why: 'open' };
  if ((progress.mangoes || 0) < price) return { progress, ok: false, why: 'mangoes' };
  return { ok: true, progress: { ...progress, mangoes: progress.mangoes - price, pier: true } };
}

// The Kuranda market vendor buys Golden Mangoes and seashells for gold pieces.
export function sellToVendor(progress, { mangoes = 0, shells = 0 } = {}) {
  const m = Math.max(0, Math.min(mangoes, progress.mangoes || 0)), sh = Math.max(0, Math.min(shells, progress.shells || 0));
  const gold = m * VENDOR_PAYS.mangoes + sh * VENDOR_PAYS.shells;
  return { gold, progress: { ...progress, mangoes: (progress.mangoes || 0) - m, shells: (progress.shells || 0) - sh, coins: (progress.coins || 0) + gold } };
}

// Vitamins from the Kuranda trader, for gold (Ken).
export const VITAMIN_PRICE = 3;
export function buyVitamins(progress) {
  if ((progress.coins || 0) < VITAMIN_PRICE) return { progress, ok: false, why: 'gold' };
  return { ok: true, progress: { ...progress, coins: progress.coins - VITAMIN_PRICE, gear: { ...(progress.gear || {}), vitamins: ((progress.gear || {}).vitamins || 0) + 1 } } };
}

// The river-boat ticket, from the Kuranda markets, in gold.
export function buyBoatTicket(progress) {
  if (progress.boatTicket) return { progress, ok: false, why: 'owned' };
  if ((progress.coins || 0) < BOAT_TICKET_PRICE) return { progress, ok: false, why: 'gold' };
  return { ok: true, progress: { ...progress, coins: progress.coins - BOAT_TICKET_PRICE, boatTicket: true } };
}

// What stars are for (Ken, 2026-10-17): they open the adventure activities.
// Clothes for Wally and Kenny are bought at the Kuranda markets with the Golden
// Mangoes he has banked. Stars needed are a first guess, easy to change.
export const ACTIVITIES = [
  { id: 'zipline',   name: 'Zip line',        area: 'kuranda', stars: 6,
    about: 'Fly across the Barron Gorge on the zip line, steering to catch food as it flies past.' },
  { id: 'bungee',    name: 'Bungee jump',     area: 'kuranda', stars: 9,
    about: 'Leap over Barron Falls and snatch the prize at the very bottom of the jump.' },
  { id: 'boomerang', name: 'Boomerang',       area: 'kuranda', stars: 12,
    about: 'Learn from a local guide to throw a boomerang and catch it on the way back.' },
  { id: 'rapids',    name: 'River rapids',    area: 'mossman', stars: 15,
    about: 'Ride the white water down Mossman Gorge on a raft.' },
  { id: 'traverse',  name: 'Line traverse',   area: 'mossman', stars: 18,
    about: 'Hand over hand along a line across the gorge, catching food as it flies past.' },
  { id: 'shop',      name: 'Kuranda markets', area: 'kuranda', stars: 0,
    about: 'New clothes for Wally and Kenny, paid for with Golden Mangoes.' },
];

// All the stars earned on the trip: the best for each area, added up.
export function totalStars(progress) {
  return Object.values(progress.stars || {}).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
}

// Is an activity open? Enough stars, and (once the areas exist) its area reached.
export function activityOpen(progress, id) {
  const a = ACTIVITIES.find(x => x.id === id);
  if (!a) return false;
  const area = AREAS.find(x => x.id === a.area);
  return totalStars(progress) >= a.stars && !!area && area.ready && progress.unlocked.includes(a.area);
}

// ---- The outfit catalogue (Ken, 2026-10-17) -----------------------------------
// One shopping list instead of separate stalls: complete outfits only (no mixing
// and matching for now), each a whole look that moves with every one of his
// moves. Two kinds:
//   model: a whole Wally model wearing it (made in Meshy from the template and
//     rigged by tools/blender-rig-variant.py), or
//   look: Wally's own model with his shirt and shorts in a matched set of colours
//     and styles (outfit.js: plain keeps the printed pattern, stripes, neon, disco).
// needs: 'model' marks an outfit shown as coming soon until its model exists.
// price is in Golden Mangoes; kept in one place so it can later become (or sit
// beside) an in-app purchase (Ken: eventually, a while off).
// The player can also give their croc a name (crocName).
const look = (shirt, shorts, style = 'plain', shirt2 = null, shorts2 = null, shortsStyle = style) =>
  ({ shirt: { colour: shirt, colour2: shirt2, style }, shorts: { colour: shorts, colour2: shorts2, style: shortsStyle } });
export const OUTFITS = [
  { id: 'classic',     who: 'wally', name: 'Classic Wally',          price: 0,  about: 'His sunset hibiscus shirt and board shorts.' },
  { id: 'reef',        who: 'wally', name: 'Reef blue',              price: 25, about: 'Reef blue Hawaiian with surf blue boardies.', look: look(0x2f8fd8, 0x1f6fd0) },
  { id: 'rainforest',  who: 'wally', name: 'Rainforest',             price: 25, about: 'Rainforest green Hawaiian with reef teal boardies.', look: look(0x2e9a4a, 0x17a8a0) },
  { id: 'lagoon',      who: 'wally', name: 'Lagoon purple',          price: 30, about: 'Lagoon purple Hawaiian with mango yellow boardies.', look: look(0x8a4fd0, 0xf5b81c) },
  { id: 'wattle',      who: 'wally', name: 'Golden wattle',          price: 30, about: 'Golden wattle Hawaiian with surf blue boardies.', look: look(0xf2c21b, 0x1f6fd0) },
  { id: 'bush',        who: 'wally', name: 'Bushman',                price: 30, about: 'Bush khaki shirt and dark shorts.', look: look(0x9a8a5a, 0x3a3a30) },
  { id: 'greengold',   who: 'wally', name: 'Green and gold',         price: 35, about: 'Striped green and gold jersey and green shorts.', look: look(0x1f7a3a, 0x1f7a3a, 'stripes', 0xf2c21b, null, 'plain') },
  { id: 'lifeguard',   who: 'wally', name: 'Surf lifesaver',         price: 35, about: 'Red and gold, like the patrol flags.', look: look(0xd8231f, 0xd8231f, 'plain', null, 0xf6c21b, 'stripes') },
  { id: 'pirate',      who: 'wally', name: 'Pirate',                 price: 40, about: 'Striped shirt and black breeches. Arr!', look: look(0xb81f2a, 0x2a2a30, 'stripes', 0xf2ece0, null, 'plain') },
  { id: 'neon',        who: 'wally', name: 'Neon',                   price: 45, about: 'Glowing pink and cyan.', look: look(0xff2fa8, 0x00e5ff, 'neon') },
  { id: 'disco',       who: 'wally', name: 'Disco',                  price: 60, about: 'Shimmering, sparkling, rolling through every colour.', look: look(0xd040ff, 0xffd23a, 'disco') },
  { id: 'explorer',    who: 'wally', name: 'Safari explorer',        price: 60, about: 'Pith helmet, aviators, safari shirt and cargo shorts.', model: 'wally-explorer' },
  { id: 'female',      who: 'wally', name: 'Her own croc',           price: 0,  about: 'A female croc of her own, with her own look.', needs: 'model', model: 'croc-female' },
  // Kenny's vests (a recolour of his own vest).
  { id: 'vest-ranger',   who: 'kenny', name: 'Ranger vest',        price: 0,  about: 'His own.' },
  { id: 'vest-khaki',    who: 'kenny', name: 'Outback khaki vest', price: 20, look: { vest: { colour: 0xb59a5e, style: 'plain' } } },
  { id: 'vest-ocean',    who: 'kenny', name: 'Ocean blue vest',    price: 25, look: { vest: { colour: 0x2a6fb5, style: 'plain' } } },
  { id: 'vest-redearth', who: 'kenny', name: 'Red earth vest',     price: 25, look: { vest: { colour: 0xa8452c, style: 'plain' } } },
  { id: 'vest-neon',     who: 'kenny', name: 'Neon orange vest',   price: 40, look: { vest: { colour: 0xff7a1a, style: 'neon' } } },
  { id: 'vest-disco',    who: 'kenny', name: 'Disco vest',         price: 50, look: { vest: { colour: 0x40c0ff, style: 'disco' } } },
];
// Earlier names, for older saves.
export const WARDROBE = OUTFITS;
const DEFAULT = { wally: 'classic', kenny: 'vest-ranger' };

export function freshWardrobe() {
  return { owned: OUTFITS.filter(i => i.price === 0 && !i.needs).map(i => i.id), wear: { ...DEFAULT } };
}

// Buy an outfit. Returns { progress, ok, why }: why is 'unknown', 'soon', 'owned' or 'mangoes'.
export function buyItem(progress, id) {
  const item = OUTFITS.find(i => i.id === id);
  const wardrobe = progress.wardrobe || freshWardrobe();
  if (!item) return { progress, ok: false, why: 'unknown' };
  if (item.needs) return { progress, ok: false, why: 'soon' };
  if (wardrobe.owned.includes(id)) return { progress, ok: false, why: 'owned' };
  if ((progress.mangoes || 0) < item.price) return { progress, ok: false, why: 'mangoes' };
  return { ok: true, progress: { ...progress, mangoes: progress.mangoes - item.price,
    wardrobe: { ...wardrobe, owned: [...wardrobe.owned, id] } } };
}

// Put on an outfit (only one owned). A complete outfit replaces the last.
export function wearItem(progress, id) {
  const item = OUTFITS.find(i => i.id === id);
  const wardrobe = progress.wardrobe || freshWardrobe();
  if (!item || !wardrobe.owned.includes(id)) return progress;
  return { ...progress, wardrobe: { ...wardrobe, wear: { ...DEFAULT, ...wardrobe.wear, [item.who]: id } } };
}

// The outfit someone has on.
export function outfitOn(progress, who) {
  const id = (progress.wardrobe || freshWardrobe()).wear[who];
  return OUTFITS.find(i => i.id === id) || OUTFITS.find(i => i.id === DEFAULT[who]);
}
// The Wally model to load for it ('wally' unless the outfit is its own model).
export function outfitModel(progress) { const o = outfitOn(progress, 'wally'); return (o && o.model && !o.needs) ? o.model : 'wally'; }
// What outfit.js puts on: { shirt, shorts } for Wally, { vest } for Kenny.
export function wearing(progress, who) {
  const o = outfitOn(progress, who);
  return (o && !o.model && o.look) || {};
}

// ---- Gear and tickets (Ken, 2026-10-17) ----------------------------------------
// The exception to complete outfits: things that are separate or do not move
// with Wally. Gear is carried (the boomerang, useful in later levels); tickets
// pay for a ride. A ticket's adventure also needs its stars (ACTIVITIES) before
// it can be used; the river cruise ticket is the Daintree river-boat ticket of
// the ticket chain. ready: false shows it as coming soon (no model or no level yet).
export const EXTRAS = [
  { id: 'boomerang',       kind: 'gear',   name: 'Boomerang',          price: 60, ready: false, about: 'Thrown and caught again: handy in later levels.' },
  { id: 'ticket-zipline',  kind: 'ticket', name: 'Zip line ticket',    price: 25, ready: true, activity: 'zipline', about: 'One ride down the Barron Gorge on the zip line (Barron Falls, at the end of the Kuranda markets).' },
  { id: 'ticket-bungee',   kind: 'ticket', name: 'Bungee jump ticket', price: 35, ready: false, activity: 'bungee', about: 'A leap over Barron Falls.' },
  { id: 'ticket-cruise',   kind: 'ticket', name: 'River cruise ticket', price: BOAT_TICKET_PRICE, pay: 'coins', ready: true, about: 'The river boat on the Daintree (opens the Daintree River).' },
  { id: 'ticket-rapids',   kind: 'ticket', name: 'River rapids ticket', price: 30, ready: false, activity: 'rapids', about: 'A raft down the white water at Mossman Gorge.' },
];
export function hasExtra(progress, id) {
  if (id === 'ticket-cruise') return !!progress.boatTicket;
  const x = EXTRAS.find(e => e.id === id);
  if (x && x.activity) return ticketsFor(progress, x.activity) > 0;
  return (progress.extras || []).includes(id);
}
// Adventure tickets are good for one go each (Ken): buy as many as you like.
export function ticketsFor(progress, activity) { return Math.max(0, (progress.tickets || {})[activity] || 0); }
export function useTicket(progress, activity) {
  if (ticketsFor(progress, activity) < 1) return { progress, ok: false };
  return { ok: true, progress: { ...progress, tickets: { ...(progress.tickets || {}), [activity]: ticketsFor(progress, activity) - 1 } } };
}
// Buy gear or a ticket. why: 'unknown', 'soon', 'owned' or 'mangoes'.
export function buyExtra(progress, id) {
  const x = EXTRAS.find(e => e.id === id);
  if (!x) return { progress, ok: false, why: 'unknown' };
  if (!x.ready) return { progress, ok: false, why: 'soon' };
  if (!x.activity && hasExtra(progress, id)) return { progress, ok: false, why: 'owned' };
  const pay = x.pay || 'mangoes';
  if ((progress[pay] || 0) < x.price) return { progress, ok: false, why: pay === 'coins' ? 'gold' : 'mangoes' };
  const p = { ...progress, [pay]: progress[pay] - x.price };
  if (id === 'ticket-cruise') p.boatTicket = true;
  else if (x.activity) p.tickets = { ...(progress.tickets || {}), [x.activity]: ticketsFor(progress, x.activity) + 1 };
  else p.extras = [...(progress.extras || []), id];
  return { ok: true, progress: p };
}

// The player's name for their croc (Ken: allow name changes).
export function crocName(progress) { return (progress && progress.crocName) || 'Wally'; }
export function setCrocName(progress, name) { return { ...progress, crocName: name || null }; }


export function isOpen(progress, id) {
  return progress.unlocked.includes(id) && !!AREAS.find(a => a.id === id && a.ready);
}

// Read saved progress, tolerating anything missing or broken.
export function readProgress(text) {
  try {
    const p = JSON.parse(text);
    const f = freshProgress();
    return {
      unlocked: Array.isArray(p.unlocked) && p.unlocked.includes('park') ? p.unlocked : f.unlocked,
      stars: p.stars && typeof p.stars === 'object' ? p.stars : {},
      best: p.best && typeof p.best === 'object' ? p.best : {},
      postcards: Array.isArray(p.postcards) ? p.postcards : [],
      mangoes: Number.isFinite(p.mangoes) ? p.mangoes : 0,
      pearls: Number.isFinite(p.pearls) ? p.pearls : 0,
      coins: Number.isFinite(p.coins) ? p.coins : 0,
      shells: Number.isFinite(p.shells) ? p.shells : 0,
      pier: p.pier === true,
      badge: p.badge === true || (p.stars && p.stars.park > 0) || (Array.isArray(p.postcards) && p.postcards.includes('park')),
      skyrail: p.skyrail === true, boatTicket: p.boatTicket === true,
      wardrobe: readWardrobe(p.wardrobe),
      extras: Array.isArray(p.extras) ? p.extras.filter(id => EXTRAS.some(e => e.id === id)) : [],
      crocName: typeof p.crocName === 'string' && p.crocName.length >= 2 && p.crocName.length <= 16 ? p.crocName : null,
      treasures: Array.isArray(p.treasures) ? p.treasures.filter(id => typeof id === 'string') : [],
      // Wally's Tourist Book (book-rules.js): stamps, tokens, abilities and visits.
      stamps: Array.isArray(p.stamps) ? p.stamps.filter(id => typeof id === 'string') : [],
      tokens: Number.isFinite(p.tokens) ? p.tokens : 0,
      abilities: p.abilities && typeof p.abilities === 'object' ? Object.fromEntries(Object.entries(p.abilities).filter(([k, v]) => ['swisher', 'net', 'snorkel', 'spring', 'vitamins'].includes(k) && Number.isFinite(v))) : {},
      visits: p.visits && typeof p.visits === 'object' ? Object.fromEntries(Object.entries(p.visits).filter(([, v]) => Number.isFinite(v))) : {},
      souvenirs: Array.isArray(p.souvenirs) ? p.souvenirs.filter(id => typeof id === 'string') : [],
      sidequests: Number.isFinite(p.sidequests) ? p.sidequests : 0,
      discovered: Array.isArray(p.discovered) ? p.discovered.filter(id => typeof id === 'string') : [],
      // Gear (book-rules.js): items owned, the one carried, its uses left, and part-used ones put away.
      gear: p.gear && typeof p.gear === 'object' ? Object.fromEntries(Object.entries(p.gear).filter(([k, v]) => GEAR_IDS.includes(k) && Number.isFinite(v) && v >= 0)) : {},
      equipped: GEAR_IDS.includes(p.equipped) ? p.equipped : null,
      uses: Number.isFinite(p.uses) ? p.uses : 0,
      partial: p.partial && typeof p.partial === 'object' ? Object.fromEntries(Object.entries(p.partial).filter(([k, v]) => GEAR_IDS.includes(k) && Number.isFinite(v))) : {},
      tickets: p.tickets && typeof p.tickets === 'object' ? Object.fromEntries(Object.entries(p.tickets).filter(([, v]) => Number.isFinite(v) && v >= 0)) : {},
      // The trip under the rules of trip-rules.js (difficulty, areas done, main items); null until chosen.
      trip: readTrip(p.trip),
    };
  } catch { return freshProgress(); }
}

// A saved wardrobe, keeping only real outfits and always the starting ones.
// Older saves (shirts and shorts chosen separately) start again in their own clothes.
function readWardrobe(w) {
  const f = freshWardrobe();
  if (!w || typeof w !== 'object') return f;
  const known = id => OUTFITS.some(i => i.id === id && !i.needs);
  const owned = [...new Set([...f.owned, ...(Array.isArray(w.owned) ? w.owned.filter(known) : [])])];
  const wear = { ...f.wear };
  for (const who of ['wally', 'kenny']) {
    const id = w.wear && w.wear[who];
    if (typeof id === 'string' && owned.includes(id) && OUTFITS.find(i => i.id === id).who === who) wear[who] = id;
  }
  return { owned, wear };
}

// A postcard for each area: a real fact about that part of Far North Queensland.
export const POSTCARDS = {
  park: 'Saltwater crocodiles are the largest living reptiles. Big males can grow longer than 6 metres.',
  esplanade: 'The mudflats along the Cairns Esplanade are a feeding ground for migratory shorebirds, some of which fly in from as far away as Siberia.',
  daintree: 'The Daintree Rainforest is often called one of the oldest rainforests on Earth.',
  mossman: 'Mossman Gorge sits in the traditional country of the Eastern Kuku Yalanji people.',
  kuranda: 'Barron Falls, below Kuranda, roars after heavy rain in the wet season.',
  reef: 'The Great Barrier Reef is the largest coral reef system in the world.',
};
