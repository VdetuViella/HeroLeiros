import { describe, expect, it } from "vitest";

import type { AttemptResult } from "../attempts/types";
import { quantizeTrack } from "../notation/quantize";
import { EXERCISES, LEVELS, ROUTINES, findExercise, levelsOf } from "./catalog";
import { exerciseChart, routineChart, stepSlug } from "./chart";
import { UNLOCK_STARS, bestStarsFrom, countsForProgress, exerciseProgress, levelProgress, nextExercise, stepsOf } from "./progress";

describe("catálogo de ejercicios", () => {
  it("slugs únicos y válidos, con nivel existente y tempos crecientes", () => {
    const slugs = [...EXERCISES.map((e) => e.slug), ...ROUTINES.map((r) => r.slug)];
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const item of [...EXERCISES, ...ROUTINES]) {
      expect(item.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(item.tempos.length).toBeGreaterThan(0);
      item.tempos.forEach((bpm, i) => i > 0 && expect(bpm).toBeGreaterThan(item.tempos[i - 1]));
      expect(stepSlug(item.slug, item.tempos[item.tempos.length - 1]).length).toBeLessThanOrEqual(120);
    }
    for (const exercise of EXERCISES) {
      expect(LEVELS.some((l) => l.family === exercise.family && l.level === exercise.level)).toBe(true);
      expect(exercise.tips.length).toBeGreaterThan(0);
      expect(exercise.source.label.length).toBeGreaterThan(0);
      if (exercise.hands) expect(exercise.hands).toHaveLength(exercise.bars.length);
    }
  });

  it("hay ejercicios de caixa y de surdo en cada nivel", () => {
    for (const family of ["caixa", "surdo"] as const) {
      const levels = levelsOf(family);
      expect(levels.length).toBeGreaterThan(1);
      for (const level of levels) expect(EXERCISES.some((e) => e.family === family && e.level === level.level)).toBe(true);
    }
  });

  it.each(EXERCISES.map((e) => [e.slug]))("%s: se convierte en chart, con digitación correcta y partitura exacta", (slug) => {
    const exercise = findExercise(slug)!;
    for (const bpm of exercise.tempos) {
      const chart = exerciseChart(exercise, bpm);
      expect(chart.slug).toBe(stepSlug(exercise.slug, bpm));
      expect(chart.bpm).toBe(bpm);
      expect(chart.tracks[0].instrument).toBe(exercise.instrument);
      expect(chart.bars).toBe(exercise.bars.length * exercise.repeat);
      for (const track of chart.tracks) {
        const quantized = quantizeTrack(chart, track);
        expect(quantized.merged).toBe(0);
        expect(quantized.maxOffset).toBeLessThan(1e-6);
      }
    }
    const notes = exerciseChart(exercise, exercise.tempos[0]).tracks[0].notes;
    if (exercise.hands) {
      expect(notes.every((n) => n.hand === "D" || n.hand === "I")).toBe(true);
      // Las digitaciones alternas no repiten mano en semicorcheas seguidas salvo en dobles/paradiddles.
    }
    // Los acompañamientos duran lo mismo que el ejercicio.
    const chart = exerciseChart(exercise, exercise.tempos[0]);
    for (const track of chart.tracks.slice(1)) {
      expect(Math.max(...track.notes.map((n) => n.bar))).toBe(chart.bars);
    }
  });

  it("digitaciones de los rudimentos, como las publica la PAS", () => {
    const sticking = (slug: string) =>
      exerciseChart(findExercise(slug)!, 60)
        .tracks[0].notes.slice(0, 12)
        .map((n) => n.hand)
        .join("");
    expect(sticking("caixa-golpes-sencillos").slice(0, 8)).toBe("DIDIDIDI");
    expect(sticking("caixa-golpes-dobles").slice(0, 8)).toBe("DDIIDDII");
    expect(sticking("caixa-paradiddle").slice(0, 8)).toBe("DIDDIDII");
    expect(sticking("caixa-paradiddle-doble")).toBe("DIDIDDIDIDII");
    expect(sticking("caixa-paradiddle-diddle").slice(0, 6)).toBe("DIDDII");
    expect(sticking("caixa-redoble-de-cinco").slice(0, 10)).toBe("DDIIDIIDDI");
  });

  it("en los ejercicios de acentos, el acento va en su carril y los golpes suaves en otro", () => {
    const chart = exerciseChart(findExercise("caixa-acento-tap")!, 60);
    const caixa = chart.tracks[0];
    expect(caixa.lanes).toEqual(["abierto", "apagado"]);
    expect(caixa.notes.filter((n) => n.accent).every((n) => n.stroke === "abierto")).toBe(true);
    expect(caixa.notes.filter((n) => n.accent)).toHaveLength(chart.bars * 4);
  });

  it.each(ROUTINES.map((r) => [r.slug]))("rutina %s: un ejercicio por sección", (slug) => {
    const routine = ROUTINES.find((r) => r.slug === slug)!;
    const chart = routineChart(routine, routine.tempos[0]);
    expect(chart.sections.map((s) => s.name)).toEqual(routine.parts.map((p) => findExercise(p.exercise)!.title));
    expect(chart.tracks).toHaveLength(1);
    expect(chart.tracks[0].instrument).toBe(routine.instrument);
    const expectedBars = routine.parts.reduce((sum, p) => sum + findExercise(p.exercise)!.bars.length * p.repeat, 0);
    expect(chart.bars).toBe(expectedBars);
    expect(chart.sections[chart.sections.length - 1].endBar).toBe(expectedBars);
    const quantized = quantizeTrack(chart, chart.tracks[0]);
    expect(quantized.merged).toBe(0);
  });
});

function attempt(songSlug: string, stars: number, extra: Partial<AttemptResult> = {}): AttemptResult {
  return {
    songSlug,
    songTitle: songSlug,
    instrument: "caixa",
    speed: 1,
    range: { startBar: 1, endBar: 4, sectionName: null },
    loop: false,
    passes: 1,
    completed: true,
    inputSources: ["teclado"],
    score: 1000,
    accuracy: stars / 5,
    stars,
    maxCombo: 10,
    counts: { perfecto: 0, bien: 0, regular: 0, fallo: 0, extra: 0, carrilEquivocado: 0 },
    notesJudged: 32,
    meanOffsetMs: 0,
    latencyOffsetMs: 0,
    sections: [],
    startedAt: "2026-10-12T00:00:00.000Z",
    finishedAt: "2026-10-12T00:01:00.000Z",
    ...extra,
  };
}

describe("progreso de la Escuela", () => {
  const sencillos = findExercise("caixa-golpes-sencillos")!;

  it("solo cuentan las partidas a velocidad normal y enteras", () => {
    expect(countsForProgress(attempt("x", 4))).toBe(true);
    expect(countsForProgress(attempt("x", 4, { speed: 0.8 }))).toBe(false);
    expect(countsForProgress(attempt("x", 4, { completed: false }))).toBe(false);
    expect(countsForProgress(attempt("x", 4, { loop: true, completed: false, passes: 2 }))).toBe(true);
    expect(countsForProgress(attempt("x", 4, { loop: true, completed: false, passes: 0 }))).toBe(false);
  });

  it("el mejor resultado por escalón e instrumento", () => {
    const best = bestStarsFrom([
      attempt(stepSlug(sencillos.slug, 60), 2),
      attempt(stepSlug(sencillos.slug, 60), 4),
      attempt(stepSlug(sencillos.slug, 60), 5, { speed: 0.5 }),
      attempt(stepSlug(sencillos.slug, 60), 5, { instrument: "surdo1" }),
    ]);
    expect(best(stepSlug(sencillos.slug, 60), "caixa")).toBe(4);
    expect(best(stepSlug(sencillos.slug, 70), "caixa")).toBe(0);
  });

  it("cada escalón abre el siguiente con 3 estrellas", () => {
    const best = bestStarsFrom([attempt(stepSlug(sencillos.slug, 60), UNLOCK_STARS), attempt(stepSlug(sencillos.slug, 70), 2)]);
    const steps = stepsOf(sencillos, best);
    expect(steps.map((s) => s.unlocked)).toEqual([true, true, false, false, false, false]);
    expect(steps.map((s) => s.passed)).toEqual([true, false, false, false, false, false]);
    const progress = exerciseProgress(sencillos, best);
    expect(progress.current.bpm).toBe(70);
    expect(progress.topBpm).toBe(60);
    expect(progress.bestStars).toBe(3);
    expect(stepsOf(sencillos, bestStarsFrom([]), true).every((s) => s.unlocked)).toBe(true);
  });

  it("un nivel se abre al superar la mitad de los ejercicios del anterior", () => {
    const level1 = EXERCISES.filter((e) => e.family === "caixa" && e.level === 1);
    const half = Math.ceil(level1.length / 2);
    const passedSome = bestStarsFrom(level1.slice(0, half - 1).map((e) => attempt(stepSlug(e.slug, e.tempos[0]), 3)));
    expect(levelProgress("caixa", passedSome).map((l) => l.unlocked)).toEqual([true, false, false, false]);
    const passedHalf = bestStarsFrom(level1.slice(0, half).map((e) => attempt(stepSlug(e.slug, e.tempos[0]), 3)));
    expect(levelProgress("caixa", passedHalf).map((l) => l.unlocked)).toEqual([true, true, false, false]);
    expect(levelProgress("caixa", bestStarsFrom([]), true).every((l) => l.unlocked)).toBe(true);
  });

  it("recomienda lo siguiente que tocar", () => {
    expect(nextExercise("caixa", bestStarsFrom([]))?.exercise.slug).toBe("caixa-ocho-por-mano");
    const first = EXERCISES.find((e) => e.slug === "caixa-ocho-por-mano")!;
    const best = bestStarsFrom(first.tempos.map((bpm) => attempt(stepSlug(first.slug, bpm), 5)));
    expect(nextExercise("caixa", best)?.exercise.slug).toBe("caixa-golpes-sencillos");
    expect(nextExercise("surdo", bestStarsFrom([]))?.step.bpm).toBe(60);
  });
});
