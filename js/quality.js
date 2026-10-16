// quality.js
// One game for phones and PCs. A quality level is picked from what the device
// says about itself, can be forced with ?q=low|medium|high, and steps down on
// its own if the frame rate stays low (see watchFrameRate). On high, a
// normal-density screen is drawn at 1.5x and scaled down (supersampling), which
// sharpens every edge the way the gallery does.

export const LEVELS = {
  low:    { name: 'low',    pixelRatio: 1,    shadows: false, shadowSize: 512,  antialias: false, waterSegs: [40, 28], palms: 18, tourists: 6,  jellies: 4, bats: 3 },
  medium: { name: 'medium', pixelRatio: 1.5,  shadows: true,  shadowSize: 1024, antialias: true,  waterSegs: [64, 44], palms: 30, tourists: 9,  jellies: 5, bats: 4 },
  high:   { name: 'high',   pixelRatio: 2,    supersample: true, shadows: true,  shadowSize: 4096, antialias: true,  waterSegs: [90, 60], palms: 46, tourists: 12, jellies: 6, bats: 4 },
};
const ORDER = ['low', 'medium', 'high'];

export function pixelRatioFor(q) {
  const dpr = window.devicePixelRatio || 1;
  return Math.min(q.pixelRatio, q.supersample ? Math.max(dpr, 1.5) : dpr);
}

export function isTouchDevice() {
  return (navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches;
}

export function pickQuality() {
  const forced = new URLSearchParams(location.search).get('q');
  if (forced && LEVELS[forced]) return { ...LEVELS[forced] };
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;          // GB, Chrome and Edge only
  if (isTouchDevice()) return { ...LEVELS[cores >= 8 && memory >= 6 ? 'medium' : 'low'] };
  return { ...LEVELS[cores >= 6 && memory >= 6 ? 'high' : 'medium'] };
}

// Calls onDrop(newLevel) when the average frame rate stays under 40 for four
// seconds. Steps down one level at a time and never below low.
export function watchFrameRate(start, onDrop) {
  let level = start.name, frames = 0, elapsed = 0, settle = 3;
  return function tick(dt) {
    if (settle > 0) { settle -= dt; return; }          // ignore the first seconds of loading
    frames++; elapsed += dt;
    if (elapsed < 4) return;
    const fps = frames / elapsed;
    frames = 0; elapsed = 0;
    const i = ORDER.indexOf(level);
    if (fps < 40 && i > 0) { level = ORDER[i - 1]; settle = 2; onDrop({ ...LEVELS[level] }, fps); }
  };
}
