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

// The outfit catalogue (Ken): complete outfits only, a female croc to come, and a name of your own.
{
  const P = await import('../js/progress.js');
  const p0 = { ...P.freshProgress(), mangoes: 50 };
  check('they start in their own clothes, owned', p0.wardrobe.owned.includes('classic') && p0.wardrobe.owned.includes('vest-ranger') && P.outfitOn(p0, 'wally').id === 'classic');
  const b1 = P.buyItem(p0, 'reef');
  check('buying takes the mangoes', b1.ok && b1.progress.mangoes === 25 && b1.progress.wardrobe.owned.includes('reef'));
  check('cannot buy it twice', P.buyItem(b1.progress, 'reef').why === 'owned');
  check('cannot buy without enough mangoes', P.buyItem({ ...p0, mangoes: 10 }, 'disco').why === 'mangoes');
  check('cannot buy what is not for sale', P.buyItem(p0, 'tuxedo').why === 'unknown');
  check('one still to come cannot be bought yet', P.buyItem(p0, 'female').why === 'soon');
  const w1 = P.wearItem(b1.progress, 'reef');
  check('a complete outfit is worn whole: shirt and shorts together', P.outfitOn(w1, 'wally').id === 'reef' && P.wearing(w1, 'wally').shirt && P.wearing(w1, 'wally').shorts);
  check('cannot wear what is not owned', P.outfitOn(P.wearItem(p0, 'vest-ocean'), 'kenny').id === 'vest-ranger');
  const ex = P.wearItem({ ...P.buyItem({ ...p0, mangoes: 99 }, 'explorer').progress }, 'explorer');
  check('a model outfit loads its own model, and no recolour', P.outfitModel(ex) === 'wally-explorer' && !P.wearing(ex, 'wally').shirt);
  check('the classic outfit uses his own model', P.outfitModel(p0) === 'wally');
  const named = P.setCrocName(w1, 'Wanda');
  const back = P.readProgress(JSON.stringify(named));
  check('the outfit and the name are saved', P.outfitOn(back, 'wally').id === 'reef' && P.crocName(back) === 'Wanda');
  check('no name: he is Wally', P.crocName(p0) === 'Wally');
  const old = P.readProgress(JSON.stringify({ unlocked: ['park'], wardrobe: { owned: ['shirt-reef', 'made-up'], wear: { wally: { shirt: 'shirt-reef' } } } }));
  check('an older save starts again in his own clothes', P.outfitOn(old, 'wally').id === 'classic' && !old.wardrobe.owned.includes('made-up'));
  check('every outfit belongs to Wally or Kenny and has a price', P.OUTFITS.every(i => ['wally', 'kenny'].includes(i.who) && i.price >= 0));
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

// The chain (Ken, 2026-10-18): each level builds on the one before; finds are kept even after a failed run.
{
  const P = await import('../js/progress.js');
  let p = P.freshProgress();
  check('the Esplanade needs the ranger badge', P.entryNeeds(p, 'esplanade').what === 'badge');
  p = P.completeArea(p, 'park', { score: 50, stars: 1, mangoes: 6 });
  check('finishing Croc Park gives the badge and banks its mangoes', p.badge && p.mangoes === 6 && P.entryNeeds(p, 'esplanade') === null);
  // The Esplanade pier opens for mangoes brought from Croc Park.
  check('the pier is shut to start with', !p.pier);
  check('not enough mangoes: the pier stays shut', P.openPier(p).why === 'mangoes');
  p = P.bankFinds(p, { mangoes: P.PIER_PRICE });
  const pier = P.openPier(p);
  check('with enough mangoes the pier opens, once, and they are spent', pier.ok && pier.progress.pier && pier.progress.mangoes === 6 && P.openPier(pier.progress).why === 'open');
  p = pier.progress;
  check('the reef needs a pearl', P.entryNeeds(p, 'reef').what === 'pearls');
  p = P.bankFinds(p, { pearls: 2 });                               // a failed Esplanade run still banks its finds
  check('a failed run keeps its pearls, and the reef is open', p.pearls === 2 && P.entryNeeds(p, 'reef') === null);
  // The reef gives seashells; clearing it earns the Skyrail pass.
  check('Kuranda needs the Skyrail pass', P.entryNeeds(p, 'kuranda').what === 'skyrail');
  p = P.bankFinds(p, { shells: 5 });
  check('a failed reef dive keeps its shells but not the pass', p.shells === 5 && P.entryNeeds(p, 'kuranda').what === 'skyrail');
  p = P.completeArea(p, 'reef', { score: 80, stars: 1, shells: 4 });
  check('clearing the reef earns the Skyrail pass', p.skyrail && p.shells === 9 && P.entryNeeds(p, 'kuranda') === null);
  // Kuranda: the vendor buys mangoes and shells for gold; gold buys the boat ticket.
  const sold = P.sellToVendor(p, { mangoes: 4, shells: 9 });
  check('the vendor pays gold for mangoes and shells', sold.gold === 4 * P.VENDOR_PAYS.mangoes + 9 * P.VENDOR_PAYS.shells && sold.progress.mangoes === 2 && sold.progress.shells === 0 && sold.progress.coins === sold.gold);
  check('you cannot sell what you do not have', P.sellToVendor(p, { shells: 99 }).progress.shells === 0 && P.sellToVendor(p, { shells: 99 }).gold === 9 * P.VENDOR_PAYS.shells);
  check('the Daintree needs a river-boat ticket', P.entryNeeds(sold.progress, 'daintree').what === 'ticket');
  check('the ticket needs enough gold', P.buyBoatTicket({ ...sold.progress, coins: 3 }).why === 'gold');
  const t = P.buyBoatTicket({ ...sold.progress, coins: P.BOAT_TICKET_PRICE + 5 });
  check('buying the ticket with gold opens the Daintree', t.ok && t.progress.coins === 5 && P.entryNeeds(t.progress, 'daintree') === null);
  const back = P.readProgress(JSON.stringify(t.progress));
  check('badge, pier, shells, gold, Skyrail pass and ticket are saved', back.badge && back.pier && back.shells === 0 && back.coins === 5 && back.skyrail && back.boatTicket);
  check('an older save that finished the park still has its badge', P.readProgress(JSON.stringify({ unlocked: ['park', 'esplanade'], stars: { park: 2 } })).badge);
}

// Gear and tickets (Ken): the exception to complete outfits.
{
  const P = await import('../js/progress.js');
  const p0 = { ...P.freshProgress(), mangoes: 100, coins: 100 };
  const c = P.buyExtra(p0, 'ticket-cruise');
  check('the river cruise ticket is the Daintree boat ticket', c.ok && c.progress.boatTicket && P.entryNeeds(c.progress, 'daintree') === null && P.hasExtra(c.progress, 'ticket-cruise'));
  check('cannot buy it twice', P.buyExtra(c.progress, 'ticket-cruise').why === 'owned');
  check('gear still to come cannot be bought yet', P.buyExtra(p0, 'boomerang').why === 'soon');
  check('the cruise ticket is paid in gold', c.progress.coins === 100 - P.BOAT_TICKET_PRICE && c.progress.mangoes === 100);
  check('not enough gold', P.buyExtra({ ...p0, coins: 5 }, 'ticket-cruise').why === 'gold');
  check('owned extras are saved', P.readProgress(JSON.stringify({ ...p0, extras: ['boomerang', 'nonsense'] })).extras.join() === 'boomerang');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
