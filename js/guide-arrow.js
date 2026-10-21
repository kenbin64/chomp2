// guide-arrow.js
// Where to go next (Ken, 2026-10-21): an arrow at the top of the screen pointing the way to the next
// thing to do, with its name and how far. It shows on an area's first visit; going back is harder,
// and finds its own way. (First made for the reef; every area uses it now.)
//
//   const arrow = guideArrow({ show: attempt.visit === 1 });
//   arrow.update(target, wally.pos, cam.yaw)   each frame; target { x, z, label } or null to hide

export function guideArrow({ show = true } = {}) {
  let el = document.getElementById('arrow');
  if (!el) {
    el = document.createElement('div'); el.id = 'arrow'; el.className = 'guide-arrow'; el.hidden = true;
    el.innerHTML = '<span class="tip">&#x27A4;</span><small id="arrow-text"></small>';
    document.body.append(el);
  }
  const tip = el.querySelector('.tip'), text = el.querySelector('small');
  return {
    el,
    update(target, from, yaw) {
      if (!show || !target) { el.hidden = true; return; }
      el.hidden = false;
      const dx = target.x - from.x, dz = target.z - from.z, d = Math.hypot(dx, dz);
      // Into the camera's frame: forward is away from the camera, right is to its right.
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
      tip.style.transform = `rotate(${ang - Math.PI / 2}rad)`;      // the glyph points right at rest
      text.textContent = d < 3 ? `${target.label}: here!` : `${target.label} ${Math.round(d)} m`;
    },
    hide() { el.hidden = true; },
  };
}

// The nearest of a list of things still to do ({ x, z } each), from a point; null if none.
export function nearest(list, from) {
  let best = null, bd = Infinity;
  for (const p of list) { const d = Math.hypot(p.x - from.x, p.z - from.z); if (d < bd) { bd = d; best = p; } }
  return best;
}
