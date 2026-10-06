"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Pause, Play, RotateCcw, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { INSTRUMENTS } from "@/lib/chart/instruments";
import { sectionIndexAt } from "@/lib/chart/query";
import type { Chart } from "@/lib/chart/types";
import { formatNumber, formatPercent } from "@/lib/format";
import type { TouchInputSource } from "@/lib/input/touch";
import type { GameSession } from "@/lib/session/game-session";
import type { SessionPosition } from "@/lib/session/timeline";
import { positionAt } from "@/lib/session/timeline";

import { Highway } from "./highway";
import { TouchPads } from "./touch-pads";

interface GameViewProps {
  session: GameSession;
  chart: Chart;
  keyLabels: string[];
  touch: TouchInputSource;
  onRestart: () => void;
  onExit: () => void;
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

export function GameView({ session, chart, keyLabels, touch, onRestart, onExit }: GameViewProps) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const position = usePosition(session);
  const { plan, track } = session;
  const { stats, status } = snapshot;
  const paused = status === "pausada";

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
          <Button variant="outline" size="sm" onClick={() => void session.stop()}>
            <Square /> <span className="hidden sm:inline">Terminar</span>
          </Button>
        </div>
      </div>

      <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_minmax(0,520px)_1fr]">
        <aside className="order-2 grid grid-cols-4 gap-2 lg:order-1 lg:grid-cols-1 lg:content-start">
          <Stat label="Puntos" value={formatNumber(stats.score)} />
          <Stat label="Combo" value={String(stats.combo)} highlight={stats.combo >= 10} />
          <Stat label="Multiplicador" value={`×${stats.multiplier}`} highlight={stats.multiplier > 1} />
          <Stat label="Precisión" value={stats.judgedNotes + stats.counts.extra > 0 ? formatPercent(stats.accuracy) : "—"} />
        </aside>

        <div className="relative order-1 flex min-h-[52vh] flex-col overflow-hidden rounded-2xl border border-border/60 bg-black/30 lg:order-2 lg:min-h-[64vh]">
          <Highway session={session} lanes={lanes} keyLabels={keyLabels} />
          {position.countIn && status === "tocando" && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span key={position.countInRemaining} className="font-heading text-8xl font-extrabold text-primary drop-shadow-lg animate-in zoom-in-50 fade-in duration-200">
                {position.countInRemaining}
              </span>
              <span className="rounded-full bg-background/70 px-3 py-1 text-sm text-muted-foreground">Prepárate…</span>
            </div>
          )}
          {paused && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex w-64 flex-col gap-2 text-center">
                <p className="mb-2 font-heading text-2xl font-bold">En pausa</p>
                <Button size="lg" onClick={() => void session.resume()}>
                  <Play /> Continuar
                </Button>
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

        <aside className="order-3 flex flex-col gap-2 text-sm lg:content-start">
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-xs text-muted-foreground">Sección</p>
            <p className="font-medium">{position.countIn ? "Cuenta atrás" : sectionName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Compás {position.countIn ? plan.startBar : bar}
              {plan.loop && !position.countIn ? ` · vuelta ${position.pass + 1}` : ""}
            </p>
            <Progress value={Math.min(100, Math.max(0, progress))} className="mt-3" aria-label="Progreso del tramo" />
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
        <TouchPads instrument={track.instrument} lanes={lanes} keyLabels={keyLabels} source={touch} />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
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
