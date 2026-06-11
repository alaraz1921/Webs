const CACHE_NAME = 'bingo-v3';
const APP_SHELL = [
  './carton.html',
  './monitor.html',
  './manifest.json',
  './icons/bingo-icon-192.png',
  './icons/bingo-icon-512.png',
  '../assets/styles.css',
  '../assets/supabase-client.js',
  '../assets/js/bingo-carton.js',
  '../assets/js/bingo-monitor.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
