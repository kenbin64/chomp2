// push-rules.js
// The Great Push (Ken, 2026-10-21; MASTER.md section 6, the rescue): the crocs of Croc Park push the
// tour boat off the sandbar, Wally leading. A heave comes round on a steady beat; pressed on the beat,
// every croc shoves together and the boat moves back off the sand; badly timed, it barely moves; missed,
// it settles back a little. The rules, no drawing; tested in test/push.test.mjs.

export const BEAT = 1.6;                     // seconds between heaves
export const WINDOW = 0.32;                  // seconds either side of the beat that count at all
export const PERFECT = 0.1;                  // this close is a perfect heave
export const NEEDED = 9;                     // metres the boat must move back to float free
export const STEP = 1.6;                     // metres one perfect heave with all ten crocs moves it
export const SETTLE = 0.35;                  // metres it slides back on a missed beat
export const PARK = 10, WILD = 5;               // the crocs of Croc Park, and the wild crocs round the boat
export const CROCS = PARK + WILD;                // all of them push together (Ken)
export const CALL = 5;                           // the sceptre's touch: a wild croc this close joins
export const READY = 3.5;                    // metres: Wally at the stern this close, the push begins

// How far from the nearest beat a press at time t is (seconds, signed: negative early).
export function offBeat(t) { const k = Math.round(t / BEAT); return t - k * BEAT; }
// A press at time t: its quality, 1 perfect down to 0 outside the window.
export function quality(t) {
  const e = Math.abs(offBeat(t));
  if (e <= PERFECT) return 1;
  if (e >= WINDOW) return 0;
  return 1 - (e - PERFECT) / (WINDOW - PERFECT);
}
export const rating = q => q >= 1 ? 'Perfect heave!' : q >= 0.5 ? 'Good heave!' : q > 0 ? 'A bit off the beat' : 'Missed the beat';
// The boat's progress after a heave of quality q with n crocs pushing.
export const heave = (moved, q, n = CROCS) => Math.min(NEEDED, moved + STEP * q * (n / CROCS));
// After a beat passes with no press: it settles back (never past where it started).
export const settle = moved => Math.max(0, moved - SETTLE);
export const afloat = moved => moved >= NEEDED;
// The beat number of time t, so each beat is counted once.
export const beatOf = t => Math.round(t / BEAT);
