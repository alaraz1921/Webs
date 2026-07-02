const CACHE_NAME = "escapetin-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./contacto.html",
  "./manifest.webmanifest",
  "./assets/styles.css",
  "./assets/app.js",
  "./assets/contact.js",
  "./assets/game-api.js",
  "./assets/pwa.js",
  "./assets/escapetin-hero.jpg",
  "./assets/icon.svg",
  "./play/index.html",
  "./play/challenge.html",
  "./play/ranking.html",
  "./play/app.js",
  "./admin/login.html",
  "./admin/index.html",
  "./admin/game-edit.html",
  "./admin/challenges.html",
  "./admin/participants.html",
  "./admin/admin.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || !url.pathname.includes("/EscapeTin/")) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});