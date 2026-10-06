import type { HitJudgement, JudgementCounts } from "./types";

export const POINTS: Record<HitJudgement, number> = {
  perfecto: 100,
  bien: 70,
  regular: 40,
};

/** Peso de cada juicio para la precisión (0..1). */
export const ACCURACY_WEIGHT: Record<HitJudgement, number> = {
  perfecto: 1,
  bien: 0.75,
  regular: 0.4,
};

export const COMBO_PER_MULTIPLIER = 10;
export const MAX_MULTIPLIER = 4;

export function multiplierFor(combo: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(combo / COMBO_PER_MULTIPLIER));
}

export function emptyCounts(): JudgementCounts {
  return { perfecto: 0, bien: 0, regular: 0, fallo: 0, extra: 0, carrilEquivocado: 0 };
}

/**
 * Precisión 0..1. Los golpes de más y en el carril equivocado cuentan en el
 * denominador (si `penalizeStrayHits`), para que aporrear no salga gratis.
 */
export function accuracyFor(counts: JudgementCounts, penalizeStrayHits = true): number {
  const weighted =
    counts.perfecto * ACCURACY_WEIGHT.perfecto +
    counts.bien * ACCURACY_WEIGHT.bien +
    counts.regular * ACCURACY_WEIGHT.regular;
  const notes = counts.perfecto + counts.bien + counts.regular + counts.fallo;
  const denominator = notes + (penalizeStrayHits ? counts.extra + counts.carrilEquivocado : 0);
  return denominator === 0 ? 0 : weighted / denominator;
}

export const STAR_THRESHOLDS = [0.25, 0.5, 0.7, 0.85, 0.95] as const;

export function starsFor(accuracy: number): number {
  return STAR_THRESHOLDS.filter((threshold) => accuracy >= threshold).length;
}
