import { randomBytes } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";

import { groups, memberships, users, type GroupRow } from "../db/schema";
import type { Db } from "../db/types";
import type { SessionUser } from "../session";

const INVITE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Código legible (sin 0/O, 1/l/i) de 10 caracteres: ~49 bits de azar. */
export function generateInviteCode(): string {
  const bytes = randomBytes(10);
  let code = "";
  for (const byte of bytes) code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
  return code;
}

export function normalizeGroupName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Crea un grupo dirigido por `user` y le da el rol de director. */
export async function createGroup(db: Db, user: SessionUser, name: string): Promise<GroupRow> {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({ name: normalizeGroupName(name), directorId: user.id, inviteCode: generateInviteCode() })
      .returning();
    if (user.role !== "director") {
      await tx.update(users).set({ role: "director" }).where(eq(users.id, user.id));
    }
    return group;
  });
}

export async function directorGroups(db: Db, userId: string) {
  return db
    .select({
      id: groups.id,
      name: groups.name,
      inviteCode: groups.inviteCode,
      createdAt: groups.createdAt,
      members: sql<number>`(select count(*)::int from ${memberships} where ${memberships.groupId} = ${groups.id})`,
    })
    .from(groups)
    .where(eq(groups.directorId, userId))
    .orderBy(asc(groups.createdAt));
}

export async function memberGroups(db: Db, userId: string) {
  return db
    .select({ id: groups.id, name: groups.name, directorName: users.name, joinedAt: memberships.joinedAt })
    .from(memberships)
    .innerJoin(groups, eq(groups.id, memberships.groupId))
    .innerJoin(users, eq(users.id, groups.directorId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.joinedAt));
}

export async function findGroupByInvite(db: Db, code: string) {
  const [row] = await db
    .select({ id: groups.id, name: groups.name, directorId: groups.directorId, directorName: users.name })
    .from(groups)
    .innerJoin(users, eq(users.id, groups.directorId))
    .where(eq(groups.inviteCode, code.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

export type JoinOutcome =
  | { kind: "unido"; groupId: string; groupName: string }
  | { kind: "ya-miembro"; groupId: string; groupName: string }
  | { kind: "es-director"; groupId: string; groupName: string }
  | { kind: "no-existe" };

export async function joinGroupByInvite(db: Db, user: SessionUser, code: string): Promise<JoinOutcome> {
  const group = await findGroupByInvite(db, code);
  if (!group) return { kind: "no-existe" };
  const base = { groupId: group.id, groupName: group.name };
  if (group.directorId === user.id) return { kind: "es-director", ...base };
  const inserted = await db
    .insert(memberships)
    .values({ groupId: group.id, userId: user.id })
    .onConflictDoNothing()
    .returning({ id: memberships.id });
  return { kind: inserted.length > 0 ? "unido" : "ya-miembro", ...base };
}

/** Nuevo código de invitación; el anterior deja de funcionar. `null` si el grupo no es de `userId`. */
export async function regenerateInvite(db: Db, userId: string, groupId: string): Promise<string | null> {
  const [row] = await db
    .update(groups)
    .set({ inviteCode: generateInviteCode() })
    .where(and(eq(groups.id, groupId), eq(groups.directorId, userId)))
    .returning({ inviteCode: groups.inviteCode });
  return row?.inviteCode ?? null;
}

export async function isGroupDirector(db: Db, userId: string, groupId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.directorId, userId)))
    .limit(1);
  return Boolean(row);
}
