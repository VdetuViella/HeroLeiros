export interface LatencyEstimate {
  /** Desfase mediano (golpe − clic) en ms; positivo = el golpe llega tarde. */
  offsetMs: number;
  /** Dispersión (desviación absoluta mediana) en ms. */
  spreadMs: number;
  /** Golpes usados para el cálculo. */
  used: number;
}

/**
 * Empareja cada golpe con el clic más cercano (dentro de `windowSeconds`) y
 * devuelve la mediana de los desfases. Todos los tiempos en segundos del
 * mismo reloj.
 */
export function estimateLatency(taps: number[], clicks: number[], windowSeconds = 0.25): LatencyEstimate | null {
  const offsets: number[] = [];
  for (const tap of taps) {
    let best: number | null = null;
    for (const click of clicks) {
      const delta = tap - click;
      if (Math.abs(delta) <= windowSeconds && (best === null || Math.abs(delta) < Math.abs(best))) best = delta;
    }
    if (best !== null) offsets.push(best * 1000);
  }
  if (offsets.length === 0) return null;
  const offset = median(offsets);
  return {
    offsetMs: Math.round(offset),
    spreadMs: Math.round(median(offsets.map((o) => Math.abs(o - offset)))),
    used: offsets.length,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
