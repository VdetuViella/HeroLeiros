import { readLocal, writeLocal } from "../settings/local";
import { DEFAULT_DETECTOR_SETTINGS, type DetectorSettings, type NoiseProfile } from "./onset-detector";

/** «teclado» incluye también los pads táctiles. */
export type InputMethod = "teclado" | "microfono";

export interface MicPreferences {
  deviceId: string | null;
  sensitivity: number;
  refractoryMs: number;
  noise: NoiseProfile | null;
  /** El jugador confirma que lleva auriculares (el acompañamiento no llega al micro). */
  headphones: boolean;
}

export const DEFAULT_MIC_PREFERENCES: MicPreferences = {
  deviceId: null,
  sensitivity: DEFAULT_DETECTOR_SETTINGS.sensitivity,
  refractoryMs: DEFAULT_DETECTOR_SETTINGS.refractoryMs,
  noise: null,
  headphones: false,
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
  };
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
