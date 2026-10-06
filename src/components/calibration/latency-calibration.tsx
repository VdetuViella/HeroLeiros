"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Headphones, Loader2, Mic, Play, RotateCcw, Volume2 } from "lucide-react";

import { MicLevelMeter } from "@/components/mic/mic-level-meter";
import { useMicPreferences } from "@/components/mic/use-mic-preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AudioEngine } from "@/lib/audio/engine";
import { estimateLatency, type LatencyEstimate } from "@/lib/calibration/latency";
import { createMicClock } from "@/lib/input/microphone";
import type { InputSourceKind } from "@/lib/input/types";
import { MicInput, toMicError } from "@/lib/mic/mic-input";
import { detectorSettingsFrom } from "@/lib/mic/settings";
import { loadLatencyMs, saveLatencyMs } from "@/lib/settings/local";

const BPM = 90;
const COUNT_IN = 4;
const BEATS = 16;
const MIN_TAPS = 6;

type Kind = InputSourceKind;
type Status = "listo" | "preparando" | "midiendo" | "hecho";
/** «altavoz»: el micro oye el propio clic; «tocar»: el jugador toca al clic con auriculares. */
type MicMode = "altavoz" | "tocar";

const KIND_LABEL: Record<Kind, string> = { teclado: "teclado", tactil: "pantalla táctil", microfono: "micrófono" };
const SLIDER_RANGE: Record<Kind, { min: number; max: number }> = {
  teclado: { min: -150, max: 250 },
  tactil: { min: -150, max: 250 },
  microfono: { min: -150, max: 400 },
};

interface LatencyCalibrationProps {
  initialKind?: Kind;
}

export function LatencyCalibration({ initialKind = "teclado" }: LatencyCalibrationProps) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [micMode, setMicMode] = useState<MicMode>("altavoz");
  const [saved, setSaved] = useState<Record<Kind, number>>({ teclado: 0, tactil: 0, microfono: 0 });
  const [status, setStatus] = useState<Status>("listo");
  const [beat, setBeat] = useState(0);
  const [taps, setTaps] = useState(0);
  const [estimate, setEstimate] = useState<LatencyEstimate | null>(null);
  const [manual, setManual] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mic, setMic] = useState<MicInput | null>(null);
  const { prefs: micPrefs } = useMicPreferences();
  const engineRef = useRef<AudioEngine | null>(null);
  const run = useRef<{ clicks: number[]; taps: number[]; timer: ReturnType<typeof setInterval> | null; release: (() => void) | null }>({
    clicks: [],
    taps: [],
    timer: null,
    release: null,
  });

  useEffect(() => {
    const values = { teclado: loadLatencyMs("teclado"), tactil: loadLatencyMs("tactil"), microfono: loadLatencyMs("microfono") };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(values);
    setManual(values[initialKind]);
  }, [initialKind]);

  useEffect(
    () => () => {
      if (run.current.timer) clearInterval(run.current.timer);
      run.current.release?.();
      void engineRef.current?.dispose();
    },
    [],
  );

  const tap = useCallback((timeStamp: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    run.current.taps.push(engine.heardTime(timeStamp));
    setTaps(run.current.taps.length);
  }, []);

  const finish = useCallback(() => {
    if (run.current.timer) clearInterval(run.current.timer);
    run.current.timer = null;
    run.current.release?.();
    run.current.release = null;
    setMic(null);
    const result = estimateLatency(run.current.taps, run.current.clicks);
    setEstimate(result && result.used >= MIN_TAPS ? result : null);
    if (result && result.used >= MIN_TAPS) setManual(result.offsetMs);
    setStatus("hecho");
  }, []);

  const start = useCallback(async () => {
    const engine = engineRef.current ?? new AudioEngine();
    engineRef.current = engine;
    setStatus("preparando");
    setEstimate(null);
    setError(null);
    setTaps(0);
    setBeat(0);
    await engine.resume();
    await engine.load();

    run.current = { clicks: [], taps: [], timer: null, release: null };
    if (kind === "microfono") {
      try {
        const input = await MicInput.open(engine.context, { deviceId: micPrefs.deviceId, settings: detectorSettingsFrom(micPrefs) });
        const clock = createMicClock(engine, input);
        const off = input.onOnset(({ time }) => {
          run.current.taps.push(clock.toHeard(time));
          setTaps(run.current.taps.length);
        });
        run.current.release = () => {
          off();
          clock.dispose();
          input.close();
        };
        setMic(input);
      } catch (cause) {
        setError(toMicError(cause).message);
        setStatus("listo");
        return;
      }
    }

    const spb = 60 / BPM;
    const t0 = engine.currentTime + 0.3;
    const clicks: number[] = [];
    for (let i = 0; i < COUNT_IN + BEATS; i++) {
      const time = t0 + i * spb;
      engine.play(i % 4 === 0 ? "metronomo:alto" : "metronomo:bajo", "metronomo", time, i < COUNT_IN ? 0.6 : 1);
      if (i >= COUNT_IN) clicks.push(time);
    }
    run.current.clicks = clicks;
    setStatus("midiendo");
    run.current.timer = setInterval(() => {
      const elapsed = engine.heardTime() - t0;
      setBeat(Math.min(COUNT_IN + BEATS, Math.max(0, Math.floor(elapsed / spb) + 1)));
      if (elapsed > (COUNT_IN + BEATS) * spb + 0.3) finish();
    }, 50);
  }, [finish, kind, micPrefs]);

  useEffect(() => {
    if (status !== "midiendo" || kind === "microfono") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.code === "Tab" || event.code === "Escape") return;
      event.preventDefault();
      tap(event.timeStamp);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, tap, kind]);

  const save = () => {
    saveLatencyMs(kind, manual);
    setSaved((current) => ({ ...current, [kind]: manual }));
  };

  const counting = status === "midiendo" && beat <= COUNT_IN;
  const isMic = kind === "microfono";
  const loopback = isMic && micMode === "altavoz";
  const range = SLIDER_RANGE[kind];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">Calibrar la latencia</h1>
        <p className="text-muted-foreground">
          Cada dispositivo tarda un poco en sacar el sonido por los altavoces y en registrar tus golpes. Toca al ritmo
          del clic y HeroLeiros calculará cuánto hay que compensar.
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Headphones className="size-4" /> Con auriculares con cable la latencia es menor y más estable.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>¿Con qué vas a tocar?</CardTitle>
          <CardDescription>Se guarda un ajuste distinto para teclado, pantalla táctil y micrófono.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            variant="outline"
            value={[kind]}
            disabled={status === "preparando" || status === "midiendo"}
            onValueChange={(value) => {
              if (!value[0]) return;
              const next = value[0] as Kind;
              setKind(next);
              setManual(saved[next]);
              setEstimate(null);
              setError(null);
              setStatus("listo");
            }}
          >
            <ToggleGroupItem value="teclado">Teclado</ToggleGroupItem>
            <ToggleGroupItem value="tactil">Pantalla táctil</ToggleGroupItem>
            <ToggleGroupItem value="microfono">Micrófono</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-sm text-muted-foreground">Guardado: {saved[kind]} ms</span>
        </CardContent>
      </Card>

      {isMic && (
        <Card>
          <CardHeader>
            <CardTitle>Cómo medir el micrófono</CardTitle>
            <CardDescription>
              El micrófono tarda en entregar el sonido. Lo más preciso es que oiga el propio clic de prueba.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleGroup
              variant="outline"
              className="w-full"
              value={[micMode]}
              disabled={status === "preparando" || status === "midiendo"}
              onValueChange={(value) => value[0] && setMicMode(value[0] as MicMode)}
            >
              <ToggleGroupItem value="altavoz" className="flex-1">
                <Volume2 /> Clic por el altavoz
              </ToggleGroupItem>
              <ToggleGroupItem value="tocar" className="flex-1">
                <Mic /> Tocando al clic
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-sm text-muted-foreground">
              {loopback
                ? "Quítate los auriculares, sube el volumen y quédate en silencio: el micrófono escuchará los clics que salen por el altavoz."
                : "Con auriculares, toca tu instrumento en cada clic. Incluye tu forma de tocar, como la calibración con teclado."}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Prueba de ritmo</CardTitle>
          <CardDescription>
            {COUNT_IN} clics de aviso y luego {BEATS} clics a {BPM} BPM.{" "}
            {loopback
              ? "No toques nada: el micrófono escucha los clics."
              : `Toca en cada clic del segundo grupo ${kind === "teclado" ? "con cualquier tecla" : kind === "tactil" ? "en el pad" : "con tu instrumento"}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            type="button"
            disabled={status !== "midiendo" || isMic}
            onPointerDown={(event) => {
              event.preventDefault();
              if (status === "midiendo" && !isMic) tap(event.timeStamp);
            }}
            className="flex h-44 w-full touch-none flex-col items-center justify-center gap-1 rounded-2xl border-2 border-primary/60 bg-primary/10 text-primary transition-transform select-none active:scale-[0.98] disabled:border-border disabled:bg-muted/30 disabled:text-muted-foreground data-[mic=true]:disabled:border-primary/60 data-[mic=true]:disabled:bg-primary/10 data-[mic=true]:disabled:text-primary"
            data-mic={isMic && status === "midiendo"}
          >
            {status === "midiendo" ? (
              <>
                <span className="font-heading text-6xl font-extrabold tabular-nums">
                  {counting ? COUNT_IN - beat + 1 : beat - COUNT_IN}
                </span>
                <span className="text-sm">
                  {counting ? "Escucha…" : `${loopback ? "Escuchando" : "¡Toca!"} · ${taps} golpes${isMic ? " oídos" : ""}`}
                </span>
              </>
            ) : (
              <span className="text-sm">
                {status === "preparando" ? (isMic ? "Abriendo el micrófono…" : "Preparando…") : "Pulsa «Empezar» para la prueba"}
              </span>
            )}
          </button>
          {mic && status === "midiendo" && <MicLevelMeter mic={mic} />}
          {status === "midiendo" && <Progress value={(beat / (COUNT_IN + BEATS)) * 100} aria-label="Progreso de la prueba" />}

          {error && (
            <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void start()} disabled={status === "preparando" || status === "midiendo"}>
              {status === "preparando" ? <Loader2 className="animate-spin" /> : status === "hecho" ? <RotateCcw /> : <Play />}
              {status === "hecho" ? "Repetir prueba" : "Empezar"}
            </Button>
          </div>

          {status === "hecho" && (
            <div className="rounded-xl bg-muted/40 p-4 text-sm" role="status">
              {estimate ? (
                <p>
                  {loopback ? "El micrófono oye el clic" : "Tus golpes llegan"} de media{" "}
                  <strong>{Math.abs(estimate.offsetMs)} ms</strong> {estimate.offsetMs >= 0 ? "tarde" : "pronto"} respecto a lo
                  previsto (variación ±{estimate.spreadMs} ms, {estimate.used} golpes). Revisa el valor y guárdalo.
                </p>
              ) : (
                <p className="text-amber-300">
                  {isMic
                    ? `El micrófono no oyó suficientes golpes cerca de los clics (mínimo ${MIN_TAPS}). Sube el volumen o la sensibilidad, o mide el ruido en los ajustes de la canción.`
                    : `No hubo suficientes golpes cerca de los clics (mínimo ${MIN_TAPS}). Repite la prueba tocando en cada clic.`}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Desfase aplicado</CardTitle>
          <CardDescription>Positivo si sueles ir tarde. Puedes ajustarlo a mano.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Desfase</Label>
            <span className="font-mono text-sm tabular-nums">{manual} ms</span>
          </div>
          <Slider
            min={range.min}
            max={range.max}
            step={1}
            value={Math.min(range.max, Math.max(range.min, manual))}
            onValueChange={(value) => setManual(Array.isArray(value) ? value[0] : value)}
            aria-label="Desfase de latencia en milisegundos"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={manual === saved[kind]}>
              <Check /> Guardar {manual} ms para {KIND_LABEL[kind]}
            </Button>
            <Button variant="ghost" onClick={() => setManual(0)}>
              Poner a 0
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
