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
//        The mouse (Ken chose, 2026-10-20): click the game to take the cursor; then
//        moving the mouse turns Wally (up and down tilts the view), holding the left
//        button runs him forward, and holding the right button looks around with the
//        camera (let go and the mouse steers him again). Esc gives the cursor back; a
//        click on the game takes it again.
//        The wheel zooms. Space jumps (and swims up), Shift dives under (and runs on
//        all fours on land). Q / E turn the camera, wheel zooms, C swings it behind
//        him, P pauses. (Camera-relative moving is a setting, settings.js.)
// Phone: left thumb anywhere on the left half is a joystick, drag on the right
//        half turns the camera, buttons for Jump and Fours.
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

    // The mouse. Click the game to take the cursor (pointer lock); then moving the
    // mouse turns Wally gradually, the left button held takes him forward, a quick click
    // jumps, and the right button held hands the mouse to the camera until it is let go.
    // Esc gives the cursor back.
    // Without the cursor taken, dragging turns the camera.
    let drag = null;
    this.aim = 0; this.mouseMode = 'wally'; this.mouseRun = false;
    // Only while a level is being played: not over a menu, card, tip or the map.
    const MODALS = '.overlay:not([hidden]), .map-modal:not([hidden])';   // (a tip is a slim line now, never in the way)
    this.canLock = () => !document.querySelector(MODALS);
    // Any card coming up gives the cursor back for ordinary clicking; when the last
    // card is dismissed, Wally has the mouse again (Ken, 2026-10-20). The click or key
    // that dismissed it counts as the player's go-ahead the browser asks for.
    let handBack = false;
    new MutationObserver(() => {
      const open = !this.canLock();
      if (open && document.pointerLockElement === canvas) { handBack = true; document.exitPointerLock(); }
      else if (!open && handBack) { handBack = false; this.mouseMode = 'wally'; canvas.requestPointerLock?.()?.catch?.(() => {}); }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    const locked = () => document.pointerLockElement === canvas;
    // A small label saying what the mouse is doing: steering Wally, turning the camera,
    // or free (click the game to take it).
    const chip = document.createElement('div'); chip.className = 'mouse-chip'; document.body.append(chip);
    this.showChip = () => {
      chip.textContent = !locked() ? '' : this.mouseMode === 'wally' ? '🖱 Mouse turns Wally · hold left: go · click: jump · hold right: look around · Esc: cursor' : '🖱 Looking around · let go of the right button to steer';
      chip.hidden = !locked();
    };
    this.showChip();
    canvas.addEventListener('mousedown', e => {
      if (locked()) {
        if (e.button === 0) { this.mouseRun = true; this.leftDown = { t: performance.now(), moved: 0 }; }   // held: go; a quick click: jump (mouseup)
        if (e.button === 2) { this.mouseMode = 'camera'; this.showChip(); }
        return;
      }
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: 0 };
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) {
        this.mouseRun = false;
        // A quick click, the mouse barely moved: jump (Ken, 2026-10-21: hold left to go, click to jump).
        if (locked() && this.leftDown && performance.now() - this.leftDown.t < 220 && this.leftDown.moved < 12) this.jumpQueued = true;
        this.leftDown = null;
      }
      if (e.button === 2 && this.mouseMode === 'camera') { this.mouseMode = 'wally'; this.showChip(); }
      // A click (not a drag) on the game takes the cursor, while a level is being played.
      if (drag && drag.moved < 6 && !locked() && this.canLock && this.canLock()) canvas.requestPointerLock?.();
      drag = null;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());     // the right button is the camera, not a menu
    document.addEventListener('pointerlockchange', () => {
      if (!locked()) { this.unlockedAt = performance.now(); this.mouseRun = false; }
      this.mouseMode = 'wally';
      document.body.classList.toggle('mouse-steer', locked());
      this.showChip();
    });
    addEventListener('mousemove', e => {
      if (locked()) {
        if (this.leftDown) this.leftDown.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        if (this.mouseMode === 'wally') this.aim -= e.movementX * 0.0022;   // a gradual turn (Ken: too fast before)
        else this.turn -= e.movementX * 0.004;
        this.tilt += e.movementY * 0.0025; return;
      }
      if (!drag) return;
      drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      this.turn -= (e.clientX - drag.x) * 0.005; this.tilt += (e.clientY - drag.y) * 0.004;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    canvas.addEventListener('wheel', e => { this.zoom += Math.sign(e.deltaY) * 1.2; e.preventDefault(); }, { passive: false });

    if (touchUi) { this.bindTouch(canvas, touchUi); this.bindPad(touchUi); }
    else this.bindMouseOrb();
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
    if (down && k === 'v' && !e.repeat && this.onCamera) this.onCamera();   // the camera: auto or manual
    if (down && k === 'c') this.recenterQueued = true;
    if (down) this.keys.add(k); else this.keys.delete(k);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  }

  // Touch (Ken, 2026-10-21): one green orb, bottom right where the thumb rests, is the controller. Put a
  // finger on it and a gold ring lights round it: drag up to go the way he faces, left or right to turn,
  // back to the middle to stop; a quick tap jumps. The finger never covers Wally. Any other drag on the
  // screen turns the camera.
  bindTouch(canvas, ui) {
    const orb = ui.stick, R = 55;
    orb.classList.add('orb'); if (!orb.querySelector('.orb-arrows')) orb.insertAdjacentHTML('afterbegin', ORB_ARROWS);
    this.orbArrows = orb.querySelector('.orb-arrows');
    const centre = () => { const r = orb.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const steer = t => {
      const c = centre(), w = toWally(t.clientX - c.x, t.clientY - c.y), d = Math.hypot(w.x, w.y), k = d > R ? R / d : 1;
      if (d > 10) this.stick.moved = true;
      const still = d < R * 0.22;                                   // the middle: stop
      this.stick.dx = still ? 0 : w.x * k / R; this.stick.dy = still ? 0 : w.y * k / R;
    };
    orb.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      if (!this.stick) { this.stick = { id: t.identifier, dx: 0, dy: 0, t0: performance.now(), moved: false }; orb.classList.add('active'); steer(t); }
      e.preventDefault(); e.stopPropagation();
    }, { passive: false });
    canvas.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) if (!this.look) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      e.preventDefault();
    }, { passive: false });
    addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) steer(t);
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
          if (!this.stick.moved && performance.now() - this.stick.t0 < 280) this.jumpQueued = true;   // a quick tap: jump
          this.stick = null; orb.classList.remove('active');
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

  // The same green orb on a computer (Ken, 2026-10-21: the best controller), always on the right. The
  // cursor only has to rest over it: up from the middle goes the way he faces, to the side turns, the
  // middle stops him, and moving off it stops him. A click on it jumps. The keys still work as well.
  bindMouseOrb() {
    const orb = document.getElementById('stick'), knob = document.getElementById('knob'), hud = document.getElementById('hud');
    if (!orb || !knob || !hud) return;
    hud.append(orb); orb.classList.add('orb', 'mouse-orb'); if (!orb.querySelector('.orb-arrows')) orb.insertAdjacentHTML('afterbegin', ORB_ARROWS);
    this.orbArrows = orb.querySelector('.orb-arrows');           // it shows and hides with the rest of the play screen
    const R = 55;
    const steer = e => {
      const r = orb.getBoundingClientRect(), w = toWally(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      const d = Math.hypot(w.x, w.y), k = d > R ? R / d : 1, still = d < R * 0.22;
      this.stick = { id: 'mouse', dx: still ? 0 : w.x * k / R, dy: still ? 0 : w.y * k / R };
      orb.classList.add('active');
    };
    // Once the cursor is on the orb it keeps steering until it strays well past the edge, so reaching
    // for full speed never drops it.
    const stop = () => { this.stick = null; orb.classList.remove('active'); };
    orb.addEventListener('mouseenter', steer);
    addEventListener('mousemove', e => {
      if (!orb.classList.contains('active')) return;
      const r = orb.getBoundingClientRect();
      if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) > r.width * 0.85) stop(); else steer(e);
    });
    orb.addEventListener('mousedown', e => { if (e.button === 0) this.jumpQueued = true; e.preventDefault(); e.stopPropagation(); });
    orb.addEventListener('click', e => e.stopPropagation());
  }

  // The diamond pad on phones and tablets (Ken, 2026-10-22): five round buttons. Top: go forward. Left and
  // right: turn. Middle: jump. Bottom: turn right round, quickly (Ken, 2026-10-23: diving and ducking moved
  // to buttons beside the backpack, style.css). Hold to keep going; slide the thumb from one button to the
  // next without lifting it (forward and a turn together: slide between them, or use two fingers).
  // The orb stays on computers.
  bindPad(ui) {
    if (document.getElementById('dpad')) return;
    const svg = d => `<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${d}</g></svg>`;
    const pad = document.createElement('div'); pad.id = 'dpad'; pad.setAttribute('aria-label', 'Controls');
    pad.innerHTML = [
      ['up', 'Forward', svg('<path d="M20 31V10"/><path d="M11 18l9-9 9 9"/>')],
      ['left', 'Turn left', svg('<path d="M28 30a12 12 0 0 1-14-18"/><path d="M8 15l6-4 3 7"/>')],
      ['jump', 'Jump', svg('<path d="M8 30h24"/><path d="M12 24c2-12 14-12 16 0"/><path d="M24 14l4-2 1 5"/>')],
      ['right', 'Turn right', svg('<path d="M12 30a12 12 0 0 0 14-18"/><path d="M32 15l-6-4-3 7"/>')],
      ['down', 'Turn around', svg('<path d="M12 32V17a8 8 0 0 1 16 0v6"/><path d="M22 18l6 6 6-6"/>')],
    ].map(([k, label, icon]) => `<button type="button" class="pad-${k}" data-k="${k}" aria-label="${label}">${icon}</button>`).join('');
    document.getElementById('touch').append(pad);
    if (ui.stick) ui.stick.classList.add('replaced');                  // the orb gives way to the pad on touch
    if (ui.jump) ui.jump.classList.add('replaced');
    this.padKeys = new Set();
    const held = new Map();                                            // touch id -> the button under it
    // Where the thumb is on the pad: the middle jumps; around it, eight directions, so the gap between
    // forward and a turn does both (Ken: going forward while turning must be easy, with one thumb).
    const under = t => {
      const r = pad.getBoundingClientRect(), dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < r.width * 0.17) return ['jump'];
      const a = Math.round(Math.atan2(dx, -dy) / (Math.PI / 4));          // 0 up, 1 up-right, 2 right ... -1 up-left
      return ({ 0: ['up'], 1: ['up', 'right'], 2: ['right'], 3: ['right'], 4: ['down'], '-4': ['down'], '-3': ['left'], '-2': ['left'], '-1': ['up', 'left'] })[a] || [];
    };
    const sync = () => {
      this.padKeys = new Set([...held.values()].flat());
      for (const b of pad.children) b.classList.toggle('on', this.padKeys.has(b.dataset.k));
    };
    pad.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) { const k = under(t); held.set(t.identifier, k); if (k.includes('jump')) this.jumpQueued = true; if (k.includes('down')) this.turnQueued = true; }
      sync(); e.preventDefault(); e.stopPropagation();
    }, { passive: false });
    pad.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) if (held.has(t.identifier)) { const k = under(t), was = held.get(t.identifier); if (k.includes('jump') && !was.includes('jump')) this.jumpQueued = true; if (k.includes('down') && !was.includes('down')) this.turnQueued = true; held.set(t.identifier, k); }
      sync(); e.preventDefault(); e.stopPropagation();
    }, { passive: false });
    const end = e => { for (const t of e.changedTouches) held.delete(t.identifier); sync(); };
    pad.addEventListener('touchend', end); pad.addEventListener('touchcancel', end);
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
    let f = (k.has('w') || k.has('arrowup') || this.mouseRun ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
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
    const pad = this.readPad(), padMoving = !!(pad && (pad.forward || pad.right));
    if (padMoving) { f = pad.forward; r = pad.right; }
    // The orb (Ken, 2026-10-21): up goes forward, the sides TURN him at a steady rate (not a sideways
    // step, which with the camera following made him spin). A gentle curve: small moves are slow.
    if (this.stick) {
      const sx = this.stick.dx, sy = this.stick.dy, ease = v => Math.sign(v) * Math.pow(Math.abs(v), 1.6);
      f = sy < 0 ? ease(-sy) : -ease(sy) * 0.5;                       // backing up is slower
      if (Math.abs(sx) > 0.2 && Math.abs(f) < 0.25) f = 0.25 * Math.abs(sx);   // pushed to the side alone: a slow walk round, so he turns too
      // Classic controls: the sides turn Wally himself and the camera follows behind (turning the camera
      // instead does nothing in classic, where forward is the way he faces). Otherwise the camera turns.
      if (settings.controls === 'classic') r = ease(sx) * ORB_STEER; else { r = 0; this.turn -= ease(sx) * ORB_TURN * dt; }
    }
    if (this.padKeys && this.padKeys.size) {
      const k = this.padKeys;
      if (k.has('up')) f = 1;
      const tr = (k.has('left') ? 1 : 0) - (k.has('right') ? 1 : 0);
      if (tr) { if (settings.controls === 'classic') r = -tr * ORB_STEER; else this.turn += tr * ORB_TURN * dt; if (!k.has('up')) f = Math.max(f, 0.25); }   // a turn alone walks him slowly round
    }
    if (this.orbArrows) {
      const s = this.stick || { dx: 0, dy: 0 };
      // The compass lights the way he is going, from the orb or from the mouse (hold left: go; moving it: turn).
      // (orb- names: a plain 'go' class is the site's big gold button style, which covered the orb.)
      this.orbArrows.classList.toggle('orb-go', s.dy < -0.15 || this.mouseRun); this.orbArrows.classList.toggle('orb-back', s.dy > 0.15);
      this.orbArrows.classList.toggle('orb-left', s.dx < -0.2 || this.aim > 0.004); this.orbArrows.classList.toggle('orb-right', s.dx > 0.2 || this.aim < -0.004);
    }
    if (pad) { this.turn += pad.turn; this.tilt += pad.tilt; }
    const turnKeys = (k.has('q') ? 1 : 0) - (k.has('e') ? 1 : 0);
    if (this.turnQueued && settings.controls !== 'classic') this.turn += Math.PI;   // camera-relative: the camera swings round, so up is the other way
    const out = {
      forward: f, right: r,
      // Classic steering (a setting) is for the keyboard only: up runs the way he
      // faces, down turns him round, left and right turn him. Otherwise, and
      // always for the phone stick and a controller, moving is relative to the camera.
      steer: settings.controls === 'classic' && !this.stick,
      aim: this.aim,                   // the mouse's turn of Wally this frame (radians), with the cursor taken
      jump: this.jumpQueued,
      fours: k.has('shift') || this.foursToggle || !!(pad && pad.fours),
      turnAround: !!this.turnQueued,   // the pad's bottom button: Wally spins right round (wally.js)
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
export function easeBehind(yaw, facing, dt, rate = 3) {
  const want = facing + Math.PI, d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
  return yaw + d * Math.min(1, dt * rate);
}
