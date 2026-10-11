import { describe, expect, it } from "vitest";

import type { BeatDivision, QuantizedBar, QuantizedBeat } from "./quantize";
import { barTokenCount, beatRhythm, isEmptyBar } from "./rhythm";

/**
 * `x` = golpe, `.` = silencio. En compás simple (pulso de una negra):
 * 4 caracteres = semicorcheas, 3 = tresillo, 6 = seisillo, 8 = fusas.
 * Con `span` 1,5 (negra con puntillo): 3 = corcheas, 6 = semicorcheas.
 */
function beat(pattern: string, start = 0, span = 1): QuantizedBeat {
  const division = pattern.length as BeatDivision;
  return {
    beat: start,
    span,
    division,
    slots: [...pattern].map((char, slot) =>
      char === "."
        ? null
        : { id: `${start}-${slot}`, beat: start + (slot / division) * span, offset: 0, stroke: "abierto", accent: false, lane: 0 },
    ),
  };
}

function spell(pattern: string, span = 1): string {
  const { tuplet, tokens } = beatRhythm(beat(pattern, 0, span));
  const text = tokens.map((t) => `${t.duration}${t.dots ? "." : ""}${t.note ? "" : "r"}`).join(" ");
  return tuplet ? `${tuplet.numNotes}:${tuplet.notesOccupied}[${text}]` : text;
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
    ["xxx", "3:2[8 8 8]"],
    [".xx", "3:2[8r 8 8]"],
    ["x.x", "3:2[q 8]"],
    ["..x", "3:2[qr 8]"],
    [".x.", "3:2[8r q]"],
  ])("%s → %s", (pattern, expected) => {
    expect(spell(pattern)).toBe(expected);
  });

  it.each([
    ["xxxxxx", "6:4[16 16 16 16 16 16]"],
    ["x.xxxx", "6:4[8 16 16 16 16]"],
    ["...xxx", "6:4[8r 16r 16 16 16]"],
    ["x....x", "6:4[q 16r 16]"],
    [".x....", "6:4[16r q 16r]"],
  ])("seisillo %s → %s", (pattern, expected) => {
    expect(spell(pattern)).toBe(expected);
  });

  it.each([
    ["xxxxxxxx", "32 32 32 32 32 32 32 32"],
    ["x.x.xxxx", "16 16 32 32 32 32"],
    ["x...xx.x", "8 32 16 32"],
    ["x....x..", "8 32r 16."],
    [".......x", "8r 16r 32r 32"],
  ])("fusas %s → %s", (pattern, expected) => {
    expect(spell(pattern)).toBe(expected);
  });

  it.each([
    ["...", "q.r"],
    ["x..", "q."],
    ["xxx", "8 8 8"],
    ["x.x", "q 8"],
    [".xx", "8r 8 8"],
    ["..x", "qr 8"],
    ["x.....", "q."],
    ["x..x..", "8. 8."],
    ["xxxxxx", "16 16 16 16 16 16"],
    ["x.xxx.", "8 16 16 8"],
    [".x...x", "16r q 16"],
    [".x....", "16r q 16r"],
  ])("negra con puntillo %s → %s", (pattern, expected) => {
    expect(spell(pattern, 1.5)).toBe(expected);
  });

  it("las figuras de cada pulso suman exactamente el pulso", () => {
    const cases: [string, number][] = [
      ...["x.xx", ".x.x", "...x", ".xx", "x.x", "x....x", ".x....", "x....x..", ".......x"].map((p): [string, number] => [p, 1]),
      ...[".xx", "x..x..", ".x...x"].map((p): [string, number] => [p, 1.5]),
    ];
    for (const [pattern, span] of cases) {
      const { tokens } = beatRhythm(beat(pattern, 0, span));
      expect(tokens.reduce((sum, t) => sum + t.length, 0)).toBe(pattern.length);
      tokens.forEach((t, i) => i > 0 && expect(t.slot).toBe(tokens[i - 1].slot + tokens[i - 1].length));
      tokens.forEach((t) => expect(Number.isInteger(t.slot) && Number.isInteger(t.length)).toBe(true));
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
