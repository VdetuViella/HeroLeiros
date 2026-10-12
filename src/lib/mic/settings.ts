import { INSTRUMENT_IDS, type InstrumentId, type StrokeId } from "../chart/types";
import { readLocal, writeLocal } from "../settings/local";
import { AccentDetector, isAccentProfile, type AccentProfile } from "./accent";
import { DEFAULT_DETECTOR_SETTINGS, type DetectorSettings, type NoiseProfile } from "./onset-detector";
import { StrokeClassifier, emptyProfile, isProfileReady, isStrokeFeatures, type StrokeProfile } from "./stroke-classifier";

/** «teclado» incluye también los pads táctiles. */
export type InputMethod = "teclado" | "microfono";

export interface MicPreferences {
  deviceId: string | null;
  sensitivity: number;
  refractoryMs: number;
  noise: NoiseProfile | null;
  /** El jugador confirma que lleva auriculares (el acompañamiento no llega al micro). */
  headphones: boolean;
  /** Fase B (experimental): distinguir el tipo de golpe con el perfil entrenado. */
  classifyStrokes: boolean;
  strokeProfiles: Partial<Record<InstrumentId, SavedStrokeProfile>>;
  /** Juzgar los acentos según la fuerza de cada golpe, con el umbral calibrado. */
  detectAccents: boolean;
  /** Golpes normales y acentuados grabados para calibrar, por instrumento. */
  accentProfiles: Partial<Record<InstrumentId, AccentProfile>>;
}

/** Perfil de timbre guardado junto con los golpes (carriles) para los que se entrenó. */
export interface SavedStrokeProfile extends StrokeProfile {
  strokes: StrokeId[];
}

/**
 * Cambio de preferencias: un objeto, o una función que lo calcula a partir de
 * las preferencias actuales (para cambios seguidos, como grabar golpes, sin
 * pisarse aunque lleguen antes de volver a pintar).
 */
export type MicPreferencesUpdate = Partial<MicPreferences> | ((current: MicPreferences) => Partial<MicPreferences>);

export const DEFAULT_MIC_PREFERENCES: MicPreferences = {
  deviceId: null,
  sensitivity: DEFAULT_DETECTOR_SETTINGS.sensitivity,
  refractoryMs: DEFAULT_DETECTOR_SETTINGS.refractoryMs,
  noise: null,
  headphones: false,
  classifyStrokes: false,
  strokeProfiles: {},
  detectAccents: false,
  accentProfiles: {},
};

export const REFRACTORY_RANGE = { min: 30, max: 200 } as const;

function isNoiseProfile(value: unknown): value is NoiseProfile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.floorDb === "number" && Number.isFinite(v.floorDb) && typeof v.flux === "number" && Number.isFinite(v.flux);
}

export function sanitizeMicPreferences(raw: unknown): MicPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_MIC_PREFERENCES };
  const v = raw as Partial<Record<keyof MicPreferences, unknown>>;
  const sensitivity = typeof v.sensitivity === "number" && Number.isFinite(v.sensitivity) ? v.sensitivity : DEFAULT_MIC_PREFERENCES.sensitivity;
  const refractory = typeof v.refractoryMs === "number" && Number.isFinite(v.refractoryMs) ? v.refractoryMs : DEFAULT_MIC_PREFERENCES.refractoryMs;
  return {
    deviceId: typeof v.deviceId === "string" && v.deviceId ? v.deviceId : null,
    sensitivity: Math.min(1, Math.max(0, sensitivity)),
    refractoryMs: Math.round(Math.min(REFRACTORY_RANGE.max, Math.max(REFRACTORY_RANGE.min, refractory))),
    noise: isNoiseProfile(v.noise) ? { floorDb: v.noise.floorDb, flux: v.noise.flux } : null,
    headphones: v.headphones === true,
    classifyStrokes: v.classifyStrokes === true,
    strokeProfiles: sanitizeProfiles(v.strokeProfiles),
    detectAccents: v.detectAccents === true,
    accentProfiles: sanitizeAccentProfiles(v.accentProfiles),
  };
}

function sanitizeAccentProfiles(raw: unknown): Partial<Record<InstrumentId, AccentProfile>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<InstrumentId, AccentProfile>> = {};
  for (const [instrument, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(INSTRUMENT_IDS as readonly string[]).includes(instrument) || !isAccentProfile(value)) continue;
    out[instrument as InstrumentId] = { normal: [...value.normal], accented: [...value.accented] };
  }
  return out;
}

/** Detector de acentos para la partida, o `null` si está apagado o sin calibrar. */
export function accentDetectorFor(prefs: MicPreferences, instrument: InstrumentId): AccentDetector | null {
  if (!prefs.detectAccents) return null;
  return AccentDetector.fromProfile(prefs.accentProfiles[instrument]);
}

function sanitizeProfiles(raw: unknown): Partial<Record<InstrumentId, SavedStrokeProfile>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<InstrumentId, SavedStrokeProfile>> = {};
  for (const [instrument, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(INSTRUMENT_IDS as readonly string[]).includes(instrument) || !value || typeof value !== "object") continue;
    const { strokes, samples } = value as Partial<SavedStrokeProfile>;
    if (
      Array.isArray(strokes) &&
      strokes.every((s) => typeof s === "string") &&
      Array.isArray(samples) &&
      samples.length === strokes.length &&
      samples.every((lane) => Array.isArray(lane) && lane.every(isStrokeFeatures))
    ) {
      out[instrument as InstrumentId] = { strokes, samples };
    }
  }
  return out;
}

/** Perfil entrenado para estos carriles, o un perfil vacío si no hay o no encaja. */
export function strokeProfileFor(prefs: MicPreferences, instrument: InstrumentId, lanes: StrokeId[]): SavedStrokeProfile {
  const saved = prefs.strokeProfiles[instrument];
  if (saved && saved.strokes.length === lanes.length && saved.strokes.every((s, i) => s === lanes[i])) return saved;
  return { strokes: [...lanes], ...emptyProfile(lanes.length) };
}

/** Clasificador listo para la partida, o `null` si la fase B está apagada o sin entrenar. */
export function classifierFor(prefs: MicPreferences, instrument: InstrumentId, lanes: StrokeId[]): StrokeClassifier | null {
  if (!prefs.classifyStrokes || lanes.length < 2) return null;
  const profile = strokeProfileFor(prefs, instrument, lanes);
  return isProfileReady(profile, lanes.length) ? new StrokeClassifier(profile) : null;
}

export function detectorSettingsFrom(prefs: MicPreferences): DetectorSettings {
  return { sensitivity: prefs.sensitivity, refractoryMs: prefs.refractoryMs, noise: prefs.noise };
}

export function loadInputMethod(): InputMethod {
  return readLocal<string>("entrada", "teclado") === "microfono" ? "microfono" : "teclado";
}

export function saveInputMethod(method: InputMethod): void {
  writeLocal("entrada", method);
}

export function loadMicPreferences(): MicPreferences {
  return sanitizeMicPreferences(readLocal<unknown>("microfono", null));
}

export function saveMicPreferences(prefs: MicPreferences): void {
  writeLocal("microfono", prefs);
}
