import type { AudioEngine } from "../audio/engine";
import { strokeSound } from "../audio/sounds";
import { getTrack } from "../chart/query";
import type { Chart, ChartTrack, InstrumentId } from "../chart/types";
import type { AttemptResult } from "../attempts/types";
import type { InputHit, InputSource, InputSourceKind } from "../input/types";
import { Judge } from "../judge/judge";
import type { JudgeEvent, JudgeStats, JudgeWindows } from "../judge/types";
import {
  buildScore,
  clicksInWindow,
  createPlan,
  expectedNotesForPass,
  positionAt,
  scoreEventsInWindow,
  sectionAtTime,
  type PlanOptions,
  type ScoreEvent,
  type SessionPlan,
  type SessionPosition,
} from "./timeline";

export type GuideMode = "silenciada" | "baja" | "normal";

/** Ganancia de la pista propia dentro del acompañamiento. */
export const GUIDE_GAIN: Record<GuideMode, number> = {
  silenciada: 0,
  baja: 0.22,
  normal: 1,
};

export type SessionStatus = "preparada" | "tocando" | "pausada" | "terminada";

export interface GameSessionOptions {
  chart: Chart;
  instrument: InstrumentId;
  plan: PlanOptions;
  metronome: boolean;
  guide: GuideMode;
  /** Reproducir el sonido del golpe al tocar (no tiene sentido con micrófono). */
  hitSounds: boolean;
  /** Desfase calibrado por fuente, en ms. */
  latencyMs?: Partial<Record<InputSourceKind, number>>;
  inputs: InputSource[];
  windows?: JudgeWindows;
  /** Se llama una vez cuando la partida termina (al final o al parar). */
  onFinish?: (result: AttemptResult) => void;
}

export interface FeedbackEvent {
  event: JudgeEvent;
  /** Momento (segundos de partida, reloj visual) en que ocurrió. */
  at: number;
}

export interface SessionSnapshot {
  status: SessionStatus;
  stats: JudgeStats;
  lastEvent: JudgeEvent | null;
}

const SCHEDULER_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.25;
const START_DELAY_SECONDS = 0.15;
const PASS_PRELOAD_SECONDS = 4;
const FEEDBACK_MEMORY_SECONDS = 1.5;

/**
 * Una partida: programa el acompañamiento y el metrónomo con planificación
 * anticipada sobre el reloj de audio, recibe golpes de las fuentes de entrada
 * y los pasa al juez. La imagen se pinta leyendo `now()` en cada frame.
 */
export class GameSession {
  readonly plan: SessionPlan;
  readonly track: ChartTrack;
  readonly judge: Judge;
  readonly lastPress: number[];
  readonly feedback: FeedbackEvent[] = [];

  private readonly score: ScoreEvent[];
  private readonly listeners = new Set<() => void>();
  private snapshot: SessionSnapshot;
  private status: SessionStatus = "preparada";
  private pausedAt: number | null = null;
  private t0 = 0;
  private scheduledUntil = 0;
  private passesAdded = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt: Date | null = null;
  private metronome: boolean;
  private readonly usedSources = new Set<InputSourceKind>();

  constructor(
    private readonly engine: AudioEngine,
    private readonly options: GameSessionOptions,
  ) {
    const track = getTrack(options.chart, options.instrument);
    if (!track) throw new Error(`La canción no tiene pista de ${options.instrument}.`);
    this.track = track;
    this.plan = createPlan(options.chart, options.plan);
    this.score = buildScore(options.chart, this.plan);
    this.metronome = options.metronome;
    this.lastPress = track.lanes.map(() => -Infinity);
    this.judge = new Judge({
      windows: options.windows,
      sectionCount: options.chart.sections.length,
      sectionAt: (time) => sectionAtTime(options.chart, this.plan, time),
    });
    this.snapshot = { status: this.status, stats: this.judge.stats(), lastEvent: null };
  }

  /** Tiempo de partida que se está oyendo ahora (o en `performanceTime`). */
  now(performanceTime?: number): number {
    if (this.status === "preparada") return 0;
    if (this.pausedAt !== null) return this.pausedAt;
    return this.engine.heardTime(performanceTime) - this.t0;
  }

  position(): SessionPosition {
    return positionAt(this.plan, this.now());
  }

  get state(): SessionStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.status !== "preparada") return;
    await this.engine.resume();
    this.t0 = this.engine.currentTime + START_DELAY_SECONDS;
    this.scheduledUntil = 0;
    this.startedAt = new Date();
    this.addPass();
    for (const input of this.options.inputs) await input.start(this.handleHit);
    this.status = "tocando";
    this.tick();
    this.timer = setInterval(this.tick, SCHEDULER_INTERVAL_MS);
    this.emit(null);
  }

  async pause(): Promise<void> {
    if (this.status !== "tocando") return;
    this.pausedAt = this.now();
    this.status = "pausada";
    await this.engine.suspend();
    this.emit(null);
  }

  async resume(): Promise<void> {
    if (this.status !== "pausada") return;
    await this.engine.resume();
    this.pausedAt = null;
    this.status = "tocando";
    this.emit(null);
  }

  /** Termina antes de tiempo. Las notas que aún no han llegado no cuentan. */
  async stop(): Promise<void> {
    await this.finish(false);
  }

  /** Abandona la partida sin emitir resultado (reiniciar o salir). */
  async discard(): Promise<void> {
    await this.finish(false, false);
  }

  setMetronome(enabled: boolean): void {
    this.metronome = enabled;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SessionSnapshot => this.snapshot;

  private readonly tick = () => {
    if (this.status !== "tocando") return;
    const scheduleNow = this.engine.currentTime - this.t0;
    const horizon = Math.min(scheduleNow + SCHEDULE_AHEAD_SECONDS, this.plan.endTime);
    if (horizon > this.scheduledUntil) {
      this.schedule(this.scheduledUntil, horizon);
      this.scheduledUntil = horizon;
    }

    const now = this.now();
    if (this.plan.loop) {
      const upcoming = positionAt(this.plan, now + PASS_PRELOAD_SECONDS).pass;
      while (this.passesAdded <= upcoming) this.addPass();
    }

    const misses = this.judge.advance(now - this.maxLatency());
    for (const event of misses) this.pushFeedback(event, now);
    if (misses.length > 0) this.emit(misses[misses.length - 1]);

    if (now >= this.plan.endTime) void this.finish(true);
  };

  private schedule(from: number, to: number) {
    const guideGain = GUIDE_GAIN[this.options.guide];
    for (const event of scoreEventsInWindow(this.score, this.plan, from, to)) {
      const own = event.instrument === this.options.instrument;
      const gain = (0.35 + 0.65 * event.velocity) * (own ? guideGain : 1);
      this.engine.play(strokeSound(event.instrument, event.stroke), event.instrument, this.t0 + event.time, gain);
    }
    for (const click of clicksInWindow(this.plan, from, to, this.metronome)) {
      this.engine.play(
        click.downbeat ? "metronomo:alto" : "metronomo:bajo",
        "metronomo",
        this.t0 + click.time,
        click.countIn ? 1 : 0.7,
      );
    }
  }

  private readonly handleHit = (hit: InputHit) => {
    if (this.status !== "tocando") return;
    const visualTime = hit.time - this.t0;
    if (hit.lane === null) this.lastPress.fill(visualTime);
    else if (hit.lane < this.lastPress.length) this.lastPress[hit.lane] = visualTime;

    if (this.options.hitSounds && hit.lane !== null) {
      const stroke = this.track.lanes[hit.lane];
      if (stroke) this.engine.play(strokeSound(this.track.instrument, stroke), "golpes", this.engine.currentTime, 0.9);
    }

    const judgedTime = visualTime - this.latencySeconds(hit.source);
    if (judgedTime < this.plan.countInSeconds - this.judge.windows.regular) return;

    const source = this.options.inputs.find((input) => input.kind === hit.source);
    const lane = source && !source.lanesAware ? null : hit.lane;
    this.usedSources.add(hit.source);
    const event = this.judge.hit(lane, judgedTime, hit.accent);
    this.pushFeedback(event, visualTime);
    this.emit(event);
  };

  private addPass() {
    this.judge.addNotes(expectedNotesForPass(this.options.chart, this.track, this.plan, this.passesAdded));
    this.passesAdded += 1;
  }

  private latencySeconds(kind: InputSourceKind): number {
    return (this.options.latencyMs?.[kind] ?? 0) / 1000;
  }

  private maxLatency(): number {
    return Math.max(0, ...this.options.inputs.map((input) => this.latencySeconds(input.kind)));
  }

  private pushFeedback(event: JudgeEvent, at: number) {
    this.feedback.push({ event, at });
    const cutoff = at - FEEDBACK_MEMORY_SECONDS;
    while (this.feedback.length > 0 && this.feedback[0].at < cutoff) this.feedback.shift();
  }

  private emit(lastEvent: JudgeEvent | null) {
    this.snapshot = { status: this.status, stats: this.judge.stats(), lastEvent: lastEvent ?? this.snapshot.lastEvent };
    for (const listener of this.listeners) listener();
  }

  private async finish(completed: boolean, report = true) {
    if (this.status === "terminada") return;
    if (this.status === "preparada") {
      this.status = "terminada";
      return;
    }
    const wasPaused = this.status === "pausada";
    this.status = "terminada";
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const input of this.options.inputs) input.stop();
    if (wasPaused) await this.engine.resume();

    const now = this.now();
    if (completed && !this.plan.loop) this.judge.finish(now);
    else this.judge.advance(now - this.maxLatency());
    if (!completed) this.engine.stopAll();

    this.emit(null);
    if (report) this.options.onFinish?.(this.buildResult(completed, now));
  }

  private buildResult(completed: boolean, now: number): AttemptResult {
    const { chart } = this.options;
    const stats = this.judge.stats();
    const plan = this.plan;
    const exact = chart.sections.find((s) => s.startBar === plan.startBar && s.endBar === plan.endBar);
    const whole = plan.startBar === 1 && plan.endBar === chart.bars;
    const position = positionAt(plan, now);
    const passes = plan.loop ? position.pass : completed ? 1 : 0;

    return {
      songSlug: chart.slug,
      songTitle: chart.title,
      instrument: this.track.instrument,
      speed: plan.rate,
      range: {
        startBar: plan.startBar,
        endBar: plan.endBar,
        sectionName: exact?.name ?? (whole ? "Canción completa" : null),
      },
      loop: plan.loop,
      passes,
      completed,
      inputSources: [...this.usedSources],
      score: stats.score,
      accuracy: stats.accuracy,
      stars: stats.stars,
      maxCombo: stats.maxCombo,
      counts: stats.counts,
      notesJudged: stats.judgedNotes,
      meanOffsetMs: stats.meanOffset === null ? null : Math.round(stats.meanOffset * 1000),
      latencyOffsetMs: Math.round(this.maxLatency() * 1000),
      sections: chart.sections
        .map((section, index) => ({ section, stats: stats.sections[index] }))
        .filter(({ section }) => section.endBar >= plan.startBar && section.startBar <= plan.endBar)
        .map(({ section, stats: s }) => ({
          name: section.name,
          startBar: section.startBar,
          endBar: section.endBar,
          notes: s?.notes ?? 0,
          accuracy: s?.accuracy ?? 0,
          counts: s?.counts ?? { perfecto: 0, bien: 0, regular: 0, fallo: 0, extra: 0, carrilEquivocado: 0 },
        })),
      accents: stats.accents,
      startedAt: (this.startedAt ?? new Date()).toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }
}
