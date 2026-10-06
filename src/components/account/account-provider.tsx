"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { localAttemptReporter, setAttemptReporter } from "@/lib/attempts/reporter";
import { AttemptUploader, retryDelayMs, type FlushStatus } from "@/lib/attempts/sync";
import type { AttemptResult } from "@/lib/attempts/types";
import { authClient } from "@/lib/auth-client";

export interface AccountUser {
  id: string;
  name: string;
  email: string;
  role: "director" | "miembro";
}

export type SyncState = "inactivo" | "enviando" | "al-dia" | "pendiente" | "sin-conexion";

interface AccountContextValue {
  user: AccountUser | null;
  loading: boolean;
  /** `false` si el servidor no tiene base de datos: la app funciona solo en local. */
  available: boolean;
  queued: number;
  sync: SyncState;
  unsynced: AttemptResult[];
  uploadUnsynced: () => void;
  dismissUnsynced: () => void;
  signOut: () => Promise<void>;
  refreshSession: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount necesita <AccountProvider>.");
  return value;
}

function syncStateFor(status: FlushStatus, remaining: number): SyncState {
  switch (status) {
    case "vacio":
    case "enviado":
      return remaining > 0 ? "pendiente" : "al-dia";
    case "sin-conexion":
      return "sin-conexion";
    case "sin-sesion":
    case "error":
      return "pendiente";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

/**
 * Sesión de Better Auth + cola de intentos. Con sesión, cada partida terminada
 * se guarda en local y se encola para `POST /api/attempts`; la cola se reintenta
 * con espera creciente, al volver la conexión y al volver a la pestaña.
 */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const uploader = useMemo(() => new AttemptUploader({ fetch: (input, init) => fetch(input, init) }), []);
  const [queued, setQueued] = useState(0);
  const [sync, setSync] = useState<SyncState>("inactivo");
  const [unsynced, setUnsynced] = useState<AttemptResult[]>([]);
  const kickRef = useRef<() => void>(() => {});

  const rawUser = session.data?.user;
  const user = useMemo<AccountUser | null>(
    () =>
      rawUser
        ? {
            id: rawUser.id,
            name: rawUser.name,
            email: rawUser.email,
            role: rawUser.role === "director" ? "director" : "miembro",
          }
        : null,
    [rawUser],
  );
  const userId = user?.id ?? null;
  const available = session.error?.status !== 503;

  const refreshCounts = useCallback(
    (ownerId: string) => {
      setQueued(uploader.pending(ownerId).length);
      setUnsynced(uploader.unsyncedLocal(ownerId));
    },
    [uploader],
  );

  useEffect(() => {
    if (!userId) {
      setAttemptReporter(localAttemptReporter);
      kickRef.current = () => {};
      return;
    }
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (uploader.pending(userId).length > 0) setSync("enviando");
      const result = await uploader.flush(userId);
      if (cancelled) return;
      refreshCounts(userId);
      setSync(syncStateFor(result.status, result.remaining));
      if (result.remaining > 0 && result.status !== "sin-sesion") {
        failures += 1;
        timer = setTimeout(() => void flush(), retryDelayMs(failures));
      } else {
        failures = 0;
      }
    };
    const kick = () => void flush();
    const onVisible = () => {
      if (document.visibilityState === "visible") kick();
    };
    kickRef.current = kick;

    setAttemptReporter({
      async submit(result) {
        await localAttemptReporter.submit(result);
        uploader.enqueue(userId, [result]);
        refreshCounts(userId);
        await flush();
      },
    });
    // La cola vive en localStorage: el primer envío se hace al montar y tras cada partida.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCounts(userId);
    kick();
    window.addEventListener("online", kick);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setAttemptReporter(localAttemptReporter);
      window.removeEventListener("online", kick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, uploader, refreshCounts]);

  const uploadUnsynced = useCallback(() => {
    if (!userId) return;
    uploader.enqueue(userId, uploader.unsyncedLocal(userId));
    refreshCounts(userId);
    kickRef.current();
  }, [userId, uploader, refreshCounts]);

  const dismissUnsynced = useCallback(() => {
    if (!userId) return;
    uploader.dismissLocal(userId, uploader.unsyncedLocal(userId));
    refreshCounts(userId);
  }, [userId, uploader, refreshCounts]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setQueued(0);
    setUnsynced([]);
    setSync("inactivo");
  }, []);

  const { refetch } = session;
  const value = useMemo<AccountContextValue>(
    () => ({
      user,
      loading: session.isPending,
      available,
      queued,
      sync: user ? sync : "inactivo",
      unsynced: user ? unsynced : [],
      uploadUnsynced,
      dismissUnsynced,
      signOut,
      refreshSession: () => void refetch(),
    }),
    [user, session.isPending, available, queued, sync, unsynced, uploadUnsynced, dismissUnsynced, signOut, refetch],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
