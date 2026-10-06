"use client";

import { STROKES, strokeLabel } from "@/lib/chart/instruments";
import type { InstrumentId, StrokeId } from "@/lib/chart/types";
import type { TouchInputSource } from "@/lib/input/touch";

interface TouchPadsProps {
  instrument: InstrumentId;
  lanes: StrokeId[];
  keyLabels: string[];
  source: TouchInputSource;
}

export function TouchPads({ instrument, lanes, keyLabels, source }: TouchPadsProps) {
  return (
    <div className="grid touch-none gap-2 select-none" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
      {lanes.map((stroke, lane) => {
        const color = STROKES[stroke].color;
        return (
          <button
            key={stroke}
            type="button"
            tabIndex={-1}
            onPointerDown={(event) => {
              event.preventDefault();
              source.press(lane, event.timeStamp);
            }}
            onContextMenu={(event) => event.preventDefault()}
            className="flex h-20 flex-col items-center justify-center rounded-2xl border-2 text-sm font-semibold transition-transform active:scale-95 active:brightness-150 sm:h-16"
            style={{ borderColor: color, background: `${color}26`, color }}
            aria-label={`Tocar ${strokeLabel(instrument, stroke)}`}
          >
            <span>{strokeLabel(instrument, stroke)}</span>
            <span className="hidden text-xs font-normal text-foreground/60 sm:block">{keyLabels[lane]}</span>
          </button>
        );
      })}
    </div>
  );
}
