import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function accuracyTone(accuracy: number): string {
  if (accuracy >= 0.9) return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (accuracy >= 0.75) return "bg-lime-500/15 text-lime-300 ring-lime-500/30";
  if (accuracy >= 0.6) return "bg-amber-500/15 text-amber-300 ring-amber-500/30";
  return "bg-red-500/15 text-red-300 ring-red-500/30";
}

export function AccuracyBadge({ accuracy, className }: { accuracy: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-14 justify-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ring-1 ring-inset",
        accuracyTone(accuracy),
        className,
      )}
    >
      {formatPercent(accuracy)}
    </span>
  );
}
