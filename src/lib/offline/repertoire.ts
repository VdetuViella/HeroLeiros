/**
 * Descarga del repertorio para ensayar sin conexión.
 *
 * La página manda al service worker (`public/sw.js`) la lista de URLs con el
 * mensaje `{ type: "precache", urls }`. El SW las guarda en su caché, descubre
 * los archivos de la app que referencian (`/_next/static/…`) y avisa del avance
 * con `precache-progress` y `precache-done`.
 *
 * Sin dependencias de React ni del DOM: el entorno del navegador se inyecta para
 * poder probarlo.
 */

/** `public/samples/manifest.json`: id de sonido → archivo relativo a `public/samples/`. */
export interface SampleManifest {
  samples?: Record<string, string>;
}

/** Lo que no es una canción pero hace falta para tocar sin red. */
export const OFFLINE_SHELL: readonly string[] = [
  "/",
  "/calibracion",
  "/manifest.webmanifest",
  "/samples/manifest.json",
  "/worklets/onset-processor.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

export function songUrl(slug: string): string {
  return `/canciones/${encodeURIComponent(slug)}`;
}

export function sampleUrls(manifest: SampleManifest | null | undefined): string[] {
  const files = Object.values(manifest?.samples ?? {}).filter((file): file is string => typeof file === "string" && file !== "");
  return [...new Set(files)].map((file) => `/samples/${file.split("/").map(encodeURIComponent).join("/")}`);
}

/** Todas las URLs que se descargan: la app, cada canción y las grabaciones reales. */
export function repertoireUrls(slugs: readonly string[], manifest: SampleManifest | null | undefined): string[] {
  return [...new Set([...OFFLINE_SHELL, ...slugs.map(songUrl), ...sampleUrls(manifest)])];
}

export type OfflineStatus =
  /** Aún no se sabe (y en el servidor). */
  | "comprobando"
  /** El navegador no tiene service worker o Cache Storage. */
  | "sin-soporte"
  | "pendiente"
  | "descargando"
  | "listo"
  /** Terminó pero faltan archivos (por ejemplo, se cortó la red). */
  | "incompleto";

export interface OfflineSnapshot {
  status: OfflineStatus;
  /** Archivos pedidos ya procesados. */
  done: number;
  total: number;
  failed: number;
}

export type PrecacheMessage =
  | { type: "precache-progress"; done: number; total: number }
  | { type: "precache-done"; done: number; failed: number; total: number };

export interface OfflineEnvironment {
  /** Solo hace falta `match`: se comprueba si una canción ya está guardada. */
  caches: { match(url: string): Promise<unknown> };
  /** El SW que controla la página, cuando esté listo. */
  readyWorker(): Promise<{ postMessage(message: unknown): void } | null>;
  onMessage(listener: (data: unknown) => void): () => void;
  fetchJson(url: string): Promise<unknown>;
}

export function isPrecacheMessage(data: unknown): data is PrecacheMessage {
  if (!data || typeof data !== "object") return false;
  const { type, done, total } = data as Record<string, unknown>;
  return (type === "precache-progress" || type === "precache-done") && typeof done === "number" && typeof total === "number";
}

export const INITIAL_OFFLINE_SNAPSHOT: OfflineSnapshot = { status: "comprobando", done: 0, total: 0, failed: 0 };

/**
 * Estado de la descarga. Pensado para `useSyncExternalStore`: `getSnapshot`
 * devuelve el mismo objeto mientras no cambie nada.
 */
export class RepertoireDownload {
  private snapshot: OfflineSnapshot = INITIAL_OFFLINE_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private env: OfflineEnvironment | null = null;
  private unlisten: (() => void) | null = null;
  private checking: Promise<void> | null = null;

  constructor(
    private readonly slugs: readonly string[],
    /** Se llama la primera vez que hace falta, para no tocar `window` en el servidor. */
    private readonly environment: () => OfflineEnvironment | null,
  ) {}

  getSnapshot = (): OfflineSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Mira si todas las canciones están ya en la caché. */
  check(): Promise<void> {
    this.checking ??= this.runCheck().finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  /** Pide al service worker que descargue (o actualice) todo el repertorio. */
  async download(): Promise<void> {
    const env = this.ensureEnv();
    if (!env) return;
    if (this.isDownloading()) return;
    this.set({ status: "descargando", done: 0, total: 0, failed: 0 });

    const worker = await env.readyWorker().catch(() => null);
    if (!worker) {
      this.set({ status: "incompleto", done: 0, total: 0, failed: 0 });
      return;
    }
    const manifest = (await env.fetchJson("/samples/manifest.json").catch(() => null)) as SampleManifest | null;
    const urls = repertoireUrls(this.slugs, manifest);
    this.set({ status: "descargando", done: 0, total: urls.length, failed: 0 });
    worker.postMessage({ type: "precache", urls });
  }

  /** Deja de escuchar al service worker. Se puede volver a usar: `check` vuelve a suscribirse. */
  dispose(): void {
    this.unlisten?.();
    this.unlisten = null;
    this.env = null;
  }

  private async runCheck(): Promise<void> {
    const env = this.ensureEnv();
    if (!env) return;
    if (this.isDownloading()) return;
    const results = await Promise.all(this.slugs.map((slug) => env.caches.match(songUrl(slug)).catch(() => undefined)));
    // Puede haber empezado una descarga mientras se miraba la caché.
    if (this.isDownloading()) return;
    const saved = this.slugs.length > 0 && results.every(Boolean);
    this.set({ status: saved ? "listo" : "pendiente", done: 0, total: 0, failed: 0 });
  }

  private isDownloading(): boolean {
    return this.snapshot.status === "descargando";
  }

  private ensureEnv(): OfflineEnvironment | null {
    if (this.env) return this.env;
    let env: OfflineEnvironment | null = null;
    try {
      env = this.environment();
    } catch {
      env = null;
    }
    if (!env) {
      this.set({ status: "sin-soporte", done: 0, total: 0, failed: 0 });
      return null;
    }
    this.env = env;
    this.unlisten = env.onMessage((data) => this.onWorkerMessage(data));
    return env;
  }

  private onWorkerMessage(data: unknown): void {
    if (!isPrecacheMessage(data)) return;
    if (data.type === "precache-progress") {
      this.set({ status: "descargando", done: data.done, total: data.total, failed: 0 });
      return;
    }
    const failed = typeof data.failed === "number" ? data.failed : 0;
    this.set({ status: failed > 0 ? "incompleto" : "listo", done: data.done, total: data.total, failed });
  }

  private set(next: OfflineSnapshot): void {
    const current = this.snapshot;
    if (
      current.status === next.status &&
      current.done === next.done &&
      current.total === next.total &&
      current.failed === next.failed
    ) {
      return;
    }
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

/** Entorno real del navegador, o `null` si no hay service worker o Cache Storage. */
export function browserOfflineEnvironment(): OfflineEnvironment | null {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("caches" in window)) return null;
  const container = navigator.serviceWorker;
  return {
    caches: { match: (url) => window.caches.match(url) },
    readyWorker: () =>
      Promise.race([
        container.ready.then((registration) => registration.active),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 10_000)),
      ]),
    onMessage: (listener) => {
      const handler = (event: MessageEvent) => listener(event.data);
      container.addEventListener("message", handler);
      return () => container.removeEventListener("message", handler);
    },
    fetchJson: async (url) => {
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
  };
}
