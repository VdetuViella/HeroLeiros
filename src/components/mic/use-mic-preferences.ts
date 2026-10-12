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
  type MicPreferencesUpdate,
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

  const updatePrefs = useCallback((update: MicPreferencesUpdate) => {
    setPrefs((current) => {
      const patch = typeof update === "function" ? update(current) : update;
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
