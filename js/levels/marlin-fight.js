// marlin-fight.js
// Out on the charter boat after a black marlin (Ken, 2026-10-31), through Wally's eyes, with his snout and his rod. The
// rules and the physics are in marlin-rules.js; this draws them and takes the controls.
//   Aim: Up / Down set the angle of the cast; Space or a click sets it.
//   Force: the meter swings; Space or a click casts, as hard as it shows.
//   Flight: the lure flies. Too short and it is in the boat's wake: cast again.
//   Troll: the boat moves on and the gauge shows the lure working, nibbles, then a bite: strike on the bite.
//   Fight: Up (or the left mouse button, or REEL) winds in; Down (or the right button, or RELEASE) lets line run; Left and
//   Right swing the rod. Keep the gauge out of the red. Brought alongside, he is unhooked and let go, and the level
//   takes it from there.

import * as THREE from 'three';
import { createSnout } from '../eyes.js';
import { CAST, CAST_ANGLES, LINE, newCast, castStep, forceAt, newTroll, trollStep, newFight, fightStep, tensionZone } from './marlin-rules.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = o => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
function add(p, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; }

// ---- The charter boat: bow toward +z, deck at y = 1.1 --------------------------------------------
export function charterBoat() {
  const g = new THREE.Group(), white = std({ color: 0xf4f1ea }), blue = std({ color: 0x1f6f9c }), teak = std({ color: 0xb98a55 }), dark = std({ color: 0x223038 }), yellow = std({ color: 0xf2c12e });
  add(g, new THREE.BoxGeometry(3.4, 1.5, 8), white, 0, 0.45, -1);
  const bow = add(g, new THREE.CylinderGeometry(1.7, 0.2, 1.5, 3), white, 0, 0.45, 3); bow.rotation.y = Math.PI / 6; bow.scale.set(1, 1, 1.5);
  add(g, new THREE.BoxGeometry(3.44, 0.35, 8.02), blue, 0, 0.4, -1);                        // the stripe
  add(g, new THREE.BoxGeometry(3.2, 0.06, 7.8), teak, 0, 1.2, -1);                          // the deck
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.12, 0.45, 8), white, s * 1.66, 1.4, -1);   // the gunwales
  add(g, new THREE.BoxGeometry(3.4, 0.45, 0.12), white, 0, 1.4, -5);                        // the transom
  add(g, new THREE.BoxGeometry(2.6, 1.7, 3), white, 0, 2.05, 0.8);                          // the cabin
  add(g, new THREE.BoxGeometry(2.64, 0.6, 2.6), dark, 0, 2.4, 0.8);                         // its windows
  add(g, new THREE.BoxGeometry(3, 0.12, 3.4), blue, 0, 2.95, 0.8);                          // its roof
  for (const [x, z] of [[-1.2, -0.6], [1.2, -0.6]]) add(g, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), white, x, 3.5, z);
  add(g, new THREE.BoxGeometry(2.6, 0.08, 1.6), yellow, 0, 4.1, -0.1);                      // the shade over the flybridge
  const chair = add(g, new THREE.BoxGeometry(0.6, 0.12, 0.6), teak, 0, 1.75, -3); add(chair, new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), white, 0, -0.3, 0);   // the fighting chair
  for (const s of [-1, 1]) { const rod = add(g, new THREE.CylinderGeometry(0.02, 0.03, 3.2, 6), dark, s * 1.5, 2.8, -3.6); rod.rotation.z = -s * 0.5; }   // the outriggers
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 512, 128); x.fillStyle = '#1f6f9c'; x.font = "900 74px Impact, 'Arial Black', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('THE REEL CROC', 256, 66);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const name = add(g, new THREE.PlaneGeometry(2.6, 0.65), std({ map: tex }), 0, 0.85, -5.02); name.rotation.y = Math.PI; name.castShadow = false;
  return g;
}

// ---- The marlin: head toward +z, about 3.6 m with the bill --------------------------------------
function marlinModel() {
  const g = new THREE.Group();
  // Body: a long spindle, deep blue-black above and silver below, with faint bars along the flank.
  const pts = [[0.02, -1.5], [0.1, -1.35], [0.2, -1], [0.3, -0.5], [0.36, 0], [0.33, 0.5], [0.24, 0.9], [0.12, 1.15], [0.05, 1.28]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(pts, 20); body.rotateX(Math.PI / 2);
  const p = body.attributes.position, col = new Float32Array(p.count * 3), top = new THREE.Color(0x0e2238), mid = new THREE.Color(0x2f5f86), belly = new THREE.Color(0xdfe9ee), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const u = p.getY(i) / Math.max(0.04, Math.hypot(p.getX(i), p.getY(i)));           // up the side, -1 to 1
    c.copy(u > 0.25 ? top : u > -0.25 ? mid : belly);
    if (u > -0.3 && u < 0.3 && Math.sin(p.getZ(i) * 13) > 0.6) c.lerp(new THREE.Color(0x9fc9e4), 0.6);      // the bars
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  body.setAttribute('color', new THREE.BufferAttribute(col, 3));
  add(g, body, std({ vertexColors: true, roughness: 0.3, metalness: 0.35 }));
  const dark = std({ color: 0x10243a, roughness: 0.4, side: THREE.DoubleSide }), bill = add(g, new THREE.ConeGeometry(0.05, 1.05, 8), dark, 0, 0.02, 1.72); bill.rotation.x = Math.PI / 2;
  const fin = (points, x, y, z) => { const s = new THREE.Shape(); points.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b))); const m = add(g, new THREE.ShapeGeometry(s), dark, x, y, z); m.rotation.y = -Math.PI / 2; return m; };
  fin([[0.75, 0], [0.55, 0.62], [0.3, 0.28], [-0.5, 0.16], [-0.75, 0]], 0, 0.3, 0);     // the dorsal: low, sickle-shaped, as a black marlin's is
  fin([[-1.45, 0], [-2.05, 0.8], [-1.8, 0], [-2.05, -0.8]], 0, 0.02, 0);                // the crescent tail
  for (const s of [-1, 1]) { const pec = add(g, new THREE.BoxGeometry(0.62, 0.02, 0.2), dark, s * 0.55, -0.2, 0.6); pec.rotation.z = s * 0.7; }   // pectorals held stiffly out: what marks a black marlin
  for (const s of [-1, 1]) { add(g, new THREE.SphereGeometry(0.055, 10, 8), std({ color: 0xf2f2e6 }), s * 0.13, 0.09, 1.0); add(g, new THREE.SphereGeometry(0.03, 8, 6), std({ color: 0x050505 }), s * 0.165, 0.09, 1.03); }
  return g;
}

// The sun medallion: Ken's talisman if it is loaded, else a gold sun.
function medallion(models) {
  const k = models.get('talisman-sun');
  if (k) { const m = k.scene.clone(true), b = new THREE.Box3().setFromObject(m); m.scale.setScalar(1.7 / Math.max(...b.getSize(V(0, 0, 0)).toArray())); return m; }
  const g = new THREE.Group(), gold = std({ color: 0xffc926, metalness: 0.85, roughness: 0.22, emissive: 0x6a4300, emissiveIntensity: 0.7 });
  const disc = add(g, new THREE.CylinderGeometry(0.34, 0.34, 0.07, 28), gold); disc.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) { const r = add(g, new THREE.ConeGeometry(0.07, 0.24, 6), gold, Math.sin(i / 12 * 6.283) * 0.44, Math.cos(i / 12 * 6.283) * 0.44, 0); r.rotation.z = -i / 12 * 6.283; }
  return g;
}

export function createMarlinFight({ scene, camera, fx, sound, models, wally, boat, mooredAt, cut, onReleased, onLeave, rng = Math.random }) {
  // Out to sea, sideways on to the shore: the boat runs along the coast and the line goes out astern.
  const AT = { x: -120, z: mooredAt.z + 60 };
  const astern = V(0, 0, -1), right = V(1, 0, 0);
  const s = { phase: null, angle: CAST_ANGLES.start, forceT: 0, force: 0, cast: null, troll: null, fight: null, boatZ: AT.z, away: 0, leap: 0, leapTotal: 2, keys: new Set(), pointer: { reel: false, release: false }, press: false, rod: 0, tick: 0, medalT: -1 };

  // ---- Things in the world ---------------------------------------------------------------------
  const rig = new THREE.Group(); rig.visible = false; scene.add(rig);
  // Held still in the picture, low on the right, where his hand is (Ken, 2026-10-31: it must not jump about).
  const rodBase = new THREE.Group(); rodBase.position.set(0.28, -0.22, -0.7); rig.add(rodBase);
  const rodMat = std({ color: 0x1b2c33, roughness: 0.35 }), SEGS = 12, SEG = 0.17, segs = [];
  { let parent = rodBase; for (let i = 0; i < SEGS; i++) { const j = new THREE.Group(); j.position.y = i ? SEG : 0; parent.add(j); const r = 0.018 - i * 0.0011; add(j, new THREE.CylinderGeometry(r * 0.92, r, SEG, 6), rodMat, 0, SEG / 2, 0).castShadow = false; segs.push(j); parent = j; } }
  const tip = new THREE.Object3D(); tip.position.y = SEG; segs[SEGS - 1].add(tip);
  // Ken's rod, if it is loaded (models/marlin-rod.glb: 1.9 long, tip up, the reel a quarter of the way along). His hand is at
  // the reel. It is one solid piece, so it bends in the shader: more toward the tip, and more with more load on the line.
  const ROD = { scale: 1.15, grip: 0.56 }, rodBend = { value: 0 }, rodModel = models.get('marlin-rod');
  const tipY = (0.95 + ROD.grip) * ROD.scale;
  if (rodModel) {
    segs[0].visible = false; rodBase.add(tip); tip.position.set(0, tipY, 0);
    const m = rodModel.scene.clone(true); m.scale.setScalar(ROD.scale); m.position.y = ROD.grip * ROD.scale;
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = false; o.material = o.material.clone();
      o.material.onBeforeCompile = sh => {
        sh.uniforms.uRodBend = rodBend;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uRodBend;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>\n{ float d = max(0.0, position.y + ${ROD.grip.toFixed(3)}); transformed.z -= uRodBend * d * d; }`);
      };
      o.material.customProgramCacheKey = () => 'marlin-rod';
    });
    rodBase.add(m);
  }
  const reel = add(rodBase, new THREE.CylinderGeometry(0.05, 0.05, 0.07, 14), std({ color: 0xb8bcc0, metalness: 0.8, roughness: 0.3 }), 0.05, 0.1, 0.03); reel.rotation.z = Math.PI / 2; reel.castShadow = false; reel.visible = !models.get('marlin-rod');
  const handle = add(reel, new THREE.BoxGeometry(0.012, 0.012, 0.09), std({ color: 0x222222 }), 0, 0.05, 0.03); handle.castShadow = false;

  // The line: a thin ribbon facing the camera, a little wider further off, so it can be seen all the way out.
  const LP = 28, linePos = new Float32Array(LP * 6), lineGeo = new THREE.BufferGeometry(), lineIdx = [];
  for (let i = 0; i < LP - 1; i++) { const a = i * 2; lineIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3)); lineGeo.setIndex(lineIdx);
  const line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0xfff6d8, side: THREE.DoubleSide })); line.frustumCulled = false; line.visible = false; line.userData.noAO = true; scene.add(line);
  const lure = new THREE.Group(); add(lure, new THREE.SphereGeometry(0.1, 10, 8), std({ color: 0xff4f7a })); add(lure, new THREE.ConeGeometry(0.1, 0.3, 8), std({ color: 0xffd23f }), 0, -0.18, 0); lure.visible = false; lure.scale.setScalar(1.6); scene.add(lure);
  // Ken's model if it is loaded (models/black-marlin.glb: it stands bill up, belly toward -z, 1.9 long), turned to swim.
  const marlin = marlinModel(); marlin.visible = false; marlin.scale.setScalar(1.45); scene.add(marlin);
  { const k = models.get('black-marlin');
    if (k) {
      marlin.clear();
      const m = k.scene.clone(true); m.scale.setScalar(3.9 / 1.9); m.quaternion.setFromAxisAngle(V(0, 1, 1).normalize(), Math.PI);
      m.traverse(o => { if (o.isMesh) o.castShadow = true; }); marlin.add(m);
    } }
  const medal = medallion(models); medal.visible = false; scene.add(medal);
  if (!models.get('talisman-sun')) medal.scale.setScalar(1.6);
  const glow = new THREE.PointLight(0xffd070, 0, 9); medal.add(glow);
  const snout = createSnout(scene, camera);

  // ---- The screen ------------------------------------------------------------------------------
  const ui = document.createElement('div'); ui.className = 'fish-ui'; ui.hidden = true;
  ui.innerHTML = `
    <div class="fish-gauge" aria-label="Line tension"><span class="fish-gauge-label">TENSION</span><div class="fish-gauge-bar"><i class="z-safe"></i><i class="z-careful"></i><i class="z-danger"></i><b class="fish-needle"></b></div></div>
    <div class="fish-stats"><div class="fish-line"></div><div class="fish-strength"><span>Marlin</span><div><i></i></div></div></div>
    <div class="fish-meter" hidden><span class="fish-meter-label"></span><div><i></i></div><b class="fish-meter-num"></b></div>
    <p class="fish-prompt"></p>
    <p class="fish-keys"></p>
    <div class="fish-buttons"><button class="fish-b-release" type="button">RELEASE</button><button class="fish-b-reel" type="button">REEL</button></div>
    <div class="fish-after" hidden><button class="fish-again" type="button">Cast again</button><button class="fish-leave" type="button">Back to the pier</button></div>`;
  document.body.append(ui);
  const $ = q => ui.querySelector(q), needle = $('.fish-needle'), promptEl = $('.fish-prompt'), lineEl = $('.fish-line'), strength = $('.fish-strength'), strengthFill = $('.fish-strength i'), gauge = $('.fish-gauge'), meter = $('.fish-meter'), meterFill = $('.fish-meter i'), meterLabel = $('.fish-meter-label'), meterNum = $('.fish-meter-num'), buttons = $('.fish-buttons'), after = $('.fish-after'), bReel = $('.fish-b-reel'), bRelease = $('.fish-b-release');
  const say = t => { if (promptEl.textContent !== t) promptEl.textContent = t; };
  // The controls, for the stage he is at (Ken, 2026-10-31).
  const touch = matchMedia('(pointer: coarse)').matches, keysEl = $('.fish-keys');
  const CONTROLS = touch ? {
    aim: 'UP / DOWN buttons: set the angle  \u00b7  Tap the water: on to the force',
    force: 'Tap: cast, as hard as the meter shows',
    troll: 'STRIKE button or tap, when the gauge jumps',
    fight: 'Hold REEL: wind in  \u00b7  Hold RELEASE: let line run  \u00b7  Keep the needle out of the red',
  } : {
    aim: 'Up / Down or W / S: set the angle  \u00b7  Space: on to the force',
    force: 'Space: cast, as hard as the meter shows',
    troll: 'Space: strike, when the gauge jumps',
    fight: 'Hold Down or S: REEL  \u00b7  Hold Up or W: RELEASE  \u00b7  Left / Right or A / D: swing the rod  \u00b7  P: pause',
    lost: 'Space: cast again  \u00b7  Esc: back to the pier',
  };
  const hold = (el, key) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); s.pointer[key] = true; if (key === 'reel' && s.phase === 'troll') s.press = true; });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => { s.pointer[key] = false; });
  };
  hold(bReel, 'reel'); hold(bRelease, 'release');
  $('.fish-again').onclick = e => { e.stopPropagation(); after.hidden = true; enter('aim'); };
  $('.fish-leave').onclick = e => { e.stopPropagation(); finish(false); };
  const keyDown = e => {
    if (!s.phase) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!e.repeat && s.phase === 'lost') { if ([' ', 'Enter'].includes(e.key)) { enter('aim'); return; } if (e.key === 'Escape') { finish(false); return; } }
    if (!e.repeat && [' ', 'Enter'].includes(e.key)) s.press = true;
    s.keys.add(e.key);
  };
  const keyUp = e => s.keys.delete(e.key);
  // On a phone, a tap on the picture is the press. On a computer it is all keys (Ken, 2026-10-31).
  const mouseDown = e => { if (!s.phase || e.pointerType !== 'touch' || e.target.closest('button')) return; s.press = true; };
  const mouseUp = () => { s.pointer.reel = s.pointer.release = false; };
  const noMenu = e => { if (s.phase) e.preventDefault(); };
  const held = (...names) => names.some(n => s.keys.has(n));
  const takePress = () => { const p = s.press; s.press = false; return p; };

  // ---- Where things are ------------------------------------------------------------------------
  const handAt = V(0, 0, 0), across = V(0, 0, 0), toCam = V(0, 0, 0), tipAt = V(0, 0, 0), fishAt = V(0, 0, 0), look = V(0, 0, 0), want = V(0, 0, 0), lureAt = V(0, 0, 0);
  const stern = () => V(boat.position.x, boat.position.y, boat.position.z - 4.2);
  const onWater = (dist, side) => {                                // a spot out on the water, by how far and how far to the side
    const o = stern(), a = side * 0.55;
    return V(o.x + (astern.x * Math.cos(a) + right.x * Math.sin(a)) * dist, 0, o.z + (astern.z * Math.cos(a) + right.z * Math.sin(a)) * dist);
  };
  // He is drawn nearer than he is, or at 100 m he would be a dot.
  const shown = d => 11 + d * 0.13;

  function enter(p) {
    s.phase = p; s.press = false;
    gauge.hidden = p === 'aim' || p === 'force' || p === 'flight';
    meter.hidden = p !== 'aim' && p !== 'force';
    buttons.hidden = !touch || (p !== 'fight' && p !== 'troll' && p !== 'aim');
    strength.hidden = p !== 'fight'; lineEl.hidden = p !== 'fight' && p !== 'troll'; lineEl.parentElement.hidden = lineEl.hidden;
    after.hidden = p !== 'lost';
    bReel.textContent = p === 'aim' ? 'UP' : p === 'troll' ? 'STRIKE' : 'REEL'; bRelease.textContent = p === 'aim' ? 'DOWN' : 'RELEASE';
    bRelease.hidden = p === 'troll';
    keysEl.textContent = CONTROLS[p] || ''; keysEl.hidden = !CONTROLS[p];
    if (p === 'aim') { s.fight = s.troll = s.cast = null; line.visible = lure.visible = marlin.visible = false; s.forceT = 0; s.keys.clear(); s.pointer.reel = s.pointer.release = false; s.press = false; say('Set the angle of your cast.'); }
    if (p === 'force') { s.forceT = 0; say('Cast, as hard as the meter shows. Too hard tangles the reel!'); }
    if (p === 'flight') { s.cast = newCast(s.angle, s.force); line.visible = lure.visible = true; sound.play.leap && sound.play.leap(); say(s.cast.tangled ? 'Backlash! The reel has overrun.' : ''); }
    if (p === 'troll') { s.troll = newTroll(rng); say('The boat trolls on. Watch the gauge for a bite...'); }
    if (p === 'fight') { s.fight = newFight(rng, s.cast.x); s.leap = 0; marlin.visible = true; line.visible = true; lure.visible = false; const f = fishPos(); fx.splash(f, 30); sound.play.splash(); }
    if (p === 'lost') { line.visible = false; marlin.visible = false; lure.visible = false; }
    if (p === 'release') beginRelease();
  }

  function fishPos() { const f = s.fight; return onWater(shown(f.dist), f.side); }

  // ---- Each frame ------------------------------------------------------------------------------
  function stepAim(dt) {
    const dir = (held('ArrowUp', 'w', 'W') || s.pointer.reel ? 1 : 0) - (held('ArrowDown', 's', 'S') || s.pointer.release ? 1 : 0);
    s.angle = Math.max(CAST_ANGLES.min, Math.min(CAST_ANGLES.max, s.angle + dir * 22 * dt));
    meterLabel.textContent = 'ANGLE'; meterFill.style.height = `${(s.angle - CAST_ANGLES.min) / (CAST_ANGLES.max - CAST_ANGLES.min) * 100}%`; meterNum.textContent = `${Math.round(s.angle)}°`;
    if (takePress()) enter('force');
  }
  function stepForce(dt) {
    s.forceT += dt; s.force = forceAt(s.forceT);
    meterLabel.textContent = 'FORCE'; meterFill.style.height = `${s.force * 100}%`; meterNum.textContent = s.force > CAST.backlash ? 'TOO HARD' : `${Math.round(s.force * 100)}%`;
    if (takePress()) enter('flight');
  }
  function stepFlight(dt) {
    const c = s.cast; castStep(c, dt);
    const o = stern(), a = 0;
    lureAt.set(o.x + astern.x * c.x, c.y, o.z + astern.z * c.x + a); lure.position.copy(lureAt); lure.rotation.x += dt * 6;
    if (c.landed) {
      fx.splash(lureAt, 14); sound.play.splash();
      if (c.x < CAST.minLine) { say(`${Math.round(c.x)} m: that's in the boat's wake. Wind in and cast again.`); s.retry = 2.2; s.phase = 'short'; }
      else enter('troll');
    }
  }
  function stepTroll(dt) {
    const t = s.troll; trollStep(t, takePress(), dt);
    s.boatZ += 3.5 * dt * 0.25;
    if (t.justBit) { sound.play.land(); say(touch ? 'A bite! STRIKE!' : 'A bite! STRIKE! Space!'); }
    else if (t.state === 'working' && !t.scared && t.spike <= 0 && promptEl.textContent.startsWith('A bite')) say('He dropped it. Watch the gauge...');
    if (t.spike > 0.28) say('A nibble... wait for him to take it.');
    if (t.scared) say('Too soon! You pulled it away from him.');
    if (t.result === 'hooked') { say('Fish on! Reel when he rests. RELEASE when he runs or leaps!'); enter('fight'); return; }
    lureAt.copy(onWater(shown(s.cast.x), 0)); lureAt.y = 0.05; lure.position.copy(lureAt);
    drawGauge(t.tension, t.state === 'bite'); lineEl.textContent = `${Math.round(s.cast.x)} m of line out`;
  }
  const PROMPTS = { run: "He's running! RELEASE and let him go!", jump: "He's leaping! RELEASE!", shake: 'He is shaking his head. Ease off...', charge: 'He is charging the boat! REEL fast, keep it tight!', rest: 'He is resting. REEL, win line back!' };
  function stepFight(dt) {
    // (Ken, 2026-10-31: down reels, as pulling back on the rod; up releases, as giving to him.)
    const f = s.fight, reelOn = held('ArrowDown', 's', 'S') || s.pointer.reel, releaseOn = held('ArrowUp', 'w', 'W') || s.pointer.release;
    const dirX = (held('ArrowRight', 'd', 'D') ? 1 : 0) - (held('ArrowLeft', 'a', 'A') ? 1 : 0);
    s.rod += (dirX - s.rod) * Math.min(1, dt * 5);
    s.press = false;
    fightStep(f, { reel: reelOn, release: releaseOn, rod: s.rod }, dt);
    if (reelOn) { reel.rotation.x -= dt * 22; }
    s.tick -= dt;
    if (f.slipping && f.speed > 2 && s.tick <= 0) { s.tick = 0.14; sound.play.land(); }   // the reel screaming
    say(f.tension >= 0.85 ? 'TOO TIGHT! RELEASE!' : f.tension < 0.1 && f.slack > 0.6 ? 'Slack line! REEL!' : PROMPTS[f.mode]);
    drawGauge(f.tension, f.tension >= 0.85);
    lineEl.textContent = `${Math.round(f.line)} m of line out`; strengthFill.style.width = `${Math.max(0, (f.stamina - LINE.tired) / (1 - LINE.tired) * 100)}%`;
    if (f.justLeapt) { s.leap = f.modeLeft; s.leapTotal = f.modeLeft; fx.splash(fishPos(), 36); sound.play.splash(); }
    if (f.result === 'lost') {
      sound.play.lose();
      say(f.why === 'snapped' ? 'SNAP! The line broke, and he is gone.' : f.why === 'slack' ? 'Slack line: he threw the hook, and he is gone.' : 'He took every metre off the reel. He is gone.');
      enter('lost');
    } else if (f.result === 'landed') enter('release');
  }
  function drawGauge(t, alarm) {
    needle.style.bottom = `${Math.min(100, t * 100)}%`;
    const z = tensionZone(t); gauge.dataset.zone = z; gauge.classList.toggle('alarm', !!alarm);
  }

  function placeMarlin(dt) {
    if (!marlin.visible || !s.fight) return;
    const f = s.fight, p = fishPos();
    let y = -0.28, pitch = 0, roll = Math.sin(f.time * 2.4) * 0.05;
    const away = f.mode === 'charge' ? Math.PI : 0;                 // tail or head toward us
    if (f.mode === 'jump' && f.modeLeft > 0) {
      const u = 1 - f.modeLeft / s.leapTotal; y = Math.sin(Math.PI * Math.min(1, u)) * 6.2 - 0.3;
      pitch = -0.95 + 1.9 * u; roll = Math.sin(f.time * 15) * 0.5;
      if (u > 0.93 && !s.splashed) { s.splashed = true; fx.splash(p.clone().setY(0), 34); sound.play.splash(); }
    } else { s.splashed = false; if (Math.random() < dt * (f.mode === 'run' ? 7 : 1.5)) fx.splash(p.clone().setY(0), 3); }
    marlin.position.set(p.x, y, p.z);
    marlin.rotation.set(pitch, Math.atan2(astern.x, astern.z) + away + f.side * 0.5 + Math.sin(f.time * 7) * 0.08 * (f.mode === 'run' ? 2 : 1), roll, 'YXZ');
  }

  function drawLine() {
    if (!line.visible) return;
    tip.getWorldPosition(tipAt);
    const end = s.phase === 'fight' || s.phase === 'release' ? fishAt.copy(marlin.position).add(V(Math.sin(marlin.rotation.y) * 1.2, 0.05, Math.cos(marlin.rotation.y) * 1.2)) : lureAt;
    const T = s.phase === 'fight' ? s.fight.tension : s.phase === 'troll' ? s.troll.tension : 0.1, sag = (1 - Math.min(1, T * 1.1)) * tipAt.distanceTo(end) * 0.07;
    const cam = camera.position;
    for (let i = 0; i < LP; i++) {
      const u = i / (LP - 1), x = tipAt.x + (end.x - tipAt.x) * u, y = tipAt.y + (end.y - tipAt.y) * u - sag * 4 * u * (1 - u), z = tipAt.z + (end.z - tipAt.z) * u;
      toCam.set(cam.x - x, cam.y - y, cam.z - z); const far = toCam.length();
      across.set(end.x - tipAt.x, end.y - tipAt.y, end.z - tipAt.z).cross(toCam).normalize().multiplyScalar(Math.max(0.003, far * 0.0011));
      linePos[i * 6] = x + across.x; linePos[i * 6 + 1] = y + across.y; linePos[i * 6 + 2] = z + across.z;
      linePos[i * 6 + 3] = x - across.x; linePos[i * 6 + 4] = y - across.y; linePos[i * 6 + 5] = z - across.z;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  // ---- Unhooking him, and letting him go ------------------------------------------------------
  function beginRelease() {
    ui.hidden = true; line.visible = true; rig.visible = false; snout.show(false); document.body.classList.add('in-cut');
    const o = stern(), side = o.clone().add(V(3.2, 0, -1.5));
    s.alongside = side; s.away = 0;
    marlin.position.set(side.x, -0.15, side.z); marlin.rotation.set(0, Math.PI + 0.25, 0, 'YXZ');   // side on to the boat, in profile
    fx.splash(side, 26); sound.play.splash();
    const eye = o.clone().add(V(0.6, 3, 0.8)), at = side.clone().setY(0.2);
    const close = { from: eye, to: eye.clone().add(V(0.5, -0.5, -0.5)), lookFrom: at, lookTo: at };
    const up = at.clone().setY(1.3);
    const wide = { from: V(side.x + 6.5, 2.6, side.z + 0.5), to: V(side.x + 4.6, 2, side.z + 0.3), lookFrom: up, lookTo: up };
    cut.play([
      { s: 3, who: 'Wally', line: 'Crikey! Look at him! A black marlin, right alongside!', ...close },
      { s: 3, who: 'Wally', line: "You fought like a champion, mate. You've earned your freedom.", cue: () => { s.unhooked = true; line.visible = false; sound.play.land(); }, ...close },
      { s: 3.4, line: 'Wally lets him go. But the great fish turns back, with something shining in his bill.', cue: () => { medal.visible = true; s.medalT = 0; glow.intensity = 6; sound.play.powerup(); }, ...wide },
      { s: 3.2, who: 'Wally', line: 'The sun medallion! One for the sceptre! Thanks, mate!', ...wide },
      { s: 2.4, line: 'And away he goes, free.', cue: () => { medal.visible = false; glow.intensity = 0; s.away = 0.001; s.leapBack = true; fx.splash(side, 30); sound.play.splash(); onReleased(); }, from: V(side.x + 4.6, 2, side.z + 0.3), to: V(side.x + 3, 3, side.z + 1), lookFrom: up, lookTo: V(side.x - 12, 1.5, side.z - 22) },
    ], () => finish(true), { siren: false });
  }
  function stepRelease(dt, t) {
    const a = s.alongside;
    if (s.medalT >= 0 && medal.visible) { s.medalT += dt; medal.position.set(a.x + Math.sin(marlin.rotation.y) * 2.9, Math.min(0.8, 0.1 + s.medalT * 0.9) + Math.sin(t * 2.5) * 0.05, a.z + Math.cos(marlin.rotation.y) * 2.9); medal.rotation.y += dt * 2.2; }
    if (s.away > 0) {
      s.away += dt; const u = s.away;
      marlin.position.set(a.x - u * 5, Math.sin(Math.min(1.5, u) * Math.PI / 1.5) * 4 - 0.3 - Math.max(0, u - 1.5) * 2, a.z - u * 9); marlin.rotation.set(-0.9 + Math.min(1.5, u) * 1.2, Math.PI + 0.5, Math.sin(u * 14) * 0.3, 'YXZ');
    } else marlin.position.y = -0.15 + Math.sin(t * 1.6) * 0.05;
  }

  // ---- Start and end ---------------------------------------------------------------------------
  function finish(caught) {
    s.phase = null; ui.hidden = true; rig.visible = line.visible = lure.visible = marlin.visible = medal.visible = false; snout.show(false); snout.holdRod(false);
    s.away = 0; s.unhooked = false; s.medalT = -1; s.seen = false;
    boat.position.copy(mooredAt); boat.rotation.set(0, -Math.PI / 2, 0);
    removeEventListener('keydown', keyDown); removeEventListener('keyup', keyUp); removeEventListener('pointerdown', mouseDown); removeEventListener('pointerup', mouseUp); removeEventListener('contextmenu', noMenu);
    document.body.classList.remove('in-cut', 'fishing');
    onLeave(caught);
  }

  return {
    get active() { return !!s.phase; },
    get phase() { return s.phase; },
    state: s,
    start() {
      s.boatZ = AT.z; boat.rotation.set(0, 0, 0); boat.position.set(AT.x, 0, AT.z);
      wally.root.visible = false; rig.visible = true; snout.show(true); snout.holdRod(true); ui.hidden = false;
      document.body.classList.add('in-cut', 'fishing');
      addEventListener('keydown', keyDown); addEventListener('keyup', keyUp); addEventListener('pointerdown', mouseDown); addEventListener('pointerup', mouseUp); addEventListener('contextmenu', noMenu);
      s.keys.clear(); s.angle = CAST_ANGLES.start; enter('aim');
    },
    step(dt, t) {
      if (!s.phase) return;
      const P = s.phase;
      if (P === 'aim') stepAim(dt);
      else if (P === 'force') stepForce(dt);
      else if (P === 'flight') stepFlight(dt);
      else if (P === 'short') { s.retry -= dt; if (s.retry <= 0) enter('aim'); }
      else if (P === 'troll') stepTroll(dt);
      else if (P === 'fight') stepFight(dt);
      else if (P === 'release') stepRelease(dt, t);
      boat.position.set(AT.x, Math.sin(t * 0.9) * 0.08, s.boatZ); boat.rotation.x = Math.sin(t * 0.7) * 0.012; boat.rotation.z = Math.sin(t * 1.1) * 0.015;
      if (s.phase === 'fight') placeMarlin(dt);
    },
    // The camera, each frame while it has it. (In the release, the cut scene has it.)
    place(dt, t) {
      const o = stern(), eye = V(o.x + 0.1, 2.75 + Math.sin(t * 0.9) * 0.05, o.z + 0.6);
      want.copy(eye).addScaledVector(astern, 20); want.y = 3;
      if (s.phase === 'aim' || s.phase === 'force') want.y = 3 + Math.tan(s.angle * Math.PI / 180) * 7;
      else if (s.phase === 'flight') { want.copy(lure.position); want.y = Math.max(1.5, want.y * 0.8); }
      else if (s.phase === 'fight') { want.copy(marlin.position); want.y = Math.max(1.8, marlin.position.y * 0.85); }
      else if (s.phase === 'troll' || s.phase === 'short') { want.copy(lureAt); want.y = 1.6; }
      if (!s.seen) { look.copy(want); s.seen = true; }
      look.lerp(want, Math.min(1, dt * 1.6));
      camera.position.copy(eye); camera.up.set(0, 1, 0); camera.lookAt(look); camera.rotateZ(Math.sin(t * 1.1) * 0.012);
      camera.updateMatrixWorld();
      // The rod in his paws: along the view, raised, bending with the load, with the angle of the cast when aiming.
      rig.position.copy(camera.position); rig.quaternion.copy(camera.quaternion);
      const T = s.phase === 'fight' ? s.fight.tension : s.phase === 'troll' ? s.troll.tension : 0;
      const windup = s.phase === 'force' ? -0.7 * s.force : 0;
      rodBase.rotation.set(-0.82 + windup + (s.phase === 'flight' ? 0.5 : 0) + T * 0.2, 0, -0.25 + s.rod * 0.4);
      for (let i = 1; i < SEGS; i++) segs[i].rotation.x = -T * 0.012 * i;      // bending more toward the tip
      if (rodModel) { const b = 0.05 + T * 0.34; rodBend.value = b / ROD.scale; tip.position.set(0, tipY, -b * Math.pow(0.95 + ROD.grip, 2)); }
      const d = camera.getWorldDirection(want); snout.place(Math.atan2(d.x, d.z));
      snout.update(dt);
      rig.updateMatrixWorld(true);
      drawLine();
    },
    // While the release plays (the cut scene has the camera), the line follows.
    releaseFrame() { if (line.visible) { rig.updateMatrixWorld(true); drawLine(); } },
    // For testing.
    testHook(cast = 70) { s.cast = { x: cast }; enter('fight'); },
  };
}
