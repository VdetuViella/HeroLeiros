import type { TrendPoint } from "@/server/progress/queries";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

import { formatDay } from "./format";

const GRID = [0.25, 0.5, 0.75, 1];

function dayIndex(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

function describe(p: TrendPoint): string {
  return `${formatDay(p.day)}: media ${formatPercent(p.meanAccuracy)}, mejor ${formatPercent(p.bestAccuracy)} · ${p.attempts} ${p.attempts === 1 ? "partida" : "partidas"}`;
}

/**
 * Evolución de la precisión por día: media (línea) y mejor partida (puntos).
 * Las líneas van en un SVG estirado al contenedor; puntos y etiquetas son HTML
 * para que el texto no cambie de tamaño con el ancho de la pantalla.
 */
export function AccuracyChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return null;

  const first = dayIndex(points[0].day);
  const span = Math.max(dayIndex(points.at(-1)!.day) - first, 1);
  const x = (day: string) => (points.length === 1 ? 50 : ((dayIndex(day) - first) / span) * 100);
  const y = (value: number) => (1 - value) * 100;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(2)},${y(p.meanAccuracy).toFixed(2)}`).join(" ");
  const area = `${line} L${x(points.at(-1)!.day).toFixed(2)},100 L${x(points[0].day).toFixed(2)},100 Z`;
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <figure className="space-y-3">
      <div className="flex gap-2">
        <div className="relative w-9 shrink-0 text-right text-[11px] text-muted-foreground" aria-hidden>
          {GRID.map((g) => (
            <span key={g} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(g)}%` }}>
              {Math.round(g * 100)}%
            </span>
          ))}
        </div>
        <div className="flex-1">
          <div className="relative h-48 sm:h-60">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
              <defs>
                <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {GRID.map((g) => (
                <line
                  key={g}
                  x1={0}
                  x2={100}
                  y1={y(g)}
                  y2={y(g)}
                  className="stroke-border"
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path d={area} fill="url(#trend-fill)" />
              <path
                d={line}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {points.map((p) => (
              <span key={p.day} title={describe(p)}>
                <span
                  className="absolute size-2 -translate-1/2 rounded-full bg-emerald-400/90"
                  style={{ left: `${x(p.day)}%`, top: `${y(p.bestAccuracy)}%` }}
                />
                <span
                  className="absolute size-2.5 -translate-1/2 rounded-full border-2 border-card bg-primary"
                  style={{ left: `${x(p.day)}%`, top: `${y(p.meanAccuracy)}%` }}
                />
              </span>
            ))}
          </div>
          <div className="relative mt-2 h-4 text-[11px] text-muted-foreground" aria-hidden>
            {points.map((p, i) =>
              i % labelEvery === 0 ? (
                <span
                  key={p.day}
                  className={cn(
                    "absolute whitespace-nowrap",
                    x(p.day) < 8 ? "translate-x-0" : x(p.day) > 92 ? "-translate-x-full" : "-translate-x-1/2",
                  )}
                  style={{ left: `${x(p.day)}%` }}
                >
                  {formatDay(p.day)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <figcaption className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-primary" aria-hidden /> Precisión media del día
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-400" aria-hidden /> Mejor partida del día
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Precisión por día</caption>
        <thead>
          <tr>
            <th>Día</th>
            <th>Media</th>
            <th>Mejor</th>
            <th>Partidas</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <td>{formatDay(p.day)}</td>
              <td>{formatPercent(p.meanAccuracy)}</td>
              <td>{formatPercent(p.bestAccuracy)}</td>
              <td>{p.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
