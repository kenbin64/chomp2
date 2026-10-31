// carried.js
// What Wally has taken out of a chest (Ken, 2026-10-30): its icon at the upper left, beside the score, until he uses it.
// add(id) shows it, use(id) sends it off when it has done its job, clear() for a new run. Works on any level's page.

const ICONS = {
  key: { label: 'Key', svg: '<circle cx="15" cy="15" r="9" fill="none" stroke="#ffd166" stroke-width="5"/><path d="M22 22 L38 38 M31 31 L36 26 M36 36 L41 31" stroke="#ffd166" stroke-width="5" stroke-linecap="round"/>' },
  'pearl-key': { label: 'Pearl key', svg: '<circle cx="15" cy="15" r="9" fill="none" stroke="#fff1f4" stroke-width="5"/><circle cx="15" cy="15" r="3" fill="#ffc6d6"/><path d="M22 22 L38 38 M31 31 L36 26 M36 36 L41 31" stroke="#fff1f4" stroke-width="5" stroke-linecap="round"/>' },
  mango: { label: 'Mango', svg: '<path d="M24 8 C36 9 42 20 38 31 C34 41 18 44 10 35 C3 27 10 7 24 8 Z" fill="#ffa52e"/><path d="M24 8 C36 9 42 20 38 31 C37 33 36 34 34 36 C37 24 33 14 24 8 Z" fill="#e8483a"/><path d="M24 9 C25 5 29 3 33 4 C32 8 28 10 24 9 Z" fill="#4f9a3c"/>' },
  // One of the Croc King's crown jewels (Ken, 2026-10-30): gold, with a little crown.
  'golden-mango': { label: "King's Golden Mango", svg: '<path d="M24 13 C35 14 41 23 37 33 C33 42 18 45 11 37 C4 29 11 12 24 13 Z" fill="#ffd23f" stroke="#b8860b" stroke-width="2"/><path d="M15 25 C17 20 21 18 25 18" fill="none" stroke="#fff6c2" stroke-width="3" stroke-linecap="round"/><path d="M15 12 L14 3 L20 7 L24 2 L28 7 L34 3 L33 12 Z" fill="#ffb400" stroke="#8a5a00" stroke-width="1.5"/>' },
  pass: { label: 'Pass', svg: '<rect x="5" y="12" width="38" height="24" rx="4" fill="#e8f6ff" stroke="#2a8fb0" stroke-width="3"/><path d="M5 20 H43" stroke="#2a8fb0" stroke-width="3"/><circle cx="14" cy="28" r="3" fill="#c23a1c"/><path d="M21 28 H37" stroke="#2a8fb0" stroke-width="3" stroke-linecap="round"/>' },
  talisman: { label: 'Talisman', svg: '<path d="M24 5 L29 18 L43 19 L32 28 L36 42 L24 34 L12 42 L16 28 L5 19 L19 18 Z" fill="#ffd166" stroke="#c9862a" stroke-width="2"/>' },
};

let box = null;
function holder() {
  if (box) return box;
  box = document.createElement('div'); box.className = 'carried'; box.setAttribute('aria-label', 'What Wally is carrying');
  document.body.append(box);
  // Just right of the score, however wide the score has grown.
  const place = () => { const s = document.querySelector('.panel.score, .score'); if (s) { const r = s.getBoundingClientRect(); if (r.width) { box.style.left = `${Math.round(r.right + 8)}px`; box.style.top = `${Math.round(r.top)}px`; } } };
  place(); setInterval(place, 500);
  return box;
}

export const carried = {
  // kind: which icon; id: to tell one from another (the kind, if not given); label: words under it.
  add(kind, { id = kind, label } = {}) {
    const b = holder();
    if (b.querySelector(`[data-id="${id}"]`)) return;
    const icon = ICONS[kind] || ICONS.talisman, el = document.createElement('div');
    el.className = 'carried-item'; el.dataset.id = id;
    el.innerHTML = `<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">${icon.svg}</svg><span></span>`;
    el.lastChild.textContent = label || icon.label;
    b.append(el);
  },
  use(id) {
    const el = box && box.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    el.classList.add('used'); setTimeout(() => el.remove(), 450);
  },
  has(id) { return !!(box && box.querySelector(`[data-id="${id}"]:not(.used)`)); },
  clear() { if (box) box.innerHTML = ''; },
};
