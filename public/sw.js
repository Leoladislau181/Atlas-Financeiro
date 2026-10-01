// Minimal service worker for PWA installability
const CACHE_NAME = 'atlas-financeiro-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Requirement for PWA installability on some browsers
  event.respondWith(fetch(event.request));
});
