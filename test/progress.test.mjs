// Tests for js/progress.js. Run:  node test/progress.test.mjs

import { freshProgress, starsFor, completeArea, isOpen, readProgress, POSTCARDS } from '../js/progress.js';
import { AREAS } from '../js/quests.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

const p0 = freshProgress();
check('a new player has only the park open', p0.unlocked.join() === 'park' && isOpen(p0, 'park'));
check('the second area starts locked', !isOpen(p0, AREAS[1].id));

check('no stars below the first threshold', starsFor(99, [100, 200, 300]) === 0);
check('exactly on a threshold earns it', starsFor(200, [100, 200, 300]) === 2);
check('three is the most', starsFor(1e9, [100, 200, 300]) === 3);

const p1 = completeArea(p0, 'park', { score: 500, stars: 2, mangoes: 12 });
check('finishing the park records stars, best and mangoes', p1.stars.park === 2 && p1.best.park === 500 && p1.mangoes === 12);
check('finishing the park collects its postcard', p1.postcards.includes('park'));
check('it does not change the old progress', p0.unlocked.length === 1 && !p0.stars.park);
const next = AREAS[1];
check('the next area opens only if it is built', isOpen(p1, next.id) === next.ready);

const p2 = completeArea(p1, 'park', { score: 300, stars: 1, mangoes: 5 });
check('a worse run never lowers stars or best', p2.stars.park === 2 && p2.best.park === 500);
check('mangoes still add up', p2.mangoes === 17);
check('the postcard is not collected twice', p2.postcards.filter(x => x === 'park').length === 1);
check('negative mangoes are ignored', completeArea(p0, 'park', { mangoes: -50 }).mangoes === 0);

check('broken saved data starts fresh', JSON.stringify(readProgress('not json')) === JSON.stringify(freshProgress()));
check('saved data without the park is repaired', readProgress('{"unlocked":["reef"]}').unlocked.join() === 'park');
const round = readProgress(JSON.stringify(p2));
check('progress survives saving and loading', JSON.stringify(round) === JSON.stringify(p2));

check('every area has a postcard', AREAS.every(a => typeof POSTCARDS[a.id] === 'string' && POSTCARDS[a.id].length > 20));

// Pearls, from the Esplanade on, are kept across the whole trip.
{
  const a = completeArea(p0, 'esplanade', { pearls: 7 }), b = completeArea(a, 'esplanade', { pearls: 3 });
  check('pearls add up across runs', a.pearls === 7 && b.pearls === 10);
  check('negative pearls are ignored', completeArea(p0, 'park', { pearls: -4 }).pearls === 0);
  check('pearls survive saving and loading', readProgress(JSON.stringify(b)).pearls === 10);
  check('an old save without pearls loads with none', readProgress(JSON.stringify({ unlocked: ['park'] })).pearls === 0);
}
// Stars open the adventure activities (Ken, 2026-10-17).
{
  const { ACTIVITIES, totalStars, activityOpen } = await import('../js/progress.js');
  const p = { ...freshProgress(), stars: { park: 3, esplanade: 2, reef: 1 } };
  check('stars add up across areas', totalStars(p) === 6);
  check('every activity names a real area', ACTIVITIES.every(a => ['mossman', 'kuranda'].includes(a.area)));
  check('the activities ask for more stars as they go', ACTIVITIES.filter(a => a.stars > 0).every((a, i, l) => i === 0 || a.stars > l[i - 1].stars));
  check('an activity in an area not built yet stays shut', !activityOpen(p, 'rapids'));
  check('an unknown activity is shut', !activityOpen(p, 'skydiving'));
  check('no stars yet, none earned', totalStars(freshProgress()) === 0);
}

// The wardrobe (Ken: new clothes for Wally and Kenny at the Kuranda markets).
{
  const P = await import('../js/progress.js');
  const p0 = { ...P.freshProgress(), mangoes: 50 };
  check('they start in their own clothes, owned', p0.wardrobe.owned.includes('shirt-sunset') && p0.wardrobe.owned.includes('vest-ranger'));
  const b1 = P.buyItem(p0, 'shirt-reef');
  check('buying takes the mangoes', b1.ok && b1.progress.mangoes === 25 && b1.progress.wardrobe.owned.includes('shirt-reef'));
  check('cannot buy it twice', P.buyItem(b1.progress, 'shirt-reef').why === 'owned');
  check('cannot buy without enough mangoes', P.buyItem({ ...p0, mangoes: 10 }, 'shirt-wattle').why === 'mangoes');
  check('cannot buy what is not for sale', P.buyItem(p0, 'tuxedo').why === 'unknown');
  const w1 = P.wearItem(b1.progress, 'shirt-reef');
  check('wearing what was bought', P.wearing(w1, 'wally').shirt.id === 'shirt-reef');
  check('cannot wear what is not owned', P.wearing(P.wearItem(p0, 'vest-ocean'), 'kenny').vest.id === 'vest-ranger');
  const b2 = P.buyItem(w1, 'wally-sunnies'), w2 = P.wearItem(b2.progress, 'wally-sunnies');
  check('an extra goes on, and comes off when chosen again', P.wearing(w2, 'wally').extra.id === 'wally-sunnies' && P.wearing(P.wearItem(w2, 'wally-sunnies'), 'wally').extra === null);
  const saved = P.readProgress(JSON.stringify(w2));
  check('the wardrobe is saved and read back', P.wearing(saved, 'wally').shirt.id === 'shirt-reef' && saved.wardrobe.owned.includes('wally-sunnies'));
  const broken = P.readProgress(JSON.stringify({ unlocked: ['park'], wardrobe: { owned: ['made-up'], wear: { wally: { shirt: 'made-up' } } } }));
  check('a broken saved wardrobe falls back to their own clothes', P.wearing(broken, 'wally').shirt.id === 'shirt-sunset' && !broken.wardrobe.owned.includes('made-up'));
  check('every item belongs to Wally or Kenny and has a price', P.WARDROBE.every(i => ['wally', 'kenny'].includes(i.who) && i.price >= 0));
}

// Going back (Ken): a finished or visited area stays open, and every return trip banks more.
{
  const P = await import('../js/progress.js');
  let p = P.freshProgress();
  p = P.completeArea(p, 'park', { score: 50, stars: 1 });
  p = P.completeArea(p, 'esplanade', { score: 80, stars: 2, mangoes: 40, pearls: 3 });
  p = P.completeArea(p, 'esplanade', { score: 60, stars: 1, mangoes: 35, pearls: 2 });
  check('going back to an area banks more mangoes and pearls', p.mangoes === 75 && p.pearls === 5);
  check('a weaker return trip never lowers the best stars or score', p.stars.esplanade === 2 && p.best.esplanade === 80);
  check('areas already reached stay open', p.unlocked.includes('park') && p.unlocked.includes('esplanade'));
}

// The ticket chain (Ken): each level gives what the next one needs; finds are kept even after a failed run.
{
  const P = await import('../js/progress.js');
  let p = P.freshProgress();
  check('the Esplanade needs the ranger badge', P.entryNeeds(p, 'esplanade').what === 'badge');
  p = P.completeArea(p, 'park', { score: 50, stars: 1 });
  check('finishing Croc Park gives the badge', p.badge && P.entryNeeds(p, 'esplanade') === null);
  check('the reef needs a pearl', P.entryNeeds(p, 'reef').what === 'pearls');
  p = P.bankFinds(p, { mangoes: 12, pearls: 2 });                 // a failed Esplanade run still banks its finds
  check('a failed run keeps its mangoes and pearls', p.mangoes === 12 && p.pearls === 2 && P.entryNeeds(p, 'reef') === null);
  check('Kuranda needs the Skyrail fare in gold coins', P.entryNeeds({ ...p, coins: 3 }, 'kuranda').what === 'coins');
  const rich = { ...p, coins: P.SKYRAIL_FARE + 2 };
  check('with enough coins Kuranda is open', P.entryNeeds(rich, 'kuranda') === null);
  const paid = P.payEntry(rich, 'kuranda');
  check('the fare is paid once and the pass kept', paid.coins === 2 && paid.skyrail && P.entryNeeds({ ...paid, coins: 0 }, 'kuranda') === null);
  check('paying again costs nothing', P.payEntry(paid, 'kuranda').coins === 2);
  check('the Daintree needs a river-boat ticket', P.entryNeeds(paid, 'daintree').what === 'ticket');
  check('the ticket needs enough mangoes', P.buyBoatTicket({ ...paid, mangoes: 10 }).why === 'mangoes');
  const t = P.buyBoatTicket({ ...paid, mangoes: P.BOAT_TICKET_PRICE + 5 });
  check('buying the ticket opens the Daintree', t.ok && t.progress.mangoes === 5 && P.entryNeeds(t.progress, 'daintree') === null);
  const back = P.readProgress(JSON.stringify(t.progress));
  check('badge, coins, Skyrail pass and ticket are saved', back.badge && back.coins === 2 && back.skyrail && back.boatTicket);
  check('an older save that finished the park still has its badge', P.readProgress(JSON.stringify({ unlocked: ['park', 'esplanade'], stars: { park: 2 } })).badge);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
