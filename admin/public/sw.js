/* Technician portal service worker.
 *
 * What it does:   keeps the app SHELL usable offline (a friendly offline page, and cached build assets).
 * What it NEVER does: cache API responses. /api/ data is private (customers, addresses, phone numbers) and is
 * tied to a signed-in user, so it is always fetched live and never stored here.
 *
 * Bump CACHE_VERSION to force every device to drop old caches on the next load.
 */
const CACHE_VERSION = 'v3';
const ASSET_CACHE = `techportal-assets-${CACHE_VERSION}`;
const OFFLINE_CACHE = `techportal-offline-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .catch(() => undefined) // never block installation on a missing optional file
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove every cache from earlier versions, including old ones that held API responses.
      const keep = new Set([ASSET_CACHE, OFFLINE_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// The app asks us to wipe everything on sign-out (shared tablets/phones).
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // other origins (API server, fonts, Cloudinary): not ours
  if (url.pathname.startsWith('/api/')) return; // never touch API traffic

  // Page loads: always try the network first so a new deploy is picked up immediately, and only show the
  // offline page when the network is really unavailable. (index.html is never served stale.)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(OFFLINE_CACHE);
        return (await cache.match(OFFLINE_URL)) || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
    );
    return;
  }

  // Build output under /assets/ has a content hash in its file name, so a cached copy is always the right one.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
  }
});
