// area-path.js
// Which area a page's address is. Locally the pages end in .html (cane.html); the hosted site
// (playbutterflyfx.com) serves them without it (/chomp/cane), and the game's folder alone is the park.
// Plain JavaScript, tested in test/area-path.test.mjs.

const AREA = { index: 'park', '': 'park', chomp: 'park', cane: 'cane', mossman: 'mossman', esplanade: 'esplanade', reef: 'reef', kuranda: 'kuranda' };

export function areaForPath(pathname = '') {
  const page = String(pathname).split('/').pop().replace(/\.html$/, '');
  return AREA[page];
}
