import { DatabaseNotConfiguredError } from "../db/client";
import type { Db } from "../db/types";
import type { GetSessionUser, SessionUser } from "../session";

export interface ApiContext {
  db: Db;
  getUser: GetSessionUser;
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, ...extra }, { status });
}

export const unauthorized = () => jsonError(401, "Inicia sesión para continuar.");
export const forbidden = (message = "No tienes permiso para hacer esto.") => jsonError(403, message);

export async function readJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

/** Exige sesión y pasa el usuario al manejador. */
export async function withUser(
  request: Request,
  ctx: ApiContext,
  handler: (user: SessionUser) => Promise<Response>,
): Promise<Response> {
  const user = await ctx.getUser(request.headers);
  if (!user) return unauthorized();
  return handler(user);
}

/** Envoltorio de los Route Handlers: construye el contexto y traduce la falta de base de datos a 503. */
export async function runRoute(
  getContext: () => ApiContext,
  handler: (ctx: ApiContext) => Promise<Response>,
): Promise<Response> {
  try {
    return await handler(getContext());
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return jsonError(503, "Las cuentas no están configuradas en este servidor.", { code: "sin-base-de-datos" });
    }
    console.error("[api]", error);
    return jsonError(500, "Error interno. Inténtalo de nuevo en un momento.");
  }
}
