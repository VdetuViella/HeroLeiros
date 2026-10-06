import type { HeardClock, HitListener, InputSource } from "./types";

/**
 * Fuente táctil: los pads de pantalla llaman a `press` desde `pointerdown`,
 * así funciona con varios dedos a la vez y también con ratón.
 */
export class TouchInputSource implements InputSource {
  readonly kind = "tactil" as const;
  readonly lanesAware = true;
  private listener: HitListener | null = null;

  constructor(private readonly clock: HeardClock) {}

  start(listener: HitListener): void {
    this.listener = listener;
  }

  stop(): void {
    this.listener = null;
  }

  press(lane: number, eventTimeStamp: number): void {
    this.listener?.({ lane, time: this.clock(eventTimeStamp), source: this.kind });
  }
}
