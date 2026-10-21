// Sidequests (Ken, 2026-10-18): one a visit, found inside a group's circle.
import { QUESTS, pickQuest, nextStage, questReward, QUEST_TOKENS } from '../js/sidequest-rules.js';
import { freshProgress, readProgress } from '../js/progress.js';

let pass = 0, fail = 0;
function check(name, ok, detail = '') { if (ok) pass++; else { fail++; console.log('FAIL', name, detail); } }
// Seeds spread out: with small seeds this generator's first number is always tiny.
function seeded(s) { s = (s * 104729 + 12345) % 2147483647; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

const PLACES = ['lagoonBottom', 'boulderTop', 'boardwalk', 'lampTop', 'pierEnd', 'sea', 'behindStall', 'awning', 'trailGate'];
check('every land with visitors has quests', ['park', 'esplanade', 'kuranda'].every(l => QUESTS[l].length >= 3));
check('every quest says what is lost, where, and asks nicely', Object.values(QUESTS).flat().every(q => q.thing && PLACES.includes(q.where) && q.ask.length > 20));
check('quest ids are unique in each land', Object.values(QUESTS).every(l => new Set(l.map(q => q.id)).size === l.length));

const p = freshProgress();
const picks = new Set(); for (let s = 1; s < 200; s++) picks.add(pickQuest('park', seeded(s), p).id);
check('the quest changes from visit to visit', picks.size === QUESTS.park.length);
let pierless = true; for (let s = 1; s < 200; s++) if (pickQuest('esplanade', seeded(s), p).id === 'thongs') pierless = false;
check('no quest at the pier before it is open', pierless);
let pier = false; for (let s = 1; s < 200; s++) if (pickQuest('esplanade', seeded(s), { ...p, pier: true }).id === 'thongs') pier = true;
check('the pier quest once it is open', pier);
check('no visitors, no quest', pickQuest('reef', Math.random, p) === null);

check('meeting the giver asks the quest', nextStage('hidden', 'met') === 'asked');
check('finding the thing means carrying it back', nextStage('asked', 'found') === 'carrying');
check('bringing it back finishes it', nextStage('carrying', 'returned') === 'done');
check('out of order changes nothing', nextStage('hidden', 'found') === 'hidden' && nextStage('asked', 'returned') === 'asked');

const r = questReward(p);
check('a quest done pays Golden Mangoes and is counted', r.mangoes === QUEST_TOKENS && r.sidequests === 1);
check('quests done are saved', readProgress(JSON.stringify(r)).sidequests === 1);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
