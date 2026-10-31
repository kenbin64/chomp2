// sidequest.js
// Sidequests in a level (Ken, 2026-10-18): one group of visitors has lost
// something. Step inside their circle and they ask; the thing then glints
// wherever it is (at the bottom of the lagoon, up a lamp post, out on the
// pier); pick it up and take it back for Tourist Tokens and a gift. The rules
// are in sidequest-rules.js.
//
//   startQuest({ land, clusters, spot(where): { x, y, z }, feed(), say(cluster, text), toast(text) })
//   then each frame: questStep(dt, t, events from clusters.update, Wally's position)

import * as THREE from 'three';
import { readProgress, saveProgress } from './progress.js';
import { pickQuest, nextStage, questReward } from './sidequest-rules.js';
import { makeOffer, giftText, applyGift } from './trade-rules.js';
import { bookEvent, bookFound } from './book.js';
import { Pickups } from './pickups.js';

let q = null, panel = null, cfg = null;
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function load() { return readProgress((() => { try { return localStorage.getItem('chomp-progress'); } catch { return null; } })()); }

// The lost thing: a bright parcel with a ribbon, so it reads as "the thing they lost" anywhere.
function lostThing() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x2fa8e0, roughness: 0.5, emissive: 0x0a2a40 }));
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.1), new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.4 }));
  const r2 = r1.clone(); r2.rotation.y = Math.PI / 2;
  g.add(box, r1, r2);
  return g;
}

function bangSign() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = '#ffd166'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#102030'; g.font = 'bold 96px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.fillText('!', 64, 98);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  s.scale.setScalar(1.1); s.position.y = 3.6; s.userData.noAO = true;
  return s;
}

function say(text, button = null) {
  if (!panel) { panel = el('div', 'trade-panel quest-panel'); panel.append(el('b', 'trade-title', 'A favour!'), el('p', 'trade-text'), el('div', 'trade-buttons')); document.body.append(panel); }
  panel.querySelector('.trade-text').textContent = text;
  const bs = panel.querySelector('.trade-buttons'); bs.innerHTML = '';
  const ok = el('button', 'buy', button || 'Righto!'); ok.type = 'button'; ok.onclick = () => { panel.hidden = true; }; bs.append(ok);
  panel.hidden = false;
  clearTimeout(say.timer); say.timer = setTimeout(() => { if (panel) panel.hidden = true; }, 9000);
}

export function startQuest(options) {
  cfg = options;
  const quest = pickQuest(cfg.land, Math.random, load());
  if (!quest) return;
  cfg.clusters.enableQuest();
  const giver = cfg.clusters.list.find(c => c.questGiver);
  if (!giver) return;
  q = { quest, giver, stage: 'hidden', item: null };
  if (typeof window !== 'undefined') window.__quest = q;            // for testing in the browser console
}

export function questStep(dt, t, events, pos) {
  if (!q || q.stage === 'done') return;
  for (const e of events) {
    if (e.type !== 'quest' || e.cluster !== q.giver) continue;
    if (q.stage === 'hidden') {
      q.stage = nextStage(q.stage, 'met');
      const s = cfg.spot(q.quest.where, q.giver);
      q.item = new Pickups(cfg.scene, [s], lostThing, { glint: 2.6 });
      q.sign = bangSign(); q.giver.root.add(q.sign);
      say(`"Oi, Wally! ${q.quest.ask}"`);
      cfg.say(q.giver, 'Could you help us out, mate?');
    } else if (q.stage === 'carrying') {
      q.stage = nextStage(q.stage, 'returned');
      let p = questReward(load());
      const gift = makeOffer(cfg.land, Math.random, p).gift;          // the same kinds of gift the traders give
      saveProgress(applyGift(p, gift));
      if (gift.kind === 'feed') cfg.feed();
      if (q.sign) q.sign.visible = false;
      say(`"You little ripper! Thanks for the ${q.quest.thing}." You get 3 Tourist Tokens and ${giftText(gift)}.`, 'No worries!');
      cfg.say(q.giver, 'Legend! Thanks, Wally!');
      bookEvent('sidequest');
      bookFound(gift.kind === 'item' ? gift.id : 'token');
    } else if (q.stage === 'asked') say(`"Any luck with my ${q.quest.thing}, Wally?"`, 'On it!');
  }
  if (q.item && q.stage === 'asked') {
    if (q.item.update(dt, t, pos).length) {
      q.stage = nextStage(q.stage, 'found');
      cfg.toast(`Found the ${q.quest.thing}! Take it back to them`);
      cfg.say(null, `Got the ${q.quest.thing}!`);
    }
  } else if (q.item) q.item.update(dt, t, { x: 1e6, y: 0, z: 1e6 });      // keep the carried-off one animating away
  if (q.sign) q.sign.position.y = 3.6 + Math.sin(t * 3) * 0.12;
}
