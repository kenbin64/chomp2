// signtext.js
// Writing on painted signs so every letter fits (Ken: "Rainforest Gallery" was
// cut off). The text is drawn as large as it can be, up to `size`, and shrunk
// until it fits inside `maxWidth` on the canvas.
export function fitText(g, text, x, y, maxWidth, size, font = 'bold {size}px Georgia, serif', min = 12) {
  let s = size;
  g.font = font.replace('{size}', s);
  while (s > min && g.measureText(text).width > maxWidth) { s -= 1; g.font = font.replace('{size}', s); }
  g.fillText(text, x, y);
  return s;
}
