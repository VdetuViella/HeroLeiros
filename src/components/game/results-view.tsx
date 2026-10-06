"use client";

import Link from "next/link";
import { ListMusic, RotateCcw, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AttemptResult } from "@/lib/attempts/types";
import { INSTRUMENTS } from "@/lib/chart/instruments";
import { formatNumber, formatPercent } from "@/lib/format";

import { Stars } from "./stars";

const COUNT_ROWS = [
  { key: "perfecto", label: "Perfecto", hint: "±35 ms", className: "text-amber-400" },
  { key: "bien", label: "Bien", hint: "±70 ms", className: "text-green-400" },
  { key: "regular", label: "Regular", hint: "±120 ms", className: "text-sky-400" },
  { key: "fallo", label: "Fallos", hint: "sin tocar", className: "text-red-400" },
  { key: "extra", label: "Golpes de más", hint: "sin nota", className: "text-zinc-400" },
  { key: "carrilEquivocado", label: "Carril equivocado", hint: "otro golpe", className: "text-orange-400" },
] as const;

function headline(result: AttemptResult): string {
  if (result.notesJudged === 0) return "No ha dado tiempo a tocar ninguna nota";
  if (result.stars >= 5) return "¡Impecable!";
  if (result.stars >= 4) return "¡Muy bien tocado!";
  if (result.stars >= 3) return "Buen ensayo";
  if (result.stars >= 2) return "Vas por buen camino";
  return "Sigue practicando";
}

function timingHint(offsetMs: number | null): string | null {
  if (offsetMs === null) return null;
  if (offsetMs > 15) return `De media vas ${offsetMs} ms retrasado. Si pasa siempre, prueba a calibrar la latencia.`;
  if (offsetMs < -15) return `De media vas ${-offsetMs} ms adelantado: espera un poco más cada golpe.`;
  return "Tu tiempo medio está centrado en el pulso.";
}

interface ResultsViewProps {
  result: AttemptResult;
  onReplay: () => void;
  onSettings: () => void;
}

export function ResultsView({ result, onReplay, onSettings }: ResultsViewProps) {
  const hint = timingHint(result.meanOffsetMs);
  const worst = [...result.sections].filter((s) => s.notes > 0).sort((a, b) => a.accuracy - b.accuracy)[0];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-amber-500/20 via-fuchsia-500/10 to-transparent p-6 sm:p-8">
          <p className="text-sm text-muted-foreground">
            {result.songTitle} · {INSTRUMENTS[result.instrument].name} · {Math.round(result.speed * 100)} %
            {result.range.sectionName ? ` · ${result.range.sectionName}` : ` · compases ${result.range.startBar}–${result.range.endBar}`}
          </p>
          <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{headline(result)}</h1>
          <div className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <Stars value={result.stars} />
              <p className="mt-2 font-heading text-6xl font-extrabold tabular-nums">{formatPercent(result.accuracy)}</p>
              <p className="text-sm text-muted-foreground">precisión</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Puntos</dt>
              <dd className="font-semibold tabular-nums">{formatNumber(result.score)}</dd>
              <dt className="text-muted-foreground">Combo máximo</dt>
              <dd className="font-semibold tabular-nums">{result.maxCombo}</dd>
              <dt className="text-muted-foreground">Notas</dt>
              <dd className="font-semibold tabular-nums">{result.notesJudged}</dd>
              {result.loop && (
                <>
                  <dt className="text-muted-foreground">Vueltas</dt>
                  <dd className="font-semibold tabular-nums">{result.passes}</dd>
                </>
              )}
            </dl>
          </div>
          {!result.completed && !result.loop && (
            <p className="mt-4 text-sm text-amber-300">Paraste antes del final: solo cuentan las notas que llegaron a sonar.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Golpes</CardTitle>
            {hint && <CardDescription>{hint}</CardDescription>}
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {COUNT_ROWS.map((row) => (
                <li key={row.key} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {row.label} <span className="text-xs text-muted-foreground">{row.hint}</span>
                  </span>
                  <span className={`font-semibold tabular-nums ${row.className}`}>{result.counts[row.key]}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por sección</CardTitle>
            <CardDescription>
              {worst && worst.accuracy < 0.85
                ? `La que más cuesta: «${worst.name}». Prueba a repetirla en bucle y más lenta.`
                : "Precisión en cada parte de la canción."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sección</TableHead>
                  <TableHead className="text-right">Notas</TableHead>
                  <TableHead className="w-32 text-right">Precisión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.sections.map((section) => (
                  <TableRow key={`${section.name}-${section.startBar}`}>
                    <TableCell>
                      <span className="font-medium">{section.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        c. {section.startBar}–{section.endBar}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{section.notes}</TableCell>
                    <TableCell>
                      {section.notes > 0 ? (
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={section.accuracy * 100} className="w-14" aria-label={`Precisión en ${section.name}`} />
                          <span className="w-10 text-right tabular-nums">{formatPercent(section.accuracy)}</span>
                        </div>
                      ) : (
                        <span className="block text-right text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={onReplay}>
          <RotateCcw /> Repetir
        </Button>
        <Button size="lg" variant="secondary" onClick={onSettings}>
          <SlidersHorizontal /> Cambiar ajustes
        </Button>
        <Button size="lg" variant="ghost" nativeButton={false} render={<Link href="/" />}>
          <ListMusic /> Otras canciones
        </Button>
        <p className="ml-auto text-xs text-muted-foreground">Resultado guardado en este dispositivo.</p>
      </div>
    </div>
  );
}
