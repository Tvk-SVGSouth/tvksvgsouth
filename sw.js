/* =====================================================
   TVK SVG South — Service Worker
   Caches core assets for offline use.
   ===================================================== */

const CACHE_NAME = 'tvk-svg-south-v1';

// Assets to cache on install (App Shell)
const STATIC_ASSETS = [
  './',
  './index.html',
  './Images/Tvk-banner.jpg.jpeg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css'
];

/* ---------- Install: pre-cache app shell ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Pre-cache partial failure (non-fatal):', err);
      });
    })
  );
  self.skipWaiting();
});

/* ---------- Activate: clean up old caches ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ---------- Fetch: Network-first for CSV news feed,
              Cache-first for everything else ---------- */
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Always go network for Google Sheets CSV (live news feed)
  if (url.includes('docs.google.com/spreadsheets')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => new Response(
          'செய்திகளை ஏற்ற முடியவில்லை. இணைப்பை சரிபார்க்கவும்.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
        ))
    );
    return;
  }

  // For navigation (HTML pages): Network-first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for all other static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
