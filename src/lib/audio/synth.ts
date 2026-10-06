import type { InstrumentId, StrokeId } from "../chart/types";
import type { SoundId } from "./sounds";

/**
 * Sintetizador de respaldo: genera cada golpe con matemáticas simples
 * (membrana con caída de tono, ruido filtrado, campanas inarmónicas) para que
 * la app suene aunque `public/samples/` esté vacío. Es determinista.
 */

interface MembraneParams {
  startHz: number;
  endHz: number;
  pitchDecay: number;
  decay: number;
  duration: number;
  noise?: number;
  noiseDecay?: number;
  noiseLowpassHz?: number;
  gain?: number;
}

interface NoiseParams {
  duration: number;
  attack: number;
  decay: number;
  highpassHz?: number;
  lowpassHz?: number;
  tone?: { hz: number; decay: number; amount: number };
  gain?: number;
}

interface BellParams {
  hz: number;
  partials: [ratio: number, amp: number][];
  decay: number;
  duration: number;
  gain?: number;
}

type Voice =
  | ({ kind: "membrane" } & MembraneParams)
  | ({ kind: "noise" } & NoiseParams)
  | ({ kind: "bell" } & BellParams)
  | { kind: "click"; hz: number; decay: number; noise: number; gain?: number };

function surdo(baseHz: number): Record<"abierto" | "apagado", Voice> {
  return {
    abierto: { kind: "membrane", startHz: baseHz * 1.8, endHz: baseHz, pitchDecay: 0.03, decay: 0.42, duration: 1.3, noise: 0.06, noiseDecay: 0.02, noiseLowpassHz: 900, gain: 0.95 },
    apagado: { kind: "membrane", startHz: baseHz * 1.7, endHz: baseHz * 1.05, pitchDecay: 0.02, decay: 0.06, duration: 0.3, noise: 0.12, noiseDecay: 0.015, noiseLowpassHz: 1400, gain: 0.8 },
  };
}

const VOICES: Record<InstrumentId, Partial<Record<StrokeId, Voice>>> = {
  surdo1: surdo(52),
  surdo2: surdo(61),
  surdo3: surdo(74),
  caixa: {
    abierto: { kind: "noise", duration: 0.32, attack: 0.001, decay: 0.08, highpassHz: 1800, lowpassHz: 9000, tone: { hz: 215, decay: 0.035, amount: 0.6 }, gain: 0.7 },
    apagado: { kind: "noise", duration: 0.15, attack: 0.001, decay: 0.035, highpassHz: 2200, lowpassHz: 8000, tone: { hz: 230, decay: 0.02, amount: 0.3 }, gain: 0.32 },
    aro: { kind: "click", hz: 1750, decay: 0.018, noise: 0.5, gain: 0.6 },
  },
  repinique: {
    abierto: { kind: "membrane", startHz: 420, endHz: 330, pitchDecay: 0.015, decay: 0.16, duration: 0.55, noise: 0.22, noiseDecay: 0.025, noiseLowpassHz: 6000, gain: 0.75 },
    apagado: { kind: "membrane", startHz: 400, endHz: 340, pitchDecay: 0.01, decay: 0.04, duration: 0.18, noise: 0.25, noiseDecay: 0.015, noiseLowpassHz: 5000, gain: 0.6 },
    aro: { kind: "click", hz: 2300, decay: 0.02, noise: 0.45, gain: 0.6 },
    slap: { kind: "membrane", startHz: 520, endHz: 380, pitchDecay: 0.01, decay: 0.05, duration: 0.25, noise: 0.85, noiseDecay: 0.035, noiseLowpassHz: 7000, gain: 0.75 },
  },
  tamborim: {
    abierto: { kind: "membrane", startHz: 820, endHz: 640, pitchDecay: 0.008, decay: 0.07, duration: 0.3, noise: 0.35, noiseDecay: 0.015, noiseLowpassHz: 8000, gain: 0.6 },
    apagado: { kind: "membrane", startHz: 780, endHz: 660, pitchDecay: 0.006, decay: 0.022, duration: 0.12, noise: 0.4, noiseDecay: 0.01, noiseLowpassHz: 7000, gain: 0.5 },
  },
  agogo: {
    agudo: { kind: "bell", hz: 1180, partials: [[1, 1], [2.02, 0.32], [2.93, 0.22], [4.1, 0.08]], decay: 0.32, duration: 0.9, gain: 0.45 },
    grave: { kind: "bell", hz: 820, partials: [[1, 1], [2.02, 0.32], [2.93, 0.22], [4.1, 0.08]], decay: 0.36, duration: 1, gain: 0.45 },
  },
  chocalho: {
    abierto: { kind: "noise", duration: 0.2, attack: 0.008, decay: 0.05, highpassHz: 5500, gain: 0.32 },
    apagado: { kind: "noise", duration: 0.15, attack: 0.004, decay: 0.03, highpassHz: 6500, gain: 0.22 },
  },
};

const CLICK_VOICES: Record<"alto" | "bajo", Voice> = {
  alto: { kind: "click", hz: 1900, decay: 0.022, noise: 0, gain: 0.55 },
  bajo: { kind: "click", hz: 1250, decay: 0.018, noise: 0, gain: 0.4 },
};

export function voiceFor(id: SoundId): Voice | null {
  const [group, name] = id.split(":");
  if (group === "metronomo") return CLICK_VOICES[name as "alto" | "bajo"] ?? null;
  return VOICES[group as InstrumentId]?.[name as StrokeId] ?? null;
}

/** Genera el sonido de respaldo (mono) a la frecuencia de muestreo dada. */
export function synthesize(id: SoundId, sampleRate: number): Float32Array {
  const voice = voiceFor(id);
  if (!voice) return new Float32Array(Math.round(sampleRate * 0.05));
  const random = mulberry32(hash(id));
  let data: Float32Array;
  switch (voice.kind) {
    case "membrane":
      data = membrane(voice, sampleRate, random);
      break;
    case "noise":
      data = noise(voice, sampleRate, random);
      break;
    case "bell":
      data = bell(voice, sampleRate);
      break;
    case "click":
      data = click(voice.hz, voice.decay, voice.noise, sampleRate, random);
      break;
    default: {
      const exhaustive: never = voice;
      throw new Error(`Voz desconocida: ${JSON.stringify(exhaustive)}`);
    }
  }
  return normalize(fadeOut(data, sampleRate), voice.gain ?? 0.8);
}

function membrane(p: MembraneParams, sr: number, random: () => number): Float32Array {
  const out = new Float32Array(Math.round(p.duration * sr));
  const lp = onePole(p.noiseLowpassHz ?? 4000, sr);
  let phase = 0;
  let lowState = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const hz = p.endHz + (p.startHz - p.endHz) * Math.exp(-t / p.pitchDecay);
    phase += (2 * Math.PI * hz) / sr;
    const body = Math.sin(phase) * Math.exp(-t / p.decay) * attack(t, 0.002);
    lowState += lp * (random() * 2 - 1 - lowState);
    const hiss = (p.noise ?? 0) * lowState * Math.exp(-t / (p.noiseDecay ?? 0.02)) * 3;
    out[i] = body + hiss;
  }
  return out;
}

function noise(p: NoiseParams, sr: number, random: () => number): Float32Array {
  const out = new Float32Array(Math.round(p.duration * sr));
  const hp = p.highpassHz ? onePole(p.highpassHz, sr) : 0;
  const lp = p.lowpassHz ? onePole(p.lowpassHz, sr) : 1;
  let hpState = 0;
  let lpState = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const white = random() * 2 - 1;
    hpState += hp * (white - hpState);
    const high = p.highpassHz ? white - hpState : white;
    lpState += lp * (high - lpState);
    const env = attack(t, p.attack) * Math.exp(-Math.max(0, t - p.attack) / p.decay);
    const tone = p.tone ? p.tone.amount * Math.sin(2 * Math.PI * p.tone.hz * t) * Math.exp(-t / p.tone.decay) : 0;
    out[i] = lpState * env + tone;
  }
  return out;
}

function bell(p: BellParams, sr: number): Float32Array {
  const out = new Float32Array(Math.round(p.duration * sr));
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let sample = 0;
    p.partials.forEach(([ratio, amp], k) => {
      sample += amp * Math.sin(2 * Math.PI * p.hz * ratio * t) * Math.exp(-t / (p.decay / (1 + k * 0.6)));
    });
    out[i] = sample * attack(t, 0.001);
  }
  return out;
}

function click(hz: number, decay: number, noiseAmount: number, sr: number, random: () => number): Float32Array {
  const out = new Float32Array(Math.round(sr * Math.max(0.06, decay * 6)));
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t / decay);
    out[i] = env * (Math.sin(2 * Math.PI * hz * t) + 0.4 * Math.sin(2 * Math.PI * hz * 1.83 * t) + noiseAmount * (random() * 2 - 1));
  }
  return out;
}

function attack(t: number, seconds: number): number {
  return seconds <= 0 || t >= seconds ? 1 : t / seconds;
}

function onePole(cutoffHz: number, sr: number): number {
  return 1 - Math.exp((-2 * Math.PI * cutoffHz) / sr);
}

function fadeOut(data: Float32Array, sr: number): Float32Array {
  const fade = Math.min(data.length, Math.round(sr * 0.01));
  for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;
  return data;
}

function normalize(data: Float32Array, peak: number): Float32Array {
  let max = 0;
  for (const value of data) max = Math.max(max, Math.abs(value));
  if (max === 0) return data;
  const scale = peak / max;
  for (let i = 0; i < data.length; i++) data[i] *= scale;
  return data;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
