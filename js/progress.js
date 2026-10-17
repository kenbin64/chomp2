// progress.js
// Wally's Big Trip across Cairns: which areas are open, the stars and best
// score for each, the postcards collected and the Golden Mangoes banked.
// Pure functions, tested in test/progress.test.mjs; the page saves the result.

import { AREAS } from './quests.js';

export function freshProgress() {
  return { unlocked: ['park'], stars: {}, best: {}, postcards: [], mangoes: 0, pearls: 0 };
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
  { id: 'rapids',   name: 'River rapids',   area: 'mossman', stars: 6,
    about: 'Ride the white water down Mossman Gorge on a raft.' },
  { id: 'traverse', name: 'Line traverse',  area: 'mossman', stars: 9,
    about: 'Hand over hand along a line across the gorge, catching food as it flies past.' },
  { id: 'bungee',   name: 'Bungee jump',    area: 'kuranda', stars: 12,
    about: 'Leap over Barron Falls and snatch the prize at the bottom of the jump.' },
  { id: 'boomerang', name: 'Boomerang',     area: 'kuranda', stars: 15,
    about: 'Throw a boomerang and catch it on the way back.' },
  { id: 'shop',     name: 'Kuranda markets', area: 'kuranda', stars: 0,
    about: 'Clothes for Wally and Kenny, paid for with Golden Mangoes.' },
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
    };
  } catch { return freshProgress(); }
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
