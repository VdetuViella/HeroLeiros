import {
  accuracyFor,
  emptyCounts,
  multiplierFor,
  POINTS,
  starsFor,
} from "./scoring";
import {
  DEFAULT_WINDOWS,
  type ExpectedNote,
  type HitJudgement,
  type JudgeEvent,
  type JudgementCounts,
  type JudgeStats,
  type JudgeWindows,
  type NoteState,
} from "./types";

/** Los bordes de las ventanas son inclusivos; tolera el error de coma flotante. */
const EPSILON = 1e-9;

export interface JudgeOptions {
  windows?: JudgeWindows;
  /** Número de secciones del chart, para el desglose por sección. */
  sectionCount?: number;
  /** Sección de un instante, para atribuir golpes de más. */
  sectionAt?: (time: number) => number;
  /** Si los golpes sueltos cuentan en contra de la precisión. */
  penalizeStrayHits?: boolean;
}

/**
 * Juez de tiempos. No sabe nada de audio ni de entrada: recibe notas
 * esperadas y golpes en la misma línea de tiempo (segundos) y lleva la cuenta.
 *
 * `hit(null, t)` juzga solo por tiempo (cualquier carril vale), pensado para
 * fuentes como el micrófono que no distinguen el golpe.
 */
export class Judge {
  readonly windows: JudgeWindows;
  private readonly states: NoteState[] = [];
  private firstPending = 0;
  private readonly sectionAt?: (time: number) => number;
  private readonly penalizeStrayHits: boolean;

  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private offsetSum = 0;
  private offsetCount = 0;
  private readonly counts: JudgementCounts = emptyCounts();
  private readonly sectionCounts: JudgementCounts[];

  constructor(options: JudgeOptions = {}) {
    this.windows = options.windows ?? DEFAULT_WINDOWS;
    this.sectionAt = options.sectionAt;
    this.penalizeStrayHits = options.penalizeStrayHits ?? true;
    this.sectionCounts = Array.from({ length: Math.max(1, options.sectionCount ?? 1) }, emptyCounts);
  }

  /** Añade notas (p. ej. una nueva vuelta del bucle). Deben llegar en orden de tiempo. */
  addNotes(notes: ExpectedNote[]): void {
    const last = this.states[this.states.length - 1]?.note.time ?? -Infinity;
    const sorted = [...notes].sort((a, b) => a.time - b.time);
    if (sorted.length > 0 && sorted[0].time < last) {
      throw new Error("Judge.addNotes: las notas deben añadirse en orden de tiempo.");
    }
    for (const note of sorted) {
      this.states.push({ note, result: null, offset: null, resolvedAt: null });
    }
  }

  get notes(): readonly NoteState[] {
    return this.states;
  }

  /** Juzga un golpe. `lane = null` acepta cualquier carril. */
  hit(lane: number | null, time: number): JudgeEvent {
    const { regular } = this.windows;
    let best: NoteState | null = null;
    let nearestOther: NoteState | null = null;

    for (let i = this.firstPending; i < this.states.length; i++) {
      const state = this.states[i];
      const delta = state.note.time - time;
      if (delta > regular + EPSILON) break;
      if (state.result !== null || delta < -regular - EPSILON) continue;
      const distance = Math.abs(delta);
      if (lane === null || state.note.lane === lane) {
        if (!best || distance < Math.abs(best.note.time - time)) best = state;
      } else if (!nearestOther || distance < Math.abs(nearestOther.note.time - time)) {
        nearestOther = state;
      }
    }

    if (best) return this.resolveHit(best, time);

    this.breakCombo();
    if (nearestOther && lane !== null) {
      this.bump("carrilEquivocado", nearestOther.note.section);
      return { kind: "carril-equivocado", lane, expectedLane: nearestOther.note.lane, time };
    }
    this.bump("extra", this.sectionAt?.(time) ?? 0);
    return { kind: "golpe-de-mas", lane, time };
  }

  /** Marca como falladas las notas cuya ventana ya pasó. */
  advance(time: number): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    for (let i = this.firstPending; i < this.states.length; i++) {
      const state = this.states[i];
      if (state.note.time + this.windows.regular >= time) break;
      if (state.result !== null) continue;
      state.result = "fallo";
      state.resolvedAt = time;
      this.breakCombo();
      this.bump("fallo", state.note.section);
      events.push({ kind: "fallo", note: state.note, time });
    }
    this.skipResolved();
    return events;
  }

  /** Da por falladas todas las notas pendientes (fin de la partida). */
  finish(time: number): JudgeEvent[] {
    return this.advance(Infinity).map((event) => ({ ...event, time }));
  }

  stats(): JudgeStats {
    const accuracy = accuracyFor(this.counts, this.penalizeStrayHits);
    const judgedNotes = this.counts.perfecto + this.counts.bien + this.counts.regular + this.counts.fallo;
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: multiplierFor(this.combo),
      counts: { ...this.counts },
      judgedNotes,
      totalNotes: this.states.length,
      accuracy,
      stars: starsFor(accuracy),
      meanOffset: this.offsetCount > 0 ? this.offsetSum / this.offsetCount : null,
      sections: this.sectionCounts.map((counts, section) => ({
        section,
        counts: { ...counts },
        notes: counts.perfecto + counts.bien + counts.regular + counts.fallo,
        accuracy: accuracyFor(counts, this.penalizeStrayHits),
      })),
    };
  }

  private resolveHit(state: NoteState, time: number): JudgeEvent {
    const offset = time - state.note.time;
    const judgement = this.classify(Math.abs(offset));
    const multiplier = multiplierFor(this.combo);
    const points = POINTS[judgement] * multiplier;

    state.result = judgement;
    state.offset = offset;
    state.resolvedAt = time;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += points;
    this.offsetSum += offset;
    this.offsetCount += 1;
    this.bump(judgement, state.note.section);
    this.skipResolved();

    return { kind: "acierto", note: state.note, judgement, offset, time, combo: this.combo, multiplier, points };
  }

  private classify(distance: number): HitJudgement {
    if (distance <= this.windows.perfecto + EPSILON) return "perfecto";
    if (distance <= this.windows.bien + EPSILON) return "bien";
    return "regular";
  }

  private breakCombo() {
    this.combo = 0;
  }

  private bump(key: keyof JudgementCounts, section: number) {
    this.counts[key] += 1;
    const bucket = this.sectionCounts[section] ?? this.sectionCounts[0];
    bucket[key] += 1;
  }

  private skipResolved() {
    while (this.firstPending < this.states.length && this.states[this.firstPending].result !== null) {
      this.firstPending += 1;
    }
  }
}
