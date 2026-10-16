// ground.js
// What the current level is made of, in one place: what Wally stands on, where
// he may move, where thrown food lands, and where water is. Wally and the food
// ask this, never a level directly, so every level can bring its own ground.
// The park's ground is the default; another level calls setGround() at start.

import { standHeight, clampToPark, railClamp, onDeck, deckHeight, foodSurface, isWater, terrainHeight } from './rules.js';

export const parkGround = {
  // { y, surface } under (x, z) for feet at feetY. fromBelow: coming up from water.
  stand: (x, z, feetY, floatY, fromBelow) => standHeight(x, z, feetY, floatY, fromBelow),
  // Where a step from (x, z) at height y toward (nx, nz) actually ends up.
  move(x, z, nx, nz, y) {
    let tz = nz;
    if (onDeck(x, z) && y >= deckHeight(x) - 0.3) tz = railClamp(nx, z, nz);
    return clampToPark(nx, tz);
  },
  // Height food stops at, coming down at (x, z) from prevY.
  foodAt: (x, z, prevY) => foodSurface(x, z, prevY),
  isWater: (x, z) => isWater(x, z),
  start: () => ({ x: 0, y: terrainHeight(0, 21), z: 21 }),
};

export const ground = { ...parkGround };

export function setGround(g) {
  Object.assign(ground, g);
}
