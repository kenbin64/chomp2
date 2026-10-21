// sw.js
// Makes Chomp 3D installable as an app (Ken, 2026-10-21: native mode, with an icon for future play).
// It stores nothing: every request goes to the network as usual, so the game is always the latest and
// no player data is kept here. (Browsers want a service worker before they offer to install a site.)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
