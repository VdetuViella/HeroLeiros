/**
 * AudioWorkletProcessor que detecta golpes en la entrada del micrófono.
 * Se empaqueta con `npm run worklet:build` en `public/worklets/onset-processor.js`
 * (el worklet no puede importar módulos de la app en tiempo de ejecución).
 */
import { DEFAULT_DETECTOR_SETTINGS, OnsetDetector } from "../onset-detector";
import { ONSET_PROCESSOR_NAME, type FromWorklet, type OnsetProcessorOptions, type ToWorklet } from "../protocol";

// Globales del AudioWorkletGlobalScope (no están en la lib DOM de TypeScript).
declare const sampleRate: number;
declare const currentFrame: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
}
declare function registerProcessor(
  name: string,
  processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;

class OnsetProcessor extends AudioWorkletProcessor {
  private readonly detector: OnsetDetector;
  private meterFrames: number;
  private framesSinceMeter = 0;
  private maxLevelDb = -120;
  private maxPeak = 0;

  constructor(options?: AudioWorkletNodeOptions) {
    super(options);
    const opts = (options?.processorOptions ?? {}) as Partial<OnsetProcessorOptions>;
    this.detector = new OnsetDetector(sampleRate, opts.settings ?? DEFAULT_DETECTOR_SETTINGS);
    this.meterFrames = this.toFrames(opts.meterIntervalMs ?? 50);
    this.port.onmessage = (event: MessageEvent<ToWorklet>) => this.handle(event.data);
  }

  private toFrames(ms: number): number {
    return ms > 0 ? Math.round((ms / 1000) * sampleRate) : 0;
  }

  private handle(message: ToWorklet) {
    switch (message.type) {
      case "configure":
        this.detector.configure(message.settings);
        break;
      case "measure-noise":
        this.detector.measureNoise(message.seconds);
        break;
      case "meter":
        this.meterFrames = this.toFrames(message.intervalMs);
        break;
      default: {
        const exhaustive: never = message;
        throw new Error(`Mensaje desconocido: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  private post(message: FromWorklet) {
    this.port.postMessage(message);
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    for (const event of this.detector.process(channel, currentFrame)) {
      switch (event.type) {
        case "onset":
          this.post({ type: "onset", onset: event.onset, time: event.onset.frame / sampleRate });
          break;
        case "features":
          this.post({ type: "features", frame: event.frame, features: event.features, strikeDb: event.strikeDb });
          break;
        case "noise-profile":
          this.post({ type: "noise-profile", profile: event.profile });
          break;
        default: {
          const exhaustive: never = event;
          throw new Error(`Evento desconocido: ${JSON.stringify(exhaustive)}`);
        }
      }
    }

    if (this.meterFrames > 0) {
      this.maxLevelDb = Math.max(this.maxLevelDb, this.detector.levelDb);
      for (let i = 0; i < channel.length; i++) this.maxPeak = Math.max(this.maxPeak, Math.abs(channel[i]));
      this.framesSinceMeter += channel.length;
      if (this.framesSinceMeter >= this.meterFrames) {
        this.post({
          type: "level",
          levelDb: this.maxLevelDb,
          peakDb: 20 * Math.log10(this.maxPeak + 1e-12),
          gateDb: this.detector.gateDb,
          calibrating: this.detector.calibrating,
        });
        this.framesSinceMeter = 0;
        this.maxLevelDb = -120;
        this.maxPeak = 0;
      }
    }
    return true;
  }
}

registerProcessor(ONSET_PROCESSOR_NAME, OnsetProcessor);
