import { describe, expect, it } from "vitest";

import { Judge } from "./judge";
import { accuracyFor, multiplierFor, starsFor } from "./scoring";
import type { ExpectedNote } from "./types";

function notes(...specs: [time: number, lane: number, section?: number][]): ExpectedNote[] {
  return specs.map(([time, lane, section = 0], i) => ({ id: `n${i}`, time, lane, section }));
}

describe("Judge: ventanas de tiempo", () => {
  it.each([
    [0, "perfecto"],
    [0.035, "perfecto"],
    [-0.035, "perfecto"],
    [0.036, "bien"],
    [-0.07, "bien"],
    [0.071, "regular"],
    [-0.12, "regular"],
  ])("desfase %s s → %s", (offset, expected) => {
    const judge = new Judge();
    judge.addNotes(notes([1, 0]));
    const event = judge.hit(0, 1 + offset);
    expect(event.kind).toBe("acierto");
    if (event.kind === "acierto") {
      expect(event.judgement).toBe(expected);
      expect(event.offset).toBeCloseTo(offset, 9);
    }
  });

  it("fuera de ±120 ms es un golpe de más", () => {
    const judge = new Judge();
    judge.addNotes(notes([1, 0]));
    expect(judge.hit(0, 1.13).kind).toBe("golpe-de-mas");
    expect(judge.hit(0, 0.87).kind).toBe("golpe-de-mas");
    expect(judge.stats().counts.extra).toBe(2);
  });
});

describe("Judge: carriles, fallos y combo", () => {
  it("cuenta el carril equivocado sin consumir la nota", () => {
    const judge = new Judge();
    judge.addNotes(notes([1, 0]));
    const wrong = judge.hit(1, 1);
    expect(wrong).toMatchObject({ kind: "carril-equivocado", lane: 1, expectedLane: 0 });
    expect(judge.hit(0, 1.01)).toMatchObject({ kind: "acierto", judgement: "perfecto" });
    expect(judge.stats().counts).toMatchObject({ carrilEquivocado: 1, perfecto: 1 });
  });

  it("con carril null acepta cualquier carril (modo micrófono)", () => {
    const judge = new Judge();
    judge.addNotes(notes([1, 2]));
    expect(judge.hit(null, 1.05)).toMatchObject({ kind: "acierto", judgement: "bien" });
  });

  it("elige la nota más cercana del carril", () => {
    const judge = new Judge();
    judge.addNotes(notes([1, 0], [1.15, 0]));
    const event = judge.hit(0, 1.12);
    expect(event.kind === "acierto" && event.note.id).toBe("n1");
  });

  it("no juzga dos veces la misma nota", () => {
    const judge = new Judge();
    judge.addNotes(notes([1, 0]));
    expect(judge.hit(0, 1).kind).toBe("acierto");
    expect(judge.hit(0, 1.01).kind).toBe("golpe-de-mas");
  });

  it("advance marca como fallo las notas cuya ventana pasó", () => {
    const judge = new Judge();
    judge.addNotes(notes([1, 0], [2, 1]));
    expect(judge.advance(1.1)).toHaveLength(0);
    const missed = judge.advance(1.13);
    expect(missed).toHaveLength(1);
    expect(missed[0]).toMatchObject({ kind: "fallo", note: { id: "n0" } });
    expect(judge.notes[0].result).toBe("fallo");
    expect(judge.finish(3)).toHaveLength(1);
    expect(judge.stats().counts.fallo).toBe(2);
  });

  it("el combo sube el multiplicador cada 10 aciertos y se rompe al fallar", () => {
    const judge = new Judge();
    judge.addNotes(notes(...Array.from({ length: 12 }, (_, i) => [i, 0] as [number, number])));
    let last;
    for (let i = 0; i < 11; i++) last = judge.hit(0, i);
    expect(last).toMatchObject({ kind: "acierto", combo: 11, multiplier: 2, points: 200 });
    expect(judge.stats()).toMatchObject({ combo: 11, maxCombo: 11, multiplier: 2 });
    judge.hit(0, 10.5);
    expect(judge.stats().combo).toBe(0);
    expect(judge.stats().maxCombo).toBe(11);
    expect(judge.stats().score).toBe(10 * 100 + 200);
  });

  it("exige añadir las notas en orden", () => {
    const judge = new Judge();
    judge.addNotes(notes([2, 0]));
    expect(() => judge.addNotes(notes([1, 0]))).toThrow();
  });
});

describe("Judge: estadísticas", () => {
  it("calcula precisión, estrellas, desfase medio y desglose por sección", () => {
    const judge = new Judge({ sectionCount: 2, sectionAt: (t) => (t < 2 ? 0 : 1) });
    judge.addNotes(notes([0, 0, 0], [1, 0, 0], [2, 0, 1], [3, 0, 1]));
    judge.hit(0, 0.01);
    judge.hit(0, 1.05);
    judge.hit(0, 2.5);
    judge.finish(5);
    const stats = judge.stats();
    expect(stats.counts).toMatchObject({ perfecto: 1, bien: 1, fallo: 2, extra: 1 });
    expect(stats.accuracy).toBeCloseTo((1 + 0.75) / 5, 9);
    expect(stats.stars).toBe(1);
    expect(stats.meanOffset).toBeCloseTo(0.03, 9);
    expect(stats.sections[0]).toMatchObject({ notes: 2, accuracy: 0.875 });
    expect(stats.sections[1]).toMatchObject({ notes: 2, counts: { extra: 1, fallo: 2 } });
  });
});

describe("scoring", () => {
  it("multiplicador de 1 a 4", () => {
    expect([0, 9, 10, 19, 20, 30, 99].map(multiplierFor)).toEqual([1, 1, 2, 2, 3, 4, 4]);
  });

  it("estrellas por precisión", () => {
    expect([0, 0.25, 0.5, 0.7, 0.85, 0.95, 1].map(starsFor)).toEqual([0, 1, 2, 3, 4, 5, 5]);
  });

  it("precisión sin penalizar golpes sueltos", () => {
    const counts = { perfecto: 2, bien: 0, regular: 0, fallo: 0, extra: 2, carrilEquivocado: 0 };
    expect(accuracyFor(counts)).toBe(0.5);
    expect(accuracyFor(counts, false)).toBe(1);
  });
});
