import type { AttemptResult } from "../attempts/types";
import type { InstrumentId } from "../chart/types";
import { EXERCISES, levelsOf, type Exercise, type ExerciseFamily } from "./catalog";
import { stepSlug } from "./chart";

/** Estrellas para pasar al siguiente escalón de tempo. */
export const UNLOCK_STARS = 3;
/** Parte de los ejercicios de un nivel que hay que superar para abrir el siguiente. */
export const LEVEL_UNLOCK_FRACTION = 0.5;

/** Mejores estrellas por escalón (slug del chart) e instrumento. */
export type BestStars = (slug: string, instrument: InstrumentId) => number;

/**
 * Una partida cuenta para el progreso si se tocó a velocidad normal y entera
 * (o al menos una vuelta completa en bucle). Bajar la velocidad sirve para
 * practicar, pero no desbloquea ese tempo.
 */
export function countsForProgress(attempt: AttemptResult): boolean {
  const fullSpeed = attempt.speed >= 0.999;
  const whole = attempt.loop ? attempt.passes >= 1 : attempt.completed;
  return fullSpeed && whole && attempt.notesJudged > 0;
}

export function bestStarsFrom(attempts: readonly AttemptResult[]): BestStars {
  const best = new Map<string, number>();
  for (const attempt of attempts) {
    if (!countsForProgress(attempt)) continue;
    const key = `${attempt.songSlug}|${attempt.instrument}`;
    best.set(key, Math.max(best.get(key) ?? 0, attempt.stars));
  }
  return (slug, instrument) => best.get(`${slug}|${instrument}`) ?? 0;
}

export interface StepState {
  bpm: number;
  slug: string;
  stars: number;
  unlocked: boolean;
  passed: boolean;
}

/** Escalones de tempo: el primero siempre abierto; cada uno abre el siguiente con 3 estrellas. */
export function stepsOf(
  item: { slug: string; tempos: number[]; instrument: InstrumentId },
  best: BestStars,
  free = false,
): StepState[] {
  let previousPassed = true;
  return item.tempos.map((bpm) => {
    const slug = stepSlug(item.slug, bpm);
    const stars = best(slug, item.instrument);
    const passed = stars >= UNLOCK_STARS;
    const state = { bpm, slug, stars, unlocked: free || previousPassed, passed };
    previousPassed = passed;
    return state;
  });
}

export interface ExerciseProgress {
  steps: StepState[];
  /** Escalones superados. */
  passed: number;
  /** Mejores estrellas en cualquier escalón. */
  bestStars: number;
  /** El tempo más alto superado, o `null`. */
  topBpm: number | null;
  /** Escalón que toca practicar: el primero abierto sin superar (o el último si están todos). */
  current: StepState;
  complete: boolean;
}

export function exerciseProgress(exercise: Pick<Exercise, "slug" | "tempos" | "instrument">, best: BestStars, free = false): ExerciseProgress {
  const steps = stepsOf(exercise, best, free);
  const passedSteps = steps.filter((s) => s.passed);
  const current = steps.find((s) => s.unlocked && !s.passed) ?? steps[steps.length - 1];
  return {
    steps,
    passed: passedSteps.length,
    bestStars: Math.max(0, ...steps.map((s) => s.stars)),
    topBpm: passedSteps.length > 0 ? passedSteps[passedSteps.length - 1].bpm : null,
    current,
    complete: passedSteps.length === steps.length,
  };
}

/** Un ejercicio cuenta como superado para abrir niveles en cuanto pasa su primer escalón. */
function exercisePassed(exercise: Exercise, best: BestStars): boolean {
  return exerciseProgress(exercise, best).passed > 0;
}

export interface LevelProgress {
  level: number;
  unlocked: boolean;
  passed: number;
  total: number;
  /** Ejercicios superados que hacen falta para abrir el nivel siguiente. */
  needed: number;
}

export function levelProgress(family: ExerciseFamily, best: BestStars, free = false): LevelProgress[] {
  let previousOk = true;
  return levelsOf(family).map(({ level }) => {
    const exercises = EXERCISES.filter((e) => e.family === family && e.level === level);
    const passed = exercises.filter((e) => exercisePassed(e, best)).length;
    const needed = Math.ceil(exercises.length * LEVEL_UNLOCK_FRACTION);
    const state = { level, unlocked: free || previousOk, passed, total: exercises.length, needed };
    previousOk = state.unlocked && passed >= needed;
    return state;
  });
}

/** Lo siguiente que conviene tocar: el primer ejercicio abierto con escalones por superar. */
export function nextExercise(family: ExerciseFamily, best: BestStars, free = false): { exercise: Exercise; step: StepState } | null {
  const levels = levelProgress(family, best, free);
  for (const level of levels) {
    if (!level.unlocked) continue;
    for (const exercise of EXERCISES.filter((e) => e.family === family && e.level === level.level)) {
      const progress = exerciseProgress(exercise, best, free);
      if (!progress.complete) return { exercise, step: progress.current };
    }
  }
  return null;
}
