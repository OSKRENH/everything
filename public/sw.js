const CACHE_NAME = "kutno-resilient-v3";
const FALLBACK_URL = "/lite";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled([cache.add(FALLBACK_URL)]);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isApi(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/");
}

async function navigationNetworkOnly(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    return await fetch(request, { cache: "no-store" });
  } catch {
    return await cache.match(FALLBACK_URL) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApi(url)) return;
  if (request.mode === "navigate") {
    event.respondWith(navigationNetworkOnly(request));
    return;
  }
  if (["script", "style", "font", "image"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
  }
});
