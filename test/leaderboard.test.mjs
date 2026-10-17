// Leaderboard rules (Ken, 2026-10-17).
import { cleanName, validScore, addScore, MAX_SCORE, BOARD_SIZE } from '../js/leaderboard-rules.js';

let passed = 0, failed = 0;
function check(name, ok, info = '') { if (ok) passed++; else { failed++; console.log('FAIL', name, info); } }

check('a plain name is kept', cleanName('Ken B') === 'Ken B');
check('spaces are tidied', cleanName('   Wally   the  Croc ') === 'Wally the Croc');
check('long names are cut to 16', cleanName('Abcdefghijklmnopqrstuvwxyz').length === 16);
check('too short is refused', cleanName('K') === null && cleanName('  ') === null);
check('symbols are dropped', cleanName('<script>Ken</script>') === 'scriptKenscript');
check('rude words are refused', cleanName('sh1tlord') === null && cleanName('BIG ARSE') === null);
check('an apostrophe or hyphen is fine', cleanName("O'Neil-Smith") === "O'Neil-Smith");
check('not a name, no name', cleanName(42) === null);

check('a real score is valid', validScore('park', 120, 2));
check('an impossible score is refused', !validScore('park', MAX_SCORE.park + 1));
check('a negative or broken score is refused', !validScore('reef', -5) && !validScore('reef', 1.5) && !validScore('reef', NaN));
check('an unknown level is refused', !validScore('moon', 10));
check('stars must be 0 to 3', !validScore('park', 10, 4));

let b = [];
for (let i = 0; i < 12; i++) b = addScore(b, { name: `P${i}`, score: i * 10, when: i }).board;
check('the board keeps only the top 10', b.length === BOARD_SIZE && b[0].score === 110 && b[9].score === 20);
let r = addScore(b, { name: 'Wally', score: 75, when: 99 });
check('a new score takes its place', r.rank === 5 && r.board.length === BOARD_SIZE);
r = addScore(r.board, { name: 'wally', score: 30, when: 100 });
check('a worse run never lowers a best (names match regardless of case)', r.rank === 5 && r.best === 75 && r.board.filter(e => e.name.toLowerCase() === 'wally').length === 1);
r = addScore(r.board, { name: 'Low', score: 1, when: 101 });
check('too low for the board: no place', r.rank === null);
r = addScore([{ name: 'A', score: 50, when: 1 }], { name: 'B', score: 50, when: 2 });
check('a tie goes to whoever got there first', r.board[0].name === 'A' && r.rank === 2);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
