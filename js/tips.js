// tips.js
// First-time tips: a short card the first time something is met (visitors
// throwing food, a thief, Kenny's jar, the water). Each tip shows once, ever, in
// this browser; it does not stop the game and fades by itself. Players can turn
// tips off on the card itself or on any pause screen (settings.js).
//
//   if (!showTip('dive', 'In the water, Shift dives and Space comes up.')) toast(...)
// showTip returns false when the tip was not shown (seen before, or tips are
// off), so a level can still give its own quick message for things that matter.

import { settings, setSetting } from './settings.js';

const SEEN = 'chomp-tips-seen';
let seen = (() => { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch { return new Set(); } })();
let card = null, timer = 0;
const waiting = [];

function remember(id) {
  seen.add(id);
  try { localStorage.setItem(SEEN, JSON.stringify([...seen])); } catch { /* shown again next visit, no harm */ }
}

function hide() {
  clearTimeout(timer);
  if (card) { card.remove(); card = null; }
  const next = waiting.shift();
  if (next) setTimeout(() => open(next.id, next.text), 400);
}

function open(id, text) {
  card = document.createElement('div');
  card.className = 'tip-card'; card.setAttribute('role', 'status');
  card.innerHTML = '<p></p><div class="tip-buttons"><button type="button" class="tip-ok">Got it</button><button type="button" class="tip-off">Turn tips off</button></div>';
  card.querySelector('p').textContent = text;
  card.querySelector('.tip-ok').onclick = hide;
  card.querySelector('.tip-off').onclick = () => { setSetting('tips', false); waiting.length = 0; hide(); };
  for (const b of card.querySelectorAll('button')) b.addEventListener('pointerdown', e => e.stopPropagation());
  document.body.append(card);
  timer = setTimeout(hide, 8000);
}

export function showTip(id, text) {
  if (!settings.tips || seen.has(id)) return false;
  remember(id);
  if (card) waiting.push({ id, text }); else open(id, text);
  return true;
}

// Forget which tips were seen (for "show tips again").
export function resetTips() { seen = new Set(); try { localStorage.removeItem(SEEN); } catch { /* fine */ } }
