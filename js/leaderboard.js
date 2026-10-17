// leaderboard.js
// The leaderboard on each level's end screen (Ken, 2026-10-17): the player's
// name (asked once, then remembered on this device), their score sent in, and
// the top ten for the level with their place highlighted. If the leaderboard
// cannot be reached (no server, offline), the end screen simply says so.
//
//   showLeaderboard(container, 'park', score, stars)

import { cleanName } from './leaderboard-rules.js';

const API = 'api/scores';
const NAME_KEY = 'chomp-player-name';
function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
function keepName(n) { try { localStorage.setItem(NAME_KEY, n); } catch { /* not kept */ } }

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function drawBoard(box, board, me) {
  const list = el('ol', 'board-list');
  board.forEach(e => {
    const li = el('li', e.name.toLowerCase() === (me || '').toLowerCase() ? 'me' : '');
    li.append(el('span', 'bn', e.name), el('span', 'bs', '★'.repeat(e.stars || 0)), el('b', 'bp', e.score.toLocaleString()));
    list.append(li);
  });
  if (!board.length) list.append(el('li', 'empty', 'No scores yet. Be the first!'));
  box.append(list);
}

export async function showLeaderboard(container, level, score, stars = 0) {
  if (!container) return;
  container.innerHTML = '';
  container.append(el('h3', 'board-title', 'Top crocs'));
  const send = async name => {
    const status = el('p', 'board-note', 'Sending your score...'); container.append(status);
    try {
      const r = await fetch(`${API}?level=${level}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, score, stars }) });
      const data = await r.json();
      status.remove();
      if (!r.ok) {
        if (data.error === 'name') { keepName(''); ask('That name cannot be used. Try another:'); return; }
        container.append(el('p', 'board-note', 'Your score could not be added this time.'));
        return;
      }
      drawBoard(container, data.board, data.name);
      container.append(el('p', 'board-note', data.rank ? `You're number ${data.rank}!` : `Your best here is ${data.best.toLocaleString()}. Not in the top ten yet!`));
    } catch {
      status.textContent = "The leaderboard isn't reachable right now.";
    }
  };
  const ask = (prompt = 'Your name for the leaderboard:') => {
    const form = el('form', 'board-form');
    const label = el('label', null, prompt);
    const input = el('input'); input.maxLength = 16; input.placeholder = 'Player name'; input.value = savedName(); input.autocomplete = 'nickname';
    const go = el('button', 'go', 'Post my score'); go.type = 'submit';
    form.append(label, input, go);
    form.onsubmit = e => {
      e.preventDefault();
      const name = cleanName(input.value);
      if (!name) { label.textContent = 'Use 2 to 16 letters or numbers (and keep it friendly):'; return; }
      keepName(name); form.remove(); send(name);
    };
    container.append(form);
    input.focus();
  };
  const name = cleanName(savedName());
  if (name && score > 0) send(name);
  else if (score > 0) ask();
  else {
    try { const r = await fetch(`${API}?level=${level}`); drawBoard(container, (await r.json()).board || []); }
    catch { container.append(el('p', 'board-note', "The leaderboard isn't reachable right now.")); }
  }
}
