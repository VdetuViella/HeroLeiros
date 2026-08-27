import { Badge } from "@/components/ui/badge";
import type { Health } from "@/data/diagnostics";

const labels: Record<Health, string> = {
  ok: "Operativo",
  action: "Requiere acción",
  partial: "Parcial",
};

const classNames: Record<Health, string> = {
  ok: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  action: "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300",
  partial: "border-transparent bg-sky-500/15 text-sky-800 dark:text-sky-300",
};

export function StatusBadge({ health }: { health: Health }) {
  return (
    <Badge variant="outline" className={classNames[health]}>
      {labels[health]}
    </Badge>
  );
}
