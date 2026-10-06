import type { InputSourceKind } from "../input/types";
import { defaultKeymap } from "../input/keymap";

const PREFIX = "heroleiros:";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // almacenamiento lleno o bloqueado: los ajustes se pierden al recargar
  }
}

/**
 * Desfase de latencia (ms) por tipo de entrada: cuánto tarde suele llegar el
 * golpe respecto a lo que suena. Se resta a cada golpe antes de juzgarlo.
 * Cuando haya perfil en la nube, sincronizar desde aquí.
 */
export function loadLatencyMs(kind: InputSourceKind): number {
  const value = read<number>(`latencia:${kind}`, 0);
  return Number.isFinite(value) ? value : 0;
}

export function saveLatencyMs(kind: InputSourceKind, ms: number): void {
  write(`latencia:${kind}`, Math.round(ms));
}

export function loadKeymap(laneCount: number): string[] {
  const stored = read<string[] | null>(`teclas:${laneCount}`, null);
  if (Array.isArray(stored) && stored.length === laneCount && stored.every((k) => typeof k === "string")) {
    return stored;
  }
  return defaultKeymap(laneCount);
}

export function saveKeymap(laneCount: number, keymap: string[]): void {
  write(`teclas:${laneCount}`, keymap);
}

export function readLocal<T>(key: string, fallback: T): T {
  return read(key, fallback);
}

export function writeLocal(key: string, value: unknown): void {
  write(key, value);
}
