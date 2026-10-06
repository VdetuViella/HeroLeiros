import { describe, expect, it } from "vitest";

import { HOP_SIZE, OnsetDetector, type StrokeFeatures } from "./onset-detector";
import {
  MAX_SAMPLES_PER_LANE,
  StrokeClassifier,
  addSample,
  emptyProfile,
  isProfileReady,
  isStrokeFeatures,
} from "./stroke-classifier";
import { dbToGain, renderHits, seededRandom, type HitKind } from "./test-signals";

const SR = 48000;
const STROKES: HitKind[] = ["surdo", "surdo-apagado", "aro"];

/** Golpes de un tipo con intensidades variadas; devuelve los rasgos de cada uno. */
function featuresOf(kind: HitKind, count: number, seed: number): StrokeFeatures[] {
  const random = seededRandom(seed);
  const hits = Array.from({ length: count }, (_, i) => ({ time: 0.3 + i * 0.7, kind, gain: dbToGain(-2 - random() * 14) }));
  const signal = renderHits({ sampleRate: SR, seconds: 0.3 + count * 0.7, hits, noiseRms: dbToGain(-55), seed });
  const detector = new OnsetDetector(SR);
  const onsets: number[] = [];
  const features: { frame: number; features: StrokeFeatures }[] = [];
  for (let i = 0; i < signal.length; i += HOP_SIZE) {
    for (const event of detector.process(signal.subarray(i, i + HOP_SIZE))) {
      if (event.type === "onset") onsets.push(event.onset.frame);
      if (event.type === "features") features.push(event);
    }
  }
  expect(onsets).toHaveLength(count);
  expect(features.map((f) => f.frame)).toEqual(onsets);
  return features.map((f) => f.features);
}

describe("rasgos de timbre", () => {
  it("cada golpe trae sus rasgos, con el mismo frame que el ataque", () => {
    const [features] = featuresOf("aro", 1, 3);
    expect(isStrokeFeatures(features)).toBe(true);
  });

  it("el aro es más agudo y el apagado cae más deprisa que el abierto", () => {
    const open = featuresOf("surdo", 4, 1);
    const muted = featuresOf("surdo-apagado", 4, 2);
    const rim = featuresOf("aro", 4, 3);
    const avg = (xs: StrokeFeatures[], d: number) => xs.reduce((sum, x) => sum + x[d], 0) / xs.length;
    expect(avg(rim, 0)).toBeGreaterThan(avg(open, 0) + 2);
    expect(avg(rim, 2)).toBeGreaterThan(avg(open, 2));
    expect(avg(muted, 3)).toBeGreaterThan(avg(open, 3) + 0.5);
  });
});

describe("StrokeClassifier", () => {
  it("distingue abierto, apagado y aro tras unos pocos ejemplos", () => {
    let profile = emptyProfile(STROKES.length);
    STROKES.forEach((kind, lane) => {
      for (const features of featuresOf(kind, 6, 10 + lane)) profile = addSample(profile, lane, features);
    });
    expect(isProfileReady(profile, STROKES.length)).toBe(true);

    const classifier = new StrokeClassifier(profile);
    let correct = 0;
    let total = 0;
    STROKES.forEach((kind, lane) => {
      for (const features of featuresOf(kind, 10, 100 + lane)) {
        if (classifier.classify(features).lane === lane) correct += 1;
        total += 1;
      }
    });
    expect(correct / total).toBeGreaterThanOrEqual(0.9);
  });

  it("guarda como mucho los últimos ejemplos de cada carril", () => {
    let profile = emptyProfile(2);
    for (let i = 0; i < MAX_SAMPLES_PER_LANE + 5; i++) profile = addSample(profile, 0, [i, 0, 0, 0]);
    expect(profile.samples[0]).toHaveLength(MAX_SAMPLES_PER_LANE);
    expect(profile.samples[0].at(-1)).toEqual([MAX_SAMPLES_PER_LANE + 4, 0, 0, 0]);
    expect(profile.samples[1]).toHaveLength(0);
    expect(isProfileReady(profile, 2)).toBe(false);
  });

  it("da más confianza cuanto más claro es el golpe", () => {
    const profile = { samples: [[[8, 0.5, 0.1, 0.2]], [[11, 0.1, 0.6, 0.2]]] as StrokeFeatures[][] };
    const classifier = new StrokeClassifier(profile);
    const clear = classifier.classify([8, 0.5, 0.1, 0.2]);
    const doubtful = classifier.classify([9.5, 0.3, 0.35, 0.2]);
    expect(clear.lane).toBe(0);
    expect(clear.confidence).toBeGreaterThan(doubtful.confidence);
    expect(() => new StrokeClassifier({ samples: [[], [[1, 0, 0, 0]]] })).toThrow();
  });
});
