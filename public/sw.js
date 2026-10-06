/* Service worker de HeroLeiros.
 *
 * Cacha samples (`/samples/`) y páginas de canciones (`/canciones/…`) para
 * poder ensayar con mala red. No intercepta POST ni `/api/` (auth, intentos).
 * El worklet del micrófono va network-first para no quedarse con un detector viejo.
 */
const VERSION = "heroleiros-v1";
const PRECACHE = [
  "/",
  "/samples/manifest.json",
  "/worklets/onset-processor.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  // addModule del AudioWorklet y decodeAudioData no deben verse bloqueados
  // por un fallback HTML: si la red falla, se usa caché, nunca otra cosa.
  if (url.pathname.startsWith("/worklets/")) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith("/samples/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (isSongOrShell(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function isSongOrShell(pathname) {
  return (
    pathname === "/" ||
    pathname.startsWith("/canciones/") ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icons/")
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(VERSION);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? network;
}
