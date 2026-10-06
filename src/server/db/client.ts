import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("Falta DATABASE_URL: las cuentas y el progreso en la nube están desactivados.");
  }
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// En desarrollo el módulo se recarga con cada cambio: se reutiliza el pool para no agotar conexiones.
const globalForDb = globalThis as unknown as { heroleirosDb?: NodePgDatabase<typeof schema> };

export function getDb(): NodePgDatabase<typeof schema> {
  if (globalForDb.heroleirosDb) return globalForDb.heroleirosDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  const pool = new Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  globalForDb.heroleirosDb = db;
  return db;
}
