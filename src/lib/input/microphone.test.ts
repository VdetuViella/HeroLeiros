import { describe, expect, it } from "vitest";

import type { MicInput, MicLevelEvent, MicOnsetEvent } from "../mic/mic-input";
import { MicInputSource } from "./microphone";
import type { InputHit } from "./types";

class FakeMic {
  closed = false;
  inputLatency = 0.01;
  readonly onsets = new Set<(event: MicOnsetEvent) => void>();
  readonly levels = new Set<(event: MicLevelEvent) => void>();
  onOnset(listener: (event: MicOnsetEvent) => void) {
    this.onsets.add(listener);
    return () => this.onsets.delete(listener);
  }
  onLevel(listener: (event: MicLevelEvent) => void) {
    this.levels.add(listener);
    return () => this.levels.delete(listener);
  }
  close() {
    this.closed = true;
  }
  emit(time: number, velocity = 0.5) {
    for (const listener of this.onsets) listener({ time, onset: { frame: time * 48000, peakDb: -10, riseDb: 20, velocity } });
  }
}

/** Motor cuyo audio se oye 40 ms después de renderizarse. */
const engine = { currentTime: 5, heardTime: () => 5 - 0.04 };

describe("MicInputSource", () => {
  it("emite golpes sin carril en el reloj de lo que se oye", () => {
    const mic = new FakeMic();
    const source = new MicInputSource(mic as unknown as MicInput, engine);
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
    const source = new MicInputSource(mic as unknown as MicInput, engine);
    const hits: InputHit[] = [];
    source.start((hit) => hits.push(hit));
    source.stop();
    mic.emit(4.5);
    expect(hits).toHaveLength(0);
    expect(mic.closed).toBe(true);
    expect(mic.onsets.size).toBe(0);
    expect(mic.levels.size).toBe(0);
  });

  it("puede parar sin cerrar el micrófono (calibración, monitor)", () => {
    const mic = new FakeMic();
    const source = new MicInputSource(mic as unknown as MicInput, engine, false);
    source.start(() => {});
    source.stop();
    expect(mic.closed).toBe(false);
  });
});
