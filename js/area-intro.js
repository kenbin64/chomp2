// area-intro.js
// The first time Wally enters an area (Ken, 2026-10-20): a short cinematic fly-over
// that shows the place, with its name, and lands behind Wally where play begins. While
// it plays, the frame-rate watcher runs its stricter check (quality.js tick.focus), so
// the detail level is set right for this machine before the player takes control.
//
//   const intro = areaIntro({ id, name, place, shots: () => [{ pos, look }, ...], focus: on => fpsWatch.focus(on) });
//   intro.due()                 true the first time in this area (this trip)
//   intro.play(camera, done)    starts it; done() when it ends or is skipped
//   intro.update(dt, camera)    every frame, AFTER the level's own followCamera: while
//                               the intro plays it takes the camera over
//
// shots are camera keyframes in world positions, flown through as one smooth curve.
// The curve's last point is wherever the level's play camera is that frame, so the
// fly-over lands exactly on it and play carries on with no jump. Space, Enter, Escape
// or the Skip button skips it. Tested in the browser (it is all camera and page).

import * as THREE from 'three';

const ease = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
const v3 = p => new THREE.Vector3(p.x, p.y, p.z);

export function areaIntro({ id, name, place = '', seconds = 9, shots, focus = null }) {
  let active = false, time = 0, began = 0, done = null, path = null, lookPath = null;
  const key = `chomp-intro-${id}`;
  const playPos = new THREE.Vector3(), playLook = new THREE.Vector3(), ahead = new THREE.Vector3();

  // The letterboxed title over the fly-over, and a Skip button; added to the page once.
  let card = document.querySelector('.area-intro');
  if (!card) {
    card = document.createElement('div'); card.className = 'area-intro'; card.hidden = true;
    card.innerHTML = '<p class="area-intro-eyebrow">Welcome to</p><h2></h2><p class="area-intro-place"></p>';
    document.body.append(card);
  }
  let skip = document.querySelector('.area-intro-skip');
  if (!skip) {
    skip = document.createElement('button'); skip.type = 'button'; skip.className = 'skip-scene area-intro-skip'; skip.hidden = true;
    skip.innerHTML = 'Skip &#9654;&#9654; <small>Space</small>'; document.body.append(skip);
  }

  function finish() {
    if (!active) return;
    active = false; card.hidden = true; skip.hidden = true;
    if (focus) focus(false);
    try { localStorage.setItem(key, '1'); } catch { /* it plays again next time */ }
    if (done) done();
  }
  addEventListener('keydown', e => {
    if (!active || e.repeat || ![' ', 'Enter', 'Escape'].includes(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation(); finish();
  }, true);
  skip.onclick = e => { e.stopPropagation(); finish(); };

  return {
    get active() { return active; },
    // The first time here. ?intro forces it; ?nointro, ?bot and ?play (the test
    // scripts' quick start) leave it out.
    due() {
      const q = new URLSearchParams(location.search);
      if (q.has('intro')) return true;
      if (q.has('nointro') || q.has('bot') || q.has('play')) return false;
      try { return !localStorage.getItem(key); } catch { return true; }
    },
    play(camera, onDone) {
      done = onDone; active = true; time = 0; began = 0;
      const list = shots();
      // The last point of each curve is the play camera; update() moves it every frame.
      path = new THREE.CatmullRomCurve3([...list.map(s => v3(s.pos)), camera.position.clone()], false, 'centripetal');
      lookPath = new THREE.CatmullRomCurve3([...list.map(s => v3(s.look)), camera.position.clone()], false, 'centripetal');
      card.querySelector('h2').textContent = name;
      card.querySelector('.area-intro-place').textContent = place;
      card.classList.remove('fade'); card.hidden = false; skip.hidden = false;
      if (focus) focus(true);
    },
    update(dt, camera) {
      if (!active) return;
      // By the clock, not the game's frame step (capped at 0.05 s), so a slow machine still
      // gets nine seconds; but a stall (shaders compiling on the first frames) counts at most
      // a quarter second, so it cannot use up the fly-over before it is seen.
      const now = performance.now();
      time += began ? Math.min(0.25, (now - began) / 1000) : 0;
      began = now;
      // Where the play camera is this frame, and a point it is looking at.
      playPos.copy(camera.position);
      camera.getWorldDirection(ahead); playLook.copy(playPos).addScaledVector(ahead, 6);
      path.points[path.points.length - 1].copy(playPos);
      lookPath.points[lookPath.points.length - 1].copy(playLook);
      const u = ease(time / seconds);
      camera.position.copy(path.getPoint(u));
      camera.lookAt(lookPath.getPoint(u));
      if (time > seconds * 0.72) card.classList.add('fade');         // the title goes before the camera lands
      if (time >= seconds) finish();
    },
  };
}

// Shots that fly back along a course: from high over its far end, looking back toward
// the start, down along it to Wally. from and to are { x, z } on the ground; side
// moves the camera off the line to one side so the course is seen at an angle. y is
// the ground's height: a number, or a function (x, z) for a course that runs downhill.
export function courseShots({ from, to, y = 0, height = 40, side = 18, steps = 3 }) {
  const shots = [];
  for (let k = 0; k <= steps; k++) {
    const f = k / steps, x = from.x + (to.x - from.x) * f, z = from.z + (to.z - from.z) * f;
    const g = Math.min(1, f + 0.35), lx = from.x + (to.x - from.x) * g, lz = from.z + (to.z - from.z) * g;
    const ground = (gx, gz) => (typeof y === 'function' ? y(gx, gz) : y);
    shots.push({ pos: { x: x + side * (1 - f * 0.6), y: ground(x, z) + height * (1 - f * 0.55), z }, look: { x: lx, y: ground(lx, lz), z: lz } });
  }
  return shots;
}

// Shots that circle a place from high up, coming down as they go round.
// a0 and a1 in radians; the camera looks at the centre throughout.
export function orbitShots({ centre, radius, height = 40, low = 18, a0 = 0, a1 = Math.PI, steps = 4 }) {
  const shots = [];
  for (let k = 0; k <= steps; k++) {
    const f = k / steps, a = a0 + (a1 - a0) * f;
    shots.push({
      pos: { x: centre.x + Math.sin(a) * radius, y: (centre.y || 0) + height + (low - height) * f, z: centre.z + Math.cos(a) * radius },
      look: { x: centre.x, y: centre.y || 0, z: centre.z },
    });
  }
  return shots;
}

// Every area's intro plays again on a brand-new trip (mapmodal.js newTrip).
export function resetAreaIntros() {
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('chomp-intro-')) localStorage.removeItem(k); } catch { /* nothing kept */ }
}
