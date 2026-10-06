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

export interface NoteState {
  note: ExpectedNote;
  result: Judgement | null;
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
}
