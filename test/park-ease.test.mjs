// Tests for park-ease.js: the gentle first visit to Croc Park.
// Run:  node test/park-ease.test.mjs

import { parkEase, thievesAllowed, FIRST_VISIT, ARRIVALS, ARRIVAL_LINES } from '../js/park-ease.js';
import { PARK_GROUPS, parkQuest, createQuest } from '../js/quests.js';
import { clusterStep, CLUSTER } from '../js/rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

// Happy path: the first visit is gentler on every count.
const first = parkEase(1);
check('the first visit has fewer groups to feed', first.first && first.groups < PARK_GROUPS && first.groups >= 3);
check('the meter drains slower than easy does later (0.5)', first.drain > 0 && first.drain < 0.5);
check('visitors are calmer and only bolt when he is right on them', first.calm > 1 && first.panic < 3.2 && first.panic > 0);
check('the throws ramp up more slowly', first.throwPace > 0 && first.throwPace < 1);

// A return visit plays as before.
const again = parkEase(2);
check('a return visit has all the groups', !again.first && again.groups === PARK_GROUPS);
check('a return visit keeps the trip drain and normal nerves', again.drain === null && again.calm === 1 && again.panic === null && again.throwPace === 1);
check('visit 3 is a return visit too', !parkEase(3).first);

// Thieves arrive in stages.
check('no thieves at the start', ['pelican', 'bat', 'toad', 'croc'].every(k => thievesAllowed(k, 0, 5) === 0));
check('a pelican after the first group', thievesAllowed('pelican', 1, 2) === 1 && thievesAllowed('bat', 1, 4) === 0);
check('more kinds join as groups are done', thievesAllowed('bat', 2, 4) === 1 && thievesAllowed('croc', 2, 3) === 1 && thievesAllowed('toad', 2, 5) === 0);
check('the full set by the end', thievesAllowed('pelican', 5, 2) === 2 && thievesAllowed('bat', 5, 4) === 4 && thievesAllowed('toad', 5, 5) === 5 && thievesAllowed('croc', 5, 3) === 3);
check('never more than there are', thievesAllowed('bat', 9, 1) === 1 && thievesAllowed('toad', 9, 3) === 3);
check('everything arrives before the last group, so the tour group is the full test', Object.values(ARRIVALS).every(a => a[a.length - 1][0] < FIRST_VISIT.groups));
check('the count only rises as groups are done', Object.keys(ARRIVALS).every(k => [0, 1, 2, 3, 4, 5, 6].every(d => thievesAllowed(k, d + 1, 9) >= thievesAllowed(k, d, 9))));

// The calmer visitors (rules.clusterStep with calm and panic).
const secondsUntilFlee = (calm, panic) => { const st = { nerves: 0, cooldown: 0 }; for (let t = 0; t < 30; t += 0.1) if (clusterStep(st, CLUSTER.near - 0.5, 0.1, 5, calm, panic) === 'flee') return t; return 99; };
check('normal visitors bolt after about CLUSTER.nerve seconds up close', Math.abs(secondsUntilFlee() - CLUSTER.nerve) < 0.25, secondsUntilFlee());
check('first-visit visitors put up with him longer', secondsUntilFlee(first.calm, first.panic) > secondsUntilFlee() * 1.4);
check('at 2.8 away normal visitors bolt at once, first-visit ones do not', clusterStep({ nerves: 0, cooldown: 0 }, 2.8, 0.1, 5) === 'flee' && clusterStep({ nerves: 0, cooldown: 0 }, 2.8, 0.1, 5, first.calm, first.panic) !== 'flee');
check('right on top of them they still bolt', clusterStep({ nerves: 0, cooldown: 0 }, 1, 0.1, 5, first.calm, first.panic) === 'flee');

// The shorter quest.
const q = createQuest(parkQuest(first.groups));
for (let i = 0; i < first.groups - 1; i++) q.record('groupDone');
check('the first-visit quest is not done one group short', !q.goalsDone());
q.record('groupDone');
check('and is done after the last group, then needs a full meter as usual', q.goalsDone() && q.checkFull(95, 0) === 'gate');
check('the default park quest still needs every group', createQuest().goals[0].need === PARK_GROUPS);

// Unhappy paths and edges.
check('on a return visit every thief is there from the start', thievesAllowed('toad', 0, 5, false) === 5);
check('an unknown kind gets none on the first visit', thievesAllowed('emu', 6, 3) === 0);
check('none of a kind there is none of stays none', thievesAllowed('bat', 6, 0) === 0);
check('every kind that arrives has a line to say so', Object.keys(ARRIVALS).every(k => typeof ARRIVAL_LINES[k] === 'string' && !/[–—]/.test(ARRIVAL_LINES[k])));

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
