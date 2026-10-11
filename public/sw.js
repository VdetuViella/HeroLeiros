/* Service worker de HeroLeiros.
 *
 * Cacha samples (`/samples/`), páginas de canciones (`/canciones/…`) y los
 * archivos de la app (`/_next/static/`) para poder ensayar con mala red o sin
 * ella. No intercepta POST ni `/api/` (auth, intentos). El worklet del
 * micrófono va network-first para no quedarse con un detector viejo.
 *
 * La página puede pedir que se descargue todo el repertorio con el mensaje
 * `{ type: "precache", urls }`; el progreso vuelve como `precache-progress` y
 * `precache-done` (ver `src/lib/offline/`).
 */
const VERSION = "heroleiros-v2";
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
  // `/_next/static/` lleva un hash en el nombre: nunca cambia, así que basta con la caché.
  if (url.pathname.startsWith("/samples/") || url.pathname.startsWith("/_next/static/")) {
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
    pathname === "/calibracion" ||
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
  const cached = await cache.match(request, { ignoreSearch: isNavigation(request) });
  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? network;
}

function isNavigation(request) {
  return request.mode === "navigate";
}

/* ---------- Descarga del repertorio para ensayar sin conexión ---------- */

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "precache" || !Array.isArray(data.urls)) return;
  const client = event.source;
  const report = (message) => {
    if (client && "postMessage" in client) client.postMessage(message);
  };
  event.waitUntil(precache(data.urls, report));
});

/**
 * Archivos de la app referenciados desde HTML, CSS o JS (con o sin `/_next/` delante).
 * Turbopack usa corchetes en los nombres (`[root-of-the-server]__….js`).
 */
const ASSET_PATTERN = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[\w\-./~@%[\]]+?\.(?:js|css|woff2?|ttf|otf)\b/g;
const PRECACHE_CONCURRENCY = 4;
/** Tope de seguridad por si un archivo referencia cosas sin fin. */
const MAX_DISCOVERED_ASSETS = 2000;

async function precache(urls, report) {
  const cache = await caches.open(VERSION);
  /** Las URLs pedidas cuentan para el resultado; las descubiertas son extra. */
  const requested = [...new Set(urls.filter((url) => typeof url === "string" && url.startsWith("/") && !url.startsWith("//")))];
  const queue = requested.map((url) => ({ url, requested: true }));
  const seen = new Set(requested);
  let done = 0;
  let failed = 0;
  let next = 0;

  report({ type: "precache-progress", done, total: requested.length });

  const discover = (text) => {
    for (const match of text.match(ASSET_PATTERN) ?? []) {
      const asset = match.startsWith("/_next/") ? match : `/_next/${match}`;
      if (seen.has(asset) || seen.size >= MAX_DISCOVERED_ASSETS) continue;
      seen.add(asset);
      queue.push({ url: asset, requested: false });
    }
  };

  const work = async () => {
    while (next < queue.length) {
      const item = queue[next++];
      try {
        const response = await fetch(item.url, { cache: "no-cache", credentials: "same-origin" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const type = response.headers.get("content-type") ?? "";
        if (/text\/html|text\/css|javascript/.test(type)) discover(await response.clone().text());
        await cache.put(item.url, response);
      } catch {
        if (item.requested) failed += 1;
      }
      if (item.requested) {
        done += 1;
        report({ type: "precache-progress", done, total: requested.length });
      }
    }
  };

  // Los archivos descubiertos se añaden a la cola mientras se trabaja: se repite hasta vaciarla.
  while (next < queue.length) {
    await Promise.all(Array.from({ length: PRECACHE_CONCURRENCY }, work));
  }
  report({ type: "precache-done", done, failed, total: requested.length });
}
