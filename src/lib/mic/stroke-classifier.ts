import type { StrokeFeatures } from "./onset-detector";

/**
 * Perfil de timbre de un jugador con un instrumento (fase B): ejemplos de
 * cada golpe, en el mismo orden que los carriles del instrumento.
 */
export interface StrokeProfile {
  samples: StrokeFeatures[][];
}

export const MIN_SAMPLES_PER_LANE = 4;
export const MAX_SAMPLES_PER_LANE = 12;
/** Dispersión mínima por rasgo, para que un rasgo casi constante no domine la distancia. */
const MIN_SPREAD: StrokeFeatures = [0.15, 0.03, 0.03, 0.15];

export function emptyProfile(laneCount: number): StrokeProfile {
  return { samples: Array.from({ length: laneCount }, () => []) };
}

export function isProfileReady(profile: StrokeProfile | null | undefined, laneCount: number): profile is StrokeProfile {
  return (
    !!profile &&
    profile.samples.length === laneCount &&
    profile.samples.every((lane) => lane.length >= MIN_SAMPLES_PER_LANE)
  );
}

/** Añade un ejemplo (se quedan los más recientes). */
export function addSample(profile: StrokeProfile, lane: number, features: StrokeFeatures): StrokeProfile {
  return {
    samples: profile.samples.map((existing, i) => (i === lane ? [...existing, features].slice(-MAX_SAMPLES_PER_LANE) : existing)),
  };
}

export function isStrokeFeatures(value: unknown): value is StrokeFeatures {
  return Array.isArray(value) && value.length === 4 && value.every((v) => typeof v === "number" && Number.isFinite(v));
}

export interface StrokeGuess {
  lane: number;
  /** 0..1: lo claro que está frente al segundo carril más parecido. */
  confidence: number;
}

/**
 * Clasificador por centroide más cercano con distancia normalizada por la
 * dispersión de cada rasgo. Pocos ejemplos bastan y se entiende qué hace.
 */
export class StrokeClassifier {
  private readonly centroids: StrokeFeatures[];
  private readonly spread: StrokeFeatures;

  constructor(profile: StrokeProfile) {
    const lanes = profile.samples.filter((lane) => lane.length > 0);
    if (lanes.length !== profile.samples.length || lanes.length === 0) {
      throw new Error("StrokeClassifier: cada carril necesita al menos un ejemplo.");
    }
    this.centroids = profile.samples.map((lane) => mean(lane));
    const spread: StrokeFeatures = [0, 0, 0, 0];
    let count = 0;
    profile.samples.forEach((lane, i) => {
      for (const sample of lane) {
        for (let d = 0; d < 4; d++) spread[d] += (sample[d] - this.centroids[i][d]) ** 2;
        count += 1;
      }
    });
    this.spread = spread.map((sum, d) => Math.max(MIN_SPREAD[d], Math.sqrt(sum / Math.max(1, count - lanes.length)))) as StrokeFeatures;
  }

  classify(features: StrokeFeatures): StrokeGuess {
    const distances = this.centroids.map((centroid) => {
      let sum = 0;
      for (let d = 0; d < 4; d++) sum += ((features[d] - centroid[d]) / this.spread[d]) ** 2;
      return Math.sqrt(sum);
    });
    const order = distances.map((distance, lane) => ({ distance, lane })).sort((a, b) => a.distance - b.distance);
    const [best, second] = order;
    const confidence = second ? 1 - best.distance / Math.max(1e-9, second.distance) : 1;
    return { lane: best.lane, confidence };
  }
}

function mean(samples: StrokeFeatures[]): StrokeFeatures {
  const out: StrokeFeatures = [0, 0, 0, 0];
  for (const sample of samples) for (let d = 0; d < 4; d++) out[d] += sample[d] / samples.length;
  return out;
}
