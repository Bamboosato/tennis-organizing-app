/* global self, caches, fetch */

const STATIC_CACHE_PREFIX = "tennis-organizing-static-";
const STATIC_CACHE_POLICY_VERSION = "v1";
const STATIC_CACHE_NAME = `${STATIC_CACHE_PREFIX}${STATIC_CACHE_POLICY_VERSION}`;

const PRECACHE_URLS = ["/icons/icon-192.png", "/icons/icon-512.png"];
const CACHEABLE_PATH_PREFIXES = ["/_next/static/", "/icons/", "/fonts/"];

function isCacheableStaticRequest(request) {
  if (request.method !== "GET") {
    return false;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }

  if (request.headers.has("range")) {
    return false;
  }

  return CACHEABLE_PATH_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix),
  );
}

async function deleteOldStaticCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          cacheName.startsWith(STATIC_CACHE_PREFIX) &&
          cacheName !== STATIC_CACHE_NAME,
      )
      .map((cacheName) => caches.delete(cacheName)),
  );
}

async function addStaticResponseToCache(request, response) {
  if (!response || !response.ok || response.type !== "basic") {
    return;
  }

  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Cache writes must not block the network response.
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const networkResponsePromise = fetch(request).then(async (response) => {
    await addStaticResponseToCache(request, response);
    return response;
  });

  if (cachedResponse) {
    event.waitUntil(networkResponsePromise.catch(() => undefined));
    return cachedResponse;
  }

  return networkResponsePromise;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([deleteOldStaticCaches(), self.clients.claim()]),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (!isCacheableStaticRequest(request)) {
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});
