// device.js
// Which controls the player is using (Ken, 2026-10-21: the game must know what controller is
// being used or is available), so every on-screen prompt shows the right buttons.
//
//   device()            'keys' | 'mouse' | 'pad' | 'touch': the last one used
//   padConnected()      true while a game controller is plugged in
//   onDevice(fn)        fn(device) whenever it changes
//   say(map)            the entry of map for the current device: say({ keys: 'Space', pad: 'A', ... })
//
// The last thing touched wins: a key press, a mouse click, a touch, or a controller button or stick.
// A controller plugged in is announced; the start screens' control lists show the matching set
// (elements with data-device="keys|mouse|pad|touch" are shown only for that device).

const listeners = new Set();
let current = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ? 'touch' : 'keys';
let connected = false;

function set(d) {
  if (d === current) return;
  current = d;
  for (const fn of listeners) fn(d);
  showLists();
}
export const device = () => current;
export const padConnected = () => connected;
export const onDevice = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const say = map => map[current] ?? map.keys;

// The words for each action, per device: one place, used by every prompt.
export const BUTTONS = {
  act:   { keys: 'Space', mouse: 'Click', pad: 'A', touch: 'Tap' },
  jump:  { keys: 'Space', mouse: 'Space', pad: 'A', touch: 'Jump' },
  forward: { keys: 'W / ↑', mouse: 'Hold left button', pad: 'Left stick up', touch: 'Stick up' },
};

// Show the matching control lists (data-device) and hide the others.
function showLists() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-device]').forEach(el => { el.hidden = !el.dataset.device.split(' ').includes(current); });
}

function notice(text) {
  if (typeof document === 'undefined') return;
  const el = document.createElement('div'); el.className = 'device-notice'; el.textContent = text;
  document.body.append(el); setTimeout(() => el.remove(), 2600);
}

if (typeof addEventListener === 'function') {
  addEventListener('keydown', () => set('keys'), true);
  addEventListener('pointerdown', e => set(e.pointerType === 'touch' ? 'touch' : 'mouse'), true);
  addEventListener('gamepadconnected', e => { connected = true; set('pad'); notice(`Controller connected: ${e.gamepad.id.replace(/\(.*\)/, '').trim() || 'game controller'}`); });
  addEventListener('gamepaddisconnected', () => { connected = [...(navigator.getGamepads?.() || [])].some(Boolean); if (!connected && current === 'pad') set('keys'); notice('Controller disconnected'); });
  // A controller only reports itself once a button is pressed; watch for use.
  const poll = () => {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    connected = pads.length > 0;
    if (pads.some(p => p.buttons.some(b => b.pressed) || p.axes.some(a => Math.abs(a) > 0.5))) set('pad');
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
  addEventListener('DOMContentLoaded', showLists);
  if (typeof document !== 'undefined' && document.readyState !== 'loading') setTimeout(showLists);
}
