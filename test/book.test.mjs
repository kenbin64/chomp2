// Wally's Tourist Book (Ken, 2026-10-18): stamps, tiers by visit, abilities and hidden finds.
import { STAMPS, LANDS, ABILITIES, MAX_LEVEL, UPGRADE_COST, abilityLevel, abilityValue, upgradeAbility, upgradeCost,
         countVisit, tierFor, openStamps, award, StampRun, hiddenReward, applyReward, ITEMS, discover, EVENT_ITEM } from '../js/book-rules.js';
import { freshProgress, readProgress } from '../js/progress.js';

let pass = 0, fail = 0;
function check(name, ok, detail = '') { if (ok) pass++; else { fail++; console.log('FAIL', name, detail); } }

// The album.
check('every stamp has a unique id', new Set(STAMPS.map(s => s.id)).size === STAMPS.length);
check('every land has three stamps in each of three tiers', LANDS.every(l => [1, 2, 3].every(v => STAMPS.filter(s => s.land === l && s.visit === v).length === 3)));
check('every stamp says how to earn it', STAMPS.every(s => s.name && s.how && s.event));

// Going back is new: the tiers open by visit.
let p = freshProgress();
check('before any visit, the first tier', tierFor(p, 'park') === 1 && openStamps(p, 'park').every(s => s.visit === 1));
p = countVisit(p, 'park');
check('the first visit: tier one only', tierFor(p, 'park') === 1 && openStamps(p, 'park').length === 3);
p = countVisit(p, 'park');
check('the second visit opens new challenges', tierFor(p, 'park') === 2 && openStamps(p, 'park').some(s => s.visit === 2));
p = countVisit(countVisit(p, 'park'), 'park');
check('tiers stop at three', tierFor(p, 'park') === 3 && openStamps(p, 'park').length === 9);
check('each land counts its own visits', tierFor(p, 'reef') === 1);

// Earning stamps within one visit.
const run = new StampRun('park');
const open = openStamps(p, 'park');
let got = [];
for (let i = 0; i < 7; i++) got = got.concat(run.record('mango', open));
check('7 mangoes is not yet the Mango hunter stamp', !got.includes('park-mangoes'));
got = run.record('mango', open);
check('the 8th mango earns it', got.includes('park-mangoes'));
const run2 = new StampRun('park');
run2.record('hurt', open);
const chest = run2.record('chest', open);
check('the chest stamp is earned even after a sting', chest.includes('park-chest'));
check('but not the "without a sting" one', !chest.includes('park-clean'));
check('without a sting, both are earned', new StampRun('park').record('chest', open).includes('park-clean'));
const q = award(p, 'park-chest');
check('a stamp goes in the book with a Tourist Token', q.stamps.includes('park-chest') && q.tokens === 1);
check('the same stamp only once', award(q, 'park-chest').tokens === 1);
check('a stamped challenge is no longer open', !openStamps(q, 'park').some(s => s.id === 'park-chest'));

// Abilities.
let a = { ...freshProgress(), tokens: 20 };
check('abilities start at level 0, plain', ABILITIES.every(x => abilityLevel(a, x.id) === 0 && abilityValue(a, x.id) === 1));
const up = upgradeAbility(a, 'swisher');
check('tokens buy the next level', up.ok && abilityLevel(up.progress, 'swisher') === 1 && up.progress.tokens === 20 - UPGRADE_COST[0]);
check('each level makes it easier', abilityValue(up.progress, 'swisher') > abilityValue(a, 'swisher'));
let top = a; for (let i = 0; i < MAX_LEVEL; i++) top = upgradeAbility({ ...top, tokens: 99 }, 'net').progress;
check('no further than the top level', upgradeAbility({ ...top, tokens: 99 }, 'net').why === 'max' && upgradeCost(top, 'net') === null);
check('not without enough tokens', upgradeAbility({ ...a, tokens: 1 }, 'spring').why === 'tokens');

// Hidden finds.
const seq = v => () => v;
check('a hidden find can give tokens', hiddenReward(seq(0.9), a).kind === 'tokens');
const ab = hiddenReward(seq(0.1), a);
check('or an ability level', ab.kind === 'ability' && applyReward(a, ab).abilities[ab.id] === 1);
const maxed = { ...a, abilities: Object.fromEntries(ABILITIES.map(x => [x.id, MAX_LEVEL])) };
check('with every ability at the top, it gives tokens', hiddenReward(seq(0.1), maxed).kind === 'tokens');

// Saved.
const saved = readProgress(JSON.stringify({ ...q, abilities: { swisher: 2, bogus: 9 }, visits: { park: 4 }, tokens: 3 }));
check('stamps, tokens, abilities and visits are saved', saved.stamps.includes('park-chest') && saved.tokens === 3 && saved.abilities.swisher === 2 && !('bogus' in saved.abilities) && saved.visits.park === 4);
check('an older save starts with an empty book', readProgress(JSON.stringify({ unlocked: ['park'] })).stamps.length === 0);

// Things found: the book opens on each the first time only, and lists it after.
check('every thing says what it is and what it can do', ITEMS.every(i => i.name && i.is && i.does && i.icon));
check('item ids are unique', new Set(ITEMS.map(i => i.id)).size === ITEMS.length);
check('every event names a real thing', Object.values(EVENT_ITEM).every(id => ITEMS.some(i => i.id === id)));
const d1 = discover(freshProgress(), 'mango');
check('the first mango is news', d1.first && d1.progress.discovered.includes('mango'));
check('the second is not', !discover(d1.progress, 'mango').first);
check('things found are saved', readProgress(JSON.stringify(d1.progress)).discovered.includes('mango'));

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
