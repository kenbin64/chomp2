// daynight.js
// Day and night for any level (Ken, 2026-10-18): now and then it gets dark,
// the street lamps come on, and the moon is up, placed and lit the way it
// really is from Cairns tonight. The timing and the moon's geometry are in
// sky-rules.js (tested); this file does the drawing.
//
// At night:
//   - the sun light turns into moonlight: cool, dim, from the moon's direction
//     (so the moon casts the night's soft shadows);
//   - the sky fill, the light reflected from the sky and the fog darken;
//   - unlit backdrops (sky dome, distant ranges) darken with them;
//   - a starry night dome fades in over the day sky;
//   - the moon shows its real phase for today's date, lit from the side the
//     sun really is on, so it is the southern hemisphere's moon.
// ?night on the page address starts at night (?day keeps it day), for testing.

import * as THREE from 'three';
import { CYCLE, nightAmount, nightProgress, moonDirection, moonSunDirection, moonElongation, moonLit } from './sky-rules.js';

const MOON_LIGHT = new THREE.Color(0x9fb4ff);
const NIGHT_FOG = new THREE.Color(0x0b1528);
const NIGHT_HEMI_SKY = new THREE.Color(0x2a3c66), NIGHT_HEMI_GROUND = new THREE.Color(0x10141c);
const BACKDROP_NIGHT = new THREE.Color(0.16, 0.19, 0.3);

// The night sky: deep blue overhead, a little lighter at the horizon, and stars
// that twinkle. Drawn on a dome round the camera, fading in with the night.
function nightDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { night: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float night; uniform float time; varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      void main() {
        float up = clamp(vDir.y, 0.0, 1.0);
        vec3 sky = mix(vec3(0.07, 0.10, 0.20), vec3(0.015, 0.025, 0.07), pow(up, 0.6));
        vec3 cell = floor(vDir * 260.0);
        float h = hash(cell);
        float star = step(0.9965, h) * smoothstep(0.02, 0.25, vDir.y);
        float twinkle = 0.6 + 0.4 * sin(time * (1.5 + h * 3.0) + h * 40.0);
        sky += vec3(0.9, 0.95, 1.0) * star * twinkle * (0.5 + 0.5 * hash(cell + 7.0));
        gl_FragColor = vec4(sky, night * 0.94);
      }`,
    transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(385, 48, 24), mat);
  dome.renderOrder = -2; dome.frustumCulled = false; dome.userData.noAO = true; dome.userData.glow = true;
  return dome;
}

// The moon: a sphere shaded in the shader by where the sun really is, so its
// lit part is the real phase and faces the right way. A faint earthshine keeps
// the dark part just visible, and a soft halo round it.
function moonModel() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: new THREE.Vector3(0, 0, 1) }, night: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main() { vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 sunDir; uniform float night; varying vec3 vN; varying vec3 vP;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      float noise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main() {
        float lit = smoothstep(-0.04, 0.12, dot(normalize(vN), normalize(sunDir)));
        vec3 q = normalize(vP) * 3.0;
        float maria = smoothstep(0.42, 0.62, noise(q) * 0.6 + noise(q * 2.3) * 0.4);
        float craters = noise(q * 9.0) * 0.12;
        vec3 face = mix(vec3(0.86, 0.85, 0.80), vec3(0.42, 0.43, 0.44), maria) - craters;
        vec3 col = face * (0.012 + 0.9 * lit);                 // the dark side just shows (earthshine)
        gl_FragColor = vec4(col, night);
      }`,
    transparent: true, depthWrite: false, fog: false, toneMapped: false,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 24), mat);
  moon.renderOrder = -1; moon.userData.noAO = true; moon.userData.glow = true; moon.frustumCulled = false;
  return moon;
}

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(210,225,255,0.55)'); grd.addColorStop(0.3, 'rgba(170,195,255,0.18)'); grd.addColorStop(1, 'rgba(150,180,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class DayNight {
  // sun: the level's sun DirectionalLight. north: the level's north, flat ([x, 0, z]).
  // start: seconds into the cycle to begin at (random through the day if left out).
  constructor(scene, { sun, north = [0, 0, -1], start = null, date = new Date() } = {}) {
    this.scene = scene; this.sun = sun; this.north = north;
    const params = new URLSearchParams(location.search);
    this.t = params.has('night') ? CYCLE.day + CYCLE.dusk + 5 : start ?? Math.random() * CYCLE.day * 0.8;
    this.frozen = params.has('day') ? 0 : null;
    this.elongation = moonElongation(date); this.lit = moonLit(date);
    this.dome = nightDome(); scene.add(this.dome);
    this.moon = moonModel(); scene.add(this.moon);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.halo.scale.setScalar(70); this.halo.userData.noAO = true; this.halo.userData.glow = true; scene.add(this.halo);
    this.base = null;                 // the level's own day lighting, read on the first frame
    this.fogs = new Map(); this.backdrops = new Map(); this.scanIn = 0;
    this.night = 0;
  }

  // Remember the day settings the level set up.
  readBase() {
    const lights = [];
    this.scene.traverse(o => { if (o.isLight && o !== this.sun && !o.userData.lamp) lights.push({ o, intensity: o.intensity, color: o.color.clone(), ground: o.groundColor ? o.groundColor.clone() : null }); });
    this.base = { lights, sunIntensity: this.sun.intensity, sunColor: this.sun.color.clone(),
                  sunDir: this.sun.position.clone().sub(this.sun.target.position).normalize(), reach: this.sun.position.distanceTo(this.sun.target.position) || 100,
                  env: this.scene.environmentIntensity ?? 1, bg: this.scene.backgroundIntensity ?? 1 };
    this.water = [];
    this.scene.traverse(o => { const u = o.material && o.material.uniforms; if (u && u.sunColor) this.water.push({ u, color: u.sunColor.value.clone(), body: u.waterColor ? u.waterColor.value.clone() : null }); });
  }

  // Unlit backdrops (sky dome, ranges, horizon paintings) darken at night: any
  // solid unlit material that is not a light itself.
  scanBackdrops() {
    this.scene.traverse(o => {
      if (!o.isMesh || o.userData.glow) return;
      for (const m of [].concat(o.material)) {
        if (m && m.isMeshBasicMaterial && !m.transparent && !this.backdrops.has(m)) this.backdrops.set(m, m.color.clone());
      }
    });
  }

  // Each frame, after the level has moved its sun. Returns how dark it is (0 to 1).
  update(dt, camera) {
    if (!this.base) { this.readBase(); this.scanBackdrops(); }
    if ((this.scanIn -= dt) <= 0) { this.scanIn = 3; this.scanBackdrops(); }
    if (this.frozen === null) this.t += dt;
    const n = this.frozen ?? nightAmount(this.t);
    this.night = n;
    const B = this.base;

    // The moon on its way across the northern sky, and the light on its face.
    const md = moonDirection(nightProgress(this.t), this.north);
    const moonDir = new THREE.Vector3(...md);
    const sd = moonSunDirection(md, this.elongation, this.north);
    const cam = camera.position;
    this.dome.position.copy(cam); this.dome.material.uniforms.night.value = n; this.dome.material.uniforms.time.value += dt;
    this.moon.position.copy(cam).addScaledVector(moonDir, 330);
    this.moon.material.uniforms.sunDir.value.set(...sd); this.moon.material.uniforms.night.value = n;
    this.halo.position.copy(this.moon.position); this.halo.material.opacity = n * (0.3 + 0.7 * this.lit);
    const moonUp = moonDir.y > -0.05;
    this.moon.visible = this.halo.visible = n > 0.02 && moonUp;
    this.dome.visible = n > 0.01;

    // Sunlight into moonlight: colour, strength and direction.
    const moonPower = 0.1 + 0.16 * this.lit;
    this.sun.color.copy(B.sunColor).lerp(MOON_LIGHT, n);
    this.sun.intensity = B.sunIntensity * ((1 - n) + n * moonPower);
    const dir = B.sunDir.clone().lerp(moonUp ? moonDir : new THREE.Vector3(0, 1, 0), n).normalize();
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, B.reach);

    for (const L of B.lights) {
      L.o.intensity = L.intensity * (1 - 0.75 * n);
      if (L.o.isHemisphereLight) { L.o.color.copy(L.color).lerp(NIGHT_HEMI_SKY, n); L.o.groundColor.copy(L.ground).lerp(NIGHT_HEMI_GROUND, n); }
      else L.o.color.copy(L.color).lerp(MOON_LIGHT, n * 0.6);
    }
    this.scene.environmentIntensity = B.env * (1 - 0.82 * n);
    this.scene.backgroundIntensity = B.bg * (1 - 0.85 * n);
    const fog = this.scene.fog;
    if (fog) {
      if (!this.fogs.has(fog)) this.fogs.set(fog, fog.color.clone());
      fog.color.copy(this.fogs.get(fog)).lerp(NIGHT_FOG, n * 0.85);
    }
    for (const [m, c] of this.backdrops) m.color.copy(c).multiply(new THREE.Color(1, 1, 1).lerp(BACKDROP_NIGHT, n));
    for (const w of this.water) {
      w.u.sunColor.value.copy(w.color).lerp(MOON_LIGHT, n).multiplyScalar(1 - 0.7 * n);
      if (w.body) w.u.waterColor.value.copy(w.body).multiplyScalar(1 - 0.8 * n);   // the water's own colour darkens too
    }
    return n;
  }
}
