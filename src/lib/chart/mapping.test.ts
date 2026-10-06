import { describe, expect, it } from "vitest";

import { mapNote, matchInstrument, normalizeName } from "./mapping";

describe("normalizeName", () => {
  it("quita acentos, mayúsculas y separadores", () => {
    expect(normalizeName("  Agogô ")).toBe("agogo");
    expect(normalizeName("SURDO-1")).toBe("surdo1");
    expect(normalizeName("Caixa_de guerra")).toBe("caixadeguerra");
  });
});

describe("matchInstrument", () => {
  it.each([
    ["Surdo 1", "surdo1"],
    ["surdo-2", "surdo2"],
    ["SURDO 3", "surdo3"],
    ["Surdo II", "surdo2"],
    ["Surdo de primeira", "surdo1"],
    ["Corte", "surdo3"],
    ["Caja", "caixa"],
    ["Caixa", "caixa"],
    ["Repique", "repinique"],
    ["Repinique", "repinique"],
    ["Tamborím", "tamborim"],
    ["Agogô", "agogo"],
    ["agogo", "agogo"],
    ["Ganzá", "chocalho"],
    ["Chocalho", "chocalho"],
  ])("«%s» → %s", (name, expected) => {
    expect(matchInstrument(name)).toBe(expected);
  });

  it("devuelve null para pistas que no son de batucada", () => {
    expect(matchInstrument("Bajo eléctrico")).toBeNull();
    expect(matchInstrument("")).toBeNull();
  });

  it("acepta alias extra definidos en meta.json", () => {
    expect(matchInstrument("Mi caja vieja", { "mi caja vieja": "caixa" })).toBe("caixa");
    expect(matchInstrument("Campana", { Campana: "Agogô" })).toBe("agogo");
  });
});

describe("mapNote", () => {
  it("usa la tabla común de notas", () => {
    expect(mapNote("surdo1", 36)).toEqual({ stroke: "abierto", accent: false });
    expect(mapNote("surdo1", 37)).toEqual({ stroke: "apagado", accent: false });
    expect(mapNote("repinique", 39)).toEqual({ stroke: "slap", accent: false });
    expect(mapNote("agogo", 60)).toEqual({ stroke: "agudo", accent: false });
    expect(mapNote("agogo", 61)).toEqual({ stroke: "grave", accent: false });
  });

  it("la nota 40 es un abierto acentuado", () => {
    expect(mapNote("caixa", 40)).toEqual({ stroke: "abierto", accent: true });
  });

  it("rechaza golpes que el instrumento no tiene", () => {
    expect(mapNote("agogo", 36)).toBeNull();
    expect(mapNote("surdo1", 38)).toBeNull();
    expect(mapNote("caixa", 99)).toBeNull();
  });

  it("aplica sobrescrituras por instrumento", () => {
    const overrides = { caixa: { "42": "aro" as const, "44": { stroke: "abierto" as const, accent: true } } };
    expect(mapNote("caixa", 42, overrides)).toEqual({ stroke: "aro", accent: false });
    expect(mapNote("caixa", 44, overrides)).toEqual({ stroke: "abierto", accent: true });
    expect(mapNote("surdo1", 42, overrides)).toBeNull();
  });
});
