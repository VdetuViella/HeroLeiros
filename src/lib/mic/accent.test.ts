import { describe, expect, it } from "vitest";

import {
  AccentDetector,
  MAX_ACCENT_SAMPLES,
  MIN_ACCENT_SAMPLES,
  addAccentSample,
  analyzeAccentProfile,
  clearAccentSamples,
  emptyAccentProfile,
  isAccentProfile,
  type AccentProfile,
} from "./accent";
import { HOP_SIZE, OnsetDetector } from "./onset-detector";
import { dbToGain, renderHits, type HitKind, type SyntheticHit } from "./test-signals";

const SR = 48000;

function profile(normal: number[], accented: number[]): AccentProfile {
  return { normal, accented };
}

describe("perfil de acentos", () => {
  it("guarda los ejemplos más recientes de cada tipo", () => {
    let p = emptyAccentProfile();
    for (let i = 0; i < MAX_ACCENT_SAMPLES + 3; i++) p = addAccentSample(p, "normal", -30 - i);
    p = addAccentSample(p, "acento", -20);
    expect(p.normal).toHaveLength(MAX_ACCENT_SAMPLES);
    expect(p.normal[p.normal.length - 1]).toBe(-30 - (MAX_ACCENT_SAMPLES + 2));
    expect(p.accented).toEqual([-20]);
    expect(addAccentSample(p, "acento", Number.NaN)).toBe(p);
    expect(clearAccentSamples(p, "normal").normal).toEqual([]);
    expect(clearAccentSamples(p, "normal").accented).toEqual([-20]);
  });

  it("valida lo que viene de localStorage", () => {
    expect(isAccentProfile({ normal: [-30], accented: [] })).toBe(true);
    expect(isAccentProfile({ normal: [-30, "x"], accented: [] })).toBe(false);
    expect(isAccentProfile({ normal: [-30] })).toBe(false);
    expect(isAccentProfile(null)).toBe(false);
  });

  it("pide golpes hasta tener suficientes de cada tipo", () => {
    expect(analyzeAccentProfile(null)).toEqual({ status: "faltan-golpes", normalNeeded: MIN_ACCENT_SAMPLES, accentNeeded: MIN_ACCENT_SAMPLES });
    expect(analyzeAccentProfile(profile([-30, -31, -29, -30], [-20]))).toEqual({
      status: "faltan-golpes",
      normalNeeded: 0,
      accentNeeded: MIN_ACCENT_SAMPLES - 1,
    });
  });

  it("pone el umbral entre las medianas", () => {
    const analysis = analyzeAccentProfile(profile([-31, -30, -29, -30], [-21, -20, -19, -22]));
    expect(analysis.status).toBe("listo");
    if (analysis.status !== "listo") return;
    expect(analysis.normalDb).toBe(-30);
    expect(analysis.accentDb).toBe(-20.5);
    expect(analysis.thresholdDb).toBeCloseTo(-25.25);
    expect(analysis.separationDb).toBeCloseTo(9.5);
    expect(analysis.agreement).toBe(1);
  });

  it("avisa si los acentos no se distinguen de los golpes normales", () => {
    const analysis = analyzeAccentProfile(profile([-30, -29, -31, -30], [-28, -27, -29, -28]));
    expect(analysis.status).toBe("sin-diferencia");
    expect(AccentDetector.fromProfile(profile([-30, -29, -31, -30], [-28, -27, -29, -28]))).toBeNull();
  });

  it("la mediana aguanta un golpe raro en la calibración", () => {
    // Un golpe normal se escapó fuerte: no debe arrastrar el umbral.
    const analysis = analyzeAccentProfile(profile([-30, -30, -31, -29, -18], [-20, -21, -19, -20]));
    expect(analysis.status).toBe("listo");
    if (analysis.status !== "listo") return;
    expect(analysis.thresholdDb).toBeCloseTo(-25);
    expect(analysis.agreement).toBeCloseTo(8 / 9);
  });

  it("el detector separa por el umbral", () => {
    const detector = AccentDetector.fromProfile(profile([-31, -30, -29, -30], [-21, -20, -19, -22]));
    expect(detector).not.toBeNull();
    expect(detector!.isAccent(-24)).toBe(true);
    expect(detector!.isAccent(-26)).toBe(false);
    expect(() => new AccentDetector(Number.NaN)).toThrow();
  });
});

/** Golpes alternando normal y acento; devuelve la fuerza medida de cada uno. */
function measureStrikes(kind: HitKind, normalGain: number, accentGain: number, count: number, noiseDb: number, spacing: number) {
  const hits: SyntheticHit[] = Array.from({ length: count }, (_, i) => ({
    time: 0.5 + i * spacing,
    kind,
    gain: i % 2 === 1 ? accentGain : normalGain,
  }));
  const signal = renderHits({ sampleRate: SR, seconds: 0.5 + count * spacing + 0.3, hits, noiseRms: dbToGain(noiseDb), seed: 7 });
  const detector = new OnsetDetector(SR);
  const strikes: number[] = [];
  for (let start = 0; start < signal.length; start += HOP_SIZE) {
    for (const event of detector.process(signal.subarray(start, start + HOP_SIZE))) {
      if (event.type === "features") strikes.push(event.strikeDb);
    }
  }
  return { hits, strikes };
}

describe("fuerza del golpe medida por el detector", () => {
  // El surdo resuena mucho: se toca más espaciado (un golpe flojo dentro de la cola de uno fuerte se pierde).
  it.each<[HitKind, number, number]>([
    ["caixa", -55, 0.25],
    ["clic", -55, 0.25],
    ["surdo", -55, 0.6],
    ["caixa", -40, 0.25],
  ])("%s (ruido %d dBFS, cada %d s): calibrar con los primeros golpes y reconocer los acentos de los siguientes", (kind, noiseDb, spacing) => {
    const normalGain = 0.25;
    const accentGain = 0.6; // +7,6 dB
    const { hits, strikes } = measureStrikes(kind, normalGain, accentGain, 20, noiseDb, spacing);
    expect(strikes).toHaveLength(hits.length);

    // La diferencia medida se parece a la real.
    const normals = strikes.filter((_, i) => i % 2 === 0);
    const accents = strikes.filter((_, i) => i % 2 === 1);
    const meanDiff = accents.reduce((a, b) => a + b, 0) / accents.length - normals.reduce((a, b) => a + b, 0) / normals.length;
    expect(meanDiff).toBeGreaterThan(6);
    expect(meanDiff).toBeLessThan(9.5);

    // Calibración con los 8 primeros golpes (4 de cada).
    let calibration = emptyAccentProfile();
    strikes.slice(0, 8).forEach((db, i) => {
      calibration = addAccentSample(calibration, i % 2 === 1 ? "acento" : "normal", db);
    });
    const detector = AccentDetector.fromProfile(calibration);
    expect(detector).not.toBeNull();
    const guesses = strikes.slice(8).map((db) => detector!.isAccent(db));
    expect(guesses).toEqual(hits.slice(8).map((_, i) => (i + 8) % 2 === 1));
  });
});
