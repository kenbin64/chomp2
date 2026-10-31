// Wally's Tourist Book (Ken, 2026-10-18): stamps, tiers by visit, abilities and hidden finds.
import { STAMPS, LANDS, ABILITIES, MAX_LEVEL, UPGRADE_COST, abilityLevel, abilityValue, upgradeAbility, upgradeCost,
         countVisit, tierFor, openStamps, award, StampRun, hiddenReward, applyReward, ITEMS, discover, EVENT_ITEM,
         GEAR_USES, GEAR_PRICE, gearStock, giveGear, equip, unequip, useGear, buyGear, fullUses } from '../js/book-rules.js';
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
// (A stamp that takes a count: three gifts.)
const counted = [{ id: 'park-gift', event: 'gift', count: 3 }];
for (let i = 0; i < 2; i++) got = got.concat(run.record('gift', counted));
check('2 gifts is not yet the Good on ya stamp', !got.includes('park-gift'));
got = run.record('gift', counted);
check('the 3rd gift earns it', got.includes('park-gift'));
check('getting away from the wrangler uncaught earns the boss stamp', run.record('bossClean', open).includes('park-boss'));
const run2 = new StampRun('park');
run2.record('hurt', open);
const chest = run2.record('chest', open);
check('the chest stamp is earned even after a sting', chest.includes('park-chest'));
check('but not the "without a sting" one', !chest.includes('park-clean'));
check('without a sting, both are earned', new StampRun('park').record('chest', open).includes('park-clean'));
const q = award(p, 'park-chest');
check('a stamp goes in the book with a Golden Mango', q.stamps.includes('park-chest') && q.mangoes === 1);
check('the same stamp only once', award(q, 'park-chest').mangoes === 1);
check('a stamped challenge is no longer open', !openStamps(q, 'park').some(s => s.id === 'park-chest'));

// Abilities.
let a = { ...freshProgress(), mangoes: 20 };
check('abilities start at level 0, plain', ABILITIES.every(x => abilityLevel(a, x.id) === 0 && abilityValue(a, x.id) === 1));
const up = upgradeAbility(a, 'swisher');
check('Golden Mangoes buy the next level', up.ok && abilityLevel(up.progress, 'swisher') === 1 && up.progress.mangoes === 20 - UPGRADE_COST[0]);
check('each level gives an item more uses', fullUses(up.progress, 'swisher') > fullUses(a, 'swisher'));
let top = a; for (let i = 0; i < MAX_LEVEL; i++) top = upgradeAbility({ ...top, mangoes: 99 }, 'net').progress;
check('no further than the top level', upgradeAbility({ ...top, mangoes: 99 }, 'net').why === 'max' && upgradeCost(top, 'net') === null);
check('not without enough Golden Mangoes', upgradeAbility({ ...a, mangoes: 1 }, 'spring').why === 'mangoes');

// Hidden finds.
const seq = v => () => v;
check('a hidden find can give tokens', hiddenReward(seq(0.9), a).kind === 'tokens');
const ab = hiddenReward(seq(0.1), a);
check('or an item to use', ab.kind === 'item' && gearStock(applyReward(a, ab), ab.id) === 1);
const maxed = { ...a, abilities: Object.fromEntries(ABILITIES.map(x => [x.id, MAX_LEVEL])) };
// Gear (Ken): owning is not using; equip one at a time; it wears out; more can be found.
let g = giveGear(freshProgress(), 'net', 2);
check('an item in the bag is not in use', gearStock(g, 'net') === 2 && !g.equipped);
check('he cannot equip what he does not have', equip(g, 'snorkel').why === 'none');
g = equip(g, 'net').progress;
check('equipping takes one out of the bag, full of swings', g.equipped === 'net' && g.uses === GEAR_USES.net(0) && gearStock(g, 'net') === 1);
let worn = g; for (let i = 0; i < GEAR_USES.net(0); i++) worn = useGear(worn).progress;
check('used up, the next net comes out of the bag', worn.equipped === 'net' && worn.uses === GEAR_USES.net(0) && gearStock(worn, 'net') === 0);
for (let i = 0; i < GEAR_USES.net(0); i++) worn = useGear(worn).progress;
check('the last one used up: empty hands', worn.equipped === null && !useGear(worn).ok);
let sn = equip(giveGear(freshProgress(), 'snorkel'), 'snorkel').progress;
const once = useGear(sn);
check('the snorkel is used once', once.ok && once.wornOut && once.progress.equipped === null);
let sw = equip(giveGear(giveGear(freshProgress(), 'swisher'), 'spring'), 'swisher').progress;
sw = useGear(sw).progress;
const left = sw.uses;
sw = equip(sw, 'spring').progress;
check('one item at a time: equipping another puts the first away', sw.equipped === 'spring');
sw = equip(sw, 'swisher').progress;
check('a part-used item keeps its uses for next time', sw.equipped === 'swisher' && sw.uses === left && gearStock(sw, 'swisher') === 0);
check('putting it away keeps it too', unequip(sw).partial.swisher === left);
const bought = buyGear({ ...freshProgress(), mangoes: GEAR_PRICE }, 'snorkel');
check('a fresh one costs Golden Mangoes', bought.ok && gearStock(bought.progress, 'snorkel') === 1 && bought.progress.mangoes === 0);
check('not without enough Golden Mangoes', buyGear({ ...freshProgress(), mangoes: 1 }, 'net').why === 'mangoes');
check('gear is saved', (() => { const r = readProgress(JSON.stringify({ ...g, gear: { net: 1, bogus: 3 } })); return r.equipped === 'net' && r.uses === g.uses && r.gear.net === 1 && !('bogus' in r.gear); })());

// Saved.
const saved = readProgress(JSON.stringify({ ...q, abilities: { swisher: 2, bogus: 9 }, visits: { park: 4 }, tokens: 3 }));   // an old save's tokens become mangoes
check('stamps, mangoes, abilities and visits are saved', saved.stamps.includes('park-chest') && saved.mangoes === q.mangoes + 3 && saved.abilities.swisher === 2 && !('bogus' in saved.abilities) && saved.visits.park === 4);
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
