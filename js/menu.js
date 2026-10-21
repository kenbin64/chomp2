// menu.js
// Keeping the screen clear for play (Ken, 2026-10-21):
//   - the Paws button: Wally's pause, with a paw (it presses P, so each page's own pause runs)
//   - on phones, every button at the top folds into one menu behind a ☰ button, so nothing sits over
//     the game; tapping a button in it closes the menu
//   - every card (the map, the shop, the book, the sceptre, the Scoreboard...) closes with Escape or a
//     tap outside it, so nothing can get stuck in the way
// Loaded by every page that plays (main.js and each level), once.

const TOP = '.map-button, .sceptre-button, .score-button, .sound-btn, .paws-button, .install-button:not(.opener-buttons *), .fullscreen-button:not(.opener-buttons *)';
// Folded when the screen is too narrow for the two rows of buttons beside the game (Ken, 2026-10-21:
// a small window has to fold too), and on every phone and tablet whatever its size (touch first).
const phone = () => matchMedia('(max-width: 1000px), (pointer: coarse)').matches;
// Wally's hand for the Paws button (Ken: a crocodile hand, not a paw print): a green hand, four
// fingers, pale claws.
export const CROC_HAND = '<svg class="croc-hand" viewBox="0 0 48 48" aria-hidden="true">'
  + '<g stroke="#2f5a1a" stroke-width="9" stroke-linecap="round" fill="none"><path d="M24 30 L9 11"/><path d="M24 29 L18 6"/><path d="M24 29 L30 6"/><path d="M24 30 L39 11"/><path d="M26 34 L43 27"/></g><ellipse cx="25" cy="34" rx="12" ry="10" fill="#6fae3c" stroke="#2f5a1a" stroke-width="2.2"/>'
  + '<g stroke="#6fae3c" stroke-width="5" stroke-linecap="round" fill="none"><path d="M24 30 L9 11"/><path d="M24 29 L18 6"/><path d="M24 29 L30 6"/><path d="M24 30 L39 11"/><path d="M26 34 L43 27"/></g><ellipse cx="25" cy="34" rx="10.6" ry="8.6" fill="#6fae3c"/>'
  + '<g fill="#f4ead2" stroke="#2f5a1a" stroke-width="1"><path d="M10.7 9.6 L5.6 6.7 L7.3 12.4 Z"/><path d="M20.1 5.4 L16.6 0.7 L15.9 6.6 Z"/><path d="M32.1 6.6 L31.4 0.7 L27.9 5.4 Z"/><path d="M40.7 12.4 L42.4 6.7 L37.3 9.6 Z"/><path d="M43.8 29.0 L48.1 24.9 L42.2 25.0 Z"/></g>'
  + '<g fill="#4f8a2a"><circle cx="21" cy="34" r="1.6"/><circle cx="27" cy="37" r="1.6"/><circle cx="28" cy="31" r="1.3"/></g></svg>';
let panel = null, burger = null;

function paws() {
  if (document.querySelector('.paws-button')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'paws-button'; b.title = 'Paws (P)';
  b.innerHTML = `${CROC_HAND} <span>Paws</span>`;
  b.onclick = () => { closeMenu(); dispatchEvent(new KeyboardEvent('keydown', { key: 'p' })); dispatchEvent(new KeyboardEvent('keyup', { key: 'p' })); };
  document.body.append(b);
}
// The pause card says Paws too, and the touch pause button shows a paw.
function pawsWords() {
  const h = document.querySelector('#paused h1'); if (h && h.textContent === 'Paused') { h.innerHTML = `${CROC_HAND} Paws`; h.insertAdjacentHTML('afterend', '<p class="sub">Wally\'s having a breather.</p>'); }
  const t = document.getElementById('t-pause'); if (t && t.textContent === 'II') { t.innerHTML = CROC_HAND; t.setAttribute('aria-label', 'Paws'); }
}

function closeMenu() { if (panel) { panel.hidden = true; burger.setAttribute('aria-expanded', 'false'); } }
// Fold the top buttons into the menu on a narrow screen; unfold them when it widens again.
function fold() {
  if (!phone()) {
    if (panel) { for (const b of [...panel.children]) document.body.append(b); closeMenu(); burger.hidden = true; document.body.classList.remove('phone-menu'); }
    return;
  }
  if (!panel) {
    burger = document.createElement('button'); burger.type = 'button'; burger.className = 'menu-burger'; burger.textContent = '☰'; burger.setAttribute('aria-label', 'Menu'); burger.setAttribute('aria-expanded', 'false');
    panel = document.createElement('div'); panel.className = 'menu-panel'; panel.hidden = true;
    burger.onclick = e => { e.stopPropagation(); panel.hidden = !panel.hidden; burger.setAttribute('aria-expanded', String(!panel.hidden)); };
    panel.addEventListener('click', e => { if (e.target.closest('button')) setTimeout(closeMenu, 0); });   // a button in it does its job, and the menu gets out of the way
    addEventListener('pointerdown', e => { if (panel && !panel.hidden && !panel.contains(e.target) && e.target !== burger) closeMenu(); }, true);
    document.body.append(burger, panel);
  }
  burger.hidden = false; document.body.classList.add('phone-menu');
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

// Notes that can always be closed, and stay closed (Ken: nothing in the way of play).
const remember = (key, v) => { try { if (v === undefined) return localStorage.getItem(key) === '1'; localStorage.setItem(key, '1'); } catch { return false; } };
function closable(el, key) {
  if (!el || el.querySelector('.note-x')) return;
  if (remember(key)) { el.remove(); return; }
  const x = document.createElement('button'); x.type = 'button'; x.className = 'note-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close');
  x.onclick = e => { e.stopPropagation(); remember(key, true); el.remove(); };
  el.append(x);
}
// Best held sideways (Ken): on a phone or tablet held upright, a hint that closes, and goes by itself.
function landscapeHint() {
  if (remember('chomp-landscape-hint') || !matchMedia('(pointer: coarse) and (orientation: portrait)').matches) return;
  const n = document.createElement('div'); n.className = 'landscape-hint'; n.setAttribute('role', 'status');
  n.innerHTML = '<span class="turn">⟲</span> Turn your phone sideways: Wally is best in landscape.';
  document.body.append(n); closable(n, 'chomp-landscape-hint');
  setTimeout(() => n.remove(), 8000);
  matchMedia('(orientation: landscape)').addEventListener('change', e => { if (e.matches) n.remove(); });
}

// The objective panel (Ken, 2026-10-21: in the way): an X puts it away, leaving a small target icon
// that brings it back. On a touch screen it also tucks itself away after a few seconds; it comes back by
// itself when the objective's heading changes.
function questPanel() {
  const q = document.querySelector('.panel.quest'); if (!q || q.dataset.closable) return;
  q.dataset.closable = '1'; q.style.pointerEvents = 'auto';
  const x = document.createElement('button'); x.type = 'button'; x.className = 'quest-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Hide the objective');
  const show = document.createElement('button'); show.type = 'button'; show.className = 'quest-show'; show.textContent = '🎯'; show.title = 'Show the objective'; show.setAttribute('aria-label', 'Show the objective'); show.hidden = true;
  let timer = 0;
  const hide = () => { q.classList.add('tucked'); show.hidden = false; clearTimeout(timer); };
  const open = () => { q.classList.remove('tucked'); show.hidden = true; clearTimeout(timer); if (matchMedia('(max-width: 1000px), (pointer: coarse)').matches) timer = setTimeout(hide, 5000); };   // small screens: out of the way after 5 seconds
  x.onclick = e => { e.stopPropagation(); hide(); };
  show.onclick = e => { e.stopPropagation(); open(); };
  q.append(x); document.body.append(show);
  open();
  new MutationObserver(() => { if (q.classList.contains('tucked')) open(); })
    .observe(q.querySelector('h2') || q, { childList: true, subtree: true, characterData: true });   // a new objective (its heading), not the distance ticking down
}

// Native mode (Ken, 2026-10-21): install the game as an app, with its own icon for next time, and play
// full screen. Chrome and Edge (Android, Windows, Mac) offer the install themselves; iPhones and iPads
// do it from the Share menu, so there the button shows how. Hidden when already running as the app.
let installEvent = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; appButtons(); });
// Running as the installed app? It opens at index.html?app (manifest start_url), which is certain; the
// display mode is the browser's own word for it.
export const isApp = () => { try { if (new URLSearchParams(location.search).has('app')) sessionStorage.setItem('chomp-app', '1'); if (sessionStorage.getItem('chomp-app') === '1') return true; } catch { /* fine */ }
  return matchMedia('(display-mode: fullscreen), (display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay)').matches || navigator.standalone === true; };
// Installed on this device (remembered when it happens), so a browser tab offers Play, not Install.
export const isInstalled = () => { try { return localStorage.getItem('chomp-installed') === '1'; } catch { return false; } };
addEventListener('appinstalled', () => { try { localStorage.setItem('chomp-installed', '1'); } catch { /* fine */ } dispatchEvent(new Event('chomp-installed')); });
const isApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function howToInstall() {
  let box = document.querySelector('.install-card');
  if (!box) {
    box = document.createElement('div'); box.className = 'map-modal install-card'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Install the game');
    box.innerHTML = '<div class="card"><h1>Play it like an app</h1><ol><li>Tap the <b>Share</b> button (the square with an arrow) at the bottom or top of Safari.</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol><p>Chomp 3D then opens from its own icon, full screen, like any app.</p><button type="button" class="go">Back to the game</button></div>';
    box.querySelector('button').onclick = () => { box.hidden = true; };
    box.addEventListener('click', e => { if (e.target === box) box.hidden = true; });
    document.body.append(box);
  }
  box.hidden = false;
}
// Install the game: the browser's own prompt where there is one, the Share steps on an iPhone or iPad.
// Returns 'prompted', 'apple' or 'unavailable' (a browser that cannot install apps, such as Firefox).
export async function installApp() {
  if (installEvent) { installEvent.prompt(); const c = await installEvent.userChoice.catch(() => null); installEvent = null; return c && c.outcome === 'accepted' ? 'installed' : 'prompted'; }
  if (isApple()) { howToInstall(); return 'apple'; }
  return 'unavailable';
}

function appButtons() {
  const where = document.querySelector('.opener-buttons');
  if (!where && !phone()) return;                                   // in a level on a computer: not needed, kept out of the way
  const canFull = document.fullscreenEnabled && !isApp() && phone();   // a computer has F11
  if (!isApp() && (installEvent || isApple()) && !where && !document.querySelector('.install-button')) {   // (the landing page has its own Install)
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost install-button'; b.textContent = '📲 Install the game';
    b.onclick = async () => { if (installEvent) { installEvent.prompt(); const r = await installEvent.userChoice.catch(() => null); if (r && r.outcome === 'accepted') b.remove(); installEvent = null; } else howToInstall(); };
    (where || document.body).append(b); fold();
  }
  if (canFull && !document.querySelector('.fullscreen-button')) {
    const f = document.createElement('button'); f.type = 'button'; f.className = 'ghost fullscreen-button'; f.textContent = '⛶ Full screen';
    f.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' })).catch(() => {});
    document.addEventListener('fullscreenchange', () => { f.textContent = document.fullscreenElement ? '⛶ Leave full screen' : '⛶ Full screen'; });
    (where || document.body).append(f); fold();
  }
}

export function installMenu() {
  if (window.__chompMenu) return; window.__chompMenu = true;
  paws(); pawsWords();
  closable(document.querySelector('.free-banner'), 'chomp-free-banner');
  landscapeHint();
  questPanel();
  appButtons();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});   // makes the game installable (sw.js)
  fold();
  new MutationObserver(() => { pawsWords(); fold(); }).observe(document.body, { childList: true });   // buttons added later fold in too
  addEventListener('resize', fold);
  matchMedia('(max-width: 1000px)').addEventListener('change', fold);
  addEventListener('keydown', e => { if (e.key === 'Escape' && closeTopCard()) { e.stopImmediatePropagation(); closeMenu(); } }, true);
}
