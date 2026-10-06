import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Activity, AlertTriangle, Disc3, Target, UserPlus, Users } from "lucide-react";

import { AccountsUnavailable } from "@/components/account/accounts-unavailable";
import { BestMatrix, type MatrixSong } from "@/components/director/best-matrix";
import { CreateGroupForm } from "@/components/director/create-group-form";
import { InviteLink } from "@/components/director/invite-link";
import { AccuracyBadge } from "@/components/progress/accuracy-badge";
import { formatDateTime, formatRelative, formatSpeed } from "@/components/progress/format";
import { StatCard } from "@/components/progress/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { INSTRUMENTS } from "@/lib/chart/instruments";
import { formatNumber, formatPercent } from "@/lib/format";
import { loadAllSongs } from "@/lib/songs/load";
import { cn } from "@/lib/utils";
import { getDb, isDatabaseConfigured } from "@/server/db/client";
import { getCurrentUser } from "@/server/current-user";
import { directorGroups } from "@/server/groups/service";
import {
  groupBestMatrix,
  groupMembers,
  groupRecentActivity,
  groupSectionMisses,
  groupWeekStats,
} from "@/server/progress/queries";

export const metadata: Metadata = { title: "Panel del grupo" };

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.BETTER_AUTH_URL ?? "";
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
}

export default async function DirectorPage({ searchParams }: PageProps<"/director">) {
  if (!isDatabaseConfigured()) return <AccountsUnavailable />;
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?volver=/director");

  const db = getDb();
  const groups = await directorGroups(db, user.id);

  if (groups.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Crea tu grupo</CardTitle>
            <CardDescription>
              Como director/a podrás invitar a los integrantes con un enlace y ver su mejor precisión en cada canción, la
              actividad reciente y las secciones donde más fallan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateGroupForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { grupo } = await searchParams;
  const group = groups.find((g) => g.id === grupo) ?? groups[0];
  const [members, cells, recent, misses, week, repertoire, origin] = await Promise.all([
    groupMembers(db, group.id),
    groupBestMatrix(db, group.id),
    groupRecentActivity(db, group.id, 10),
    groupSectionMisses(db, group.id, { days: 30, limit: 6 }),
    groupWeekStats(db, group.id),
    loadAllSongs(),
    requestOrigin(),
  ]);

  const songs: MatrixSong[] = repertoire.map(({ chart }) => ({ slug: chart.slug, title: chart.title }));
  for (const cell of cells) {
    if (!songs.some((s) => s.slug === cell.songSlug)) songs.push({ slug: cell.songSlug, title: cell.songTitle });
  }
  const inviteUrl = `${origin}/unirse/${group.inviteCode}`;
  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Panel del director</p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {group.members === 1 ? "1 integrante" : `${group.members} integrantes`}
          </p>
          {groups.length > 1 && (
            <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Tus grupos">
              {groups.map((g) => (
                <Link
                  key={g.id}
                  href={`/director?grupo=${g.id}`}
                  aria-current={g.id === group.id ? "page" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    g.id === group.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  {g.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <Card size="sm" className="w-full lg:max-w-md">
          <CardContent className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <UserPlus className="size-4 text-primary" aria-hidden />
              Enlace de invitación
            </p>
            <InviteLink groupId={group.id} url={inviteUrl} />
            <p className="text-xs text-muted-foreground">Quien lo abra podrá crear su cuenta y entrar en el grupo.</p>
          </CardContent>
        </Card>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Últimos 7 días">
        <StatCard icon={Users} label="Integrantes" value={formatNumber(members.length)} />
        <StatCard
          icon={Activity}
          label="Activos esta semana"
          value={`${week.activeMembers} de ${members.length}`}
        />
        <StatCard icon={Disc3} label="Partidas esta semana" value={formatNumber(week.attempts)} />
        <StatCard
          icon={Target}
          label="Precisión media (7 días)"
          value={week.meanAccuracy === null ? "—" : formatPercent(week.meanAccuracy)}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Mejor precisión por canción</CardTitle>
          <CardDescription>
            La mejor partida de cada integrante en cada canción, con el instrumento y la velocidad a la que la logró.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-4">
          {members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Users className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">Todavía no hay nadie en el grupo</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Comparte el enlace de invitación por el chat del grupo. Las partidas de cada integrante aparecerán aquí.
              </p>
            </div>
          ) : (
            <BestMatrix members={members} songs={songs} cells={cells} now={now} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-lg">
              <AlertTriangle className="size-4 text-amber-400" aria-hidden />
              Secciones con más fallos
            </CardTitle>
            <CardDescription>Últimos 30 días, por canción e instrumento. Buen punto de partida para el próximo ensayo.</CardDescription>
          </CardHeader>
          <CardContent>
            {misses.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin fallos registrados en los últimos 30 días.</p>
            ) : (
              <ol className="space-y-4">
                {misses.map((m) => (
                  <li key={`${m.songSlug}-${m.section}-${m.instrument}`} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-sm">
                        <span className="font-medium">{m.section}</span>
                        <span className="text-muted-foreground"> · {m.songTitle}</span>
                      </p>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-red-300">
                        {formatNumber(m.misses)} fallos
                      </span>
                    </div>
                    <Progress value={Math.round(m.missRate * 100)} className="[&_[data-slot=progress-indicator]]:bg-red-400" aria-label={`${formatPercent(m.missRate)} de notas falladas`} />
                    <p className="text-xs text-muted-foreground">
                      {INSTRUMENTS[m.instrument]?.name ?? m.instrument} · {formatPercent(m.missRate)} de las notas ·{" "}
                      {m.players === 1 ? "1 persona" : `${m.players} personas`} · {m.attempts}{" "}
                      {m.attempts === 1 ? "partida" : "partidas"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-lg">
              <Activity className="size-4 text-primary" aria-hidden />
              Actividad reciente
            </CardTitle>
            <CardDescription>Las últimas partidas del grupo.</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nadie ha jugado todavía.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {recent.map((r) => (
                  <li key={r.attemptId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        <span className="font-medium">{r.userName}</span>
                        <span className="text-muted-foreground"> · {r.songTitle}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground" title={formatDateTime(r.finishedAt)}>
                        {INSTRUMENTS[r.instrument]?.name ?? r.instrument}
                        {r.sectionName && ` · ${r.sectionName}`}
                        {r.speed < 1 && ` · ${formatSpeed(r.speed)}`} · {formatRelative(r.finishedAt, now)}
                      </p>
                    </div>
                    <AccuracyBadge accuracy={r.accuracy} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
