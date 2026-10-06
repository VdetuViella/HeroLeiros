import { describe, expect, it } from "vitest";

import type { MicFeaturesEvent, MicLevelEvent, MicOnsetEvent } from "../mic/mic-input";
import type { StrokeFeatures } from "../mic/onset-detector";
import { StrokeClassifier } from "../mic/stroke-classifier";
import { MicInputSource } from "./microphone";
import type { InputHit } from "./types";

class FakeMic {
  closed = false;
  inputLatency = 0.01;
  readonly onsets = new Set<(event: MicOnsetEvent) => void>();
  readonly levels = new Set<(event: MicLevelEvent) => void>();
  readonly features = new Set<(event: MicFeaturesEvent) => void>();
  onOnset(listener: (event: MicOnsetEvent) => void) {
    this.onsets.add(listener);
    return () => this.onsets.delete(listener);
  }
  onLevel(listener: (event: MicLevelEvent) => void) {
    this.levels.add(listener);
    return () => this.levels.delete(listener);
  }
  onFeatures(listener: (event: MicFeaturesEvent) => void) {
    this.features.add(listener);
    return () => this.features.delete(listener);
  }
  close() {
    this.closed = true;
  }
  emit(time: number, velocity = 0.5) {
    for (const listener of this.onsets) listener({ time, onset: { frame: Math.round(time * 48000), peakDb: -10, riseDb: 20, velocity } });
  }
  emitFeatures(time: number, features: StrokeFeatures) {
    for (const listener of this.features) listener({ frame: Math.round(time * 48000), features });
  }
}

/** Motor cuyo audio se oye 40 ms después de renderizarse. */
const engine = { currentTime: 5, heardTime: () => 5 - 0.04 };

describe("MicInputSource", () => {
  it("emite golpes sin carril en el reloj de lo que se oye", () => {
    const mic = new FakeMic();
    const source = new MicInputSource(mic, engine);
    const hits: InputHit[] = [];
    source.start((hit) => hits.push(hit));
    mic.emit(4.5, 0.8);

    expect(source.kind).toBe("microfono");
    expect(source.lanesAware).toBe(false);
    expect(hits).toHaveLength(1);
    expect(hits[0].lane).toBeNull();
    expect(hits[0].source).toBe("microfono");
    expect(hits[0].velocity).toBe(0.8);
    // 4,5 s de render − 40 ms de salida − 10 ms de entrada.
    expect(hits[0].time).toBeCloseTo(4.45, 6);
  });

  it("deja de escuchar y libera el micrófono al parar", () => {
    const mic = new FakeMic();
    const source = new MicInputSource(mic, engine);
    const hits: InputHit[] = [];
    source.start((hit) => hits.push(hit));
    source.stop();
    mic.emit(4.5);
    expect(hits).toHaveLength(0);
    expect(mic.closed).toBe(true);
    expect(mic.onsets.size).toBe(0);
    expect(mic.levels.size).toBe(0);
    expect(mic.features.size).toBe(0);
  });

  it("puede parar sin cerrar el micrófono (calibración, monitor)", () => {
    const mic = new FakeMic();
    const source = new MicInputSource(mic, engine, { closeOnStop: false });
    source.start(() => {});
    source.stop();
    expect(mic.closed).toBe(false);
  });

  it("con clasificador espera al timbre y pone el carril reconocido (fase B)", () => {
    const grave: StrokeFeatures = [7, 0.7, 0.05, 0.1];
    const agudo: StrokeFeatures = [11.5, 0.1, 0.6, 0.4];
    const classifier = new StrokeClassifier({ samples: [[grave], [agudo]] });
    const mic = new FakeMic();
    const source = new MicInputSource(mic, engine, { classifier });
    const hits: InputHit[] = [];
    source.start((hit) => hits.push(hit));

    expect(source.lanesAware).toBe(true);
    mic.emit(4.5);
    expect(hits).toHaveLength(0);
    mic.emitFeatures(4.5, agudo);
    mic.emit(4.9);
    mic.emitFeatures(4.9, grave);
    expect(hits.map((h) => h.lane)).toEqual([1, 0]);
    expect(hits[0].time).toBeCloseTo(4.45, 6);
  });

  it("si falta el timbre de un golpe, sale sin carril antes del siguiente", () => {
    const classifier = new StrokeClassifier({ samples: [[[7, 0.7, 0.05, 0.1]], [[11, 0.1, 0.6, 0.4]]] });
    const mic = new FakeMic();
    const source = new MicInputSource(mic, engine, { classifier });
    const hits: InputHit[] = [];
    source.start((hit) => hits.push(hit));
    mic.emit(4.5);
    mic.emit(4.9);
    expect(hits).toHaveLength(1);
    expect(hits[0].lane).toBeNull();
  });
});
