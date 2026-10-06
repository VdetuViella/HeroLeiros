import { headers } from "next/headers";
import { cache } from "react";

import { getAuth } from "./auth";
import { isDatabaseConfigured } from "./db/client";
import { sessionUserGetter, type SessionUser } from "./session";

/** Usuario de la petición actual (memorizado durante el render). `null` sin sesión o sin base de datos. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isDatabaseConfigured()) return null;
  return sessionUserGetter(getAuth())(await headers());
});

/** Ruta interna segura para volver tras iniciar sesión. */
export function safeNext(value: string | string[] | undefined, fallback: string): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
