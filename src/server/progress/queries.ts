import { and, desc, eq, gt, gte, sql } from "drizzle-orm";

import type { InstrumentId } from "../../lib/chart/types";
import { attempts, memberships, users } from "../db/schema";
import type { Db } from "../db/types";

/** Zona horaria para agrupar por día (el grupo ensaya en España). */
export const DEFAULT_TIME_ZONE = "Europe/Madrid";

const judged = gt(attempts.notesJudged, 0);

function rowsOf<T>(result: unknown): T[] {
  // node-postgres devuelve `{ rows }`; PGlite también. Normaliza ambos.
  return ((result as { rows?: T[] }).rows ?? (result as T[])) as T[];
}

// ─── Miembro ────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  songSlug: string;
  songTitle: string;
  instrument: InstrumentId;
  sectionName: string | null;
  startBar: number;
  endBar: number;
  speed: number;
  score: number;
  accuracy: number;
  stars: number;
  maxCombo: number;
  completed: boolean;
  finishedAt: Date;
}

export async function memberHistory(db: Db, userId: string, limit = 30): Promise<HistoryEntry[]> {
  return db
    .select({
      id: attempts.id,
      songSlug: attempts.songSlug,
      songTitle: attempts.songTitle,
      instrument: attempts.instrument,
      sectionName: attempts.sectionName,
      startBar: attempts.startBar,
      endBar: attempts.endBar,
      speed: attempts.speed,
      score: attempts.score,
      accuracy: attempts.accuracy,
      stars: attempts.stars,
      maxCombo: attempts.maxCombo,
      completed: attempts.completed,
      finishedAt: attempts.finishedAt,
    })
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .orderBy(desc(attempts.finishedAt))
    .limit(limit);
}

export interface BestRecord {
  songSlug: string;
  songTitle: string;
  instrument: InstrumentId;
  accuracy: number;
  score: number;
  stars: number;
  speed: number;
  achievedAt: Date;
  attempts: number;
  lastPlayedAt: Date;
}

/** Mejor marca (precisión, luego puntuación) por canción e instrumento. */
export async function memberBests(db: Db, userId: string): Promise<BestRecord[]> {
  const result = await db.execute(sql`
    select distinct on (song_slug, instrument)
      song_slug as "songSlug",
      song_title as "songTitle",
      instrument,
      accuracy,
      score,
      stars,
      speed,
      finished_at as "achievedAt",
      (count(*) over w)::int as "attempts",
      max(finished_at) over w as "lastPlayedAt"
    from ${attempts}
    where user_id = ${userId} and notes_judged > 0
    window w as (partition by song_slug, instrument)
    order by song_slug, instrument, accuracy desc, score desc, finished_at asc
  `);
  return rowsOf<BestRecord>(result).map((r) => ({
    ...r,
    attempts: Number(r.attempts),
    achievedAt: new Date(r.achievedAt),
    lastPlayedAt: new Date(r.lastPlayedAt),
  }));
}

export interface TrendPoint {
  /** Día local `YYYY-MM-DD`. */
  day: string;
  attempts: number;
  meanAccuracy: number;
  bestAccuracy: number;
}

export interface TrendFilter {
  songSlug?: string;
  instrument?: InstrumentId;
  days?: number;
  timeZone?: string;
  now?: Date;
}

/** Evolución de la precisión: media y mejor por día en los últimos `days` días. */
export async function accuracyTrend(db: Db, userId: string, filter: TrendFilter = {}): Promise<TrendPoint[]> {
  const days = filter.days ?? 60;
  const tz = filter.timeZone ?? DEFAULT_TIME_ZONE;
  const since = new Date((filter.now ?? new Date()).getTime() - days * 86_400_000);
  const dayExpr = sql<string>`to_char(${attempts.finishedAt} at time zone ${tz}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day: dayExpr,
      attempts: sql<number>`count(*)::int`,
      meanAccuracy: sql<number>`avg(${attempts.accuracy})::float8`,
      bestAccuracy: sql<number>`max(${attempts.accuracy})::float8`,
    })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        judged,
        gte(attempts.finishedAt, since),
        filter.songSlug ? eq(attempts.songSlug, filter.songSlug) : undefined,
        filter.instrument ? eq(attempts.instrument, filter.instrument) : undefined,
      ),
    )
    // Por posición: el parámetro de la zona horaria se repetiría con otro número y Postgres no los igualaría.
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.map((r) => ({ ...r, meanAccuracy: Number(r.meanAccuracy), bestAccuracy: Number(r.bestAccuracy) }));
}

export interface MemberSummary {
  attempts: number;
  songs: number;
  meanAccuracy: number | null;
  practiceSeconds: number;
  lastPlayedAt: Date | null;
}

export async function memberSummary(db: Db, userId: string): Promise<MemberSummary> {
  const [row] = await db
    .select({
      attempts: sql<number>`count(*)::int`,
      songs: sql<number>`count(distinct ${attempts.songSlug})::int`,
      meanAccuracy: sql<number | null>`avg(${attempts.accuracy}) filter (where ${attempts.notesJudged} > 0)`,
      practiceSeconds: sql<number>`coalesce(sum(extract(epoch from ${attempts.finishedAt} - ${attempts.startedAt})), 0)`,
      lastPlayedAt: sql<Date | null>`max(${attempts.finishedAt})`,
    })
    .from(attempts)
    .where(eq(attempts.userId, userId));
  return {
    attempts: row.attempts,
    songs: row.songs,
    meanAccuracy: row.meanAccuracy === null ? null : Number(row.meanAccuracy),
    practiceSeconds: Math.round(Number(row.practiceSeconds)),
    lastPlayedAt: row.lastPlayedAt ? new Date(row.lastPlayedAt) : null,
  };
}

// ─── Director ───────────────────────────────────────────────────────────────

export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  joinedAt: Date;
  attempts: number;
  lastPlayedAt: Date | null;
  /** Instrumento con más partidas, si ha jugado. */
  mainInstrument: InstrumentId | null;
}

export async function groupMembers(db: Db, groupId: string): Promise<GroupMember[]> {
  const result = await db.execute(sql`
    select
      u.id as "userId",
      u.name,
      u.email,
      m.joined_at as "joinedAt",
      count(a.id)::int as "attempts",
      max(a.finished_at) as "lastPlayedAt",
      mode() within group (order by a.instrument) as "mainInstrument"
    from ${memberships} m
    join ${users} u on u.id = m.user_id
    left join ${attempts} a on a.user_id = u.id
    where m.group_id = ${groupId}
    group by u.id, u.name, u.email, m.joined_at
    order by lower(u.name)
  `);
  return rowsOf<GroupMember>(result).map((r) => ({
    ...r,
    attempts: Number(r.attempts),
    joinedAt: new Date(r.joinedAt),
    lastPlayedAt: r.lastPlayedAt ? new Date(r.lastPlayedAt) : null,
  }));
}

export interface MatrixCell {
  userId: string;
  songSlug: string;
  songTitle: string;
  /** Instrumento con el que logró la mejor precisión. */
  instrument: InstrumentId;
  accuracy: number;
  speed: number;
  attempts: number;
  achievedAt: Date;
}

/** Mejor precisión de cada miembro en cada canción (con cualquier instrumento). */
export async function groupBestMatrix(db: Db, groupId: string): Promise<MatrixCell[]> {
  const result = await db.execute(sql`
    select distinct on (a.user_id, a.song_slug)
      a.user_id as "userId",
      a.song_slug as "songSlug",
      a.song_title as "songTitle",
      a.instrument,
      a.accuracy,
      a.speed,
      (count(*) over w)::int as "attempts",
      a.finished_at as "achievedAt"
    from ${attempts} a
    join ${memberships} m on m.user_id = a.user_id and m.group_id = ${groupId}
    where a.notes_judged > 0
    window w as (partition by a.user_id, a.song_slug)
    order by a.user_id, a.song_slug, a.accuracy desc, a.score desc, a.finished_at asc
  `);
  return rowsOf<MatrixCell>(result).map((r) => ({
    ...r,
    attempts: Number(r.attempts),
    achievedAt: new Date(r.achievedAt),
  }));
}

export interface ActivityEntry {
  attemptId: string;
  userId: string;
  userName: string;
  songSlug: string;
  songTitle: string;
  instrument: InstrumentId;
  sectionName: string | null;
  accuracy: number;
  stars: number;
  speed: number;
  completed: boolean;
  finishedAt: Date;
}

export async function groupRecentActivity(db: Db, groupId: string, limit = 12): Promise<ActivityEntry[]> {
  return db
    .select({
      attemptId: attempts.id,
      userId: users.id,
      userName: users.name,
      songSlug: attempts.songSlug,
      songTitle: attempts.songTitle,
      instrument: attempts.instrument,
      sectionName: attempts.sectionName,
      accuracy: attempts.accuracy,
      stars: attempts.stars,
      speed: attempts.speed,
      completed: attempts.completed,
      finishedAt: attempts.finishedAt,
    })
    .from(attempts)
    .innerJoin(memberships, and(eq(memberships.userId, attempts.userId), eq(memberships.groupId, groupId)))
    .innerJoin(users, eq(users.id, attempts.userId))
    .orderBy(desc(attempts.finishedAt))
    .limit(limit);
}

export interface SectionMisses {
  songSlug: string;
  songTitle: string;
  section: string;
  instrument: InstrumentId;
  misses: number;
  notes: number;
  /** fallos / notas, 0..1. */
  missRate: number;
  players: number;
  attempts: number;
}

/**
 * Secciones (por canción e instrumento) con más fallos del grupo en los
 * últimos `days` días, a partir del desglose por sección de cada intento.
 */
export async function groupSectionMisses(
  db: Db,
  groupId: string,
  options: { days?: number; limit?: number; now?: Date } = {},
): Promise<SectionMisses[]> {
  const since = new Date((options.now ?? new Date()).getTime() - (options.days ?? 30) * 86_400_000);
  const result = await db.execute(sql`
    select
      a.song_slug as "songSlug",
      max(a.song_title) as "songTitle",
      s.value->>'name' as "section",
      a.instrument,
      sum((s.value->'counts'->>'fallo')::int)::int as "misses",
      sum((s.value->>'notes')::int)::int as "notes",
      count(distinct a.user_id)::int as "players",
      count(*)::int as "attempts"
    from ${attempts} a
    join ${memberships} m on m.user_id = a.user_id and m.group_id = ${groupId}
    cross join lateral jsonb_array_elements(a.sections) as s(value)
    where a.finished_at >= ${since.toISOString()}::timestamptz
    group by a.song_slug, s.value->>'name', a.instrument
    having sum((s.value->'counts'->>'fallo')::int) > 0
    order by "misses" desc, "notes" asc, "songSlug", "section"
    limit ${options.limit ?? 8}
  `);
  return rowsOf<Omit<SectionMisses, "missRate">>(result).map((r) => {
    const misses = Number(r.misses);
    const notes = Number(r.notes);
    return {
      ...r,
      misses,
      notes,
      players: Number(r.players),
      attempts: Number(r.attempts),
      missRate: notes > 0 ? Math.min(1, misses / notes) : 0,
    };
  });
}

export interface GroupWeekStats {
  activeMembers: number;
  attempts: number;
  meanAccuracy: number | null;
}

export async function groupWeekStats(db: Db, groupId: string, now = new Date()): Promise<GroupWeekStats> {
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const [row] = await db
    .select({
      activeMembers: sql<number>`count(distinct ${attempts.userId})::int`,
      attempts: sql<number>`count(*)::int`,
      meanAccuracy: sql<number | null>`avg(${attempts.accuracy}) filter (where ${attempts.notesJudged} > 0)`,
    })
    .from(attempts)
    .innerJoin(memberships, and(eq(memberships.userId, attempts.userId), eq(memberships.groupId, groupId)))
    .where(gte(attempts.finishedAt, since));
  return {
    activeMembers: row.activeMembers,
    attempts: row.attempts,
    meanAccuracy: row.meanAccuracy === null ? null : Number(row.meanAccuracy),
  };
}
