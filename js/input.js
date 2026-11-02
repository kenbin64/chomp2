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
// Phone: right thumb on the fixed arrows to move and turn; left thumb on what fits (showThumbs); elsewhere turns the camera.
// Game controller (the standard layout: Xbox, PlayStation, Switch Pro): left stick
//        or d-pad steers him the same way (up forward, sides turn, down turns round),
//        right stick turns the camera, A jumps (and swims up), B or a
//        trigger runs on all fours (and dives), Y swings the camera behind him, Start pauses.

import { showTip } from './tips.js';
import { THUMB_ARROWS } from './thumbs.js';
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
const SMOOTH_THUMB = 11;                  // and a thumb's turn, a little quicker
// The right thumb on a phone (Ken, 2026-11-01). A push any way but down sets him off, so he never swivels on the spot to aim: he
// runs and turns together, as we do. He keeps going until the thumb comes back past GO_OFF, below the middle, or lifts. How fast is how far out the thumb is, walk to sprint: a walk near the middle, about the
// keys' pace at the rim of the circle, and his sprint past it, out to SPRINT_R pixels. Further out than that changes nothing.
const GO_ON = 0.15, GO_OFF = 0.2;
const DOWN_CONE = 1.7;                    // how clearly down a pull must be to count as down: within about 30 degrees of straight down
// How the thumb's push to the side becomes a turn (Ken, 2026-11-01: too twitchy). Within THUMB_STRAIGHT of straight up he does not
// turn at all, as no thumb holds exactly still; past it the turn grows slowly at first, and only a full push is a sharp corner.
const THUMB_STRAIGHT = 0.2, THUMB_CURVE = 1.6;
const thumbTurn = sx => Math.sign(sx) * Math.pow(Math.max(0, Math.abs(sx) - THUMB_STRAIGHT) / (1 - THUMB_STRAIGHT), THUMB_CURVE);
const WALK_R = 20, SPRINT_R = 110;        // pixels from the circle's middle where the walk ends and the sprint is reached
const WALK_PACE = 0.45, SPRINT_PACE = 1.45;   // as a share of his usual speed
const ORB_REST = 24, ORB_MOVING = 40;     // the orb in the circle: pixels from the middle, standing and on the move
const ORB_LEAN = 1.5;                     // how far it swings for a turn: a full push to the side takes it about to the side (radians)
const soft = v => Math.sign(v) * Math.pow(Math.abs(v), 1.5);   // small pushes are fine, a big one is full
// Which way Wally faces on screen, as an angle from straight up (clockwise), set by wally.js every frame.
// The orb's arrows turn to it (Ken, 2026-10-21: the orb always at Wally's orientation), and a push is read
// against them: toward the up arrow is forward for him, whichever way the camera looks.
let orbAngle = 0;
// Whether he is in the water, set by wally.js: the left thumb's buttons follow it (Input.showThumbs).
let thumbWater = null;
export function setThumbWater(on) {
  thumbWater = on;
}
// Once the thumb is driving, the camera stays close behind him (Ken, 2026-11-01: after a sharp turn he was left side on, so the
// player kept flipping from one side to the other to aim him). Up on the circle is then always the way he is going on the screen.
let thumbDriving = false;
export const THUMB_CAM = 5;              // how quickly the camera comes round behind him (a rate: about a fifth of a second)
export function isThumbDriving() { return thumbDriving; }
export function setOrbHeading(a) { if (Number.isFinite(a)) orbAngle = a; }
// A push on the orb (screen pixels from its middle) turned into Wally's own frame.
// (Turning the arrows with Wally made a held push keep changing meaning, so he spun: Ken, 2026-10-22. The
// orb stays fixed: up is always forward, the sides always turn.)
function toWally(dx, dy) { return { x: dx, y: dy }; }

export class Input {
  constructor(canvas, touchUi) {
    this.keys = new Set();
    this.forward = 0; this.right = 0;
    this.jumpQueued = false; this.foursHeld = false; this.foursTouch = false; this.foursTapped = false; this.diveThumb = null;
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

  // Touch (Ken, 2026-11-01: as smooth as the keyboard, and two thumbs). The right thumb has a circle fixed at the bottom
  // right: up goes, to the side turns, down is the about-face, read through the same smoothing as everything else. The left
  // thumb has Jump and Dive, fixed at the bottom left. Both work at once. A finger anywhere else turns the camera.
  bindTouch(canvas, ui) {
    const ring = ui.stick, knob = ui.knob;
    ring.classList.add('orb'); if (!ring.querySelector('.orb-arrows')) ring.insertAdjacentHTML('afterbegin', THUMB_ARROWS);
    this.orbArrows = ring.querySelector('.orb-arrows'); this.thumbUi = ui;
    ring.classList.add('hint');            // the up arrow beckons until the thumb first lands
    // Three chevrons above the circle: further out is faster. They light as he goes from a walk to a sprint.
    ring.insertAdjacentHTML('beforeend', '<div class="orb-run" data-run="0" aria-hidden="true"><i></i><i></i><i></i></div>');
    this.orbRun = ring.querySelector('.orb-run');
    // An orb inside the circle: which way he is facing and whether he is going straight or turning (Ken, 2026-11-01). The arrows stay fixed.
    ring.insertAdjacentHTML('beforeend', '<div class="orb-heading" aria-hidden="true"></div>');
    this.orbHeading = ring.querySelector('.orb-heading');
    const show = s => { knob.style.transform = `translate(${s.dx * THUMB_R}px, ${s.dy * THUMB_R}px)`; };
    // How far the thumb is from the circle's fixed middle. Past the edge it is a full push, the knob at the rim.
    const read = (s, t) => {
      const x = t.clientX - s.x0, y = t.clientY - s.y0, d = Math.hypot(x, y) || 1;
      const live = d < THUMB_R * 0.12 ? 0 : Math.min(1, (d - THUMB_R * 0.12) / (THUMB_R * 0.88)) / d;   // a small dead middle, so a resting thumb is still
      s.dx = x * live; s.dy = y * live; s.far = d;
    };
    // The circle itself, or close enough that a thumb reaching for it without looking still gets it.
    const onRing = t => { const r = ring.getBoundingClientRect(); return Math.hypot(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2)) < r.width * 0.85; };
    const take = t => {
      const r = ring.getBoundingClientRect();
      this.stick = { id: t.identifier, x0: r.left + r.width / 2, y0: r.top + r.height / 2, dx: 0, dy: 0, going: false };
      read(this.stick, t); show(this.stick); ring.classList.add('active'); ring.classList.remove('hint'); thumbDriving = true;
    };
    const begin = e => {
      for (const t of e.changedTouches) {
        if (!this.stick && onRing(t)) take(t);
        else if (!this.look) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };   // anywhere else: the camera
      }
      e.preventDefault();
    };
    canvas.addEventListener('touchstart', begin, { passive: false });
    ring.addEventListener('touchstart', e => { e.stopPropagation(); begin(e); }, { passive: false });
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
        if (this.stick && t.identifier === this.stick.id) { this.stick = null; knob.style.transform = ''; ring.classList.remove('active'); }
        if (this.look && t.identifier === this.look.id) this.look = null;
        if (t.identifier === this.diveThumb) { this.diveThumb = null; this.foursTouch = false; ui.fours.classList.remove('on'); }
      }
    };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    const tap = (el, fn) => el.addEventListener('touchstart', e => { fn(e); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    tap(ui.jump, () => { this.jumpQueued = true; });
    // Held, as Shift is held on a keyboard. foursTapped: a tap quicker than a frame still counts.
    tap(ui.fours, e => { this.diveThumb = e.changedTouches[0].identifier; this.foursTouch = true; this.foursTapped = true; ui.fours.classList.add('on'); });
    tap(ui.pause, () => this.onPause && this.onPause());
    tap(ui.cam, () => { this.recenterQueued = true; });
  }

  // The left thumb shows only what does something right now (Ken, 2026-11-01), and the big button is the main move here:
  //   on land               Jump, and Duck beside it
  //   in water, at the top  Dive, and Leap beside it (no Leap where the level has none: the reef)
  //   under water           Up, and Dive beside it if there is further down to go
  //   water with no diving  Leap
  // The level's own Dive and Up buttons (hidden on a phone) already say when each one works, so they are read here.
  showThumbs() {
    const box = document.getElementById('dive-buttons'), canDive = !!thumbWater && !!box && !box.hidden;
    const under = canDive && !document.getElementById('b-up').disabled;
    const deeper = canDive && !document.getElementById('b-dive').disabled;
    const leap = !(box && 'noLeap' in box.dataset);
    const [jump, jumpSays, fours, foursSays] = under ? ['big', 'Up', deeper ? 'small' : 'off', 'Dive']
      : canDive ? [leap ? 'small' : 'off', 'Leap', 'big', 'Dive']
      : thumbWater ? ['big', 'Leap', 'off', 'Dive'] : ['big', 'Jump', 'small', 'Duck'];
    const now = jump + jumpSays + fours + foursSays;
    if (now === this.thumbsNow) return;
    this.thumbsNow = now;
    const J = this.thumbUi.jump, F = this.thumbUi.fours;
    J.dataset.slot = jump; J.textContent = jumpSays; F.dataset.slot = fours; F.textContent = foursSays;
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
      const sx = this.stick.dx, sy = this.stick.dy, mine = this.stick.id === 'mouse' ? ORB_STEER : 1;
      // Down means stop only when it is clearly down. A thumb arcing round to the side and low is a hard turn, and he keeps running.
      const pullDown = sy > GO_OFF && sy > Math.abs(sx) * DOWN_CONE;
      if (pullDown) this.stick.going = false; else if (Math.hypot(sx, sy) > GO_ON) this.stick.going = true;
      wantF = this.stick.going ? 1 : (sy > 0.6 && pullDown ? -1 : 0);   // up goes; well down is the about-face, or backing up
      if (steerAll) wantR = this.stick.id === 'mouse' ? soft(sx) * mine : thumbTurn(sx); else { wantR = 0; this.turn -= soft(sx) * ORB_TURN * dt; }
      pushed = true;
    }
    const k2 = Math.min(1, dt * SMOOTH);
    // Walk to sprint: eased like the rest, and held as he slows after the thumb lifts.
    if (this.stick) {
      const out = Math.max(0, Math.min(1, (this.stick.far - WALK_R) / (SPRINT_R - WALK_R))), pace = WALK_PACE + (SPRINT_PACE - WALK_PACE) * out;
      this.thumbPace = this.thumbPace ? this.thumbPace + (pace - this.thumbPace) * k2 : pace;
      if (this.orbRun) this.orbRun.dataset.run = !this.stick.going ? 0 : out > 0.8 ? 3 : out > 0.5 ? 2 : 1;
    } else if (!this.softF) { this.thumbPace = 0; if (this.orbRun) this.orbRun.dataset.run = 0; }
    this.softF = (this.softF || 0) + ((wantF < 0 && steerAll ? 0 : wantF) - (this.softF || 0)) * k2;
    this.softR = (this.softR || 0) + (wantR - (this.softR || 0)) * (this.stick ? (wantR ? Math.min(1, dt * SMOOTH_THUMB) : 1) : k2);
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
      this.orbArrows.classList.toggle('orb-go', !!s.going); this.orbArrows.classList.toggle('orb-back', s.dy > 0.15);
      this.orbArrows.classList.toggle('orb-left', s.dx < -0.2 || this.aim > 0.004); this.orbArrows.classList.toggle('orb-right', s.dx > 0.2 || this.aim < -0.004);
    }
    if (this.thumbUi) this.showThumbs();
    if (this.orbHeading) {
      // Straight on it sits at the top; turning, it swings to that side; an about-face takes it right round. Standing, it rests nearer the middle.
      const a = orbAngle + (this.softR || 0) * ORB_LEAN, far = ORB_REST + (ORB_MOVING - ORB_REST) * Math.min(1, Math.abs(this.softF || 0));
      this.orbHeading.style.transform = `translate(${Math.sin(a) * far}px, ${-Math.cos(a) * far}px)`;
    }
    if (pad) { this.turn += pad.turn; this.tilt += pad.tilt; }
    const turnKeys = (k.has('q') ? 1 : 0) - (k.has('e') ? 1 : 0);
    const out = {
      forward: f, right: r,
      boost: this.thumbPace || 1,
      sharp: !!this.thumbPace,         // by thumb: the turn answers at once, with no build-up (wally.js)
      // Classic steering (a setting) is for the keyboard only: up runs the way he
      // faces, down turns him round, left and right turn him. Otherwise, and
      // always for the phone stick and a controller, moving is relative to the camera.
      steer: settings.controls === 'classic',
      aim: this.aim,                   // the mouse's turn of Wally this frame (radians), with the cursor taken
      jump: this.jumpQueued,
      fours: k.has('shift') || this.foursTouch || this.foursTapped || !!(pad && pad.fours),
      turnAround: !!this.turnQueued,   // down, once: Wally's about-face (wally.js)
      ctrl: k.has('control'),          // with Shift: come up from a dive (the reef and the sea)
      turn: this.turn, turnKeys, tilt: this.tilt, zoom: this.zoom, recenter: this.recenterQueued,
    };
    this.recenterQueued = false; this.turnQueued = false;
    this.jumpQueued = false; this.foursTapped = false; this.turn = 0; this.tilt = 0; this.zoom = 0; this.aim = 0;
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
  if (thumbDriving) rate = Math.max(rate, THUMB_CAM);
  const want = facing + Math.PI, d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
  return yaw + d * Math.min(1, dt * rate);
}
