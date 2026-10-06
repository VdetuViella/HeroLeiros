"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_MIC_PREFERENCES,
  loadInputMethod,
  loadMicPreferences,
  saveInputMethod,
  saveMicPreferences,
  type InputMethod,
  type MicPreferences,
} from "@/lib/mic/settings";

/** Preferencias del micrófono guardadas en el dispositivo (se leen tras montar). */
export function useMicPreferences() {
  const [prefs, setPrefs] = useState<MicPreferences>(DEFAULT_MIC_PREFERENCES);
  const [method, setMethod] = useState<InputMethod>("teclado");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(loadMicPreferences());
    setMethod(loadInputMethod());
  }, []);

  const updatePrefs = useCallback((patch: Partial<MicPreferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      saveMicPreferences(next);
      return next;
    });
  }, []);

  const updateMethod = useCallback((next: InputMethod) => {
    saveInputMethod(next);
    setMethod(next);
  }, []);

  return { prefs, updatePrefs, method, updateMethod };
}
