// Tests for js/quests.js. Run:  node test/quests.test.mjs

import { createQuest, AREAS, nextArea, markVisited, mapChoices, FRENZY_QUEST, PARK_GROUPS, FULL } from '../js/quests.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

function finishGoals(q) {
  for (let i = 0; i < 25; i++) q.record('catch');
  for (let i = 0; i < 3; i++) q.record('leapCatch');
  q.record('streak8'); q.record('toast');
}

// The timed-challenge quest (kept for areas that use one)
const q = createQuest(FRENZY_QUEST);
check('starts on the goals', q.stage === 'goals' && !q.gateOpen());
check('cannot leave through a closed gate', !q.leave() && !q.complete());
check('challenge cannot start before the goals', !q.startChallenge() && q.stage === 'goals');
for (let i = 0; i < 24; i++) q.record('catch');
check('24 catches is not 25', q.goals[0].have === 24);
const done = q.record('catch');
check('25th catch finishes the goal, once', done.length === 1 && done[0].id === 'catch');
check('extra catches do not overcount', (q.record('catch'), q.goals[0].have === 25));
check('a finished goal is not reported again', q.record('catch').length === 0);
check('unknown events are ignored', q.record('nonsense').length === 0);
q.record('leapCatch'); q.record('leapCatch'); q.record('leapCatch'); q.record('streak8');
check('toast still missing: goals not done', !q.goalsDone());
q.record('toast');
check('all goals met', q.goalsDone());
check('goals alone do not open the gate', !q.gateOpen());

// End challenge
check('challenge starts', q.startChallenge() && q.stage === 'challenge' && q.challenge.left === 30);
check('goal events do not count during the challenge', (q.record('toast'), q.goals[3].have === 1));
for (let i = 0; i < 9; i++) q.record('catch');
check('9 of 10 is not a win', q.tick(1) === null && q.stage === 'challenge');
q.record('catch');
check('10th catch wins', q.tick(0.1) === 'won' && q.gateOpen());
check('area not complete until Wally leaves', !q.complete());
check('leaving completes it', q.leave() && q.complete());
check('a complete area cannot restart the challenge', !q.startChallenge());

// Losing and retrying
const r = createQuest(FRENZY_QUEST);
finishGoals(r);
r.startChallenge();
for (let i = 0; i < 5; i++) r.record('catch');
let result = null;
for (let s = 0; s < 31 && !result; s++) result = r.tick(1);
check('running out of time loses', result === 'lost' && r.stage === 'failed' && !r.gateOpen());
check('the clock stops at zero', r.challenge.left === 0);
check('a lost challenge can be retried', r.startChallenge() && r.challenge.have === 0 && r.tries === 2);
check('ticking a finished clock does nothing', createQuest().tick(5) === null);

// Separate quests, areas
check('quests do not share progress', createQuest(FRENZY_QUEST).goals.every(g => g.have === 0));

// The park: feed out every group, then fill the meter (Ken's rule)
const p = createQuest();
check('the park has no timed challenge', !p.startChallenge());
for (let i = 0; i < PARK_GROUPS - 1; i++) p.record('groupDone');
check('one group left: not done', !p.goalsDone() && p.checkFull(100, 5) === null);
p.record('groupDone');
check('all groups done', p.goalsDone());
check('meter not full and food still about: wait', p.checkFull(FULL - 10, 2) === null && p.stage === 'goals');
check('meter full opens the gate', p.checkFull(FULL, 0) === 'gate' && p.gateOpen());
check('then leaving completes it', p.leave() && p.complete());
const h = createQuest();
for (let i = 0; i < PARK_GROUPS; i++) h.record('groupDone');
check('not full with nothing left to eat is hungry', h.checkFull(FULL - 1, 0) === 'hungry' && !h.gateOpen());
check('a hungry park cannot be left', !h.leave());
check('full means 95 or more', FULL === 95);
check('seven areas, park first (Ken: seven is the limit)', AREAS.length === 7 && AREAS[0].id === 'park');
check('the park, the cane fields, the Esplanade, the reef and Kuranda are playable so far', AREAS.filter(a => a.ready).map(a => a.id).join() === 'park,cane,esplanade,reef,kuranda');
check('the reef is fourth, after the cane fields and the Esplanade', AREAS[3].id === 'reef' && AREAS[3].name === 'The Great Barrier Reef');
check("the map areas run in the trip's order", AREAS.map(a => a.id).join() === 'park,cane,esplanade,reef,kuranda,mossman,daintree');
check('after the Esplanade comes the reef', nextArea('esplanade').id === 'reef');
check('after the park come the cane fields (Ken, 2026-10-20)', nextArea('park').id === 'cane');
check('after the cane fields comes the Esplanade', nextArea('cane').id === 'esplanade');
check('Kuranda is fifth, after the reef (Ken, 2026-10-17)', AREAS[4].id === 'kuranda' && nextArea('reef').id === 'kuranda');
check('Mossman Gorge, then the Daintree, the last (Ken, 2026-10-18)', nextArea('mossman').id === 'daintree' && nextArea('daintree') === null);
check('unknown area has no next', nextArea('nowhere') === null);

// Visits and the map
const v1 = markVisited([], 'park');
check('first visit to the park is a first', v1.first && v1.visited.join() === 'park');
const v2 = markVisited(v1.visited, 'park');
check('second visit is not a first and adds nothing', !v2.first && v2.visited.length === 1);
check('map offers only places visited', mapChoices(['park']).map(a => a.id).join() === 'park');
check('map never offers an area that is not built', mapChoices(['park', 'reef']).every(a => a.ready));
check('nothing visited, nothing on the map', mapChoices([]).length === 0);

// Every area that can be played says what to do there, for the trip map.
check('every built area has an objective', AREAS.filter(a => a.ready).every(a => typeof a.objective === 'string' && a.objective.length > 20));
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
