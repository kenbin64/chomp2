// realism.js
// The photographic layer: a real sky that lights and reflects the scene, and
// scanned surfaces (grass, sand, planks, rock, paving, palm bark) with depth
// and shine. Everything here is optional. The pictures live in assets/ (see
// tools/fetch-assets.mjs); when one is missing the game keeps its own painted
// look for that thing, the same way it treats models.

import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const SURFACES = ['grass', 'sand', 'planks', 'rock', 'paving', 'palm'];

// Loads whatever is present. light: phones and low graphics get the smaller sky
// and only the colour of each surface (no depth or shine maps), to save memory.
export async function loadRealism(renderer, { light = false } = {}) {
  const tex = new THREE.TextureLoader();
  const out = { sky: null, surfaces: {}, waterNormals: null };
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const sky = loadSky(renderer, tex, light).then(s => { out.sky = s; }).catch(() => {});
  const maps = SURFACES.map(async name => {
    const want = light ? ['color'] : ['color', 'normal', 'rough'];
    const got = await Promise.all(want.map(m => tex.loadAsync(`assets/surfaces/${name}/${m}.jpg`).catch(() => null)));
    if (!got[0]) return;                               // no colour picture: keep the painted look
    const [color, normal, rough] = got;
    color.colorSpace = THREE.SRGBColorSpace;
    for (const t of got) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; }
    out.surfaces[name] = { color, normal, rough };
  });
  const water = tex.loadAsync('assets/water/waternormals.jpg').then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; out.waterNormals = t;
  }).catch(() => {});
  await Promise.all([sky, water, ...maps]);
  return out;
}

async function loadSky(renderer, tex, light) {
  const info = await (await fetch('assets/sky/sky.json')).json();
  const [picture, hdr] = await Promise.all([
    tex.loadAsync(`assets/sky/${light ? 'sky-phone' : 'sky-pc'}.jpg`),
    new HDRLoader().loadAsync('assets/sky/sky-1k.hdr'),
  ]);
  picture.colorSpace = THREE.SRGBColorSpace;
  picture.mapping = THREE.EquirectangularReflectionMapping;
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(hdr).texture;
  pmrem.dispose(); hdr.dispose();

  // Where the sun is in the photo, turned into a direction, using the same rule
  // three.js uses to wrap a panorama round the sky: u = atan(z, x) / 2pi + 0.5.
  const a = (info.sunU - 0.5) * Math.PI * 2, e = THREE.MathUtils.degToRad(info.sunElevation);
  const sunDirection = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
  return { background: picture, environment, sunDirection, horizon: new THREE.Color(info.horizon) };
}

// A copy of a surface picture with its own tiling. The picture itself is
// shared, so copies cost no extra memory.
// rotate turns the picture a quarter turn, e.g. to lay boards across a walkway.
function tiled(t, rx, ry, rotate = false) {
  if (!t) return null;
  const c = t.clone(); c.repeat.set(rx, ry);
  if (rotate) { c.center.set(0.5, 0.5); c.rotation = Math.PI / 2; }
  c.needsUpdate = true;
  return c;
}

// A material made from a scanned surface, tiled rx by ry times across its
// texture space. Returns null when that surface is not present.
export function surfaceMaterial(realism, name, rx = 1, ry = rx, { rotate = false, ...extra } = {}) {
  const s = realism && realism.surfaces[name];
  if (!s) return null;
  return new THREE.MeshStandardMaterial({
    map: tiled(s.color, rx, ry, rotate),
    normalMap: tiled(s.normal, rx, ry, rotate),
    roughnessMap: tiled(s.rough, rx, ry, rotate),
    roughness: 1, metalness: 0, ...extra,
  });
}

// Ground that blends grass into sand. Each vertex carries a 'sandiness' from
// 0 (grass) to 1 (sand); colour, bumps and shine all follow it, so the shore
// is sand you can see the grain of rather than a painted tint. The vertex
// colours, if any, still tint the result for gentle large-scale variation,
// which also hides the repeat of the tiles.
export function groundMaterial(realism, tilesPerMetre, extra = {}) {
  const g = realism && realism.surfaces.grass, s = realism && realism.surfaces.sand;
  if (!g || !s) return null;
  const m = surfaceMaterial(realism, 'grass', tilesPerMetre, tilesPerMetre, extra);
  const sandMaps = { sandMap: tiled(s.color, tilesPerMetre, tilesPerMetre),
    sandNormal: tiled(s.normal || g.normal, tilesPerMetre, tilesPerMetre),
    sandRough: tiled(s.rough || g.rough, tilesPerMetre, tilesPerMetre) };
  m.onBeforeCompile = shader => {
    for (const [k, v] of Object.entries(sandMaps)) shader.uniforms[k] = { value: v };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sandiness;\nvarying float vSand;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSand = sandiness;');
    // The texture reads sit inside #include chunks that three.js expands only
    // after this runs, so each chunk is expanded here and its read swapped for
    // a grass-to-sand mix.
    const chunk = (name, from, to) => {
      const text = THREE.ShaderChunk[name];
      if (!text.includes(from)) console.warn(`realism: ${name} has changed; sand blend skipped there`);
      return text.replace(from, to);
    };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D sandMap, sandNormal, sandRough;\nvarying float vSand;')
      .replace('#include <map_fragment>', chunk('map_fragment', 'texture2D( map, vMapUv )',
        'mix( texture2D( map, vMapUv ), texture2D( sandMap, vMapUv ), vSand )'))
      .replace('#include <roughnessmap_fragment>', chunk('roughnessmap_fragment', 'texture2D( roughnessMap, vRoughnessMapUv )',
        'mix( texture2D( roughnessMap, vRoughnessMapUv ), texture2D( sandRough, vRoughnessMapUv ), vSand )'))
      .replace('#include <normal_fragment_maps>', chunk('normal_fragment_maps', 'texture2D( normalMap, vNormalMapUv )',
        'mix( texture2D( normalMap, vNormalMapUv ), texture2D( sandNormal, vNormalMapUv ), vSand )'));
  };
  m.customProgramCacheKey = () => 'ground-grass-sand';
  return m;
}

// Puts the photographed sky behind and around the scene, and moves the sun
// light to where the sun is in the photo so shadows agree with what you see.
export function applySky(scene, realism, sun, skyMesh) {
  const sky = realism && realism.sky;
  if (!sky) return false;
  scene.background = sky.background;
  scene.environment = sky.environment;
  scene.environmentIntensity = 0.9;
  if (skyMesh) skyMesh.visible = false;              // the painted dome is not needed behind a photo
  if (scene.fog) scene.fog.color.copy(sky.horizon);
  if (sun) {
    const reach = sun.position.length();
    sun.position.copy(sky.sunDirection).multiplyScalar(reach);
  }
  return true;
}
