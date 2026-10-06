import { z } from "zod";

import type { AttemptResult } from "../../lib/attempts/types";
import { INSTRUMENT_IDS } from "../../lib/chart/types";
import type { NewAttemptRow } from "../db/schema";

/** Máximo de intentos por petición (la cola los envía en lotes). */
export const MAX_BATCH = 50;

const count = z.number().int().min(0).max(100_000);

const countsSchema = z.object({
  perfecto: count,
  bien: count,
  regular: count,
  fallo: count,
  extra: count,
  carrilEquivocado: count,
});

const ratio = z.number().min(0).max(1);
const bar = z.number().int().min(1).max(10_000);
const isoDate = z.iso.datetime({ offset: true });

const sectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startBar: bar,
  endBar: bar,
  notes: count,
  accuracy: ratio,
  counts: countsSchema,
});

export const attemptResultSchema = z
  .object({
    songSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
    songTitle: z.string().trim().min(1).max(200),
    instrument: z.enum(INSTRUMENT_IDS),
    speed: z.number().min(0.25).max(2),
    range: z.object({ startBar: bar, endBar: bar, sectionName: z.string().max(120).nullable() }),
    loop: z.boolean(),
    passes: z.number().int().min(0).max(1000),
    completed: z.boolean(),
    inputSources: z.array(z.enum(["teclado", "tactil", "microfono"])).max(3),
    score: z.number().int().min(0).max(100_000_000),
    accuracy: ratio,
    stars: z.number().int().min(0).max(5),
    maxCombo: count,
    counts: countsSchema,
    notesJudged: count,
    meanOffsetMs: z.number().min(-10_000).max(10_000).nullable(),
    latencyOffsetMs: z.number().min(-10_000).max(10_000),
    sections: z.array(sectionSchema).max(200),
    startedAt: isoDate,
    finishedAt: isoDate,
  })
  .refine((a) => a.range.endBar >= a.range.startBar, { message: "El tramo termina antes de empezar." })
  .refine((a) => Date.parse(a.finishedAt) >= Date.parse(a.startedAt), {
    message: "La partida termina antes de empezar.",
  });

export const attemptEnvelopeSchema = z.object({
  key: z.string().min(1).max(200),
  result: z.unknown(),
});

export const attemptsBodySchema = z.union([
  z.object({ attempts: z.array(attemptEnvelopeSchema).min(1).max(MAX_BATCH) }),
  attemptEnvelopeSchema,
]);

export function toAttemptRow(userId: string, key: string, result: AttemptResult): NewAttemptRow {
  return {
    userId,
    clientKey: key,
    songSlug: result.songSlug,
    songTitle: result.songTitle,
    instrument: result.instrument,
    speed: result.speed,
    startBar: result.range.startBar,
    endBar: result.range.endBar,
    sectionName: result.range.sectionName,
    loop: result.loop,
    passes: result.passes,
    completed: result.completed,
    inputSources: [...new Set(result.inputSources)],
    score: result.score,
    accuracy: result.accuracy,
    stars: result.stars,
    maxCombo: result.maxCombo,
    counts: result.counts,
    notesJudged: result.notesJudged,
    meanOffsetMs: result.meanOffsetMs,
    latencyOffsetMs: result.latencyOffsetMs,
    sections: result.sections,
    startedAt: new Date(result.startedAt),
    finishedAt: new Date(result.finishedAt),
  };
}
