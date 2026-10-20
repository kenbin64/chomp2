// tripmap.js
// The trip map (Ken, 2026-10-17): a colour-coded map of Cairns, the Atherton
// Tableland and the Great Barrier Reef, with each region shaded in its own
// colour, a pin for each level, Barron Falls, and markers for the adventures
// (Kuranda shopping, zip line, bungee, boomerang, and Mossman Gorge's rapids
// and line traverse). The coastline follows the real one in broad strokes,
// placed by latitude and longitude.

// Longitude and latitude to map units: 145.15 to 146.15 east, 16.15 to 17.35
// south, 900 units to a degree both ways (so the map is 900 by 1080).
const W = 900, H = 1080;
const X = lon => (lon - 145.15) * 900;
const Y = lat => (lat - 16.15) * 900;
const P = (lon, lat) => `${X(lon).toFixed(0)},${Y(lat).toFixed(0)}`;

// Each region: its colour and its shaded outline (lon, lat points).
export const REGIONS = {
  daintree:  { name: 'Daintree',               colour: '#2f7d3a', pts: [[145.10, 16.10], [145.50, 16.10], [145.49, 16.27], [145.46, 16.33], [145.30, 16.36], [145.10, 16.33]] },
  mossman:   { name: 'Mossman Gorge',          colour: '#2f9aa0', pts: [[145.10, 16.33], [145.30, 16.36], [145.46, 16.33], [145.45, 16.47], [145.38, 16.56], [145.10, 16.56]] },
  park:      { name: 'Northern Beaches',       colour: '#e8b23a', pts: [[145.45, 16.47], [145.53, 16.55], [145.61, 16.66], [145.71, 16.79], [145.64, 16.78], [145.55, 16.70], [145.42, 16.58]] },
  kuranda:   { name: 'Kuranda & Barron Falls', colour: '#8a5ac8', pts: [[145.48, 16.74], [145.64, 16.78], [145.71, 16.84], [145.68, 16.90], [145.56, 16.91], [145.47, 16.83]] },
  esplanade: { name: 'Cairns',                 colour: '#e8743a', pts: [[145.71, 16.84], [145.77, 16.86], [145.82, 16.96], [145.84, 17.04], [145.72, 17.04], [145.68, 16.91]] },
  tableland: { name: 'Atherton Tableland',     colour: '#c8a26a', pts: [[145.10, 16.56], [145.38, 16.56], [145.47, 16.83], [145.56, 16.91], [145.68, 16.91], [145.72, 17.04], [145.74, 17.20], [145.62, 17.40], [145.10, 17.40]] },
  reef:      { name: 'Great Barrier Reef',     colour: '#24b7a8', pts: [[145.90, 16.30], [146.12, 16.25], [146.16, 17.30], [145.98, 17.30], [145.93, 16.95], [145.90, 16.65]] },
};

// Where each level's pin goes.
export const PLACES = {
  park:      { lon: 145.665, lat: 16.71 },
  cane:      { lon: 145.60,  lat: 16.64, dx: -30, dy: 0 },      // the cane country behind the Northern Beaches
  esplanade: { lon: 145.775, lat: 16.92 },
  reef:      { lon: 145.97,  lat: 16.76 },
  kuranda:   { lon: 145.575, lat: 16.835, dx: -40, dy: 0 },
  daintree:  { lon: 145.40,  lat: 16.25 },
  mossman:   { lon: 145.33,  lat: 16.47 },
};
// Spread out a little round Kuranda (as illustrated maps do), so they can all be clicked.
// Barron Falls: a place, not a level of its own (the adventures are there).
export const BARRON = { lon: 145.635, lat: 16.875 };
// Markers for the adventures (ids match progress.js ACTIVITIES), with an icon.
export const MARKERS = {
  shop:      { lon: 145.53,  lat: 16.755, icon: '🛍', label: 'Markets' },
  zipline:   { lon: 145.54,  lat: 16.865, icon: '🪢', label: 'Zip line' },
  bungee:    { lon: 145.59,  lat: 16.935, icon: '🪂', label: 'Bungee' },
  boomerang: { lon: 145.45,  lat: 16.81,  icon: '🪃', label: 'Boomerang' },
  rapids:    { lon: 145.22,  lat: 16.43,  icon: '🛶', label: 'Rapids' },
  traverse:  { lon: 145.40,  lat: 16.39,  icon: '🧗', label: 'Line traverse' },
};

// The coastline, north to south.
const COAST = [[145.45, 16.10], [145.48, 16.27], [145.455, 16.30], [145.43, 16.40], [145.42, 16.45], [145.47, 16.48],
  [145.52, 16.55], [145.60, 16.65], [145.67, 16.74], [145.70, 16.79], [145.75, 16.86], [145.76, 16.90],
  [145.785, 16.93], [145.80, 16.97], [145.88, 17.05], [145.92, 17.12], [145.96, 17.22], [146.0, 17.30], [146.03, 17.40]];

export function mapSvg() {
  const land = `M -10,-10 L ${COAST.map(([lo, la]) => P(lo, la)).join(' L ')} L -10,${H + 10} Z`;
  const sea = `M ${W + 10},-10 L ${COAST.map(([lo, la]) => P(lo, la)).join(' L ')} L ${W + 10},${H + 10} Z`;
  const shape = pts => `M ${pts.map(([lo, la]) => P(lo, la)).join(' L ')} Z`;
  const regions = Object.entries(REGIONS).map(([id, r]) => id === 'reef'
    ? `<path d="${shape(r.pts)}" fill="${r.colour}" fill-opacity="0.18" stroke="${r.colour}" stroke-width="4" stroke-dasharray="14 8" clip-path="url(#seaclip)"/>`
    : `<path d="${shape(r.pts)}" fill="${r.colour}" fill-opacity="0.38" stroke="${r.colour}" stroke-width="3" stroke-linejoin="round" clip-path="url(#landclip)"/>`).join('');
  const hills = [];
  for (let i = 0; i < 70; i++) {
    const t = i / 69, lo = 145.50 - t * 0.30 + (i % 3) * 0.03, la = 17.25 - t * 1.05 + ((i * 7) % 5) * 0.012;
    const x = X(lo - (i % 2) * 0.05), y = Y(la);
    if (x < 10 || y < 10) continue;
    hills.push(`<path d="M ${(x - 20).toFixed(0)},${(y + 9).toFixed(0)} Q ${x.toFixed(0)},${(y - 20).toFixed(0)} ${(x + 20).toFixed(0)},${(y + 9).toFixed(0)}" fill="#4f8a55" stroke="#3a6b42" stroke-width="2" opacity="0.5"/>`);
  }
  const reefs = [[145.97, 16.76, 10], [146.03, 16.68, 26], [146.08, 16.84, 30], [146.03, 16.52, 22], [145.99, 16.38, 18], [146.08, 16.98, 24], [146.10, 17.15, 26]]
    .map(([lo, la, r]) => `<ellipse cx="${X(lo).toFixed(0)}" cy="${Y(la).toFixed(0)}" rx="${r * 1.6}" ry="${r}" fill="#9ff0e4" stroke="#4cc3b5" stroke-width="2" opacity="0.8" transform="rotate(-35 ${X(lo).toFixed(0)} ${Y(la).toFixed(0)})"/>`).join('');
  const names = Object.values(REGIONS);
  const legend = `<rect x="10" y="${H - 22 - names.length * 28}" width="290" height="${names.length * 28 + 14}" rx="10" fill="rgba(10,30,40,0.55)"/>` +
    names.map((r, i) => `<g transform="translate(22,${H - 14 - (names.length - i) * 28})"><rect width="20" height="20" rx="5" fill="${r.colour}"/><text x="30" y="16" class="legend">${r.name}</text></g>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="tripmap-svg" role="img" aria-label="Map of Cairns, the Atherton Tableland and the Great Barrier Reef">
    <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fb7d6"/><stop offset="1" stop-color="#1f7fb0"/></linearGradient>
      <linearGradient id="landg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#86bd6e"/><stop offset="1" stop-color="#6aa35a"/></linearGradient>
      <clipPath id="landclip"><path d="${land}"/></clipPath>
      <clipPath id="seaclip"><path d="${sea}"/></clipPath>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#sea)"/>
    ${reefs}
    <path d="${land}" fill="url(#landg)"/>
    ${regions}
    ${hills.join('')}
    <path d="${land}" fill="none" stroke="#f1e2b8" stroke-width="7" stroke-linejoin="round"/>
    <path d="M ${P(145.47, 16.95)} Q ${P(145.58, 16.86)} ${P(145.64, 16.835)} Q ${P(145.70, 16.87)} ${P(145.755, 16.885)}" fill="none" stroke="#3fa7d6" stroke-width="5" stroke-linecap="round"/>
    <path d="M ${P(145.25, 16.24)} Q ${P(145.36, 16.26)} ${P(145.465, 16.295)}" fill="none" stroke="#3fa7d6" stroke-width="6" stroke-linecap="round"/>
    <path d="M ${P(145.25, 16.52)} Q ${P(145.32, 16.48)} ${P(145.42, 16.46)}" fill="none" stroke="#3fa7d6" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="${X(145.97)}" cy="${Y(16.76)}" rx="10" ry="7" fill="#e9d79a" stroke="#4f8a55" stroke-width="3"/>
    <text x="${X(145.86)}" y="${Y(16.87)}" class="sea-label">Trinity Bay</text>
    <text x="${X(145.78)}" y="${Y(16.42)}" class="sea-label">Coral Sea</text>
    <text x="${X(146.03)}" y="${Y(16.725)}" class="sea-label small">Green Island</text>
    <text x="${X(145.36)}" y="${Y(17.02)}" class="land-label">Atherton Tableland</text>
    <text x="${X(145.70)}" y="${Y(16.995)}" class="land-label town">Cairns</text>
    <text x="${X(145.52)}" y="${Y(16.52)}" class="land-label town small">Port Douglas</text>
    ${legend}
    <g id="tripmap-markers"></g>
    <g id="tripmap-pins"></g>
  </svg>`;
}

export function pinXY(id) { const p = PLACES[id]; return { x: X(p.lon), y: Y(p.lat), dx: p.dx || 0, dy: p.dy || 0 }; }
export function markerXY(id) { const p = id === 'barron' ? BARRON : MARKERS[id]; return { x: X(p.lon), y: Y(p.lat) }; }
