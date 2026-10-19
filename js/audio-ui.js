// audio-ui.js
// The speaker button, on screen on every page at all times (top right): one tap
// turns all sound off or back on, as M does. Music and sound effects can be set
// apart on any pause screen (settings-ui.js). The button shows the current state.

import { settings, setSetting, SETTINGS_CHANGED } from './settings.js';

const allOff = () => !settings.music && !settings.sfx;

// All sound off, or (from all off) both back on. Returns true when now silent.
export function toggleAllSound() {
  const off = !allOff();
  setSetting('music', !off); setSetting('sfx', !off);
  return off;
}

export function installSoundButton() {
  if (typeof document === 'undefined' || document.getElementById('sound-btn')) return;
  const b = document.createElement('button');
  b.id = 'sound-btn'; b.type = 'button'; b.className = 'sound-btn';
  const draw = () => {
    b.textContent = allOff() ? '\u{1F507}' : '\u{1F50A}';
    b.title = b.ariaLabel = allOff() ? 'Sound is off: tap to turn it on' : 'Sound is on: tap to turn it off';
  };
  b.onclick = e => { e.stopPropagation(); toggleAllSound(); };
  b.addEventListener('pointerdown', e => e.stopPropagation());
  b.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  addEventListener(SETTINGS_CHANGED, draw);
  draw();
  document.body.append(b);
}
