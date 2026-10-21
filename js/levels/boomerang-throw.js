// boomerang-throw.js
// The boomerang throw in Kuranda (Ken, 2026-10-20). About halfway down the street, a
// guide teaches Wally to throw a boomerang; catching it wins the air talisman.
//
//   1. The opening: Wally steps up to the mark and the guide shows him a throw. The
//      boomerang flies its loop and comes home to the guide's hand.
//   2. First person, through Wally's eyes. He lifts the boomerang and tips it out:
//      the ANGLE meter shows how far it leans from upright. Space or a click sets it.
//   3. The FORCE meter swings up and down; Space or a click throws, as hard as it shows.
//   4. The flight is the physics (boomerang-physics.js): it comes back, or it doesn't.
//      As it comes in, Space or a click catches it. A miss: the guide says why, and
//      he has another go, as many as he needs.
//   5. The first catch: the guide gives him the air talisman. Back to the street.
//
// Controls: Up / Down (W / S, the mouse, or the left stick) tilt it; Space, Enter, a
// click or the A button sets, throws and catches. The opening skips with the Skip
// button, Enter or Escape.
//
//   const station = boomerangThrow({ scene, camera, wally, sound, models, onTalisman, onDone });
//   station.begin(hasTalisman)   start it (the opening first)
//   station.update(dt)           every frame while station.active (it has the camera)

import * as THREE from 'three';
import { fly, outcome, catchableAt, sampleAt, HAND_Y, TILT_RANGE, IDEAL_TILT, IDEAL_FORCE } from './boomerang-physics.js';
import { THROW_SPOT, GUIDE_SPOT, GUIDE_FROM, THROWERS } from './kuranda-rules.js';
import { ModelSkin } from '../models.js';
import { boomerangMesh } from './boomerang-shape.js';

const EYE = 1.75;                     // Wally's eyes, above the ground
const SWING = 1.7;                    // seconds for the force meter to swing up and back
const GUIDE = 'Instructor';
const WALK_UP = 3.2;                  // seconds for the instructor to walk up to Wally

// The instructor: an Aboriginal Australian man, a Djabugay local (Ken: culturally
// correct). His portrayal is to be checked with the community, MASTER.md. Plain and
// warm words, no put-on accent.
const OPENING = [
  { who: null, text: '', t: 4.8, wide: true },                    // the clearing, visitors throwing
  { who: GUIDE, text: "G'day, Wally. Welcome to Djabugay country. I teach the boomerang here. Want to learn?", t: 4.4, walk: true },
  { who: 'Wally', text: "Too right! I've always wanted a go.", t: 2.4 },
  { who: GUIDE, text: 'Watch first. Hold it near upright, tipped out a little. Throw it firm, and let it spin.', t: 3.8, demo: true },
  { who: GUIDE, text: 'See how it comes round? It does the work. You just wait for it.', t: 3.4 },
  { who: GUIDE, text: 'Clap your hands on it, one above, one below. Your turn.', t: 3.2 },
];
const TIPS = {
  short: 'It came down before it got back. Throw it a bit harder, or tip it out a little more.',
  over: 'Too much! It climbed right over you. Ease off a bit, or hold it more upright.',
  away: 'It wandered off. Tip it out a little and throw it firm.',
  missed: 'It came right to you! Clap your hands on it as it comes in.',
};

// ---- The page: the meters, the words, the prompts ----------------------------------------------
function buildUi() {
  const ui = document.createElement('div'); ui.className = 'boom-ui'; ui.hidden = true;
  ui.innerHTML = `
    <div class="boom-meters">
      <div class="boom-angle"><svg viewBox="-60 -60 120 70"><path class="boom-arc" d="M -50 0 A 50 50 0 0 1 50 0"/><path class="boom-hint"/><line class="boom-needle" x1="0" y1="0" x2="0" y2="-46"/></svg>
        <p>Angle <b class="boom-angle-num">0°</b></p></div>
      <div class="boom-force"><div class="boom-force-bar"><i class="boom-force-zone"></i><i class="boom-force-fill"></i></div><p>Force</p></div>
    </div>
    <p class="boom-prompt"></p>
    <div class="boom-catch" hidden>Catch!</div>
    <p class="boom-caption" hidden><b></b> <span></span></p>`;
  document.body.append(ui);
  const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'skip-scene'; skip.hidden = true;
  skip.innerHTML = 'Skip &#9654;&#9654; <small>Enter</small>'; document.body.append(skip);
  const q = s => ui.querySelector(s);
  return { ui, skip, needle: q('.boom-needle'), hint: q('.boom-hint'), angleNum: q('.boom-angle-num'), angle: q('.boom-angle'), force: q('.boom-force'),
    fill: q('.boom-force-fill'), zone: q('.boom-force-zone'), prompt: q('.boom-prompt'), catchRing: q('.boom-catch'), caption: q('.boom-caption') };
}

// The angle meter's hint: an arc round the tilt the guide suggests.
function hintArc(deg) {
  const p = a => { const r = (a - 90) * Math.PI / 180; return `${(Math.cos(r) * 50).toFixed(1)} ${(Math.sin(r) * 50).toFixed(1)}`; };
  return `M ${p(deg - 6)} A 50 50 0 0 1 ${p(deg + 6)}`;
}

// For a tilt, the forces that bring it back (from the physics, by trying them): the
// green zone on the force meter while he is learning. Derived, not stored.
function returningForces(tilt) {
  const spot = { x: THROW_SPOT.x, y: HAND_Y, z: THROW_SPOT.z };
  const ok = [];
  for (let f = 0; f <= 1.0001; f += 0.025) if (outcome(fly(spot, THROW_SPOT.aim, tilt, f), spot).kind === 'back') ok.push(f);
  return ok.length ? [ok[0], ok[ok.length - 1]] : null;
}

export function boomerangThrow({ scene, camera, wally, sound, models = new Map(), people = [], onTalisman = () => {}, onDone = () => {} }) {
  const ui = buildUi();
  const held = boomerangMesh(), flying = boomerangMesh();
  const spinner = new THREE.Group(); spinner.add(flying);
  const flyer = new THREE.Group(); flyer.add(spinner); flyer.visible = false; scene.add(flyer);
  held.visible = false; held.scale.setScalar(0.7);                  // in his hand, not filling the view
  flyer.scale.setScalar(1.3);                                      // a touch large in the air, so it reads at a distance
  if (!camera.parent) scene.add(camera);                          // so the held boomerang, a child of the camera, is drawn
  camera.add(held);
  // The instructor, from Ken's model when it is made (no stand-in: he is a Djabugay man).
  const guideGltf = models.get('guide-djabugay');
  const guide = guideGltf ? standing(scene, new ModelSkin(guideGltf, { height: 1.78 })) : null;
  if (guide) { guide.root.position.set(GUIDE_SPOT.x, 0, GUIDE_SPOT.z); faceToward(guide.root, THROW_SPOT.x, THROW_SPOT.z); }
  const throwers = makeThrowers(scene, people);
  const talisman = makeTalisman(models); scene.add(talisman);

  const s = { active: false, phase: 'off', t: 0, line: 0, tilt: 0, force: 0, swingT: 0, path: null, at: 0, result: null, throws: 0,
    has: false, caught: false, look: new THREE.Vector3(), keys: new Set(), pressed: false, padWas: false, demoPath: null };
  const spot = () => ({ x: THROW_SPOT.x, y: HAND_Y, z: THROW_SPOT.z });
  const eye = new THREE.Vector3(THROW_SPOT.x, EYE, THROW_SPOT.z);
  const ahead = new THREE.Vector3(THROW_SPOT.x + Math.sin(THROW_SPOT.aim) * 10, EYE, THROW_SPOT.z - Math.cos(THROW_SPOT.aim) * 10);

  // ---- Input: Space / Enter / click / A, and tilt from keys, mouse or stick ------------------
  addEventListener('keydown', e => {
    if (!s.active) return;
    s.keys.add(e.key);
    if (['Enter', 'Escape'].includes(e.key) && s.phase === 'opening') { skipOpening(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if ([' ', 'Enter'].includes(e.key) && !e.repeat) { s.pressed = true; e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  addEventListener('keyup', e => s.keys.delete(e.key));
  addEventListener('pointerdown', e => { if (s.active && e.button === 0 && !e.target.closest('button')) s.pressed = true; });
  addEventListener('mousemove', e => { if (s.active && s.phase === 'tilt' && document.pointerLockElement) s.tilt = clampTilt(s.tilt + e.movementY * 0.12); });
  ui.skip.onclick = e => { e.stopPropagation(); skipOpening(); };
  const clampTilt = v => Math.min(TILT_RANGE[1], Math.max(TILT_RANGE[0], v));
  function pad() {
    const p = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (!p) return { y: 0, a: false };
    return { y: Math.abs(p.axes[1]) > 0.15 ? p.axes[1] : 0, a: !!(p.buttons[0] && p.buttons[0].pressed) };
  }
  function takePress() {
    const g = pad(), a = g.a && !s.padWas; s.padWas = g.a;
    const was = s.pressed || a; s.pressed = false; return was;
  }

  // ---- Words --------------------------------------------------------------------------------
  function say(who, text) {
    ui.caption.hidden = !text; if (!text) return;
    ui.caption.querySelector('b').textContent = `${who}:`; ui.caption.querySelector('span').textContent = text;
  }
  const prompt = text => { ui.prompt.textContent = text || ''; };

  // ---- The phases ---------------------------------------------------------------------------
  function enter(phase) {
    s.phase = phase; s.t = 0;
    ui.angle.hidden = !['tilt', 'force'].includes(phase); ui.force.hidden = phase !== 'force';
    ui.catchRing.hidden = true; ui.skip.hidden = phase !== 'opening';
    held.visible = ['tilt', 'force'].includes(phase);
    wally.root.visible = phase === 'opening';                     // first person: his own head would be in the way
    if (phase === 'tilt') { s.tilt = Math.max(4, s.tilt); prompt('Tip it out: Up / Down, the mouse or the stick. Space or click to set the angle.'); say(GUIDE, s.throws ? '' : 'Lift it up. Near upright, tipped out a little.'); }
    if (phase === 'force') { s.swingT = 0; const z = s.throws < 2 ? returningForces(s.tilt) : null; ui.zone.hidden = !z; if (z) { ui.zone.style.bottom = `${z[0] * 100}%`; ui.zone.style.height = `${Math.max(3, (z[1] - z[0]) * 100)}%`; } prompt('Space or click to throw, as hard as the meter shows.'); say('', ''); }
    if (phase === 'flight') { prompt(''); }
    if (phase === 'gift') { prompt(''); }
  }

  function begin(hasTalisman) {
    s.active = true; s.has = !!hasTalisman; s.throws = 0; s.line = 0; s.caught = false;
    ui.ui.hidden = false;
    wally.pos.set(THROW_SPOT.x, 0, THROW_SPOT.z); wally.root.position.copy(wally.pos); wally.facing = Math.PI - THROW_SPOT.aim; wally.vel.set(0, 0, 0);
    if (guide) { guide.root.position.set(GUIDE_SPOT.x, 0, GUIDE_SPOT.z); faceToward(guide.root, THROW_SPOT.x, THROW_SPOT.z); }
    s.demoPath = fly({ x: GUIDE_SPOT.x, y: HAND_Y, z: GUIDE_SPOT.z }, THROW_SPOT.aim, IDEAL_TILT, IDEAL_FORCE);
    if (s.has) { enter('tilt'); say(GUIDE, 'Back for another go? Go on then.'); return; }
    if (guide) { guide.root.position.set(GUIDE_FROM.x, 0, GUIDE_FROM.z); faceToward(guide.root, THROW_SPOT.x, THROW_SPOT.z); }   // across the clearing, to walk up
    throwers.soon();                                               // the visitors throw in the wide shot
    enter('opening'); say(OPENING[0].who, OPENING[0].text);
  }
  function skipOpening() {
    if (s.phase !== 'opening') return;
    flyer.visible = false; s.pressed = false;                       // the skip press is not also a throw
    if (guide) { guide.root.position.set(GUIDE_SPOT.x, 0, GUIDE_SPOT.z); faceToward(guide.root, THROW_SPOT.x, THROW_SPOT.z); }
    enter('tilt');
  }
  function finish() {
    s.active = false; s.phase = 'off'; ui.ui.hidden = true; ui.skip.hidden = true; held.visible = false; flyer.visible = false; talisman.visible = false;
    wally.root.visible = true;
    onDone(s.caught);
  }

  // The opening: the camera beside Wally, the guide's lines, the guide's throw.
  function updateOpening(dt) {
    s.t += dt;
    const L = OPENING[s.line];
    if (L.wide) {                                                   // a cut to the clearing from over the archway, easing in
      const u = Math.min(1, s.t / L.t), e = u * u * (3 - 2 * u);
      camera.position.set(6.5 + e * 6, 8 - e * 4.6, 111.5 - e * 2);    // from just inside the archway (clear of its beam) in toward the visitors
      s.look.set(21, 1.3, 107); camera.lookAt(s.look);
    } else if (L.walk && guide) {                                   // the instructor walks up to Wally
      const u = Math.min(1, s.t / WALK_UP);
      guide.root.position.set(GUIDE_FROM.x + (GUIDE_SPOT.x - GUIDE_FROM.x) * u, 0, GUIDE_FROM.z + (GUIDE_SPOT.z - GUIDE_FROM.z) * u);
      faceToward(guide.root, u < 1 ? GUIDE_SPOT.x : THROW_SPOT.x, u < 1 ? GUIDE_SPOT.z : THROW_SPOT.z);
      guide.play(u < 1 ? 'walk' : 'wave', { alternatives: ['idle'] });
      s.look.lerp(new THREE.Vector3(guide.root.position.x, 1.5, guide.root.position.z), Math.min(1, dt * 3));
    }
    if (L.demo && guide && s.t < dt * 1.5) guide.play('throw', { once: true, fit: 0.6, alternatives: ['idle'] });
    if (L.demo) {
      const p = sampleAt(s.demoPath, Math.max(0, s.t - 0.6));
      flyer.visible = s.t > 0.6 && s.t - 0.6 < s.demoPath[s.demoPath.length - 1].t;
      placeFlyer(s.demoPath, Math.max(0, s.t - 0.6), dt);
      s.look.lerp(new THREE.Vector3(p.x, p.y, p.z), Math.min(1, dt * 3));
    } else if (!L.wide && !(L.walk && guide)) s.look.lerp(new THREE.Vector3(GUIDE_SPOT.x, 1.5, GUIDE_SPOT.z), Math.min(1, dt * 2));
    if (!L.wide) {
      // Behind and to the left of Wally, so both he and the instructor are in the shot, and the clearing beyond.
      camera.position.lerp(new THREE.Vector3(THROW_SPOT.x - 4.5, 2.6, THROW_SPOT.z + 3.5), Math.min(1, dt * (s.line === 1 && s.t < 0.1 ? 60 : 2)));
      camera.lookAt(s.look);
    }
    const long = L.demo ? Math.max(L.t, s.demoPath[s.demoPath.length - 1].t + 0.8) : L.t;
    if (s.t >= long) {
      s.line++; s.t = 0; flyer.visible = false;
      if (s.line >= OPENING.length) { enter('tilt'); return; }
      say(OPENING[s.line].who, OPENING[s.line].text);
    }
  }

  // First person: from Wally's eyes, looking out over the clearing.
  function firstPerson(dt, lookAt = ahead) {
    camera.position.lerp(eye, Math.min(1, dt * 4));
    s.look.lerp(lookAt, Math.min(1, dt * 4));
    camera.lookAt(s.look);
  }
  // The held boomerang, in front of him: upright, tipped out to the right by the tilt.
  function poseHeld(lift) {
    held.position.set(0.24, -0.34 + lift * 0.14, -0.9);
    // Tipped first (about the line of sight: the top leans out to the right), then turned
    // on its own upright so its shape reads rather than edge-on, then stood up in his
    // hand: held by one wing, the other pointing up.
    held.rotation.set(0, 0, 0); held.rotateZ(-s.tilt * Math.PI / 180); held.rotateY(-Math.PI / 2 + 0.9); held.rotateZ(1.25);
  }

  function updateTilt(dt) {
    firstPerson(dt);
    const g = pad();
    const dir = (s.keys.has('ArrowUp') || s.keys.has('w') || s.keys.has('W') ? 1 : 0) - (s.keys.has('ArrowDown') || s.keys.has('s') || s.keys.has('S') ? 1 : 0);
    s.tilt = clampTilt(s.tilt + (dir * 22 - g.y * 30) * dt);
    s.t += dt; poseHeld(Math.min(1, s.t * 2));
    drawAngle(s.throws < 2);
    if (takePress()) enter('force');
  }
  function updateForce(dt) {
    firstPerson(dt);
    s.swingT += dt; s.force = 0.5 - 0.5 * Math.cos(s.swingT * Math.PI * 2 / SWING);   // up and back down, until he lets go
    ui.fill.style.height = `${Math.round(s.force * 100)}%`;
    poseHeld(1 + s.force * 0.3); held.position.z = -0.85 + s.force * 0.25;       // drawn back for the throw
    drawAngle(false);
    if (takePress()) release();
  }
  function release() {
    s.path = fly(spot(), THROW_SPOT.aim, s.tilt, s.force); s.result = outcome(s.path, spot()); s.at = 0; s.throws++;
    flyer.visible = true; held.visible = false; sound.play.leap();
    say('', ''); enter('flight');
  }
  function updateFlight(dt) {
    // As a good throw comes in, time slows a little, so there is a moment to catch it.
    const now = sampleAt(s.path, Math.min(s.at, s.path[s.path.length - 1].t));
    const near = Math.hypot(now.x - THROW_SPOT.x, now.y - HAND_Y, now.z - THROW_SPOT.z);
    s.at += dt * (s.result.kind === 'back' && near < 5 ? 0.4 : 1);
    const last = s.path[s.path.length - 1];
    placeFlyer(s.path, Math.min(s.at, last.t), dt);
    const p = sampleAt(s.path, Math.min(s.at, last.t));
    firstPerson(dt, new THREE.Vector3(p.x, p.y, p.z));               // his eyes follow it round
    const i = Math.round(Math.min(s.at, last.t) / (s.path[1].t - s.path[0].t));
    const can = s.result.kind === 'back' && catchableAt(s.path, i, spot());
    ui.catchRing.hidden = !can;
    if (takePress()) {
      if (can) return caught();
      if (s.at < (s.path[s.result.at] || last).t - 0.5) prompt('Not yet! Wait till it comes back round.');
    }
    const pastHim = s.result.kind === 'back' && s.at > s.path[s.result.at].t + 0.35;
    if (pastHim || s.at > last.t + 0.8) missed(pastHim ? 'missed' : s.result.kind);
  }
  function caught() {
    flyer.visible = false; held.visible = true; poseHeld(1); ui.catchRing.hidden = true;
    sound.play.powerup();
    if (s.has || s.caught) { say(GUIDE, 'Beautiful. You have the knack now.'); s.caught = true; enter('done'); return; }
    s.caught = true; say(GUIDE, "That's it! You've got it."); enter('gift');
  }
  function missed(kind) {
    flyer.visible = false; ui.catchRing.hidden = true; sound.play.plop();
    say(GUIDE, TIPS[kind] || TIPS.away); enter('tilt');
  }
  // The gift: the guide hands him the air talisman.
  function updateGift(dt) {
    s.t += dt; firstPerson(dt);
    if (s.t > 1.6 && !talisman.visible) { talisman.visible = true; say(GUIDE, 'This is for you. The air talisman. The wind brought your boomerang home.'); onTalisman(); held.visible = false; }
    if (talisman.visible) { talisman.position.copy(camera.position).add(new THREE.Vector3(0, -0.1, 0).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.4))); talisman.rotation.y += dt * 1.5; }
    if (s.t > 5.6) { say('Wally', 'Crikey! The air talisman! One more for the sceptre!'); enter('done'); }
  }
  function updateDone(dt) {
    s.t += dt; firstPerson(dt);
    if (talisman.visible) talisman.rotation.y += dt * 1.5;
    prompt(s.t > 1.2 ? 'Space or click to go on' : '');
    if (s.t > 1.2 && takePress()) finish();
  }

  // The boomerang in flight: its plane leaning by the tilt, turned to its heading, spinning.
  const placeFlyer = (path, t, dt) => poseFlight(flyer, spinner, path, t, dt);
  function drawAngle(hint) {
    ui.needle.setAttribute('transform', `rotate(${s.tilt.toFixed(1)})`);
    ui.angleNum.textContent = `${Math.round(s.tilt)}°`;
    ui.hint.setAttribute('d', hint ? hintArc(IDEAL_TILT) : '');
  }

  return {
    get active() { return s.active; },
    get phase() { return s.phase; },
    begin,
    // Every frame, the station or not: the visitors throw while nobody is at the mark, and
    // stop to watch while Wally has his turn.
    update(dt) {
      throwers.update(dt, !s.active || s.phase === 'opening');
      if (guide) { if (!s.active) guide.play('idle'); guide.update(dt); }
      if (!s.active) return;
      if (s.phase === 'opening') updateOpening(dt);
      else if (s.phase === 'tilt') updateTilt(dt);
      else if (s.phase === 'force') updateForce(dt);
      else if (s.phase === 'flight') updateFlight(dt);
      else if (s.phase === 'gift') updateGift(dt);
      else if (s.phase === 'done') updateDone(dt);
    },
    // For testing: throw with a given tilt and force.
    testThrow(tilt, force) { s.tilt = tilt; s.force = force; release(); return s.result; },
    testCatch() { s.pressed = true; },
    get debug() { return { phase: s.phase, at: s.at, closestAt: s.path && s.result ? s.path[s.result.at].t : null, kind: s.result && s.result.kind, ring: !ui.catchRing.hidden }; },
  };
}

// The boomerang in flight: its plane leaning by the tilt, turned to its heading, spinning.
function poseFlight(group, spinner, path, t, dt) {
  const a = sampleAt(path, t), b = sampleAt(path, t + 0.05);
  group.position.set(a.x, a.y, a.z);
  const heading = Math.atan2(b.x - a.x, -(b.z - a.z));              // 0 = -z, toward +x
  // Its flat faces (local z) point to the left of its heading; then it leans by the tilt,
  // rolling about its flight line (local x), so the faces point left and up, as the lift does.
  group.rotation.set(0, -heading - Math.PI / 2, 0); group.rotateX(-a.tilt * Math.PI / 180);
  spinner.rotation.z += dt * 30;
}

// A person in a holder: fitting a model to its height lifts its own root so its feet are
// on the ground, so it is the holder that is placed and turned. Returns the skin, with
// root swapped for the holder (its animation still plays on the model inside).
function standing(scene, skin) {
  const holder = new THREE.Group(); holder.add(skin.root); scene.add(holder);
  return { play: (...a) => skin.play(...a), update: dt => skin.update(dt), root: holder };
}

// A model turned to face a point on the ground (models face +z).
function faceToward(root, x, z) { root.rotation.y = Math.atan2(x - root.position.x, z - root.position.z); }

// The visitors learning at the far side of the clearing (Ken: other people throwing
// boomerangs), from the game's cast: each throws (the throw animation), the boomerang
// flies its loop by the same physics and comes back, and they throw again.
function makeThrowers(scene, people) {
  const list = THROWERS.slice(0, people.length).map((w, i) => {
    const gltf = people[people.length - 1 - i];                   // from the end of the cast, away from the first street groups
    const tall = gltf.userData && gltf.userData.tall, h = Array.isArray(tall) ? (tall[0] + tall[1]) / 2 : 1.72;
    const skin = standing(scene, new ModelSkin(gltf, { height: h }));
    skin.root.position.set(w.x, 0, w.z);
    skin.root.rotation.y = Math.PI - w.aim;                         // facing the way they throw
    const spinner = new THREE.Group(); spinner.add(boomerangMesh());
    const flight = new THREE.Group(); flight.add(spinner); flight.visible = false; scene.add(flight);
    const from = { x: w.x + Math.cos(w.aim) * 0.35, y: HAND_Y, z: w.z + Math.sin(w.aim) * 0.35 };
    const path = fly(from, w.aim, IDEAL_TILT, IDEAL_FORCE), back = path[outcome(path, from).at].t;
    return { skin, spinner, flight, path, back, t: -1.5 - i * 2.5 };
  });
  return {
    soon() { list.forEach((w, i) => { if (w.t < 0 || w.t > w.back) w.t = -0.4 - i * 1.6; }); },
    update(dt, throwing) {
      for (const w of list) {
        if (throwing || (w.t >= 0 && w.t < w.back)) w.t += dt;      // a boomerang in the air always finishes its loop
        if (w.t >= 0 && w.t < 0.1) w.skin.play('throw', { once: true, fit: 0.6, alternatives: ['idle'] });
        const flying = w.t > 0.35 && w.t < w.back;
        w.flight.visible = flying;
        if (flying) poseFlight(w.flight, w.spinner, w.path, w.t - 0.35, dt);
        else if (w.t >= w.back) {                                   // caught: a moment, then the next throw
          w.skin.play(throwing && w.t < w.back + 1.2 ? 'cheer' : 'idle', { alternatives: ['idle'] });   // while Wally throws, they just watch
          if (w.t > w.back + 3) w.t = -1;
        } else if (w.t < 0) w.skin.play('idle');
        w.skin.update(dt);
      }
    },
  };
}

// The air talisman: Ken's model when it is made; until then a pale, glowing swirl of air.
function makeTalisman(models) {
  const m = models.get('talisman-air');
  let t;
  if (m) { t = m.scene.clone(true); const box = new THREE.Box3().setFromObject(t), size = box.getSize(new THREE.Vector3()).length() || 1; t.scale.setScalar(0.45 / size); }
  else {
    t = new THREE.Group();
    const glow = new THREE.MeshStandardMaterial({ color: 0xd8f1ff, emissive: 0x9fd8ff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3 });
    t.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 10, 40), new THREE.MeshStandardMaterial({ color: 0xb08a4a, metalness: 0.85, roughness: 0.3 })));
    for (let i = 0; i < 3; i++) { const sw = new THREE.Mesh(new THREE.TorusGeometry(0.06 + i * 0.03, 0.008, 6, 30, Math.PI * 1.4), glow); sw.rotation.z = i * 2.1; t.add(sw); }
  }
  t.visible = false;
  t.traverse(o => { if (o.isMesh) o.userData.noAO = true; });
  return t;
}
