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
        <option value="camera">Standard: move relative to the camera</option>
        <option value="classic">Classic: up runs, left and right turn</option>
      </select>
    </label>
    <label class="check"><input type="checkbox" id="set-tips"> Show tips the first time</label>
    <label class="check"><input type="checkbox" id="set-music"> Music</label>
    <label class="check"><input type="checkbox" id="set-sfx"> Sound effects</label>`;
  card.append(box);
  const controls = box.querySelector('#set-controls'), tips = box.querySelector('#set-tips');
  const music = box.querySelector('#set-music'), sfx = box.querySelector('#set-sfx');
  const draw = () => { controls.value = settings.controls; tips.checked = settings.tips; music.checked = settings.music; sfx.checked = settings.sfx; };
  draw(); addEventListener(SETTINGS_CHANGED, draw);   // the speaker button or M can change them too
  controls.onchange = () => setSetting('controls', controls.value);
  tips.onchange = () => setSetting('tips', tips.checked);
  music.onchange = () => setSetting('music', music.checked);
  sfx.onchange = () => setSetting('sfx', sfx.checked);
}
