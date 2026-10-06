import { describe, expect, it } from "vitest";

import { DEFAULT_MIC_PREFERENCES, detectorSettingsFrom, sanitizeMicPreferences } from "./settings";

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
});
