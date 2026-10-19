// settings-ui.js
// The settings on every pause screen (the card inside #paused): steering and
// first-time tips. Added by code so each level's page does not repeat it.

import { settings, setSetting } from './settings.js';

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
    <label class="check"><input type="checkbox" id="set-tips"> Show tips the first time</label>`;
  card.append(box);
  const controls = box.querySelector('#set-controls'), tips = box.querySelector('#set-tips');
  controls.value = settings.controls; tips.checked = settings.tips;
  controls.onchange = () => setSetting('controls', controls.value);
  tips.onchange = () => setSetting('tips', tips.checked);
}
