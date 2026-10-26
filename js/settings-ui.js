// settings-ui.js
// The settings on every pause screen (the card inside #paused): steering,
// first-time tips, music and sound effects. Added by code so each level's page does not repeat it.

import { settings, setSetting, SETTINGS_CHANGED } from './settings.js';

export function installSettingsUi() {
  const card = document.querySelector('#paused .card');
  if (!card || card.querySelector('.settings')) return;
  const box = document.createElement('div');
  box.className = 'settings';
  box.innerHTML = `
    <label>Steering
      <select id="set-controls">
        <option value="classic">Steer: up runs, left and right turn, down turns round</option>
        <option value="camera">Camera: move relative to the camera</option>
      </select>
    </label>
    <label>Camera
      <select id="set-camera">
        <option value="auto">Auto: follows Wally, turning gently when he heads off to the side</option>
        <option value="manual">Manual: turns only when you turn it (Q and E, right mouse button, or drag)</option>
      </select>
    </label>
    <label class="check"><input type="checkbox" id="set-tips"> Show tips the first time</label>
    <label class="check"><input type="checkbox" id="set-music"> Music</label>
    <label class="check"><input type="checkbox" id="set-sfx"> Sound effects</label>
    <label class="check"><input type="checkbox" id="set-perf"> Show frame rate and detail</label>`;
  card.append(box);
  const controls = box.querySelector('#set-controls'), tips = box.querySelector('#set-tips');
  const music = box.querySelector('#set-music'), sfx = box.querySelector('#set-sfx'), perf = box.querySelector('#set-perf');
  const camera = box.querySelector('#set-camera');
  camera.onchange = () => setSetting('camera', camera.value);
  const draw = () => { controls.value = settings.controls; camera.value = settings.camera; tips.checked = settings.tips; music.checked = settings.music; sfx.checked = settings.sfx; perf.checked = !!settings.perf; };
  draw(); addEventListener(SETTINGS_CHANGED, draw);   // the speaker button or M can change them too
  controls.onchange = () => setSetting('controls', controls.value);
  tips.onchange = () => setSetting('tips', tips.checked);
  music.onchange = () => setSetting('music', music.checked);
  sfx.onchange = () => setSetting('sfx', sfx.checked);
  perf.onchange = () => setSetting('perf', perf.checked);
}
