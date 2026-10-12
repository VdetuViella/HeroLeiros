"use client";

import Link from "next/link";
import { ArrowRight, Check, Lock, Play, Repeat } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { INSTRUMENTS } from "@/lib/chart/instruments";
import { FAMILY_NAMES, ROUTINES, exercisesOf, levelsOf, type Exercise, type ExerciseFamily } from "@/lib/exercises/catalog";
import { exerciseProgress, levelProgress, nextExercise, type BestStars } from "@/lib/exercises/progress";
import { cn } from "@/lib/utils";

import { MiniStars } from "./mini-stars";
import { useSchoolProgress } from "./use-school-progress";

const FAMILIES: ExerciseFamily[] = ["caixa", "surdo"];

export function SchoolOverview() {
  const { ready, best, free, setFree } = useSchoolProgress();

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Saca <span className="font-medium text-foreground">3 estrellas</span> a velocidad normal para abrir el siguiente tempo.
          Supera la mitad de un nivel para abrir el siguiente.
        </p>
        <div className="flex items-center gap-2">
          <Switch id="modo-libre" checked={free} onCheckedChange={setFree} />
          <Label htmlFor="modo-libre">Modo libre (todo abierto)</Label>
        </div>
      </div>

      <section aria-labelledby="rutinas" className="space-y-3">
        <h2 id="rutinas" className="font-heading text-2xl font-bold tracking-tight">
          Rutinas de calentamiento
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {ROUTINES.map((routine) => {
            const progress = exerciseProgress(routine, best, true);
            return (
              <li key={routine.slug}>
                <Link
                  href={`/escuela/${routine.slug}`}
                  className="group block h-full rounded-xl focus-visible:outline-none"
                  data-testid={`ejercicio-${routine.slug}`}
                >
                  <Card size="sm" className="h-full transition-colors group-hover:ring-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-primary">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Repeat className="size-4 text-primary" aria-hidden /> {routine.title}
                      </CardTitle>
                      <CardDescription>{routine.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {INSTRUMENTS[routine.instrument].name} · {routine.parts.length} ejercicios ·{" "}
                        {routine.tempos[0]}–{routine.tempos[routine.tempos.length - 1]} BPM
                      </span>
                      {ready && progress.bestStars > 0 && <MiniStars value={progress.bestStars} />}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {FAMILIES.map((family) => (
        <FamilySection key={family} family={family} best={best} free={free} ready={ready} />
      ))}
    </div>
  );
}

function FamilySection({ family, best, free, ready }: { family: ExerciseFamily; best: BestStars; free: boolean; ready: boolean }) {
  const levels = levelProgress(family, best, free);
  const next = ready ? nextExercise(family, best, free) : null;

  return (
    <section aria-labelledby={`familia-${family}`} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={`familia-${family}`} className="font-heading text-2xl font-bold tracking-tight">
          {FAMILY_NAMES[family]}
        </h2>
        {next && (
          <Button size="sm" nativeButton={false} render={<Link href={`/escuela/${next.exercise.slug}?bpm=${next.step.bpm}`} />}>
            <Play /> Siguiente: {next.exercise.title} a {next.step.bpm} BPM
          </Button>
        )}
      </div>

      {levelsOf(family).map((info) => {
        const state = levels.find((l) => l.level === info.level);
        const unlocked = state?.unlocked ?? true;
        return (
          <div key={info.level} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-heading text-lg font-semibold">
                Nivel {info.level} · {info.title}
              </h3>
              {state && (
                <span className="text-xs text-muted-foreground">
                  {unlocked ? `${state.passed} de ${state.total} superados` : "Cerrado"}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{info.description}</p>
            {!unlocked && state && (
              <p className="flex items-center gap-1.5 text-xs text-amber-300">
                <Lock className="size-3.5" aria-hidden /> Supera {levels.find((l) => l.level === info.level - 1)?.needed ?? 1} ejercicios
                del nivel {info.level - 1} para abrirlo (o activa el modo libre).
              </p>
            )}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {exercisesOf(family, info.level).map((exercise) => (
                <li key={exercise.slug}>
                  <ExerciseCard exercise={exercise} best={best} free={free} unlocked={unlocked} ready={ready} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function ExerciseCard({
  exercise,
  best,
  free,
  unlocked,
  ready,
}: {
  exercise: Exercise;
  best: BestStars;
  free: boolean;
  unlocked: boolean;
  ready: boolean;
}) {
  const progress = exerciseProgress(exercise, best, free);
  const body = (
    <Card
      size="sm"
      className={cn(
        "h-full transition-colors",
        unlocked ? "group-hover:ring-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-primary" : "opacity-55",
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{exercise.title}</span>
          {!unlocked ? (
            <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Cerrado" />
          ) : progress.complete ? (
            <Badge variant="secondary">
              <Check /> Completado
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>{exercise.focus}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {INSTRUMENTS[exercise.instrument].name} · {exercise.tempos[0]}–{exercise.tempos[exercise.tempos.length - 1]} BPM
          </span>
          {ready && progress.bestStars > 0 && <MiniStars value={progress.bestStars} />}
        </div>
        <Progress
          value={(progress.passed / progress.steps.length) * 100}
          aria-label={`${progress.passed} de ${progress.steps.length} tempos superados`}
        />
        <p className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {progress.topBpm ? `Superado hasta ${progress.topBpm} BPM` : "Sin empezar"} · {progress.passed}/{progress.steps.length}
          </span>
          {unlocked && <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />}
        </p>
      </CardContent>
    </Card>
  );

  if (!unlocked) return <div aria-disabled>{body}</div>;
  return (
    <Link
      href={`/escuela/${exercise.slug}`}
      className="group block h-full rounded-xl focus-visible:outline-none"
      data-testid={`ejercicio-${exercise.slug}`}
    >
      {body}
    </Link>
  );
}
