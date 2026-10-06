import type { z } from "zod";

import type { AttemptResult } from "../../lib/attempts/types";
import { attempts } from "../db/schema";
import { attemptResultSchema, attemptsBodySchema, MAX_BATCH, toAttemptRow } from "../attempts/validate";
import { memberHistory } from "../progress/queries";
import { jsonError, readJson, withUser, type ApiContext } from "./http";

export interface PostAttemptsResponse {
  /** Claves guardadas ahora o ya guardadas antes: el cliente puede sacarlas de la cola. */
  accepted: string[];
  /** Claves nuevas en esta petición. */
  created: string[];
  /** Intentos inválidos: reenviarlos no servirá de nada. */
  rejected: { key: string; error: string }[];
}

function describe(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".") || "intento"}: ${issue.message}` : "Intento inválido.";
}

/** `POST /api/attempts` — uno (`{ key, result }`) o varios (`{ attempts: [...] }`). Idempotente por clave. */
export function postAttempts(request: Request, ctx: ApiContext): Promise<Response> {
  return withUser(request, ctx, async (user) => {
    const body = await readJson(request);
    if (!body.ok) return jsonError(400, "El cuerpo no es JSON válido.");
    const parsed = attemptsBodySchema.safeParse(body.value);
    if (!parsed.success) {
      return jsonError(400, `Formato no válido: se espera { key, result } o { attempts: [...] } (máximo ${MAX_BATCH}).`);
    }
    const envelopes = "attempts" in parsed.data ? parsed.data.attempts : [parsed.data];

    const rejected: PostAttemptsResponse["rejected"] = [];
    const valid = new Map<string, AttemptResult>();
    for (const { key, result } of envelopes) {
      const check = attemptResultSchema.safeParse(result);
      if (check.success) valid.set(key, check.data as AttemptResult);
      else rejected.push({ key, error: describe(check.error) });
    }

    let created: string[] = [];
    if (valid.size > 0) {
      const rows = [...valid].map(([key, result]) => toAttemptRow(user.id, key, result));
      const inserted = await ctx.db
        .insert(attempts)
        .values(rows)
        .onConflictDoNothing({ target: [attempts.userId, attempts.clientKey] })
        .returning({ key: attempts.clientKey });
      created = inserted.map((r) => r.key);
    }

    const payload: PostAttemptsResponse = { accepted: [...valid.keys()], created, rejected };
    const status = valid.size === 0 ? 422 : created.length > 0 ? 201 : 200;
    return Response.json(payload, { status });
  });
}

/** `GET /api/attempts?limit=30` — historial propio, el más reciente primero. */
export function getAttempts(request: Request, ctx: ApiContext): Promise<Response> {
  return withUser(request, ctx, async (user) => {
    const limitParam = Number(new URL(request.url).searchParams.get("limit") ?? 30);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 200) : 30;
    return Response.json({ attempts: await memberHistory(ctx.db, user.id, limit) });
  });
}
