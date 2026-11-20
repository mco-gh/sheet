// Offline support: network first, falling back to the cached app shell.
// Searches need the network anyway; this keeps the app opening instantly and
// working as an installed app. Bump VERSION whenever any file below changes.
const VERSION = 'v2';
const CACHE = `sheet-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './instruments.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sheet-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only the app's own files: never searches (/api/sheet) or other sites.
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(request, { cache: 'no-cache' });
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    } catch {
      return (await cache.match(request, { ignoreSearch: true }))
        ?? (request.mode === 'navigate' ? await cache.match('./index.html') : undefined)
        ?? Response.error();
    }
  })());
});
