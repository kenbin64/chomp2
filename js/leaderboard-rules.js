// leaderboard-rules.js
// The rules of the leaderboard, shared by the game and the server (Ken,
// 2026-10-17), and tested: which names are allowed, which scores are
// believable, and how a board is kept. Plain JavaScript, no three.js.

export const LEVELS = ['park', 'cane', 'esplanade', 'reef', 'kuranda'];
// The most a run can believably score on each level, with room to spare. A
// score above this is refused (a cheat or a bug, not a record).
export const MAX_SCORE = { park: 600, cane: 2500, esplanade: 1200, reef: 800, kuranda: 700 };
export const BOARD_SIZE = 10;

// A few words a family game should not show. Checked inside names too, with
// look-alike numbers read as letters. Kept short and plain on purpose.
const BLOCKED = ['fuck', 'shit', 'cunt', 'bitch', 'dick', 'cock', 'pussy', 'nigg', 'fag', 'slut', 'whore', 'rape', 'nazi', 'wank', 'twat', 'bastard', 'arse', 'asshole', 'piss'];

// A player's name as it will show, or null if it cannot be used.
// Letters, numbers, spaces, apostrophes and hyphens; 2 to 16 characters.
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFKC').replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16).trim();
  if (name.length < 2) return null;
  const plain = name.toLowerCase().replace(/[0]/g, 'o').replace(/[1!|]/g, 'i').replace(/[3]/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/[^a-z]/g, '');
  if (BLOCKED.some(w => plain.includes(w))) return null;
  return name;
}

export function validScore(level, score, stars = 0) {
  return LEVELS.includes(level) && Number.isInteger(score) && score >= 0 && score <= MAX_SCORE[level]
      && Number.isInteger(stars) && stars >= 0 && stars <= 3;
}

// Put a score on a level's board. Each player keeps only their best. Returns
// { board, rank } where rank is the player's place (1 = top) or null if they
// are not in the top BOARD_SIZE. Ties go to whoever got there first.
export function addScore(board, { name, score, stars = 0, when = Date.now() }) {
  const list = board.filter(e => e.name.toLowerCase() !== name.toLowerCase());
  const mine = board.find(e => e.name.toLowerCase() === name.toLowerCase());
  const best = mine && mine.score >= score ? mine : { name, score, stars, when };
  list.push(best);
  list.sort((a, b) => b.score - a.score || a.when - b.when);
  const top = list.slice(0, BOARD_SIZE);
  const i = top.findIndex(e => e.name.toLowerCase() === name.toLowerCase());
  return { board: top, rank: i < 0 ? null : i + 1, best: best.score };
}
