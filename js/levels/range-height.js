// range-height.js
// The height of the land between Cairns and Kuranda (used by range-land.js to draw it, and
// by the rides' tested rules). Plain JavaScript, no three.js. x runs from the coast (x < 0)
// up the range to the plateau at Kuranda (x = L); the Barron Gorge runs down +z from the
// falls at its head (z = GORGE.head).

export const L = 1700;                                    // valley station (x = 0) to Kuranda (x = L)
export const TOP = 330;                                   // the plateau above the plain
export const GORGE = { x: 1390, w: 95, d: 150, head: -300 };   // the Barron Gorge crosses the line; the falls at its head (z = head). Wide enough for the land's grid to draw its walls cleanly.
export const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export const coastAt = z => -380 + Math.sin(z * 0.004) * 60 + Math.sin(z * 0.011) * 18;
// How deep the gorge is cut at a point (0 outside it): for its colour.
export function gorgeCut(x, z) {
  const along = smooth(GORGE.head - 6, GORGE.head + 420, z);
  return GORGE.d * Math.exp(-Math.pow((x - GORGE.x - Math.sin(z * 0.006) * 28) / GORGE.w, 2)) * along;
}
export function height(x, z) {
  if (x < coastAt(z)) return -6;                                   // the sea
  const up = smooth(120, 1250, x);                                 // the range, rising to the plateau
  let h = 2 + TOP * up;
  const ridges = Math.sin(z * 0.011 + x * 0.004) * 22 + Math.sin(z * 0.027 - x * 0.009) * 10 + Math.sin(x * 0.021 + z * 0.013) * 7;
  h += ridges * Math.min(1, up * 2.2) * (1 - smooth(1200, 1500, x) * 0.6);
  // The gorge: a cut running down the range (+z), starting at the top of the
  // falls and deepening down the cascade (as Ken's model drops), then on down.
  const along = smooth(GORGE.head - 6, GORGE.head + 420, z);
  const across = Math.exp(-Math.pow((x - GORGE.x - Math.sin(z * 0.006) * 28) / GORGE.w, 2));
  h -= GORGE.d * across * along;
  return h;
}
