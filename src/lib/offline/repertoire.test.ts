import { describe, expect, it } from "vitest";

import {
  OFFLINE_SHELL,
  RepertoireDownload,
  isPrecacheMessage,
  repertoireUrls,
  sampleUrls,
  songUrl,
  type OfflineEnvironment,
} from "./repertoire";

function fakeEnvironment(options: { cached?: string[]; manifest?: unknown; noWorker?: boolean } = {}) {
  const cached = new Set(options.cached ?? []);
  const posted: unknown[] = [];
  let listener: ((data: unknown) => void) | null = null;
  const env: OfflineEnvironment = {
    caches: { match: async (url) => (cached.has(url) ? {} : undefined) },
    readyWorker: async () => (options.noWorker ? null : { postMessage: (message) => posted.push(message) }),
    onMessage: (fn) => {
      listener = fn;
      return () => {
        listener = null;
      };
    },
    fetchJson: async () => {
      if (options.manifest === undefined) throw new Error("sin manifiesto");
      return options.manifest;
    },
  };
  return {
    env,
    posted,
    send: (data: unknown) => listener?.(data),
    listening: () => listener !== null,
  };
}

describe("URLs del repertorio", () => {
  it("una canción vive en /canciones/<slug>", () => {
    expect(songUrl("samba-de-ensayo")).toBe("/canciones/samba-de-ensayo");
  });

  it("las grabaciones salen del manifiesto, sin repetir y codificadas", () => {
    const manifest = { samples: { "surdo1-abierto": "surdo1/abierto.wav", "surdo1-x": "surdo1/abierto.wav", caixa: "caixa/aro fuerte.wav" } };
    expect(sampleUrls(manifest)).toEqual(["/samples/surdo1/abierto.wav", "/samples/caixa/aro%20fuerte.wav"]);
    expect(sampleUrls(null)).toEqual([]);
    expect(sampleUrls({})).toEqual([]);
  });

  it("incluye la app, cada canción y las grabaciones", () => {
    const urls = repertoireUrls(["a", "b"], { samples: { x: "caixa/aro.wav" } });
    expect(urls.slice(0, OFFLINE_SHELL.length)).toEqual([...OFFLINE_SHELL]);
    expect(urls).toContain("/canciones/a");
    expect(urls).toContain("/canciones/b");
    expect(urls).toContain("/samples/caixa/aro.wav");
    expect(urls).toContain("/escuela");
    expect(urls).toContain("/escuela/caixa-paradiddle");
    expect(urls).toContain("/escuela/rutina-calentamiento-surdo");
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("reconoce los mensajes del service worker", () => {
    expect(isPrecacheMessage({ type: "precache-progress", done: 1, total: 3 })).toBe(true);
    expect(isPrecacheMessage({ type: "precache-done", done: 3, total: 3, failed: 0 })).toBe(true);
    expect(isPrecacheMessage({ type: "otra-cosa", done: 1, total: 3 })).toBe(false);
    expect(isPrecacheMessage(null)).toBe(false);
    expect(isPrecacheMessage("precache-done")).toBe(false);
  });
});

describe("RepertoireDownload", () => {
  it("empieza «comprobando» y pasa a «pendiente» si falta alguna canción", async () => {
    const { env } = fakeEnvironment({ cached: ["/canciones/a"] });
    const store = new RepertoireDownload(["a", "b"], () => env);
    expect(store.getSnapshot().status).toBe("comprobando");
    await store.check();
    expect(store.getSnapshot().status).toBe("pendiente");
  });

  it("queda «listo» si todas las canciones están en la caché", async () => {
    const { env } = fakeEnvironment({ cached: ["/canciones/a", "/canciones/b"] });
    const store = new RepertoireDownload(["a", "b"], () => env);
    await store.check();
    expect(store.getSnapshot().status).toBe("listo");
  });

  it("sin service worker ni caché, «sin-soporte»", async () => {
    const store = new RepertoireDownload(["a"], () => null);
    await store.check();
    expect(store.getSnapshot().status).toBe("sin-soporte");
    await store.download();
    expect(store.getSnapshot().status).toBe("sin-soporte");
  });

  it("un entorno que falla al crearse cuenta como «sin-soporte»", async () => {
    const store = new RepertoireDownload(["a"], () => {
      throw new Error("sin window");
    });
    await store.check();
    expect(store.getSnapshot().status).toBe("sin-soporte");
  });

  it("descarga: manda las URLs al SW y sigue el progreso hasta «listo»", async () => {
    const fake = fakeEnvironment({ manifest: { samples: { x: "caixa/aro.wav" } } });
    const store = new RepertoireDownload(["a"], () => fake.env);
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.getSnapshot().status));

    await store.download();
    expect(fake.posted).toHaveLength(1);
    const message = fake.posted[0] as { type: string; urls: string[] };
    expect(message.type).toBe("precache");
    expect(message.urls).toContain("/canciones/a");
    expect(message.urls).toContain("/samples/caixa/aro.wav");
    expect(store.getSnapshot()).toEqual({ status: "descargando", done: 0, total: message.urls.length, failed: 0 });

    fake.send({ type: "precache-progress", done: 2, total: message.urls.length });
    expect(store.getSnapshot().done).toBe(2);
    fake.send({ type: "precache-done", done: message.urls.length, total: message.urls.length, failed: 0 });
    expect(store.getSnapshot().status).toBe("listo");
    expect(seen[0]).toBe("descargando");
    expect(seen[seen.length - 1]).toBe("listo");
  });

  it("si falla algún archivo queda «incompleto» con el número de fallos", async () => {
    const fake = fakeEnvironment();
    const store = new RepertoireDownload(["a"], () => fake.env);
    await store.download();
    fake.send({ type: "precache-done", done: 9, total: 9, failed: 2 });
    expect(store.getSnapshot()).toEqual({ status: "incompleto", done: 9, total: 9, failed: 2 });
  });

  it("sin manifiesto de samples descarga igual el resto", async () => {
    const fake = fakeEnvironment();
    const store = new RepertoireDownload(["a"], () => fake.env);
    await store.download();
    const { urls } = fake.posted[0] as { urls: string[] };
    expect(urls).toEqual(repertoireUrls(["a"], null));
    expect(urls.some((u) => u.startsWith("/samples/") && u !== "/samples/manifest.json")).toBe(false);
  });

  it("si el SW no llega a estar listo queda «incompleto» sin mandar nada", async () => {
    const fake = fakeEnvironment({ noWorker: true });
    const store = new RepertoireDownload(["a"], () => fake.env);
    await store.download();
    expect(fake.posted).toHaveLength(0);
    expect(store.getSnapshot().status).toBe("incompleto");
  });

  it("una comprobación durante la descarga no la interrumpe", async () => {
    const fake = fakeEnvironment();
    const store = new RepertoireDownload(["a"], () => fake.env);
    await store.download();
    await store.check();
    expect(store.getSnapshot().status).toBe("descargando");
  });

  it("no avisa si el estado no cambia y deja de escuchar al cerrar", async () => {
    const fake = fakeEnvironment();
    const store = new RepertoireDownload(["a"], () => fake.env);
    await store.check();
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    const before = store.getSnapshot();
    await store.check();
    expect(store.getSnapshot()).toBe(before);
    expect(calls).toBe(0);
    unsubscribe();
    store.dispose();
    expect(fake.listening()).toBe(false);
  });

  it("tras cerrar y volver a montar (modo estricto) sigue recibiendo el progreso", async () => {
    const fake = fakeEnvironment();
    const store = new RepertoireDownload(["a"], () => fake.env);
    await store.check();
    store.dispose();
    await store.check();
    expect(fake.listening()).toBe(true);
    await store.download();
    fake.send({ type: "precache-done", done: 8, total: 8, failed: 0 });
    expect(store.getSnapshot().status).toBe("listo");
  });
});
