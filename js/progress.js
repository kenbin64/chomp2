// progress.js
// Wally's Big Trip across Cairns: which areas are open, the stars and best
// score for each, the postcards collected and the Golden Mangoes banked.
// Pure functions, tested in test/progress.test.mjs; the page saves the result.

import { AREAS } from './quests.js';

export function freshProgress() {
  return { unlocked: ['park'], stars: {}, best: {}, postcards: [], mangoes: 0, pearls: 0, coins: 0,
           badge: false, skyrail: false, boatTicket: false, wardrobe: freshWardrobe(), extras: [], crocName: null };
}

// Stars from a score: thresholds are [one, two, three].
export function starsFor(score, thresholds) {
  return thresholds.filter(t => score >= t).length;
}

// Record a finished area. Never lowers stars or best score; opens the next
// area that is built; the area's postcard is collected once.
export function completeArea(progress, id, { score = 0, stars = 0, mangoes = 0, pearls = 0, coins = 0 } = {}) {
  const p = bankFinds({ ...progress, stars: { ...progress.stars }, best: { ...progress.best }, unlocked: [...progress.unlocked], postcards: [...progress.postcards] },
                      { mangoes, pearls, coins });
  p.stars[id] = Math.max(p.stars[id] || 0, stars);
  p.best[id] = Math.max(p.best[id] || 0, score);
  if (id === 'park') p.badge = true;                     // the Croc Park ranger badge: the way onto the Esplanade
  if (!p.postcards.includes(id)) p.postcards.push(id);
  const i = AREAS.findIndex(a => a.id === id);
  const next = AREAS[i + 1];
  if (next && next.ready && !p.unlocked.includes(next.id)) p.unlocked.push(next.id);
  return p;
}

// Keep what was collected, finished or not (Ken: go back for more of something).
export function bankFinds(progress, { mangoes = 0, pearls = 0, coins = 0 } = {}) {
  return { ...progress, mangoes: (progress.mangoes || 0) + Math.max(0, mangoes),
           pearls: (progress.pearls || 0) + Math.max(0, pearls), coins: (progress.coins || 0) + Math.max(0, coins) };
}

// ---- The ticket chain (Ken, 2026-10-17): each level gives what the next one needs ----
//   Croc Park   -> a ranger badge, to get onto the Esplanade
//   Esplanade   -> pearls, one of which opens the reef's giant clam
//   Reef        -> gold coins, SKYRAIL_FARE of them for the Skyrail up to Kuranda (paid once)
//   Kuranda     -> a river-boat ticket for the Daintree, bought at the markets with mangoes
export const SKYRAIL_FARE = 5;
export const BOAT_TICKET_PRICE = 30;
// What an area still needs before Wally can go in, or null when he can.
export function entryNeeds(progress, id) {
  if (id === 'esplanade' && !progress.badge) return { what: 'badge', text: 'a Croc Park ranger badge: finish Croc Park' };
  if (id === 'reef' && (progress.pearls || 0) < 1) return { what: 'pearls', text: 'a pearl for the giant clam: feed the picnic groups on the Esplanade' };
  if (id === 'kuranda' && !progress.skyrail && (progress.coins || 0) < SKYRAIL_FARE)
    return { what: 'coins', text: `${SKYRAIL_FARE} gold coins for the Skyrail (you have ${progress.coins || 0}): dive the reef`, have: progress.coins || 0, need: SKYRAIL_FARE };
  if (id === 'daintree' && !progress.boatTicket) return { what: 'ticket', text: 'a river-boat ticket: buy one at the Kuranda markets' };
  return null;
}
// Going in pays what it costs: the Skyrail fare, the first time only (then the pass is kept).
export function payEntry(progress, id) {
  if (id === 'kuranda' && !progress.skyrail && (progress.coins || 0) >= SKYRAIL_FARE)
    return { ...progress, coins: progress.coins - SKYRAIL_FARE, skyrail: true };
  return progress;
}
// The river-boat ticket, from the Kuranda markets.
export function buyBoatTicket(progress) {
  if (progress.boatTicket) return { progress, ok: false, why: 'owned' };
  if ((progress.mangoes || 0) < BOAT_TICKET_PRICE) return { progress, ok: false, why: 'mangoes' };
  return { ok: true, progress: { ...progress, mangoes: progress.mangoes - BOAT_TICKET_PRICE, boatTicket: true } };
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
  { id: 'ticket-zipline',  kind: 'ticket', name: 'Zip line ticket',    price: 25, ready: false, activity: 'zipline', about: 'A ride across the Barron Gorge on the zip line.' },
  { id: 'ticket-bungee',   kind: 'ticket', name: 'Bungee jump ticket', price: 35, ready: false, activity: 'bungee', about: 'A leap over Barron Falls.' },
  { id: 'ticket-cruise',   kind: 'ticket', name: 'River cruise ticket', price: BOAT_TICKET_PRICE, ready: true, about: 'The river boat on the Daintree (opens the Daintree River).' },
  { id: 'ticket-rapids',   kind: 'ticket', name: 'River rapids ticket', price: 30, ready: false, activity: 'rapids', about: 'A raft down the white water at Mossman Gorge.' },
];
export function hasExtra(progress, id) { return id === 'ticket-cruise' ? !!progress.boatTicket : (progress.extras || []).includes(id); }
// Buy gear or a ticket. why: 'unknown', 'soon', 'owned' or 'mangoes'.
export function buyExtra(progress, id) {
  const x = EXTRAS.find(e => e.id === id);
  if (!x) return { progress, ok: false, why: 'unknown' };
  if (!x.ready) return { progress, ok: false, why: 'soon' };
  if (hasExtra(progress, id)) return { progress, ok: false, why: 'owned' };
  if ((progress.mangoes || 0) < x.price) return { progress, ok: false, why: 'mangoes' };
  const p = { ...progress, mangoes: progress.mangoes - x.price };
  if (id === 'ticket-cruise') p.boatTicket = true; else p.extras = [...(progress.extras || []), id];
  return { ok: true, progress: p };
}

// The player's name for their croc (Ken: allow name changes).
export function crocName(progress) { return (progress && progress.crocName) || 'Wally'; }
export function setCrocName(progress, name) { return { ...progress, crocName: name || null }; }

// For now (Ken, 2026-10-16): every area that is built is open on the trip map,
// so any level can be played straight away. Turn this off (or add ?locked to
// the address) for the real game, where each area opens when the last is done.
export const OPEN_ALL = true;

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
      badge: p.badge === true || (p.stars && p.stars.park > 0) || (Array.isArray(p.postcards) && p.postcards.includes('park')),
      skyrail: p.skyrail === true, boatTicket: p.boatTicket === true,
      wardrobe: readWardrobe(p.wardrobe),
      extras: Array.isArray(p.extras) ? p.extras.filter(id => EXTRAS.some(e => e.id === id)) : [],
      crocName: typeof p.crocName === 'string' && p.crocName.length >= 2 && p.crocName.length <= 16 ? p.crocName : null,
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
