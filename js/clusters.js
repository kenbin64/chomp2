// clusters.js
// Groups of people around a level, each with a limited supply of food. The
// sweet spot (rules.clusterStep) decides what they do: too far and they have not
// noticed Wally; in the green ring they throw to him; inside the red ring they
// get nervous, and if he stays there they run off and their food goes with them.

import * as THREE from 'three';
import { CLUSTER, clusterStep } from './rules.js';
import { person, wearModel, Cast } from './tourists.js';
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

export class Clusters {
  // heightAt(x, z): the floor height where people stand.
  constructor(scene, heightAt, bubbles) {
    this.scene = scene; this.heightAt = heightAt; this.bubbles = bubbles;
    this.list = [];
    this.models = [];
  }

  // Wear Ken's people on every group here now and every group that arrives
  // later, from the scene's Cast (tourists.js): no character is in the scene
  // twice (Ken). A list of models makes a Cast of its own.
  useModels(cast) {
    this.cast = Array.isArray(cast) ? new Cast(cast) : cast;
    if (!this.cast || !this.cast.size) { this.cast = null; return; }
    // Share people out across the groups here now: one each first, then more.
    const groups = this.list.filter(c => !c.gone);
    let round = 0, any = true;
    while (any) {
      any = false;
      for (const c of groups) {
        const p = c.people[round];
        if (!p || p.skin) continue;
        const g = this.cast.take();
        if (g) { this.wearOne(p, g); any = true; }
      }
      round++;
    }
    for (const c of groups) this.settle(c);
    // The biggest group can lend someone to a new group that has nobody.
    this.cast.lenders.push(except => {
      const big = this.list.filter(c => !c.gone && c !== except && c.people.filter(p => p.skin).length > 1)
        .sort((a, b) => b.people.length - a.people.length)[0];
      if (!big) return null;
      const p = big.people.filter(x => x.skin).pop();
      big.people.splice(big.people.indexOf(p), 1); p.g.removeFromParent();
      return p.skin.cast;
    });
  }
  wearOne(p, gltf) {
    p.skin = wearModel(p, gltf);
    if (p.skin && p.skin.phone) p.phone = p.skin.phone;
  }
  // A group arriving now: as many people as are free; at least one, borrowed if need be.
  wearGroup(c) {
    if (!this.cast) return;
    for (const p of c.people) { const g = this.cast.take(); if (g) this.wearOne(p, g); }
    if (!c.people.some(p => p.skin)) { const g = this.cast.borrow(c); if (g) this.wearOne(c.people[0], g); }
    this.settle(c);
  }
  // Members left without a person of their own step out of the group.
  settle(c) {
    if (!c.people.some(p => p.skin)) return;              // no people models at all: keep the stand-ins
    for (const p of c.people.filter(x => !x.skin)) p.g.removeFromParent();
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
    this.list.push(c);
    this.wearGroup(c);
    return c;
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
      const mood = clusterStep(c.state, dist, dt, c.food);
      if (c.rate !== 1 && mood === 'throw') c.state.cooldown *= c.rate;
      c.mood = mood;

      if (mood === 'throw' && c.food > 0) {
        const thrower = c.people[Math.floor(Math.random() * c.people.length)];
        const hand = thrower.g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.9, 0));
        const item = throwFrom(hand, c);
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
      if (this.cast) for (const p of c.people) if (p.skin) this.cast.give(p.skin.cast);   // free for the next group
    }
  }
}
