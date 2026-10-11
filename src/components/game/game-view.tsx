"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import {
  ChevronsDown,
  Columns2,
  Loader2,
  Mic,
  Music,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Square,
  X,
} from "lucide-react";

import { MicLevelMeter } from "@/components/mic/mic-level-meter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { INSTRUMENTS } from "@/lib/chart/instruments";
import { sectionIndexAt } from "@/lib/chart/query";
import type { Chart } from "@/lib/chart/types";
import { formatNumber, formatPercent } from "@/lib/format";
import type { TouchInputSource } from "@/lib/input/touch";
import type { MicInput } from "@/lib/mic/mic-input";
import type { BarRange } from "@/lib/notation/layout";
import type { GameSession } from "@/lib/session/game-session";
import type { SessionPosition } from "@/lib/session/timeline";
import { positionAt } from "@/lib/session/timeline";
import { readLocal, writeLocal } from "@/lib/settings/local";
import { cn } from "@/lib/utils";

import { Highway } from "./highway";
import { TouchPads } from "./touch-pads";

export interface GameMic {
  input: MicInput;
  /** Fase B: los golpes llevan carril según su timbre. */
  classifies: boolean;
}

// VexFlow solo hace falta al abrir la partitura y necesita el DOM.
const ScoreView = dynamic(() => import("@/components/notation/score-view"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[30vh] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#f6f1e7] text-sm text-stone-600 lg:min-h-[64vh]">
      <Loader2 className="size-4 animate-spin" /> Cargando partitura…
    </div>
  ),
});

export type GameViewMode = "carril" | "partitura" | "dividida";

const VIEW_MODES: { value: GameViewMode; label: string; icon: typeof Music }[] = [
  { value: "carril", label: "Carril", icon: ChevronsDown },
  { value: "partitura", label: "Partitura", icon: Music },
  { value: "dividida", label: "Dividida", icon: Columns2 },
];

const VIEW_MODE_KEY = "vista-juego";

function loadViewMode(): GameViewMode {
  const stored = readLocal<string>(VIEW_MODE_KEY, "carril");
  return VIEW_MODES.some((m) => m.value === stored) ? (stored as GameViewMode) : "carril";
}

interface GameViewProps {
  session: GameSession;
  chart: Chart;
  keyLabels: string[];
  touch: TouchInputSource;
  /** Si se juega con micrófono, sustituye a los pads táctiles. */
  mic?: GameMic | null;
  onRestart: () => void;
  onExit: () => void;
  /** Reinicia la partida repitiendo en bucle los compases elegidos en la partitura. */
  onLoopBars?: (range: BarRange) => void;
}

function usePosition(session: GameSession): SessionPosition & { now: number } {
  const [state, setState] = useState(() => ({ ...positionAt(session.plan, 0), now: 0 }));
  useEffect(() => {
    const id = setInterval(() => {
      const now = session.now();
      setState({ ...positionAt(session.plan, now), now });
    }, 100);
    return () => clearInterval(id);
  }, [session]);
  return state;
}

export function GameView({ session, chart, keyLabels, touch, mic, onRestart, onExit, onLoopBars }: GameViewProps) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const position = usePosition(session);
  const { plan, track } = session;
  const { stats, status } = snapshot;
  const paused = status === "pausada";
  const [mode, setMode] = useState<GameViewMode>(loadViewMode);
  // La selección pertenece a una partida: al reiniciar con el bucle nuevo desaparece.
  const [picked, setPicked] = useState<{ session: GameSession; range: BarRange | null } | null>(null);
  const selection = picked?.session === session ? picked.range : null;
  const setSelection = useCallback((range: BarRange | null) => setPicked({ session, range }), [session]);
  const wide = mode !== "carril";

  // En pausa, «Elegir compases» reduce el menú a una barra para poder tocar la
  // partitura (bucle A-B) sin reanudar. Cada pausa nueva vuelve a abrir el menú.
  const [pauseMenuHidden, setPauseMenuHidden] = useState(false);
  const [wasPaused, setWasPaused] = useState(paused);
  if (wasPaused !== paused) {
    setWasPaused(paused);
    if (!paused) setPauseMenuHidden(false);
  }
  const pickingBars = paused && pauseMenuHidden && wide;

  const changeMode = (next: GameViewMode) => {
    setMode(next);
    writeLocal(VIEW_MODE_KEY, next);
  };

  const readBeat = useCallback(() => {
    if (session.state === "preparada") return null;
    return Math.max(session.plan.startBeat, positionAt(session.plan, session.now()).beat);
  }, [session]);

  const activeRange = useMemo(
    () => (plan.startBar === 1 && plan.endBar === chart.bars ? null : { startBar: plan.startBar, endBar: plan.endBar }),
    [plan, chart.bars],
  );

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Escape") return;
      event.preventDefault();
      if (session.state === "tocando") void session.pause();
      else if (session.state === "pausada") void session.resume();
    };
    const onHidden = () => {
      if (document.hidden) void session.pause();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [session]);

  const sectionIndex = sectionIndexAt(chart.sections, Math.max(plan.startBeat, position.beat));
  const sectionName = chart.sections[sectionIndex]?.name ?? "";
  const bar = Math.floor(Math.max(plan.startBeat, position.beat) / plan.beatsPerBar) + 1;
  const progress = plan.passSeconds > 0 ? ((position.beat - plan.startBeat) / (plan.endBeat - plan.startBeat)) * 100 : 0;
  const lanes = useMemo(() => track.lanes, [track]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-bold leading-tight">{chart.title}</p>
          <p className="text-xs text-muted-foreground">
            {INSTRUMENTS[track.instrument].name} · {Math.round(plan.rate * 100)} % ({Math.round(plan.bpm)} BPM) · compases{" "}
            {plan.startBar}–{plan.endBar}
            {plan.loop ? " · en bucle" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[mode]}
            onValueChange={(value) => value[0] && changeMode(value[0] as GameViewMode)}
            aria-label="Vista"
          >
            {VIEW_MODES.map(({ value, label, icon: Icon }) => (
              <ToggleGroupItem key={value} value={value} aria-label={label} title={label} data-testid={`vista-${value}`}>
                <Icon />
                <span className="hidden md:inline">{label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void (paused ? session.resume() : session.pause())}
            aria-label={paused ? "Continuar" : "Pausar"}
          >
            {paused ? <Play /> : <Pause />}
            <span className="hidden sm:inline">{paused ? "Continuar" : "Pausa"}</span>
            <kbd className="ml-1 hidden rounded bg-background/60 px-1 text-[10px] text-muted-foreground lg:inline">Esc</kbd>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void session.stop()} aria-label="Terminar" data-testid="terminar">
            <Square /> <span className="hidden sm:inline">Terminar</span>
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid flex-1 gap-3",
          wide ? "lg:grid-cols-[200px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]" : "lg:grid-cols-[1fr_minmax(0,520px)_1fr]",
        )}
      >
        <aside
          className={cn(
            "order-2 grid grid-cols-4 gap-2 lg:order-1 lg:grid-cols-1 lg:content-start",
            wide && "lg:col-start-1 lg:row-start-1",
          )}
        >
          <Stat label="Puntos" value={formatNumber(stats.score)} />
          <Stat label="Combo" value={String(stats.combo)} highlight={stats.combo >= 10} />
          <Stat label="Multiplicador" shortLabel="Mult." value={`×${stats.multiplier}`} highlight={stats.multiplier > 1} />
          <Stat label="Precisión" value={stats.judgedNotes + stats.counts.extra > 0 ? formatPercent(stats.accuracy) : "—"} />
        </aside>

        <div
          className={cn(
            "relative order-1 flex flex-col overflow-hidden rounded-2xl",
            wide ? "lg:col-start-2 lg:row-span-2 lg:row-start-1" : "lg:order-2",
          )}
        >
          {pickingBars && (
            <div
              role="status"
              className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/95 px-3 py-1.5"
            >
              <p className="text-sm">
                <span className="font-medium">En pausa.</span>{" "}
                <span className="text-muted-foreground">Toca un compás (A) y luego otro (B).</span>
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" onClick={() => void session.resume()}>
                  <Play /> Continuar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPauseMenuHidden(false)}>
                  Más opciones
                </Button>
              </div>
            </div>
          )}
          <div className={cn("flex min-h-0 flex-1 gap-3", mode === "dividida" ? "flex-col lg:flex-row" : "flex-col")}>
            {mode !== "partitura" && (
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-border/60 bg-black/30",
                  mode === "carril"
                    ? "min-h-[44vh] flex-1 lg:min-h-[64vh]"
                    : "order-2 h-[34vh] shrink-0 lg:order-1 lg:h-auto lg:min-h-[64vh] lg:w-[340px]",
                )}
              >
                <Highway session={session} lanes={lanes} keyLabels={keyLabels} />
              </div>
            )}
            {mode !== "carril" && (
              <ScoreView
                chart={chart}
                track={track}
                readBeat={readBeat}
                activeRange={activeRange}
                selection={selection}
                onSelectionChange={setSelection}
                footer={
                  selection && (
                    <SelectionBar
                      selection={selection}
                      onLoop={onLoopBars && (() => onLoopBars(selection))}
                      onClear={() => setSelection(null)}
                    />
                  )
                }
                className={cn(
                  mode === "partitura"
                    ? "h-[54vh] lg:h-[64vh]"
                    : "order-1 h-[30vh] shrink-0 lg:order-2 lg:h-auto lg:min-h-[64vh] lg:flex-1",
                )}
              />
            )}
          </div>
          {position.countIn && status === "tocando" && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span key={position.countInRemaining} className="font-heading text-8xl font-extrabold text-primary drop-shadow-lg animate-in zoom-in-50 fade-in duration-200">
                {position.countInRemaining}
              </span>
              <span className="rounded-full bg-background/70 px-3 py-1 text-sm text-muted-foreground">Prepárate…</span>
            </div>
          )}
          {paused && !pickingBars && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex w-64 flex-col gap-2 text-center">
                <p className="mb-2 font-heading text-2xl font-bold">En pausa</p>
                <Button size="lg" onClick={() => void session.resume()}>
                  <Play /> Continuar
                </Button>
                {wide && (
                  <Button size="lg" variant="secondary" onClick={() => setPauseMenuHidden(true)}>
                    <Repeat /> Elegir compases en la partitura
                  </Button>
                )}
                <Button size="lg" variant="secondary" onClick={onRestart}>
                  <RotateCcw /> Empezar de nuevo
                </Button>
                <Button size="lg" variant="outline" onClick={() => void session.stop()}>
                  <Square /> Terminar y ver resultados
                </Button>
                <Button size="lg" variant="ghost" onClick={onExit}>
                  <X /> Volver a los ajustes
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside
          className={cn(
            "order-3 flex flex-col gap-2 text-sm lg:content-start",
            wide && "hidden lg:col-start-1 lg:row-start-2 lg:flex",
          )}
        >
          <div className="rounded-xl border border-border/60 bg-card px-3 py-2 lg:p-3">
            <p className="hidden text-xs text-muted-foreground lg:block">Sección</p>
            <p className="flex items-baseline justify-between gap-2 lg:block">
              <span className="font-medium">{position.countIn ? "Cuenta atrás" : sectionName}</span>
              <span className="text-xs text-muted-foreground lg:hidden">
                c. {position.countIn ? plan.startBar : bar}
                {plan.loop && !position.countIn ? ` · vuelta ${position.pass + 1}` : ""}
              </span>
            </p>
            <p className="mt-1 hidden text-xs text-muted-foreground lg:block">
              Compás {position.countIn ? plan.startBar : bar}
              {plan.loop && !position.countIn ? ` · vuelta ${position.pass + 1}` : ""}
            </p>
            <Progress value={Math.min(100, Math.max(0, progress))} className="mt-2 lg:mt-3" aria-label="Progreso del tramo" />
          </div>
          <div className="hidden grid-cols-3 gap-2 lg:grid">
            <MiniCount label="Perfecto" value={stats.counts.perfecto} className="text-amber-400" />
            <MiniCount label="Bien" value={stats.counts.bien} className="text-green-400" />
            <MiniCount label="Regular" value={stats.counts.regular} className="text-sky-400" />
            <MiniCount label="Fallos" value={stats.counts.fallo} className="text-red-400" />
            <MiniCount label="De más" value={stats.counts.extra} />
            <MiniCount label="Carril" value={stats.counts.carrilEquivocado} className="text-orange-400" />
          </div>
        </aside>
      </div>

      <div className="mx-auto w-full max-w-[520px]">
        {mic ? (
          <div className="space-y-1.5 rounded-2xl border border-border/60 bg-card px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Mic className="size-4 text-primary" /> Micrófono activo
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {mic.classifies ? "Cada golpe va a su carril (experimental)" : "Cualquier golpe vale: cuenta el tiempo"}
              </span>
            </p>
            <MicLevelMeter mic={mic.input} />
          </div>
        ) : (
          <TouchPads instrument={track.instrument} lanes={lanes} keyLabels={keyLabels} source={touch} />
        )}
      </div>
    </div>
  );
}

function SelectionBar({
  selection,
  onLoop,
  onClear,
}: {
  selection: BarRange;
  onLoop?: () => void;
  onClear: () => void;
}) {
  const single = selection.startBar === selection.endBar;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/95 px-3 py-1.5 text-foreground shadow-lg backdrop-blur">
      <p className="min-w-0 text-sm">
        <span className="font-medium whitespace-nowrap">
          {single ? `Compás ${selection.startBar}` : `Compases ${selection.startBar}–${selection.endBar}`}
        </span>
        {single && (
          <span className="hidden text-xs text-muted-foreground sm:block">Toca otro compás para cerrar el tramo.</span>
        )}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        {onLoop && (
          <Button size="sm" onClick={onLoop}>
            <Repeat /> Practicar en bucle
          </Button>
        )}
        <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Quitar selección">
          <X />
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  shortLabel,
  value,
  highlight,
}: {
  label: string;
  shortLabel?: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-2.5 py-1.5 lg:px-3 lg:py-2">
      <p className="truncate text-[11px] text-muted-foreground uppercase">
        <span className={shortLabel ? "hidden lg:inline" : undefined}>{label}</span>
        {shortLabel && <span className="lg:hidden">{shortLabel}</span>}
      </p>
      <p className={`font-heading text-xl font-bold tabular-nums lg:text-3xl ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function MiniCount({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-1.5 text-center">
      <p className={`font-semibold tabular-nums ${className ?? ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
