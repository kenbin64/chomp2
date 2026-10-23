// Tests for vr-rules.js: the VR controllers, the stepped view turn, the screens that end VR, the panel.
// Run:  node test/vr.test.mjs

import { mapControllers, snapYaw, SNAP, needsScreen, panelLines } from '../js/vr-rules.js';

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; console.log('FAIL', name, detail); }
}

// A Quest-style controller: buttons pressed by index, thumbstick on axes 2 and 3.
const pad = (pressed = [], stick = [0, 0]) => ({ buttons: Array.from({ length: 7 }, (_, i) => ({ pressed: pressed.includes(i) })), axes: [0, 0, stick[0], stick[1]] });

// Happy paths
const still = mapControllers(pad(), pad());
check('looks like an ordinary game controller to the game', still.mapping === 'standard' && still.axes.length === 4 && still.buttons.length >= 16);
check('nothing pressed: nothing happens', still.axes.every(a => a === 0) && still.buttons.every(b => !b.pressed) && !still.turnAround);
const going = mapControllers(pad([], [0.4, -1]), pad([], [0.7, 0.9]));
check('left stick moves and steers', going.axes[0] === 0.4 && going.axes[1] === -1);
check('right stick sideways turns the view; up and down does nothing (the head looks)', going.axes[2] === 0.7 && going.axes[3] === 0);
check('A jumps', mapControllers(pad(), pad([4])).buttons[0].pressed);
check('the right trigger jumps too', mapControllers(pad(), pad([0])).buttons[0].pressed);
check('B ducks or dives', mapControllers(pad(), pad([5])).buttons[1].pressed);
check('either grip ducks or dives', mapControllers(pad([1]), null).buttons[1].pressed && mapControllers(null, pad([1])).buttons[1].pressed);
check('right stick press turns him round', mapControllers(pad(), pad([3])).turnAround);
check('X is Paws', mapControllers(pad([4]), pad()).buttons[9].pressed);

// Unhappy paths and edges
check('no controllers: no pad', mapControllers(null, null) === null);
check('only one controller still works', mapControllers(null, pad([4])).buttons[0].pressed && mapControllers(pad([], [0, -1]), null).axes[1] === -1);
check('the left trigger does not jump (it is free)', !mapControllers(pad([0]), pad()).buttons[0].pressed);
check('a controller with missing buttons does not throw', mapControllers({ buttons: [], axes: [] }, { buttons: [{ pressed: true }], axes: [] }).buttons[0].pressed === true);

// The view turns in steps
check('a small difference does not move the view', snapYaw(0, SNAP * 0.8) === 0);
check('past the step it jumps straight there', snapYaw(0, SNAP * 1.2) === SNAP * 1.2);
check('the other way too', snapYaw(1, 1 - SNAP * 1.5) === 1 - SNAP * 1.5);
check('across the half-turn line it takes the short way', snapYaw(Math.PI - 0.1, -Math.PI + 0.1) === Math.PI - 0.1);
check('a full turn round is no difference at all', snapYaw(0.3, 0.3 + Math.PI * 2) === 0.3);

// Screens that need the flat page
check('the map ends VR', needsScreen([{ id: '', className: 'map-modal' }]));
check('Paws alone does not', !needsScreen([{ id: 'paused' }]));
check('nothing open: stay in VR', !needsScreen([]));
check('Paws plus a card: the card wins', needsScreen([{ id: 'paused' }, { id: 'win' }]));

// The panel
const lines = panelLines({ score: '120', feed: 64.6, lives: '●●○', toast: 'A pelican scooped the pie!' });
check('the panel shows score, feed, lives and the latest message', lines.join('|') === 'Score 120|Feed-o-meter 65%|Lives ●●○|A pelican scooped the pie!', lines.join('|'));
check('Paws comes first and says how to carry on', panelLines({ paused: true, score: '5' })[0].startsWith('PAWS'));
check('a long message is cut short', panelLines({ toast: 'x'.repeat(80) })[0].length <= 46);
check('the feed is kept between 0 and 100', panelLines({ feed: 140 })[0] === 'Feed-o-meter 100%' && panelLines({ feed: -5 })[0] === 'Feed-o-meter 0%');
check('a page with no HUD gives an empty panel, not an error', panelLines().length === 0 && panelLines({}).length === 0);

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
