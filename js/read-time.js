// read-time.js
// How long words stay on screen: long enough to read them, whoever is reading (Ken, 2026-10-31: "it changes before I
// can read it"). About two and a half words a second, plus a moment to look up and take it in. Pure, for any level.

const WORDS_A_SECOND = 2.5, LOOK_UP = 1.2;
export function readSeconds(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return words / WORDS_A_SECOND + LOOK_UP;
}
