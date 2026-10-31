// escape-rules.js
// The race to the way out, once Wally has broken out of the croc fence (Ken, 2026-10-30: "a high speed high stakes
// race to the exit"). The more mangoes he has, the more of the grounds' gates open; once they all are, the chest with
// the golden mango opens; he shows that to the wrangler, who knows then that the Croc King summoned him: it is Wally's
// to carry to the King in the Daintree, with the sceptre, and the wrangler unlocks the final gate to the cane field.
// Either way round the park has enough mangoes to do it, and he keeps what he has found if he is caught. Pure numbers, no three.js (test/sections.test.mjs walks it).

import { placed, DIVIDERS, allBoxes, BOX } from './park-sections.js';

export const MANGO_NEED = 20, MANGO_ENERGY = 5;

// Where they lie, by angle round the path and metres out from the croc fence, section by section.
const SPOTS = {
  bridge: [[350, 3.5], [352, 10], [358, 16], [8, 14], [12, 7], [15, 3.5]],
  foodCourt: [[25, 3.5], [35, 8], [40, 18], [57, 8], [60, 17], [68, 3.5], [80, 9]],
  serviceYard: [[340, 3.5], [330, 12], [320, 3.5], [310, 15], [300, 13], [290, 3.5], [280, 17]],
  keepersYards: [[268, 3.5], [255, 6.5], [240, 18], [225, 6.5], [222, 19], [208, 3.5]],
  wayOut: [[95, 3.5], [115, 7], [125, 3.5], [135, 15], [150, 3.5], [150, 14], [165, 12], [190, 3.5], [185, 12], [105, 18], [178, 3.5]],
};
export const MANGO_COUNTS = Object.fromEntries(Object.entries(SPOTS).map(([k, v]) => [k, v.length]));
// up: how high it lies (on top of a box). The ones on the ground are enough to win; the boxes' are the quick way, if he can climb.
export function mangoSpots() {
  const ground = Object.values(SPOTS).flat().map(([deg, out]) => { const p = placed(deg, out); return { x: p.x, z: p.z, up: 0 }; });
  const high = allBoxes().filter(b => b.top > BOX.tops[0]).map(b => ({ x: b.x, z: b.z, up: b.top }));
  return [...ground, ...high];
}

// The chest with the Giant Mango, round behind the Reptile House: past most of the way-out section's mangoes.
export function giantChestSpot() { const p = placed(120, 19); return { x: p.x, z: p.z, rot: p.rot }; }

// What he must do next: 'mangoes', 'chest', 'give' (the golden mango, shown to the wrangler), then 'exit'.
export function escapeStage(mangoes, giant, given) { return given ? 'exit' : giant ? 'give' : mangoes >= MANGO_NEED ? 'chest' : 'mangoes'; }
// How close he comes to the wrangler to show it.
export const GIVE_REACH = 2.6;
// The next gate he can open, in mangoes: how many it takes, or null when all are open.
export function nextGateNeed(mangoes) {
  const left = DIVIDERS.map(d => d.need).filter(n => n > mangoes);
  return left.length ? Math.min(...left) : null;
}
