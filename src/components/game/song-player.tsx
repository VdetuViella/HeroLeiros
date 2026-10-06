"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useMicPreferences } from "@/components/mic/use-mic-preferences";
import { AudioEngine, type TrackMix } from "@/lib/audio/engine";
import { bestLocalAttempt, reportAttempt } from "@/lib/attempts/reporter";
import type { AttemptResult } from "@/lib/attempts/types";
import { getTrack } from "@/lib/chart/query";
import type { Chart, InstrumentId } from "@/lib/chart/types";
import { KeyboardInputSource } from "@/lib/input/keyboard";
import { defaultKeymap, keyLabel } from "@/lib/input/keymap";
import { MicInputSource } from "@/lib/input/microphone";
import { TouchInputSource } from "@/lib/input/touch";
import { MicInput, toMicError } from "@/lib/mic/mic-input";
import { classifierFor, detectorSettingsFrom, type InputMethod } from "@/lib/mic/settings";
import { GameSession } from "@/lib/session/game-session";
import {
  defaultPracticeSettings,
  resolveRange,
  sanitizeSettings,
  type PracticeSettings,
} from "@/lib/session/practice";
import { loadKeymap, loadLatencyMs, readLocal, saveKeymap, writeLocal } from "@/lib/settings/local";

import { GameView, type GameMic } from "./game-view";
import type { MixState } from "./mixer-panel";
import { ResultsView } from "./results-view";
import { SetupPanel } from "./setup-panel";

type Phase = "ajustes" | "preparando" | "jugando" | "resultados";

interface SongPlayerProps {
  chart: Chart;
  /**
   * Se llama con cada partida terminada, además de guardarla con
   * `reportAttempt` (hoy en local; mañana `POST /api/attempts`).
   */
  onAttemptComplete?: (result: AttemptResult) => void;
}

interface Running {
  session: GameSession;
  touch: TouchInputSource;
  keyLabels: string[];
  mic: GameMic | null;
}

function releaseRunning(running: Running | null): Promise<void> {
  if (!running) return Promise.resolve();
  return running.session.discard().finally(() => running.mic?.input.close());
}

export function SongPlayer({ chart, onAttemptComplete }: SongPlayerProps) {
  const [phase, setPhase] = useState<Phase>("ajustes");
  const [settings, setSettings] = useState<PracticeSettings>(() => defaultPracticeSettings(chart));
  const [mix, setMix] = useState<MixState>({});
  const [keymaps, setKeymaps] = useState<Record<number, string[]>>({});
  const [latencyMs, setLatencyMs] = useState<Record<InputMethod, number>>({ teclado: 0, microfono: 0 });
  const { prefs: micPrefs, updatePrefs: updateMicPrefs, method: inputMethod, updateMethod: updateInputMethod } = useMicPreferences();
  const [best, setBest] = useState<Partial<Record<InstrumentId, AttemptResult>>>({});
  const [running, setRunning] = useState<Running | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const runningRef = useRef<Running | null>(null);

  const track = getTrack(chart, settings.instrument) ?? chart.tracks[0];
  const laneCount = track.lanes.length;
  const keymap = keymaps[laneCount] ?? defaultKeymap(laneCount);

  const refreshBest = useCallback(() => {
    const records: Partial<Record<InstrumentId, AttemptResult>> = {};
    for (const t of chart.tracks) {
      const record = bestLocalAttempt(chart.slug, t.instrument);
      if (record) records[t.instrument] = record;
    }
    setBest(records);
  }, [chart]);

  // Los ajustes guardados viven en localStorage: se leen tras montar para no romper la hidratación.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(sanitizeSettings(chart, readLocal<Partial<PracticeSettings> | null>(`ajustes:${chart.slug}`, null)));
    setMix(readLocal<MixState>(`mezcla:${chart.slug}`, {}));
    setKeymaps(Object.fromEntries([1, 2, 3, 4].map((n) => [n, loadKeymap(n)])));
    setLatencyMs({ teclado: loadLatencyMs("teclado"), microfono: loadLatencyMs("microfono") });
    refreshBest();
  }, [chart, refreshBest]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const t of chart.tracks) engine.setMix(t.instrument, mix[t.instrument] ?? {});
  }, [chart, mix]);

  useEffect(
    () => () => {
      void releaseRunning(runningRef.current);
      void engineRef.current?.dispose();
    },
    [],
  );

  const updateSettings = useCallback(
    (patch: Partial<PracticeSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        writeLocal(`ajustes:${chart.slug}`, next);
        return next;
      });
    },
    [chart.slug],
  );

  const updateMix = useCallback(
    (instrument: InstrumentId, patch: Partial<TrackMix>) => {
      setMix((current) => {
        const next = {
          ...current,
          [instrument]: { volumeDb: 0, mute: false, solo: false, ...current[instrument], ...patch },
        };
        writeLocal(`mezcla:${chart.slug}`, next);
        return next;
      });
    },
    [chart.slug],
  );

  const updateKeymap = useCallback(
    (next: string[]) => {
      saveKeymap(next.length, next);
      setKeymaps((current) => ({ ...current, [next.length]: next }));
    },
    [],
  );

  const handleFinish = useCallback(
    (attempt: AttemptResult) => {
      setResult(attempt);
      setPhase("resultados");
      void reportAttempt(attempt).then(refreshBest);
      onAttemptComplete?.(attempt);
    },
    [onAttemptComplete, refreshBest],
  );

  const play = useCallback(async () => {
    setError(null);
    let engine = engineRef.current;
    if (!engine) {
      try {
        engine = new AudioEngine();
        engineRef.current = engine;
      } catch {
        setError("Este navegador no puede reproducir audio (Web Audio no disponible).");
        return;
      }
    }

    await releaseRunning(runningRef.current);
    runningRef.current = null;
    setPhase("preparando");
    const useMic = inputMethod === "microfono";
    let mic: MicInput | null = null;
    try {
      await engine.resume();
      await engine.load();
      for (const t of chart.tracks) engine.setMix(t.instrument, mix[t.instrument] ?? {});

      if (useMic) {
        try {
          // En el mismo AudioContext que el acompañamiento, para compartir reloj.
          mic = await MicInput.open(engine.context, { deviceId: micPrefs.deviceId, settings: detectorSettingsFrom(micPrefs) });
        } catch (cause) {
          setError(toMicError(cause).message);
          setPhase("ajustes");
          return;
        }
      }

      const clock = (performanceTime: number) => engine.heardTime(performanceTime);
      const touch = new TouchInputSource(clock);
      const classifier = mic ? classifierFor(micPrefs, track.instrument, track.lanes) : null;
      const session = new GameSession(engine, {
        chart,
        instrument: settings.instrument,
        plan: { rate: settings.rate, loop: settings.loop, countInBars: settings.countInBars, ...resolveRange(chart, settings) },
        metronome: settings.metronome,
        guide: settings.guide,
        hitSounds: useMic ? false : settings.hitSounds,
        latencyMs: { teclado: loadLatencyMs("teclado"), tactil: loadLatencyMs("tactil"), microfono: loadLatencyMs("microfono") },
        inputs: mic ? [new MicInputSource(mic, engine, { classifier })] : [new KeyboardInputSource(keymap, clock), touch],
        onFinish: handleFinish,
      });
      const next: Running = {
        session,
        touch,
        keyLabels: mic ? keymap.map(() => "") : keymap.map(keyLabel),
        mic: mic ? { input: mic, classifies: classifier !== null } : null,
      };
      runningRef.current = next;
      setRunning(next);
      setResult(null);
      setPhase("jugando");
      await session.start();
    } catch (cause) {
      console.error(cause);
      mic?.close();
      setError("No se pudo preparar el audio. Recarga la página e inténtalo de nuevo.");
      setPhase("ajustes");
    }
  }, [chart, settings, mix, keymap, handleFinish, inputMethod, micPrefs, track]);

  const exitToSettings = useCallback(async () => {
    await releaseRunning(runningRef.current);
    runningRef.current = null;
    setRunning(null);
    setPhase("ajustes");
  }, []);

  const keyLabels = useMemo(() => running?.keyLabels ?? [], [running]);

  if (phase === "jugando" && running) {
    return (
      <GameView
        session={running.session}
        chart={chart}
        keyLabels={keyLabels}
        touch={running.touch}
        mic={running.mic}
        onRestart={() => void play()}
        onExit={() => void exitToSettings()}
      />
    );
  }

  if (phase === "resultados" && result) {
    return <ResultsView result={result} onReplay={() => void play()} onSettings={() => void exitToSettings()} />;
  }

  return (
    <SetupPanel
      chart={chart}
      settings={settings}
      onSettingsChange={updateSettings}
      mix={mix}
      onMixChange={updateMix}
      keymap={keymap}
      onKeymapChange={updateKeymap}
      latencyMs={latencyMs[inputMethod]}
      best={best}
      preparing={phase === "preparando"}
      error={error}
      onPlay={() => void play()}
      inputMethod={inputMethod}
      onInputMethodChange={updateInputMethod}
      micPrefs={micPrefs}
      onMicPrefsChange={updateMicPrefs}
    />
  );
}
