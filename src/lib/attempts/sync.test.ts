import { describe, expect, it, vi } from "vitest";

import { makeAttempt } from "../../server/test/fixtures";
import { attemptKey, AttemptUploader, retryDelayMs, type SyncStorage } from "./sync";
import type { AttemptResult } from "./types";

function memoryStorage(): SyncStorage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    read: <T>(key: string, fallback: T) => (data.has(key) ? structuredClone(data.get(key) as T) : fallback),
    write: (key, value) => void data.set(key, structuredClone(value)),
  };
}

const attempt = (minute: number) =>
  makeAttempt({ startedAt: `2026-10-01T18:${String(minute).padStart(2, "0")}:00.000Z`, finishedAt: "2026-10-01T19:00:00.000Z" });

/** Servidor falso que acepta todo lo válido y rechaza el instrumento «guitarra». */
function fakeServer() {
  const received: string[][] = [];
  const handler = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { attempts: { key: string; result: AttemptResult }[] };
    received.push(body.attempts.map((a) => a.key));
    const accepted = body.attempts.filter((a) => a.result.instrument !== ("guitarra" as never)).map((a) => a.key);
    const rejected = body.attempts
      .filter((a) => a.result.instrument === ("guitarra" as never))
      .map((a) => ({ key: a.key, error: "instrument" }));
    return Response.json({ accepted, created: accepted, rejected }, { status: accepted.length ? 201 : 422 });
  });
  return { handler, received };
}

describe("AttemptUploader", () => {
  it("encola sin duplicar y vacía la cola al enviar", async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    const uploader = new AttemptUploader({ fetch: server.handler as typeof fetch, storage, localHistory: () => [] });

    uploader.enqueue("ana", [attempt(1), attempt(2)]);
    uploader.enqueue("ana", [attempt(1)]);
    expect(uploader.pending("ana")).toHaveLength(2);

    const result = await uploader.flush("ana");
    expect(result).toEqual({ status: "enviado", sent: 2, rejected: 0, remaining: 0 });
    expect(server.received).toEqual([[attemptKey(attempt(1)), attemptKey(attempt(2))]]);
    expect(uploader.pending("ana")).toEqual([]);
    expect(await uploader.flush("ana")).toMatchObject({ status: "vacio" });
  });

  it("sin conexión conserva la cola y cuenta el reintento; luego la envía", async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    let online = false;
    const fetchFn = vi.fn((url: string | URL | Request, init?: RequestInit) =>
      online ? server.handler(url, init) : Promise.reject(new TypeError("Failed to fetch")),
    );
    const uploader = new AttemptUploader({ fetch: fetchFn as typeof fetch, storage, localHistory: () => [] });
    uploader.enqueue("ana", [attempt(1)]);

    expect(await uploader.flush("ana")).toMatchObject({ status: "sin-conexion", remaining: 1 });
    expect(await uploader.flush("ana")).toMatchObject({ status: "sin-conexion", remaining: 1 });
    expect(uploader.pending("ana")[0].tries).toBe(2);

    // Una instancia nueva (recarga de página) ve la misma cola.
    online = true;
    const reloaded = new AttemptUploader({ fetch: fetchFn as typeof fetch, storage, localHistory: () => [] });
    expect(await reloaded.flush("ana")).toMatchObject({ status: "enviado", sent: 1, remaining: 0 });
  });

  it("errores del servidor y sesión caducada no pierden intentos", async () => {
    const storage = memoryStorage();
    const statuses = [500, 401];
    const fetchFn = vi.fn(async () => new Response("{}", { status: statuses.shift() ?? 500 }));
    const uploader = new AttemptUploader({ fetch: fetchFn as typeof fetch, storage, localHistory: () => [] });
    uploader.enqueue("ana", [attempt(1)]);
    expect(await uploader.flush("ana")).toMatchObject({ status: "error", remaining: 1 });
    expect(await uploader.flush("ana")).toMatchObject({ status: "sin-sesion", remaining: 1 });
  });

  it("descarta los intentos que el servidor rechaza por inválidos", async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    const uploader = new AttemptUploader({ fetch: server.handler as typeof fetch, storage, localHistory: () => [] });
    uploader.enqueue("ana", [attempt(1), makeAttempt({ instrument: "guitarra" as never })]);
    expect(await uploader.flush("ana")).toEqual({ status: "enviado", sent: 1, rejected: 1, remaining: 0 });
  });

  it("envía por lotes de 50", async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    const uploader = new AttemptUploader({ fetch: server.handler as typeof fetch, storage, localHistory: () => [] });
    uploader.enqueue(
      "ana",
      Array.from({ length: 120 }, (_, i) => makeAttempt({ startedAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(), finishedAt: "2026-10-02T00:00:00.000Z" })),
    );
    expect(await uploader.flush("ana")).toMatchObject({ sent: 120, remaining: 0 });
    expect(server.received.map((b) => b.length)).toEqual([50, 50, 20]);
  });

  it("la cola es por usuario", async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    const uploader = new AttemptUploader({ fetch: server.handler as typeof fetch, storage, localHistory: () => [] });
    uploader.enqueue("ana", [attempt(1)]);
    uploader.enqueue("bruno", [attempt(2)]);
    await uploader.flush("bruno");
    expect(uploader.pending("ana")).toHaveLength(1);
    expect(uploader.pending("bruno")).toHaveLength(0);
  });

  it("ofrece subir el historial local que falta, una sola vez", async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    const empty = makeAttempt({ startedAt: "2026-10-01T10:00:00.000Z", notesJudged: 0 });
    const local = [attempt(1), attempt(2), attempt(3), empty];
    const uploader = new AttemptUploader({ fetch: server.handler as typeof fetch, storage, localHistory: () => local });

    expect(uploader.unsyncedLocal("ana")).toHaveLength(3);
    uploader.enqueue("ana", [attempt(1)]);
    await uploader.flush("ana");
    expect(uploader.unsyncedLocal("ana").map(attemptKey)).toEqual([attempt(2), attempt(3)].map(attemptKey));

    uploader.dismissLocal("ana", [attempt(2)]);
    expect(uploader.unsyncedLocal("ana").map(attemptKey)).toEqual([attemptKey(attempt(3))]);
    // Otro usuario en el mismo dispositivo sí ve las suyas.
    expect(uploader.unsyncedLocal("bruno")).toHaveLength(3);
  });

  it("flush simultáneos comparten un único envío", async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    const uploader = new AttemptUploader({ fetch: server.handler as typeof fetch, storage, localHistory: () => [] });
    uploader.enqueue("ana", [attempt(1)]);
    const [a, b] = await Promise.all([uploader.flush("ana"), uploader.flush("ana")]);
    expect(a).toBe(b);
    expect(server.handler).toHaveBeenCalledTimes(1);
  });
});

describe("retryDelayMs", () => {
  it("crece con los fallos y se estabiliza", () => {
    expect([1, 2, 3, 4, 10].map(retryDelayMs)).toEqual([5_000, 15_000, 60_000, 300_000, 300_000]);
  });
});
