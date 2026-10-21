// king-court.js
// Face to face with the Croc King on his throne (Ken, 2026-10-20; MASTER.md section 6, the
// finale's fourth version, step 4). A cinematic: the King's lines are Ken's, close to his words.
//
//   const court = kingScene({ scene, camera, wally, models, look, caption, sound });
//   court.start(pawpaws, onDone)    pawpaws: how many Wally gathered on the vines
//   court.update(dt, t)             every frame while court.active
//   court.skip()

import * as THREE from 'three';
import { COURSE, START } from './vine-rules.js';
import { COURT } from './daintree-forest.js';

const X = COURSE.x;
const KING = 'The Croc King';

// [who, words, seconds]. who: 'king', 'wally' or null (a shot with no words).
function linesFor(pawpaws) {
  return [
    [null, '', 3.2],
    ['wally', "Your Majesty. I've brought your sceptre. All six talismans, back where they belong.", 4.4],
    ...(pawpaws > 0 ? [
      ['wally', `And ${pawpaws === 1 ? 'a pawpaw' : `${pawpaws} pawpaws`}, picked on the way here. A gift for you.`, 3.6],
      ['king', 'Pawpaws. How thoughtful.', 2.6],
    ] : []),
    ['king', 'You have done well, young croc. I will grant you one wish. What is your wish?', 4.4],
    ['wally', 'My wish is to save the people on the tour boat.', 3.4],
    ['king', 'Hmm. A selfless act. But that was not your real quest.', 3.6],
    ['king', 'Your quest was to use the talismans to bring out all the crocs in Croc Park, and bring them here to the Daintree, where they can be wild crocs, along with yourself.', 6.4],
    ['wally', 'No. It was to be granted a wish, and that is it.', 3.4],
    ['king', 'Because of your selfless act, I will grant your wish. But to fulfil it, it will be the crocs of the park who rescue the boat, and push it off the sandbar.', 6.2],
    ['king', 'And I will reveal why you were made part human, and why you were summoned here to find the lost pieces of my sceptre.', 5.4],
    ['king', 'I wanted one croc from Croc Park to prove himself. So I used the last magic of the sceptre to turn you into your current self.', 5.8],
    ['king', 'Now that all the talismans are back on the sceptre, its full power is back. And I can grant your wish.', 5.6, 'glow'],
  ];
}

export function kingScene({ scene, camera, wally, models, look, caption, sound }) {
  const top = look.top, wallyZ = COURT.throneZ - 6.5;
  // The sceptre: Wally holds it up, then it rises to the King; at the end it blazes with light.
  const sceptre = (() => {
    const gltf = models.get('sceptre'); const g = new THREE.Group(); g.visible = false; scene.add(g);
    if (gltf) { const m = gltf.scene.clone(true), b = new THREE.Box3().setFromObject(m); m.scale.setScalar(1.6 / b.getSize(new THREE.Vector3()).y); m.position.sub(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3())); g.add(m); }
    const light = new THREE.PointLight(0xffe6a0, 0, 14); g.add(light); g.userData.light = light;
    return g;
  })();
  const s = { active: false, t: 0, line: -1, lines: [], done: null, look: new THREE.Vector3(), glow: 0 };
  const kingHead = new THREE.Vector3(X, top + 2.9, COURT.throneZ - 0.8), wallyHead = () => new THREE.Vector3(X, wally.pos.y + 2.3, wally.pos.z);
  const shots = {
    wide: { pos: new THREE.Vector3(X + 9, START.y + 4.5, COURT.throneZ - 15), at: new THREE.Vector3(X, top + 1.6, COURT.throneZ - 3) },
    king: { pos: new THREE.Vector3(X + 2.2, top + 2.6, COURT.throneZ - 6.2), at: kingHead },
    wally: { pos: new THREE.Vector3(X - 2.4, top + 2.4, COURT.throneZ - 2.4), at: null },
  };
  function say(i) {
    const [who, words] = s.lines[i];
    caption(who === 'king' ? KING : who === 'wally' ? 'Wally' : '', words);
    if (who === 'king') sound.play.chomp && sound.play.land();
  }
  function end() { if (!s.active) return; s.active = false; caption('', ''); sceptre.visible = false; if (s.done) s.done(); }
  return {
    get active() { return s.active; },
    start(pawpaws, onDone) {
      s.active = true; s.t = 0; s.line = -1; s.lines = linesFor(pawpaws); s.done = onDone; s.glow = 0;
      wally.pos.set(X, START.y, wallyZ); wally.root.position.copy(wally.pos); wally.facing = 0; wally.root.rotation.set(0, 0, 0); wally.vel.set(0, 0, 0);
      sceptre.visible = true; sceptre.userData.light.intensity = 0;
      camera.position.copy(shots.wide.pos); s.look.copy(shots.wide.at);
    },
    skip: end,
    update(dt, t) {
      if (!s.active) return;
      s.t += dt;
      // The lines, one after another.
      let start = 0, i = 0;
      for (; i < s.lines.length; i++) { if (s.t < start + s.lines[i][2]) break; start += s.lines[i][2]; }
      if (i >= s.lines.length) { end(); return; }
      if (i !== s.line) { s.line = i; say(i); }
      const [who, , , cue] = s.lines[i];
      // The camera: a wide reveal, then on whoever is speaking.
      const shot = who === 'king' ? shots.king : who === 'wally' ? shots.wally : shots.wide;
      const at = shot.at || wallyHead();
      camera.position.lerp(shot.pos, Math.min(1, dt * 2.2)); s.look.lerp(at, Math.min(1, dt * 3)); camera.lookAt(s.look);
      // Wally stands before the throne; the sceptre goes from his hands up to the King.
      wally.update(dt, { forward: 0, right: 0, jump: false, fours: false }, 0, 1);
      const give = Math.min(1, Math.max(0, (s.t - 5) / 3));            // after he speaks of it
      const from = new THREE.Vector3(X + 0.6, wally.pos.y + 2.2, wally.pos.z + 0.9), to = new THREE.Vector3(X + 0.9, top + 2.2, COURT.throneZ - 1.4);
      sceptre.position.lerpVectors(from, to, give * give * (3 - 2 * give)); sceptre.position.y += Math.sin(give * Math.PI) * 0.8;
      sceptre.rotation.y += dt * 0.6;
      if (cue === 'glow') s.glow = Math.min(1, s.glow + dt * 0.5);
      sceptre.userData.light.intensity = 2 + s.glow * 22 + Math.sin(t * 3) * 0.5;   // bright, but the King still reads
      // The King: seated, talking when he speaks, raising the sceptre at the end.
      if (look.kingSkin) { look.kingSkin.play(cue === 'glow' ? 'Raise' : who === 'king' ? 'Speak' : 'Sit', { once: cue === 'glow', alternatives: ['Sit'] }); look.kingSkin.update(dt); }
    },
  };
}
