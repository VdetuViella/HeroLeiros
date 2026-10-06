import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, Disc3, Music, Target, Users } from "lucide-react";

import { AccountsUnavailable } from "@/components/account/accounts-unavailable";
import { Stars } from "@/components/game/stars";
import { AccuracyBadge } from "@/components/progress/accuracy-badge";
import { AccuracyChart } from "@/components/progress/accuracy-chart";
import { formatDateTime, formatPracticeTime, formatRelative, formatSpeed } from "@/components/progress/format";
import { StatCard } from "@/components/progress/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INSTRUMENTS } from "@/lib/chart/instruments";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDb, isDatabaseConfigured } from "@/server/db/client";
import { getCurrentUser } from "@/server/current-user";
import { memberGroups } from "@/server/groups/service";
import { accuracyTrend, memberBests, memberHistory, memberSummary } from "@/server/progress/queries";

export const metadata: Metadata = { title: "Mi progreso" };

export default async function ProgressPage({ searchParams }: PageProps<"/progreso">) {
  if (!isDatabaseConfigured()) return <AccountsUnavailable />;
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?volver=/progreso");

  const { cancion } = await searchParams;
  const songFilter = typeof cancion === "string" ? cancion : undefined;
  const db = getDb();
  const [summary, bests, trend, history, groups] = await Promise.all([
    memberSummary(db, user.id),
    memberBests(db, user.id),
    accuracyTrend(db, user.id, { songSlug: songFilter, days: 60 }),
    memberHistory(db, user.id, 25),
    memberGroups(db, user.id),
  ]);
  const songs = [...new Map(bests.map((b) => [b.songSlug, b.songTitle])).entries()];
  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Mi progreso</p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">Hola, {user.name.split(" ")[0]}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden />
            {groups.length === 0 ? (
              <span>Aún no estás en ningún grupo: pide a tu director el enlace de invitación.</span>
            ) : (
              groups.map((g) => (
                <Badge key={g.id} variant="outline">
                  {g.name} · dirige {g.directorName}
                </Badge>
              ))
            )}
          </div>
        </div>
        <Button nativeButton={false} render={<Link href="/" />}>
          Practicar una canción <ArrowRight data-icon="inline-end" aria-hidden />
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen">
        <StatCard icon={Disc3} label="Partidas" value={formatNumber(summary.attempts)} />
        <StatCard icon={Music} label="Canciones" value={formatNumber(summary.songs)} />
        <StatCard
          icon={Target}
          label="Precisión media"
          value={summary.meanAccuracy === null ? "—" : formatPercent(summary.meanAccuracy)}
        />
        <StatCard
          icon={Clock}
          label="Tiempo tocando"
          value={formatPracticeTime(summary.practiceSeconds)}
          hint={summary.lastPlayedAt ? `Última partida ${formatRelative(summary.lastPlayedAt, now)}` : undefined}
        />
      </section>

      {summary.attempts === 0 ? (
        <Card className="items-center py-12 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <Disc3 className="size-10 text-muted-foreground" aria-hidden />
            <p className="font-medium">Todavía no hay partidas en tu cuenta</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Elige una canción y tu instrumento y toca hasta el final: cada partida aparecerá aquí con tu precisión
              por sección.
            </p>
            <Button nativeButton={false} render={<Link href="/" />}>
              Ver canciones
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="font-heading text-lg">Evolución de la precisión</CardTitle>
                <CardDescription>Últimos 60 días, por día de ensayo.</CardDescription>
              </div>
              <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar por canción">
                {[["", "Todas"] as const, ...songs].map(([slug, title]) => {
                  const active = (songFilter ?? "") === slug;
                  return (
                    <Link
                      key={slug || "todas"}
                      href={slug ? `/progreso?cancion=${slug}` : "/progreso"}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {title}
                    </Link>
                  );
                })}
              </nav>
            </CardHeader>
            <CardContent>
              {trend.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin partidas en los últimos 60 días.</p>
              ) : (
                <AccuracyChart points={trend} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Mejores marcas</CardTitle>
              <CardDescription>Tu mejor precisión en cada canción con cada instrumento.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canción</TableHead>
                    <TableHead>Instrumento</TableHead>
                    <TableHead className="text-right">Precisión</TableHead>
                    <TableHead className="hidden sm:table-cell">Estrellas</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Velocidad</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Partidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bests.map((b) => (
                    <TableRow key={`${b.songSlug}-${b.instrument}`}>
                      <TableCell className="font-medium">
                        <Link href={`/canciones/${b.songSlug}`} className="hover:text-primary">
                          {b.songTitle}
                        </Link>
                      </TableCell>
                      <TableCell>{INSTRUMENTS[b.instrument]?.name ?? b.instrument}</TableCell>
                      <TableCell className="text-right">
                        <AccuracyBadge accuracy={b.accuracy} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Stars value={b.stars} className="gap-0.5 [&_svg]:size-4" />
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{formatSpeed(b.speed)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{b.attempts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Historial</CardTitle>
              <CardDescription>Tus últimas {history.length} partidas.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuándo</TableHead>
                    <TableHead>Canción</TableHead>
                    <TableHead className="hidden md:table-cell">Tramo</TableHead>
                    <TableHead className="text-right">Precisión</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Puntos</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">Combo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground" title={formatDateTime(h.finishedAt)}>
                        {formatRelative(h.finishedAt, now)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{h.songTitle}</span>
                        <span className="block text-xs text-muted-foreground">
                          {INSTRUMENTS[h.instrument]?.name ?? h.instrument} · {formatSpeed(h.speed)}
                          {!h.completed && " · sin terminar"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {h.sectionName ?? `Compases ${h.startBar}–${h.endBar}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <AccuracyBadge accuracy={h.accuracy} />
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatNumber(h.score)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{h.maxCombo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
