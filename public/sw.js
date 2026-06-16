/* Nostr Point service worker — caches the app shell for offline use.
 *
 * Strategy:
 * - Navigations (HTML): network-first, fall back to cached index.html so the
 *   SPA loads offline at any route.
 * - Same-origin static assets (JS/CSS/fonts/images/manifest): stale-while-
 *   revalidate — serve from cache instantly, update in the background.
 * - Cross-origin (Blossom media, relays): not handled here; the app caches
 *   selected media in IndexedDB via the "Save offline" feature.
 */

const CACHE = 'nostr-point-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin requests; let the browser/app handle the rest
  // (Blossom media, relay websockets, etc.).
  if (url.origin !== self.location.origin) return;

  // SPA navigations: network-first, fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
