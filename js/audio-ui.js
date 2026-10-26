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

// The camera button, beside the speaker (Ken, 2026-10-26): one tap switches the camera between Auto (it
// follows Wally calmly) and Manual (it turns only when the player turns it), as V does. Shows the current one.
export function toggleCamera() { setSetting('camera', settings.camera === 'manual' ? 'auto' : 'manual'); }
export function installCameraButton() {
  if (typeof document === 'undefined' || document.getElementById('cam-btn')) return;
  const b = document.createElement('button');
  b.id = 'cam-btn'; b.type = 'button'; b.className = 'sound-btn cam-btn';
  const draw = () => {
    const manual = settings.camera === 'manual';
    b.textContent = manual ? '✋' : '\u{1F3A5}';
    b.title = b.ariaLabel = manual ? 'Camera: manual (it turns only when you turn it). Tap for auto.' : 'Camera: auto (it follows Wally). Tap for manual.';
  };
  b.onclick = e => { e.stopPropagation(); toggleCamera(); };
  b.addEventListener('pointerdown', e => e.stopPropagation());
  b.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  addEventListener(SETTINGS_CHANGED, draw);
  draw();
  document.body.append(b);
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
