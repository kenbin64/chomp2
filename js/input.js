// input.js
// Controls for both PC and phone, read the same way by the game:
//   forward, right   -1..1, relative to the camera
//   jump             true for one frame when pressed
//   fours            held: run on all fours
//   turn             camera turn from dragging this frame (radians); turnKeys -1..1 from Q / E
//   tilt, zoom       camera tilt from dragging, zoom from the wheel (metres)
//
// PC:    WASD or arrows to move, Space jump, Shift all fours,
//        drag the mouse or Q / E to turn the camera, wheel to zoom, C to swing it behind Wally,
//        Esc or P to pause. Moving is relative to the camera (the standard), or
//        classic steering if chosen in the settings (settings.js).
// Phone: left thumb anywhere on the left half is a joystick, drag on the right
//        half turns the camera, buttons for Jump and Fours.
// Game controller (the standard layout: Xbox, PlayStation, Switch Pro): left stick
//        or d-pad moves, right stick turns the camera, A jumps (and swims up), B or a
//        trigger runs on all fours (and dives), Y swings the camera behind him, Start pauses.

import { settings } from './settings.js';
import { installSettingsUi } from './settings-ui.js';

export class Input {
  constructor(canvas, touchUi) {
    this.keys = new Set();
    this.forward = 0; this.right = 0;
    this.jumpQueued = false; this.foursHeld = false; this.foursToggle = false;
    this.turn = 0; this.tilt = 0; this.zoom = 0;
    this.onPause = null; this.onMute = null; this.recenterQueued = false;
    this.stick = null;            // { id, x0, y0, dx, dy }
    this.look = null;             // { id, x, y }

    addEventListener('keydown', e => this.key(e, true));
    addEventListener('keyup', e => this.key(e, false));
    addEventListener('blur', () => this.keys.clear());

    let drag = null;
    canvas.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('mouseup', () => { drag = null; });
    addEventListener('mousemove', e => {
      if (!drag) return;
      this.turn -= (e.clientX - drag.x) * 0.005; this.tilt += (e.clientY - drag.y) * 0.004;
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('wheel', e => { this.zoom += Math.sign(e.deltaY) * 1.2; e.preventDefault(); }, { passive: false });

    if (touchUi) this.bindTouch(canvas, touchUi);
    installSettingsUi();
  }

  key(e, down) {
    // Typing in a box (the leaderboard name) is typing, not playing: leave those keys alone.
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (down && k === ' ' && !this.keys.has(' ')) this.jumpQueued = true;
    if (down && (k === 'p' || k === 'escape') && !e.repeat && this.onPause) this.onPause();
    if (down && k === 'm' && this.onMute) this.onMute();
    if (down && k === 'c') this.recenterQueued = true;
    if (down) this.keys.add(k); else this.keys.delete(k);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  }

  bindTouch(canvas, ui) {
    const half = () => innerWidth / 2;
    canvas.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.clientX < half() && !this.stick) {
          this.stick = { id: t.identifier, x0: t.clientX, y0: t.clientY, dx: 0, dy: 0 };
          ui.stick.style.display = 'block';
          ui.stick.style.left = `${t.clientX - 60}px`; ui.stick.style.top = `${t.clientY - 60}px`;
        } else if (!this.look) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) {
          const dx = t.clientX - this.stick.x0, dy = t.clientY - this.stick.y0, d = Math.hypot(dx, dy), max = 55;
          const k = d > max ? max / d : 1;
          this.stick.dx = dx * k / max; this.stick.dy = dy * k / max;
          ui.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        } else if (this.look && t.identifier === this.look.id) {
          this.turn -= (t.clientX - this.look.x) * 0.008; this.tilt += (t.clientY - this.look.y) * 0.006;
          this.look.x = t.clientX; this.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) {
          this.stick = null; ui.stick.style.display = 'none'; ui.knob.style.transform = '';
        }
        if (this.look && t.identifier === this.look.id) this.look = null;
      }
    };
    canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
    const tap = (el, fn) => el.addEventListener('touchstart', e => { fn(); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    tap(ui.jump, () => { this.jumpQueued = true; });
    tap(ui.fours, () => { this.foursToggle = !this.foursToggle; ui.fours.classList.toggle('on', this.foursToggle); });
    tap(ui.pause, () => this.onPause && this.onPause());
    tap(ui.cam, () => { this.recenterQueued = true; });
  }

  // A game controller, if one is plugged in: this frame's stick, d-pad and
  // buttons. A, Y and Start count once per press, like the keys.
  readPad() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const p = pads.find(g => g.mapping === 'standard') || pads[0];
    if (!p) return null;
    const dead = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;   // a dead zone, so a resting stick is still
    const held = i => !!(p.buttons[i] && p.buttons[i].pressed);
    const now = { a: held(0), y: held(3), start: held(9) }, was = this.padWas || {};
    if (now.a && !was.a) this.jumpQueued = true;
    if (now.y && !was.y) this.recenterQueued = true;
    if (now.start && !was.start && this.onPause) this.onPause();
    this.padWas = now;
    let x = dead(p.axes[0] || 0), y = dead(p.axes[1] || 0);
    if (held(14)) x = -1; if (held(15)) x = 1; if (held(12)) y = -1; if (held(13)) y = 1;
    return { forward: -y, right: x, fours: held(1) || held(6) || held(7),
             turn: -dead(p.axes[2] || 0) * 0.05, tilt: dead(p.axes[3] || 0) * 0.035 };
  }

  // Read and clear this frame's input.
  read() {
    const k = this.keys;
    let f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    let r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    // The keys are on or off; eased over about a tenth of a second they act more like a
    // stick: rolling from W to D passes through every angle between (Ken, 2026-10-20).
    // Letting go stops at once, so he never drifts.
    const now = performance.now(), dt = Math.min(0.1, ((now - (this.lastRead || now)) / 1000)); this.lastRead = now;
    const ease = (v, to) => to === 0 ? 0 : v + (to - v) * Math.min(1, dt * 12);
    this.kf = ease(this.kf || 0, f); this.kr = ease(this.kr || 0, r);
    if (f && r || this.kf && this.kr) { f = this.kf; r = this.kr; }
    const pad = this.readPad(), padMoving = !!(pad && (pad.forward || pad.right));
    if (padMoving) { f = pad.forward; r = pad.right; }
    if (this.stick) { f = -this.stick.dy; r = this.stick.dx; }
    if (pad) { this.turn += pad.turn; this.tilt += pad.tilt; }
    const turnKeys = (k.has('q') ? 1 : 0) - (k.has('e') ? 1 : 0);
    const out = {
      forward: f, right: r,
      // Classic steering (a setting) is for the keyboard only: up runs the way he
      // faces, down turns him round, left and right turn him. Otherwise, and
      // always for the phone stick and a controller, moving is relative to the camera.
      steer: settings.controls === 'classic' && !this.stick && !padMoving,
      jump: this.jumpQueued,
      fours: k.has('shift') || this.foursToggle || !!(pad && pad.fours),
      ctrl: k.has('control'),          // with Shift: come up from a dive (the reef and the sea)
      turn: this.turn, turnKeys, tilt: this.tilt, zoom: this.zoom, recenter: this.recenterQueued,
    };
    this.recenterQueued = false;
    this.jumpQueued = false; this.turn = 0; this.tilt = 0; this.zoom = 0;
    return out;
  }
}
