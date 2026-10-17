// grass.js
// Real grass on the lawns (Ken: the grass was a flat green field with no light
// or shade). Thousands of small tufts of curved blades, each tuft a slightly
// different green, dark at the roots and light at the tips, swaying in a breeze
// that ripples across the field. The field is cut into square blocks so only the
// blocks in view are drawn, and phones get far fewer tufts.
//
//   const grass = new Grass(scene, { x0, x1, z0, z1, heightAt, density, tufts });
//   grass.update(time);       // every frame, for the breeze
//
// density(x, z): 0 (no grass, e.g. sand or water) to 1 (full); also makes the
// grass longer where it is higher (edges left to grow).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One tuft: a few blades leaning out from the middle, each a tapering curved strip.
function tuftGeometry() {
  const blades = [];
  const BLADES = 5, SEG = 3;
  for (let b = 0; b < BLADES; b++) {
    const a = (b / BLADES) * Math.PI * 2 + Math.random() * 0.6;
    const lean = 0.25 + Math.random() * 0.35, h = 0.75 + Math.random() * 0.5, w = 0.045 + Math.random() * 0.02;
    const pos = [], col = [], idx = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG, bend = lean * t * t;                // curves over more toward the tip
      const cx = Math.cos(a) * (0.05 + bend), cz = Math.sin(a) * (0.05 + bend), y = h * t;
      const half = w * (1 - t * 0.92) / 2;                  // tapers to a point
      const px = -Math.sin(a) * half, pz = Math.cos(a) * half;
      pos.push(cx - px, y, cz - pz, cx + px, y, cz + pz);
      const shade = 0.42 + t * 0.58;                         // dark roots, light tips
      col.push(shade, shade, shade, shade, shade, shade);
      if (i < SEG) { const v = i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    blades.push(g);
  }
  const tuft = mergeGeometries(blades);
  // Lit as if facing up: thin blades lit by their own facing go dark and noisy;
  // facing the sky they catch the light the way a lawn does.
  const n = new Float32Array(tuft.attributes.position.count * 3);
  for (let i = 0; i < n.length; i += 3) n[i + 1] = 1;
  tuft.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return tuft;
}

export class Grass {
  constructor(scene, { x0, x1, z0, z1, heightAt, density, tufts = 40000, block = 20, height = 0.32 }) {
    this.time = { value: 0 };
    this.meshes = [];
    const geo = tuftGeometry();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
    mat.onBeforeCompile = shader => {
      shader.uniforms.grassTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float grassTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          // The breeze: a slow wave rolling across the field, stronger at the tips.
          vec3 root = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float gust = sin(grassTime * 1.3 + root.x * 0.35 + root.z * 0.22) * 0.5 + sin(grassTime * 2.7 + root.x * 1.1) * 0.15;
          float tip = position.y * position.y;
          transformed.x += gust * 0.22 * tip;
          transformed.z += gust * 0.12 * tip;`);
    };
    mat.customProgramCacheKey = () => 'grass-tufts';

    // Scatter the tufts, block by block, wherever there is grass.
    const blocks = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color(), base = new THREE.Color(0x4f8a2c), dry = new THREE.Color(0x9a9a4a), deep = new THREE.Color(0x2f6420);
    const area = (x1 - x0) * (z1 - z0);
    for (let tries = 0, placed = 0; placed < tufts && tries < tufts * 6; tries++) {
      const x = x0 + Math.random() * (x1 - x0), z = z0 + Math.random() * (z1 - z0);
      const d = density(x, z);
      if (d <= 0 || Math.random() > d) continue;
      const key = Math.floor(x / block) + ',' + Math.floor(z / block);
      if (!blocks.has(key)) blocks.set(key, []);
      // Taller where the grass is left to grow (density above 1 means "long").
      const tall = height * (0.7 + Math.random() * 0.6) * Math.max(1, d);
      q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
      m.compose(p.set(x, heightAt(x, z) - 0.02, z), q, s.set(1 + Math.random() * 0.5, tall, 1 + Math.random() * 0.5));
      // Each tuft a slightly different green: patches of deeper and drier grass across the field.
      const patch = Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.5 + Math.sin(x * 0.041 - z * 0.033) * 0.5;
      c.copy(base).lerp(patch > 0 ? dry : deep, Math.abs(patch) * 0.55).offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.08);
      blocks.get(key).push([m.clone(), c.clone()]);
      placed++;
    }
    for (const list of blocks.values()) {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([mm, cc], i) => { mesh.setMatrixAt(i, mm); mesh.setColorAt(i, cc); });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();                       // so blocks out of view are skipped
      mesh.receiveShadow = true;
      scene.add(mesh); this.meshes.push(mesh);
    }
    this.count = [...blocks.values()].reduce((n, l) => n + l.length, 0);
  }

  update(time) { this.time.value = time; }
}
