import type { DetectorSettings, NoiseProfile, Onset } from "./onset-detector";
import { ONSET_PROCESSOR_NAME, ONSET_PROCESSOR_URL, type FromWorklet, type OnsetProcessorOptions, type ToWorklet } from "./protocol";

export type MicErrorCode = "inseguro" | "sin-soporte" | "denegado" | "sin-dispositivo" | "ocupado" | "desconocido";

const MESSAGES: Record<MicErrorCode, string> = {
  inseguro: "El micrófono solo funciona en https o en localhost.",
  "sin-soporte": "Este navegador no permite analizar el micrófono (falta getUserMedia o AudioWorklet).",
  denegado: "No hay permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones y vuelve a intentarlo.",
  "sin-dispositivo": "No se encontró ningún micrófono. Conecta uno o elige otro dispositivo.",
  ocupado: "El micrófono está ocupado por otra aplicación o pestaña.",
  desconocido: "No se pudo abrir el micrófono.",
};

export class MicError extends Error {
  constructor(readonly code: MicErrorCode) {
    super(MESSAGES[code]);
    this.name = "MicError";
  }
}

export function toMicError(cause: unknown): MicError {
  if (cause instanceof MicError) return cause;
  const name = cause instanceof Error ? cause.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return new MicError("denegado");
    case "NotFoundError":
    case "OverconstrainedError":
      return new MicError("sin-dispositivo");
    case "NotReadableError":
    case "AbortError":
      return new MicError("ocupado");
    default:
      return new MicError("desconocido");
  }
}

export interface MicOnsetEvent {
  onset: Onset;
  /** Segundos del `AudioContext` (reloj de render) en que empezó el golpe. */
  time: number;
}

export interface MicLevelEvent {
  levelDb: number;
  peakDb: number;
  gateDb: number;
  calibrating: boolean;
}

export interface MicOpenOptions {
  deviceId?: string | null;
  settings: DetectorSettings;
  meterIntervalMs?: number;
}

const workletModules = new WeakMap<BaseAudioContext, Promise<void>>();

function loadWorklet(context: AudioContext): Promise<void> {
  let pending = workletModules.get(context);
  if (!pending) {
    pending = context.audioWorklet.addModule(ONSET_PROCESSOR_URL);
    pending.catch(() => workletModules.delete(context));
    workletModules.set(context, pending);
  }
  return pending;
}

export async function listMicrophones(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "audioinput" && device.deviceId);
}

/**
 * Micrófono conectado al detector de golpes dentro de un `AudioContext`. Para
 * que los tiempos sean comparables con el acompañamiento hay que abrirlo en el
 * mismo contexto que el motor de audio.
 */
export class MicInput {
  private readonly onsetListeners = new Set<(event: MicOnsetEvent) => void>();
  private readonly levelListeners = new Set<(event: MicLevelEvent) => void>();
  private noiseWaiters: ((profile: NoiseProfile) => void)[] = [];
  private closed = false;

  private constructor(
    readonly context: AudioContext,
    private readonly stream: MediaStream,
    private readonly source: MediaStreamAudioSourceNode,
    private readonly node: AudioWorkletNode,
    private readonly sink: GainNode,
  ) {
    node.port.onmessage = (event: MessageEvent<FromWorklet>) => this.handle(event.data);
  }

  static async open(context: AudioContext, options: MicOpenOptions): Promise<MicInput> {
    if (typeof window === "undefined" || !window.isSecureContext) throw new MicError("inseguro");
    if (!navigator.mediaDevices?.getUserMedia || !context.audioWorklet) throw new MicError("sin-soporte");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
          // Todo el procesado de voz estropea los ataques y añade retardo.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 1 },
        },
      });
    } catch (cause) {
      throw toMicError(cause);
    }

    try {
      await loadWorklet(context);
      const processorOptions: OnsetProcessorOptions = {
        settings: options.settings,
        meterIntervalMs: options.meterIntervalMs ?? 50,
      };
      const source = context.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(context, ONSET_PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: "explicit",
        processorOptions,
      });
      // Salida muda hacia el destino: así el navegador sigue llamando a `process`.
      const sink = context.createGain();
      sink.gain.value = 0;
      source.connect(node);
      node.connect(sink).connect(context.destination);
      return new MicInput(context, stream, source, node, sink);
    } catch (cause) {
      for (const track of stream.getTracks()) track.stop();
      console.error(cause);
      throw new MicError("sin-soporte");
    }
  }

  /** Latencia de captura que declara el navegador, en segundos (0 si no la da). */
  get inputLatency(): number {
    const settings = this.stream.getAudioTracks()[0]?.getSettings() as MediaTrackSettings & { latency?: number };
    const latency = settings?.latency;
    return typeof latency === "number" && Number.isFinite(latency) && latency >= 0 && latency < 1 ? latency : 0;
  }

  get deviceLabel(): string {
    return this.stream.getAudioTracks()[0]?.label ?? "";
  }

  get deviceId(): string | null {
    return this.stream.getAudioTracks()[0]?.getSettings().deviceId ?? null;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  onOnset(listener: (event: MicOnsetEvent) => void): () => void {
    this.onsetListeners.add(listener);
    return () => this.onsetListeners.delete(listener);
  }

  onLevel(listener: (event: MicLevelEvent) => void): () => void {
    this.levelListeners.add(listener);
    return () => this.levelListeners.delete(listener);
  }

  configure(settings: Partial<DetectorSettings>): void {
    this.post({ type: "configure", settings });
  }

  /** Mide el ruido de la sala (hay que estar en silencio) y lo aplica al detector. */
  measureNoise(seconds: number): Promise<NoiseProfile> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.noiseWaiters = this.noiseWaiters.filter((waiter) => waiter !== done);
        reject(new Error("La medición del ruido no terminó (¿el audio está en pausa?)."));
      }, (seconds + 3) * 1000);
      const done = (profile: NoiseProfile) => {
        clearTimeout(timeout);
        resolve(profile);
      };
      this.noiseWaiters.push(done);
      this.post({ type: "measure-noise", seconds });
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.node.port.onmessage = null;
    this.source.disconnect();
    this.node.disconnect();
    this.sink.disconnect();
    for (const track of this.stream.getTracks()) track.stop();
    this.onsetListeners.clear();
    this.levelListeners.clear();
  }

  private post(message: ToWorklet) {
    if (!this.closed) this.node.port.postMessage(message);
  }

  private handle(message: FromWorklet) {
    switch (message.type) {
      case "onset":
        for (const listener of this.onsetListeners) listener({ onset: message.onset, time: message.time });
        break;
      case "level":
        for (const listener of this.levelListeners) listener(message);
        break;
      case "noise-profile": {
        const waiters = this.noiseWaiters;
        this.noiseWaiters = [];
        for (const waiter of waiters) waiter(message.profile);
        break;
      }
      default: {
        const exhaustive: never = message;
        throw new Error(`Mensaje desconocido: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
}
