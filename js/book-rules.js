// book-rules.js
// Wally's Tourist Book (Ken, 2026-10-18): a stamp album of milestones across the
// trip, and Wally's page of what he has gathered: abilities that grow in levels,
// and the Tourist Tokens that pay for them. Plain JavaScript, no three.js, so
// it can be tested (test/book.test.mjs).
//
// Going back to a land is never just the same again: each land has three tiers
// of stamp challenges, the second opening on the second visit and the third on
// the third, so every return brings new milestones and new challenges.
//
// A stamp challenge is met within one visit: `event` must happen `count` times,
// and (if `clean` is given) that other event must not happen at all.

export const LANDS = ['park', 'esplanade', 'reef', 'kuranda'];

export const STAMPS = [
  // Croc Park
  { id: 'park-fed',     land: 'park', visit: 1, name: 'Fed the lot',        how: 'Feed out every group of visitors and finish', event: 'finish' },
  { id: 'park-mangoes', land: 'park', visit: 1, name: 'Mango hunter',       how: 'Find all 8 Golden Mangoes in one visit', event: 'mango', count: 8 },
  { id: 'park-chest',   land: 'park', visit: 1, name: 'Lagoon treasure',    how: 'Open the chest on the lagoon bottom', event: 'chest' },
  { id: 'park-night',   land: 'park', visit: 2, name: 'Night owl',          how: 'Catch 5 pieces of tucker after dark', event: 'nightCatch', count: 5 },
  { id: 'park-clean',   land: 'park', visit: 2, name: 'Slippery customer',  how: 'Open the lagoon chest without a sting or a bite', event: 'chest', clean: 'hurt' },
  { id: 'park-kenny',   land: 'park', visit: 2, name: 'Cheers, Kenny',      how: "Get a scoop from Kenny's jar", event: 'jar' },
  { id: 'park-streak',  land: 'park', visit: 3, name: 'On a roll',          how: 'Catch 8 in a row', event: 'streak8' },
  { id: 'park-hidden',  land: 'park', visit: 3, name: 'Sticky beak',        how: 'Find every hidden find in one visit', event: 'hiddenAll' },
  { id: 'park-gift',    land: 'park', visit: 3, name: 'Good on ya',         how: 'Get 3 gifts from friendly visitors', event: 'gift', count: 3 },
  // The Esplanade
  { id: 'esp-finish',   land: 'esplanade', visit: 1, name: 'Lunch on the Esplanade', how: 'Reach the Lagoon pool', event: 'finish' },
  { id: 'esp-pier',     land: 'esplanade', visit: 1, name: 'Pier pressure',     how: 'Open the pier with Croc Park mangoes', event: 'pier' },
  { id: 'esp-pearls',   land: 'esplanade', visit: 1, name: 'String of pearls',  how: 'Collect 3 pearls in one visit', event: 'pearl', count: 3 },
  { id: 'esp-mangoes',  land: 'esplanade', visit: 2, name: 'Mango madness',     how: 'Collect 60 Golden Mangoes on one run', event: 'mango', count: 60 },
  { id: 'esp-night',    land: 'esplanade', visit: 2, name: 'Moonlight stroll',  how: 'Catch 5 pieces of tucker after dark', event: 'nightCatch', count: 5 },
  { id: 'esp-hidden',   land: 'esplanade', visit: 2, name: 'Beachcomber',       how: 'Find a hidden find', event: 'hidden' },
  { id: 'esp-clean',    land: 'esplanade', visit: 3, name: 'Light on his feet', how: 'Reach the Lagoon without a single bump', event: 'finish', clean: 'bump' },
  { id: 'esp-pearls6',  land: 'esplanade', visit: 3, name: 'Pearl diver',       how: 'Collect 6 pearls in one visit', event: 'pearl', count: 6 },
  { id: 'esp-gift',     land: 'esplanade', visit: 3, name: 'Fair dinkum friend', how: 'Get 3 gifts from friendly visitors', event: 'gift', count: 3 },
  // The Great Barrier Reef
  { id: 'reef-chest',   land: 'reef', visit: 1, name: 'Pirate gold',        how: 'Find the pirate chest in the coral cave', event: 'chest' },
  { id: 'reef-clam',    land: 'reef', visit: 1, name: 'Open sesame',        how: 'Open the giant clam with a pearl', event: 'clam' },
  { id: 'reef-shells',  land: 'reef', visit: 1, name: 'She sells seashells', how: 'Collect 5 seashells in one dive', event: 'shell', count: 5 },
  { id: 'reef-conch',   land: 'reef', visit: 2, name: 'Conch-quered',       how: 'Collect 3 conch shells in one dive', event: 'conch', count: 3 },
  { id: 'reef-clean',   land: 'reef', visit: 2, name: 'Jelly dodger',       how: 'Find the chest without a jelly sting', event: 'chest', clean: 'hurt' },
  { id: 'reef-hidden',  land: 'reef', visit: 2, name: 'Wreck explorer',     how: 'Find a hidden find', event: 'hidden' },
  { id: 'reef-shells10', land: 'reef', visit: 3, name: 'Shell collector',   how: 'Collect 10 seashells in one dive', event: 'shell', count: 10 },
  { id: 'reef-air',     land: 'reef', visit: 3, name: 'Deep breath',        how: 'Finish the dive without running out of air', event: 'finish', clean: 'outOfAir' },
  { id: 'reef-pearls',  land: 'reef', visit: 3, name: 'Treasure trove',     how: 'Find 3 pearls in the cave', event: 'pearl', count: 3 },
  // Kuranda
  { id: 'kur-trade',    land: 'kuranda', visit: 1, name: 'Wheeler dealer',  how: 'Sell to the shell and mango trader', event: 'sell' },
  { id: 'kur-gold',     land: 'kuranda', visit: 1, name: 'Gold rush',       how: 'Find 6 gold pieces in one visit', event: 'gold', count: 6 },
  { id: 'kur-finish',   land: 'kuranda', visit: 1, name: 'Village people',  how: 'Feed the markets and reach the Barron Falls trail', event: 'finish' },
  { id: 'kur-outfit',   land: 'kuranda', visit: 2, name: 'Dressed to impress', how: 'Buy a new outfit', event: 'outfit' },
  { id: 'kur-allgold',  land: 'kuranda', visit: 2, name: 'Every last piece', how: 'Find all 8 gold pieces, the high ones too', event: 'gold', count: 8 },
  { id: 'kur-hidden',   land: 'kuranda', visit: 2, name: 'Market sleuth',   how: 'Find a hidden find', event: 'hidden' },
  { id: 'kur-ticket',   land: 'kuranda', visit: 3, name: 'All aboard',      how: 'Buy the river-boat ticket to the Daintree', event: 'ticket' },
  { id: 'kur-night',    land: 'kuranda', visit: 3, name: 'Night market',    how: 'Catch 5 pieces of tucker after dark', event: 'nightCatch', count: 5 },
  { id: 'kur-gift',     land: 'kuranda', visit: 3, name: 'Local legend',    how: 'Get 3 gifts from friendly visitors', event: 'gift', count: 3 },
];

// ---- Abilities (Ken: levels that make it easier to pick things up) -----------------
// Each has a level from 0 (not yet) to 3. value(level) is what the game uses.
export const ABILITIES = [
  { id: 'swisher', name: 'Tail Swisher', icon: '🦎', about: "Wally's tail sweeps things to him: he picks things up from further away.", value: L => 1 + 0.45 * L },
  { id: 'net',     name: 'Big Net',      icon: '🥅', about: 'A big net: thrown tucker is caught from further away.',                 value: L => 1 + 0.25 * L },
  { id: 'snorkel', name: 'Snorkel',      icon: '🤿', about: 'Longer under water before he needs air.',                               value: L => 1 + 0.3 * L },
  { id: 'spring',  name: 'Spring Step',  icon: '🦘', about: 'Jumps higher, for the things up high.',                                 value: L => 1 + 0.1 * L },
];
export const MAX_LEVEL = 3;
export const UPGRADE_COST = [3, 5, 8];              // Tourist Tokens for levels 1, 2 and 3

export function abilityLevel(progress, id) { return Math.min(MAX_LEVEL, Math.max(0, (progress.abilities || {})[id] || 0)); }
export function abilityValue(progress, id) { const a = ABILITIES.find(x => x.id === id); return a ? a.value(abilityLevel(progress, id)) : 1; }
export function upgradeCost(progress, id) { const L = abilityLevel(progress, id); return L >= MAX_LEVEL ? null : UPGRADE_COST[L]; }
// Spend tokens on the next level. why: 'unknown', 'max' or 'tokens'.
export function upgradeAbility(progress, id) {
  if (!ABILITIES.some(a => a.id === id)) return { progress, ok: false, why: 'unknown' };
  const cost = upgradeCost(progress, id);
  if (cost === null) return { progress, ok: false, why: 'max' };
  if ((progress.tokens || 0) < cost) return { progress, ok: false, why: 'tokens' };
  return { ok: true, progress: { ...progress, tokens: progress.tokens - cost, abilities: { ...(progress.abilities || {}), [id]: abilityLevel(progress, id) + 1 } } };
}

// ---- Visits and tiers ---------------------------------------------------------------
// Called when play starts in a land: one more visit, which opens the next tier.
export function countVisit(progress, land) {
  return { ...progress, visits: { ...(progress.visits || {}), [land]: ((progress.visits || {})[land] || 0) + 1 } };
}
export function tierFor(progress, land) { return Math.min(3, Math.max(1, (progress.visits || {})[land] || 1)); }
// The stamps that can be earned in a land now: its open tiers, not yet stamped.
export function openStamps(progress, land) {
  const tier = tierFor(progress, land), have = progress.stamps || [];
  return STAMPS.filter(s => s.land === land && s.visit <= tier && !have.includes(s.id));
}
// A stamp, and the Tourist Token that comes with it.
export function award(progress, id) {
  if ((progress.stamps || []).includes(id) || !STAMPS.some(s => s.id === id)) return progress;
  return { ...progress, stamps: [...(progress.stamps || []), id], tokens: (progress.tokens || 0) + 1 };
}

// ---- One visit: counting what happens and noticing stamps earned ------------------------
export class StampRun {
  constructor(land) { this.land = land; this.counts = {}; }
  // Something happened. Returns the ids of stamps (from `open`) this completes.
  record(event, open, n = 1) {
    this.counts[event] = (this.counts[event] || 0) + n;
    return open.filter(s => s.event === event && (this.counts[event] || 0) >= (s.count || 1) && !(s.clean && this.counts[s.clean])).map(s => s.id);
  }
}

// ---- Hidden finds ----------------------------------------------------------------------
// What one holds: Tourist Tokens, or the next level of an ability not yet at its top.
export function hiddenReward(rnd, progress) {
  const growable = ABILITIES.filter(a => abilityLevel(progress, a.id) < MAX_LEVEL);
  if (growable.length && rnd() < 0.35) return { kind: 'ability', id: growable[Math.floor(rnd() * growable.length)].id };
  return { kind: 'tokens', n: 1 + Math.floor(rnd() * 3) };
}
export function applyReward(progress, r) {
  if (r.kind === 'ability') return { ...progress, abilities: { ...(progress.abilities || {}), [r.id]: Math.min(MAX_LEVEL, abilityLevel(progress, r.id) + 1) } };
  return { ...progress, tokens: (progress.tokens || 0) + r.n };
}

// ---- Things found (Ken, 2026-10-18) ---------------------------------------------------------
// The first time Wally gets each kind of thing, the book opens on it: what it
// is and what it can do. It stays listed in the book after.
export const ITEMS = [
  { id: 'mango',     icon: '🥭', name: 'Golden Mango',   is: 'A ripe golden mango, found about Croc Park and along the Esplanade.', does: 'Opens the Esplanade pier (8 of them), buys outfits, and the Kuranda trader pays gold for them.' },
  { id: 'lostThing', icon: '🕶️', name: 'Lost things',    is: 'Sunnies, a ring, a watch, a phone and a bangle that visitors dropped into the lagoon.', does: 'Find all five on the lagoon bottom and the treasure chest opens.' },
  { id: 'jar',       icon: '🫙', name: "Kenny's jar",     is: "Kenny's jar of black spread: a scoop of it does wonders.", does: 'Fills the feed-o-meter right up. Under half full, go and find Kenny for a scoop.' },
  { id: 'pearl',     icon: '⚪', name: 'Pearl',           is: 'A pearl, left by happy picnickers, found out on the pier and down in the coral cave.', does: 'Opens the giant clam at the reef. Esplanade traders take them too.' },
  { id: 'shell',     icon: '🐚', name: 'Seashell',        is: 'Cowries and conch shells from the Great Barrier Reef.', does: 'The Kuranda shell and mango trader pays 2 gold for each one.' },
  { id: 'gold',      icon: '🪙', name: 'Gold piece',      is: 'Gold, from the Kuranda trader or dropped by visitors along the market street.', does: 'Buys the river-boat ticket to the Daintree. Kuranda traders take it too.' },
  { id: 'token',     icon: '🎟️', name: 'Tourist Token',   is: 'A token for every stamp, hidden find and favour done.', does: "Spend them on Wally's page to grow his abilities." },
  { id: 'hidden',    icon: '📦', name: 'Hidden find',     is: 'A crate tucked away somewhere; it only shows when Wally is close.', does: 'Holds Tourist Tokens or a level of one of his abilities.' },
  { id: 'souvenir',  icon: '🎁', name: 'Souvenir',        is: 'A keepsake from a friendly trader.', does: "Kept on the souvenir shelf on Wally's page: collect them all." },
  ...ABILITIES.map(a => ({ id: a.id, icon: a.icon, name: a.name, is: 'One of Wally\'s abilities, with three levels.', does: a.about })),
];
// The first time a thing is found: { progress, first }.
export function discover(progress, id) {
  const have = progress.discovered || [];
  if (have.includes(id) || !ITEMS.some(i => i.id === id)) return { progress, first: false };
  return { progress: { ...progress, discovered: [...have, id] }, first: true };
}
// Which thing a game event means (book.js discovers it on the first one).
export const EVENT_ITEM = { mango: 'mango', pearl: 'pearl', shell: 'shell', conch: 'shell', gold: 'gold', hidden: 'hidden', jar: 'jar', gift: 'souvenir', lostThing: 'lostThing', sell: 'gold' };
