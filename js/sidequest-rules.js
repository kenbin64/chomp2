// sidequest-rules.js
// Sidequests (Ken, 2026-10-18): each visit one group of visitors has a small
// problem for Wally (something lost, blown away or stuck up high). Like the
// traders, nobody can tell which group until Wally steps inside their circle.
// He finds the thing, often by diving, jumping or climbing, and brings it back.
// Plain JavaScript, no three.js, so it can be tested (test/sidequest.test.mjs).
//
// Each quest's `where` names a kind of place the level knows how to find:
//   lagoonBottom, boulderTop, boardwalk, lampTop, pierEnd, sea, behindStall, awning, trailGate

export const QUESTS = {
  park: [
    { id: 'hat',     thing: 'sun hat',    where: 'lagoonBottom', ask: "My hat blew off into the lagoon! It's sunk to the bottom out in the middle. Could you dive for it?" },
    { id: 'footy',   thing: 'footy',      where: 'boulderTop',   ask: 'Our footy got kicked up on top of a boulder! Can you get up there?' },
    { id: 'sunnies', thing: 'sunnies',    where: 'boardwalk',    ask: 'I left my sunnies somewhere on the boardwalk. Could you have a look?' },
  ],
  esplanade: [
    { id: 'kite',    thing: 'kite',       where: 'lampTop',      ask: "My kite's stuck up on a lamp post along the promenade! You'll have to jump for it." },
    { id: 'thongs',  thing: 'thongs',     where: 'pierEnd',      ask: 'I left my thongs at the far end of the pier. Could you fetch them?', needs: 'pier' },
    { id: 'ball',    thing: 'beach ball', where: 'sea',          ask: 'Our beach ball blew into the sea! It is floating out past the wall.' },
  ],
  kuranda: [
    { id: 'net',     thing: 'butterfly net', where: 'behindStall', ask: 'I dropped my butterfly net behind one of the stalls. Could you find it?' },
    { id: 'akubra',  thing: 'Akubra hat',    where: 'awning',      ask: 'The wind took my hat up onto a stall awning! Can you jump up and get it?' },
    { id: 'coffee',  thing: 'bag of coffee', where: 'trailGate',   ask: 'I put down my bag of Tableland coffee near the gate to the falls trail. Could you bring it?' },
  ],
};

export const QUEST_TOKENS = 3;

// This visit's quest in a land: one the player can do now (a pier quest only once the pier is open).
export function pickQuest(land, rnd, progress) {
  const list = (QUESTS[land] || []).filter(q => !q.needs || progress[q.needs]);
  return list.length ? list[Math.floor(rnd() * list.length)] : null;
}

// Where the quest is up to: 'hidden' (giver not found yet), 'asked' (looking for
// the thing), 'carrying' (bring it back), 'done'.
export function nextStage(stage, happened) {
  if (stage === 'hidden' && happened === 'met') return 'asked';
  if (stage === 'asked' && happened === 'found') return 'carrying';
  if (stage === 'carrying' && happened === 'returned') return 'done';
  return stage;
}

// The reward: Golden Mangoes, and a count of quests done for Wally's page.
export function questReward(progress) {
  return { ...progress, mangoes: (progress.mangoes || 0) + QUEST_TOKENS, sidequests: (progress.sidequests || 0) + 1 };
}
