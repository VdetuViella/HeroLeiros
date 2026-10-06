/**
 * Señales sintéticas para probar el detector sin grabaciones: golpes que
 * imitan surdo, caixa, tamborim y clic de metrónomo, más ruido de sala.
 * También las usa `scripts/generate-mic-wav.ts` para el micrófono falso del
 * navegador en las pruebas.
 */

export type HitKind = "surdo" | "caixa" | "tamborim" | "clic";

export interface SyntheticHit {
  time: number;
  kind: HitKind;
  /** Amplitud de pico (1 = 0 dBFS). */
  gain: number;
}

/** PRNG determinista (mulberry32) para que los tests sean reproducibles. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido aproximadamente gaussiano con el RMS pedido. */
export function noise(length: number, rms: number, random: () => number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += random() - 0.5;
    out[i] = sum * rms * Math.sqrt(3);
  }
  return out;
}

export function hitSound(kind: HitKind, sampleRate: number, gain: number, random: () => number): Float32Array {
  const seconds = kind === "surdo" ? 0.6 : kind === "caixa" ? 0.18 : kind === "tamborim" ? 0.1 : 0.03;
  const length = Math.round(seconds * sampleRate);
  const out = new Float32Array(length);
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let value: number;
    switch (kind) {
      case "surdo": {
        // Parche grave: seno que cae de 90 a 55 Hz, con un pequeño chasquido de maza.
        const freq = 55 + 35 * Math.exp(-t / 0.04);
        phase += (2 * Math.PI * freq) / sampleRate;
        const click = (random() * 2 - 1) * 0.35 * Math.exp(-t / 0.004);
        value = Math.sin(phase) * Math.exp(-t / 0.25) + click;
        break;
      }
      case "caixa": {
        const body = Math.sin(2 * Math.PI * 190 * t) * 0.5 * Math.exp(-t / 0.03);
        value = (random() * 2 - 1) * Math.exp(-t / 0.05) + body;
        break;
      }
      case "tamborim": {
        const tone = Math.sin(2 * Math.PI * 900 * t) * 0.6 + Math.sin(2 * Math.PI * 2300 * t) * 0.3;
        value = (tone + (random() * 2 - 1) * 0.4) * Math.exp(-t / 0.02);
        break;
      }
      case "clic":
        value = Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-t / 0.006);
        break;
      default: {
        const exhaustive: never = kind;
        throw new Error(`Golpe desconocido: ${exhaustive}`);
      }
    }
    // Ataque de 1 ms para no empezar con un escalón perfecto (más realista).
    const attack = Math.min(1, t / 0.001);
    out[i] = value * attack;
  }
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < length; i++) out[i] *= gain / max;
  return out;
}

export interface RenderOptions {
  sampleRate: number;
  seconds: number;
  hits: SyntheticHit[];
  /** RMS del ruido de fondo (0 = silencio digital). */
  noiseRms?: number;
  seed?: number;
}

/** Mezcla golpes y ruido en un buffer mono. */
export function renderHits({ sampleRate, seconds, hits, noiseRms = 0, seed = 1 }: RenderOptions): Float32Array {
  const random = seededRandom(seed);
  const length = Math.round(seconds * sampleRate);
  const out = noiseRms > 0 ? noise(length, noiseRms, random) : new Float32Array(length);
  for (const hit of hits) {
    const sound = hitSound(hit.kind, sampleRate, hit.gain, random);
    const start = Math.round(hit.time * sampleRate);
    for (let i = 0; i < sound.length && start + i < length; i++) out[start + i] += sound[i];
  }
  return out;
}

/** Golpes regulares a `bpm`, empezando en `offset` segundos. */
export function clickTrack(bpm: number, count: number, offset: number, kind: HitKind = "clic", gain = 0.5): SyntheticHit[] {
  return Array.from({ length: count }, (_, i) => ({ time: offset + (i * 60) / bpm, kind, gain }));
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}
