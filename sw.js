/* service worker — cache app shell supaya app tetap terbuka tanpa internet */
const CACHE = 'animeextract-v1';
const SHELL = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './data/games.js', './data/classids.js', './data/games.json', './data/classids.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // panggilan GitHub selalu ke jaringan (jangan pernah di-cache)
  if (url.hostname.endsWith('github.com') || url.hostname.endsWith('githubusercontent.com')) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
