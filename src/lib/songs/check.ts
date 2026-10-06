import { INSTRUMENTS, STROKES } from "../chart/instruments";
import type { Chart, StrokeId } from "../chart/types";
import { loadSong, SONGS_DIR } from "./load";

export interface SongCheckReport {
  slug: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  chart: Chart | null;
}

export async function checkSong(slug: string, dir = SONGS_DIR): Promise<SongCheckReport> {
  try {
    const { chart, metaErrors } = await loadSong(slug, dir);
    const errors = [...metaErrors];
    if (chart.tracks.length === 0) errors.push("No hay ninguna pista con notas jugables.");
    const warnings = chart.warnings.map((w) => w.message);
    return { slug, ok: errors.length === 0, errors, warnings, chart };
  } catch (error) {
    return { slug, ok: false, errors: [(error as Error).message], warnings: [], chart: null };
  }
}

function strokeCounts(notes: { stroke: StrokeId }[]): string {
  const counts = new Map<StrokeId, number>();
  for (const note of notes) counts.set(note.stroke, (counts.get(note.stroke) ?? 0) + 1);
  return [...counts.entries()].map(([stroke, n]) => `${STROKES[stroke].label.toLowerCase()} ${n}`).join(", ");
}

export function formatReport(report: SongCheckReport): string {
  const lines: string[] = [];
  const { chart } = report;
  lines.push(`${report.ok ? "✔" : "✖"} ${report.slug}${chart ? ` — «${chart.title}»` : ""}`);

  if (chart) {
    lines.push(
      `  ${chart.bpm} BPM · compás ${chart.timeSignature.join("/")} · ${chart.bars} compases · ${formatDuration(chart.durationSeconds)}`,
    );
    lines.push("  Pistas:");
    for (const track of chart.tracks) {
      const accents = track.notes.filter((n) => n.accent).length;
      lines.push(
        `    · ${track.sourceTrackNames.join(" + ")} → ${INSTRUMENTS[track.instrument].name}: ${track.notes.length} notas (${strokeCounts(track.notes)}${accents ? `; ${accents} acentos` : ""})`,
      );
    }
    if (chart.unmapped.length > 0) {
      lines.push("  Notas sin mapear:");
      for (const entry of chart.unmapped) {
        const where = entry.instrument ? INSTRUMENTS[entry.instrument].name : "pista desconocida";
        lines.push(`    · «${entry.trackName}» (${where}): nota ${entry.midi} × ${entry.count}`);
      }
    }
    lines.push("  Secciones:");
    for (const section of chart.sections) {
      lines.push(`    · ${section.name}: compases ${section.startBar}–${section.endBar}`);
    }
  }

  for (const warning of report.warnings) lines.push(`  ⚠ ${warning}`);
  for (const error of report.errors) lines.push(`  ✖ ${error}`);
  return lines.join("\n");
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
