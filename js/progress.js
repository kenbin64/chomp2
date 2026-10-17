// progress.js
// Wally's Big Trip across Cairns: which areas are open, the stars and best
// score for each, the postcards collected and the Golden Mangoes banked.
// Pure functions, tested in test/progress.test.mjs; the page saves the result.

import { AREAS } from './quests.js';

export function freshProgress() {
  return { unlocked: ['park'], stars: {}, best: {}, postcards: [], mangoes: 0, pearls: 0, coins: 0,
           badge: false, skyrail: false, boatTicket: false, wardrobe: freshWardrobe() };
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

// ---- The wardrobe (Ken: Wally and Kenny can get new clothes at the Kuranda markets) ----
// Ken's list (2026-10-17): Aussie cork hat, lifeguard cap, board shorts and
// Hawaiian shirts in variety, traditional Aussie gear, sunglasses, a pirate hat
// and pirate clothes, masks, coloured wigs, boomerangs (useful in later
// levels), bright neon, disco clothes.
// Shirts and shorts are recoloured or re-patterned on the character itself
// (outfit.js): style 'plain' keeps the printed pattern in a new colour, 'neon'
// glows, 'disco' shimmers through the colours, 'stripes' (colour and colour2).
// Hats, glasses, masks, wigs and boomerangs are worn objects: needs: 'model'
// marks the ones waiting on a model, shown in the shop as coming soon.
// Prices are Golden Mangoes. What they wear at the start is free and owned.
export const SLOTS = { wally: ['shirt', 'shorts', 'hat', 'glasses', 'face', 'wig', 'held'],
                       kenny: ['vest', 'hat', 'glasses', 'face', 'wig'] };
export const WARDROBE = [
  // Wally's Hawaiian shirts
  { id: 'shirt-sunset',     who: 'wally', slot: 'shirt', name: 'Sunset hibiscus shirt', price: 0,  colour: null },
  { id: 'shirt-reef',       who: 'wally', slot: 'shirt', name: 'Reef blue Hawaiian',    price: 25, colour: 0x2f8fd8 },
  { id: 'shirt-rainforest', who: 'wally', slot: 'shirt', name: 'Rainforest Hawaiian',   price: 25, colour: 0x2e9a4a },
  { id: 'shirt-lagoon',     who: 'wally', slot: 'shirt', name: 'Lagoon purple Hawaiian', price: 30, colour: 0x8a4fd0 },
  { id: 'shirt-wattle',     who: 'wally', slot: 'shirt', name: 'Golden wattle Hawaiian', price: 30, colour: 0xf2c21b },
  { id: 'shirt-bush',       who: 'wally', slot: 'shirt', name: 'Bush khaki shirt',      price: 25, colour: 0x9a8a5a, style: 'plain' },
  { id: 'shirt-greengold',  who: 'wally', slot: 'shirt', name: 'Green and gold jersey',  price: 35, colour: 0x1f7a3a, colour2: 0xf2c21b, style: 'stripes' },
  { id: 'shirt-pirate',     who: 'wally', slot: 'shirt', name: 'Pirate stripes',        price: 35, colour: 0xb81f2a, colour2: 0xf2ece0, style: 'stripes' },
  { id: 'shirt-neonpink',   who: 'wally', slot: 'shirt', name: 'Neon pink',             price: 45, colour: 0xff2fa8, style: 'neon' },
  { id: 'shirt-neongreen',  who: 'wally', slot: 'shirt', name: 'Neon green',            price: 45, colour: 0x39ff6a, style: 'neon' },
  { id: 'shirt-disco',      who: 'wally', slot: 'shirt', name: 'Disco shirt',           price: 60, colour: 0xd040ff, style: 'disco' },
  // Wally's board shorts
  { id: 'shorts-sunset',    who: 'wally', slot: 'shorts', name: 'Sunset board shorts',  price: 0,  colour: null },
  { id: 'shorts-surf',      who: 'wally', slot: 'shorts', name: 'Surf blue boardies',   price: 20, colour: 0x1f6fd0 },
  { id: 'shorts-reef',      who: 'wally', slot: 'shorts', name: 'Reef teal boardies',   price: 20, colour: 0x17a8a0 },
  { id: 'shorts-mango',     who: 'wally', slot: 'shorts', name: 'Mango yellow boardies', price: 20, colour: 0xf5b81c },
  { id: 'shorts-lifeguard', who: 'wally', slot: 'shorts', name: 'Lifeguard red and gold', price: 30, colour: 0xd8231f, colour2: 0xf6c21b, style: 'stripes' },
  { id: 'shorts-pirate',    who: 'wally', slot: 'shorts', name: 'Pirate breeches',      price: 30, colour: 0x2a2a30 },
  { id: 'shorts-neon',      who: 'wally', slot: 'shorts', name: 'Neon boardies',        price: 40, colour: 0x00e5ff, style: 'neon' },
  { id: 'shorts-disco',     who: 'wally', slot: 'shorts', name: 'Disco shorts',         price: 50, colour: 0xffd23a, style: 'disco' },
  // Worn objects (each needs its model)
  { id: 'hat-cork',     who: 'wally', slot: 'hat',     name: 'Aussie cork hat',      price: 40, needs: 'model' },
  { id: 'hat-lifeguard', who: 'wally', slot: 'hat',    name: 'Lifeguard cap',        price: 35, needs: 'model' },
  { id: 'hat-pirate',   who: 'wally', slot: 'hat',     name: 'Pirate hat',           price: 50, needs: 'model' },
  { id: 'wally-sunnies', who: 'wally', slot: 'glasses', name: 'Sunnies',             price: 20, needs: 'model' },
  { id: 'wally-mask',   who: 'wally', slot: 'face',    name: 'Party mask',           price: 30, needs: 'model' },
  { id: 'wig-rainbow',  who: 'wally', slot: 'wig',     name: 'Rainbow wig',          price: 40, needs: 'model' },
  { id: 'wig-blue',     who: 'wally', slot: 'wig',     name: 'Electric blue wig',    price: 35, needs: 'model' },
  { id: 'boomerang',    who: 'wally', slot: 'held',    name: 'Boomerang',            price: 60, needs: 'model' },
  // Kenny
  { id: 'vest-ranger',      who: 'kenny', slot: 'vest',  name: 'Ranger vest',        price: 0,  colour: null },
  { id: 'vest-khaki',       who: 'kenny', slot: 'vest',  name: 'Outback khaki vest', price: 20, colour: 0xb59a5e },
  { id: 'vest-ocean',       who: 'kenny', slot: 'vest',  name: 'Ocean blue vest',    price: 25, colour: 0x2a6fb5 },
  { id: 'vest-redearth',    who: 'kenny', slot: 'vest',  name: 'Red earth vest',     price: 25, colour: 0xa8452c },
  { id: 'vest-neon',        who: 'kenny', slot: 'vest',  name: 'Neon orange vest',   price: 40, colour: 0xff7a1a, style: 'neon' },
  { id: 'vest-disco',       who: 'kenny', slot: 'vest',  name: 'Disco vest',         price: 50, colour: 0x40c0ff, style: 'disco' },
  { id: 'kenny-sunnies',    who: 'kenny', slot: 'glasses', name: 'Sunnies',          price: 20, needs: 'model' },
  { id: 'kenny-pirate',     who: 'kenny', slot: 'hat',   name: 'Pirate hat',         price: 50, needs: 'model' },
  { id: 'kenny-wig',        who: 'kenny', slot: 'wig',   name: 'Pink wig',           price: 35, needs: 'model' },
];

// Slots that are always filled (their own clothes underneath); the rest can be taken off.
const BASE = { shirt: 'shirt-sunset', shorts: 'shorts-sunset', vest: 'vest-ranger' };
export function freshWardrobe() {
  const wear = {};
  for (const [who, slots] of Object.entries(SLOTS)) {
    wear[who] = {};
    for (const slot of slots) wear[who][slot] = WARDROBE.find(i => i.who === who && i.slot === slot && i.price === 0)?.id || null;
  }
  return { owned: WARDROBE.filter(i => i.price === 0).map(i => i.id), wear };
}

// Buy something. Returns { progress, ok, why }: why is 'unknown', 'owned' or 'mangoes'.
export function buyItem(progress, id) {
  const item = WARDROBE.find(i => i.id === id);
  const wardrobe = progress.wardrobe || freshWardrobe();
  if (!item) return { progress, ok: false, why: 'unknown' };
  if (wardrobe.owned.includes(id)) return { progress, ok: false, why: 'owned' };
  if ((progress.mangoes || 0) < item.price) return { progress, ok: false, why: 'mangoes' };
  return { ok: true, progress: { ...progress, mangoes: progress.mangoes - item.price,
    wardrobe: { ...wardrobe, owned: [...wardrobe.owned, id] } } };
}

// Put something on (only what is owned). Choosing a hat, glasses, mask, wig or
// boomerang that is already on takes it off; shirts, shorts and vests swap.
export function wearItem(progress, id) {
  const item = WARDROBE.find(i => i.id === id);
  const wardrobe = progress.wardrobe || freshWardrobe();
  if (!item || !wardrobe.owned.includes(id)) return progress;
  const now = { ...freshWardrobe().wear[item.who], ...wardrobe.wear[item.who] };
  now[item.slot] = !BASE[item.slot] && now[item.slot] === id ? null : id;
  return { ...progress, wardrobe: { ...wardrobe, wear: { ...wardrobe.wear, [item.who]: now } } };
}

// What someone is wearing, as items: { shirt or vest, extra }.
export function wearing(progress, who) {
  const w = (progress.wardrobe || freshWardrobe()).wear[who];
  const out = {};
  for (const [slot, id] of Object.entries(w)) out[slot] = id ? WARDROBE.find(i => i.id === id) || null : null;
  return out;
}

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
    };
  } catch { return freshProgress(); }
}

// A saved wardrobe, keeping only real items and always the starting clothes.
function readWardrobe(w) {
  const f = freshWardrobe();
  if (!w || typeof w !== 'object') return f;
  const known = id => WARDROBE.some(i => i.id === id);
  const owned = [...new Set([...f.owned, ...(Array.isArray(w.owned) ? w.owned.filter(known) : [])])];
  const wear = { wally: { ...f.wear.wally }, kenny: { ...f.wear.kenny } };
  for (const who of ['wally', 'kenny']) for (const [slot, id] of Object.entries((w.wear && w.wear[who]) || {})) {
    if (!SLOTS[who].includes(slot)) continue;
    const item = WARDROBE.find(i => i.id === id);
    if (id === null && !BASE[slot]) wear[who][slot] = null;
    else if (item && item.who === who && item.slot === slot && owned.includes(id)) wear[who][slot] = id;
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
