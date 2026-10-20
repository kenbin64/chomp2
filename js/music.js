// music.js
// Background music, made on the fly with Web Audio like the sound effects, so
// there is nothing to download. A placeholder (Ken, 2026-10-17): a cheerful
// island groove of plucked guitar, warm bass and light percussion (shaker, soft
// kick, woodblock); on the reef, calypso with steel drums. It deliberately does not imitate the didgeridoo (yidaki) or
// other Aboriginal and Torres Strait Islander instruments: those belong in real
// recordings by Indigenous musicians, licensed and credited, which can replace
// this later one area at a time (see TRACKS).
//
// Each area has its own mood; under water the music goes soft and muffled.
//   music.start(ctx, destination, 'park')   once sound is allowed (after a tap)
//   music.setUnderwater(true/false)
//   music.setMood('esplanade')

// Moods: tempo, key (a root note in Hz), how busy the drums are, and the melody's character.
const MOODS = {
  park:      { bpm: 104, root: 196.0, drums: 1.0, swing: 0.12, bright: 1.0 },    // G: bouncy
  esplanade: { bpm: 96,  root: 220.0, drums: 0.8, swing: 0.16, bright: 0.9 },    // A: breezy
  cane:      { bpm: 88,  root: 174.6, drums: 0.7, swing: 0.1,  bright: 0.7 },    // F: dusk in the cane, tense but not grim
  // Wally's own theme (title screen and trip map). He is named after a true-blue
  // Cairns bloke Ken knows, who caught crocs that got too close to people and
  // moved them somewhere safer. So: a bush-ballad adventure, a strummed guitar's
  // boom-chicka, a walking bass, and a whistled tune with a heroic hook.
  theme:     { bpm: 118, root: 196.0, drums: 0.6, swing: 0.04, bright: 1.0, style: 'theme' },  // G
  // The reef is calypso (Ken): steel drums over a bouncy 3-3-2 bass.
  reef:      { bpm: 112, root: 233.1, drums: 0.8, swing: 0.06, bright: 1.0, style: 'calypso' },   // B flat
};

// A happy four-chord loop (I, V, vi, IV) in scale steps of the major scale.
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const CHORDS = [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]];
// Melody: a phrase per chord, in scale steps (null = rest), 8 eighth notes each.
const PHRASES = [
  [4, null, 2, 4, 5, 4, 2, null],
  [6, null, 4, 6, 7, 6, 4, 2],
  [5, null, 7, 5, 4, null, 2, 4],
  [3, 4, 5, null, 4, 2, 0, null],
];

// The calypso tune: syncopated, in sixteenths (null = rest), one bar per chord.
const _ = null;
const CALYPSO = [
  [4, _, _, 4, _, _, 5, _, 4, _, 2, _, 0, _, 2, _],
  [6, _, _, 6, _, _, 7, _, 8, _, 7, _, 6, _, 4, _],
  [5, _, _, 7, _, _, 9, _, 7, _, 5, _, 4, _, 2, _],
  [3, _, 4, _, 5, _, _, 4, _, 2, _, 0, _, _, _, _],
];

// Wally's theme: a I-IV-V-I bush-ballad progression and its whistled hook.
const THEME_CHORDS = [[0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4]];
const THEME = [
  [0, _, _, 2, 4, _, 4, _, 7, _, _, _, 4, _, 2, _],
  [3, _, _, 5, 7, _, 7, _, 8, _, 7, _, 5, _, _, _],
  [4, _, _, 6, 8, _, 8, _, 9, _, 8, _, 6, _, 4, _],
  [7, _, _, 4, 2, _, 4, _, 0, _, _, _, _, _, _, _],
];

function note(root, step, octave = 0) {
  const o = Math.floor(step / 7), s = ((step % 7) + 7) % 7;
  return root * Math.pow(2, (SCALE[s] + 12 * (o + octave)) / 12);
}

export class Music {
  constructor() { this.ctx = null; this.timer = null; }

  start(ctx, destination, mood = 'park') {
    if (!ctx || this.ctx) return;
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0.32;               // music sits under the sound effects
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 18000;
    this.out.connect(this.muffle); this.muffle.connect(destination);
    this.noise = this.makeNoise();
    this.setMood(mood);
    this.step = 0; this.next = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  setMood(name) { this.mood = MOODS[name] || MOODS.park; }

  setUnderwater(under) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.muffle.frequency.setTargetAtTime(under ? 650 : 18000, t, 0.4);
    this.out.gain.setTargetAtTime(under ? 0.22 : 0.32, t, 0.4);
  }

  stop() { clearInterval(this.timer); this.timer = null; }

  // Look a little ahead and schedule the sixteenth notes that fall in it.
  schedule() {
    const ctx = this.ctx, m = this.mood, sixteenth = 60 / m.bpm / 4;
    while (this.next < ctx.currentTime + 0.25) {
      const i = this.step % 128;                         // 8 bars of 16 sixteenths: the chord loop twice
      const bar = Math.floor(i / 16), pos = i % 16;
      const chord = CHORDS[bar % 4];
      const swing = pos % 2 ? sixteenth * m.swing : 0;   // a laid-back lilt
      const t = this.next + swing;
      if (m.style === 'theme') {
        // Boom-chicka: bass on the beat, root then fifth; two quick strums after it.
        const tc = THEME_CHORDS[bar % 4];
        if (pos % 4 === 0) this.pluck(note(m.root / 2, tc[0] + (pos % 8 === 4 ? 4 : 0)), t, 0.35, 0.22, 'bass');
        if (pos % 4 === 2) tc.forEach((s, k) => this.pluck(note(m.root, s), t + k * 0.01, 0.16, 0.05, 'strum'));
        if (pos % 4 === 3 && bar % 2) tc.forEach((s, k) => this.pluck(note(m.root, s), t + k * 0.01, 0.12, 0.035, 'strum'));
        const step = THEME[bar % 4][pos];
        if (step !== null) this.whistle(note(m.root, step, 1), t, bar % 4 === 3 && pos === 8 ? 0.9 : 0.32, 0.075);
      } else if (m.style === 'calypso') {
        // Calypso: the bass bounces 3+3+2 (sixteenths 0, 6, 12), strums on every
        // off-beat, and the melody is played on steel drums, answered an octave up.
        if (pos === 0) this.pluck(note(m.root / 2, chord[0]), t, 0.3, 0.22, 'bass');
        if (pos === 6) this.pluck(note(m.root / 2, chord[0] + 4), t, 0.3, 0.18, 'bass');
        if (pos === 12) this.pluck(note(m.root / 2, chord[0] + 7), t, 0.25, 0.18, 'bass');
        if (pos % 4 === 2) chord.forEach((s, k) => this.pluck(note(m.root, s), t + k * 0.008, 0.18, 0.045, 'strum'));
        const step = CALYPSO[bar % 4][pos];
        if (step !== null) this.pan(note(m.root, step, bar >= 4 ? 1 : 0), t, 0.11);
        if (bar % 2 === 1 && (pos === 3 || pos === 11)) this.pan(note(m.root, chord[2], 1), t, 0.05);   // a little answer
      } else {
        // Bass: root on the beat, fifth on the "and".
        if (pos === 0 || pos === 8) this.pluck(note(m.root / 2, chord[0]), t, 0.5, 0.22, 'bass');
        if (pos === 6 || pos === 14) this.pluck(note(m.root / 2, chord[0] + 4), t, 0.25, 0.14, 'bass');
        // Strummed chord on the off-beats, like a ukulele.
        if (pos === 4 || pos === 12 || (pos === 10 && bar % 2)) chord.forEach((s, k) => this.pluck(note(m.root, s), t + k * 0.012, 0.35, 0.06 * m.bright, 'strum'));
        // Melody in eighth notes; the second time round it goes up an octave.
        if (pos % 2 === 0) {
          const step = PHRASES[bar % 4][pos / 2];
          if (step !== null) this.pluck(note(m.root, step, bar >= 4 ? 1 : 0), t, 0.3, 0.09 * m.bright, 'lead');
        }
      }
      // Percussion.
      if (m.drums > 0) {
        if (pos === 0 || pos === 8 || (pos === 11 && bar % 2)) this.kick(t, 0.5 * m.drums);
        if (pos % 2 === 0) this.shaker(t, (pos % 4 === 2 ? 0.07 : 0.04) * m.drums);
        if (pos === 4 || pos === 12) this.block(t, 0.12 * m.drums);
      }
      this.next += sixteenth; this.step++;
    }
  }

  // A plucked string: a bright click that fades fast, with a gentle tone after.
  pluck(freq, t, length, volume, kind) {
    const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = kind === 'bass' ? 'triangle' : 'sawtooth'; o2.type = 'sine';
    o.frequency.value = freq; o2.frequency.value = freq * (kind === 'bass' ? 1 : 2);
    f.type = 'lowpass'; f.Q.value = 1;
    f.frequency.setValueAtTime(kind === 'bass' ? 700 : 3200, t);
    f.frequency.exponentialRampToValueAtTime(kind === 'bass' ? 200 : 600, t + length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.out);
    o.start(t); o2.start(t); o.stop(t + length + 0.05); o2.stop(t + length + 0.05);
  }

  // A whistled note: a pure tone that slides up into the pitch, with a gentle
  // vibrato and a breath of air, the way someone whistles a tune.
  whistle(freq, t, length, volume) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 0.94, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.04);
    lfo.frequency.value = 5.5; depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(freq * 0.008, t + Math.min(0.25, length));
    lfo.connect(depth); depth.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.03);
    g.gain.setValueAtTime(volume, t + Math.max(0.04, length - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(g); g.connect(this.out);
    o.start(t); lfo.start(t); o.stop(t + length + 0.05); lfo.stop(t + length + 0.05);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();    // the breath
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 8;
    ng.gain.setValueAtTime(volume * 0.25, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.15, length));
    s.connect(f); f.connect(ng); ng.connect(this.out); s.start(t, Math.random() * 0.5, 0.2);
  }

  // Level done: the theme's hook, whistled quickly over a strum, ending on a big chord.
  fanfare() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + 0.05, r = MOODS.theme.root, beat = 0.13;
    [0, 2, 4, 7, 4, 7].forEach((s, i) => this.whistle(note(r, s, 1), t0 + i * beat, i === 5 ? 1.0 : beat * 1.1, 0.1));
    [0, 2, 4, 7].forEach((s, k) => this.pluck(note(r, s), t0 + 5 * beat + k * 0.02, 1.2, 0.08, 'strum'));
    this.pluck(note(r / 2, 0), t0 + 5 * beat, 1.2, 0.25, 'bass');
  }

  // A steel drum (steelpan) note: a bright strike, then a ringing tone with the
  // pan's own overtones (an octave and an octave and a fifth above) and a slight
  // shimmer from two tones a hair apart.
  pan(freq, t, volume) {
    const ctx = this.ctx, g = ctx.createGain(), length = 0.9;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.004);
    g.gain.exponentialRampToValueAtTime(volume * 0.35, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    g.connect(this.out);
    for (const [mult, level, detune] of [[1, 1, 0], [1, 0.6, 7], [2, 0.45, 0], [3, 0.18, 0], [4.2, 0.08, 0]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq * mult; o.detune.value = detune;
      og.gain.value = level; o.connect(og); og.connect(g);
      o.start(t); o.stop(t + length + 0.05);
    }
  }

  kick(t, volume) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.2);
  }

  shaker(t, volume) {
    const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 6000;
    g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.5, 0.08);
  }

  // A hollow wooden tock (a plain woodblock).
  block(t, volume) {
    const ctx = this.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 820;
    f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 6;
    g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(f); f.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.06);
  }

  makeNoise() {
    const ctx = this.ctx, b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
}

export const music = new Music();
