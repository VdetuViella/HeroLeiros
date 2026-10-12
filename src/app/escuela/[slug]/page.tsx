import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExercisePlayer } from "@/components/school/exercise-player";
import { EXERCISES, ROUTINES, findExercise, findRoutine } from "@/lib/exercises/catalog";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ bpm?: string | string[] }>;

export function generateStaticParams() {
  return [...EXERCISES, ...ROUTINES].map(({ slug }) => ({ slug }));
}

function titleOf(slug: string): string | null {
  return findExercise(slug)?.title ?? findRoutine(slug)?.title ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  return { title: titleOf(slug) ?? "Ejercicio no encontrado" };
}

export default async function ExercisePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  if (!titleOf(slug)) notFound();
  const { bpm } = await searchParams;
  const parsed = Number(Array.isArray(bpm) ? bpm[0] : bpm);
  return <ExercisePlayer slug={slug} initialBpm={Number.isFinite(parsed) && parsed > 0 ? parsed : null} />;
}
