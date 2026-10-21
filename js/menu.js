// menu.js
// Keeping the screen clear for play (Ken, 2026-10-21):
//   - the Paws button: Wally's pause, with a paw (it presses P, so each page's own pause runs)
//   - on phones, every button at the top folds into one menu behind a ☰ button, so nothing sits over
//     the game; tapping a button in it closes the menu
//   - every card (the map, the shop, the book, the sceptre, the Scoreboard...) closes with Escape or a
//     tap outside it, so nothing can get stuck in the way
// Loaded by every page that plays (main.js and each level), once.

const TOP = '.map-button, .sceptre-button, .score-button, .sound-btn, .paws-button';
const phone = () => matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 1100px)').matches;
let panel = null, burger = null;

function paws() {
  if (document.querySelector('.paws-button')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'paws-button'; b.title = 'Paws (P)';
  b.innerHTML = '🐾 <span>Paws</span>';
  b.onclick = () => { closeMenu(); dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })); dispatchEvent(new KeyboardEvent('keyup', { key: 'p' })); };
  document.body.append(b);
}
// The pause card says Paws too, and the touch pause button shows a paw.
function pawsWords() {
  const h = document.querySelector('#paused h1'); if (h && h.textContent === 'Paused') { h.textContent = '🐾 Paws'; h.insertAdjacentHTML('afterend', '<p class="sub">Wally\'s having a breather.</p>'); }
  const t = document.getElementById('t-pause'); if (t && t.textContent === 'II') { t.textContent = '🐾'; t.setAttribute('aria-label', 'Paws'); }
}

function closeMenu() { if (panel) { panel.hidden = true; burger.setAttribute('aria-expanded', 'false'); } }
function fold() {
  if (!phone()) return;
  if (!panel) {
    burger = document.createElement('button'); burger.type = 'button'; burger.className = 'menu-burger'; burger.textContent = '☰'; burger.setAttribute('aria-label', 'Menu'); burger.setAttribute('aria-expanded', 'false');
    panel = document.createElement('div'); panel.className = 'menu-panel'; panel.hidden = true;
    burger.onclick = e => { e.stopPropagation(); panel.hidden = !panel.hidden; burger.setAttribute('aria-expanded', String(!panel.hidden)); };
    panel.addEventListener('click', e => { if (e.target.closest('button')) setTimeout(closeMenu, 0); });   // a button in it does its job, and the menu gets out of the way
    addEventListener('pointerdown', e => { if (panel && !panel.hidden && !panel.contains(e.target) && e.target !== burger) closeMenu(); }, true);
    document.body.append(burger, panel);
    document.body.classList.add('phone-menu');
  }
  for (const b of document.querySelectorAll(TOP)) if (b.parentElement !== panel) panel.append(b);
}

// Any card open: Escape closes it (its own Back or close button, so the page's own closing runs).
function closeTopCard() {
  const open = [...document.querySelectorAll('.map-modal')].filter(m => !m.hidden && m.offsetParent !== null).pop();
  if (!open) return false;
  const btn = [...open.querySelectorAll('button')].find(b => /Back to the game|Close|No, go back/.test(b.textContent)) || open.querySelector('.map-close');
  if (btn) btn.click(); else open.click();
  return true;
}

export function installMenu() {
  if (window.__chompMenu) return; window.__chompMenu = true;
  paws(); pawsWords();
  fold();
  new MutationObserver(() => { pawsWords(); fold(); }).observe(document.body, { childList: true });   // buttons added later fold in too
  addEventListener('resize', fold);
  addEventListener('keydown', e => { if (e.key === 'Escape' && closeTopCard()) { e.stopImmediatePropagation(); closeMenu(); } }, true);
}
