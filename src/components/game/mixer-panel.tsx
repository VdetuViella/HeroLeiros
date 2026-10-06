"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { TrackMix } from "@/lib/audio/engine";
import { DEFAULT_MIX } from "@/lib/audio/engine";
import { INSTRUMENTS } from "@/lib/chart/instruments";
import type { Chart, InstrumentId } from "@/lib/chart/types";
import { cn } from "@/lib/utils";

export type MixState = Partial<Record<InstrumentId, TrackMix>>;

interface MixerPanelProps {
  chart: Chart;
  instrument: InstrumentId;
  mix: MixState;
  onChange: (instrument: InstrumentId, mix: Partial<TrackMix>) => void;
}

export function MixerPanel({ chart, instrument, mix, onChange }: MixerPanelProps) {
  return (
    <ul className="space-y-1.5">
      {chart.tracks.map((track) => {
        const state = mix[track.instrument] ?? DEFAULT_MIX;
        const name = INSTRUMENTS[track.instrument].name;
        return (
          <li key={track.instrument} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3">
            <span className="flex items-center gap-1.5 truncate text-sm">
              {name}
              {track.instrument === instrument && <Badge variant="secondary">Tú</Badge>}
            </span>
            <Slider
              min={-30}
              max={6}
              step={1}
              value={state.volumeDb}
              onValueChange={(value) => onChange(track.instrument, { volumeDb: Array.isArray(value) ? value[0] : value })}
              aria-label={`Volumen de ${name}`}
              className={cn(state.mute && "opacity-40")}
            />
            <div className="flex gap-1">
              <Button
                size="icon-sm"
                variant={state.mute ? "destructive" : "outline"}
                aria-pressed={state.mute}
                aria-label={`Silenciar ${name}`}
                onClick={() => onChange(track.instrument, { mute: !state.mute })}
              >
                M
              </Button>
              <Button
                size="icon-sm"
                variant={state.solo ? "default" : "outline"}
                aria-pressed={state.solo}
                aria-label={`Solo de ${name}`}
                onClick={() => onChange(track.instrument, { solo: !state.solo })}
              >
                S
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
