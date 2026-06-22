const EVENTIN_CACHE = 'eventin-pwa-v1';

const CORE_ASSETS = [
    '/EvenTin/',
    '/EvenTin/index.html',
    '/EvenTin/admin.html',
    '/EvenTin/evento.html',
    '/EvenTin/invitacion.html',
    '/EvenTin/contacto.html',
    '/EvenTin/css/style.css',
    '/EvenTin/js/config.js',
    '/EvenTin/js/supabaseClient.js',
    '/EvenTin/js/pwa.js',
    '/EvenTin/js/reveal.js',
    '/EvenTin/assets/icons/icon-192.png',
    '/EvenTin/assets/icons/icon-512.png',
    '/EvenTin/assets/icons/apple-touch-icon.png',
    '/EvenTin/assets/images/eventin-logo-transparent.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(EVENTIN_CACHE)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys
                .filter((key) => key !== EVENTIN_CACHE)
                .map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const requestUrl = new URL(request.url);

    if (request.method !== 'GET' || requestUrl.origin !== self.location.origin || !requestUrl.pathname.startsWith('/EvenTin/')) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(EVENTIN_CACHE).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('/EvenTin/index.html')))
        );
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((cached) => cached || fetch(request).then((response) => {
                const copy = response.clone();
                caches.open(EVENTIN_CACHE).then((cache) => cache.put(request, copy));
                return response;
            }))
    );
});
