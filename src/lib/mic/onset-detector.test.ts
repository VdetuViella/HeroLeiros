import { describe, expect, it } from "vitest";

import { OutputDelayTracker, micTimeToHeardTime } from "./clock";
import { FFT } from "./fft";
import {
  DEFAULT_DETECTOR_SETTINGS,
  HOP_SIZE,
  OnsetDetector,
  fftSizeFor,
  percentile,
  thresholdsFor,
  type DetectorSettings,
  type NoiseProfile,
  type Onset,
} from "./onset-detector";
import { clickTrack, dbToGain, renderHits, type SyntheticHit } from "./test-signals";

const SR = 48000;
const ROOM_NOISE = dbToGain(-55);

function detect(
  signal: Float32Array,
  options: { sampleRate?: number; settings?: Partial<DetectorSettings>; chunk?: number } = {},
): Onset[] {
  const detector = new OnsetDetector(options.sampleRate ?? SR, options.settings);
  const chunk = options.chunk ?? HOP_SIZE;
  const onsets: Onset[] = [];
  for (let start = 0; start < signal.length; start += chunk) {
    for (const event of detector.process(signal.subarray(start, start + chunk))) {
      if (event.type === "onset") onsets.push(event.onset);
    }
  }
  return onsets;
}

const times = (onsets: Onset[], sampleRate = SR) => onsets.map((o) => o.frame / sampleRate);

/** Cada golpe esperado tiene exactamente un ataque detectado a ±`toleranceMs`. */
function expectMatches(onsets: Onset[], hits: SyntheticHit[], toleranceMs = 3, sampleRate = SR) {
  const detected = times(onsets, sampleRate);
  expect(detected).toHaveLength(hits.length);
  hits.forEach((hit, i) => {
    expect(Math.abs(detected[i] - hit.time) * 1000).toBeLessThanOrEqual(toleranceMs);
  });
}

describe("FFT", () => {
  it("coloca un seno en su bin", () => {
    const size = 512;
    const fft = new FFT(size);
    const input = Array.from({ length: size }, (_, i) => Math.sin((2 * Math.PI * 8 * i) / size));
    const out = new Float64Array(size / 2 + 1);
    fft.magnitudes(input, out);
    const peakBin = out.indexOf(Math.max(...out));
    expect(peakBin).toBe(8);
    expect(out[8]).toBeCloseTo(size / 2, 6);
    expect(out[20]).toBeLessThan(1e-9);
  });

  it("rechaza tamaños que no son potencia de 2", () => {
    expect(() => new FFT(500)).toThrow();
  });
});

describe("ajustes del detector", () => {
  it("usa ventanas de ~10 ms", () => {
    expect(fftSizeFor(44100)).toBe(512);
    expect(fftSizeFor(48000)).toBe(512);
    expect(fftSizeFor(96000)).toBe(1024);
  });

  it("más sensibilidad baja todos los umbrales", () => {
    const low = thresholdsFor({ ...DEFAULT_DETECTOR_SETTINGS, sensitivity: 0 });
    const high = thresholdsFor({ ...DEFAULT_DETECTOR_SETTINGS, sensitivity: 1 });
    expect(high.gateMarginDb).toBeLessThan(low.gateMarginDb);
    expect(high.minRiseDb).toBeLessThan(low.minRiseDb);
    expect(high.fluxRatio).toBeLessThan(low.fluxRatio);
  });

  it("el perfil de ruido sube la puerta", () => {
    const quiet = thresholdsFor(DEFAULT_DETECTOR_SETTINGS);
    const loud = thresholdsFor({ ...DEFAULT_DETECTOR_SETTINGS, noise: { floorDb: -30, flux: 0.2 } });
    expect(loud.floorDb + loud.gateMarginDb).toBeGreaterThan(quiet.floorDb + quiet.gateMarginDb);
    expect(loud.fluxFloor).toBeCloseTo(0.3);
  });

  it("calcula percentiles", () => {
    expect(percentile([5, 1, 4, 2, 3], 50)).toBe(3);
    expect(percentile([5, 1, 4, 2, 3], 100)).toBe(5);
    expect(percentile([], 90)).toBe(0);
  });
});

describe("OnsetDetector", () => {
  it("encuentra cada clic de una pista de metrónomo a ±3 ms", () => {
    const hits = clickTrack(120, 8, 0.25);
    const signal = renderHits({ sampleRate: SR, seconds: 4.5, hits, noiseRms: ROOM_NOISE });
    expectMatches(detect(signal), hits);
  });

  it("oye el clic de banda estrecha del altavoz aunque haya ruido ancho", () => {
    const noiseRms = dbToGain(-45);
    const hits = clickTrack(90, 8, 0.3, "clic", 0.2);
    const signal = renderHits({ sampleRate: SR, seconds: 6, hits, noiseRms, seed: 5 });
    expectMatches(detect(signal, { settings: { noise: { floorDb: -44, flux: 0 } } }), hits);
  });

  it("no dispara con ruido de sala solo", () => {
    const signal = renderHits({ sampleRate: SR, seconds: 3, hits: [], noiseRms: dbToGain(-40), seed: 7 });
    expect(detect(signal)).toHaveLength(0);
  });

  it("no dispara con silencio digital", () => {
    expect(detect(new Float32Array(SR))).toHaveLength(0);
  });

  it("detecta golpes de surdo, caixa y tamborim una sola vez cada uno", () => {
    const hits: SyntheticHit[] = [
      { time: 0.3, kind: "surdo", gain: 0.8 },
      { time: 1.1, kind: "caixa", gain: 0.5 },
      { time: 1.35, kind: "caixa", gain: 0.4 },
      { time: 1.8, kind: "tamborim", gain: 0.4 },
      { time: 2.0, kind: "tamborim", gain: 0.3 },
      { time: 2.5, kind: "surdo", gain: 0.7 },
    ];
    const signal = renderHits({ sampleRate: SR, seconds: 3.5, hits, noiseRms: ROOM_NOISE });
    expectMatches(detect(signal), hits);
  });

  it("la cola grave y larga del surdo no genera golpes falsos", () => {
    const hits: SyntheticHit[] = [0.2, 1.0, 1.8].map((time) => ({ time, kind: "surdo", gain: 0.9 }));
    const signal = renderHits({ sampleRate: SR, seconds: 2.8, hits, noiseRms: ROOM_NOISE, seed: 3 });
    expectMatches(detect(signal), hits);
  });

  it("aplica el tiempo muerto entre golpes", () => {
    const hits: SyntheticHit[] = [
      { time: 0.5, kind: "caixa", gain: 0.4 },
      { time: 0.545, kind: "caixa", gain: 0.9 },
    ];
    const signal = renderHits({ sampleRate: SR, seconds: 1, hits, noiseRms: ROOM_NOISE });
    expect(detect(signal, { settings: { refractoryMs: 60 } })).toHaveLength(1);
    expectMatches(detect(signal, { settings: { refractoryMs: 30 } }), hits);
  });

  it("separa semicorcheas rápidas de caixa (~95 ms a 160 BPM)", () => {
    const hits = clickTrack(640, 12, 0.3, "caixa", 0.5);
    const signal = renderHits({ sampleRate: SR, seconds: 1.6, hits, noiseRms: ROOM_NOISE });
    expectMatches(detect(signal), hits);
  });

  it("oye un golpe flojo justo después de un acento", () => {
    const hits: SyntheticHit[] = [
      { time: 0.4, kind: "caixa", gain: 0.9 },
      { time: 0.55, kind: "caixa", gain: 0.9 * dbToGain(-12) },
    ];
    const signal = renderHits({ sampleRate: SR, seconds: 1, hits, noiseRms: ROOM_NOISE });
    expectMatches(detect(signal), hits);
  });

  it("ignora golpes por debajo de la puerta y los acepta con más sensibilidad", () => {
    const hits = clickTrack(120, 4, 0.3, "tamborim", dbToGain(-44));
    const signal = renderHits({ sampleRate: SR, seconds: 2.5, hits, noiseRms: dbToGain(-70) });
    expect(detect(signal, { settings: { sensitivity: 0 } })).toHaveLength(0);
    expectMatches(detect(signal, { settings: { sensitivity: 1 } }), hits);
  });

  it("un tono sostenido solo cuenta al empezar (umbral adaptativo)", () => {
    const signal = renderHits({ sampleRate: SR, seconds: 2, hits: [], noiseRms: ROOM_NOISE });
    const start = Math.round(0.5 * SR);
    for (let i = start; i < signal.length; i++) {
      const t = (i - start) / SR;
      signal[i] += 0.3 * Math.min(1, t / 0.002) * (Math.sin(2 * Math.PI * 440 * t) + 0.3 * Math.sin(2 * Math.PI * 1320 * t));
    }
    const onsets = detect(signal);
    expect(onsets).toHaveLength(1);
    expect(Math.abs(times(onsets)[0] - 0.5) * 1000).toBeLessThanOrEqual(3);
  });

  it("detecta golpes sobre un ruido de fondo fuerte tras calibrar la sala", () => {
    const noiseRms = dbToGain(-32);
    const hits = clickTrack(100, 6, 2.5, "caixa", 0.6);
    const signal = renderHits({ sampleRate: SR, seconds: 6.5, hits, noiseRms, seed: 11 });
    const detector = new OnsetDetector(SR);
    detector.measureNoise(2);
    const onsets: Onset[] = [];
    let profile: NoiseProfile | null = null;
    for (let start = 0; start < signal.length; start += HOP_SIZE) {
      for (const event of detector.process(signal.subarray(start, start + HOP_SIZE))) {
        switch (event.type) {
          case "onset":
            onsets.push(event.onset);
            break;
          case "noise-profile":
            profile = event.profile;
            break;
          case "features":
            break;
          default: {
            const exhaustive: never = event;
            throw new Error(`Evento desconocido: ${JSON.stringify(exhaustive)}`);
          }
        }
      }
    }
    expect(profile).not.toBeNull();
    expect(profile!.floorDb).toBeGreaterThan(-33.5);
    expect(profile!.floorDb).toBeLessThan(-30.5);
    expect(detector.currentSettings.noise).toEqual(profile);
    expectMatches(onsets, hits);
  });

  it("algún golpe suelto durante la medición no dispara el nivel de ruido", () => {
    const noiseRms = dbToGain(-50);
    const signal = renderHits({ sampleRate: SR, seconds: 3, hits: clickTrack(120, 5, 0.2, "caixa", 0.8), noiseRms, seed: 4 });
    const detector = new OnsetDetector(SR);
    detector.measureNoise(2.9);
    const profile = detector.process(signal).find((e) => e.type === "noise-profile");
    expect(profile?.type === "noise-profile" && profile.profile.floorDb).toBeLessThan(-46);
  });

  it("no detecta nada mientras mide el ruido", () => {
    const hits = clickTrack(120, 3, 0.3);
    const signal = renderHits({ sampleRate: SR, seconds: 1.5, hits, noiseRms: ROOM_NOISE });
    const detector = new OnsetDetector(SR);
    detector.measureNoise(1.4);
    const events = detector.process(signal);
    expect(events.filter((e) => e.type === "onset")).toHaveLength(0);
    expect(events.filter((e) => e.type === "noise-profile")).toHaveLength(1);
    expect(detector.calibrating).toBe(false);
  });

  it("da el mismo resultado con bloques de cualquier tamaño", () => {
    const hits = clickTrack(150, 6, 0.2, "tamborim", 0.4);
    const signal = renderHits({ sampleRate: SR, seconds: 2.8, hits, noiseRms: ROOM_NOISE });
    const reference = detect(signal, { chunk: HOP_SIZE }).map((o) => o.frame);
    expect(detect(signal, { chunk: 300 }).map((o) => o.frame)).toEqual(reference);
    expect(detect(signal, { chunk: 4096 }).map((o) => o.frame)).toEqual(reference);
  });

  it("respeta el frame inicial que da el worklet", () => {
    const hits = clickTrack(120, 2, 0.2);
    const signal = renderHits({ sampleRate: SR, seconds: 1.2, hits, noiseRms: ROOM_NOISE });
    const detector = new OnsetDetector(SR);
    const base = 10 * SR;
    const frames: number[] = [];
    for (let start = 0; start < signal.length; start += HOP_SIZE) {
      for (const event of detector.process(signal.subarray(start, start + HOP_SIZE), base + start)) {
        if (event.type === "onset") frames.push(event.onset.frame - base);
      }
    }
    expect(frames).toHaveLength(2);
    expect(Math.abs(frames[0] / SR - 0.2) * 1000).toBeLessThanOrEqual(3);
  });

  it("funciona a 44,1 kHz", () => {
    const sampleRate = 44100;
    const hits = clickTrack(110, 6, 0.3, "caixa", 0.5);
    const signal = renderHits({ sampleRate, seconds: 3.8, hits, noiseRms: ROOM_NOISE });
    expectMatches(detect(signal, { sampleRate }), hits, 3, sampleRate);
  });

  it("los golpes más fuertes tienen más intensidad", () => {
    const hits: SyntheticHit[] = [
      { time: 0.3, kind: "caixa", gain: 0.08 },
      { time: 0.8, kind: "caixa", gain: 0.8 },
    ];
    const signal = renderHits({ sampleRate: SR, seconds: 1.2, hits, noiseRms: ROOM_NOISE });
    const [soft, loud] = detect(signal);
    expect(loud.velocity).toBeGreaterThan(soft.velocity);
    expect(loud.peakDb).toBeGreaterThan(soft.peakDb + 15);
  });
});

describe("reloj del micrófono", () => {
  it("resta el retraso de salida y la latencia de entrada", () => {
    expect(micTimeToHeardTime(10, 0.04, 0.01)).toBeCloseTo(9.95);
  });

  it("filtra el jitter del retraso de salida con la mediana", () => {
    const tracker = new OutputDelayTracker(5);
    expect(tracker.value).toBe(0);
    for (const delay of [0.04, 0.045, 0.2, 0.038, 0.041]) tracker.add(delay);
    expect(tracker.value).toBeCloseTo(0.041);
    tracker.add(Number.NaN);
    tracker.add(-1);
    expect(tracker.value).toBeCloseTo(0.041);
  });
});
