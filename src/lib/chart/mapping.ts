import { INSTRUMENT_LIST, INSTRUMENTS, isInstrumentId } from "./instruments";
import type { InstrumentId, StrokeId } from "./types";
import { STROKE_IDS } from "./types";

export interface NoteMapping {
  stroke: StrokeId;
  accent: boolean;
}

/** Nota MIDI → golpe. Igual para todos los instrumentos. */
export const DEFAULT_NOTE_MAP: Record<number, NoteMapping> = {
  36: { stroke: "abierto", accent: false },
  37: { stroke: "apagado", accent: false },
  38: { stroke: "aro", accent: false },
  39: { stroke: "slap", accent: false },
  40: { stroke: "abierto", accent: true },
  60: { stroke: "agudo", accent: false },
  61: { stroke: "grave", accent: false },
};

/** A partir de esta velocidad MIDI (1–127) una nota cuenta como acento. */
export const DEFAULT_ACCENT_VELOCITY = 110;

export type NoteMapOverrides = Partial<
  Record<InstrumentId, Record<string, StrokeId | NoteMapping>>
>;

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const ALIAS_INDEX: Map<string, InstrumentId> = (() => {
  const index = new Map<string, InstrumentId>();
  for (const def of INSTRUMENT_LIST) {
    for (const name of [def.id, def.name, def.trackName, ...def.aliases]) {
      index.set(normalizeName(name), def.id);
    }
  }
  return index;
})();

/**
 * Busca el instrumento de una pista de forma tolerante (mayúsculas, acentos,
 * espacios, guiones y números romanos de los surdos).
 */
export function matchInstrument(
  trackName: string,
  extraAliases: Record<string, string> = {},
): InstrumentId | null {
  const key = normalizeName(trackName);
  if (!key) return null;

  for (const [alias, target] of Object.entries(extraAliases)) {
    if (normalizeName(alias) === key) {
      const id = normalizeName(target);
      if (isInstrumentId(id)) return id;
      return ALIAS_INDEX.get(id) ?? null;
    }
  }

  const direct = ALIAS_INDEX.get(key);
  if (direct) return direct;

  const roman = key.match(/^surdo(i{1,3})$/);
  if (roman) return ALIAS_INDEX.get(`surdo${roman[1].length}`) ?? null;
  return null;
}

export function isStrokeId(value: string): value is StrokeId {
  return (STROKE_IDS as readonly string[]).includes(value);
}

/**
 * Devuelve el golpe de una nota para un instrumento, o `null` si la nota no
 * está mapeada o el golpe no existe en ese instrumento.
 */
export function mapNote(
  instrument: InstrumentId,
  midi: number,
  overrides: NoteMapOverrides = {},
): NoteMapping | null {
  const override = overrides[instrument]?.[String(midi)];
  const mapping: NoteMapping | undefined =
    typeof override === "string"
      ? { stroke: override, accent: false }
      : (override ?? DEFAULT_NOTE_MAP[midi]);
  if (!mapping) return null;
  if (!INSTRUMENTS[instrument].strokes.includes(mapping.stroke)) return null;
  return mapping;
}
