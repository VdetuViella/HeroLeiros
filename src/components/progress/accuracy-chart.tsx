import type { TrendPoint } from "@/server/progress/queries";
import { formatPercent } from "@/lib/format";

import { formatDay } from "./format";

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 40 };
const GRID = [0.25, 0.5, 0.75, 1];

function dayIndex(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

/** Evolución de la precisión por día: media (línea) y mejor marca (puntos). SVG sin dependencias. */
export function AccuracyChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return null;

  const first = dayIndex(points[0].day);
  const last = dayIndex(points.at(-1)!.day);
  const span = Math.max(last - first, 1);
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (day: string) =>
    points.length === 1 ? PAD.left + innerW / 2 : PAD.left + ((dayIndex(day) - first) / span) * innerW;
  const y = (value: number) => PAD.top + (1 - value) * innerH;

  const meanPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(p.meanAccuracy).toFixed(1)}`).join(" ");
  const area = `${meanPath} L${x(points.at(-1)!.day).toFixed(1)},${y(0)} L${x(points[0].day).toFixed(1)},${y(0)} Z`;
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Precisión media por día, de ${formatDay(points[0].day)} a ${formatDay(points.at(-1)!.day)}`}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {GRID.map((g) => (
          <g key={g}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(g)} y2={y(g)} className="stroke-border" strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={y(g) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        <path d={area} fill="url(#trend-fill)" />
        <path d={meanPath} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.day}>
            <circle cx={x(p.day)} cy={y(p.meanAccuracy)} r={3.5} fill="var(--color-primary)">
              <title>
                {`${formatDay(p.day)}: media ${formatPercent(p.meanAccuracy)}, mejor ${formatPercent(p.bestAccuracy)} · ${p.attempts} ${p.attempts === 1 ? "partida" : "partidas"}`}
              </title>
            </circle>
            <circle cx={x(p.day)} cy={y(p.bestAccuracy)} r={3} className="fill-emerald-400" opacity={0.85} />
            {i % labelEvery === 0 && (
              <text x={x(p.day)} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {formatDay(p.day)}
              </text>
            )}
          </g>
        ))}
      </svg>
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
