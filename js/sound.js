// sound.js
// Small sound effects made on the fly with Web Audio, so there are no sound
// files to load. The browser only allows sound after the player has tapped or
// clicked, so start() is called from the Play button.

// Music and sound effects each have their own on/off (settings.js), set from the
// speaker button on screen at all times, the M key, or any pause screen.

import { music } from './music.js';
import { settings, SETTINGS_CHANGED } from './settings.js';
import { installSoundButton, toggleAllSound } from './audio-ui.js';

// sfx and musicBus: the two volumes, each 0 when that kind of sound is off.
let ctx = null, sfx = null, musicBus = null;
const SFX_LEVEL = 0.5;

function applySettings() {
  if (!ctx) return;
  const t = ctx.currentTime;
  sfx.gain.setTargetAtTime(settings.sfx ? SFX_LEVEL : 0, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music ? 1 : 0, t, 0.05);
}
addEventListener(SETTINGS_CHANGED, applySettings);
installSoundButton();

export function start() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    sfx = ctx.createGain(); sfx.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(ctx.destination);
    sfx.gain.value = settings.sfx ? SFX_LEVEL : 0; musicBus.gain.value = settings.music ? 1 : 0;
    // Started without a click (a page that carries straight on in the story): the browser holds the
    // sound until the first key or tap, so wake it then.
    if (ctx.state === 'suspended') { const wake = () => { ctx.resume(); removeEventListener('pointerdown', wake, true); removeEventListener('keydown', wake, true); }; addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true); }
  } catch { ctx = null; }
}

// Background music (music.js), through its own on/off.
export function startMusic(mood) { if (ctx) music.start(ctx, musicBus, mood); }
export function underwaterMusic(on) { music.setUnderwater(on); }
export function moodMusic(mood) { music.setMood(mood); }
export function fanfare() { music.fanfare(); }

// All sound off, or back on (the M key). Returns true when now silent.
export function toggleMute() { return toggleAllSound(); }

function tone(freq, endFreq, seconds, type = 'sine', volume = 0.4, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + seconds);
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
  o.connect(g); g.connect(sfx);
  o.start(t); o.stop(t + seconds + 0.02);
}

function noise(seconds, filterFreq, volume = 0.4, type = 'lowpass') {
  if (!ctx) return;
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
  const g = ctx.createGain(); g.gain.value = volume;
  src.connect(f); f.connect(g); g.connect(sfx);
  src.start();
}

export const play = {
  chomp() { noise(0.08, 2500, 0.5, 'bandpass'); tone(220, 70, 0.15, 'square', 0.25); },
  splash() { noise(0.45, 900, 0.5); },
  plop() { noise(0.15, 1200, 0.2); },
  jump() { tone(300, 600, 0.18, 'triangle', 0.25); },
  leap() { tone(180, 720, 0.35, 'triangle', 0.3); noise(0.3, 1200, 0.3); },
  land() { tone(140, 60, 0.12, 'sine', 0.3); },
  sting() { tone(900, 300, 0.25, 'sawtooth', 0.2); tone(700, 200, 0.25, 'sawtooth', 0.15, 0.08); },
  stolen() { tone(500, 160, 0.35, 'square', 0.15); },
  powerup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.3, i * 0.08)); },
  goal() { [784, 988, 1175].forEach((f, i) => tone(f, f, 0.2, 'sine', 0.3, i * 0.1)); },
  whistle() { tone(2750, 2900, 0.13, 'sine', 0.22); tone(2750, 2950, 0.32, 'sine', 0.22, 0.2); },   // the croc catcher's two blasts (chase.js)
  lose() { [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.3, 'triangle', 0.3, i * 0.18)); },
};
