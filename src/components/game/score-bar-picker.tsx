"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Music } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Chart, ChartTrack } from "@/lib/chart/types";
import type { BarRange } from "@/lib/notation/layout";

// VexFlow solo se carga si se abre el selector.
const ScoreView = dynamic(() => import("@/components/notation/score-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[55vh] items-center justify-center gap-2 rounded-2xl bg-[#f6f1e7] text-sm text-stone-600">
      <Loader2 className="size-4 animate-spin" /> Cargando partitura…
    </div>
  ),
});

function rangeLabel(range: BarRange): string {
  return range.startBar === range.endBar ? `Compás ${range.startBar}` : `Compases ${range.startBar}–${range.endBar}`;
}

interface ScoreBarPickerProps {
  chart: Chart;
  track: ChartTrack;
  value: BarRange;
  onChange: (range: BarRange) => void;
}

/** Elegir el tramo A-B mirando la partitura, antes de empezar a tocar. */
export function ScoreBarPicker({ chart, track, value, onChange }: ScoreBarPickerProps) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<BarRange | null>(null);

  const openPicker = () => {
    setSelection(value);
    setOpen(true);
  };

  const confirm = () => {
    if (selection) onChange(selection);
    setOpen(false);
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={openPicker}>
        <Music /> Elegir en la partitura
      </Button>
      <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
        <DialogContent showCloseButton={false} className="max-h-[92vh] sm:max-w-3xl" data-testid="elegir-compases">
          <DialogHeader>
            <DialogTitle>Elige los compases</DialogTitle>
            <DialogDescription>
              Toca un compás (A) y luego otro (B), o arrastra de uno a otro. Con un tramo marcado, Mayús + clic lo
              amplía.
            </DialogDescription>
          </DialogHeader>
          {open && (
            <ScoreView chart={chart} track={track} selection={selection} onSelectionChange={setSelection} className="h-[55vh]" />
          )}
          <DialogFooter className="items-center">
            <p className="text-sm sm:mr-auto" aria-live="polite">
              {selection ? (
                <>
                  <span className="font-medium">{rangeLabel(selection)}</span>
                  {selection.startBar === selection.endBar && (
                    <span className="text-muted-foreground"> · toca otro compás para cerrar el tramo</span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Ningún compás marcado</span>
              )}
            </p>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!selection} onClick={confirm}>
              Usar estos compases
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
