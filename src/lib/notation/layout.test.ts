import { describe, expect, it } from "vitest";

import { dragSelection, layoutRows, tapSelection, xAtBeat } from "./layout";

describe("layoutRows", () => {
  const options = { width: 600, rowStartExtra: 40, firstBarExtra: 30 };

  it("llena cada fila y estira los compases hasta el ancho disponible", () => {
    const rows = layoutRows([200, 200, 200, 200, 200], options);
    expect(rows.map((r) => r.bars.map((b) => b.index))).toEqual([[0, 1], [2, 3], [4]]);
    for (const row of rows.slice(0, -1)) {
      const last = row.bars[row.bars.length - 1];
      expect(last.x + last.width).toBeCloseTo(600);
      expect(row.bars[0].x).toBe(0);
    }
    expect(rows[0].bars[0].width).toBeGreaterThan(rows[0].bars[1].width);
  });

  it("no estira demasiado la última fila", () => {
    const rows = layoutRows([100, 100, 100, 100, 100, 100, 100], options);
    const last = rows[rows.length - 1];
    const end = last.bars[last.bars.length - 1];
    expect(end.x + end.width).toBeLessThan(600);
  });

  it("encoge un compás que no cabe ni solo en una fila (móvil)", () => {
    const rows = layoutRows([500, 500], { ...options, width: 320 });
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.bars[0].width).toBeCloseTo(320);
  });
});

describe("xAtBeat", () => {
  const anchors = [
    { beat: 0, x: 10 },
    { beat: 1, x: 50 },
    { beat: 2, x: 70 },
  ];

  it("interpola entre figuras y se queda en los extremos", () => {
    expect(xAtBeat(anchors, 0.5)).toBe(30);
    expect(xAtBeat(anchors, 1.5)).toBe(60);
    expect(xAtBeat(anchors, -1)).toBe(10);
    expect(xAtBeat(anchors, 5)).toBe(70);
    expect(xAtBeat([], 1)).toBe(0);
  });
});

describe("selección de compases", () => {
  it("el primer toque marca A y el segundo cierra el tramo en B", () => {
    const a = tapSelection(null, 5);
    expect(a).toEqual({ startBar: 5, endBar: 5 });
    expect(tapSelection(a, 8)).toEqual({ startBar: 5, endBar: 8 });
    expect(tapSelection(a, 2)).toEqual({ startBar: 2, endBar: 5 });
  });

  it("con un tramo ya cerrado, un toque empieza de nuevo y Mayús lo amplía", () => {
    const range = { startBar: 5, endBar: 8 };
    expect(tapSelection(range, 3)).toEqual({ startBar: 3, endBar: 3 });
    expect(tapSelection(range, 10, true)).toEqual({ startBar: 5, endBar: 10 });
    expect(tapSelection(range, 6, true)).toEqual({ startBar: 5, endBar: 8 });
  });

  it("arrastrar selecciona en cualquier dirección", () => {
    expect(dragSelection(7, 4)).toEqual({ startBar: 4, endBar: 7 });
    expect(dragSelection(4, 4)).toEqual({ startBar: 4, endBar: 4 });
  });
});
