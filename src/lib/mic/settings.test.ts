import { describe, expect, it } from "vitest";

import type { StrokeFeatures } from "./onset-detector";
import { MIN_ACCENT_SAMPLES } from "./accent";
import {
  DEFAULT_MIC_PREFERENCES,
  accentDetectorFor,
  classifierFor,
  detectorSettingsFrom,
  sanitizeMicPreferences,
  strokeProfileFor,
} from "./settings";
import { MIN_SAMPLES_PER_LANE } from "./stroke-classifier";

describe("preferencias del micrófono", () => {
  it("usa los valores por defecto si no hay nada guardado o está roto", () => {
    expect(sanitizeMicPreferences(null)).toEqual(DEFAULT_MIC_PREFERENCES);
    expect(sanitizeMicPreferences("basura")).toEqual(DEFAULT_MIC_PREFERENCES);
  });

  it("acota los valores y descarta perfiles de ruido inválidos", () => {
    const prefs = sanitizeMicPreferences({
      deviceId: "",
      sensitivity: 3,
      refractoryMs: 5,
      noise: { floorDb: "alto" },
      headphones: "sí",
    });
    expect(prefs).toEqual({ ...DEFAULT_MIC_PREFERENCES, sensitivity: 1, refractoryMs: 30 });
  });

  it("conserva un perfil válido y lo pasa al detector", () => {
    const prefs = sanitizeMicPreferences({
      deviceId: "abc",
      sensitivity: 0.7,
      refractoryMs: 80,
      noise: { floorDb: -48.5, flux: 0.04, extra: true },
      headphones: true,
    });
    expect(prefs.noise).toEqual({ floorDb: -48.5, flux: 0.04 });
    expect(detectorSettingsFrom(prefs)).toEqual({ sensitivity: 0.7, refractoryMs: 80, noise: { floorDb: -48.5, flux: 0.04 } });
  });

  it("solo usa el perfil de timbre si encaja con los carriles y está entrenado", () => {
    const sample: StrokeFeatures = [8, 0.5, 0.1, 0.2];
    const lane = Array.from({ length: MIN_SAMPLES_PER_LANE }, () => sample);
    const prefs = sanitizeMicPreferences({
      classifyStrokes: true,
      strokeProfiles: {
        surdo1: { strokes: ["abierto", "apagado"], samples: [lane, lane.map(([a, b, c, d]) => [a + 3, b, c, d])] },
        caixa: { strokes: ["abierto"], samples: [[["roto"]]] },
        inventado: { strokes: [], samples: [] },
      },
    });
    expect(Object.keys(prefs.strokeProfiles)).toEqual(["surdo1"]);
    expect(classifierFor(prefs, "surdo1", ["abierto", "apagado"])).not.toBeNull();
    expect(classifierFor(prefs, "surdo1", ["abierto", "aro"])).toBeNull();
    expect(classifierFor({ ...prefs, classifyStrokes: false }, "surdo1", ["abierto", "apagado"])).toBeNull();
    expect(strokeProfileFor(prefs, "caixa", ["abierto", "aro"])).toEqual({ strokes: ["abierto", "aro"], samples: [[], []] });
  });

  describe("acentos", () => {
    const normal = Array.from({ length: MIN_ACCENT_SAMPLES }, (_, i) => -30 - i * 0.5);
    const accented = Array.from({ length: MIN_ACCENT_SAMPLES }, (_, i) => -20 - i * 0.5);

    it("guarda los perfiles válidos y descarta los rotos o de instrumentos desconocidos", () => {
      const prefs = sanitizeMicPreferences({
        detectAccents: true,
        accentProfiles: {
          caixa: { normal, accented },
          surdo1: { normal: ["x"], accented: [] },
          trompeta: { normal, accented },
        },
      });
      expect(prefs.detectAccents).toBe(true);
      expect(prefs.accentProfiles).toEqual({ caixa: { normal, accented } });
      expect(sanitizeMicPreferences({ detectAccents: "sí" }).detectAccents).toBe(false);
    });

    it("solo hay detector si está activado y el instrumento está calibrado", () => {
      const calibrated = sanitizeMicPreferences({ detectAccents: true, accentProfiles: { caixa: { normal, accented } } });
      expect(accentDetectorFor(calibrated, "caixa")?.thresholdDb).toBeCloseTo((-30.75 + -20.75) / 2);
      expect(accentDetectorFor(calibrated, "repinique")).toBeNull();
      expect(accentDetectorFor({ ...calibrated, detectAccents: false }, "caixa")).toBeNull();
    });
  });
});
