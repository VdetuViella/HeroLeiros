import type { DetectorSettings, NoiseProfile, Onset, StrokeFeatures } from "./onset-detector";

/** Nombre con el que se registra el procesador en el AudioWorklet. */
export const ONSET_PROCESSOR_NAME = "heroleiros-onset";
/** Ruta pública del módulo generado por `npm run worklet:build`. */
export const ONSET_PROCESSOR_URL = "/worklets/onset-processor.js";

export interface OnsetProcessorOptions {
  settings: DetectorSettings;
  /** Cada cuánto manda el nivel para el medidor, en ms (0 = nunca). */
  meterIntervalMs: number;
}

/** Hilo principal → worklet. */
export type ToWorklet =
  | { type: "configure"; settings: Partial<DetectorSettings> }
  | { type: "measure-noise"; seconds: number }
  | { type: "meter"; intervalMs: number };

/** Worklet → hilo principal. */
export type FromWorklet =
  | { type: "onset"; onset: Onset; /** Segundos de `AudioContext` del ataque. */ time: number }
  | { type: "features"; frame: number; features: StrokeFeatures }
  | { type: "noise-profile"; profile: NoiseProfile }
  | {
      type: "level";
      /** Máximo del nivel RMS por bloque desde el último aviso, dBFS. */
      levelDb: number;
      /** Pico de muestra desde el último aviso, dBFS. */
      peakDb: number;
      gateDb: number;
      calibrating: boolean;
    };
