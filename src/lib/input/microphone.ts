import { OutputDelayTracker, micTimeToHeardTime } from "../mic/clock";
import type { MicInput } from "../mic/mic-input";
import type { HitListener, InputSource } from "./types";

/** Lo mínimo del motor de audio que hace falta para traducir relojes. */
export interface HeardClockSource {
  readonly currentTime: number;
  heardTime(performanceTime?: number): number;
}

/**
 * Convierte la hora de render de un golpe del micrófono al reloj «lo que se
 * oye». Muestrea el retraso de salida con cada mensaje del worklet.
 */
export function createMicClock(engine: HeardClockSource, mic: MicInput): { toHeard: (contextTime: number) => number; dispose: () => void } {
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

/**
 * Fuente de golpes por micrófono, fase A: solo cuenta el tiempo, cualquier
 * golpe vale para cualquier carril (`lanesAware = false`).
 */
export class MicInputSource implements InputSource {
  readonly kind = "microfono" as const;
  readonly lanesAware = false;
  private unsubscribe: (() => void) | null = null;
  private clock: ReturnType<typeof createMicClock> | null = null;

  /** Si `closeOnStop`, al parar la partida también se libera el micrófono. */
  constructor(
    readonly mic: MicInput,
    private readonly engine: HeardClockSource,
    private readonly closeOnStop = true,
  ) {}

  start(listener: HitListener): void {
    this.stopListening();
    const clock = createMicClock(this.engine, this.mic);
    this.clock = clock;
    this.unsubscribe = this.mic.onOnset(({ onset, time }) => {
      listener({ lane: null, time: clock.toHeard(time), source: this.kind, velocity: onset.velocity });
    });
  }

  stop(): void {
    this.stopListening();
    if (this.closeOnStop) this.mic.close();
  }

  private stopListening() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.clock?.dispose();
    this.clock = null;
  }
}
