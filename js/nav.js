// nav.js
// Finding a way round things on foot: a grid over the ground, marked walkable or not, searched for the shortest way
// (A*). The croc catcher uses it (chase-rules.js): the sections' walls and gates are too much for plain steering.
// Pure, no three.js.

export class Nav {
  // bounds: { x0, x1, z0, z1 }; free(x, z): can someone stand there. cell: metres, and it must be finer than the
  // thinnest wall is wide, or the search slips through walls that the walker cannot (a wall here blocks 0.94 m).
  constructor(bounds, free, cell = 0.75) {
    this.b = bounds; this.cell = cell; this.freeAt = free;
    this.w = Math.ceil((bounds.x1 - bounds.x0) / cell) + 1; this.h = Math.ceil((bounds.z1 - bounds.z0) / cell) + 1;
    this.open = new Uint8Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) this.open[i + j * this.w] = free(bounds.x0 + i * cell, bounds.z0 + j * cell) ? 1 : 0;
  }
  index(x, z) { return { i: Math.round((x - this.b.x0) / this.cell), j: Math.round((z - this.b.z0) / this.cell) }; }
  isOpen(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && this.open[i + j * this.w] === 1; }
  // The nearest open cell to a spot, in growing squares; someone can stand just off the grid's points.
  nearest(x, z) {
    const { i, j } = this.index(x, z);
    for (let r = 0; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) === r && this.isOpen(i + di, j + dj)) return { i: i + di, j: j + dj };
    }
    return null;
  }
  // Is the straight line between two spots clear?
  clear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.4);
    for (let k = 1; k < n; k++) if (!this.freeAt(ax + (bx - ax) * k / n, az + (bz - az) * k / n)) return false;
    return true;
  }
  // The way from a to b as points, or null if there is none. Corners are not cut.
  path(ax, az, bx, bz) {
    const s = this.nearest(ax, az), g = this.nearest(bx, bz);
    if (!s || !g) return null;
    const W = this.w, n = W * this.h, cost = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    const heap = [], push = (id, f) => { heap.push([f, id]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const goal = g.i + g.j * W, h = (i, j) => Math.hypot(i - g.i, j - g.j);
    cost[s.i + s.j * W] = 0; push(s.i + s.j * W, h(s.i, s.j));
    while (heap.length) {
      const id = pop()[1];
      if (done[id]) continue;
      done[id] = 1;
      if (id === goal) break;
      const i = id % W, j = (id - i) / W;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if ((!di && !dj) || !this.isOpen(i + di, j + dj)) continue;
        if (di && dj && (!this.isOpen(i + di, j) || !this.isOpen(i, j + dj))) continue;
        const nid = i + di + (j + dj) * W, c = cost[id] + (di && dj ? Math.SQRT2 : 1);
        if (c < cost[nid]) { cost[nid] = c; from[nid] = id; push(nid, c + h(i + di, j + dj)); }
      }
    }
    if (from[goal] < 0 && goal !== s.i + s.j * W) return null;
    const pts = [];
    for (let id = goal; id >= 0; id = from[id]) { const i = id % W; pts.push({ x: this.b.x0 + i * this.cell, z: this.b.z0 + ((id - i) / W) * this.cell }); }
    return pts.reverse();
  }
  // How long a way is, in metres.
  static length(pts) { let d = 0; for (let k = 1; k < pts.length; k++) d += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z); return d; }
}

// Is anything solid near here? A quick look at only the nearby things, not all of them (the walls alone are
// thousands of posts). list: [{ x, z, r, top }]; only what cannot be stepped over counts.
export function solidsIndex(list, margin) {
  const S = 2, cells = new Map(), key = (i, j) => i * 100000 + j;
  for (const s of list) {
    if (s.top !== Infinity || s.keeper) continue;              // (keeper: a shut gate, and he has the keys)
    const r = s.r + margin;
    for (let i = Math.floor((s.x - r) / S); i <= Math.floor((s.x + r) / S); i++) for (let j = Math.floor((s.z - r) / S); j <= Math.floor((s.z + r) / S); j++) {
      const k = key(i, j); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(s);
    }
  }
  return (x, z) => { const c = cells.get(key(Math.floor(x / S), Math.floor(z / S))); return !!c && c.some(s => Math.hypot(x - s.x, z - s.z) < s.r + margin); };
}

// Where to head next on the way to (tx, tz). plan lives on c: worked out again only when the target has moved.
export function nextStep(nav, c, tx, tz) {
  if (nav.clear(c.x, c.z, tx, tz)) { c.plan = null; return { x: tx, z: tz }; }
  if (!c.plan || !c.planFor || Math.hypot(c.planFor.x - tx, c.planFor.z - tz) > 2.5 || !c.plan.length) {
    c.plan = nav.path(c.x, c.z, tx, tz); c.planFor = { x: tx, z: tz };
    if (!c.plan) return { x: tx, z: tz };
  }
  // Skip ahead to the furthest point in plain view, so he runs straight, not along the grid.
  const inView = () => { for (let t = Math.min(c.plan.length - 1, 14); t > 0; t--) if (nav.clear(c.x, c.z, c.plan[t].x, c.plan[t].z)) return t; return 0; };
  let k = inView();
  // Lost sight of the next point (something nudged him aside): find the way again from here, or he would push at it
  // for ever, wedged in whatever pocket he is in (seen in the game, between the boardwalk's rail and the croc fence).
  if (k === 0 && !nav.clear(c.x, c.z, c.plan[0].x, c.plan[0].z)) {
    const again = nav.path(c.x, c.z, tx, tz);
    if (again && again.length) { c.plan = again; k = inView(); }
  }
  c.plan = c.plan.slice(k);
  if (c.plan.length > 1 && Math.hypot(c.plan[0].x - c.x, c.plan[0].z - c.z) < 0.7) c.plan.shift();
  return c.plan[0] || { x: tx, z: tz };
}
