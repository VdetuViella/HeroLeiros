"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { STROKES, strokeLabel } from "@/lib/chart/instruments";
import type { InstrumentId, StrokeId } from "@/lib/chart/types";
import { assignKey, defaultKeymap, keyLabel, RESERVED_KEYS } from "@/lib/input/keymap";

interface KeymapEditorProps {
  instrument: InstrumentId;
  lanes: StrokeId[];
  keymap: string[];
  onChange: (keymap: string[]) => void;
}

export function KeymapEditor({ instrument, lanes, keymap, onChange }: KeymapEditorProps) {
  const [listening, setListening] = useState<number | null>(null);

  useEffect(() => {
    if (listening === null) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!RESERVED_KEYS.has(event.code)) onChange(assignKey(keymap, listening, event.code));
      setListening(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [listening, keymap, onChange]);

  return (
    <div className="space-y-2">
      <ul className="grid gap-2 sm:grid-cols-2">
        {lanes.map((stroke, lane) => (
          <li key={stroke} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <span className="flex items-center gap-2 text-sm">
              <span className="size-2.5 rounded-full" style={{ background: STROKES[stroke].color }} aria-hidden />
              {strokeLabel(instrument, stroke)}
            </span>
            <Button
              variant={listening === lane ? "default" : "outline"}
              size="sm"
              className="min-w-20 font-mono"
              onClick={() => setListening(listening === lane ? null : lane)}
              aria-label={`Cambiar tecla de ${strokeLabel(instrument, stroke)} (ahora ${keyLabel(keymap[lane])})`}
            >
              {listening === lane ? "Pulsa…" : keyLabel(keymap[lane])}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Haz clic en una tecla y pulsa la nueva. Esc para cancelar.</span>
        <Button variant="ghost" size="xs" onClick={() => onChange(defaultKeymap(lanes.length))}>
          <RotateCcw /> Restablecer
        </Button>
      </div>
    </div>
  );
}
