// progress.js
// Wally's Big Trip across Cairns: which areas are open, the stars and best
// score for each, the postcards collected and the Golden Mangoes banked.
// Pure functions, tested in test/progress.test.mjs; the page saves the result.

import { AREAS } from './quests.js';

export function freshProgress() {
  return { unlocked: ['park'], stars: {}, best: {}, postcards: [], mangoes: 0, pearls: 0, wardrobe: freshWardrobe() };
}

// Stars from a score: thresholds are [one, two, three].
export function starsFor(score, thresholds) {
  return thresholds.filter(t => score >= t).length;
}

// Record a finished area. Never lowers stars or best score; opens the next
// area that is built; the area's postcard is collected once.
export function completeArea(progress, id, { score = 0, stars = 0, mangoes = 0, pearls = 0 } = {}) {
  const p = { ...progress, stars: { ...progress.stars }, best: { ...progress.best }, unlocked: [...progress.unlocked], postcards: [...progress.postcards] };
  p.stars[id] = Math.max(p.stars[id] || 0, stars);
  p.best[id] = Math.max(p.best[id] || 0, score);
  p.mangoes += Math.max(0, mangoes);
  p.pearls = (p.pearls || 0) + Math.max(0, pearls);      // pearls start on the Esplanade and run through the game
  if (!p.postcards.includes(id)) p.postcards.push(id);
  const i = AREAS.findIndex(a => a.id === id);
  const next = AREAS[i + 1];
  if (next && next.ready && !p.unlocked.includes(next.id)) p.unlocked.push(next.id);
  return p;
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
// Shirts and vests are recolours of what they wear (colour: the new main colour);
// extras are things put on as well. Prices are in Golden Mangoes. What they wear
// at the start is free and owned from the beginning.
export const WARDROBE = [
  { id: 'shirt-sunset',     who: 'wally', slot: 'shirt', name: 'Sunset hibiscus shirt', price: 0,  colour: null },
  { id: 'shirt-reef',       who: 'wally', slot: 'shirt', name: 'Reef blue shirt',       price: 25, colour: 0x2f8fd8 },
  { id: 'shirt-rainforest', who: 'wally', slot: 'shirt', name: 'Rainforest green shirt', price: 25, colour: 0x2e9a4a },
  { id: 'shirt-lagoon',     who: 'wally', slot: 'shirt', name: 'Lagoon purple shirt',   price: 30, colour: 0x8a4fd0 },
  { id: 'shirt-wattle',     who: 'wally', slot: 'shirt', name: 'Golden wattle shirt',   price: 40, colour: 0xf2c21b },
  { id: 'wally-sunnies',    who: 'wally', slot: 'extra', name: 'Sunnies',               price: 20 },
  { id: 'wally-lei',        who: 'wally', slot: 'extra', name: 'Flower lei',            price: 30 },
  { id: 'vest-ranger',      who: 'kenny', slot: 'vest',  name: 'Ranger vest',           price: 0,  colour: null },
  { id: 'vest-khaki',       who: 'kenny', slot: 'vest',  name: 'Outback khaki vest',    price: 20, colour: 0xb59a5e },
  { id: 'vest-ocean',       who: 'kenny', slot: 'vest',  name: 'Ocean blue vest',       price: 25, colour: 0x2a6fb5 },
  { id: 'vest-redearth',    who: 'kenny', slot: 'vest',  name: 'Red earth vest',        price: 25, colour: 0xa8452c },
  { id: 'kenny-sunnies',    who: 'kenny', slot: 'extra', name: 'Sunnies',               price: 20 },
  { id: 'kenny-bandana',    who: 'kenny', slot: 'extra', name: 'Bandana',               price: 20 },
];

export function freshWardrobe() {
  return { owned: WARDROBE.filter(i => i.price === 0).map(i => i.id),
           wear: { wally: { shirt: 'shirt-sunset', extra: null }, kenny: { vest: 'vest-ranger', extra: null } } };
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

// Put something on (only what is owned). Choosing an extra that is already on takes it off.
export function wearItem(progress, id) {
  const item = WARDROBE.find(i => i.id === id);
  const wardrobe = progress.wardrobe || freshWardrobe();
  if (!item || !wardrobe.owned.includes(id)) return progress;
  const now = { ...wardrobe.wear[item.who] };
  now[item.slot] = item.slot === 'extra' && now.extra === id ? null : id;
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
    const item = WARDROBE.find(i => i.id === id);
    if (id === null && slot === 'extra') wear[who].extra = null;
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
