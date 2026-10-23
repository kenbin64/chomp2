// ground.js
// What the current level is made of, in one place: what Wally stands on, where
// he may move, where thrown food lands, and where water is. Wally and the food
// ask this, never a level directly, so every level can bring its own ground.
// The park's ground is the default; another level calls setGround() at start.

import { standHeight, clampToPark, railClamp, onDeck, deckHeight, deckBlocks, deckOpenAt, foodSurface, isWater, terrainHeight, ROCKS } from './rules.js';

// Solid things (Ken, 2026-10-20: he must climb or jump, never go through): palm
// trunks, lamp posts, the sign; each an upright circle { x, z, r, top } (top:
// Infinity for a post he can only go round). Rocks are solid too, up to their
// tops: low enough ones he climbs (a hop), higher ones he has to jump onto.
export const SOLIDS = [];
export function addSolid(x, z, r, top = Infinity) { SOLIDS.push({ x, z, r, top }); }
const BODY = 0.45;          // Wally's half-width, for bumping into things
const STEP = 0.35;          // a step up he simply walks
const CLIMB = 1.3;          // as high as he will climb by himself (a hop); higher, he jumps
const RAIL = 0.9;           // the boardwalk railing: over it only by jumping
function solidAt(x, z, feetY) {
  for (const r of ROCKS) if (Math.hypot(x - r.x, z - r.z) < r.r + BODY && feetY < r.top - STEP) return r;
  for (const s of SOLIDS) if (Math.hypot(x - s.x, z - s.z) < s.r + BODY && feetY < s.top - STEP) return s;
  return null;
}
// Does a step from (x, z) to (nx, nz) run into a rock or post? Only a step that ends inside one AND does not
// take him further out of it: once he is inside an edge (dived down beside a rock, knocked against it), any
// step away is always allowed, so he can never be trapped (Ken, 2026-10-22: stuck by a rock in the water).
export function solidBlocks(x, z, nx, nz, feetY, list = [...ROCKS, ...SOLIDS]) {
  for (const s of list) {
    const reach = s.r + BODY, after = Math.hypot(nx - s.x, nz - s.z);
    if (after >= reach || feetY >= s.top - STEP) continue;
    if (after > Math.hypot(x - s.x, z - s.z) + 1e-6) continue;           // moving out of it: always allowed
    return s;
  }
  return null;
}
// Onto the boardwalk from the side, where there is no opening: only over the railing.
function railBlocks(x, z, nx, nz, feetY) {
  return !onDeck(x, z) && onDeck(nx, nz) && !deckOpenAt(nx) && feetY < deckHeight(nx) + RAIL;
}

export const parkGround = {
  // { y, surface } under (x, z) for feet at feetY. fromBelow: coming up from water.
  stand: (x, z, feetY, floatY, fromBelow) => standHeight(x, z, feetY, floatY, fromBelow),
  // Where a step from (x, z) at height y toward (nx, nz) actually ends up.
  move(x, z, nx, nz, y) {
    let tz = nz;
    if (onDeck(x, z) && y >= deckHeight(x) - 0.3) tz = railClamp(nx, z, nz);
    // The boardwalk is solid from the side: stop at it (sliding along it), unless
    // there is room to pass under or he has jumped up level with it.
    const swimming = isWater(x, z);
    if (!onDeck(x, z) && deckBlocks(nx, tz, y, swimming)) {
      if (!deckBlocks(nx, z, y, swimming)) tz = z;                // slide along it
      else if (!deckBlocks(x, tz, y, swimming)) nx = x;
      else { nx = x; tz = z; }
    }
    // Rocks, trunks, posts and the railing are solid: stop at them, sliding along.
    const blocked = (px, pz) => solidBlocks(x, z, px, pz, y) || railBlocks(x, z, px, pz, y);
    if (blocked(nx, tz)) {
      if (!blocked(nx, z)) tz = z;
      else if (!blocked(x, tz)) nx = x;
      else { nx = x; tz = z; }
    }
    return clampToPark(nx, tz);
  },
  // Walking into something he can climb (a rock no higher than CLIMB above his
  // feet): the height to hop up to, else null.
  climb(nx, nz, feetY) {
    const r = solidAt(nx, nz, feetY);
    return r && r.top !== Infinity && r.top - feetY <= CLIMB ? r.top : null;
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
