import { describe, expect, it } from "vitest";

import { parseChart } from "../chart/parse";
import { buildTestMidi } from "../chart/test-utils";
import {
  beatToTime,
  buildScore,
  clicksInWindow,
  createPlan,
  expectedNotesForPass,
  positionAt,
  scoreEventsInWindow,
} from "./timeline";

const chart = parseChart({
  slug: "t",
  meta: {
    title: "t",
    bpm: 120,
    sections: [
      { name: "A", startBar: 1, endBar: 2 },
      { name: "B", startBar: 3, endBar: 4 },
    ],
  },
  midi: buildTestMidi({
    tracks: [
      { name: "Surdo 1", notes: Array.from({ length: 16 }, (_, beat) => ({ midi: beat % 2 ? 36 : 37, beat })) },
      { name: "Agogo", notes: [{ midi: 60, beat: 8 }, { midi: 61, beat: 12 }] },
    ],
  }),
});

describe("createPlan", () => {
  it("escala el tiempo con la velocidad", () => {
    const plan = createPlan(chart, { rate: 0.5, startBar: 1, endBar: 4, loop: false, countInBars: 1 });
    expect(plan.bpm).toBe(60);
    expect(plan.secondsPerBeat).toBe(1);
    expect(plan.countInSeconds).toBe(4);
    expect(plan.passSeconds).toBe(16);
    expect(plan.endTime).toBeCloseTo(4 + 16 + 1.2);
    expect(beatToTime(plan, 0)).toBe(4);
    expect(beatToTime(plan, 3)).toBe(7);
  });

  it("limita el tramo a la canción", () => {
    const plan = createPlan(chart, { rate: 1, startBar: 0, endBar: 99, loop: true, countInBars: 0 });
    expect([plan.startBar, plan.endBar, plan.endTime]).toEqual([1, 4, Infinity]);
  });
});

describe("positionAt", () => {
  const plan = createPlan(chart, { rate: 1, startBar: 3, endBar: 4, loop: true, countInBars: 1 });

  it("cuenta atrás antes del tramo", () => {
    expect(positionAt(plan, 0)).toMatchObject({ countIn: true, countInRemaining: 4, beat: 4 });
    expect(positionAt(plan, 1.6)).toMatchObject({ countIn: true, countInRemaining: 1 });
  });

  it("vuelve al inicio del tramo en cada vuelta", () => {
    expect(positionAt(plan, 2)).toMatchObject({ countIn: false, pass: 0, beat: 8 });
    expect(positionAt(plan, 2 + 4 + 0.5)).toMatchObject({ pass: 1, beat: 9 });
  });
});

describe("eventos programados", () => {
  it("clics de cuenta atrás siempre y de canción solo con metrónomo", () => {
    const plan = createPlan(chart, { rate: 1, startBar: 1, endBar: 1, loop: false, countInBars: 1 });
    const off = clicksInWindow(plan, 0, 10, false);
    expect(off.map((c) => c.time)).toEqual([0, 0.5, 1, 1.5]);
    expect(off.map((c) => c.downbeat)).toEqual([true, false, false, false]);
    const on = clicksInWindow(plan, 0, 10, true);
    expect(on).toHaveLength(8);
    expect(on.slice(4).every((c) => !c.countIn)).toBe(true);
    expect(clicksInWindow(plan, 0.4, 1.1, false).map((c) => c.time)).toEqual([0.5, 1]);
  });

  it("repite el acompañamiento del tramo en cada vuelta del bucle", () => {
    const plan = createPlan(chart, { rate: 1, startBar: 3, endBar: 3, loop: true, countInBars: 0 });
    const score = buildScore(chart, plan);
    expect(score.map((e) => e.beat)).toEqual([8, 8, 9, 10, 11]);
    const events = scoreEventsInWindow(score, plan, 0, 4);
    expect(events.map((e) => [e.time, e.pass])).toEqual([
      [0, 0], [0, 0], [0.5, 0], [1, 0], [1.5, 0],
      [2, 1], [2, 1], [2.5, 1], [3, 1], [3.5, 1],
    ]);
    const windowed = [
      ...scoreEventsInWindow(score, plan, 0, 1.2),
      ...scoreEventsInWindow(score, plan, 1.2, 4),
    ];
    expect(windowed).toEqual(events);
  });

  it("genera las notas del jugador por vuelta con su sección", () => {
    const plan = createPlan(chart, { rate: 1, startBar: 2, endBar: 3, loop: true, countInBars: 1 });
    const track = chart.tracks[0];
    const pass0 = expectedNotesForPass(chart, track, plan, 0);
    const pass1 = expectedNotesForPass(chart, track, plan, 1);
    expect(pass0).toHaveLength(8);
    expect(pass0[0]).toMatchObject({ time: 2, lane: 1, section: 0 });
    expect(pass0[4]).toMatchObject({ time: 4, section: 1 });
    expect(pass1[0].time).toBe(6);
    expect(pass1[0].id).not.toBe(pass0[0].id);
  });
});
