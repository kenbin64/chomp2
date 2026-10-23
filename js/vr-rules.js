// vr-rules.js
// The pure parts of VR play (vr.js does the drawing and the headset): how the VR controllers map onto
// the game's own controls, how the view turns without making anyone sick, and which screens have to be
// answered outside the headset. No three.js, no browser, so it is tested (test/vr.test.mjs).

// The VR controllers (the WebXR "xr-standard" layout, as on Meta Quest): on each hand, button 0 is the
// trigger, 1 the grip, 3 the thumbstick press, 4 and 5 the face buttons (X and Y on the left, A and B on
// the right); axes 2 and 3 are the thumbstick.
//
// They are turned into the layout of an ordinary game controller (the "standard" gamepad), which the
// game already reads (input.js readPad), so VR needs no controls of its own:
//   left stick            move and steer, as the controller's left stick
//   right stick, sideways turn the view
//   A or right trigger    jump
//   B or either grip      duck, or dive in water
//   right stick press     turn right round
//   X                     Paws
export function mapControllers(left, right) {
  if (!left && !right) return null;
  const btn = (pad, i) => !!(pad && pad.buttons[i] && pad.buttons[i].pressed);
  const axis = (pad, i) => (pad && pad.axes[i]) || 0;
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  buttons[0].pressed = btn(right, 4) || btn(right, 0);                  // jump
  buttons[1].pressed = btn(right, 5) || btn(right, 1) || btn(left, 1);  // duck or dive
  buttons[9].pressed = btn(left, 4);                                    // Paws
  return {
    mapping: 'standard', xr: true,
    axes: [axis(left, 2), axis(left, 3), axis(right, 2), 0],           // no tilt: the player looks up and down with their head
    buttons,
    turnAround: btn(right, 3),
  };
}

// The view in the headset follows the game's camera, but it turns in steps, never smoothly: a smooth
// turn the player did not make with their own head is what makes people feel sick in VR. When the
// camera has turned more than SNAP from the way the player is facing, the view jumps to it at once.
export const SNAP = Math.PI / 6;                                         // 30 degrees
export function snapYaw(current, wanted, step = SNAP) {
  const d = Math.atan2(Math.sin(wanted - current), Math.cos(wanted - current));
  return Math.abs(d) > step ? wanted : current;
}

// The cards and screens that need an answer (the map, the shop, winning, game over...) are flat pages,
// and a headset cannot show them, so VR ends while one is open and the player answers it on the screen.
// Paws is the exception: it shows on the panel in the headset, and X carries on.
export function needsScreen(open) {
  return open.some(el => el.id !== 'paused');
}

// What the floating panel in the headset shows, from what the page's own HUD says.
export function panelLines({ score = '', feed = null, lives = '', toast = '', paused = false } = {}) {
  const lines = [];
  if (paused) lines.push('PAWS: press X to carry on');
  if (score !== '') lines.push(`Score ${score}`);
  if (feed !== null) lines.push(`Feed-o-meter ${Math.round(Math.max(0, Math.min(100, feed)))}%`);
  if (lives) lines.push(`Lives ${lives}`);
  if (toast) lines.push(toast.length > 44 ? `${toast.slice(0, 43)}...` : toast);
  return lines;
}
