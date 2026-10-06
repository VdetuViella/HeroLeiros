import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { attempts } from "../db/schema";
import type { Db } from "../db/types";
import type { SessionUser } from "../session";
import { createTestDb, insertUser } from "../test/db";
import { makeAttempt } from "../test/fixtures";
import { getAttempts, postAttempts, type PostAttemptsResponse } from "./attempts";
import type { ApiContext } from "./http";

let db: Db;
let close: () => Promise<void>;
let ana: SessionUser;
let bruno: SessionUser;

function ctxAs(user: SessionUser | null): ApiContext {
  return { db, getUser: async () => user };
}

function post(body: unknown, raw = false): Request {
  return new Request("http://test/api/attempts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  ana = await insertUser(db, { id: "ana", name: "Ana" });
  bruno = await insertUser(db, { id: "bruno", name: "Bruno" });
});

afterAll(() => close());

beforeEach(async () => {
  await db.delete(attempts);
});

describe("POST /api/attempts", () => {
  it("exige sesión", async () => {
    const res = await postAttempts(post({ key: "k1", result: makeAttempt() }), ctxAs(null));
    expect(res.status).toBe(401);
    expect(await db.$count(attempts)).toBe(0);
  });

  it("rechaza JSON roto y formas desconocidas", async () => {
    expect((await postAttempts(post("{nope", true), ctxAs(ana))).status).toBe(400);
    expect((await postAttempts(post({ foo: 1 }), ctxAs(ana))).status).toBe(400);
    expect((await postAttempts(post({ attempts: [] }), ctxAs(ana))).status).toBe(400);
    const tooMany = Array.from({ length: 51 }, (_, i) => ({ key: `k${i}`, result: makeAttempt() }));
    expect((await postAttempts(post({ attempts: tooMany }), ctxAs(ana))).status).toBe(400);
  });

  it("guarda un intento y lo asocia al usuario de la sesión", async () => {
    const res = await postAttempts(post({ key: "k1", result: makeAttempt({ score: 999 }) }), ctxAs(ana));
    expect(res.status).toBe(201);
    const body = (await res.json()) as PostAttemptsResponse;
    expect(body).toEqual({ accepted: ["k1"], created: ["k1"], rejected: [] });

    const [row] = await db.select().from(attempts);
    expect(row.userId).toBe("ana");
    expect(row.score).toBe(999);
    expect(row.sections).toHaveLength(2);
    expect(row.finishedAt.toISOString()).toBe("2026-10-01T18:00:00.000Z");
  });

  it("es idempotente: reenviar la misma clave no duplica", async () => {
    const envelope = { key: "k1", result: makeAttempt() };
    await postAttempts(post(envelope), ctxAs(ana));
    const again = await postAttempts(post(envelope), ctxAs(ana));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ accepted: ["k1"], created: [], rejected: [] });
    expect(await db.$count(attempts)).toBe(1);
  });

  it("la misma clave de otro usuario es otro intento", async () => {
    const envelope = { key: "k1", result: makeAttempt() };
    await postAttempts(post(envelope), ctxAs(ana));
    await postAttempts(post(envelope), ctxAs(bruno));
    expect(await db.$count(attempts)).toBe(2);
  });

  it("acepta lotes y separa los intentos inválidos", async () => {
    const res = await postAttempts(
      post({
        attempts: [
          { key: "ok-1", result: makeAttempt() },
          { key: "mal-instrumento", result: makeAttempt({ instrument: "guitarra" as never }) },
          { key: "ok-2", result: makeAttempt({ finishedAt: "2026-10-02T10:00:00.000Z" }) },
          { key: "precision", result: { ...makeAttempt(), accuracy: 1.5 } },
        ],
      }),
      ctxAs(ana),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as PostAttemptsResponse;
    expect(body.accepted).toEqual(["ok-1", "ok-2"]);
    expect(body.created.sort()).toEqual(["ok-1", "ok-2"]);
    expect(body.rejected.map((r) => r.key)).toEqual(["mal-instrumento", "precision"]);
    expect(body.rejected[0].error).toContain("instrument");
    expect(await db.$count(attempts)).toBe(2);
  });

  it("responde 422 si ningún intento es válido", async () => {
    const res = await postAttempts(
      post({ key: "k", result: { ...makeAttempt(), startedAt: "ayer" } }),
      ctxAs(ana),
    );
    expect(res.status).toBe(422);
    expect(((await res.json()) as PostAttemptsResponse).rejected[0].key).toBe("k");
  });

  it("rechaza partidas que terminan antes de empezar", async () => {
    const result = makeAttempt({ startedAt: "2026-10-01T19:00:00.000Z", finishedAt: "2026-10-01T18:00:00.000Z" });
    const res = await postAttempts(post({ key: "k", result }), ctxAs(ana));
    expect(res.status).toBe(422);
  });

  it("acepta la entrada por micrófono", async () => {
    const res = await postAttempts(
      post({ key: "mic", result: makeAttempt({ inputSources: ["microfono", "microfono"] }) }),
      ctxAs(ana),
    );
    expect(res.status).toBe(201);
    const [row] = await db.select().from(attempts);
    expect(row.inputSources).toEqual(["microfono"]);
  });
});

describe("GET /api/attempts", () => {
  it("devuelve solo el historial propio, el más reciente primero", async () => {
    const batch = ["2026-10-01", "2026-10-03", "2026-10-02"].map((day, i) => ({
      key: `a${i}`,
      result: makeAttempt({ finishedAt: `${day}T12:00:00.000Z` }),
    }));
    await postAttempts(post({ attempts: batch }), ctxAs(ana));
    await postAttempts(post({ key: "b", result: makeAttempt() }), ctxAs(bruno));

    const res = await getAttempts(new Request("http://test/api/attempts?limit=2"), ctxAs(ana));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { attempts: { finishedAt: string }[] };
    expect(body.attempts.map((a) => a.finishedAt.slice(0, 10))).toEqual(["2026-10-03", "2026-10-02"]);
  });

  it("exige sesión", async () => {
    expect((await getAttempts(new Request("http://test/api/attempts"), ctxAs(null))).status).toBe(401);
  });
});
