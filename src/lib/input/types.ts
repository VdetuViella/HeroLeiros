export type InputSourceKind = "teclado" | "tactil" | "microfono";

export interface InputHit {
  /** Carril tocado, o `null` si la fuente no distingue golpes (micrófono). */
  lane: number | null;
  /**
   * Momento del golpe en el reloj «lo que se oye» del motor de audio
   * (`AudioEngine.heardTime`), en segundos.
   */
  time: number;
  source: InputSourceKind;
  /** Intensidad 0..1 si la fuente la conoce. */
  velocity?: number;
}

export type HitListener = (hit: InputHit) => void;

/**
 * Una fuente de golpes. La partida llama a `start` al empezar y a `stop` al
 * terminar; la fuente emite `InputHit` mientras está activa.
 *
 * Para añadir el micrófono basta con implementar esta interfaz (con
 * `lanesAware = false` en la fase A) y pasarla a `GameSession`.
 */
export interface InputSource {
  readonly kind: InputSourceKind;
  /** Si los golpes llevan carril. Si es `false` el juez acepta cualquier carril. */
  readonly lanesAware: boolean;
  start(listener: HitListener): void | Promise<void>;
  stop(): void;
}

/** Convierte un `event.timeStamp` (ms de `performance`) al reloj de audio. */
export type HeardClock = (performanceTime: number) => number;
