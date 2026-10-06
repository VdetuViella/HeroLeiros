import type { AttemptResult, AttemptSectionResult } from "../../lib/attempts/types";
import type { Chart, InstrumentId } from "../../lib/chart/types";
import { accuracyFor, emptyCounts, multiplierFor, POINTS, starsFor } from "../../lib/judge/scoring";

/** PRNG determinista (mulberry32): el mismo seed da siempre los mismos datos de demo. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoPlayer {
  /** Precisión típica al empezar (0..1). */
  skill: number;
  /** Cuánto mejora a lo largo del periodo (0..1). */
  growth: number;
  instruments: InstrumentId[];
}

/** Secciones que cuestan más (cortes y llamadas). */
const HARD_SECTIONS = /breque|llamada|final|corte/i;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Simula una partida completa de `chart` con `instrument`: reparte las notas
 * reales de cada sección entre perfecto/bien/regular/fallo según la habilidad.
 */
export function simulateAttempt(
  chart: Chart,
  instrument: InstrumentId,
  skill: number,
  finishedAt: Date,
  rand: () => number,
): AttemptResult | null {
  const track = chart.tracks.find((t) => t.instrument === instrument);
  if (!track || track.notes.length === 0) return null;

  const speed = skill < 0.62 ? 0.75 : skill < 0.7 && rand() < 0.5 ? 0.85 : 1;
  const sections: AttemptSectionResult[] = [];
  const total = emptyCounts();
  let combo = 0;
  let maxCombo = 0;
  let score = 0;

  for (const section of chart.sections) {
    const notes = track.notes.filter((n) => n.bar >= section.startBar && n.bar <= section.endBar).length;
    if (notes === 0) continue;
    const difficulty = HARD_SECTIONS.test(section.name) ? 0.14 : 0;
    const hitRate = clamp01(skill + 0.12 - difficulty + (rand() - 0.5) * 0.12);
    const counts = emptyCounts();
    for (let i = 0; i < notes; i++) {
      const r = rand();
      if (r > hitRate) {
        counts.fallo++;
        combo = 0;
        continue;
      }
      const quality = rand() * 0.5 + skill * 0.6;
      const judgement = quality > 0.55 ? "perfecto" : quality > 0.3 ? "bien" : "regular";
      counts[judgement]++;
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      score += POINTS[judgement] * multiplierFor(combo);
    }
    counts.extra = Math.round(rand() * (1 - skill) * 3);
    for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += counts[key];
    sections.push({
      name: section.name,
      startBar: section.startBar,
      endBar: section.endBar,
      notes,
      accuracy: accuracyFor(counts),
      counts,
    });
  }

  const accuracy = accuracyFor(total);
  const durationMs = (chart.durationSeconds / speed) * 1000;
  const notesJudged = total.perfecto + total.bien + total.regular + total.fallo;
  return {
    songSlug: chart.slug,
    songTitle: chart.title,
    instrument,
    speed,
    range: { startBar: 1, endBar: chart.bars, sectionName: null },
    loop: false,
    passes: 1,
    completed: true,
    inputSources: [rand() < 0.3 ? "tactil" : "teclado"],
    score,
    accuracy,
    stars: starsFor(accuracy),
    maxCombo,
    counts: total,
    notesJudged,
    meanOffsetMs: Math.round((rand() - 0.5) * 40 * (1 - skill)),
    latencyOffsetMs: 0,
    sections,
    startedAt: new Date(finishedAt.getTime() - durationMs).toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
}

/** Partidas de los últimos `days` días: unos días sí y otros no, mejorando con el tiempo. */
export function simulateHistory(
  charts: Chart[],
  player: DemoPlayer,
  options: { days: number; now: Date; seed: number },
): AttemptResult[] {
  const rand = seededRandom(options.seed);
  const results: AttemptResult[] = [];
  for (let day = options.days; day >= 0; day--) {
    if (rand() > 0.45) continue;
    const progress = 1 - day / options.days;
    const sessions = 1 + Math.floor(rand() * 3);
    for (let s = 0; s < sessions; s++) {
      const chart = charts[Math.floor(rand() * charts.length)];
      const instrument = rand() < 0.8 ? player.instruments[0] : player.instruments[Math.floor(rand() * player.instruments.length)];
      const at = new Date(options.now.getTime() - day * 86_400_000);
      at.setUTCHours(17 + Math.floor(rand() * 4), Math.floor(rand() * 60), 0, 0);
      at.setUTCMinutes(at.getUTCMinutes() + s * 6);
      if (at > options.now) continue;
      const skill = clamp01(player.skill + player.growth * progress + (rand() - 0.5) * 0.06);
      const attempt = simulateAttempt(chart, instrument, skill, at, rand);
      if (attempt) results.push(attempt);
    }
  }
  return results;
}
