import { isInstrumentId } from "./instruments";
import { isStrokeId, type NoteMapOverrides, type NoteMapping } from "./mapping";

export interface SongMetaSection {
  name: string;
  startBar: number;
  endBar: number;
}

/** Contenido de `content/songs/<slug>/meta.json`. */
export interface SongMeta {
  title: string;
  artist?: string;
  description?: string;
  /** BPM de referencia; si falta se usa el tempo del MIDI. */
  bpm?: number;
  /** Compás; si falta se usa el del MIDI (o 4/4). */
  timeSignature?: [number, number];
  /** Secciones para los bucles. Si faltan se usan los marcadores del MIDI. */
  sections?: SongMetaSection[];
  /** Nombres de pista extra → instrumento (`"Caja vieja": "caixa"`). */
  trackAliases?: Record<string, string>;
  /** Sobrescrituras del mapeo de notas por instrumento. */
  mapping?: NoteMapOverrides;
  /** Velocidad MIDI mínima para considerar una nota acentuada. */
  accentVelocity?: number;
}

export interface MetaParseResult {
  meta: SongMeta;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function parseSongMeta(raw: unknown, fallbackTitle = "Sin título"): MetaParseResult {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { meta: { title: fallbackTitle }, errors: ["meta.json debe ser un objeto JSON."] };
  }

  const meta: SongMeta = {
    title:
      typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : fallbackTitle,
  };
  if (typeof raw.title !== "string" || !raw.title.trim()) {
    errors.push("Falta «title» (el título de la canción).");
  }

  if (typeof raw.artist === "string") meta.artist = raw.artist;
  if (typeof raw.description === "string") meta.description = raw.description;

  if (raw.bpm !== undefined) {
    if (typeof raw.bpm === "number" && raw.bpm >= 30 && raw.bpm <= 300) meta.bpm = raw.bpm;
    else errors.push("«bpm» debe ser un número entre 30 y 300.");
  }

  if (raw.timeSignature !== undefined) {
    const ts = raw.timeSignature;
    if (Array.isArray(ts) && ts.length === 2 && positiveInt(ts[0]) && positiveInt(ts[1])) {
      meta.timeSignature = [ts[0], ts[1]];
    } else {
      errors.push("«timeSignature» debe ser [numerador, denominador], p. ej. [2, 4].");
    }
  }

  if (raw.sections !== undefined) {
    if (!Array.isArray(raw.sections)) {
      errors.push("«sections» debe ser una lista.");
    } else {
      meta.sections = [];
      raw.sections.forEach((section, i) => {
        if (
          isRecord(section) &&
          typeof section.name === "string" &&
          positiveInt(section.startBar) &&
          positiveInt(section.endBar)
        ) {
          meta.sections!.push({
            name: section.name,
            startBar: section.startBar,
            endBar: section.endBar,
          });
        } else {
          errors.push(
            `La sección ${i + 1} necesita «name», «startBar» y «endBar» (enteros desde 1).`,
          );
        }
      });
    }
  }

  if (raw.trackAliases !== undefined) {
    if (isRecord(raw.trackAliases)) {
      meta.trackAliases = {};
      for (const [name, target] of Object.entries(raw.trackAliases)) {
        if (typeof target === "string") meta.trackAliases[name] = target;
        else errors.push(`El alias de pista «${name}» debe apuntar a un instrumento.`);
      }
    } else {
      errors.push("«trackAliases» debe ser un objeto { nombre: instrumento }.");
    }
  }

  if (raw.mapping !== undefined) {
    if (!isRecord(raw.mapping)) {
      errors.push("«mapping» debe ser un objeto { instrumento: { nota: golpe } }.");
    } else {
      const mapping: NoteMapOverrides = {};
      for (const [instrument, notes] of Object.entries(raw.mapping)) {
        if (!isInstrumentId(instrument)) {
          errors.push(`«mapping»: instrumento desconocido «${instrument}».`);
          continue;
        }
        if (!isRecord(notes)) {
          errors.push(`«mapping.${instrument}» debe ser un objeto { nota: golpe }.`);
          continue;
        }
        const entries: Record<string, NoteMapping> = {};
        for (const [note, value] of Object.entries(notes)) {
          const midi = Number(note);
          if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
            errors.push(`«mapping.${instrument}»: «${note}» no es una nota MIDI (0–127).`);
            continue;
          }
          if (typeof value === "string" && isStrokeId(value)) {
            entries[note] = { stroke: value, accent: false };
          } else if (
            isRecord(value) &&
            typeof value.stroke === "string" &&
            isStrokeId(value.stroke)
          ) {
            entries[note] = { stroke: value.stroke, accent: value.accent === true };
          } else {
            errors.push(`«mapping.${instrument}.${note}»: golpe desconocido.`);
          }
        }
        mapping[instrument] = entries;
      }
      meta.mapping = mapping;
    }
  }

  if (raw.accentVelocity !== undefined) {
    if (typeof raw.accentVelocity === "number" && raw.accentVelocity >= 1 && raw.accentVelocity <= 127) {
      meta.accentVelocity = raw.accentVelocity;
    } else {
      errors.push("«accentVelocity» debe estar entre 1 y 127.");
    }
  }

  return { meta, errors };
}
