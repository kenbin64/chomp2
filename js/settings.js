// settings.js
// The player's settings, kept in this browser (and never required: if storage is
// blocked, the defaults are used).
//   controls  'classic' (the default, Ken 2026-10-20) up or W runs the way he
//                       faces, left and right turn him, down turns him round; the
//                       same on a controller's stick, and the mouse turns him
//             'camera'  the keys or stick move Wally relative to the camera
//   tips      true      show a short tip the first time something is met
//   music     true      the background music
//   sfx       true      the sound effects
//   perf      false     a small frame-rate and detail readout in the corner
// Changing a setting tells the page (SETTINGS_CHANGED), so open screens update.

const KEY = 'chomp-settings';
const DEFAULTS = { controls: 'classic', tips: true, music: true, sfx: true, perf: false };
export const SETTINGS_CHANGED = 'chomp-settings-changed';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    // Saved before steering became the default: it was 'camera' only because that was
    // the default then, so it moves to the new one (a choice made after this is kept).
    if (!saved.v2) { delete saved.controls; saved.v2 = true; }
    return { ...DEFAULTS, ...saved };
  } catch { return { ...DEFAULTS }; }
}

export const settings = load();

export function setSetting(name, value) {
  settings[name] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* not saved, still applies now */ }
  if (typeof dispatchEvent === 'function') dispatchEvent(new Event(SETTINGS_CHANGED));
}
