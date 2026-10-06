import { FFT, hannWindow } from "./fft";

/** Ruido de la sala medido en silencio. */
export interface NoiseProfile {
  /**
   * Nivel del ruido (mediana del nivel por bloque), dBFS. La mediana aguanta
   * que durante la medición se cuele algún golpe o una tos.
   */
  floorDb: number;
  /** Flujo espectral típico del ruido (percentil 75). */
  flux: number;
}

export interface DetectorSettings {
  /** 0 = solo golpes fuertes y claros; 1 = muy sensible. */
  sensitivity: number;
  /** Tiempo muerto mínimo entre dos golpes, en ms. */
  refractoryMs: number;
  noise: NoiseProfile | null;
}

export const DEFAULT_DETECTOR_SETTINGS: DetectorSettings = {
  sensitivity: 0.5,
  refractoryMs: 60,
  noise: null,
};

export interface Onset {
  /** Muestra absoluta (frame del `AudioContext`) donde empieza el ataque. */
  frame: number;
  /** Nivel de pico del bloque del ataque, dBFS. */
  peakDb: number;
  /** Subida de energía respecto a lo que sonaba justo antes, dB. */
  riseDb: number;
  /** Intensidad 0..1 relativa al umbral. */
  velocity: number;
}

/**
 * Timbre de los primeros ~25 ms de un golpe, para distinguir abierto, apagado
 * o aro (fase B): [log2 del centroide espectral en Hz, fracción de energía
 * por debajo de 250 Hz, fracción por encima de 2,5 kHz, caída de nivel en dB/10].
 */
export type StrokeFeatures = [number, number, number, number];

export type DetectorEvent =
  | { type: "onset"; onset: Onset }
  | { type: "features"; frame: number; features: StrokeFeatures }
  | { type: "noise-profile"; profile: NoiseProfile };

export interface Thresholds {
  /** Nivel mínimo para aceptar un golpe, por encima del ruido medido. */
  gateMarginDb: number;
  /** Subida mínima de energía frente a los últimos ~20 ms. */
  minRiseDb: number;
  /** El flujo espectral debe superar `fluxRatio` × su mediana reciente. */
  fluxRatio: number;
  floorDb: number;
  fluxFloor: number;
  refractoryMs: number;
}

/** Hop = tamaño del bloque de render del AudioWorklet. */
export const HOP_SIZE = 128;
/** Sin calibrar se supone una sala tranquila. */
export const DEFAULT_FLOOR_DB = -60;
const ABSOLUTE_MIN_GATE_DB = -72;
const RISE_LOOKBACK_SECONDS = 0.02;
const FLUX_HISTORY_SECONDS = 0.25;
/** Tras un golpe fuerte, se ignora lo que quede este margen por debajo (resonancias, eco). */
const DYNAMIC_RANGE_DB = 30;
const PEAK_DECAY_DB_PER_SECOND = 40;
/**
 * Un salto de energía así de grande basta aunque el flujo espectral sea poco
 * (sonidos de banda estrecha como un clic senoidal sobre ruido ancho).
 */
const STRONG_RISE_FACTOR = 2.5;
const LOG_COMPRESSION = 10;
const MIN_FLUX_FLOOR = 0.01;
const SILENCE_DB = -120;
const FEATURE_SECONDS = 0.025;
const LOW_BAND_HZ = 250;
const HIGH_BAND_HZ = 2500;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function thresholdsFor(settings: DetectorSettings): Thresholds {
  const s = clamp(Number.isFinite(settings.sensitivity) ? settings.sensitivity : 0.5, 0, 1);
  return {
    gateMarginDb: lerp(24, 6, s),
    minRiseDb: lerp(9, 3, s),
    fluxRatio: lerp(4, 1.6, s),
    floorDb: settings.noise?.floorDb ?? DEFAULT_FLOOR_DB,
    fluxFloor: Math.max(MIN_FLUX_FLOOR, (settings.noise?.flux ?? 0) * 1.5),
    refractoryMs: clamp(settings.refractoryMs, 20, 500),
  };
}

/** Ventana de ~10 ms: 512 muestras a 44,1/48 kHz. */
export function fftSizeFor(sampleRate: number): number {
  return 2 ** Math.max(8, Math.round(Math.log2(sampleRate * 0.0107)));
}

export function percentile(values: ArrayLike<number>, p: number): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const index = clamp(Math.ceil((p / 100) * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[index];
}

/**
 * Detector de ataques (onsets) para instrumentos de percusión, en tiempo real
 * y bloque a bloque. Por cada hop de 128 muestras calcula:
 *
 * - el nivel RMS del bloque y su subida frente al máximo de los ~20 ms
 *   anteriores (energía);
 * - el flujo espectral con compresión logarítmica sobre una ventana Hann de
 *   ~10 ms (cuánto «aparece» de golpe en el espectro).
 *
 * Hay golpe cuando, a la vez: el nivel supera la puerta (ruido medido +
 * margen, o el pico reciente − 30 dB si acaba de sonar algo fuerte), la
 * energía sube al menos `minRiseDb` y el flujo supera su mediana reciente ×
 * `fluxRatio` (umbral adaptativo). Después hay un tiempo muerto
 * (`refractoryMs`). El instante se afina a la muestra buscando el primer
 * valor que destaca dentro del ataque.
 *
 * Es lógica pura: la usa el AudioWorklet y los tests con señales sintéticas.
 */
export class OnsetDetector {
  readonly sampleRate: number;
  readonly fftSize: number;
  private thresholds: Thresholds;
  private settings: DetectorSettings;

  private readonly fft: FFT;
  private readonly window: Float64Array;
  private readonly ring: Float64Array;
  private ringPos = 0;
  private readonly frameBuf: Float64Array;
  private readonly mags: Float64Array;
  private logMags: Float64Array;
  private prevLogMags: Float64Array;

  private readonly levels: Float64Array;
  private levelPos = 0;
  private readonly fluxes: Float64Array;
  private readonly fluxScratch: Float64Array;
  private fluxPos = 0;
  private fluxCount = 0;

  private hopFill = 0;
  private framesSeen = 0;
  private peakTrackerDb = SILENCE_DB;
  private lastOnsetFrame = -Infinity;
  private hopsSeen = 0;

  private calibrationHopsLeft = 0;
  private calibrationLevels: number[] = [];
  private calibrationFluxes: number[] = [];

  private readonly featureHops: number;
  private featureHopsLeft = 0;
  private featureFrame = 0;
  private readonly featureEnergy = new Float64Array(3);
  private featureWeightedHz = 0;
  private featureStartDb = SILENCE_DB;
  private featureEndDb = SILENCE_DB;
  private featureHopIndex = 0;

  /** Último nivel RMS por bloque, dBFS (para el medidor). */
  levelDb = SILENCE_DB;
  /** Puerta de nivel vigente, dBFS (para el medidor). */
  gateDb = DEFAULT_FLOOR_DB;

  constructor(sampleRate: number, settings: Partial<DetectorSettings> = {}) {
    this.sampleRate = sampleRate;
    this.settings = { ...DEFAULT_DETECTOR_SETTINGS, ...settings };
    this.thresholds = thresholdsFor(this.settings);
    this.fftSize = fftSizeFor(sampleRate);
    this.fft = new FFT(this.fftSize);
    this.window = hannWindow(this.fftSize);
    this.ring = new Float64Array(this.fftSize);
    this.frameBuf = new Float64Array(this.fftSize);
    const bins = this.fftSize / 2 + 1;
    this.mags = new Float64Array(bins);
    this.logMags = new Float64Array(bins);
    this.prevLogMags = new Float64Array(bins);
    const hopSeconds = HOP_SIZE / sampleRate;
    this.levels = new Float64Array(Math.max(2, Math.round(RISE_LOOKBACK_SECONDS / hopSeconds))).fill(SILENCE_DB);
    const fluxLength = Math.max(8, Math.round(FLUX_HISTORY_SECONDS / hopSeconds));
    this.fluxes = new Float64Array(fluxLength);
    this.fluxScratch = new Float64Array(fluxLength);
    this.featureHops = Math.max(2, Math.round(FEATURE_SECONDS / hopSeconds));
  }

  get currentSettings(): DetectorSettings {
    return this.settings;
  }

  get currentThresholds(): Thresholds {
    return this.thresholds;
  }

  get calibrating(): boolean {
    return this.calibrationHopsLeft > 0;
  }

  configure(settings: Partial<DetectorSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.thresholds = thresholdsFor(this.settings);
  }

  /** Mide el ruido de la sala durante `seconds`; mientras, no se detectan golpes. */
  measureNoise(seconds: number): void {
    this.calibrationHopsLeft = Math.max(1, Math.round((seconds * this.sampleRate) / HOP_SIZE));
    this.calibrationLevels = [];
    this.calibrationFluxes = [];
  }

  /**
   * Procesa muestras consecutivas. `startFrame` es el frame absoluto de la
   * primera muestra (en el worklet, `currentFrame`); si no se da, se sigue
   * contando desde la llamada anterior.
   */
  process(samples: ArrayLike<number>, startFrame?: number): DetectorEvent[] {
    if (startFrame !== undefined && startFrame !== this.framesSeen && this.hopFill === 0) this.framesSeen = startFrame;
    const events: DetectorEvent[] = [];
    for (let i = 0; i < samples.length; i++) {
      this.ring[this.ringPos] = samples[i];
      this.ringPos = (this.ringPos + 1) % this.fftSize;
      this.hopFill += 1;
      this.framesSeen += 1;
      if (this.hopFill === HOP_SIZE) {
        this.hopFill = 0;
        this.analyzeHop(events);
      }
    }
    return events;
  }

  /** Muestra `back` posiciones antes del final del anillo (0 = la última). */
  private sampleAt(back: number): number {
    return this.ring[(this.ringPos - 1 - back + this.fftSize * 2) % this.fftSize];
  }

  private analyzeHop(events: DetectorEvent[]) {
    const N = this.fftSize;
    const endFrame = this.framesSeen;
    this.hopsSeen += 1;

    let energy = 0;
    let peak = 0;
    for (let k = 0; k < HOP_SIZE; k++) {
      const x = this.sampleAt(k);
      energy += x * x;
      peak = Math.max(peak, Math.abs(x));
    }
    const levelDb = 10 * Math.log10(energy / HOP_SIZE + 1e-12);

    for (let k = 0; k < N; k++) this.frameBuf[k] = this.ring[(this.ringPos + k) % N] * this.window[k];
    this.fft.magnitudes(this.frameBuf, this.mags);
    let flux = 0;
    for (let k = 0; k < this.mags.length; k++) {
      this.logMags[k] = Math.log1p(LOG_COMPRESSION * this.mags[k]);
      const diff = this.logMags[k] - this.prevLogMags[k];
      if (diff > 0) flux += diff;
    }
    flux /= this.mags.length;
    [this.prevLogMags, this.logMags] = [this.logMags, this.prevLogMags];

    // El bloque anterior queda fuera: un ataque suele repartirse entre dos bloques.
    const previous = (this.levelPos - 1 + this.levels.length) % this.levels.length;
    let recentMax = SILENCE_DB;
    for (let k = 0; k < this.levels.length; k++) if (k !== previous) recentMax = Math.max(recentMax, this.levels[k]);
    const riseDb = levelDb - recentMax;

    const fluxMedian = this.fluxMedian();
    const { thresholds } = this;
    const fluxThreshold = Math.max(thresholds.fluxFloor, fluxMedian * thresholds.fluxRatio);

    const hopSeconds = HOP_SIZE / this.sampleRate;
    this.peakTrackerDb = Math.max(levelDb, this.peakTrackerDb - PEAK_DECAY_DB_PER_SECOND * hopSeconds);
    const gateDb = Math.max(
      ABSOLUTE_MIN_GATE_DB,
      thresholds.floorDb + thresholds.gateMarginDb,
      this.peakTrackerDb - DYNAMIC_RANGE_DB,
    );

    this.levelDb = levelDb;
    this.gateDb = gateDb;

    // La FFT necesita una ventana llena antes de que el flujo signifique algo.
    const warm = this.hopsSeen * HOP_SIZE >= N;

    if (this.calibrationHopsLeft > 0) {
      if (warm) {
        this.calibrationLevels.push(levelDb);
        this.calibrationFluxes.push(flux);
      }
      this.calibrationHopsLeft -= 1;
      if (this.calibrationHopsLeft === 0) {
        const profile: NoiseProfile = {
          floorDb: Math.max(SILENCE_DB, percentile(this.calibrationLevels, 50)),
          flux: percentile(this.calibrationFluxes, 75),
        };
        this.configure({ noise: profile });
        events.push({ type: "noise-profile", profile });
      }
    } else if (
      warm &&
      levelDb > gateDb &&
      ((riseDb >= thresholds.minRiseDb && flux > fluxThreshold) || riseDb >= thresholds.minRiseDb * STRONG_RISE_FACTOR) &&
      endFrame - this.lastOnsetFrame >= (thresholds.refractoryMs / 1000) * this.sampleRate
    ) {
      if (this.featureHopsLeft > 0) this.emitFeatures(events);
      const frame = this.refineOnset(endFrame, peak);
      this.lastOnsetFrame = frame;
      const peakDb = 20 * Math.log10(peak + 1e-12);
      events.push({
        type: "onset",
        onset: { frame, peakDb, riseDb, velocity: clamp((peakDb - gateDb) / 30, 0.05, 1) },
      });
      this.startFeatures(frame);
    }

    if (this.featureHopsLeft > 0) {
      this.accumulateFeatures(levelDb);
      this.featureHopsLeft -= 1;
      if (this.featureHopsLeft === 0) this.emitFeatures(events);
    }

    this.levels[this.levelPos] = levelDb;
    this.levelPos = (this.levelPos + 1) % this.levels.length;
    this.fluxes[this.fluxPos] = flux;
    this.fluxPos = (this.fluxPos + 1) % this.fluxes.length;
    this.fluxCount = Math.min(this.fluxCount + 1, this.fluxes.length);
  }

  private startFeatures(frame: number) {
    this.featureHopsLeft = this.featureHops;
    this.featureFrame = frame;
    this.featureEnergy.fill(0);
    this.featureWeightedHz = 0;
    this.featureStartDb = SILENCE_DB;
    this.featureEndDb = SILENCE_DB;
    this.featureHopIndex = 0;
  }

  private accumulateFeatures(levelDb: number) {
    const binHz = this.sampleRate / this.fftSize;
    for (let k = 1; k < this.mags.length; k++) {
      const energy = this.mags[k] * this.mags[k];
      const hz = k * binHz;
      this.featureEnergy[hz < LOW_BAND_HZ ? 0 : hz < HIGH_BAND_HZ ? 1 : 2] += energy;
      this.featureWeightedHz += energy * hz;
    }
    // El ataque puede tardar un par de bloques en llegar a su máximo.
    if (this.featureHopIndex < 3) this.featureStartDb = Math.max(this.featureStartDb, levelDb);
    this.featureEndDb = levelDb;
    this.featureHopIndex += 1;
  }

  private emitFeatures(events: DetectorEvent[]) {
    this.featureHopsLeft = 0;
    const [low, mid, high] = this.featureEnergy;
    const total = low + mid + high + 1e-12;
    const centroid = Math.max(20, this.featureWeightedHz / total);
    events.push({
      type: "features",
      frame: this.featureFrame,
      features: [Math.log2(centroid), low / total, high / total, (this.featureStartDb - this.featureEndDb) / 10],
    });
  }

  private fluxMedian(): number {
    const n = this.fluxCount;
    if (n === 0) return 0;
    const scratch = this.fluxScratch.subarray(0, n);
    scratch.set(this.fluxes.subarray(0, n));
    scratch.sort();
    return n % 2 ? scratch[n >> 1] : (scratch[(n >> 1) - 1] + scratch[n >> 1]) / 2;
  }

  /**
   * Busca, en el bloque del disparo y el anterior, la primera muestra que
   * destaca claramente sobre lo que sonaba dos bloques antes.
   */
  private refineOnset(endFrame: number, hopPeak: number): number {
    let baseline = 0;
    for (let k = 2 * HOP_SIZE; k < 3 * HOP_SIZE; k++) baseline += this.sampleAt(k) ** 2;
    const threshold = Math.max(0.2 * hopPeak, 3 * Math.sqrt(baseline / HOP_SIZE));
    for (let back = 2 * HOP_SIZE - 1; back >= 0; back--) {
      if (Math.abs(this.sampleAt(back)) >= threshold) return endFrame - 1 - back;
    }
    return endFrame - HOP_SIZE;
  }
}
