export type Judgement = "perfecto" | "bien" | "regular" | "fallo";
export type HitJudgement = Exclude<Judgement, "fallo">;

/** Semiventanas en segundos: un golpe es «perfecto» si |desfase| ≤ perfecto. */
export interface JudgeWindows {
  perfecto: number;
  bien: number;
  regular: number;
}

export const DEFAULT_WINDOWS: JudgeWindows = {
  perfecto: 0.035,
  bien: 0.07,
  regular: 0.12,
};

/** Una nota que el jugador debe tocar, en la línea de tiempo de la partida (segundos). */
export interface ExpectedNote {
  id: string;
  time: number;
  lane: number;
  accent?: boolean;
  /** Índice de la sección del chart (para el resultado por sección). */
  section: number;
}

/**
 * Cómo salió el acento de un golpe acertado, cuando la entrada sabe medirlo
 * (micrófono con los acentos calibrados): «bien» si coincide con la partitura
 * (acento donde lo hay y golpe normal donde no), «perdido» si faltó el acento y
 * «de-mas» si se acentuó un golpe normal.
 */
export type AccentResult = "bien" | "perdido" | "de-mas";

export interface NoteState {
  note: ExpectedNote;
  result: Judgement | null;
  /** `null` si la nota no se acertó o la entrada no mide acentos. */
  accentResult: AccentResult | null;
  /** Desfase del golpe (golpe − nota) en segundos; negativo = adelantado. */
  offset: number | null;
  /** Momento en que se resolvió la nota. */
  resolvedAt: number | null;
}

export type JudgeEvent =
  | {
      kind: "acierto";
      note: ExpectedNote;
      judgement: HitJudgement;
      offset: number;
      time: number;
      combo: number;
      multiplier: number;
      points: number;
      /** `null` si la entrada no mide acentos. */
      accent: AccentResult | null;
    }
  | { kind: "fallo"; note: ExpectedNote; time: number }
  | { kind: "carril-equivocado"; lane: number; expectedLane: number; time: number }
  | { kind: "golpe-de-mas"; lane: number | null; time: number };

export interface JudgementCounts {
  perfecto: number;
  bien: number;
  regular: number;
  fallo: number;
  /** Golpes sin ninguna nota cerca. */
  extra: number;
  /** Golpes en un carril distinto al de la nota cercana. */
  carrilEquivocado: number;
}

export interface SectionStats {
  section: number;
  counts: JudgementCounts;
  notes: number;
  accuracy: number;
}

/** Acentos de los golpes acertados que llegaron con fuerza medida. No cambian la puntuación. */
export interface AccentStats {
  /** Golpes acertados con fuerza medida. */
  judged: number;
  /** De ellos, los que coinciden con la partitura. */
  correct: number;
  /** Notas con acento que se tocaron sin acento. */
  missed: number;
  /** Notas normales que se tocaron acentuadas. */
  extra: number;
  /** Notas con acento (de las juzgadas) y cuántas se acentuaron. */
  accentNotes: number;
  accentsGiven: number;
  /** correct / judged, 0..1. */
  accuracy: number;
}

export interface JudgeStats {
  score: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  counts: JudgementCounts;
  /** Notas ya resueltas (acertadas o falladas). */
  judgedNotes: number;
  totalNotes: number;
  /** 0..1 */
  accuracy: number;
  stars: number;
  /** Desfase medio de los aciertos en segundos (negativo = adelantado). */
  meanOffset: number | null;
  sections: SectionStats[];
  /** `null` si ningún golpe llegó con fuerza medida (teclado, táctil o micrófono sin calibrar acentos). */
  accents: AccentStats | null;
}
