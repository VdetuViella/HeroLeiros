import { readLocal, writeLocal } from "../settings/local";
import type { AttemptResult } from "./types";

/** Destino de los intentos terminados. El backend sustituirá al local. */
export interface AttemptReporter {
  submit(result: AttemptResult): Promise<void>;
}

const HISTORY_KEY = "intentos";
const HISTORY_LIMIT = 100;

/** Guarda el historial en `localStorage` (sin cuentas todavía). */
export const localAttemptReporter: AttemptReporter = {
  async submit(result) {
    const history = readLocal<AttemptResult[]>(HISTORY_KEY, []);
    writeLocal(HISTORY_KEY, [result, ...history].slice(0, HISTORY_LIMIT));
  },
};

let current: AttemptReporter = localAttemptReporter;

export function setAttemptReporter(reporter: AttemptReporter): void {
  current = reporter;
}

export function reportAttempt(result: AttemptResult): Promise<void> {
  return current.submit(result);
}

export function loadLocalAttempts(): AttemptResult[] {
  return readLocal<AttemptResult[]>(HISTORY_KEY, []);
}

/** Mejor precisión guardada localmente para una canción e instrumento. */
export function bestLocalAttempt(songSlug: string, instrument: string): AttemptResult | null {
  return (
    loadLocalAttempts()
      .filter((a) => a.songSlug === songSlug && a.instrument === instrument && a.notesJudged > 0)
      .sort((a, b) => b.accuracy - a.accuracy || b.score - a.score)[0] ?? null
  );
}
