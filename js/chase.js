// chase.js
// The croc catcher (Ken's croc wrangler, models/croc-wrangler.glb): one man who works for the park.
// He walks the visitors' path while Wally is in the enclosure; once Wally is out of the gate he comes
// running, and the chase is on (chase-rules.js has the rules: what he sees, how he moves, when he has
// lost Wally). Without the model file he is a stand-in figure in a khaki uniform.

import * as THREE from 'three';
import { person } from './tourists.js';
import { dress } from './models.js';
import { BANK_Y, DECK_OPENINGS, onDeck, deckHeight } from './rules.js';
import { SOLIDS } from './ground.js';
import { kioskSpots, STAND } from './rules.js';
import { PATROL, GATE_POST, afterCatches, catcherHelps, PENS, OUTER, penShape, boxEdges, deckRails, segmentDistance, clampOutside, newCatcher, catcherStep, alertCatcher } from './chase-rules.js';
import { sectionScreens, sectionHops } from './park-sections.js';
import { Nav, nextStep, solidsIndex } from './nav.js';

const HEIGHT = 1.85, PLAN_ROOM = 0.7;
const POST = PATROL[6];          // where he starts, and goes back to after a catch: on the far side, near the way out

export class Catcher {
  constructor(scene, gltf) {
    this.g = new THREE.Group(); scene.add(this.g);
    this.body = person({ shirt: 0xb59a64, shorts: 0x6b5a3e, cap: 0x5a4a32 });
    this.g.add(this.body.g);
    this.skin = dress(this.g, gltf, { height: HEIGHT });
    const phone = this.skin && this.skin.root.getObjectByName('HeldPhone');
    if (phone) phone.visible = false;                         // the visitors' photo phone: not his
    // What he cannot see through (the pens' shade-cloth, the stands) and cannot walk through (anything
    // solid to Wally, and the boardwalk's railings).
    const rails = [...deckRails(DECK_OPENINGS), ...sectionHops()];   // (he cannot hop the low walls, as Wally can)
    this.world = {
      screens: [...PENS.flatMap(p => penShape(p).walls), ...kioskSpots().flatMap(k => boxEdges(k, STAND.w, STAND.d)), ...sectionScreens()],
      clamp: clampOutside,
      free: (x, z) => {
        if (!this.solid) this.solid = solidsIndex(SOLIDS, 0.35);   // made on first use: everything solid is placed by then
        return !this.solid(x, z) && !rails.some(r => segmentDistance(x, z, r) < 0.35);
      },
      // The full way-finding, made the first time it is needed (everything solid has been placed by then).
      route: (c, tx, tz) => {
        if (!this.nav) {
          // Planned with more room than he walks with, or the way hugs corners and he wedges on them (by the snake pit).
          const roomy = solidsIndex(SOLIDS, PLAN_ROOM), clear = (x, z) => !roomy(x, z) && !rails.some(r => segmentDistance(x, z, r) < PLAN_ROOM);
          this.nav = new Nav({ x0: -OUTER.rx, x1: OUTER.rx, z0: -OUTER.rz, z1: OUTER.rz }, (x, z) => { const p = clampOutside(x, z); return p.x === x && p.z === z && clear(x, z); });
        }
        return nextStep(this.nav, c, tx, tz);
      },
    };
    this.walk = 0;
    this.reset();
  }

  reset() { this.state = newCatcher(POST); this.place(); }

  // What is solid has changed (the walls came up): work the way-finding out again when next needed.
  forget() { this.solid = this.nav = null; }

  // Wally is out of the gate: the catcher is there, and after him.
  // hold: seconds' start for Wally.
  alert(at, hold = 0) { this.state = newCatcher(GATE_POST); alertCatcher(this.state, at, hold); this.place(); }
  // On Wally's side now: off to wait at (x, z).
  helps(at) { catcherHelps(this.state, at); }
  // Out again after being caught this many times.
  alertAgain(at, caught) { const { hold, pace } = afterCatches(caught); this.state = newCatcher(GATE_POST); alertCatcher(this.state, at, hold, pace); this.place(); }

  get mode() { return this.state.mode; }
  get pos() { return this.g.position; }

  // One frame. wally: { x, z, out }. Returns 'spotted', 'lost', 'caught' or null.
  update(dt, wally) {
    const event = catcherStep(this.state, wally, dt, this.world);
    this.place();
    const sp = this.state.speed;
    if (this.skin) {
      if (sp > 3) this.skin.play('run', { speed: sp / 5 });
      else if (sp > 0.2) this.skin.play('walk', { speed: sp / 1.6 });
      else this.skin.play('idle');
      this.skin.update(dt);
    } else {                                                  // the stand-in: swing the arms and legs
      this.walk += dt * sp * 4;
      const swing = sp > 0.2 ? Math.sin(this.walk) * Math.min(1, sp / 3) * 0.8 : 0;
      this.body.legs[0].rotation.x = swing; this.body.legs[1].rotation.x = -swing;
      this.body.arms[0].rotation.x = -swing * 0.7; this.body.arms[1].rotation.x = swing * 0.7;
    }
    return event;
  }

  place() {
    const s = this.state;
    this.g.position.set(s.x, onDeck(s.x, s.z) ? deckHeight(s.x) : BANK_Y, s.z);
    this.g.rotation.y = s.heading;
  }
}
