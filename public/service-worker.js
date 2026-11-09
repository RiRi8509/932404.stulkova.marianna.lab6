const CACHE_VERSION = 'v2.0.2';
const STATIC_CACHE = `currency-static-${CACHE_VERSION}`;
const API_CACHE = `currency-api-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/about',
  '/index.html',
  '/about.html',
  '/style.css?v=2.0.2',
  '/script.js',
  '/manifest.json',
  '/assets/chrome-dollar.jpg',
  '/assets/dollar-bill.jpg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const API_ENDPOINTS = [
  '/api/status',
  '/api/rates/USD',
  '/api/rates/EUR',
  '/api/rates/CNY'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
      caches.open(API_CACHE).then((cache) => cache.addAll(API_ENDPOINTS))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const currentCaches = new Set([STATIC_CACHE, API_CACHE]);

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('currency-') && !currentCaches.has(cacheName))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirstApi(request) {
  const apiCache = await caches.open(API_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await apiCache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cachedResponse = await apiCache.match(request, { ignoreSearch: true });

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(
      JSON.stringify({ error: 'Данные недоступны без подключения к сети' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }
}

async function cacheFirstStatic(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const staticCache = await caches.open(STATIC_CACHE);
      await staticCache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    if (request.mode === 'navigate') {
      return (await caches.match(request.url.endsWith('/about') ? '/about' : '/')) || Response.error();
    }

    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  event.respondWith(cacheFirstStatic(request));
});
