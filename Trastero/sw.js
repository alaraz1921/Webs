const CACHE_NAME = 'trastero-v3';
const APP_SHELL = [
  './index.html',
  './ver.html',
  './manifest.json',
  './css/trastero.css',
  './js/trastero.js',
  './js/trastero-public.js',
  './assets/folder-box.png',
  './assets/folder-tree.png',
  './assets/item-box.png',
  './assets/photo.png',
  './assets/scan.png',
  './assets/search.png',
  './assets/pwa-icon-192.png',
  './assets/pwa-icon-512.png',
  '../assets/supabase-client.js'
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
