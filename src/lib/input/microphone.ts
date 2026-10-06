import { OutputDelayTracker, micTimeToHeardTime } from "../mic/clock";
import type { MicInput } from "../mic/mic-input";
import type { StrokeClassifier } from "../mic/stroke-classifier";
import type { HitListener, InputSource } from "./types";

/** Lo mínimo del motor de audio que hace falta para traducir relojes. */
export interface HeardClockSource {
  readonly currentTime: number;
  heardTime(performanceTime?: number): number;
}

type MicLike = Pick<MicInput, "inputLatency" | "onOnset" | "onLevel" | "onFeatures" | "close">;

/**
 * Convierte la hora de render de un golpe del micrófono al reloj «lo que se
 * oye». Muestrea el retraso de salida con cada mensaje del worklet.
 */
export function createMicClock(engine: HeardClockSource, mic: MicLike): { toHeard: (contextTime: number) => number; dispose: () => void } {
  const tracker = new OutputDelayTracker();
  const sample = () => tracker.add(engine.currentTime - engine.heardTime());
  sample();
  const unsubscribe = mic.onLevel(sample);
  return {
    toHeard: (contextTime) => {
      sample();
      return micTimeToHeardTime(contextTime, tracker.value, mic.inputLatency);
    },
    dispose: unsubscribe,
  };
}

export interface MicInputSourceOptions {
  /** Si `true` (por defecto), al parar la partida también se libera el micrófono. */
  closeOnStop?: boolean;
  /**
   * Fase B (experimental): con un clasificador entrenado, cada golpe lleva el
   * carril del tipo de golpe reconocido. Sin él, cualquier golpe vale (fase A).
   */
  classifier?: StrokeClassifier | null;
}

interface PendingHit {
  frame: number;
  time: number;
  velocity: number;
}

/** Fuente de golpes por micrófono. */
export class MicInputSource implements InputSource {
  readonly kind = "microfono" as const;
  readonly lanesAware: boolean;
  private readonly closeOnStop: boolean;
  private readonly classifier: StrokeClassifier | null;
  private unsubscribers: (() => void)[] = [];
  private pending: PendingHit | null = null;

  constructor(
    readonly mic: MicLike,
    private readonly engine: HeardClockSource,
    options: MicInputSourceOptions = {},
  ) {
    this.closeOnStop = options.closeOnStop ?? true;
    this.classifier = options.classifier ?? null;
    this.lanesAware = this.classifier !== null;
  }

  start(listener: HitListener): void {
    this.stopListening();
    const clock = createMicClock(this.engine, this.mic);
    const emit = (hit: PendingHit, lane: number | null) =>
      listener({ lane, time: clock.toHeard(hit.time), source: this.kind, velocity: hit.velocity });

    this.unsubscribers = [
      clock.dispose,
      this.mic.onOnset(({ onset, time }) => {
        const hit = { frame: onset.frame, time, velocity: onset.velocity };
        if (!this.classifier) {
          emit(hit, null);
          return;
        }
        if (this.pending) emit(this.pending, null);
        this.pending = hit;
      }),
      this.mic.onFeatures(({ frame, features }) => {
        if (!this.classifier || !this.pending || this.pending.frame !== frame) return;
        const hit = this.pending;
        this.pending = null;
        emit(hit, this.classifier.classify(features).lane);
      }),
    ];
  }

  stop(): void {
    this.stopListening();
    if (this.closeOnStop) this.mic.close();
  }

  private stopListening() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    this.pending = null;
  }
}
