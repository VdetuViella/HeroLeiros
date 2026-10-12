import type { InstrumentId } from "../chart/types";
import type { InputSourceKind } from "../input/types";
import type { AccentStats, JudgementCounts } from "../judge/types";

export interface AttemptSectionResult {
  name: string;
  startBar: number;
  endBar: number;
  notes: number;
  accuracy: number;
  counts: JudgementCounts;
}

/**
 * Resultado de una partida terminada. Es lo que se enviará a
 * `POST /api/attempts` cuando exista el backend.
 */
export interface AttemptResult {
  songSlug: string;
  songTitle: string;
  instrument: InstrumentId;
  /** Velocidad 0.5..1. */
  speed: number;
  /** Tramo tocado (compases incluidos) y nombre de la sección si coincide con una. */
  range: { startBar: number; endBar: number; sectionName: string | null };
  loop: boolean;
  /** Vueltas completas al tramo (1 sin bucle). */
  passes: number;
  /** `true` si la canción llegó al final; `false` si el jugador paró antes. */
  completed: boolean;
  inputSources: InputSourceKind[];
  score: number;
  accuracy: number;
  stars: number;
  maxCombo: number;
  counts: JudgementCounts;
  notesJudged: number;
  meanOffsetMs: number | null;
  latencyOffsetMs: number;
  sections: AttemptSectionResult[];
  /**
   * Acentos (solo con micrófono y acentos calibrados). Opcional: las partidas
   * anteriores no lo tienen y el servidor todavía no lo guarda.
   */
  accents?: AccentStats | null;
  startedAt: string;
  finishedAt: string;
}
