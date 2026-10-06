import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  doublePrecision,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { AttemptSectionResult } from "../../lib/attempts/types";
import type { InstrumentId } from "../../lib/chart/types";
import type { InputSourceKind } from "../../lib/input/types";
import type { JudgementCounts } from "../../lib/judge/types";

export const ROLES = ["director", "miembro"] as const;
export type Role = (typeof ROLES)[number];

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// Tablas de Better Auth (users, sessions, accounts, verifications). Los nombres de
// los campos TypeScript son los que espera el adaptador; las columnas van en snake_case.

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").$type<Role>().notNull().default("miembro"),
    ...timestamps,
  },
  (t) => [check("users_role_check", sql`${t.role} in ('director', 'miembro')`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// Grupos, pertenencia e intentos.

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    directorId: text("director_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Código del enlace de invitación (`/unirse/<código>`). Se puede regenerar. */
    inviteCode: text("invite_code").notNull().unique(),
    ...timestamps,
  },
  (t) => [index("groups_director_idx").on(t.directorId)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memberships_group_user_idx").on(t.groupId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Clave estable generada en el cliente: reenviar el mismo intento no lo duplica. */
    clientKey: text("client_key").notNull(),
    songSlug: text("song_slug").notNull(),
    songTitle: text("song_title").notNull(),
    instrument: text("instrument").$type<InstrumentId>().notNull(),
    speed: doublePrecision("speed").notNull(),
    startBar: integer("start_bar").notNull(),
    endBar: integer("end_bar").notNull(),
    sectionName: text("section_name"),
    loop: boolean("loop").notNull(),
    passes: integer("passes").notNull(),
    completed: boolean("completed").notNull(),
    inputSources: text("input_sources").array().$type<InputSourceKind[]>().notNull(),
    score: integer("score").notNull(),
    accuracy: doublePrecision("accuracy").notNull(),
    stars: integer("stars").notNull(),
    maxCombo: integer("max_combo").notNull(),
    counts: jsonb("counts").$type<JudgementCounts>().notNull(),
    notesJudged: integer("notes_judged").notNull(),
    meanOffsetMs: doublePrecision("mean_offset_ms"),
    latencyOffsetMs: doublePrecision("latency_offset_ms").notNull(),
    sections: jsonb("sections").$type<AttemptSectionResult[]>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("attempts_user_client_key_idx").on(t.userId, t.clientKey),
    index("attempts_user_finished_idx").on(t.userId, t.finishedAt),
    index("attempts_song_instrument_idx").on(t.songSlug, t.instrument),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  attempts: many(attempts),
  directedGroups: many(groups),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  director: one(users, { fields: [groups.directorId], references: [users.id] }),
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  group: one(groups, { fields: [memberships.groupId], references: [groups.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));

export const attemptsRelations = relations(attempts, ({ one }) => ({
  user: one(users, { fields: [attempts.userId], references: [users.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type GroupRow = typeof groups.$inferSelect;
export type AttemptRow = typeof attempts.$inferSelect;
export type NewAttemptRow = typeof attempts.$inferInsert;
