import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../db/schema";
import type { Db } from "../db/types";
import type { SessionUser } from "../session";

/** Postgres en memoria (PGlite) con las migraciones reales aplicadas. */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db: db as unknown as Db, close: () => client.close() };
}

export async function insertUser(
  db: Db,
  user: Partial<SessionUser> & { id: string },
): Promise<SessionUser> {
  const row: SessionUser = {
    name: user.name ?? `Usuario ${user.id}`,
    email: user.email ?? `${user.id}@example.test`,
    role: user.role ?? "miembro",
    id: user.id,
  };
  await db.insert(schema.users).values(row);
  return row;
}
