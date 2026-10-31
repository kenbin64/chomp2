// opening.js
// How the game begins (Ken's storyboard, 2026-10-20; MASTER.md, Croc Park):
//   0. intro   A cinematic: a slow circle round Croc Park, the "don't feed" sign, then
//              the camera settles on one ordinary croc: Wally. A few words, then play.
//   1. croc    The player is one of the ordinary crocs in Croc Park. Tourists mill
//              about; the sign says not to feed the crocodiles. The job: find the
//              sceptre on the bottom of the pond (how to dive is shown).
//   2. change  He touches it and, in a flash, is Wally (the Wally we all know: a
//              true-blue Aussie wildlife bloke), upright, beside the sign.
//   3. sign    He scratches NOT off "Do NOT feed the crocodile", so it reads "Do feed
//              the crocodile", then: "Crikey! I'm like a human bloke." The visitors notice.
//   4. kenny   Kenny comes up, calls him Wally (so he learns his name), and tells
//              him the rules: people food, keep your distance, the jar three times
//              a place, and the first job, the key to the park.
//   5. story   The back story, just enough for the basic quest (the rest is kept
//              for the end), then play.
// Played once a trip; return visits start as Wally. Any key or tap skips a scene.

import * as THREE from 'three';
import { isWater, terrainHeight } from './rules.js';
import { addSwimSway } from './swim.js';
import { ModelSkin } from './models.js';
import { showTip } from './tips.js';

const KENNY_LINES = [
  "G'day, Wally! I'm Kenny the Koala.",
  "You'll need people food now.",
  'People will throw you some...',
  "...but don't get so close you scare them away!",
  "Run out of puff, and I'll bring my jar.",
  'But only three times in each place!',
  'First, you need the key to the park.',
  "It's in the chest, on the bottom of the lagoon.",
  'Find what the visitors dropped down there, and it opens.',
  "And stay fed, or you'll run out of puff.",
];
const LINE_SECONDS = 2.7;

// The words over the cinematic (Ken: "something like that, in not so many words").
// The cinematic (Ken, 2026-10-20): one smooth pan spiralling down over the park to
// the sign, the sign held a couple of seconds, then a glide to behind Wally and the
// player has him. The words run over the start of play.
const SPIRAL = 10, HOLD = 2.5, GLIDE = 2.2, CAPTION_SECONDS = 4.5;   // long enough to read each line
const ease = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * u;
// The words as play begins (Ken, 2026-10-21): who and where Wally is, and the first thing to do.
const INTRO_LINES = [
  'This is Wally the crocodile, at Croc Park in Cairns, Australia, Far North Queensland.',
  'Find the sceptre at the bottom of the pond.',
  'Let the adventure begin!',
];

// Where the opening's things are: the sign (world.js), a start in the water out
// from it, and the sceptre on the bottom between there and the middle (away from
// the treasure chest in the middle of the lagoon).
function places(sign) {
  const s = sign.group.position;
  let start = null;
  for (let k = 0.1; k <= 1; k += 0.02) {
    const x = s.x * (1 - k), z = s.z * (1 - k);
    if (isWater(x, z)) { start = new THREE.Vector3(x * 0.8, 0, z * 0.8); break; }
  }
  start = start || new THREE.Vector3(-5, 0, 9);
  // The sceptre: out along the same line, where the water is deep (at least 1.5 m
  // down), but not within 4 m of the treasure chest in the middle.
  let sx = start.x * 0.5, sz = start.z * 0.5;
  for (let k = 0.55; k >= 0; k -= 0.02) {          // from half-way out: a swim to get there
    const x = start.x * k, z = start.z * k;
    if (Math.hypot(x, z) < 4) break;
    sx = x; sz = z;
    if (terrainHeight(x, z) < -1.5) break;
  }
  return {
    start,
    sceptre: new THREE.Vector3(sx, terrainHeight(sx, sz) + 0.15, sz),
    // In front of the sign's painted face (it faces away from the lagoon, toward the
    // path), a step to one side, so he can turn and scratch it.
    wally: (() => {
      const r = sign.group.rotation.y, fx = Math.sin(r), fz = Math.cos(r), x = s.x + fx * 1.7 + fz * 1.9, z = s.z + fz * 1.7 - fx * 1.9;
      return new THREE.Vector3(x, Math.max(0, terrainHeight(x, z)), z);
    })(),
    // Out in front of the sign, so Wally turns right round from the sign to meet him.
    kennyFrom: new THREE.Vector3(s.x + Math.sin(sign.group.rotation.y) * 10 + Math.cos(sign.group.rotation.y) * 3, 0,
                                 s.z + Math.cos(sign.group.rotation.y) * 10 - Math.sin(sign.group.rotation.y) * 3),
  };
}

// underWater(): whether he has dived (the park's dive state, main.js).
export function createOpening({ scene, models, wally, kenny, clusters, bubbles, fx, world, sound, toast, underWater }) {
  const where = places(world.sign);
  const flash = document.getElementById('flash'), story = document.getElementById('backstory');
  let phase = null, time = 0, line = -1, onDone = null, sway = null, captionAt = -1, turnFrom = null;

  // The ordinary croc he starts as: Ken's regular croc, swimming, in place of Wally's model.
  // Rigged (tools/blender-rig-croc.py), it swims with its Swim move: the legs laid
  // back along the body and the tail doing the work.
  const croc = new THREE.Group();
  let crocSkin = null;
  {
    const g = models.get('croc-regular');
    if (g && g.animations.length) {
      crocSkin = new ModelSkin(g, { length: 3.6 });                       // about 3.6 m, nose to tail
      crocSkin.root.position.y += 0.2;                                    // low in the water, eyes and back showing
      crocSkin.root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });   // a moving skin's bounds go stale: always drawn
      croc.add(crocSkin.root);
    } else if (g) {
      const m = g.scene.clone(true), box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
      m.scale.setScalar(3.6 / Math.max(size.x, size.z));
      m.position.y = -box.min.y * m.scale.y + 0.2;
      croc.add(m); sway = addSwimSway(m);
    }
  }

  // The sceptre on the bottom: glowing, with bubbles rising so it can be found.
  const sceptre = new THREE.Group();
  {
    const g = models.get('sceptre');
    const m = g ? g.scene.clone(true) : new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2), new THREE.MeshStandardMaterial({ color: 0xc8a040 }));
    if (g) { const b = new THREE.Box3().setFromObject(m); m.scale.setScalar(1.3 / b.getSize(new THREE.Vector3()).y); }
    const holder = new THREE.Group(); holder.add(m); holder.rotation.z = Math.PI / 2.3;   // lying on the bed, the head up a little
    sceptre.add(holder);
    const glow = new THREE.PointLight(0x9fe8c0, 6, 7); glow.position.y = 0.6; sceptre.add(glow);
    sceptre.position.copy(where.sceptre); sceptre.visible = false; scene.add(sceptre);
    sceptre.userData.glow = glow;
  }
  // A big gold arrow just above the water, pointing down at it (Ken, 2026-10-21: players must know how to
  // proceed right off the bat). It bobs, and goes once he has found it.
  const pointer = (() => {
    const g = new THREE.Group(), gold = new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false });
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 20), gold); head.rotation.x = Math.PI; head.position.y = 0.45;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 14), gold); shaft.position.y = 1.45;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 40), gold); ring.rotation.x = Math.PI / 2; ring.position.y = -0.95;
    g.add(head, shaft, ring); g.visible = false; g.userData.noAO = true;
    g.position.set(where.sceptre.x, 1.2, where.sceptre.z); scene.add(g);
    return g;
  })();
  // The sceptre on Wally's back once he has it (he carries it the whole trip).
  const carried = sceptre.children[0].children[0].clone(true);
  carried.visible = false; carried.rotation.set(0.3, 0, 0.55); carried.position.set(0.1, 1.15, -0.32);
  wally.root.add(carried);

  function skipScene() { if (phase === 'intro') enter('croc'); else if (phase === 'change' || phase === 'sign' || phase === 'kenny') time = 999; }
  // Skipping a scene is on purpose only (Ken, 2026-10-20: the spiral kept being cut
  // short): Space, Enter or Escape, or the Skip button. A click to bring the window
  // forward, or a stray key, no longer skips anything.
  addEventListener('keydown', e => { if (phase && phase !== 'croc' && phase !== 'story' && [' ', 'Enter', 'Escape'].includes(e.key) && !e.repeat) skipScene(); });
  const skipButton = document.getElementById('skip-scene');
  if (skipButton) skipButton.onclick = e => { e.stopPropagation(); skipScene(); };
  const showSkip = on => { if (skipButton) skipButton.hidden = !on; };

  function setModel(asCroc) {
    if (wally.skin) wally.skin.root.visible = !asCroc;
    if (asCroc) wally.root.add(croc); else wally.root.remove(croc);
    carried.visible = !asCroc;
  }

  const caption = document.getElementById('cine-caption');
  function say(text) {
    if (!caption) return;
    if (!text) { caption.classList.add('fade'); return; }
    caption.textContent = text; caption.hidden = false; caption.classList.remove('fade');
  }

  function enter(p) {
    phase = p; time = 0; pointer.visible = p === 'croc';
    showSkip(p === 'intro' || p === 'change' || p === 'sign' || p === 'kenny');
    if (p === 'intro') {
      setModel(true);
      wally.pos.copy(where.start); wally.root.position.copy(where.start);
      wally.facing = Math.atan2(-where.start.x, -where.start.z); wally.root.rotation.y = wally.facing;   // facing out over the pond
      sceptre.visible = true;
      world.sign.setScratched(false);
      kenny.mesh.visible = false;
      line = -1; captionAt = -1;
      clusters.showMarks(false);                               // just people in a park, for now
      for (const id of ['hud', 'touch']) { const e = document.getElementById(id); if (e) e.hidden = true; }
    }
    if (p === 'croc') {
      captionAt = 0; line = -1;
      document.getElementById('hud').hidden = false;
      if (matchMedia('(pointer: coarse)').matches) document.getElementById('touch').hidden = false;
      document.getElementById('quest-title').textContent = 'Find the sceptre at the bottom of the pond';
      document.getElementById('goals').innerHTML = '';
      if (!showTip('opening-dive', 'Find the sceptre at the bottom of the pond: follow the gold arrow. W A S D (or the stick) to swim; Shift (or Dive) to go under; Space (or Up) to come back up.')) toast('Find the sceptre at the bottom of the pond. Shift to dive', 'info');
    }
    if (p === 'change') {
      captionAt = -1; say(null);                               // the words stop if he finds it quickly
      if (flash) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
      sound.play.powerup(); fx.burst(sceptre.position.clone().add(new THREE.Vector3(0, 1, 0)), [0xffd84a, 0xfff6c0, 0x9fe8c0], 50);
    }
    if (p === 'sign') turnFrom = null;
    if (p === 'sign') bubbles.say(wally.root, 'Hang on. That sign needs fixing.', 3.4, 2.4);
    if (p === 'kenny') { kenny.mesh.visible = true; kenny.pos.copy(where.kennyFrom); line = -1; }
    if (p === 'story') {
      kenny.state = 'sit'; kenny.timer = 4;
      if (story) {
        story.hidden = false;
        story.querySelector('button').onclick = () => { story.hidden = true; finish(); };
      } else finish();
    }
  }

  function finish() {
    phase = null; showSkip(false); pointer.visible = false;
    clusters.showMarks(true);
    try { localStorage.setItem('chomp-opening-done', '1'); } catch { /* it plays again next time */ }
    if (onDone) onDone();
  }

  // Each frame while the opening runs. Returns true while the player steers (the croc).
  function step(dt, t) {
    time += dt;
    if (sway) sway.setPace(Math.min(1, Math.hypot(wally.vel.x, wally.vel.z) / 4));
    if (crocSkin && croc.parent) {
      // Swimming when he moves, faster strokes the faster he goes; drifting, a slow idle.
      const pace = Math.hypot(wally.vel.x, wally.vel.z);
      crocSkin.play(pace > 0.4 ? 'swim' : 'idle', { alternatives: ['swim'], speed: pace > 0.4 ? 0.6 + pace / 4 : 1 });
      crocSkin.update(dt);
    }
    sceptre.userData.glow.intensity = 5 + Math.sin(t * 3) * 2;
    if (phase === 'intro') {
      if (time >= SPIRAL + HOLD + GLIDE) enter('croc');
      return false;
    }
    if (phase === 'croc') {
      // The words, one at a time, while he swims.
      if (captionAt >= 0) {
        captionAt += dt;
        const n = Math.floor(captionAt / CAPTION_SECONDS);
        if (n !== line) { line = n; say(n < INTRO_LINES.length ? INTRO_LINES[n] : null); if (n >= INTRO_LINES.length) captionAt = -1; }
      }
      if (Math.random() < dt * 2) fx.splash(new THREE.Vector3(sceptre.position.x, -0.4, sceptre.position.z), 2);   // bubbles where it lies
      pointer.position.y = 1.2 + Math.sin(t * 3) * 0.25; pointer.rotation.y += dt * 1.5;   // bobbing over the spot
      const near = Math.hypot(wally.pos.x - sceptre.position.x, wally.pos.z - sceptre.position.z) < 1.8;
      if (near && underWater()) enter('change');
      else if (near && (time % 6) < dt) toast('Down under the water! Shift to dive', 'info');
      return true;
    }
    if (phase === 'change') {
      if (time > 0.35 && sceptre.visible) {
        sceptre.visible = false; setModel(false);
        wally.pos.copy(where.wally); wally.root.position.copy(where.wally); wally.vel.set(0, 0, 0);
        wally.facing = Math.atan2(world.sign.group.position.x - where.wally.x, world.sign.group.position.z - where.wally.z);
        wally.root.rotation.y = wally.facing; wally.cheer = 1.2;
      }
      if (time > 2.0) enter('sign');
      return false;
    }
    if (phase === 'sign') {
      if (time > 1.2 && time < 2.6 && Math.floor(time * 6) !== Math.floor((time - dt) * 6)) sound.play.land();   // scratch, scratch
      if (wally.skin && time > 1.2 && time - dt <= 1.2) wally.skin.overlay('grab', { speed: 0.8 });
      if (time > 2.6 && time - dt <= 2.6) {
        world.sign.setScratched(true); fx.burst(world.sign.group.position.clone().add(new THREE.Vector3(0, 2.6, 0)), [0xd6212b, 0xffe066], 16);
        bubbles.say(wally.root, "Crikey! I'm like a human bloke.", 3.4, 3.2);   // Ken: after the sign, the Crikey line
        turnFrom = wally.facing;
      }
      // Then he turns round, away from the sign, to where Kenny will come from (Ken).
      if (time > 3.2 && turnFrom !== null) {
        const toward = Math.atan2(where.kennyFrom.x - wally.pos.x, where.kennyFrom.z - wally.pos.z);
        const d = Math.atan2(Math.sin(toward - turnFrom), Math.cos(toward - turnFrom));
        wally.facing = turnFrom + d * ease((time - 3.2) / 1.0); wally.root.rotation.y = wally.facing;
      }
      if (time > 4.2 && time - dt <= 4.2) {
        const near = clusters.active.slice(0, 2);
        for (const c of near) if (c.people && c.people[0]) bubbles.say(c.people[0].g, ['Look! "Do feed the crocodile"!', 'Quick, throw him something!'][near.indexOf(c)], 2.4, 2.6);
      }
      if (time > 7) enter('kenny');
      return false;
    }
    if (phase === 'kenny') {
      // He walks up beside Wally, then says his piece, a line at a time.
      // At Wally's side, away from the sign, where the camera sees them both.
      const r = world.sign.group.rotation.y;
      const goal = wally.pos.clone().add(new THREE.Vector3(Math.cos(r) * 1.5 + Math.sin(r) * 0.3, 0, -Math.sin(r) * 1.5 + Math.cos(r) * 0.3));
      const d = kenny.pos.distanceTo(goal);
      if (d > 0.3) { kenny.pos.add(goal.clone().sub(kenny.pos).multiplyScalar(Math.min(1, dt * 2.2 / Math.max(d, 0.001)))); kenny.state = 'help'; }
      else kenny.state = 'sit';
      kenny.pos.y = Math.max(0, terrainHeight(kenny.pos.x, kenny.pos.z));
      kenny.mesh.position.copy(kenny.pos);
      kenny.mesh.rotation.y = Math.atan2(wally.pos.x - kenny.pos.x, wally.pos.z - kenny.pos.z);
      // Wally watches him come and turns to him.
      wally.facing = Math.atan2(kenny.pos.x - wally.pos.x, kenny.pos.z - wally.pos.z); wally.root.rotation.y = wally.facing;
      if (kenny.skin) { kenny.skin.play(d > 0.3 ? 'walk' : 'wave', { alternatives: ['idle'] }); kenny.skin.update(dt); }
      const talking = d <= 0.3 ? Math.floor((time - 2) / LINE_SECONDS) : -1;
      if (talking > line && talking < KENNY_LINES.length) { line = talking; bubbles.say(kenny.mesh, KENNY_LINES[line], 2.2, LINE_SECONDS); }
      if (time > 999 || talking >= KENNY_LINES.length) { kenny.pos.copy(goal); kenny.mesh.position.copy(goal); enter('story'); }
      return false;
    }
    return false;
  }

  // The camera for each scene: { yaw, pitch, dist } toward Wally, or null to leave it to the game.
  // Every shot is from in front of the sign's painted face (its facing is the sign's
  // turn), a little to one side, so the sign and Wally are both in view.
  function shot() {
    if (phase === 'croc' || !phase) return null;
    const front = world.sign.group.rotation.y;
    if (phase === 'intro') {
      // Worked out exactly for each moment (exact: the game sets the camera to it,
      // no chasing), so the motion is one smooth curve.
      const signAt = world.sign.group.position.clone().add(new THREE.Vector3(0, 2.4, 0));
      const signShot = { target: signAt, yaw: front + 0.12, pitch: 0.12, dist: 7 };
      if (time < SPIRAL) {
        // A spiral: a turn and a quarter round the park, coming down and in to the sign.
        const u = ease(time / SPIRAL), k = ease(Math.max(0, time / SPIRAL - 0.35) / 0.65);
        return { exact: true, target: new THREE.Vector3(0, 0, 0).lerp(signAt, k),
                 yaw: signShot.yaw - Math.PI * 2.5 * (1 - u), pitch: lerp(0.72, signShot.pitch, u), dist: lerp(62, signShot.dist, u) };
      }
      if (time < SPIRAL + HOLD) return { exact: true, ...signShot };
      // The glide from the sign to behind Wally, where play's camera takes over.
      const u = ease((time - SPIRAL - HOLD) / GLIDE);
      // High enough that the sign on the bank drops out under the picture.
      const behind = { target: wally.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), yaw: wally.facing + Math.PI, pitch: 0.66, dist: 10 };
      const dy = Math.atan2(Math.sin(behind.yaw - signShot.yaw), Math.cos(behind.yaw - signShot.yaw));
      return { exact: true, target: signAt.clone().lerp(behind.target, u), yaw: signShot.yaw + dy * u,
               pitch: lerp(signShot.pitch, behind.pitch, u), dist: lerp(signShot.dist, behind.dist, u) };
    }
    if (phase === 'change') return { yaw: front + 0.55, pitch: 0.22, dist: 7 };
    if (phase === 'sign') return { yaw: front + 0.25, pitch: 0.18, dist: 7.5 };
    return { yaw: front + 0.75, pitch: 0.25, dist: 7.5 };     // Kenny and the story
  }

  return {
    get active() { return !!phase; },
    get phase() { return phase; },
    get phaseTime() { return time; },
    get sceptreAt() { return sceptre.position; },              // for testing
    get croc() { return croc; },
    begin(done) { onDone = done; enter('intro'); },
    carry() { carried.visible = true; world.sign.setScratched(true); },   // a return visit: he has it, and the sign is scratched
    step, shot,
  };
}

// Does the opening play this time? On a new trip, before the park has been
// entered, unless it has been seen; ?opening forces it (for testing).
export function openingDue(trip, params) {
  if (params.has('opening')) return true;
  if (params.has('bot') || params.has('noopening')) return false;      // testing: straight to Wally
  let done = false; try { done = localStorage.getItem('chomp-opening-done') === '1'; } catch { /* not seen */ }
  return !done && !(trip && trip.entered.includes('park'));
}
// A new trip: the opening plays again.
export function resetOpening() { try { localStorage.removeItem('chomp-opening-done'); } catch { /* nothing kept */ } }
