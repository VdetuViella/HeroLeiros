import { describe, expect, it } from "vitest";

import { buildPatternChart, patternError } from "./build";

describe("charts a partir de patrones", () => {
  it("convierte semicorcheas, tresillos y corcheas en pulsos", () => {
    const chart = buildPatternChart({
      slug: "prueba",
      title: "Prueba",
      bpm: 120,
      tracks: [{ instrument: "caixa", bars: ["X.o.x...........", "xxx.........", "x.x....."] }],
    });
    const caixa = chart.tracks[0];
    expect(chart.bars).toBe(3);
    expect(chart.beatsPerBar).toBe(4);
    expect(chart.durationSeconds).toBe(6);
    expect(caixa.notes.map((n) => n.beat)).toEqual([0, 0.5, 1, 4, 4 + 1 / 3, 4 + 2 / 3, 8, 9].map((b) => Math.round(b * 1e6) / 1e6));
    expect(caixa.notes[0]).toMatchObject({ stroke: "abierto", accent: true, bar: 1, midi: 40, id: "caixa-0" });
    expect(caixa.notes[1]).toMatchObject({ stroke: "apagado", accent: false });
    expect(caixa.notes[3].time).toBeCloseTo(2);
    // Carriles en el orden del instrumento, solo los que se usan.
    expect(caixa.lanes).toEqual(["abierto", "apagado"]);
    expect(caixa.notes.map((n) => n.lane)).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
  });

  it("lleva la digitación a cada nota", () => {
    const chart = buildPatternChart({
      slug: "manos",
      title: "Manos",
      bpm: 60,
      tracks: [{ instrument: "caixa", bars: ["xxxx"], hands: ["DI.D"] }],
    });
    expect(chart.tracks[0].notes.map((n) => n.hand ?? null)).toEqual(["D", "I", null, "D"]);
  });

  it("la primera pista es la del alumno; las demás, acompañamiento", () => {
    const chart = buildPatternChart({
      slug: "acomp",
      title: "Acomp",
      bpm: 90,
      tracks: [
        { instrument: "surdo3", bars: ["..x."] },
        { instrument: "surdo1", bars: ["o.x."] },
      ],
    });
    expect(chart.tracks.map((t) => t.instrument)).toEqual(["surdo3", "surdo1"]);
  });

  it("secciones por compás de inicio", () => {
    const chart = buildPatternChart({
      slug: "secciones",
      title: "Rutina",
      bpm: 80,
      sections: [
        { name: "B", startBar: 3 },
        { name: "A", startBar: 1 },
      ],
      tracks: [{ instrument: "surdo1", bars: ["x...", "x...", "x...", "x..."] }],
    });
    expect(chart.sections.map((s) => [s.name, s.startBar, s.endBar, s.startBeat, s.endBeat])).toEqual([
      ["A", 1, 2, 0, 8],
      ["B", 3, 4, 8, 16],
    ]);
  });

  it("rechaza patrones mal escritos", () => {
    expect(patternError("xxx", 4)).toMatch(/repartirse/);
    expect(patternError("xq..", 4)).toMatch(/Carácter desconocido/);
    expect(patternError("x...", 4, "DI")).toMatch(/misma longitud/);
    expect(patternError("x...", 4, "DD..")).toMatch(/silencio/);
    expect(patternError("x...", 4, "Z...")).toMatch(/Mano desconocida/);
    expect(patternError("x.x.", 4, "D.I.")).toBeNull();
    expect(() => buildPatternChart({ slug: "mal", title: "Mal", bpm: 60, tracks: [{ instrument: "surdo1", bars: ["r..."] }] })).toThrow(/no existe/);
  });
});
