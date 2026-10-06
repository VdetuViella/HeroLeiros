"use client";

import { useEffect, useMemo, useRef } from "react";

import type { InstrumentId, StrokeId } from "@/lib/chart/types";
import { legendFor, type LegendEntry } from "@/lib/notation/symbols";

import { LEGEND_GLYPH_HEIGHT, LEGEND_GLYPH_WIDTH, renderLegendGlyph } from "./render-score";

interface ScoreLegendProps {
  instrument: InstrumentId;
  strokes: readonly StrokeId[];
  /** Las fuentes de VexFlow ya están cargadas. */
  ready: boolean;
}

export function ScoreLegend({ instrument, strokes, ready }: ScoreLegendProps) {
  const entries = useMemo(() => legendFor(instrument, strokes), [instrument, strokes]);
  return (
    <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2" aria-label="Leyenda de símbolos">
      {entries.map((entry) => (
        <li key={entry.stroke} className="flex items-center gap-2">
          <LegendGlyph entry={entry} ready={ready} />
          <p className="min-w-0 text-xs leading-snug text-stone-600">
            <span className="font-semibold text-stone-900">{entry.label}.</span> {entry.symbol.description}
          </p>
        </li>
      ))}
    </ul>
  );
}

function LegendGlyph({ entry, ready }: { entry: LegendEntry; ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ready || !ref.current) return;
    renderLegendGlyph(ref.current, entry.symbol, entry.accent);
  }, [entry, ready]);
  return (
    <div ref={ref} className="shrink-0" style={{ width: LEGEND_GLYPH_WIDTH, height: LEGEND_GLYPH_HEIGHT }} aria-hidden />
  );
}
