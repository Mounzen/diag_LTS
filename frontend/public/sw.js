// Service Worker DIAG-LTS — Cache-first pour assets, network-first pour API
const CACHE_VERSION = 'diag-lts-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo-icon.svg',
  '/logo-mark-light.svg',
  '/logo-horizontal-light.svg',
  '/logo-horizontal-dark.svg'
];

// Installation : on précache les assets statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

// Activation : nettoyer les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Stratégie : cache-first pour /assets/ + index, network-first pour API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes externes (Supabase, Nominatim, etc.)
  if (url.origin !== self.location.origin) return;

  // Ne pas intercepter les requêtes non-GET
  if (request.method !== 'GET') return;

  // API : network-first puis cache (fallback)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response(JSON.stringify({ message: 'Hors ligne / serveur injoignable' }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // Navigation (document HTML) : NETWORK-FIRST.
  // Indispensable : on sert toujours le dernier index.html (donc les bons hash
  // d'assets Vite). En cache-first, on servait un vieil index pointant vers des
  // fichiers /assets/*.css|js supprimés au déploiement suivant → 404 + page cassée.
  const isNavigation = request.mode === 'navigate'
    || (request.destination === 'document')
    || (request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Assets statiques (hashés, immuables) : cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Stocker en cache runtime
        if (response.ok) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => new Response('Offline', { status: 503 }));
    })
  );
});
