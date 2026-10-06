import * as Tone from "tone";

import type { InstrumentId } from "../chart/types";
import { INSTRUMENT_IDS } from "../chart/types";
import { loadSampleBank, type SampleBank } from "./sample-bank";
import type { SoundId } from "./sounds";

export type BusId = InstrumentId | "metronomo" | "golpes";

export interface TrackMix {
  volumeDb: number;
  mute: boolean;
  solo: boolean;
}

export const DEFAULT_MIX: TrackMix = { volumeDb: 0, mute: false, solo: false };

/**
 * Motor de audio sobre Tone.js. Mantiene un canal (volumen/mute/solo) por
 * instrumento más uno para el metrónomo y otro para el sonido de los golpes
 * del jugador. Todo se programa en tiempo de `AudioContext`, así que cambiar
 * la velocidad solo cambia cuándo se dispara cada sample: no hay estiramiento
 * de audio.
 */
export class AudioEngine {
  readonly context: AudioContext;
  private readonly tone: Tone.Context;
  private readonly channels = new Map<BusId, Tone.Channel>();
  private readonly active = new Set<Tone.ToneBufferSource>();
  private readonly mixes = new Map<BusId, TrackMix>();
  private bank: SampleBank | null = null;

  /** Debe llamarse dentro de un gesto del usuario (clic, toque, tecla). */
  constructor() {
    this.context = new AudioContext({ latencyHint: "interactive" });
    void this.context.resume();
    this.tone = new Tone.Context(this.context);
    Tone.setContext(this.tone);
    for (const id of [...INSTRUMENT_IDS, "metronomo", "golpes"] as BusId[]) {
      this.channels.set(id, new Tone.Channel({ context: this.tone }).toDestination());
    }
  }

  async load(): Promise<SampleBank> {
    this.bank ??= await loadSampleBank(this.context);
    return this.bank;
  }

  get origins() {
    return this.bank?.origins ?? new Map();
  }

  get currentTime(): number {
    return this.context.currentTime;
  }

  /**
   * Instante del `AudioContext` que está sonando por los altavoces en el
   * momento `performanceTime` (p. ej. `event.timeStamp`). Compensa la
   * latencia de salida para que imagen, oído y juez coincidan.
   */
  heardTime(performanceTime: number = performance.now()): number {
    const ctx = this.context;
    if (typeof ctx.getOutputTimestamp === "function") {
      const stamp = ctx.getOutputTimestamp();
      if (stamp.contextTime !== undefined && stamp.performanceTime) {
        const heard = stamp.contextTime + (performanceTime - stamp.performanceTime) / 1000;
        // Justo después de reanudar, la marca puede venir atrasada: nunca por delante del reloj.
        return Math.min(heard, ctx.currentTime);
      }
    }
    const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    return ctx.currentTime - latency - (performance.now() - performanceTime) / 1000;
  }

  play(sound: SoundId, bus: BusId, when: number, gain = 1): void {
    const buffer = this.bank?.buffers.get(sound);
    const channel = this.channels.get(bus);
    if (!buffer || !channel || gain <= 0) return;
    const source = new Tone.ToneBufferSource({ url: buffer, context: this.tone });
    source.connect(channel);
    source.onended = () => {
      this.active.delete(source);
      source.dispose();
    };
    this.active.add(source);
    source.start(Math.max(when, this.context.currentTime), 0, undefined, gain);
  }

  /** Detiene todo lo que estaba programado (al parar o reiniciar). */
  stopAll(): void {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {
        // ya había terminado
      }
      source.dispose();
    }
    this.active.clear();
  }

  /**
   * Aplica volumen/mute/solo. El solo se resuelve aquí (y no con el de Tone)
   * para que nunca silencie el metrónomo ni los golpes del jugador.
   */
  setMix(bus: BusId, mix: Partial<TrackMix>): void {
    const current = this.mixes.get(bus) ?? DEFAULT_MIX;
    this.mixes.set(bus, { ...current, ...mix });
    const anySolo = INSTRUMENT_IDS.some((id) => this.mixes.get(id)?.solo);
    for (const [id, channel] of this.channels) {
      const state = this.mixes.get(id) ?? DEFAULT_MIX;
      const isInstrument = id !== "metronomo" && id !== "golpes";
      channel.volume.value = state.volumeDb;
      channel.mute = state.mute || (isInstrument && anySolo && !state.solo);
    }
  }

  async suspend(): Promise<void> {
    if (this.context.state === "running") await this.context.suspend();
  }

  async resume(): Promise<void> {
    if (this.context.state !== "running") await this.context.resume();
  }

  async dispose(): Promise<void> {
    this.stopAll();
    for (const channel of this.channels.values()) channel.dispose();
    this.channels.clear();
    if (this.context.state !== "closed") await this.context.close();
  }
}
