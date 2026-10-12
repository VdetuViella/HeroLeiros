import { buildPatternChart, type PatternTrack } from "../chart/build";
import type { Chart } from "../chart/types";
import { findExercise, type Exercise, type Routine } from "./catalog";

/**
 * Cada escalón de tempo es su propio «chart», con su slug, para que el
 * historial y las mejores marcas vayan por ejercicio y tempo.
 */
export function stepSlug(slug: string, bpm: number): string {
  return `${slug}-${Math.round(bpm)}`;
}

function repeated<T>(items: readonly T[], times: number): T[] {
  return Array.from({ length: Math.max(1, times) }, () => items).flat();
}

export function exerciseChart(exercise: Exercise, bpm: number): Chart {
  const tracks: PatternTrack[] = [
    {
      instrument: exercise.instrument,
      bars: repeated(exercise.bars, exercise.repeat),
      ...(exercise.hands ? { hands: repeated(exercise.hands, exercise.repeat) } : {}),
    },
    ...(exercise.accompaniment ?? []).map((part) => ({
      instrument: part.instrument,
      bars: repeated(part.bars, exercise.repeat * Math.max(1, exercise.bars.length / part.bars.length)),
    })),
  ];
  return buildPatternChart({
    slug: stepSlug(exercise.slug, bpm),
    title: `${exercise.title} · ${bpm} BPM`,
    description: exercise.description,
    bpm,
    tracks,
  });
}

/** Una rutina: los ejercicios uno detrás de otro, cada uno en su sección, sin acompañamiento. */
export function routineChart(routine: Routine, bpm: number): Chart {
  const bars: string[] = [];
  const hands: string[] = [];
  const sections: { name: string; startBar: number }[] = [];
  for (const part of routine.parts) {
    const exercise = findExercise(part.exercise);
    if (!exercise) throw new Error(`La rutina ${routine.slug} usa un ejercicio que no existe: ${part.exercise}`);
    sections.push({ name: exercise.title, startBar: bars.length + 1 });
    const partBars = repeated(exercise.bars, part.repeat);
    const partHands = exercise.hands ? repeated(exercise.hands, part.repeat) : partBars.map((p) => ".".repeat(p.length));
    bars.push(...partBars);
    hands.push(...partHands);
  }
  return buildPatternChart({
    slug: stepSlug(routine.slug, bpm),
    title: `${routine.title} · ${bpm} BPM`,
    description: routine.description,
    bpm,
    sections,
    tracks: [{ instrument: routine.instrument, bars, hands }],
  });
}
