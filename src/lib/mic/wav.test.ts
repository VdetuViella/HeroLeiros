import { describe, expect, it } from "vitest";

import { HOP_SIZE, OnsetDetector } from "./onset-detector";
import { clickTrack, renderHits } from "./test-signals";
import { encodeWav } from "./wav";

function decodeWav(bytes: Uint8Array): { sampleRate: number; samples: Float32Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleRate = view.getUint32(24, true);
  const length = view.getUint32(40, true) / 2;
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) samples[i] = view.getInt16(44 + i * 2, true) / 0x8000;
  return { sampleRate, samples };
}

describe("encodeWav", () => {
  it("escribe una cabecera PCM 16 bits mono válida", () => {
    const bytes = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1]), 44100);
    const text = (from: number) => String.fromCharCode(...bytes.slice(from, from + 4));
    expect(text(0)).toBe("RIFF");
    expect(text(8)).toBe("WAVE");
    expect(text(36)).toBe("data");
    expect(bytes.length).toBe(44 + 10);
    const { sampleRate, samples } = decodeWav(bytes);
    expect(sampleRate).toBe(44100);
    expect(samples[1]).toBeCloseTo(0.5, 3);
    expect(samples[4]).toBe(-1);
  });

  it("el detector encuentra los golpes tras pasar por WAV (como el micrófono falso)", () => {
    const hits = clickTrack(90, 6, 0.2, "caixa", 0.6);
    const { sampleRate, samples } = decodeWav(encodeWav(renderHits({ sampleRate: 48000, seconds: 4.2, hits, noiseRms: 0.002 }), 48000));
    const detector = new OnsetDetector(sampleRate);
    const found: number[] = [];
    for (let i = 0; i < samples.length; i += HOP_SIZE) {
      for (const e of detector.process(samples.subarray(i, i + HOP_SIZE))) if (e.type === "onset") found.push(e.onset.frame / sampleRate);
    }
    expect(found).toHaveLength(hits.length);
    found.forEach((t, i) => expect(Math.abs(t - hits[i].time)).toBeLessThan(0.003));
  });
});
