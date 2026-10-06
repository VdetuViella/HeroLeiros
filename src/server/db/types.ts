import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

/** Cualquier base Drizzle de Postgres con nuestro esquema (node-postgres en la app, PGlite en tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
