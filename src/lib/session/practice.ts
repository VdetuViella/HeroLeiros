import { getTrack } from "../chart/query";
import type { Chart, InstrumentId } from "../chart/types";
import type { GuideMode } from "./game-session";

export type RangeMode = "cancion" | "seccion" | "compases";

export interface PracticeSettings {
  instrument: InstrumentId;
  /** 0.5..1 */
  rate: number;
  rangeMode: RangeMode;
  sectionIndex: number;
  startBar: number;
  endBar: number;
  loop: boolean;
  countInBars: number;
  metronome: boolean;
  guide: GuideMode;
  hitSounds: boolean;
}

export const MIN_RATE = 0.5;
export const MAX_RATE = 1;

export function defaultPracticeSettings(chart: Chart, overrides: Partial<PracticeSettings> = {}): PracticeSettings {
  const base: PracticeSettings = {
    instrument: chart.tracks[0]?.instrument ?? "surdo1",
    rate: 1,
    rangeMode: "cancion",
    sectionIndex: 0,
    startBar: 1,
    endBar: chart.bars,
    loop: false,
    countInBars: 1,
    metronome: false,
    guide: "silenciada",
    hitSounds: true,
  };
  return { ...base, ...overrides };
}

/** Corrige ajustes guardados que ya no encajan con la canción (p. ej. tras editarla). */
export function sanitizeSettings(
  chart: Chart,
  raw: Partial<PracticeSettings> | null,
  defaults: Partial<PracticeSettings> = {},
): PracticeSettings {
  const base = defaultPracticeSettings(chart, defaults);
  if (!raw) return base;
  const merged = { ...base, ...raw };
  if (!getTrack(chart, merged.instrument)) merged.instrument = base.instrument;
  merged.rate = Math.min(MAX_RATE, Math.max(MIN_RATE, Number(merged.rate) || 1));
  if (!["cancion", "seccion", "compases"].includes(merged.rangeMode)) merged.rangeMode = "cancion";
  if (merged.sectionIndex < 0 || merged.sectionIndex >= chart.sections.length) merged.sectionIndex = 0;
  merged.startBar = Math.min(chart.bars, Math.max(1, Math.round(merged.startBar)));
  merged.endBar = Math.min(chart.bars, Math.max(merged.startBar, Math.round(merged.endBar)));
  merged.countInBars = merged.countInBars === 2 ? 2 : 1;
  if (!["silenciada", "baja", "normal"].includes(merged.guide)) merged.guide = base.guide;
  return merged;
}

export function resolveRange(chart: Chart, settings: PracticeSettings): { startBar: number; endBar: number } {
  switch (settings.rangeMode) {
    case "cancion":
      return { startBar: 1, endBar: chart.bars };
    case "seccion": {
      const section = chart.sections[settings.sectionIndex] ?? chart.sections[0];
      return { startBar: section.startBar, endBar: section.endBar };
    }
    case "compases":
      return { startBar: settings.startBar, endBar: settings.endBar };
    default: {
      const exhaustive: never = settings.rangeMode;
      throw new Error(`Tramo desconocido: ${exhaustive}`);
    }
  }
}
