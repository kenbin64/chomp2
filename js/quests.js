// quests.js
// The areas of the game and the quest for each one. The game is progressive:
// each area is its own section with goals, then an end challenge. Wally does it
// powered by what he catches, and finishing it opens the way to the next area.
// Pure data and counting, no drawing, so it is tested (test/quests.test.mjs).

import { LOST_THINGS } from './treasure-rules.js';

export const AREAS = [
  // objective: what the player has to do, in a sentence or two, shown on the trip map.
  { id: 'park', name: 'Croc Park', place: 'Cairns, Far North Queensland', ready: true,
    objective: 'Dive for everything the visitors dropped in the lagoon, keeping fed on what they throw. That opens the chest and its key. Then the boss: out the gate and run for the cane fields, with the croc wrangler after you.',
    notes: 'Lagoon, banks, rocks and the boardwalk. Tourists throw food from the boardwalk.' },
  { id: 'cane', name: 'The Cane Fields', place: 'Cane country north of Cairns', ready: true,
    objective: 'Cut a path through the cane with the machete to the fire talisman in the middle. Eat the sugar cane before the cane toads and fruit bats get it. The burning cane you cannot go through, but the fire never reaches you.',
    notes: "Sugar cane at dusk: the sunset behind the ranges, the moon, the fires; Walsh's Pyramid on the skyline." },
  { id: 'esplanade', name: 'The Esplanade', place: 'The Cairns waterfront', ready: true,
    objective: "Collect mangoes while the pelicans and fruit bats try to steal them. The skipper's boat at the end of the pier takes you out after a black marlin for the sun medallion; the chest by the Lagoon holds the Big Golden Mango; then the boat runs you out to the reef. Watch the box jellyfish if you swim.",
    notes: 'The Cairns Esplanade: lagoon pool, boardwalk, fig trees, mangroves along the mudflats.' },
  { id: 'reef', name: 'The Great Barrier Reef', place: 'Green Island, off Cairns', ready: true,
    objective: 'Dive from the Green Island jetty, follow the guide fish through the coral maze to the cave, find the pirate chest and get out before your air runs out. Bring pearls: one opens the giant clam.',
    notes: 'Green Island jetty, then under water: coral maze on the reef, box jellyfish, bubble vents, the coral cave with the pirate chest and the giant clam.' },
  { id: 'kuranda', name: 'Kuranda', place: 'The village in the rainforest', ready: true,
    objective: 'Feed through the Kuranda markets without scaring the shoppers off, and fill the feed-o-meter. Spend Golden Mangoes on new clothes for Wally and Kenny, and take the trail to Barron Falls for the zip line and the bungee.',
    notes: 'Kuranda village and markets in the rainforest, the Skyrail gondolas overhead; a trail to the Barron Falls gorge: zip line across it, bungee over it (catch food on the way). Djabugay country: the boomerang is taught by a local guide.' },
  { id: 'mossman', name: 'Mossman Gorge', place: 'The Mossman River, in the rainforest', ready: true,
    objective: 'Work your way down the river: swim the holes, slide down the rock slicks, find the key on the bottom of one hole and the chest with the opal in the last.',
    notes: 'River rafts, climbing vines and cliffs, a vine-swinging challenge, line traversing over the gorge catching food along the line. Rainforest over the hills.' },
  { id: 'daintree', name: 'Daintree River', ready: true,
    objective: 'Swim with the tour boat and keep fed, then take the sceptre through the rainforest to the King.',
    notes: 'Tourists on river boats. Swim, swing on vines, jump rock to rock, run the beach. Mangroves, rainforest to the water.' },
];

// The rule for moving on from any scene (Ken, 2026-10-16): feed out every group
// of people, then have the feed-o-meter full. FULL is "full" with a little room,
// since the meter drains while he walks.
export const FULL = 95;

// Croc Park: seven groups of visitors, then a tour group, then fill up.
export const PARK_GROUPS = 8;
const PARK = parkQuest();

// Croc Park (Ken, 2026-10-30): the key to the park is in the chest on the lagoon bed. Find everything the visitors
// dropped down there and the chest opens; stay fed on what they throw meanwhile. Then out the gate, and the chase.
export function escapeQuest() {
  return {
    title: 'Get the key and get out',
    goals: [
      { id: 'lost', text: 'Find what visitors dropped in the lagoon', event: 'lostThing', need: LOST_THINGS.length },
      { id: 'chest', text: 'Open the chest: the key is inside', event: 'chestOpened', need: 1 },
    ],
  };
}

// The park quest for a given number of groups (fewer on the gentle first visit: park-ease.js).
export function parkQuest(groups = PARK_GROUPS) {
  return {
    title: 'Fuel up for the big trip',
    goals: [
      { id: 'groups', text: 'Feed out every group of visitors', event: 'groupDone', need: groups },
    ],
    full: FULL,                  // then the feed-o-meter has to be full to open the gate
  };
}

// The older park quest with a timed end challenge, kept for areas that want one.
export const FRENZY_QUEST = {
  title: 'Fuel up for the big trip',
  goals: [
    { id: 'catch',    text: 'Catch 25 bits of tucker',           event: 'catch',     need: 25 },
    { id: 'leap',     text: 'Catch 3 in the air on a croc leap', event: 'leapCatch', need: 3 },
    { id: 'streak',   text: 'Catch 8 in a row',                  event: 'streak8',   need: 1 },
    { id: 'toast',    text: "Get to Kenny's jar",                event: 'toast',     need: 1 },
  ],
  challenge: { title: 'Feeding Frenzy', text: 'Catch 10 in 30 seconds', need: 10, seconds: 30 },
};

// Stages: goals -> (challenge, if the area has one) -> (full, if the meter must be
// full) -> gate open -> complete (Wally walks out the gate). A quest whose goals
// are done but whose meter is not full when there is nothing left to eat is 'hungry'.
export function createQuest(def = PARK) {
  const goals = def.goals.map(g => ({ ...g, have: 0 }));
  const ch = def.challenge ? { ...def.challenge, have: 0, left: 0 } : null;
  let stage = 'goals', tries = 0;

  return {
    title: def.title,
    goals,
    challenge: ch,
    get stage() { return stage; },
    get tries() { return tries; },

    // Count an event. Returns the goals this event just finished.
    record(event) {
      if (stage === 'challenge') {
        if (event === 'catch') ch.have++;
        return [];
      }
      if (stage !== 'goals') return [];
      const finished = [];
      for (const g of goals) {
        if (g.event !== event || g.have >= g.need) continue;
        g.have++;
        if (g.have === g.need) finished.push(g);
      }
      return finished;
    },

    goalsDone() { return goals.every(g => g.have >= g.need); },
    needsFull() { return !!def.full; },

    // For quests without a challenge: once the goals are done, the gate opens
    // when the meter is full. Returns 'gate' when it opens, 'hungry' if the goals
    // are done, the meter is not full and nothing is left to eat, else null.
    checkFull(energy, foodLeft) {
      if (stage !== 'goals' || !this.goalsDone() || ch) return null;
      if (!def.full || energy >= def.full) { stage = 'gate'; return 'gate'; }
      if (!foodLeft) { stage = 'hungry'; return 'hungry'; }
      return null;
    },

    // Start the end challenge once the goals are done. Also used to retry.
    startChallenge() {
      if (!ch) return false;
      if (!(stage === 'goals' && this.goalsDone()) && stage !== 'failed') return false;
      stage = 'challenge'; ch.have = 0; ch.left = ch.seconds; tries++;
      return true;
    },

    // Run the challenge clock. Returns 'won', 'lost' or null.
    tick(dt) {
      if (stage !== 'challenge') return null;
      if (ch.have >= ch.need) { stage = 'gate'; return 'won'; }
      ch.left -= dt;
      if (ch.left <= 0) { ch.left = 0; stage = 'failed'; return 'lost'; }
      return null;
    },

    gateOpen() { return stage === 'gate' || stage === 'complete'; },
    // The area is complete only when Wally walks out through the open gate.
    leave() { if (stage === 'gate') stage = 'complete'; return stage === 'complete'; },
    complete() { return stage === 'complete'; },
  };
}

// Areas Wally has been to. The first visit plays the area's cinematic
// introduction; after that the map can take him back to any of them.
export function markVisited(visited, id) {
  const first = !visited.includes(id);
  return { visited: first ? [...visited, id] : visited, first };
}

export function mapChoices(visited) {
  return AREAS.filter(a => a.ready && visited.includes(a.id));
}

export function nextArea(id) {
  const i = AREAS.findIndex(a => a.id === id);
  return i >= 0 && i < AREAS.length - 1 ? AREAS[i + 1] : null;
}
