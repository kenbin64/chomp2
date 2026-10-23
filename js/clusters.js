// clusters.js
// Groups of people around a level, each with a limited supply of food. The
// sweet spot (rules.clusterStep) decides what they do: too far and they have not
// noticed Wally; in the green ring they throw to him; inside the red ring they
// get nervous, and if he stays there they run off and their food goes with them.

import * as THREE from 'three';
import { CLUSTER, clusterStep } from './rules.js';
import { person, wearModel } from './tourists.js';
import { pickTraders } from './trade-rules.js';
import { pickLine } from './bubbles.js';

function ringMesh(inner, outer, color, opacity) {
  const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 4;
  return m;
}

// A small sign over a group: how much food they have left.
function countSprite() {
  const c = document.createElement('canvas'); c.width = 160; c.height = 72;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.6, 0.72, 1); s.renderOrder = 9;
  s.userData.draw = n => {
    const g = c.getContext('2d'); g.clearRect(0, 0, 160, 72);
    g.fillStyle = 'rgba(20,40,55,0.8)'; g.beginPath(); g.roundRect(4, 4, 152, 64, 30); g.fill();
    g.font = '700 40px "Baloo 2", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = n > 0 ? '#ffe066' : '#9aa7b0';
    g.fillText(n > 0 ? `\u{1F354} ${n}` : 'empty', 80, 38);
    tex.needsUpdate = true;
  };
  return s;
}

// How far apart two groups must be to share a person: beyond what is seen at once.
const SEEN = 90;

export class Clusters {
  // heightAt(x, z): the floor height where people stand.
  constructor(scene, heightAt, bubbles) {
    this.scene = scene; this.heightAt = heightAt; this.bubbles = bubbles;
    this.list = [];
    this.models = [];
  }

  // Wear Ken's people on every group here now and every group that arrives later.
  // Ken (2026-10-20): no one twice anywhere in view. A group takes only people not
  // standing in another group within SEEN metres, nor out walking (othersUsed, the
  // strollers); if nobody is free, a stroller steps in (borrow). A Cast or a list
  // of models both work.
  useModels(cast) {
    const list = Array.isArray(cast) ? cast : cast && cast.all ? cast.all : [];
    this.models = list;
    if (!list.length) return;
    for (const c of this.list) if (!c.gone) this.wearGroup(c);
  }
  wearOne(p, gltf) {
    p.skin = wearModel(p, gltf);
    if (p.skin && p.skin.phone) p.phone = p.skin.phone;
  }
  // The people worn by groups still here (within `within` metres of `pos`, if given).
  worn(pos = null, within = Infinity, except = null) {
    const out = new Set();
    for (const c of this.list) {
      if (c.gone || c === except) continue;
      if (pos && Math.hypot(c.root.position.x - pos.x, c.root.position.z - pos.z) > within) continue;
      for (const p of c.people) if (p.skin && p.skin.cast) out.add(p.skin.cast);
    }
    return out;
  }
  // Each member a different person, and nobody already seen nearby.
  wearGroup(c) {
    if (!this.models || !this.models.length || c.dressed) return;
    c.dressed = true;
    const used = this.worn(c.root.position, SEEN, c);
    if (this.othersUsed) for (const g of this.othersUsed()) used.add(g);
    const pool = this.models.filter(g => !used.has(g)).sort(() => Math.random() - 0.5);
    c.people.forEach((p, i) => { const g = pool[i] || (this.borrow && this.borrow()); if (g) this.wearOne(p, g); });
    for (const p of c.people.filter(x => !x.skin)) p.g.removeFromParent();     // only if a group is bigger than the cast
    c.people = c.people.filter(x => x.skin);
  }

  // Put a group at (x, z). food: how many pieces they brought. rate < 1 throws faster.
  add({ x, z, size = 3, food = 6, rate = 1, ring = true }) {
    const root = new THREE.Group();
    const y = this.heightAt(x, z);
    root.position.set(x, y, z);
    this.scene.add(root);
    const people = [];
    for (let i = 0; i < size; i++) {
      const p = person();
      const a = (i / size) * Math.PI * 2 + Math.random() * 0.4, r = size > 1 ? 1.1 : 0;
      p.g.position.set(Math.cos(a) * r, this.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r) - y, Math.sin(a) * r);
      root.add(p.g); people.push({ ...p, phase: Math.random() * 6 });
    }
    const outer = ringMesh(CLUSTER.near + 0.2, CLUSTER.near + 4, 0x6ccf5a, 0.18);
    const inner = ringMesh(CLUSTER.near - 0.15, CLUSTER.near + 0.15, 0xff5a67, 0.55);
    outer.position.y = inner.position.y = 0.06;
    if (ring) root.add(outer, inner);
    const sign = countSprite(); sign.position.y = 2.6; root.add(sign); sign.userData.draw(food);
    const c = { root, people, outer, inner, sign, food, start: food, rate, state: { nerves: 0, cooldown: 0.8 },
                mood: 'unaware', fled: false, flee: 0, gone: false, warned: false };
    if (this.traderChance && Math.random() < this.traderChance) c.trader = true;
    this.list.push(c);
    this.wearGroup(c);
    return c;
  }

  // The game's marks on each group (the sweet-spot rings and the food count): off
  // during the opening, when the visitors are just people in the park.
  showMarks(on) {
    for (const c of this.list) { c.outer.visible = c.inner.visible = on; if (!c.fled) c.sign.visible = on; }
  }

  // Some groups are traders this visit (trade-rules.js): a random pick now,
  // and the same chance for every group that arrives later.
  enableTraders(chance = 0.25) {
    this.traderChance = chance;
    for (const i of pickTraders(this.list.length, Math.random, chance)) this.list[i].trader = true;
  }
  // One group this visit has a sidequest (Ken): never a trader.
  enableQuest() {
    const pool = this.list.filter(c => !c.trader && !c.gone);
    if (pool.length) pool[Math.floor(Math.random() * pool.length)].questGiver = true;
  }
  // A sign over a trader group once Wally has found them.
  tradeSign(c) {
    if (c.tradeSign) { c.tradeSign.visible = true; return; }
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
    const g = cv.getContext('2d'); g.fillStyle = 'rgba(20,40,60,0.85)'; g.beginPath(); g.roundRect(4, 4, 248, 88, 40); g.fill();
    g.fillStyle = '#ffd166'; g.font = 'bold 44px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.fillText('Trade?', 128, 63);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    s.scale.set(2.2, 0.82, 1); s.position.y = 3.5; s.userData.noAO = true;
    c.root.add(s); c.tradeSign = s;
  }

  get active() { return this.list.filter(c => !c.gone); }

  // throwFrom(hand, cluster) launches one piece. Returns events for the game:
  // { type: 'throw' | 'nervous' | 'flee' | 'empty', cluster }.
  update(dt, t, wallyPos, throwFrom) {
    const events = [];
    for (const c of this.list) {
      if (c.gone) continue;
      const centre = c.root.position;
      const dist = Math.hypot(wallyPos.x - centre.x, wallyPos.z - centre.z);
      // Rings show only when Wally is near enough for them to matter.
      const show = Math.max(0, Math.min(1, (CLUSTER.far + 6 - dist) / 6));
      c.outer.material.opacity = 0.18 * show * (c.food > 0 && !c.fled ? 1 : 0);
      c.inner.material.opacity = 0.55 * show * (c.fled ? 0 : 1);

      if (c.fled) { this.runAway(c, dt, wallyPos); continue; }
      // Fed out to the last bite: a few seconds later they head off home, which frees
      // them for the groups still to come (nobody twice in view).
      if (c.counted && c.food <= 0) {
        c.leaveIn = (c.leaveIn ?? 6) - dt;
        if (c.leaveIn <= 0) {
          c.fled = true; c.flee = 5; c.sign.visible = false;
          c.awayFrom = new THREE.Vector3(centre.x - wallyPos.x, 0, centre.z - wallyPos.z).normalize();
          continue;
        }
      }
      let mood = clusterStep(c.state, dist, dt, c.food, this.calm || 1, this.panic || undefined);   // calm, panic: park-ease.js
      if (c.rate !== 1 && mood === 'throw') c.state.cooldown *= c.rate;
      // Traders (Ken): they never run off. Stepping inside their circle is the
      // only way to find out who they are, and brings their offer (trade.js).
      if ((c.trader || c.questGiver) && (mood === 'flee' || mood === 'nervous')) mood = 'watch';
      // The sidequest group (sidequest.js): the same, and they speak up each time he comes in.
      if (c.questGiver) {
        if (dist < CLUSTER.near + 0.3 && !c.questIn) { c.questIn = true; events.push({ type: 'quest', cluster: c }); }
        else if (dist > CLUSTER.near + 3) c.questIn = false;
      }
      if (c.trader && !c.traded) {
        if (dist < CLUSTER.near + 0.3 && !c.offered) { c.offered = true; this.tradeSign(c); events.push({ type: 'trade', cluster: c }); }
        else if (dist > CLUSTER.near + 3) c.offered = false;
      }
      c.mood = mood;

      if ((mood === 'throw' || mood === 'hand') && c.food > 0) {
        const thrower = c.people[Math.floor(Math.random() * c.people.length)];
        const hand = thrower.g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.9, 0));
        const item = throwFrom(hand, c, mood === 'hand', thrower);   // up close: a gentle handout to his mouth
        if (item) item.cluster = c;
        thrower.throwing = 0.4;
        c.food--; c.sign.userData.draw(c.food);
        events.push({ type: 'throw', cluster: c, thrower });
        if (c.food === 0) events.push({ type: 'empty', cluster: c });
      } else if (mood === 'nervous' && !c.warned) {
        c.warned = true;
        this.bubbles.say(c.people[0].g, pickLine('touristNervous'), 2.4);
        events.push({ type: 'nervous', cluster: c });
      } else if (mood === 'flee') {
        c.fled = true; c.flee = 5;
        c.awayFrom = new THREE.Vector3(centre.x - wallyPos.x, 0, centre.z - wallyPos.z).normalize();
        this.bubbles.say(c.people[0].g, pickLine('touristFlee'), 2.4);
        c.sign.visible = false;
        events.push({ type: 'flee', cluster: c });
      }
      if (mood !== 'nervous') c.warned = c.warned && dist <= CLUSTER.near + 1;

      this.bodyLanguage(c, dt, mood, wallyPos, dist);
    }
    return events;
  }

  // What each person is doing. Throwing and nerves come first; otherwise they
  // watch Wally, take photos of him, wave, point him out, chat to each other,
  // and cheer when he catches what they threw.
  bodyLanguage(c, dt, mood, wallyPos, dist) {
    const centre = c.root.position;
    c.people.forEach((p, i) => {
      p.phase += dt;
      p.throwing = Math.max(0, (p.throwing || 0) - dt);
      p.cheer = Math.max(0, (p.cheer || 0) - dt);
      p.actLeft = (p.actLeft || 0) - dt;
      if (p.actLeft <= 0) {
        const choices = ['watch', 'watch', 'wave', 'point', 'chat'];
        if (p.phone) choices.push('photo', 'photo');
        p.act = dist < CLUSTER.far + 8 ? choices[Math.floor(Math.random() * choices.length)] : 'chat';
        p.actLeft = 1.5 + Math.random() * 3;
      }
      const toWally = Math.atan2(wallyPos.x - (centre.x + p.g.position.x), wallyPos.z - (centre.z + p.g.position.z));
      const neighbour = c.people[(i + 1) % c.people.length];
      const toFriend = Math.atan2(neighbour.g.position.x - p.g.position.x, neighbour.g.position.z - p.g.position.z);
      p.g.rotation.y = toWally;
      const [L, R] = p.arms, Le = L.userData.elbow, Re = R.userData.elbow;
      let lx = Math.sin(p.phase * 2 + i) * 0.08, rx = Math.sin(p.phase * 2.3 + i) * 0.08, lz = 0, rz = 0, le = -0.25, re = -0.25;
      let headY = 0, headX = 0, hop = 0;
      const nervous = mood === 'nervous';
      if (nervous) { lx = rx = -2.8; le = re = -0.2; headX = 0.1; }
      else if (p.cheer > 0) {                                          // he caught their throw!
        lx = rx = -2.9 + Math.sin(p.phase * 18) * 0.15; le = re = 0;
        hop = Math.abs(Math.sin(p.cheer * Math.PI * 2.5)) * 0.25;
      } else if (p.throwing > 0) { rx = -2.7; re = -0.3; lx = -0.6; }
      else if (p.act === 'photo') { rx = -1.0; re = -1.0; lx = -0.9; le = -1.1; headX = 0.05; }    // phone held up in front, at eye level
      else if (p.act === 'wave') { rx = -2.6; rz = -0.3 + Math.sin(p.phase * 9) * 0.4; re = -0.3; }
      else if (p.act === 'point') { rx = -1.55; re = 0; }
      else if (p.act === 'chat') { headY = Math.atan2(Math.sin(toFriend - toWally), Math.cos(toFriend - toWally)) * 0.8; lx = -0.5 + Math.sin(p.phase * 4) * 0.3; le = -0.9; }
      else headY = Math.sin(p.phase * 0.7 + i) * 0.25;                 // watching, glancing about
      L.rotation.set(lx, 0, lz); R.rotation.set(rx, 0, rz);
      Le.rotation.x = le; Re.rotation.x = re;
      p.head.rotation.set(headX + Math.sin(p.phase * 1.3) * 0.03, headY, Math.sin(p.phase * 1.5 + i) * 0.05);
      p.g.position.y = (p.baseY ?? (p.baseY = p.g.position.y)) + hop;
      p.legs[0].rotation.x = p.legs[1].rotation.x = 0;
      if (p.skin) this.act(p, dt, nervous);
      // A camera flash now and then while taking a photo.
      if (p.act === 'photo' && p.phone && Math.random() < dt * 0.6) this.flash(p.phone);
    });
  }

  // Before play starts (the fly-over): everyone just watching, so nobody stands frozen.
  idle(dt) {
    for (const c of this.list) for (const p of c.people) if (p.skin) { p.skin.play('idle'); p.skin.update(dt); }
  }

  // A person wearing a model plays the move for what they are doing.
  act(p, dt, nervous) {
    const k = p.skin;
    p.g.position.y = p.baseY;                                  // the moves carry their own hops
    if (nervous) k.play('nervous', { alternatives: ['idle'] });
    else if (p.cheer > 0) k.play('cheer', { alternatives: ['idle'] });
    else if (p.throwing > 0) k.play('throw', { once: true, fit: 0.45, alternatives: ['idle'] });
    else k.play({ photo: 'photo', wave: 'wave', point: 'point', chat: 'chat' }[p.act] || 'idle', { alternatives: ['idle'] });
    if (k.phone) k.phone.visible = !nervous && !(p.cheer > 0) && !(p.throwing > 0) && p.act === 'photo';
    k.update(dt);
  }

  flash(phone) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
    s.scale.setScalar(0.5); phone.getWorldPosition(s.position);
    this.scene.add(s);
    let life = 0.12;
    const fade = () => { life -= 0.016; s.material.opacity = Math.max(0, life / 0.12); if (life > 0) requestAnimationFrame(fade); else { this.scene.remove(s); s.material.dispose(); } };
    requestAnimationFrame(fade);
  }

  // Wally caught something this group threw: they cheer.
  cheer(c) {
    if (!c || c.fled) return;
    for (const p of c.people) p.cheer = 1.2;
  }

  runAway(c, dt, wallyPos) {
    c.flee -= dt;
    c.root.position.addScaledVector(c.awayFrom, dt * 5);
    for (const p of c.people) {
      p.phase += dt * 12;
      p.g.rotation.y = Math.atan2(c.awayFrom.x, c.awayFrom.z);
      p.legs[0].rotation.x = Math.sin(p.phase) * 0.9; p.legs[1].rotation.x = -Math.sin(p.phase) * 0.9;
      p.arms[0].rotation.x = -2.6; p.arms[1].rotation.x = -2.6;          // hands up, running
      if (p.skin) { p.skin.play('run', { speed: 1.3, alternatives: ['walk'] }); if (p.skin.phone) p.skin.phone.visible = false; p.skin.update(dt); }
    }
    if (c.flee <= 0) {
      this.scene.remove(c.root); c.gone = true;
    }
  }
}
