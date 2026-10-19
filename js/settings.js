// settings.js
// The player's settings, kept in this browser (and never required: if storage is
// blocked, the defaults are used).
//   controls  'camera'  the industry standard: the keys or stick move Wally
//                       relative to the camera (up is away from it)
//             'classic' up runs the way he faces, left and right turn him
//   tips      true      show a short tip the first time something is met
//   music     true      the background music
//   sfx       true      the sound effects
// Changing a setting tells the page (SETTINGS_CHANGED), so open screens update.

const KEY = 'chomp-settings';
const DEFAULTS = { controls: 'camera', tips: true, music: true, sfx: true };
export const SETTINGS_CHANGED = 'chomp-settings-changed';

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

export const settings = load();

export function setSetting(name, value) {
  settings[name] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* not saved, still applies now */ }
  if (typeof dispatchEvent === 'function') dispatchEvent(new Event(SETTINGS_CHANGED));
}
