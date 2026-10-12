import type { AccentStats } from "./types";

/** Consejo breve sobre los acentos al acabar la partida. */
export function accentAdvice(stats: AccentStats): string {
  const normalNotes = stats.judged - stats.accentNotes;
  if (stats.accentNotes === 0) {
    return stats.extra > 0
      ? "Este tramo no lleva acentos y has acentuado algunos golpes: mantén la misma fuerza en todos."
      : "Este tramo no lleva acentos y has tocado todo parejo.";
  }
  if (stats.accuracy >= 0.9) return "Acentos muy limpios: se nota la diferencia entre los golpes fuertes y los normales.";
  const missedRate = stats.missed / stats.accentNotes;
  const extraRate = normalNotes > 0 ? stats.extra / normalNotes : 0;
  if (missedRate >= 0.25 && missedRate >= extraRate) {
    return "Se te escapan acentos: marca más la fuerza en las notas acentuadas (las más grandes del carril, «>» en la partitura).";
  }
  if (extraRate >= 0.15) return "Acentúas notas que van normales: suelta el golpe fuera de los acentos.";
  return "Vas bien: repite el tramo fijándote en los acentos para afinar la diferencia de fuerza.";
}
