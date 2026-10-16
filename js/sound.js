// sound.js
// Small sound effects made on the fly with Web Audio, so there are no sound
// files to load. The browser only allows sound after the player has tapped or
// clicked, so start() is called from the Play button.

let ctx = null, master = null, muted = false;

export function start() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  } catch { ctx = null; }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function tone(freq, endFreq, seconds, type = 'sine', volume = 0.4, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + seconds);
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
  o.connect(g); g.connect(master);
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
  src.connect(f); f.connect(g); g.connect(master);
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
  lose() { [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.3, 'triangle', 0.3, i * 0.18)); },
};
