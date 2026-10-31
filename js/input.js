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
//        The mouse is only for clicking menus and buttons (Ken, 2026-10-31): the game never takes the cursor.
//        The wheel zooms. Space jumps (and swims up), Shift dives under (and runs on
//        all fours on land). Q / E turn the camera, wheel zooms, C swings it behind
//        him, P pauses. (Camera-relative moving is a setting, settings.js.)
// Phone: a finger down anywhere is a thumb-stick there (Ken, 2026-10-30: very smooth, simply by touch): drag up
//        to go, the further the faster, to the side to turn, the further the sharper, up and across to curve, down
//        for an about-face, a quick tap to jump. A second finger turns the camera. A button for Duck.
// Game controller (the standard layout: Xbox, PlayStation, Switch Pro): left stick
//        or d-pad steers him the same way (up forward, sides turn, down turns round),
//        right stick turns the camera, A jumps (and swims up), B or a
//        trigger runs on all fours (and dives), Y swings the camera behind him, Start pauses.

import { showTip } from './tips.js';
import { settings } from './settings.js';
import { xrGamepad } from './vr.js';           // a VR headset's controllers, read as a game controller
import './device.js';                    // which controls are in use: keyboard, mouse, controller, touch (device.js)
import { installSettingsUi } from './settings-ui.js';

// The orb: how fast a full push to the side turns him (radians a second).
const ORB_TURN = 1.7, ORB_STEER = 0.5;    // ORB_STEER: a full push to the side, as a share of the keys' turning speed (gentler)
// A thumb, a stick or a VR controller: how far it reads as a push, and how softly he answers.
const THUMB_R = 62;                       // pixels of drag for a full push
const THUMB_TURN = 0.75;                  // a full push to the side, as a share of the keys' turning speed
const SMOOTH = 9;                         // how quickly he follows a push: a tenth of a second or so
const soft = v => Math.sign(v) * Math.pow(Math.abs(v), 1.5);   // small pushes are fine, a big one is full
// Which way Wally faces on screen, as an angle from straight up (clockwise), set by wally.js every frame.
// The orb's arrows turn to it (Ken, 2026-10-21: the orb always at Wally's orientation), and a push is read
// against them: toward the up arrow is forward for him, whichever way the camera looks.
let orbAngle = 0;
export function setOrbHeading(a) { if (Number.isFinite(a)) orbAngle = a; }
// A push on the orb (screen pixels from its middle) turned into Wally's own frame.
// (Turning the arrows with Wally made a held push keep changing meaning, so he spun: Ken, 2026-10-22. The
// orb stays fixed: up is always forward, the sides always turn.)
function toWally(dx, dy) { return { x: dx, y: dy }; }
// Arrows inside the orb, so it explains itself: up to go, round arrows left and right to turn.
const ORB_ARROWS = '<svg class="orb-arrows" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="rgba(255,255,240,0.85)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">'
  + '<g class="a-go"><path d="M36 26 L50 10 L64 26"/><path d="M50 12 L50 36"/></g><g class="a-back" opacity="0.5"><path d="M40 80 L50 90 L60 80"/></g>'
  + '<g class="a-left"><path d="M22 36 A30 30 0 0 0 22 64"/><path d="M15 43 L22 36 L29 42"/></g>'
  + '<g class="a-right"><path d="M78 36 A30 30 0 0 1 78 64"/><path d="M85 43 L78 36 L71 42"/></g>'
  + '<circle cx="50" cy="50" r="5" fill="rgba(255,255,240,0.7)" stroke="none"/></g></svg>';

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

    // Keyboard on a computer, touch on a phone (Ken, 2026-10-31: players will not know Esc gives a captured cursor back).
    // So the game never takes the cursor, and the mouse is only for clicking menus and buttons.
    this.aim = 0;
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
    if (down && k === 'v' && !e.repeat && this.onCamera) this.onCamera();   // the camera: auto or manual
    if (down && k === 'c') this.recenterQueued = true;
    if (down) this.keys.add(k); else this.keys.delete(k);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  }

  // Touch (Ken, 2026-10-30: very smooth, simply by touch). A finger down anywhere on the game is a thumb-stick right
  // there, with a ring to show it: no button to find, and the finger is never in the way of Wally. The middle of the
  // ring follows a thumb dragged past its edge, so coming back is instant. A quick tap jumps; down is an about-face.
  bindTouch(canvas, ui) {
    const ring = ui.stick, knob = ui.knob;
    ring.classList.add('thumb');
    const show = s => { ring.classList.add('on'); ring.style.left = `${s.x0}px`; ring.style.top = `${s.y0}px`; knob.style.transform = `translate(${s.dx * THUMB_R}px, ${s.dy * THUMB_R}px)`; };
    const read = (s, t) => {
      let x = t.clientX - s.x0, y = t.clientY - s.y0, d = Math.hypot(x, y);
      if (d > 12) s.moved = true;
      if (d > THUMB_R) { s.x0 += x * (1 - THUMB_R / d); s.y0 += y * (1 - THUMB_R / d); x = t.clientX - s.x0; y = t.clientY - s.y0; d = THUMB_R; }
      const live = d < THUMB_R * 0.12 ? 0 : (d - THUMB_R * 0.12) / (THUMB_R * 0.88) / d;   // a small dead middle, so a resting thumb is still
      s.dx = x * live; s.dy = y * live;
    };
    canvas.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (!this.stick) { this.stick = { id: t.identifier, x0: t.clientX, y0: t.clientY, dx: 0, dy: 0, t0: performance.now(), moved: false }; show(this.stick); }
        else if (!this.look) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    }, { passive: false });
    addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) { read(this.stick, t); show(this.stick); }
        else if (this.look && t.identifier === this.look.id) {
          this.turn -= (t.clientX - this.look.x) * 0.008; this.tilt += (t.clientY - this.look.y) * 0.006;
          this.look.x = t.clientX; this.look.y = t.clientY;
        }
      }
      if (this.stick || this.look) e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) {
          if (!this.stick.moved && performance.now() - this.stick.t0 < 240) this.jumpQueued = true;   // a quick tap: jump
          this.stick = null; ring.classList.remove('on');
        }
        if (this.look && t.identifier === this.look.id) this.look = null;
      }
    };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    const tap = (el, fn) => el.addEventListener('touchstart', e => { fn(); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    tap(ui.jump, () => { this.jumpQueued = true; });
    tap(ui.fours, () => {
      this.foursToggle = !this.foursToggle; ui.fours.classList.toggle('on', this.foursToggle);
      if (this.foursToggle) showTip('duck', 'Duck: Wally drops onto all fours, low enough to get under branches. In water it makes him dive. Tap Duck again to stand up.');
    });
    tap(ui.pause, () => this.onPause && this.onPause());
    tap(ui.cam, () => { this.recenterQueued = true; });
  }

  // A game controller, if one is plugged in: this frame's stick, d-pad and
  // buttons. A, Y and Start count once per press, like the keys.
  readPad() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const p = xrGamepad() || pads.find(g => g.mapping === 'standard') || pads[0];   // in a VR headset, its controllers (vr.js)
    if (!p) return null;
    const dead = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;   // a dead zone, so a resting stick is still
    const held = i => !!(p.buttons[i] && p.buttons[i].pressed);
    const now = { a: held(0), y: held(3), start: held(9), round: !!p.turnAround }, was = this.padWas || {};
    if (now.round && !was.round) this.turnQueued = true;           // VR: the right stick pressed turns him round
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
    // (Tried 2026-10-26 and left out: turning on its own walking him slowly round, like the orb. Measured, it
    // crept him into the tourists' nervous ring while he turned to aim; they bolted and threw a third less food.)
    // A stick, a thumb, the orb or a VR controller: one way of reading them all, the push softened, and followed
    // smoothly both ways, so he eases into a move and out of it (Ken, 2026-10-30: smooth, especially on phones).
    const pad = this.readPad(), padMoving = !!(pad && (pad.forward || pad.right));
    const steerAll = settings.controls === 'classic';
    let wantF = 0, wantR = 0, pushed = false;
    if (padMoving) { wantF = soft(pad.forward); wantR = soft(pad.right) * (steerAll ? THUMB_TURN : 1); pushed = true; }
    if (this.stick) {
      const sx = this.stick.dx, sy = this.stick.dy, mine = this.stick.id === 'mouse' ? ORB_STEER : THUMB_TURN;
      wantF = sy < 0 ? soft(-sy) : (sy > 0.6 ? -1 : 0);          // up goes; well down is the about-face, or backing up
      if (steerAll) wantR = soft(sx) * mine; else { wantR = 0; this.turn -= soft(sx) * ORB_TURN * dt; }
      pushed = true;
    }
    const k2 = Math.min(1, dt * SMOOTH);
    this.softF = (this.softF || 0) + ((wantF < 0 && steerAll ? 0 : wantF) - (this.softF || 0)) * k2;
    this.softR = (this.softR || 0) + (wantR - (this.softR || 0)) * k2;
    if (Math.abs(this.softF) < 0.005) this.softF = 0;
    if (Math.abs(this.softR) < 0.005) this.softR = 0;
    if (!f && !r && (pushed || this.softF || this.softR)) { f = this.softF; r = this.softR; if (wantF < 0) f = wantF; }
    // Steering: down, from anything, is one about-face per push; up goes the way he faces, never back.
    if (steerAll) {
      const back = f < -0.5;
      if (back && !this.backWas) this.turnQueued = true;
      this.backWas = back;
      f = Math.max(0, f);
    }
    // The mouse's turn, let out over a few frames.
    if (this.aimLeft) { const part = this.aimLeft * Math.min(1, dt * 18); this.aim += part; this.aimLeft -= part; if (Math.abs(this.aimLeft) < 1e-4) { this.aim += this.aimLeft; this.aimLeft = 0; } }
    if (this.orbArrows) {
      const s = this.stick || { dx: 0, dy: 0 };
      // The compass lights the way he is going, from the orb or from the mouse (hold left: go; moving it: turn).
      // (orb- names: a plain 'go' class is the site's big gold button style, which covered the orb.)
      this.orbArrows.classList.toggle('orb-go', s.dy < -0.15); this.orbArrows.classList.toggle('orb-back', s.dy > 0.15);
      this.orbArrows.classList.toggle('orb-left', s.dx < -0.2 || this.aim > 0.004); this.orbArrows.classList.toggle('orb-right', s.dx > 0.2 || this.aim < -0.004);
    }
    if (pad) { this.turn += pad.turn; this.tilt += pad.tilt; }
    const turnKeys = (k.has('q') ? 1 : 0) - (k.has('e') ? 1 : 0);
    const out = {
      forward: f, right: r,
      // Classic steering (a setting) is for the keyboard only: up runs the way he
      // faces, down turns him round, left and right turn him. Otherwise, and
      // always for the phone stick and a controller, moving is relative to the camera.
      steer: settings.controls === 'classic',
      aim: this.aim,                   // the mouse's turn of Wally this frame (radians), with the cursor taken
      jump: this.jumpQueued,
      fours: k.has('shift') || this.foursToggle || !!(pad && pad.fours),
      turnAround: !!this.turnQueued,   // down, once: Wally's about-face (wally.js)
      ctrl: k.has('control'),          // with Shift: come up from a dive (the reef and the sea)
      turn: this.turn, turnKeys, tilt: this.tilt, zoom: this.zoom, recenter: this.recenterQueued,
    };
    this.recenterQueued = false; this.turnQueued = false;
    this.jumpQueued = false; this.turn = 0; this.tilt = 0; this.zoom = 0; this.aim = 0;
    return out;
  }
}

// The camera with steering (the default): it swings round behind Wally as he turns,
// smoothly, so up is always the way he is going. Each level's camera calls this.
export function steering() { return settings.controls === 'classic'; }
// The camera in camera-relative play (the default, Ken 2026-10-29). It holds its angle, so running
// sideways or toward it never swings it round: that chase is what made him run in circles before.
// Only while he runs roughly away from it does it drift in behind him, slowly. The mouse or the
// right stick turns it at any time. The Manual camera setting never turns it.
export function lazyBehind(yaw, wally, dt) {
  const v = wally.vel;
  if (settings.camera === 'manual' || !v || Math.hypot(v.x, v.z) < 0.5) return yaw;
  const want = wally.facing + Math.PI, d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
  return Math.abs(d) < 0.8 ? yaw + d * Math.min(1, dt * 0.6) : yaw;
}
export function easeBehind(yaw, facing, dt, rate = 3) {
  const want = facing + Math.PI, d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
  return yaw + d * Math.min(1, dt * rate);
}
