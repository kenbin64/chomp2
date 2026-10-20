// input.js
// Controls for both PC and phone, read the same way by the game:
//   forward, right   -1..1, relative to the camera
//   jump             true for one frame when pressed
//   fours            held: run on all fours
//   turn             camera turn from dragging this frame (radians); turnKeys -1..1 from Q / E
//   tilt, zoom       camera tilt from dragging, zoom from the wheel (metres)
//
// PC:    WASD or the arrows steer him (Ken, 2026-10-20): up / W runs the way he faces,
//        left and right turn him, down turns him round. Space jump, Shift all fours.
//        The mouse: click the game (or Wally) to take the cursor, and moving the mouse
//        steers him (side to side turns him, up and down tilts the view). A left click
//        hands the mouse to the camera; a right click (or another left click) gives it
//        back to Wally. Esc gives the cursor back; a click on the game takes it again.
//        The wheel zooms. Space jumps (and swims up), Shift dives under (and runs on
//        all fours on land). Q / E turn the camera, wheel zooms, C swings it behind
//        him, P pauses. (Camera-relative moving is a setting, settings.js.)
// Phone: left thumb anywhere on the left half is a joystick, drag on the right
//        half turns the camera, buttons for Jump and Fours.
// Game controller (the standard layout: Xbox, PlayStation, Switch Pro): left stick
//        or d-pad steers him the same way (up forward, sides turn, down turns round),
//        right stick turns the camera, A jumps (and swims up), B or a
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

    // The mouse. Click the game to take the cursor (pointer lock); then moving the
    // mouse steers Wally, and a left click switches it to turning the camera and back
    // (Ken, 2026-10-20). Right click or Esc gives the cursor back. Without the cursor
    // taken, dragging turns the camera.
    let drag = null;
    this.aim = 0; this.mouseMode = 'wally';
    // Only while a level is being played: not over a menu, card or the map.
    this.canLock = () => !document.querySelector('.overlay:not([hidden]), .map-modal:not([hidden])');
    const locked = () => document.pointerLockElement === canvas;
    // A small label saying what the mouse is doing: steering Wally, turning the camera,
    // or free (click the game to take it).
    const chip = document.createElement('div'); chip.className = 'mouse-chip'; document.body.append(chip);
    this.showChip = () => {
      chip.textContent = !locked() ? '' : this.mouseMode === 'wally' ? '🖱 Steering Wally · left click: camera · Esc: cursor' : '🖱 Camera · right click: back to Wally · Esc: cursor';
      chip.hidden = !locked();
    };
    this.showChip();
    canvas.addEventListener('mousedown', e => {
      if (locked()) {
        if (e.button === 0) { this.mouseMode = this.mouseMode === 'wally' ? 'camera' : 'wally'; document.body.classList.toggle('mouse-camera', this.mouseMode === 'camera'); this.showChip(); }
        return;
      }
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: 0 };
    });
    addEventListener('mouseup', e => {
      // A click (not a drag) on the game takes the cursor, while a level is being played.
      if (drag && drag.moved < 6 && !locked() && this.canLock && this.canLock()) canvas.requestPointerLock?.();
      drag = null;
    });
    // Right click: the mouse back to steering Wally (Ken, 2026-10-20).
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (locked()) { this.mouseMode = 'wally'; document.body.classList.remove('mouse-camera'); this.showChip(); } });
    document.addEventListener('pointerlockchange', () => {
      if (!locked()) this.unlockedAt = performance.now();
      else { this.mouseMode = 'wally'; document.body.classList.remove('mouse-camera'); }
      document.body.classList.toggle('mouse-steer', locked());
      this.showChip();
    });
    addEventListener('mousemove', e => {
      if (locked()) {
        if (this.mouseMode === 'wally') this.aim -= e.movementX * 0.0035;
        else this.turn -= e.movementX * 0.004;
        this.tilt += e.movementY * 0.0025; return;
      }
      if (!drag) return;
      drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      this.turn -= (e.clientX - drag.x) * 0.005; this.tilt += (e.clientY - drag.y) * 0.004;
      drag.x = e.clientX; drag.y = e.clientY;
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
    // Esc first gives back the cursor (the browser does that); only an Esc without it pauses.
    const justUnlocked = performance.now() - (this.unlockedAt || 0) < 300 || document.pointerLockElement;
    if (down && (k === 'p' || (k === 'escape' && !justUnlocked)) && !e.repeat && this.onPause) this.onPause();
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
      steer: settings.controls === 'classic' && !this.stick,
      aim: this.aim,                   // the mouse's turn of Wally this frame (radians), with the cursor taken
      jump: this.jumpQueued,
      fours: k.has('shift') || this.foursToggle || !!(pad && pad.fours),
      ctrl: k.has('control'),          // with Shift: come up from a dive (the reef and the sea)
      turn: this.turn, turnKeys, tilt: this.tilt, zoom: this.zoom, recenter: this.recenterQueued,
    };
    this.recenterQueued = false;
    this.jumpQueued = false; this.turn = 0; this.tilt = 0; this.zoom = 0; this.aim = 0;
    return out;
  }
}

// The camera with steering (the default): it swings round behind Wally as he turns,
// smoothly, so up is always the way he is going. Each level's camera calls this.
export function steering() { return settings.controls === 'classic'; }
export function easeBehind(yaw, facing, dt, rate = 3) {
  const want = facing + Math.PI, d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
  return yaw + d * Math.min(1, dt * rate);
}
