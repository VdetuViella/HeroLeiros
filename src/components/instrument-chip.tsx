import { INSTRUMENTS, STROKES } from "@/lib/chart/instruments";
import type { ChartTrack } from "@/lib/chart/types";
import { cn } from "@/lib/utils";

export function InstrumentChip({ track, className }: { track: ChartTrack; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs",
        className,
      )}
    >
      <span className="flex gap-0.5" aria-hidden>
        {track.lanes.map((stroke) => (
          <span key={stroke} className="size-1.5 rounded-full" style={{ background: STROKES[stroke].color }} />
        ))}
      </span>
      {INSTRUMENTS[track.instrument].name}
    </span>
  );
}
