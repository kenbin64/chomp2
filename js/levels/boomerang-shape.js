// boomerang-shape.js
// The boomerang itself (Ken, 2026-10-20: the old one looked like a piece of wood). Its
// outline is traced from Ken's reference picture: a classic elbow boomerang, 60 cm tip to
// tip, rounded tips. Built here as polished timber: smooth curves, rounded edges, a
// varnished red-brown grain. Left plain: the picture's dot painting is a Central Desert
// style, so a design goes on only if the Djabugay community gives one (MASTER.md).
//
//   boomerangMesh()   a Group in the x-y plane, the elbow toward +y, flat faces along z

import * as THREE from 'three';

// The outline, metres, centred: along the top edge from tip to tip, back along the bottom.
const OUTLINE = [[-0.3000, -0.0848], [-0.2874, -0.0560], [-0.2748, -0.0411], [-0.2622, -0.0291], [-0.2502, -0.0189], [-0.2377, -0.0081], [-0.2251, 0.0027], [-0.2125, 0.0135], [-0.1999, 0.0237], [-0.1873, 0.0339], [-0.1747, 0.0435], [-0.1627, 0.0518], [-0.1501, 0.0608], [-0.1376, 0.0692], [-0.1250, 0.0776], [-0.1124, 0.0854], [-0.0998, 0.0932], [-0.0872, 0.1004], [-0.0752, 0.1076], [-0.0626, 0.1142], [-0.0500, 0.1196], [-0.0375, 0.1244], [-0.0249, 0.1280], [-0.0123, 0.1298], [-0.0003, 0.1304], [0.0123, 0.1292], [0.0249, 0.1274], [0.0375, 0.1238], [0.0500, 0.1184], [0.0626, 0.1130], [0.0752, 0.1058], [0.0872, 0.0992], [0.0998, 0.0914], [0.1124, 0.0830], [0.1250, 0.0746], [0.1376, 0.0662], [0.1501, 0.0572], [0.1627, 0.0477], [0.1747, 0.0387], [0.1873, 0.0285], [0.1999, 0.0177], [0.2125, 0.0069], [0.2251, -0.0045], [0.2377, -0.0159], [0.2502, -0.0267], [0.2622, -0.0381], [0.2748, -0.0512], [0.2874, -0.0674], [0.3000, -0.0986], [0.2874, -0.1280], [0.2748, -0.1304], [0.2622, -0.1256], [0.2502, -0.1184], [0.2377, -0.1112], [0.2251, -0.1028], [0.2125, -0.0920], [0.1999, -0.0830], [0.1873, -0.0728], [0.1747, -0.0626], [0.1627, -0.0548], [0.1501, -0.0447], [0.1376, -0.0345], [0.1250, -0.0267], [0.1124, -0.0177], [0.0998, -0.0105], [0.0872, -0.0015], [0.0752, 0.0063], [0.0626, 0.0135], [0.0500, 0.0195], [0.0375, 0.0249], [0.0249, 0.0267], [0.0123, 0.0291], [-0.0003, 0.0291], [-0.0123, 0.0285], [-0.0249, 0.0261], [-0.0375, 0.0225], [-0.0500, 0.0183], [-0.0626, 0.0135], [-0.0752, 0.0069], [-0.0872, 0.0009], [-0.0998, -0.0069], [-0.1124, -0.0129], [-0.1250, -0.0213], [-0.1376, -0.0303], [-0.1501, -0.0369], [-0.1627, -0.0483], [-0.1747, -0.0554], [-0.1873, -0.0650], [-0.1999, -0.0740], [-0.2125, -0.0824], [-0.2251, -0.0908], [-0.2377, -0.0980], [-0.2502, -0.1052], [-0.2622, -0.1112], [-0.2748, -0.1136], [-0.2874, -0.1118]];

let shared = null;                                               // one geometry and material for every boomerang
function build() {
  // A smooth closed curve through the traced points, so the edges have no facets.
  const curve = new THREE.CatmullRomCurve3(OUTLINE.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  const shape = new THREE.Shape(curve.getPoints(220).map(p => new THREE.Vector2(p.x, p.y)));
  // Thin, with a deep rounded bevel: thicker through the middle of each arm, rounded at
  // the edges, about 12 mm overall, like a real one.
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 4, curveSegments: 1 });
  geo.translate(0, 0, -0.002);
  geo.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({ map: woodTexture(), roughness: 0.38, clearcoat: 0.85, clearcoatRoughness: 0.18 });
  return { geo, material };
}

// Polished hardwood: deep red-brown, darker wavy grain along the arms, a few flecks.
function woodTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, 1024);
  base.addColorStop(0, '#5e240e'); base.addColorStop(0.5, '#7c3517'); base.addColorStop(1, '#55200c');
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {                                  // the grain: long wavy lines
    const y0 = rnd() * 1024, amp = 4 + rnd() * 14, freq = 0.004 + rnd() * 0.01, ph = rnd() * 6;
    g.strokeStyle = rnd() < 0.7 ? `rgba(${30 + rnd() * 25},${10 + rnd() * 10},4,${0.35 + rnd() * 0.4})` : `rgba(${170 + rnd() * 40},${80 + rnd() * 30},${40 + rnd() * 20},${0.2 + rnd() * 0.25})`;   // dark grain, some lighter
    g.lineWidth = 1 + rnd() * 3; g.beginPath();
    for (let x = 0; x <= 1024; x += 8) { const y = y0 + Math.sin(x * freq + ph) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 60; i++) {                                   // lighter streaks where the varnish catches
    g.strokeStyle = `rgba(230,150,90,${0.05 + rnd() * 0.08})`; g.lineWidth = 2 + rnd() * 5;
    const y0 = rnd() * 1024; g.beginPath(); g.moveTo(0, y0); g.bezierCurveTo(340, y0 + rnd() * 30 - 15, 680, y0 + rnd() * 30 - 15, 1024, y0); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.6, 1 / 0.6); t.offset.set(0.5, 0.5); t.anisotropy = 4;   // the faces' UVs are their x-y in metres
  return t;
}

export function boomerangMesh() {
  if (!shared) shared = build();
  const mesh = new THREE.Mesh(shared.geo, shared.material);
  mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh);
  return g;
}
