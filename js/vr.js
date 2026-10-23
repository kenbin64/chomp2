// vr.js
// Playing in a VR headset (Ken, 2026-10-23), through WebXR: the Quest browser and any other browser
// with a headset attached. Every page that plays calls installVR once; on a computer or phone without
// a headset nothing changes and no button shows.
//
// How it works:
//   - A "VR" button appears at the top (in the menu on a phone-sized screen) when a headset is there.
//   - In the headset the player stands where the game's own camera is, behind Wally, and looks around
//     with their head. The view follows the camera but turns in 30-degree steps (vr-rules.js), never
//     smoothly, which is what keeps VR comfortable.
//   - The VR controllers act as an ordinary game controller (vr-rules.js mapControllers, read by
//     input.js), so every level's controls work as they are.
//   - A small panel floats low in front of the player: score, feed-o-meter, lives, the latest message.
//   - The flat cards (the map, winning, the shop...) cannot show in a headset, so VR ends while one is
//     open; the player answers it on the screen and presses VR again.
//   - The screen effects (post.js) are skipped in the headset, which draws the plain scene.

import * as THREE from 'three';
import { mapControllers, snapYaw, needsScreen, panelLines } from './vr-rules.js';

let state = null;            // { renderer, scene, camera, frame, session, rig, eye, panel, ... } while installed

export const inVR = () => !!(state && state.session);

// The VR controllers, as one ordinary game controller (or null when not in VR).
export function xrGamepad() {
  if (!inVR()) return null;
  let left = null, right = null;
  for (const s of state.session.inputSources) {
    if (!s.gamepad) continue;
    if (s.handedness === 'left') left = s.gamepad; else right = s.gamepad;
  }
  return mapControllers(left, right);
}

export function installVR({ renderer, scene, camera, frame }) {
  if (state || typeof navigator === 'undefined' || !navigator.xr) return;
  state = { renderer, scene, camera, frame, session: null, yaw: null, checkIn: 0, panelIn: 0 };
  navigator.xr.isSessionSupported('immersive-vr').then(ok => { if (ok) addButton(); }).catch(() => {});

  // The headset's own camera rides on a rig placed where the game's camera is each frame.
  state.rig = new THREE.Group(); state.rig.name = 'vr-rig';
  state.eye = new THREE.PerspectiveCamera(70, 1, 0.05, camera.far || 2000);
  state.rig.add(state.eye);
  state.panel = makePanel(); state.rig.add(state.panel.mesh);
  state.rig.visible = false;
  scene.add(state.rig);

  // Every draw of the game's camera goes through the rig while in VR. (Draws with other cameras, such
  // as pictures made for signs, are left alone.)
  const draw = renderer.render.bind(renderer);
  renderer.render = (s, c) => {
    if (inVR() && c === camera) { placeRig(); draw(s, state.eye); } else draw(s, c);
  };
}

function addButton() {
  if (document.querySelector('.vr-button')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'vr-button';
  b.textContent = '🥽 VR'; b.title = 'Play in your VR headset';
  b.onclick = () => (inVR() ? state.session.end() : enter());
  document.body.append(b);                                   // menu.js folds it into the menu on a narrow screen
}

async function enter() {
  if (openScreens().length && needsScreen(openScreens())) { say('Start playing first, then press VR'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    const { renderer, frame } = state;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');                // the player's head starts at the rig
    if (renderer.xr.setFoveation) renderer.xr.setFoveation(1); // sharper in the middle, cheaper at the edges
    await renderer.xr.setSession(session);
    state.session = session; state.yaw = null; state.rig.visible = true;
    session.addEventListener('end', leave);
    renderer.setAnimationLoop(frame);                          // the headset sets the pace now
  } catch (e) {
    say('VR could not start on this device');
  }
}

function leave() {
  const { renderer, frame } = state;
  state.session = null; state.rig.visible = false;
  renderer.setAnimationLoop(null);
  renderer.xr.enabled = false;
  requestAnimationFrame(frame);                                // back to the screen's own pace
}

// Put the rig where the game's camera is, facing the way it faces (turning in steps), and keep an eye
// on the panel and on any card that needs the screen.
const fwd = new THREE.Vector3();
function placeRig() {
  const { camera, rig } = state;
  camera.updateMatrixWorld();
  camera.getWorldDirection(fwd);
  const wanted = Math.atan2(-fwd.x, -fwd.z);
  state.yaw = state.yaw === null ? wanted : snapYaw(state.yaw, wanted);
  camera.getWorldPosition(rig.position);
  rig.rotation.set(0, state.yaw, 0);
  rig.updateMatrixWorld(true);
  const now = performance.now();
  if (now > state.panelIn) { state.panelIn = now + 250; drawPanel(); }
  if (now > state.checkIn) { state.checkIn = now + 400; if (needsScreen(openScreens())) state.session.end(); }
}

// The cards and screens open on the page right now.
function openScreens() {
  return [...document.querySelectorAll('.map-modal, .overlay')].filter(el => !el.hidden && getComputedStyle(el).display !== 'none');
}

// The floating panel: a small picture, redrawn a few times a second from the page's own HUD.
function makePanel() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false }));
  mesh.position.set(0, -0.45, -0.9); mesh.rotation.x = -0.45;  // low in front, tipped up to the eyes
  mesh.renderOrder = 999;
  return { canvas, texture, mesh };
}

function drawPanel() {
  const text = sel => { const e = document.querySelector(sel); return e ? e.textContent.trim() : ''; };
  const fill = document.getElementById('energy-fill');
  const feed = fill && fill.style.width ? parseFloat(fill.style.width) : null;
  const toasts = document.getElementById('toasts');
  const latest = toasts && toasts.lastElementChild ? toasts.lastElementChild.textContent.trim() : '';
  const paused = !!document.querySelector('#paused:not([hidden])');
  const lines = panelLines({ score: text('#score'), feed: Number.isFinite(feed) ? feed : null, lives: text('#lives'), toast: latest, paused });
  const { canvas, texture } = state.panel, g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  if (!lines.length) { texture.needsUpdate = true; return; }
  g.fillStyle = 'rgba(10, 30, 44, 0.8)'; g.beginPath(); g.roundRect(4, 4, canvas.width - 8, 28 + lines.length * 46, 22); g.fill();
  g.font = '800 34px system-ui, sans-serif'; g.textBaseline = 'top';
  lines.forEach((line, i) => { g.fillStyle = i === 0 && paused ? '#ffd166' : '#ffffff'; g.fillText(line, 24, 20 + i * 46); });
  texture.needsUpdate = true;
}

function say(msg) {
  const box = document.getElementById('toasts');
  if (!box) { console.info(msg); return; }
  const t = document.createElement('div'); t.className = 'toast info'; t.textContent = msg;
  box.append(t); setTimeout(() => t.remove(), 3500);
}
