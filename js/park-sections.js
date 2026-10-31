// park-sections.js
// The park's grounds, split into sections for the chase (Ken, 2026-10-30: "different sections of the park that he
// must run and get away; a challenge but a fun one"). The way out is on the far side from the gate, so the player
// picks a way round and the catcher picks to cut him off:
//   south: Food Court (food and crowds, tables in the way), then Reptile House (a low wall he can hop and the
//          catcher must run round)
//   north: Service Yard (no food, little in the way: the quick way), then Keepers' Yards (shade-cloth pens to
//          lose him in)
// Tall iron walls run from the croc fence to the outer fence, with gates. Two of them shut the path too, so he has
// to leave it. Until he is out they are not there (Ken, 2026-10-30): the patrons walk a whole loop of the path and
// the rest is window dressing; breaking out brings them up (setLockdown, world.js lockdown).
// Pure numbers, no three.js (test/sections.test.mjs); sections-draw.js draws them.

import { BANK_Y, PATH, fencePoint, fenceOffset, pathAngle } from './rules.js';
import { outerDistance, boxEdges } from './chase-rules.js';

const PATH_GATE = [2.4, 5.6];                 // metres out from the croc fence
export const DIVIDERS = [
  // need: mangoes to open its gates (escape-rules.js). The two ways round: 4, 11 into the way out's section to the
  // south; 4, 11, 15 to the north.
  { deg: 20, need: 4, gates: [PATH_GATE, [11, 14]], ahead: ['FOOD COURT', 'THE BRIDGE'] },
  { deg: 85, need: 11, gates: [[10, 13]], ahead: ['REPTILE HOUSE', 'FOOD COURT'] },
  { deg: 200, need: 15, gates: [PATH_GATE, [11, 14]], ahead: ["KEEPERS' YARDS", 'THE WAY OUT'] },
  { deg: 275, need: 11, gates: [[10, 13]], ahead: ['SERVICE YARD', "KEEPERS' YARDS"] },
  { deg: 345, need: 4, gates: [PATH_GATE, [11, 14]], ahead: ['THE BRIDGE', 'SERVICE YARD'] },
];
export const WALL_H = 2.2, LOW_H = 0.75, BAR_H = 1.5;   // the iron walls; the low walls he hops; the bars across a shut gate, which he can jump
const rad = d => d * Math.PI / 180;

// How far out a line from the croc fence reaches before the outer fence, at this angle.
function reach(a) { let o = 6; while (outerDistance(fencePoint(a, o).x, fencePoint(a, o).z) < 0.995 && o < 40) o += 0.1; return o; }

// A piece of wall from offset o0 to o1 out from the croc fence.
function radial(a, o0, o1) { const p = fencePoint(a, o0), q = fencePoint(a, o1); return { ax: p.x, az: p.z, bx: q.x, bz: q.z }; }

// The iron walls: each divider, less its gates.
export function ironWalls() {
  const out = [];
  for (const d of DIVIDERS) {
    const a = rad(d.deg), end = reach(a);
    let from = 0.05;
    for (const [g0, g1] of d.gates) { out.push(radial(a, from, g0)); from = g1; }
    out.push(radial(a, from, end));
  }
  return out;
}
// Where the gates are, for their signs: { x, z, a, wide, ahead }.
export function gates() {
  const out = [];
  for (const d of DIVIDERS) for (const [g0, g1] of d.gates) { const p = fencePoint(rad(d.deg), (g0 + g1) / 2); out.push({ x: p.x, z: p.z, a: rad(d.deg), wide: g1 - g0, o0: g0, o1: g1, ahead: d.ahead, need: d.need }); }
  return out;
}

// Rectangles out in the grounds, placed by their angle and distance from the croc fence. rot follows the fence.
export function placed(deg, out) {
  const a = rad(deg), p = fencePoint(a, out), ahead = fencePoint(a + 0.01, out);
  return { x: p.x, z: p.z, rot: Math.atan2(ahead.x - p.x, ahead.z - p.z) };
}
// The Reptile House, and low walls: the snake pit, and a long wall to hop that ends at the path.
export const REPTILE = { deg: 108, out: 12.5, w: 9, d: 6, h: 3 };
export const PIT = { deg: 96, out: 8.5, w: 4.4, d: 3.2 };          // on the near side of the house
export function lowWalls() {
  const a = rad(128), out = [radial(a, PATH.outer + 0.8, reach(a))];
  const pit = placed(PIT.deg, PIT.out);
  return [...out, ...boxEdges(pit, PIT.w, PIT.d)];
}
// Stacks of boxes to climb (Ken, 2026-10-30): three in a row along the path's line, each higher than the last, a jump apart,
// with mangoes on the top two. Up there the catcher cannot reach him, and they block his view.
export const BOX = { size: 1.8, gap: 0.8, tops: [1.2, 2.2, 3.2] };
export const STACKS = [{ deg: 12, out: 20 }, { deg: 70, out: 16 }, { deg: 322, out: 18 }, { deg: 205, out: 19 }, { deg: 150, out: 20 }, { deg: 98, out: 20 }];
export function stackBoxes(stack) {
  const c = placed(stack.deg, stack.out), ux = Math.sin(c.rot), uz = Math.cos(c.rot), step = BOX.size + BOX.gap;
  return BOX.tops.map((top, i) => ({ x: c.x + ux * (i - 1) * step, z: c.z + uz * (i - 1) * step, rot: c.rot, top, w: BOX.size, d: BOX.size }));
}
export function allBoxes() { return STACKS.flatMap(stackBoxes); }
// The Service Yard's clutter, and the Food Court's tables.
export const CRATES = [
  { deg: 335, out: 9, w: 2, d: 2, h: 1.6 }, { deg: 328, out: 16, w: 3, d: 1.6, h: 2.1 },
  { deg: 300, out: 8.5, w: 2.4, d: 1.6, h: 1.6 }, { deg: 293, out: 15, w: 2, d: 2.4, h: 2.1 },
];
export const UTE = { deg: 315, out: 12, w: 2, d: 4.8, h: 1.8 };
export const TABLES = [{ deg: 28, out: 13 }, { deg: 42, out: 11 }, { deg: 44, out: 16 }, { deg: 58, out: 13 }, { deg: 79, out: 13 }, { deg: 76, out: 18 }];

const boxesTall = () => [...CRATES.map(c => ({ ...placed(c.deg, c.out), w: c.w, d: c.d })), { ...placed(UTE.deg, UTE.out), w: UTE.w, d: UTE.d }, { ...placed(REPTILE.deg, REPTILE.out), w: REPTILE.w, d: REPTILE.d }];

// What blocks the catcher's view (the low walls, tables and chain-link do not).
export function sectionScreens() { return [...ironWalls(), ...boxesTall().flatMap(b => boxEdges(b, b.w, b.d)), ...allBoxes().flatMap(b => boxEdges(b, b.w, b.d))]; }
// What the catcher cannot walk through and Wally can hop.
export function sectionHops() { return [...lowWalls(), ...allBoxes().flatMap(b => boxEdges(b, b.w, b.d))]; }

// Solid circles for the game (ground.js addSolid): walls in a row of posts, boxes round their edges.
function along(s, step, r, top, out) {
  const len = Math.hypot(s.bx - s.ax, s.bz - s.az), n = Math.max(1, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) out.push({ x: s.ax + (s.bx - s.ax) * i / n, z: s.az + (s.bz - s.az) * i / n, r, top });
}
// Bars across a shut gate, as solid things (for Wally: the catcher has the keys, chase.js). A running jump clears them
// (Ken, 2026-10-30); a gate opened with mangoes is the way that takes no jumping and no slowing down.
export function gateBarSolids(g) { const out = []; along(radial(g.a, g.o0, g.o1), 0.45, 0.12, BANK_Y + BAR_H, out); return out; }
export function wallSolids() {
  const out = [];
  for (const s of ironWalls()) along(s, 0.45, 0.12, Infinity, out);
  return out;
}
export function dressingSolids() {
  const out = [];
  for (const s of lowWalls()) along(s, 0.45, 0.12, BANK_Y + LOW_H, out);
  for (const b of boxesTall()) for (const s of boxEdges(b, b.w, b.d)) along(s, 0.5, 0.12, Infinity, out);
  for (const t of TABLES) { const p = placed(t.deg, t.out); out.push({ x: p.x, z: p.z, r: 0.8, top: Infinity }); }
  for (const b of allBoxes()) out.push({ x: b.x, z: b.z, r: 0.95, top: BANK_Y + b.top });
  return out;
}
export function sectionSolids() { return [...wallSolids(), ...dressingSolids()]; }

// Keeps trees and lamps out of the way.
export function clearOfSections(x, z) {
  if (ironWalls().some(s => nearSegment(x, z, s, 2.2))) return false;
  if (lowWalls().some(s => nearSegment(x, z, s, 1.8))) return false;
  if (boxesTall().some(b => Math.hypot(b.x - x, b.z - z) < Math.max(b.w, b.d) / 2 + 2.2)) return false;
  if (allBoxes().some(b => Math.hypot(b.x - x, b.z - z) < 3)) return false;
  return !TABLES.some(t => { const p = placed(t.deg, t.out); return Math.hypot(p.x - x, p.z - z) < 2.6; });
}
function nearSegment(x, z, s, r) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L)) : 0;
  return Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) < r;
}

// Are the walls up? And a wall shutting the path here? The strollers turn back at it.
let locked = false;
export function setLockdown(on) { locked = on; }
export function pathShutAt(a) {
  return locked && DIVIDERS.some(d => !d.gates.some(g => g === PATH_GATE) && Math.abs(Math.atan2(Math.sin(a - rad(d.deg)), Math.cos(a - rad(d.deg)))) < 0.04);
}
export { fenceOffset, pathAngle };
