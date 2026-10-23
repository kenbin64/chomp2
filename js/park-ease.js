// park-ease.js
// A gentle first visit to Croc Park (Ken, 2026-10-23: the first tester found level 1 too hard, and
// players who reach levels 2 and 3 are the ones who stay). The first time through, the park starts
// easy and builds: fewer groups to feed, slower hunger, calmer visitors, gentler throws, and the food
// thieves turning up one kind at a time as Wally feeds out each group. A return visit plays as before
// (and harder, by the revisit rules in trip-rules.js).
// Pure data and counting, no drawing, so it is tested (test/park-ease.test.mjs).

import { PARK_GROUPS } from './quests.js';

// The first visit, whatever difficulty was picked.
export const FIRST_VISIT = {
  groups: 6,          // groups to feed out (five, then the tour group), not eight
  drain: 0.4,         // the feed-o-meter empties at 40% of the normal speed (easy on a later visit is 50%)
  calm: 1.6,          // visitors put up with Wally close by 1.6 times longer before they bolt
  panic: 2.4,         // and only bolt at once when he is right on them (normally 3.2)
  throwPace: 0.5,     // the throws get harder over six minutes instead of three
};

// When each thief arrives on the first visit, by how many groups are done: [groups done, how many].
// Nothing at the start, so the player learns to catch; then one kind at a time, so each is a new
// thing to beat. The croc guarding the treasure under water is always there (the treasure is optional).
export const ARRIVALS = {
  pelican: [[1, 1], [3, 2]],
  bat:     [[2, 1], [4, 99]],
  toad:    [[3, 2], [5, 99]],
  croc:    [[2, 1], [4, 99]],
};

// How the park plays on this visit (1 = the first time).
export function parkEase(visit) {
  if (visit === 1) return { first: true, groups: FIRST_VISIT.groups, drain: FIRST_VISIT.drain,
    calm: FIRST_VISIT.calm, panic: FIRST_VISIT.panic, throwPace: FIRST_VISIT.throwPace };
  return { first: false, groups: PARK_GROUPS, drain: null, calm: 1, panic: null, throwPace: 1 };
}

// How many of a kind of thief are about, out of `all`, after `done` groups.
export function thievesAllowed(kind, done, all, first = true) {
  if (!first) return all;
  let n = 0;
  for (const [at, count] of ARRIVALS[kind] || []) if (done >= at) n = count;
  return Math.min(all, n);
}

// The line to show when a new kind of thief turns up, or null.
export const ARRIVAL_LINES = {
  pelican: 'Here come the pelicans! They scoop up food near the visitors.',
  bat: 'Flying foxes! They grab food out of the air.',
  toad: 'Cane toads! They eat food that lands on the grass.',
  croc: 'Another croc has turned up for the food. Beat it there!',
};
