import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AttemptResult } from "../../lib/attempts/types";
import { toAttemptRow } from "../attempts/validate";
import { attempts, groups, memberships } from "../db/schema";
import type { Db } from "../db/types";
import { createTestDb, insertUser } from "../test/db";
import { makeAttempt, section } from "../test/fixtures";
import {
  accuracyTrend,
  groupBestMatrix,
  groupMembers,
  groupRecentActivity,
  groupSectionMisses,
  groupWeekStats,
  memberBests,
  memberHistory,
  memberSummary,
} from "./queries";

let db: Db;
let close: () => Promise<void>;
let groupId: string;
const NOW = new Date("2026-10-06T12:00:00.000Z");

let seq = 0;
async function play(userId: string, overrides: Partial<AttemptResult>) {
  await db.insert(attempts).values(toAttemptRow(userId, `k${seq++}`, makeAttempt(overrides)));
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await insertUser(db, { id: "dir", name: "Marta", role: "director" });
  await insertUser(db, { id: "ana", name: "Ana" });
  await insertUser(db, { id: "bea", name: "Bea" });
  await insertUser(db, { id: "fuera", name: "Fuera del grupo" });
  const [group] = await db.insert(groups).values({ name: "Bloco", directorId: "dir", inviteCode: "codigo1234" }).returning();
  groupId = group.id;
  await db.insert(memberships).values([
    { groupId, userId: "ana" },
    { groupId, userId: "bea" },
  ]);

  // Ana: caixa en samba (mejora), surdo1 en primeros pasos, y un intento vacío.
  await play("ana", { finishedAt: "2026-10-01T18:00:00.000Z", accuracy: 0.6, score: 5000 });
  await play("ana", { finishedAt: "2026-10-01T19:00:00.000Z", accuracy: 0.7, score: 6000 });
  await play("ana", { finishedAt: "2026-10-04T18:00:00.000Z", accuracy: 0.9, score: 9000, speed: 0.75 });
  await play("ana", { finishedAt: "2026-10-05T18:00:00.000Z", accuracy: 0.9, score: 9500 });
  await play("ana", {
    songSlug: "primeros-pasos",
    songTitle: "Primeros pasos",
    instrument: "surdo1",
    finishedAt: "2026-10-05T20:00:00.000Z",
    accuracy: 0.8,
    sections: [section("Todos", 10, 5, 9, 12)],
  });
  await play("ana", { finishedAt: "2026-10-05T21:00:00.000Z", accuracy: 0, notesJudged: 0, score: 0, sections: [] });

  // Bea: caixa y repinique en samba; muchos fallos en el Breque con repinique.
  await play("bea", { finishedAt: "2026-10-03T10:00:00.000Z", accuracy: 0.5 });
  await play("bea", {
    instrument: "repinique",
    finishedAt: "2026-10-06T09:00:00.000Z",
    accuracy: 0.65,
    sections: [section("Breque", 16, 12, 13, 16), section("Groove", 40, 1, 5, 12)],
  });

  // Fuera del grupo: no debe aparecer en las vistas del director.
  await play("fuera", { finishedAt: "2026-10-06T08:00:00.000Z", accuracy: 1, sections: [section("Breque", 16, 16)] });
  // Intento antiguo de Bea: fuera de la ventana de 30 días de fallos.
  await play("bea", { finishedAt: "2026-08-01T10:00:00.000Z", accuracy: 0.1, sections: [section("Final", 8, 8)] });
});

afterAll(() => close());

describe("consultas del miembro", () => {
  it("historial: más reciente primero y con límite", async () => {
    const history = await memberHistory(db, "ana", 3);
    expect(history.map((h) => h.finishedAt.toISOString())).toEqual([
      "2026-10-05T21:00:00.000Z",
      "2026-10-05T20:00:00.000Z",
      "2026-10-05T18:00:00.000Z",
    ]);
  });

  it("mejor marca por canción e instrumento: desempata por puntuación e ignora intentos vacíos", async () => {
    const bests = await memberBests(db, "ana");
    expect(bests).toHaveLength(2);
    const samba = bests.find((b) => b.songSlug === "samba-de-ensayo")!;
    expect(samba.instrument).toBe("caixa");
    expect(samba.accuracy).toBeCloseTo(0.9);
    expect(samba.score).toBe(9500);
    expect(samba.speed).toBe(1);
    expect(samba.attempts).toBe(4);
    expect(samba.lastPlayedAt.toISOString()).toBe("2026-10-05T18:00:00.000Z");
    const surdo = bests.find((b) => b.songSlug === "primeros-pasos")!;
    expect(surdo).toMatchObject({ instrument: "surdo1", attempts: 1 });
  });

  it("evolución: media y mejor por día local, filtrable por canción", async () => {
    const trend = await accuracyTrend(db, "ana", { now: NOW, songSlug: "samba-de-ensayo" });
    expect(trend.map((p) => p.day)).toEqual(["2026-10-01", "2026-10-04", "2026-10-05"]);
    expect(trend[0].attempts).toBe(2);
    expect(trend[0].meanAccuracy).toBeCloseTo(0.65);
    expect(trend[0].bestAccuracy).toBeCloseTo(0.7);

    const all = await accuracyTrend(db, "ana", { now: NOW });
    expect(all.at(-1)).toMatchObject({ day: "2026-10-05", attempts: 2 });
    expect(await accuracyTrend(db, "ana", { now: NOW, days: 0.5 })).toEqual([]);
  });

  it("agrupa por día en la zona horaria pedida", async () => {
    // 2026-10-05T23:30Z ya es día 6 en Madrid (UTC+2).
    await play("bea", { finishedAt: "2026-10-05T23:30:00.000Z", accuracy: 0.4, songSlug: "tz", songTitle: "TZ" });
    const madrid = await accuracyTrend(db, "bea", { now: NOW, songSlug: "tz" });
    const utc = await accuracyTrend(db, "bea", { now: NOW, songSlug: "tz", timeZone: "UTC" });
    expect(madrid[0].day).toBe("2026-10-06");
    expect(utc[0].day).toBe("2026-10-05");
    await db.delete(attempts).where(eq(attempts.songSlug, "tz"));
  });

  it("resumen", async () => {
    const summary = await memberSummary(db, "ana");
    expect(summary.attempts).toBe(6);
    expect(summary.songs).toBe(2);
    expect(summary.meanAccuracy).toBeCloseTo((0.6 + 0.7 + 0.9 + 0.9 + 0.8) / 5);
    expect(summary.practiceSeconds).toBe(6 * 90);
    expect(await memberSummary(db, "dir")).toMatchObject({ attempts: 0, meanAccuracy: null, lastPlayedAt: null });
  });
});

describe("consultas del director", () => {
  it("miembros con su instrumento principal", async () => {
    const members = await groupMembers(db, groupId);
    expect(members.map((m) => m.name)).toEqual(["Ana", "Bea"]);
    expect(members[0]).toMatchObject({ attempts: 6, mainInstrument: "caixa" });
  });

  it("tabla miembros × canciones con la mejor precisión (cualquier instrumento)", async () => {
    const matrix = await groupBestMatrix(db, groupId);
    const cell = (user: string, song: string) => matrix.find((c) => c.userId === user && c.songSlug === song);
    expect(matrix.every((c) => c.userId !== "fuera")).toBe(true);
    expect(cell("ana", "samba-de-ensayo")).toMatchObject({ instrument: "caixa", attempts: 4 });
    expect(cell("ana", "samba-de-ensayo")!.accuracy).toBeCloseTo(0.9);
    expect(cell("bea", "samba-de-ensayo")).toMatchObject({ instrument: "repinique", attempts: 3 });
    expect(cell("bea", "primeros-pasos")).toBeUndefined();
  });

  it("actividad reciente solo del grupo", async () => {
    const recent = await groupRecentActivity(db, groupId, 3);
    expect(recent.map((r) => [r.userName, r.finishedAt.toISOString()])).toEqual([
      ["Bea", "2026-10-06T09:00:00.000Z"],
      ["Ana", "2026-10-05T21:00:00.000Z"],
      ["Ana", "2026-10-05T20:00:00.000Z"],
    ]);
  });

  it("secciones con más fallos por canción e instrumento, en los últimos 30 días", async () => {
    const misses = await groupSectionMisses(db, groupId, { now: NOW });
    expect(misses[0]).toMatchObject({
      songSlug: "samba-de-ensayo",
      section: "Groove",
      instrument: "caixa",
      misses: 6 * 5,
      notes: 40 * 5,
      players: 2,
      attempts: 5,
    });
    const breque = misses.find((m) => m.section === "Breque")!;
    expect(breque).toMatchObject({ instrument: "repinique", misses: 12, notes: 16, players: 1 });
    expect(breque.missRate).toBeCloseTo(0.75);
    expect(misses.some((m) => m.section === "Final")).toBe(false);
    // Las secciones sin fallos no aparecen.
    expect(misses.some((m) => m.section === "Groove" && m.instrument === "repinique")).toBe(true);
    expect(misses.every((m) => m.misses > 0)).toBe(true);
    expect(await groupSectionMisses(db, groupId, { now: NOW, limit: 2 })).toHaveLength(2);
  });

  it("estadísticas de la semana", async () => {
    const week = await groupWeekStats(db, groupId, NOW);
    expect(week.activeMembers).toBe(2);
    expect(week.attempts).toBe(8);
    expect(week.meanAccuracy).toBeCloseTo((0.6 + 0.7 + 0.9 + 0.9 + 0.8 + 0.5 + 0.65) / 7);
  });
});
