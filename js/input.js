// input.js
// Controls for both PC and phone, read the same way by the game:
//   forward, right   -1..1, relative to the camera
//   jump             true for one frame when pressed
//   fours            held: run on all fours
//   turn             camera turn from dragging this frame (radians); turnKeys -1..1 from Q / E
//   tilt, zoom       camera tilt from dragging, zoom from the wheel (metres)
//
// PC:    WASD or arrows to move, Space jump, Shift all fours,
//        drag the mouse or Q / E to turn the camera, wheel to zoom, C to swing it behind Wally.
// Phone: left thumb anywhere on the left half is a joystick, drag on the right
//        half turns the camera, buttons for Jump and Fours.

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
  }

  key(e, down) {
    // Typing in a box (the leaderboard name) is typing, not playing: leave those keys alone.
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (down && k === ' ' && !this.keys.has(' ')) this.jumpQueued = true;
    if (down && k === 'p' && this.onPause) this.onPause();
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

  // Read and clear this frame's input.
  read() {
    const k = this.keys;
    let f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    let r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    if (this.stick) { f = -this.stick.dy; r = this.stick.dx; }
    const turnKeys = (k.has('q') ? 1 : 0) - (k.has('e') ? 1 : 0);
    const out = {
      forward: f, right: r,
      // Keyboard steers Wally himself (up runs the way he faces, down turns him
      // round, left and right turn him); the phone stick points where to go.
      steer: !this.stick,
      jump: this.jumpQueued,
      fours: k.has('shift') || this.foursToggle,
      ctrl: k.has('control'),          // with Shift: come up from a dive (the reef and the sea)
      turn: this.turn, turnKeys, tilt: this.tilt, zoom: this.zoom, recenter: this.recenterQueued,
    };
    this.recenterQueued = false;
    this.jumpQueued = false; this.turn = 0; this.tilt = 0; this.zoom = 0;
    return out;
  }
}
