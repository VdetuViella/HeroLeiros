import { describe, expect, it } from "vitest";

import { INSTRUMENT_LIST } from "../chart/instruments";
import { STROKE_IDS } from "../chart/types";
import { legendFor, strokeSymbol, vexKey } from "./symbols";

describe("símbolos de la partitura", () => {
  it("cada golpe tiene una tecla de VexFlow válida", () => {
    for (const stroke of STROKE_IDS) {
      expect(vexKey(strokeSymbol("repinique", stroke))).toMatch(/^[a-g]\/\d(\/[a-z]+)?$/);
    }
  });

  it("el aro va en X, el slap en triángulo y el agogô a ambos lados de la línea", () => {
    expect(vexKey(strokeSymbol("repinique", "aro"))).toBe("b/4/x");
    expect(vexKey(strokeSymbol("repinique", "slap"))).toBe("b/4/tu");
    expect(vexKey(strokeSymbol("agogo", "agudo"))).toBe("d/5");
    expect(vexKey(strokeSymbol("agogo", "grave"))).toBe("g/4");
    expect(strokeSymbol("surdo1", "apagado").muted).toBe(true);
  });

  it("la caixa escribe el golpe suave como nota fantasma", () => {
    const suave = strokeSymbol("caixa", "apagado");
    expect(suave.ghost).toBe(true);
    expect(suave.muted).toBe(false);
  });

  it("dentro de un instrumento no hay dos golpes con el mismo símbolo", () => {
    for (const def of INSTRUMENT_LIST) {
      const signatures = def.strokes.map((stroke) => {
        const s = strokeSymbol(def.id, stroke);
        return `${vexKey(s)}|${s.muted}|${s.ghost}`;
      });
      expect(new Set(signatures).size).toBe(signatures.length);
    }
  });

  it("la leyenda sigue el orden de carriles, usa las etiquetas del instrumento y termina con el acento", () => {
    const legend = legendFor("caixa", ["abierto", "apagado", "aro"]);
    expect(legend.map((e) => e.label)).toEqual(["Abierto", "Suave", "Aro", "Acento"]);
    expect(legend.at(-1)?.accent).toBe(true);
    expect(legend.every((e) => e.symbol.description.length > 0)).toBe(true);
  });
});
