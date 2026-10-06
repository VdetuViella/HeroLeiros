import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { getDb } from "./db/client";
import * as schema from "./db/schema";
import type { Db } from "./db/types";

const DEV_ORIGINS = ["http://127.0.0.1:43147", "http://localhost:43147"];

function trustedOrigins(): string[] {
  const extra = (process.env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const base = process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [];
  return [...new Set([...base, ...DEV_ORIGINS, ...extra])];
}

export function createAuth(db: Db, options: { baseURL?: string; secret?: string } = {}) {
  return betterAuth({
    appName: "HeroLeiros",
    baseURL: options.baseURL ?? process.env.BETTER_AUTH_URL,
    secret: options.secret ?? process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    user: {
      additionalFields: {
        // El rol nunca lo elige el cliente: lo cambia el servidor al crear un grupo.
        role: { type: "string", required: false, defaultValue: "miembro", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins: trustedOrigins(),
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { heroleirosAuth?: Auth };

/** Instancia única para la app. Lanza `DatabaseNotConfiguredError` si falta `DATABASE_URL`. */
export function getAuth(): Auth {
  globalForAuth.heroleirosAuth ??= createAuth(getDb());
  return globalForAuth.heroleirosAuth;
}
