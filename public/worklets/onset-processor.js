// Generado por `npm run worklet:build` desde src/lib/mic/worklet/onset-processor.ts. No editar a mano.
"use strict";
(() => {
  // src/lib/mic/fft.ts
  var FFT = class {
    constructor(size) {
      if (size < 2 || (size & size - 1) !== 0) throw new Error(`FFT: el tama\xF1o debe ser potencia de 2 (recibido ${size}).`);
      this.size = size;
      this.cos = new Float64Array(size / 2);
      this.sin = new Float64Array(size / 2);
      for (let i = 0; i < size / 2; i++) {
        this.cos[i] = Math.cos(-2 * Math.PI * i / size);
        this.sin[i] = Math.sin(-2 * Math.PI * i / size);
      }
      const bits = Math.log2(size);
      this.reversed = new Uint32Array(size);
      for (let i = 0; i < size; i++) {
        let r = 0;
        for (let b = 0; b < bits; b++) r |= (i >> b & 1) << bits - 1 - b;
        this.reversed[i] = r;
      }
      this.re = new Float64Array(size);
      this.im = new Float64Array(size);
    }
    /**
     * Escribe en `out` las magnitudes de los bins 0..size/2 de la señal real
     * `input` (longitud `size`).
     */
    magnitudes(input, out) {
      const { size, re, im, reversed } = this;
      for (let i = 0; i < size; i++) {
        re[reversed[i]] = input[i];
        im[reversed[i]] = 0;
      }
      for (let len = 2; len <= size; len <<= 1) {
        const half = len >> 1;
        const step = size / len;
        for (let start = 0; start < size; start += len) {
          for (let k = 0; k < half; k++) {
            const wr = this.cos[k * step];
            const wi = this.sin[k * step];
            const a = start + k;
            const b = a + half;
            const tr = re[b] * wr - im[b] * wi;
            const ti = re[b] * wi + im[b] * wr;
            re[b] = re[a] - tr;
            im[b] = im[a] - ti;
            re[a] += tr;
            im[a] += ti;
          }
        }
      }
      for (let k = 0; k <= size / 2; k++) out[k] = Math.hypot(re[k], im[k]);
    }
  };
  function hannWindow(size) {
    const window = new Float64Array(size);
    for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / size);
    return window;
  }

  // src/lib/mic/onset-detector.ts
  var DEFAULT_DETECTOR_SETTINGS = {
    sensitivity: 0.5,
    refractoryMs: 60,
    noise: null
  };
  var HOP_SIZE = 128;
  var DEFAULT_FLOOR_DB = -60;
  var ABSOLUTE_MIN_GATE_DB = -72;
  var RISE_LOOKBACK_SECONDS = 0.02;
  var FLUX_HISTORY_SECONDS = 0.25;
  var DYNAMIC_RANGE_DB = 30;
  var PEAK_DECAY_DB_PER_SECOND = 40;
  var STRONG_RISE_FACTOR = 2.5;
  var LOG_COMPRESSION = 10;
  var MIN_FLUX_FLOOR = 0.01;
  var SILENCE_DB = -120;
  var FEATURE_SECONDS = 0.025;
  var LOW_BAND_HZ = 250;
  var HIGH_BAND_HZ = 2500;
  var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  var lerp = (a, b, t) => a + (b - a) * t;
  function thresholdsFor(settings) {
    const s = clamp(Number.isFinite(settings.sensitivity) ? settings.sensitivity : 0.5, 0, 1);
    return {
      gateMarginDb: lerp(24, 6, s),
      minRiseDb: lerp(9, 3, s),
      fluxRatio: lerp(4, 1.6, s),
      floorDb: settings.noise?.floorDb ?? DEFAULT_FLOOR_DB,
      fluxFloor: Math.max(MIN_FLUX_FLOOR, (settings.noise?.flux ?? 0) * 1.5),
      refractoryMs: clamp(settings.refractoryMs, 20, 500)
    };
  }
  function fftSizeFor(sampleRate2) {
    return 2 ** Math.max(8, Math.round(Math.log2(sampleRate2 * 0.0107)));
  }
  function percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = Array.from(values).sort((a, b) => a - b);
    const index = clamp(Math.ceil(p / 100 * sorted.length) - 1, 0, sorted.length - 1);
    return sorted[index];
  }
  var OnsetDetector = class {
    constructor(sampleRate2, settings = {}) {
      this.ringPos = 0;
      this.levelPos = 0;
      this.fluxPos = 0;
      this.fluxCount = 0;
      this.hopFill = 0;
      this.framesSeen = 0;
      this.peakTrackerDb = SILENCE_DB;
      this.lastOnsetFrame = -Infinity;
      this.hopsSeen = 0;
      this.calibrationHopsLeft = 0;
      this.calibrationLevels = [];
      this.calibrationFluxes = [];
      this.featureHopsLeft = 0;
      this.featureFrame = 0;
      this.featureEnergy = new Float64Array(3);
      this.featureWeightedHz = 0;
      this.featureStartDb = SILENCE_DB;
      this.featureEndDb = SILENCE_DB;
      this.featureMaxDb = SILENCE_DB;
      this.featureHopIndex = 0;
      /** Último nivel RMS por bloque, dBFS (para el medidor). */
      this.levelDb = SILENCE_DB;
      /** Puerta de nivel vigente, dBFS (para el medidor). */
      this.gateDb = DEFAULT_FLOOR_DB;
      this.sampleRate = sampleRate2;
      this.settings = { ...DEFAULT_DETECTOR_SETTINGS, ...settings };
      this.thresholds = thresholdsFor(this.settings);
      this.fftSize = fftSizeFor(sampleRate2);
      this.fft = new FFT(this.fftSize);
      this.window = hannWindow(this.fftSize);
      this.ring = new Float64Array(this.fftSize);
      this.frameBuf = new Float64Array(this.fftSize);
      const bins = this.fftSize / 2 + 1;
      this.mags = new Float64Array(bins);
      this.logMags = new Float64Array(bins);
      this.prevLogMags = new Float64Array(bins);
      const hopSeconds = HOP_SIZE / sampleRate2;
      this.levels = new Float64Array(Math.max(2, Math.round(RISE_LOOKBACK_SECONDS / hopSeconds))).fill(SILENCE_DB);
      const fluxLength = Math.max(8, Math.round(FLUX_HISTORY_SECONDS / hopSeconds));
      this.fluxes = new Float64Array(fluxLength);
      this.fluxScratch = new Float64Array(fluxLength);
      this.featureHops = Math.max(2, Math.round(FEATURE_SECONDS / hopSeconds));
    }
    get currentSettings() {
      return this.settings;
    }
    get currentThresholds() {
      return this.thresholds;
    }
    get calibrating() {
      return this.calibrationHopsLeft > 0;
    }
    configure(settings) {
      this.settings = { ...this.settings, ...settings };
      this.thresholds = thresholdsFor(this.settings);
    }
    /** Mide el ruido de la sala durante `seconds`; mientras, no se detectan golpes. */
    measureNoise(seconds) {
      this.calibrationHopsLeft = Math.max(1, Math.round(seconds * this.sampleRate / HOP_SIZE));
      this.calibrationLevels = [];
      this.calibrationFluxes = [];
    }
    /**
     * Procesa muestras consecutivas. `startFrame` es el frame absoluto de la
     * primera muestra (en el worklet, `currentFrame`); si no se da, se sigue
     * contando desde la llamada anterior.
     */
    process(samples, startFrame) {
      if (startFrame !== void 0 && startFrame !== this.framesSeen && this.hopFill === 0) this.framesSeen = startFrame;
      const events = [];
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
    sampleAt(back) {
      return this.ring[(this.ringPos - 1 - back + this.fftSize * 2) % this.fftSize];
    }
    analyzeHop(events) {
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
        this.peakTrackerDb - DYNAMIC_RANGE_DB
      );
      this.levelDb = levelDb;
      this.gateDb = gateDb;
      const warm = this.hopsSeen * HOP_SIZE >= N;
      if (this.calibrationHopsLeft > 0) {
        if (warm) {
          this.calibrationLevels.push(levelDb);
          this.calibrationFluxes.push(flux);
        }
        this.calibrationHopsLeft -= 1;
        if (this.calibrationHopsLeft === 0) {
          const profile = {
            floorDb: Math.max(SILENCE_DB, percentile(this.calibrationLevels, 50)),
            flux: percentile(this.calibrationFluxes, 75)
          };
          this.configure({ noise: profile });
          events.push({ type: "noise-profile", profile });
        }
      } else if (warm && levelDb > gateDb && (riseDb >= thresholds.minRiseDb && flux > fluxThreshold || riseDb >= thresholds.minRiseDb * STRONG_RISE_FACTOR) && endFrame - this.lastOnsetFrame >= thresholds.refractoryMs / 1e3 * this.sampleRate) {
        if (this.featureHopsLeft > 0) this.emitFeatures(events);
        const frame = this.refineOnset(endFrame, peak);
        this.lastOnsetFrame = frame;
        const peakDb = 20 * Math.log10(peak + 1e-12);
        events.push({
          type: "onset",
          onset: { frame, peakDb, riseDb, velocity: clamp((peakDb - gateDb) / 30, 0.05, 1) }
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
    startFeatures(frame) {
      this.featureHopsLeft = this.featureHops;
      this.featureFrame = frame;
      this.featureEnergy.fill(0);
      this.featureWeightedHz = 0;
      this.featureStartDb = SILENCE_DB;
      this.featureEndDb = SILENCE_DB;
      this.featureMaxDb = SILENCE_DB;
      this.featureHopIndex = 0;
    }
    accumulateFeatures(levelDb) {
      const binHz = this.sampleRate / this.fftSize;
      for (let k = 1; k < this.mags.length; k++) {
        const energy = this.mags[k] * this.mags[k];
        const hz = k * binHz;
        this.featureEnergy[hz < LOW_BAND_HZ ? 0 : hz < HIGH_BAND_HZ ? 1 : 2] += energy;
        this.featureWeightedHz += energy * hz;
      }
      if (this.featureHopIndex < 3) this.featureStartDb = Math.max(this.featureStartDb, levelDb);
      this.featureEndDb = levelDb;
      this.featureMaxDb = Math.max(this.featureMaxDb, levelDb);
      this.featureHopIndex += 1;
    }
    emitFeatures(events) {
      this.featureHopsLeft = 0;
      const [low, mid, high] = this.featureEnergy;
      const total = low + mid + high + 1e-12;
      const centroid = Math.max(20, this.featureWeightedHz / total);
      events.push({
        type: "features",
        frame: this.featureFrame,
        features: [Math.log2(centroid), low / total, high / total, (this.featureStartDb - this.featureEndDb) / 10],
        strikeDb: this.featureMaxDb
      });
    }
    fluxMedian() {
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
    refineOnset(endFrame, hopPeak) {
      let baseline = 0;
      for (let k = 2 * HOP_SIZE; k < 3 * HOP_SIZE; k++) baseline += this.sampleAt(k) ** 2;
      const threshold = Math.max(0.2 * hopPeak, 3 * Math.sqrt(baseline / HOP_SIZE));
      for (let back = 2 * HOP_SIZE - 1; back >= 0; back--) {
        if (Math.abs(this.sampleAt(back)) >= threshold) return endFrame - 1 - back;
      }
      return endFrame - HOP_SIZE;
    }
  };

  // src/lib/mic/protocol.ts
  var ONSET_PROCESSOR_NAME = "heroleiros-onset";

  // src/lib/mic/worklet/onset-processor.ts
  var OnsetProcessor = class extends AudioWorkletProcessor {
    constructor(options) {
      super(options);
      this.framesSinceMeter = 0;
      this.maxLevelDb = -120;
      this.maxPeak = 0;
      const opts = options?.processorOptions ?? {};
      this.detector = new OnsetDetector(sampleRate, opts.settings ?? DEFAULT_DETECTOR_SETTINGS);
      this.meterFrames = this.toFrames(opts.meterIntervalMs ?? 50);
      this.port.onmessage = (event) => this.handle(event.data);
    }
    toFrames(ms) {
      return ms > 0 ? Math.round(ms / 1e3 * sampleRate) : 0;
    }
    handle(message) {
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
          const exhaustive = message;
          throw new Error(`Mensaje desconocido: ${JSON.stringify(exhaustive)}`);
        }
      }
    }
    post(message) {
      this.port.postMessage(message);
    }
    process(inputs) {
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
            const exhaustive = event;
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
            calibrating: this.detector.calibrating
          });
          this.framesSinceMeter = 0;
          this.maxLevelDb = -120;
          this.maxPeak = 0;
        }
      }
      return true;
    }
  };
  registerProcessor(ONSET_PROCESSOR_NAME, OnsetProcessor);
})();
