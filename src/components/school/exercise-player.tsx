"use client";

import { useMemo, useState } from "react";
import { BookOpen, Lock, PartyPopper } from "lucide-react";

import { SongPlayer } from "@/components/game/song-player";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttemptResult } from "@/lib/attempts/types";
import { INSTRUMENTS } from "@/lib/chart/instruments";
import { LEVELS, findExercise, findRoutine, type Exercise, type Routine } from "@/lib/exercises/catalog";
import { exerciseChart, routineChart } from "@/lib/exercises/chart";
import { UNLOCK_STARS, countsForProgress, exerciseProgress, type StepState } from "@/lib/exercises/progress";
import { cn } from "@/lib/utils";

import { MiniStars } from "./mini-stars";
import { useSchoolProgress } from "./use-school-progress";

const BACK = { href: "/escuela", label: "Escuela" };
/** En los ejercicios el metrónomo va encendido por defecto. */
const EXERCISE_SETTINGS = { metronome: true, countInBars: 1, guide: "baja" as const };

type Item = { kind: "ejercicio"; exercise: Exercise } | { kind: "rutina"; routine: Routine };

function findItem(slug: string): Item | null {
  const exercise = findExercise(slug);
  if (exercise) return { kind: "ejercicio", exercise };
  const routine = findRoutine(slug);
  return routine ? { kind: "rutina", routine } : null;
}

/** La página comprueba antes que el slug existe. */
export function ExercisePlayer({ slug, initialBpm }: { slug: string; initialBpm: number | null }) {
  const item = useMemo(() => findItem(slug) as Item, [slug]);
  const base = item.kind === "ejercicio" ? item.exercise : item.routine;

  const { ready, best, free, addAttempt } = useSchoolProgress();
  // Las rutinas son de calentamiento: todos sus tempos están abiertos.
  const progress = exerciseProgress(base, best, free || item.kind === "rutina");
  const [chosen, setChosen] = useState<number | null>(
    initialBpm !== null && base.tempos.includes(initialBpm) ? initialBpm : null,
  );
  const [unlocked, setUnlocked] = useState<{ bpm: number; next: number | null } | null>(null);

  // En cuanto se conoce el progreso, se fija el tempo: superarlo no debe cambiar
  // de ejercicio a media pantalla de resultados (solo «Ir a…» o elegirlo a mano).
  if (ready && chosen === null) setChosen(progress.current.bpm);

  const chosenStep = chosen === null ? null : progress.steps.find((s) => s.bpm === chosen && s.unlocked);
  const step = chosenStep ?? (ready ? progress.current : progress.steps[0]);
  const bpm = step.bpm;

  const chart = useMemo(
    () => (item.kind === "ejercicio" ? exerciseChart(item.exercise, bpm) : routineChart(item.routine, bpm)),
    [item, bpm],
  );

  const onAttempt = (attempt: AttemptResult) => {
    addAttempt(attempt);
    const index = base.tempos.indexOf(bpm);
    const wasPassed = progress.steps[index]?.passed ?? false;
    if (attempt.instrument === base.instrument && countsForProgress(attempt) && attempt.stars >= UNLOCK_STARS && !wasPassed) {
      setUnlocked({ bpm, next: base.tempos[index + 1] ?? null });
    } else {
      setUnlocked(null);
    }
  };

  const choose = (next: StepState) => {
    if (!next.unlocked) return;
    setChosen(next.bpm);
    setUnlocked(null);
  };

  const intro = (
    <ExerciseIntro item={item} steps={progress.steps} current={bpm} onChoose={choose} ready={ready} />
  );

  const resultsExtra = unlocked && (
    <Card className="border-primary/40 bg-primary/10" data-testid="tempo-desbloqueado">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-1">
        <p className="flex items-center gap-2 font-medium">
          <PartyPopper className="size-5 text-primary" aria-hidden />
          {unlocked.next
            ? `¡Superado a ${unlocked.bpm} BPM! Ya puedes tocarlo a ${unlocked.next} BPM.`
            : `¡Superado a ${unlocked.bpm} BPM, el tempo más alto! Ejercicio completado.`}
        </p>
        {unlocked.next && (
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setChosen(unlocked.next);
              setUnlocked(null);
            }}
          >
            Ir a {unlocked.next} BPM
          </button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <SongPlayer
      key={chart.slug}
      chart={chart}
      onAttemptComplete={onAttempt}
      initialSettings={EXERCISE_SETTINGS}
      backLink={BACK}
      setupIntro={intro}
      resultsExtra={resultsExtra}
    />
  );
}

function ExerciseIntro({
  item,
  steps,
  current,
  onChoose,
  ready,
}: {
  item: Item;
  steps: StepState[];
  current: number;
  onChoose: (step: StepState) => void;
  ready: boolean;
}) {
  const exercise = item.kind === "ejercicio" ? item.exercise : null;
  const routine = item.kind === "rutina" ? item.routine : null;
  const level = exercise ? LEVELS.find((l) => l.family === exercise.family && l.level === exercise.level) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]" data-testid="ficha-ejercicio">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" aria-hidden />
            {exercise ? exercise.focus : "Calentamiento"}
          </CardTitle>
          <CardDescription>
            {INSTRUMENTS[(exercise ?? routine)!.instrument].name}
            {level ? ` · Nivel ${level.level}: ${level.title}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {exercise && (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {exercise.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          )}
          {routine && (
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              {routine.parts.map((part) => (
                <li key={part.exercise}>{findExercise(part.exercise)?.title}</li>
              ))}
            </ol>
          )}
          {exercise?.hands && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">D</span> = mano derecha, <span className="font-medium text-foreground">I</span> =
              izquierda (si eres zurdo, al revés). La letra va dentro de cada nota y encima en la partitura.
            </p>
          )}
          {exercise && (
            <p className="text-xs text-muted-foreground">
              Fuente:{" "}
              {exercise.source.url ? (
                <a href={exercise.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  {exercise.source.label}
                </a>
              ) : (
                exercise.source.label
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Tempo</CardTitle>
          <CardDescription>
            {routine ? "Elige el tempo del calentamiento." : `Saca ${UNLOCK_STARS} estrellas a velocidad normal para abrir el siguiente.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Escalones de tempo">
            {steps.map((step) => (
              <li key={step.bpm}>
                <button
                  type="button"
                  disabled={!step.unlocked}
                  aria-pressed={step.bpm === current}
                  aria-label={`${step.bpm} BPM${step.unlocked ? "" : " (cerrado)"}`}
                  onClick={() => onChoose(step)}
                  className={cn(
                    "flex w-full flex-col items-center gap-1 rounded-lg border px-2 py-2 text-sm transition-colors",
                    step.bpm === current ? "border-primary bg-primary/15 ring-1 ring-primary" : "border-border hover:border-primary/60",
                    !step.unlocked && "cursor-not-allowed opacity-50 hover:border-border",
                  )}
                >
                  <span className="flex items-center gap-1 font-semibold tabular-nums">
                    {!step.unlocked && <Lock className="size-3" aria-hidden />}
                    {step.bpm}
                  </span>
                  {ready && <MiniStars value={step.stars} className="[&_svg]:size-3" />}
                </button>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
