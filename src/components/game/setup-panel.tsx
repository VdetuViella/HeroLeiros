"use client";

import Link from "next/link";
import { AlertCircle, Headphones, Keyboard, Loader2, Mic, Play, Timer } from "lucide-react";

import { MicSetup } from "@/components/mic/mic-setup";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TrackMix } from "@/lib/audio/engine";
import type { AttemptResult } from "@/lib/attempts/types";
import { INSTRUMENTS, STROKES, strokeLabel } from "@/lib/chart/instruments";
import { getTrack } from "@/lib/chart/query";
import type { Chart, ChartTrack, InstrumentId } from "@/lib/chart/types";
import { formatDuration, formatPercent } from "@/lib/format";
import type { InputMethod, MicPreferences, MicPreferencesUpdate } from "@/lib/mic/settings";
import type { GuideMode } from "@/lib/session/game-session";
import { MAX_RATE, MIN_RATE, resolveRange, type PracticeSettings } from "@/lib/session/practice";
import { cn } from "@/lib/utils";

import { KeymapEditor } from "./keymap-editor";
import { ScoreBarPicker } from "./score-bar-picker";
import { MixerPanel, type MixState } from "./mixer-panel";

interface SetupPanelProps {
  chart: Chart;
  settings: PracticeSettings;
  onSettingsChange: (patch: Partial<PracticeSettings>) => void;
  mix: MixState;
  onMixChange: (instrument: InstrumentId, mix: Partial<TrackMix>) => void;
  keymap: string[];
  onKeymapChange: (keymap: string[]) => void;
  /** Latencia calibrada del método de entrada elegido. */
  latencyMs: number;
  best: Partial<Record<InstrumentId, AttemptResult>>;
  preparing: boolean;
  error: string | null;
  onPlay: () => void;
  inputMethod: InputMethod;
  onInputMethodChange: (method: InputMethod) => void;
  micPrefs: MicPreferences;
  onMicPrefsChange: (update: MicPreferencesUpdate) => void;
}

const GUIDE_OPTIONS: { value: GuideMode; label: string }[] = [
  { value: "silenciada", label: "Silenciada" },
  { value: "baja", label: "Baja" },
  { value: "normal", label: "Normal" },
];

export function SetupPanel(props: SetupPanelProps) {
  const { chart, settings, onSettingsChange, best } = props;
  const track = getTrack(chart, settings.instrument) ?? chart.tracks[0];
  const range = resolveRange(chart, settings);
  const rangeBeats = (range.endBar - range.startBar + 1) * chart.beatsPerBar;
  const rangeSeconds = (rangeBeats * 60) / (chart.bpm * settings.rate);
  const notesInRange = track.notes.filter((n) => n.bar >= range.startBar && n.bar <= range.endBar).length;

  const rangeValue = settings.rangeMode === "seccion" ? `seccion:${settings.sectionIndex}` : settings.rangeMode;
  const rangeItems = [
    { value: "cancion", label: `Canción completa (c. 1–${chart.bars})` },
    ...chart.sections.map((s, i) => ({ value: `seccion:${i}`, label: `${s.name} (c. ${s.startBar}–${s.endBar})` })),
    { value: "compases", label: "Compases a medida…" },
  ];
  const barItems = Array.from({ length: chart.bars }, (_, i) => ({ value: String(i + 1), label: `Compás ${i + 1}` }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Canciones
        </Link>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{chart.title}</h1>
        <p className="text-muted-foreground">
          {chart.artist ? `${chart.artist} · ` : ""}
          {chart.bpm} BPM · compás {chart.timeSignature.join("/")} · {chart.bars} compases · {formatDuration(chart.durationSeconds)}
        </p>
        {chart.description && <p className="max-w-3xl text-sm text-muted-foreground">{chart.description}</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section aria-labelledby="instrumento" className="space-y-3">
          <h2 id="instrumento" className="font-heading text-lg font-bold">
            1. Elige tu instrumento
          </h2>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Instrumento">
            {chart.tracks.map((t) => {
              const def = INSTRUMENTS[t.instrument];
              const selected = t.instrument === settings.instrument;
              const record = best[t.instrument];
              return (
                <button
                  key={t.instrument}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSettingsChange({ instrument: t.instrument })}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                    selected ? "border-primary ring-1 ring-primary" : "border-border",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{def.name}</span>
                    {record && <Badge variant="secondary">Mejor {formatPercent(record.accuracy)}</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">{def.description}</span>
                  <span className="flex flex-wrap gap-1">
                    {t.lanes.map((stroke) => (
                      <span
                        key={stroke}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: `${STROKES[stroke].color}26`, color: STROKES[stroke].color }}
                      >
                        {strokeLabel(t.instrument, stroke)}
                      </span>
                    ))}
                    <span className="ml-auto text-[11px] text-muted-foreground">{t.notes.length} notas</span>
                  </span>
                </button>
              );
            })}
          </div>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Cómo vas a tocar</CardTitle>
              <CardDescription>
                {props.inputMethod === "microfono"
                  ? "Con tu instrumento de verdad delante del micrófono."
                  : "En pantallas táctiles también puedes tocar los pads de debajo del carril."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleGroup
                variant="outline"
                className="w-full"
                value={[props.inputMethod]}
                onValueChange={(value) => value[0] && props.onInputMethodChange(value[0] as InputMethod)}
                aria-label="Método de entrada"
              >
                <ToggleGroupItem value="teclado" className="flex-1">
                  <Keyboard /> Teclado o pantalla
                </ToggleGroupItem>
                <ToggleGroupItem value="microfono" className="flex-1" data-testid="entrada-microfono">
                  <Mic /> Micrófono
                </ToggleGroupItem>
              </ToggleGroup>
              {props.inputMethod === "microfono" ? (
                <MicSetup
                  prefs={props.micPrefs}
                  onChange={props.onMicPrefsChange}
                  latencyMs={props.latencyMs}
                  instrument={track.instrument}
                  lanes={track.lanes}
                />
              ) : (
                <KeymapEditor
                  instrument={track.instrument}
                  lanes={track.lanes}
                  keymap={props.keymap}
                  onChange={props.onKeymapChange}
                />
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="practica" className="space-y-3">
          <h2 id="practica" className="font-heading text-lg font-bold">
            2. Ajusta la práctica
          </h2>
          <Card>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Velocidad</Label>
                  <span className="text-sm tabular-nums">
                    {Math.round(settings.rate * 100)} % · {Math.round(chart.bpm * settings.rate)} BPM
                  </span>
                </div>
                <Slider
                  min={MIN_RATE * 100}
                  max={MAX_RATE * 100}
                  step={5}
                  value={Math.round(settings.rate * 100)}
                  onValueChange={(value) => onSettingsChange({ rate: (Array.isArray(value) ? value[0] : value) / 100 })}
                  aria-label="Velocidad"
                />
              </div>

              <div className="space-y-2">
                <Label>Tramo</Label>
                <Select
                  items={rangeItems}
                  value={rangeValue}
                  onValueChange={(value) => {
                    if (!value) return;
                    if (value.startsWith("seccion:")) {
                      onSettingsChange({ rangeMode: "seccion", sectionIndex: Number(value.split(":")[1]) });
                    } else if (value === "compases") {
                      onSettingsChange({ rangeMode: "compases", startBar: range.startBar, endBar: range.endBar });
                    } else {
                      onSettingsChange({ rangeMode: "cancion" });
                    }
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Tramo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rangeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {settings.rangeMode === "compases" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <ScoreBarPicker
                        chart={chart}
                        track={track}
                        value={{ startBar: settings.startBar, endBar: settings.endBar }}
                        onChange={(picked) => onSettingsChange({ startBar: picked.startBar, endBar: picked.endBar })}
                      />
                    </div>
                    <BarSelect
                      label="Desde (A)"
                      items={barItems}
                      value={settings.startBar}
                      onChange={(bar) => onSettingsChange({ startBar: bar, endBar: Math.max(bar, settings.endBar) })}
                    />
                    <BarSelect
                      label="Hasta (B)"
                      items={barItems}
                      value={settings.endBar}
                      onChange={(bar) => onSettingsChange({ endBar: bar, startBar: Math.min(bar, settings.startBar) })}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {notesInRange} notas para ti · {formatDuration(rangeSeconds)} por vuelta
                </p>
              </div>

              <ToggleRow
                id="bucle"
                label="Repetir en bucle"
                hint="Vuelve al compás A al llegar a B hasta que pulses «Terminar»."
                checked={settings.loop}
                onChange={(loop) => onSettingsChange({ loop })}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Cuenta atrás</Label>
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  value={[String(settings.countInBars)]}
                  onValueChange={(value) => value[0] && onSettingsChange({ countInBars: Number(value[0]) })}
                >
                  <ToggleGroupItem value="1">1 compás</ToggleGroupItem>
                  <ToggleGroupItem value="2">2 compases</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <ToggleRow
                id="metronomo"
                label="Metrónomo"
                hint="Clic en cada pulso durante la canción."
                checked={settings.metronome}
                onChange={(metronome) => onSettingsChange({ metronome })}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label>Tu pista en el acompañamiento</Label>
                  <p className="text-xs text-muted-foreground">Silénciala para tocarla tú, o déjala de guía.</p>
                </div>
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  value={[settings.guide]}
                  onValueChange={(value) => value[0] && onSettingsChange({ guide: value[0] as GuideMode })}
                >
                  {GUIDE_OPTIONS.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value}>
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {props.inputMethod !== "microfono" && (
                <ToggleRow
                  id="golpes"
                  label="Sonido al tocar"
                  hint="Oyes tu golpe al pulsar cada tecla o pad."
                  checked={settings.hitSounds}
                  onChange={(hitSounds) => onSettingsChange({ hitSounds })}
                />
              )}
            </CardContent>
          </Card>

          <PlayBar {...props} track={track} className="hidden lg:block" />

          <Card size="sm">
            <CardHeader>
              <CardTitle>Mezcla del grupo</CardTitle>
              <CardDescription>Volumen, silencio (M) y solo (S) de cada instrumento.</CardDescription>
            </CardHeader>
            <CardContent>
              <MixerPanel chart={chart} instrument={settings.instrument} mix={props.mix} onChange={props.onMixChange} />
            </CardContent>
          </Card>
        </section>
      </div>

      <PlayBar
        {...props}
        track={track}
        className="sticky bottom-3 z-10 rounded-2xl border border-border/60 bg-background/90 p-3 backdrop-blur lg:hidden"
      />
    </div>
  );
}

function PlayBar({
  track,
  latencyMs,
  preparing,
  error,
  onPlay,
  inputMethod,
  micPrefs,
  className,
}: Pick<SetupPanelProps, "latencyMs" | "preparing" | "error" | "onPlay" | "inputMethod" | "micPrefs"> & {
  track: ChartTrack;
  className?: string;
}) {
  const mic = inputMethod === "microfono";
  return (
    <div className={cn("space-y-2", className)}>
      {error && (
        <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      <Button size="lg" className="h-12 w-full text-base" onClick={onPlay} disabled={preparing} data-testid="tocar">
        {preparing ? <Loader2 className="animate-spin" /> : mic ? <Mic /> : <Play />}
        {preparing
          ? mic
            ? "Preparando sonidos y micrófono…"
            : "Preparando sonidos…"
          : `Tocar ${INSTRUMENTS[track.instrument].name}${mic ? " con micrófono" : ""}`}
      </Button>
      {mic && !micPrefs.headphones && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-amber-300">
          <Headphones className="size-3.5" /> Ponte auriculares para que el micro no oiga el acompañamiento.
        </p>
      )}
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Timer className="size-3.5" />
        Latencia {mic ? "del micrófono" : "calibrada"}: {latencyMs} ms ·{" "}
        <Link href={mic ? "/calibracion?entrada=microfono" : "/calibracion"} className="underline underline-offset-2 hover:text-foreground">
          calibrar
        </Link>
      </p>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function BarSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; label: string }[];
  value: number;
  onChange: (bar: number) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select items={items} value={String(value)} onValueChange={(v) => v && onChange(Number(v))}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
