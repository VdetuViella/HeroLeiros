import { describe, expect, it } from "vitest";

import { allSoundIds, samplePathFor } from "./sounds";
import { synthesize, voiceFor } from "./synth";

describe("synthesize", () => {
  const ids = allSoundIds();

  it("hay una voz de respaldo para cada instrumento, golpe y clic", () => {
    expect(ids).toContain("caixa:aro");
    expect(ids).toContain("metronomo:alto");
    for (const id of ids) expect(voiceFor(id), id).not.toBeNull();
  });

  it.each(ids)("%s suena, es finito y no satura", (id) => {
    const data = synthesize(id, 44100);
    expect(data.length).toBeGreaterThan(1000);
    let peak = 0;
    for (const value of data) {
      expect(Number.isFinite(value)).toBe(true);
      peak = Math.max(peak, Math.abs(value));
    }
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(1);
  });

  it("es determinista", () => {
    expect(synthesize("chocalho:abierto", 48000)).toEqual(synthesize("chocalho:abierto", 48000));
  });

  it("busca los samples reales en carpetas por instrumento", () => {
    expect(samplePathFor("surdo1:apagado")).toBe("surdo1/apagado");
    expect(samplePathFor("metronomo:alto")).toBe("metronomo/alto");
  });
});
