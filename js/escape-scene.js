// escape-scene.js
// The cut scene as Wally breaks out (Ken, 2026-10-30; every new level opens with one): the siren, the wrangler alerted
// and after him, the park locking down, what he has to find. Each shot is a camera move and a line; any key or tap skips.

import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// shots(at): [{ s: seconds, line, who?, from, to, lookFrom, lookTo, cue? }]. cue runs as the shot begins.
export function createEscapeScene(camera) {
  const look = V(0, 0, 0), posNow = V(0, 0, 0);
  const box = document.createElement('div'); box.className = 'escape-scene'; box.hidden = true;
  box.innerHTML = '<div class="cine-bar top"></div><div class="cine-bar bottom"></div><div class="siren"></div><p class="escape-line"></p><small class="escape-skip">Tap or press a key to skip</small>';
  document.body.append(box);
  const lineEl = box.querySelector('.escape-line'), sirenEl = box.querySelector('.siren');
  let shots = [], k = 0, t = 0, done = null, armed = 0;

  const say = shot => {
    lineEl.textContent = '';
    if (shot.who) { const b = document.createElement('b'); b.textContent = `${shot.who}: `; lineEl.append(b); }
    lineEl.append(shot.line);
    lineEl.classList.toggle('big', !!shot.big);
    if (shot.cue) shot.cue();
  };
  const end = () => {
    if (!scene.active) return;
    scene.active = false; box.hidden = true; document.body.classList.remove('in-cut');
    removeEventListener('keydown', skip); removeEventListener('pointerdown', skip);
    for (const s of shots.slice(k + 1)) if (s.cue) s.cue();      // what was skipped still happens
    const then = done; done = null; if (then) then();
  };
  const skip = () => { if (armed <= 0) end(); };

  const scene = {
    active: false,
    end,
    play(list, then, { siren = true } = {}) {
      sirenEl.hidden = !siren;
      shots = list; k = 0; t = 0; done = then; armed = 0.4;      // (the key he was holding as he ran out does not count)
      scene.active = true; box.hidden = false; document.body.classList.add('in-cut');
      say(shots[0]);
      addEventListener('keydown', skip); addEventListener('pointerdown', skip);
    },
    step(dt) {
      if (!scene.active) return;
      armed -= dt; t += dt;
      if (t >= shots[k].s) {
        t = 0; k++;
        if (k >= shots.length) { k = shots.length - 1; end(); return; }
        say(shots[k]);
      }
    },
    // The camera, each frame while it plays.
    place() {
      const s = shots[k], u = Math.min(1, t / s.s), e = u * u * (3 - 2 * u);
      posNow.lerpVectors(s.from, s.to, e); look.lerpVectors(s.lookFrom, s.lookTo, e);
      camera.position.copy(posNow); camera.lookAt(look);
    },
  };
  return scene;
}
