import { readLocal, writeLocal } from "../settings/local";
import { loadLocalAttempts } from "./reporter";
import type { AttemptResult } from "./types";

/**
 * Clave estable de un intento: la misma partida produce siempre la misma
 * clave, así el servidor descarta los reenvíos (cola con reintentos o subir
 * el historial local dos veces).
 */
export function attemptKey(result: AttemptResult): string {
  return `${result.startedAt}|${result.songSlug}|${result.instrument}`;
}

export interface QueuedAttempt {
  key: string;
  /** Cuenta a la que pertenece: si cambia el usuario, no se sube a la cuenta equivocada. */
  ownerId: string;
  result: AttemptResult;
  tries: number;
}

export interface SyncStorage {
  read<T>(key: string, fallback: T): T;
  write(key: string, value: unknown): void;
}

export const browserStorage: SyncStorage = { read: readLocal, write: writeLocal };

export type FlushStatus = "vacio" | "enviado" | "sin-conexion" | "sin-sesion" | "error";

export interface FlushResult {
  status: FlushStatus;
  sent: number;
  rejected: number;
  remaining: number;
}

const QUEUE_KEY = "cola-intentos";
const QUEUE_LIMIT = 500;
const KNOWN_LIMIT = 1000;
const BATCH = 50;
const RETRY_STEPS_MS = [5_000, 15_000, 60_000, 5 * 60_000];

/** Espera antes del siguiente reintento según los fallos seguidos. */
export function retryDelayMs(failures: number): number {
  return RETRY_STEPS_MS[Math.min(Math.max(failures - 1, 0), RETRY_STEPS_MS.length - 1)];
}

interface PostResponse {
  accepted?: string[];
  rejected?: { key: string; error: string }[];
}

/**
 * Cola local de intentos pendientes de subir a `POST /api/attempts`.
 * Sobrevive a recargas (localStorage) y se vacía por lotes cuando hay conexión.
 */
export class AttemptUploader {
  private flushing: Promise<FlushResult> | null = null;

  constructor(
    private readonly options: {
      fetch: typeof fetch;
      storage?: SyncStorage;
      endpoint?: string;
      localHistory?: () => AttemptResult[];
    },
  ) {}

  private get storage(): SyncStorage {
    return this.options.storage ?? browserStorage;
  }

  private queue(): QueuedAttempt[] {
    const stored = this.storage.read<QueuedAttempt[]>(QUEUE_KEY, []);
    return Array.isArray(stored) ? stored : [];
  }

  private saveQueue(queue: QueuedAttempt[]): void {
    this.storage.write(QUEUE_KEY, queue.slice(-QUEUE_LIMIT));
  }

  /** Claves ya subidas o descartadas por este usuario (no se vuelven a ofrecer). */
  private known(ownerId: string): Set<string> {
    return new Set(this.storage.read<string[]>(`intentos-conocidos:${ownerId}`, []));
  }

  private remember(ownerId: string, keys: string[]): void {
    if (keys.length === 0) return;
    const merged = [...this.known(ownerId), ...keys];
    this.storage.write(`intentos-conocidos:${ownerId}`, [...new Set(merged)].slice(-KNOWN_LIMIT));
  }

  pending(ownerId: string): QueuedAttempt[] {
    return this.queue().filter((q) => q.ownerId === ownerId);
  }

  enqueue(ownerId: string, results: AttemptResult[]): void {
    const queue = this.queue();
    const queued = new Set(queue.filter((q) => q.ownerId === ownerId).map((q) => q.key));
    for (const result of results) {
      const key = attemptKey(result);
      if (queued.has(key)) continue;
      queued.add(key);
      queue.push({ key, ownerId, result, tries: 0 });
    }
    this.saveQueue(queue);
  }

  /**
   * Partidas guardadas en este dispositivo (p. ej. jugadas sin sesión) que no
   * están en la cola ni se han subido o descartado: se ofrecen al iniciar sesión.
   */
  unsyncedLocal(ownerId: string): AttemptResult[] {
    const skip = this.known(ownerId);
    for (const q of this.pending(ownerId)) skip.add(q.key);
    const history = (this.options.localHistory ?? loadLocalAttempts)();
    return history.filter((r) => r.notesJudged > 0 && !skip.has(attemptKey(r)));
  }

  dismissLocal(ownerId: string, results: AttemptResult[]): void {
    this.remember(ownerId, results.map(attemptKey));
  }

  /** Envía la cola de `ownerId` por lotes. Las llamadas simultáneas comparten el mismo envío. */
  flush(ownerId: string): Promise<FlushResult> {
    this.flushing ??= this.doFlush(ownerId).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async doFlush(ownerId: string): Promise<FlushResult> {
    let sent = 0;
    let rejected = 0;
    const result = (status: FlushStatus): FlushResult => ({
      status,
      sent,
      rejected,
      remaining: this.pending(ownerId).length,
    });

    for (;;) {
      const batch = this.pending(ownerId).slice(0, BATCH);
      if (batch.length === 0) return result(sent + rejected > 0 ? "enviado" : "vacio");

      let response: Response;
      try {
        response = await this.options.fetch(this.options.endpoint ?? "/api/attempts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ attempts: batch.map(({ key, result }) => ({ key, result })) }),
        });
      } catch {
        this.bumpTries(ownerId, batch);
        return result("sin-conexion");
      }

      if (response.status === 401) return result("sin-sesion");
      // 422: todos inválidos; 200/201: algunos o todos guardados.
      if (!response.ok && response.status !== 422) {
        this.bumpTries(ownerId, batch);
        return result("error");
      }

      const body = (await response.json().catch(() => ({}))) as PostResponse;
      const done = new Set([...(body.accepted ?? []), ...(body.rejected ?? []).map((r) => r.key)]);
      if (done.size === 0) {
        this.bumpTries(ownerId, batch);
        return result("error");
      }
      for (const r of body.rejected ?? []) console.warn(`[intentos] ${r.key} rechazado: ${r.error}`);
      sent += body.accepted?.length ?? 0;
      rejected += body.rejected?.length ?? 0;
      this.remember(ownerId, [...done]);
      this.saveQueue(this.queue().filter((q) => !(q.ownerId === ownerId && done.has(q.key))));
      const leftover = batch.filter((q) => !done.has(q.key));
      if (leftover.length > 0) {
        this.bumpTries(ownerId, leftover);
        return result("error");
      }
    }
  }

  private bumpTries(ownerId: string, batch: QueuedAttempt[]): void {
    const keys = new Set(batch.map((q) => q.key));
    this.saveQueue(
      this.queue().map((q) => (q.ownerId === ownerId && keys.has(q.key) ? { ...q, tries: q.tries + 1 } : q)),
    );
  }
}
