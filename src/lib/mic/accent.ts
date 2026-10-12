/**
 * Acentos con micrófono: distinguir un golpe acentuado de uno normal por su
 * fuerza (`strikeDb`, el nivel máximo de los primeros ~25 ms del golpe).
 *
 * La fuerza que llega al micrófono depende de la distancia, del micrófono y
 * de cada persona, así que no hay un umbral universal: se calibra grabando
 * unos golpes normales y otros acentuados, y el umbral queda entre ambos.
 */

export type AccentKind = "normal" | "acento";

/** Ejemplos de fuerza (dBFS) de golpes normales y acentuados. */
export interface AccentProfile {
  normal: number[];
  accented: number[];
}

export const MIN_ACCENT_SAMPLES = 4;
export const MAX_ACCENT_SAMPLES = 12;
/**
 * Por debajo de esta diferencia entre medianas los dos tipos de golpe se
 * confunden demasiado: es mejor no juzgar acentos que juzgarlos mal.
 */
export const MIN_ACCENT_SEPARATION_DB = 4;

export function emptyAccentProfile(): AccentProfile {
  return { normal: [], accented: [] };
}

export function addAccentSample(profile: AccentProfile, kind: AccentKind, strikeDb: number): AccentProfile {
  if (!Number.isFinite(strikeDb)) return profile;
  const key = kind === "acento" ? "accented" : "normal";
  return { ...profile, [key]: [...profile[key], strikeDb].slice(-MAX_ACCENT_SAMPLES) };
}

export function clearAccentSamples(profile: AccentProfile, kind: AccentKind): AccentProfile {
  return kind === "acento" ? { ...profile, accented: [] } : { ...profile, normal: [] };
}

export function isAccentProfile(value: unknown): value is AccentProfile {
  if (!value || typeof value !== "object") return false;
  const { normal, accented } = value as Partial<AccentProfile>;
  const valid = (list: unknown) => Array.isArray(list) && list.every((v) => typeof v === "number" && Number.isFinite(v));
  return valid(normal) && valid(accented);
}

export type AccentAnalysis =
  | { status: "faltan-golpes"; normalNeeded: number; accentNeeded: number }
  | {
      status: "sin-diferencia";
      normalDb: number;
      accentDb: number;
      separationDb: number;
    }
  | {
      status: "listo";
      normalDb: number;
      accentDb: number;
      separationDb: number;
      /** Fuerza a partir de la cual un golpe cuenta como acento, dBFS. */
      thresholdDb: number;
      /** 0..1: ejemplos de la calibración que el umbral clasifica bien. */
      agreement: number;
    };

/** ¿Hay ejemplos suficientes y se distinguen? Si sí, calcula el umbral. */
export function analyzeAccentProfile(profile: AccentProfile | null | undefined): AccentAnalysis {
  const normal = profile?.normal ?? [];
  const accented = profile?.accented ?? [];
  if (normal.length < MIN_ACCENT_SAMPLES || accented.length < MIN_ACCENT_SAMPLES) {
    return {
      status: "faltan-golpes",
      normalNeeded: Math.max(0, MIN_ACCENT_SAMPLES - normal.length),
      accentNeeded: Math.max(0, MIN_ACCENT_SAMPLES - accented.length),
    };
  }
  const normalDb = median(normal);
  const accentDb = median(accented);
  const separationDb = accentDb - normalDb;
  if (separationDb < MIN_ACCENT_SEPARATION_DB) return { status: "sin-diferencia", normalDb, accentDb, separationDb };

  const thresholdDb = (normalDb + accentDb) / 2;
  const correct = normal.filter((db) => db < thresholdDb).length + accented.filter((db) => db >= thresholdDb).length;
  return { status: "listo", normalDb, accentDb, separationDb, thresholdDb, agreement: correct / (normal.length + accented.length) };
}

/** Decide si un golpe está acentuado según el perfil calibrado. */
export class AccentDetector {
  readonly thresholdDb: number;

  constructor(thresholdDb: number) {
    if (!Number.isFinite(thresholdDb)) throw new Error("AccentDetector: umbral no válido.");
    this.thresholdDb = thresholdDb;
  }

  /** `null` si el perfil no sirve (faltan golpes o no se distinguen). */
  static fromProfile(profile: AccentProfile | null | undefined): AccentDetector | null {
    const analysis = analyzeAccentProfile(profile);
    return analysis.status === "listo" ? new AccentDetector(analysis.thresholdDb) : null;
  }

  isAccent(strikeDb: number): boolean {
    return strikeDb >= this.thresholdDb;
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
