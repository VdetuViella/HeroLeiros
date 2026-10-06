import type { AttemptResult, AttemptSectionResult } from "../../lib/attempts/types";
import type { JudgementCounts } from "../../lib/judge/types";

export function counts(partial: Partial<JudgementCounts> = {}): JudgementCounts {
  return { perfecto: 0, bien: 0, regular: 0, fallo: 0, extra: 0, carrilEquivocado: 0, ...partial };
}

export function section(name: string, notes: number, fallo: number, startBar = 1, endBar = 4): AttemptSectionResult {
  const hits = notes - fallo;
  return { name, startBar, endBar, notes, accuracy: notes ? hits / notes : 0, counts: counts({ perfecto: hits, fallo }) };
}

/** Intento válido de «samba-de-ensayo» con caixa; `finishedAt` controla la fecha. */
export function makeAttempt(overrides: Partial<AttemptResult> = {}): AttemptResult {
  const finishedAt = overrides.finishedAt ?? "2026-10-01T18:00:00.000Z";
  const startedAt = overrides.startedAt ?? new Date(Date.parse(finishedAt) - 90_000).toISOString();
  const sections = overrides.sections ?? [section("Llamada", 20, 2), section("Groove", 40, 6, 5, 12)];
  const notes = sections.reduce((n, s) => n + s.notes, 0);
  const misses = sections.reduce((n, s) => n + s.counts.fallo, 0);
  return {
    songSlug: "samba-de-ensayo",
    songTitle: "Samba de ensayo",
    instrument: "caixa",
    speed: 1,
    range: { startBar: 1, endBar: 24, sectionName: null },
    loop: false,
    passes: 1,
    completed: true,
    inputSources: ["teclado"],
    score: 12_000,
    accuracy: notes ? (notes - misses) / notes : 0,
    stars: 4,
    maxCombo: 30,
    counts: counts({ perfecto: notes - misses, fallo: misses }),
    notesJudged: notes,
    meanOffsetMs: -4,
    latencyOffsetMs: 0,
    sections,
    ...overrides,
    startedAt,
    finishedAt,
  };
}
