// toast.js
// The short message that pops up and fades (a catch, a find, a tip), shared by the levels that used to carry an
// identical copy each (cane, daintree, esplanade, kuranda, mossman, push, reef; found by the hardener 2026-10-26).
// Boomerang, coast, rescue and zipline keep their own: theirs differ.

export function toast(text, kind = 'good') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text;
  const box = document.getElementById('toasts');
  box.appendChild(el); setTimeout(() => el.remove(), 1800);
  while (box.children.length > 3) box.firstChild.remove();
}
