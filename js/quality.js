// quality.js
// One game for phones and PCs. A quality level is picked from what the device
// says about itself, can be forced with ?q=low|medium|high, and steps down on
// its own if the frame rate stays low (see watchFrameRate). On high, a
// normal-density screen is drawn at 1.5x and scaled down (supersampling), which
// sharpens every edge the way the gallery does.

import { settings, SETTINGS_CHANGED } from './settings.js';

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

// Keeps play smooth (Ken, 2026-10-20: if motion sputters, lower the detail). Calls
// onDrop(newLevel, fps) and steps down one level (never below low) when, over a
// few seconds of real time, either:
//   the frame rate averages under 45, or
//   it stutters: four or more frames that took longer than 1/20 of a second
//   (the hitches an average hides).
// tick.focus(true) makes it a stricter, quicker test (Ken: the opening's spiral is
// the test: if it turns smoothly all is well, if not the detail comes down at once).
// A note says when the detail changes, and settings.perf shows a readout.
export function watchFrameRate(start, onDrop) {
  let level = start.name, frames = 0, slow = 0, began = 0, last = 0, settle = 3, focused = false, shown = 0, fpsNow = 60;
  const readout = document.createElement('div'); readout.className = 'perf-readout'; document.body.append(readout);
  const showReadout = () => { readout.hidden = !settings.perf; };
  showReadout(); addEventListener(SETTINGS_CHANGED, showReadout);
  function tick() {
    const now = performance.now(), frame = last ? (now - last) / 1000 : 0; last = now;
    if (frame > 0.5) { began = now; frames = 0; slow = 0; return; }     // the tab was away: not a stutter
    if (settings.perf && now - shown > 500) { shown = now; readout.textContent = `${fpsNow.toFixed(0)} fps · ${level} detail`; }
    if (settle > 0) { settle -= frame; began = now; frames = 0; slow = 0; return; }   // loading, or just changed
    frames++; if (frame > 0.05) slow++;
    const elapsed = (now - began) / 1000, window = focused ? 1.5 : 3.5;
    if (elapsed < window) return;
    const fps = frames / elapsed; fpsNow = fps;
    const stutters = slow >= (focused ? 3 : 4), low = fps < (focused ? 50 : 45);
    began = now; frames = 0; slow = 0;
    const i = ORDER.indexOf(level);
    if ((low || stutters) && i > 0) {
      level = ORDER[i - 1]; settle = 1.5; onDrop({ ...LEVELS[level] }, fps);
      perfNote(`Detail lowered to ${level} for smoother play`);
    }
  }
  tick.focus = on => { if (on !== focused) { focused = on; began = performance.now(); frames = 0; slow = 0; } };
  tick.level = () => level;
  return tick;
}
function perfNote(text) {
  let n = document.querySelector('.perf-note');
  if (!n) { n = document.createElement('div'); n.className = 'perf-note'; document.body.append(n); }
  n.textContent = text; n.classList.remove('fade');
  clearTimeout(perfNote.t); perfNote.t = setTimeout(() => n.classList.add('fade'), 2600);
}
