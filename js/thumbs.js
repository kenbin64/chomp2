// thumbs.js
// Thumb controls for each activity on a phone (Ken, 2026-11-01): held sideways, and worked with the thumbs, as for texting.
// An activity lists its controls, then at each moment says which to show: only those are on the screen, and the walking
// controls go away. A thumb button is simply a key: pressing it sends that key, so the activity needs no touch code of its
// own. On a computer all of this does nothing.
//
//   const thumbs = createThumbs({
//     brake: { side: 'left', label: 'BRAKE', key: ' ' },
//     up: { side: 'right', label: '▲', key: 'ArrowUp', col: true },   // col: stacked, not side by side
//     move: { side: 'right', stick: true },                                // a fixed circle: its four ways are the arrow keys
//   });
//   thumbs.show(['move', 'brake']);   each frame if you like; it only acts on a change
//   thumbs.show([]);                  none of these, and still no walking controls
//   thumbs.hide();                    back to the walking controls

import { isTouchDevice } from './quality.js';

const STICK_R = 54, ON = 0.35;           // pixels for a full push; how far before a way counts as pressed
const send = (key, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, bubbles: true, cancelable: true }));

function button(c, el) {
  let id = null;
  el.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    if (id !== null) return;
    id = e.changedTouches[0].identifier; el.classList.add('on'); send(c.key, true);
  }, { passive: false });
  const up = e => { for (const t of e.changedTouches) if (t.identifier === id) release(); };
  const release = () => { if (id === null) return; id = null; el.classList.remove('on'); send(c.key, false); };
  addEventListener('touchend', up); addEventListener('touchcancel', up);
  return release;
}

function stick(el) {
  const knob = el.querySelector('i'), WAYS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }, held = new Set();
  let id = null, x0 = 0, y0 = 0;
  const set = (way, on) => { if (on === held.has(way)) return; if (on) held.add(way); else held.delete(way); send(WAYS[way], on); };
  const read = t => {
    let dx = (t.clientX - x0) / STICK_R, dy = (t.clientY - y0) / STICK_R; const d = Math.hypot(dx, dy);
    if (d > 1) { dx /= d; dy /= d; }
    knob.style.transform = `translate(${dx * STICK_R}px, ${dy * STICK_R}px)`;
    set('left', dx < -ON); set('right', dx > ON); set('up', dy < -ON); set('down', dy > ON);
  };
  const release = () => { if (id === null) return; id = null; knob.style.transform = ''; el.classList.remove('on'); for (const w of Object.keys(WAYS)) set(w, false); };
  el.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation();
    if (id !== null) return;
    const t = e.changedTouches[0], r = el.getBoundingClientRect();
    id = t.identifier; x0 = r.left + r.width / 2; y0 = r.top + r.height / 2; el.classList.add('on'); read(t);
  }, { passive: false });
  addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === id) { read(t); e.preventDefault(); } }, { passive: false });
  const up = e => { for (const t of e.changedTouches) if (t.identifier === id) release(); };
  addEventListener('touchend', up); addEventListener('touchcancel', up);
  return release;
}

export function createThumbs(controls) {
  if (!isTouchDevice()) return { show() {}, hide() {} };
  const box = document.createElement('div'); box.className = 'thumbs'; box.hidden = true;
  const sides = { left: document.createElement('div'), right: document.createElement('div') };
  sides.left.className = 'thumbs-side left'; sides.right.className = 'thumbs-side right';
  box.append(sides.left, sides.right); document.body.append(box);
  const made = {};
  for (const [name, c] of Object.entries(controls)) {
    const el = document.createElement(c.stick ? 'div' : 'button');
    if (c.stick) { el.className = 'thumb-stick'; el.innerHTML = '<i></i>'; }
    else { el.type = 'button'; el.className = 'thumb-btn'; el.textContent = c.label; if (c.small) el.classList.add('small'); }
    el.dataset.thumb = name; el.hidden = true; sides[c.side].append(el);
    made[name] = { el, c, release: c.stick ? stick(el) : button(c, el) };
  }
  let now = null;
  const show = names => {
    const key = names.join();
    if (key === now) return;
    now = key;
    for (const [name, m] of Object.entries(made)) { const on = names.includes(name); if (!on) m.release(); m.el.hidden = !on; }
    for (const side of ['left', 'right']) {
      const here = names.filter(n => made[n] && made[n].c.side === side);
      sides[side].classList.toggle('col', here.length > 1 && here.every(n => made[n].c.col));
    }
    box.hidden = false; document.body.classList.add('own-thumbs');
  };
  return {
    show,
    hide() { if (now === null) return; now = null; for (const m of Object.values(made)) { m.release(); m.el.hidden = true; } box.hidden = true; document.body.classList.remove('own-thumbs'); },
  };
}
