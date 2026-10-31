// bubbles.js
// Thought bubbles over Wally, Kenny and the tourists: short lines of everyday
// Aussie slang instead of recorded voices. Friendly and warm, never mocking.
// Each bubble is one small picture that faces the camera, so they cost very little.

import * as THREE from 'three';
import { readSeconds } from './read-time.js';

export const LINES = {
  wallyCatch:   ['Bonza tucker!', 'Ripper!', 'Beauty, mate!', 'Too easy!', 'Fair dinkum, that\'s good!', 'Ta very much!',
                 'Crikey, what a beauty!', 'Oi, thanks for the tucker!', 'Bonza!', 'Good on ya, mate!', 'You little ripper!',
                 'Crikey! Lunch is served!', 'Fair dinkum delicious!', 'Ta, mate! Bonza!'],
  wallyLeap:    ['Up she goes!', 'Got it, mate!', 'How good is that!', 'Crikey! Look at me go!', 'Fair dinkum flying croc!'],
  wallySting:   ['Strewth, that stings!', 'Ow! Flamin\' jellies!'],
  wallyStolen:  ['Oi! That was mine!', 'Fair go, mate!', 'Oi! Hands off me tucker!', 'Crikey, ya cheeky thing!'],
  wallyToast:   ['Thanks Kenny, you legend!', 'Now that\'s proper tucker!', 'Crikey, Kenny, you beauty!'],
  wallyHungry:  ['Running on empty here...', 'Could murder a feed.'],
  wallyHello:   ['G\'day, mate!', 'Crikey, what a day for it!', 'G\'day, g\'day!'],
  wallyBump:    ['Whoops!', 'Strewth!', 'Ow, me shins!', 'Didn\'t see that one!'],
  wallyToad:    ['Strewth, a cane toad!', 'Get off, ya warty thing!', 'Ow! Flamin\' toads!'],
  wallyBite:    ['Oi! Watch the teeth!', 'Crikey, he bit me!', 'Back off, ya big lizard!'],
  wallyFlee:    ['Aw, come back! I only wanted lunch!', 'Sorry! Didn\'t mean to scare ya!', 'Too close, my bad.'],
  wallyBird:    ['Oi, ya big beak!', 'Cheeky pelican!', 'Fair go, that was mine!'],
  wallyBat:     ['Cheeky fruit bat!', 'Oi, come back with that!'],
  catcherSpotted: ['There he is!', 'Oi! Stop that croc!', 'Got you now, mate!', 'Come here, you!'],   // the croc catcher (chase.js)
  wallyCroc:    ['Oi! That was mine, ya scaly thief!', 'Beat me to it, mate.'],
  wallyTired:   ['Crikey... I\'m knackered...', 'Need... a... feed...'],
  wallyAir:     ['Need... air...', 'Up! Up!'],
  touristNervous: ['Easy, big fella...', 'That\'s close enough, mate!', 'Whoa, back up a bit!', 'Steady on, Wally!'],
  touristFlee:  ['Righto, we\'re off!', 'Too close! Run!', 'Strewth, leg it!', 'Not today, croc!'],
  kennyJar:     ['Here, mate, have a scoop!', 'Get some of this into ya!', 'She\'ll be right now!'],
  touristStartled: ['Easy, big fella!', 'Whoa! Here ya go, mate!', 'Have a feed, Wally!', 'No worries, take it!', 'He\'s a friendly bloke!', 'Struth, he\'s big!'],
  touristThrow: ['Catch, Wally!', 'G\'day, Wally!', 'Go on, mate!', 'Arvo snack!', 'Too right!', 'Here\'s ya tucker!'],
  kennyComing:  ['Hang on, Wally!', 'Comin\', mate!'],
  kennyDropped: ['Here ya go, mate.', 'She\'ll be right.'],
};

// A line of the given kind, never the same one twice in a row.
const lastLine = {};
export function pickLine(kind) {
  const list = LINES[kind];
  let line = list[Math.floor(Math.random() * list.length)];
  if (list.length > 1 && line === lastLine[kind]) line = list[(list.indexOf(line) + 1) % list.length];
  lastLine[kind] = line;
  return line;
}

// Wally reacting to something that happens to him (Ken, 2026-10-21: whenever something happens, like
// a jellyfish sting, but sparingly: never a sudden mass of bubbles). One reaction at most every few
// seconds, and it holds back the catch chatter too, so lines never pile up.
let lastReaction = -1e9;
export function reaction(gapMs = 6000) {
  const now = performance.now();
  if (now - lastReaction < gapMs) return false;
  lastReaction = now; lastCatchLine = now;
  return true;
}

// Should Wally say something about this catch? Often, but with a few seconds'
// rest between lines, so the slang stays fun and never becomes a constant stream.
let lastCatchLine = -1e9;
export function chatty(chance = 0.6, gapMs = 3500) {
  const now = performance.now();
  if (now - lastCatchLine < gapMs || now - lastReaction < gapMs || Math.random() > chance) return false;
  lastCatchLine = now;
  return true;
}

function bubbleTexture(text) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '700 40px "Baloo 2", "Trebuchet MS", sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 56, h = 84;
  c.width = w; c.height = h + 34;
  g.font = font;
  g.fillStyle = 'rgba(255,255,255,0.96)'; g.strokeStyle = 'rgba(40,60,80,0.35)'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 34); g.fill(); g.stroke();
  // the little thought dots under the bubble
  for (const [x, y, r] of [[w / 2 - 6, h + 8, 9], [w / 2 - 18, h + 24, 6]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.fillStyle = '#1d2b36'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: c.width / c.height };
}

// Whose eyes we are looking through (eyes.js), if anyone's: their lines show ahead of the view, not above their head.
let own = null;
export function ownView(target, camera) { own = target ? { target, camera } : null; }
const ahead = new THREE.Vector3();

export class Bubbles {
  constructor(scene, max = 4) {
    this.scene = scene; this.max = max; this.list = [];
  }

  // Show `text` above `target` (any Object3D) for a few seconds. height: metres above it.
  say(target, text, height = 3.2, seconds = 2.2) {
    // The player's own name for their croc (Ken: name changes), wherever a line says Wally.
    try { const n = JSON.parse(localStorage.getItem('chomp-progress') || '{}').crocName; if (n) text = text.replace(/\bWally\b/g, n); } catch { /* his own name */ }
    seconds = Math.max(seconds, readSeconds(text));             // long enough to read, whatever the caller asked for
    const old = this.list.find(b => b.target === target);
    if (old) this.remove(old);
    if (this.list.length >= this.max) this.remove(this.list[0]);
    const { tex, aspect } = bubbleTexture(text);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    const size = 0.85;
    sprite.scale.set(size * aspect, size, 1);
    sprite.renderOrder = 10;
    this.scene.add(sprite);
    this.list.push({ target, sprite, height, life: seconds, max: seconds });
  }

  remove(b) {
    this.scene.remove(b.sprite);
    b.sprite.material.map.dispose(); b.sprite.material.dispose();
    this.list = this.list.filter(x => x !== b);
  }

  update(dt) {
    const p = new THREE.Vector3();
    for (const b of [...this.list]) {
      b.life -= dt;
      if (b.life <= 0) { this.remove(b); continue; }
      b.target.getWorldPosition(p);
      const rise = (b.max - b.life) * 0.15;
      if (own && b.target === own.target) {
        own.camera.getWorldDirection(ahead);
        b.sprite.position.copy(own.camera.position).addScaledVector(ahead, 8.5); b.sprite.position.y += 1.9 + rise;
      } else b.sprite.position.set(p.x, p.y + b.height + rise, p.z);
      b.sprite.material.opacity = Math.min(1, b.life / 0.3, (b.max - b.life) / 0.15);
    }
  }
}
