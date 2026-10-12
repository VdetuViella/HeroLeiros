"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { loadLocalAttempts } from "@/lib/attempts/reporter";
import type { AttemptResult } from "@/lib/attempts/types";
import { bestStarsFrom, type BestStars } from "@/lib/exercises/progress";
import { readLocal, writeLocal } from "@/lib/settings/local";

const FREE_MODE_KEY = "escuela:libre";

export interface SchoolProgress {
  /** `false` hasta leer el historial del dispositivo (tras montar). */
  ready: boolean;
  best: BestStars;
  /** Modo libre: todo abierto, sin tener que desbloquear. */
  free: boolean;
  setFree: (free: boolean) => void;
  /** Añade una partida recién terminada sin esperar a releer el historial. */
  addAttempt: (attempt: AttemptResult) => void;
}

/** Progreso de la Escuela a partir del historial de partidas de este dispositivo. */
export function useSchoolProgress(): SchoolProgress {
  const [attempts, setAttempts] = useState<AttemptResult[]>([]);
  const [free, setFreeState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // localStorage solo existe en el navegador: se lee tras montar para no romper la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttempts(loadLocalAttempts());
    setFreeState(readLocal<boolean>(FREE_MODE_KEY, false) === true);
    setReady(true);
  }, []);

  const setFree = useCallback((next: boolean) => {
    writeLocal(FREE_MODE_KEY, next);
    setFreeState(next);
  }, []);

  const addAttempt = useCallback((attempt: AttemptResult) => {
    setAttempts((current) => [attempt, ...current]);
  }, []);

  const best = useMemo(() => bestStarsFrom(attempts), [attempts]);
  return { ready, best, free, setFree, addAttempt };
}
