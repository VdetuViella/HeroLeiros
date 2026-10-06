import { describe, expect, it } from "vitest";

import type { BeatDivision, QuantizedBar, QuantizedBeat } from "./quantize";
import { barTokenCount, beatRhythm, isEmptyBar } from "./rhythm";

/** `x` = golpe, `.` = silencio; 4 caracteres = semicorcheas, 3 = tresillo. */
function beat(pattern: string, start = 0): QuantizedBeat {
  const division = pattern.length as BeatDivision;
  return {
    beat: start,
    division,
    slots: [...pattern].map((char, slot) =>
      char === "."
        ? null
        : { id: `${start}-${slot}`, beat: start + slot / division, offset: 0, stroke: "abierto", accent: false, lane: 0 },
    ),
  };
}

function spell(pattern: string): string {
  const { tuplet, tokens } = beatRhythm(beat(pattern));
  const text = tokens.map((t) => `${t.duration}${t.dots ? "." : ""}${t.note ? "" : "r"}`).join(" ");
  return tuplet ? `3[${text}]` : text;
}

describe("beatRhythm", () => {
  it.each([
    ["....", "qr"],
    ["x...", "q"],
    ["x.x.", "8 8"],
    ["xxxx", "16 16 16 16"],
    [".x..", "16r 8."],
    ["..x.", "8r 8"],
    ["...x", "8r 16r 16"],
    ["x..x", "8. 16"],
    ["x.xx", "8 16 16"],
    [".xx.", "16r 16 8"],
    ["...", "qr"],
    ["x..", "q"],
    ["xxx", "3[8 8 8]"],
    [".xx", "3[8r 8 8]"],
    ["x.x", "3[q 8]"],
    ["..x", "3[qr 8]"],
    [".x.", "3[8r q]"],
  ])("%s → %s", (pattern, expected) => {
    expect(spell(pattern)).toBe(expected);
  });

  it("las figuras de cada pulso suman exactamente el pulso", () => {
    for (const pattern of ["x.xx", ".x.x", "...x", ".xx", "x.x"]) {
      const { tokens } = beatRhythm(beat(pattern));
      expect(tokens.reduce((sum, t) => sum + t.length, 0)).toBe(pattern.length);
      tokens.forEach((t, i) => i > 0 && expect(t.slot).toBe(tokens[i - 1].slot + tokens[i - 1].length));
    }
  });

  it("cada figura con nota lleva la nota de su casilla", () => {
    const { tokens } = beatRhythm(beat(".x.x", 8));
    expect(tokens.filter((t) => t.note).map((t) => t.note?.beat)).toEqual([8.25, 8.75]);
  });
});

describe("compases", () => {
  const bar = (patterns: string[]): QuantizedBar => ({
    bar: 1,
    startBeat: 0,
    beats: patterns.map((p, i) => beat(p, i)),
  });

  it("reconoce un compás vacío y lo cuenta como una sola figura", () => {
    const empty = bar(["....", "....", "...", "...."]);
    expect(isEmptyBar(empty)).toBe(true);
    expect(barTokenCount(empty)).toBe(1);
  });

  it("cuenta las figuras de un compás", () => {
    const full = bar(["xxxx", "x...", "xxx", "..x."]);
    expect(isEmptyBar(full)).toBe(false);
    expect(barTokenCount(full)).toBe(4 + 1 + 3 + 2);
  });
});
