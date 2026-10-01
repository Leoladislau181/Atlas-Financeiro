// Minimal service worker for PWA installability
const CACHE_NAME = 'atlas-financeiro-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Do not intercept non-GET or cross-origin requests (e.g. Supabase, external APIs)
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  // Do not intercept local API routes
  if (event.request.url.includes('/api/')) return;

  // Network first with safe fallback
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});
