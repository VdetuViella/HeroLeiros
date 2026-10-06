import { describe, expect, it } from "vitest";

import { loadSong } from "../songs/load";
import { quantizeNotes, quantizeTrack, type QuantizableNote, type QuantizedBeat } from "./quantize";

let nextId = 0;
function note(beat: number, extra: Partial<QuantizableNote> = {}): QuantizableNote {
  return { id: `n-${nextId++}`, beat, stroke: "abierto", accent: false, lane: 0, ...extra };
}

function onsets(beat: QuantizedBeat): number[] {
  return beat.slots.flatMap((slot, i) => (slot ? [i] : []));
}

describe("quantizeNotes", () => {
  it("deja intactas las semicorcheas exactas", () => {
    const notes = [0, 0.25, 0.5, 0.75, 1.5].map((beat) => note(beat));
    const { bars, merged, maxOffset } = quantizeNotes(notes, { beatsPerBar: 4, bars: 1 });
    expect(bars).toHaveLength(1);
    expect(bars[0].beats.map((b) => b.division)).toEqual([4, 4, 4, 4]);
    expect(onsets(bars[0].beats[0])).toEqual([0, 1, 2, 3]);
    expect(onsets(bars[0].beats[1])).toEqual([2]);
    expect(onsets(bars[0].beats[2])).toEqual([]);
    expect(merged).toBe(0);
    expect(maxOffset).toBe(0);
  });

  it("ajusta a semicorcheas las notas tocadas con poca precisión", () => {
    const notes = [0.02, 0.27, 0.46, 0.79].map((beat) => note(beat));
    const { bars, maxOffset } = quantizeNotes(notes, { beatsPerBar: 4, bars: 1 });
    const [beat] = bars[0].beats;
    expect(beat.division).toBe(4);
    expect(beat.slots.map((s) => s?.beat)).toEqual([0, 0.25, 0.5, 0.75]);
    expect(beat.slots[2]?.offset).toBeCloseTo(-0.04);
    expect(maxOffset).toBeCloseTo(0.04);
  });

  it("detecta tresillos de corchea", () => {
    const notes = [1, 1 + 1 / 3, 1 + 2 / 3].map((beat) => note(beat));
    const { bars } = quantizeNotes(notes, { beatsPerBar: 4, bars: 1 });
    const beat = bars[0].beats[1];
    expect(beat.division).toBe(3);
    expect(onsets(beat)).toEqual([0, 1, 2]);
    expect(beat.slots[1]?.beat).toBeCloseTo(4 / 3);
    expect(bars[0].beats[0].division).toBe(4);
  });

  it("detecta un tresillo incompleto y lo mezcla con semicorcheas en el mismo compás", () => {
    const notes = [note(0), note(0.25), note(1), note(1 + 2 / 3)];
    const { bars } = quantizeNotes(notes, { beatsPerBar: 4, bars: 1 });
    expect(bars[0].beats.map((b) => b.division)).toEqual([4, 3, 4, 4]);
    expect(onsets(bars[0].beats[1])).toEqual([0, 2]);
  });

  it("no convierte en tresillo una corchea un poco tarde", () => {
    const { bars } = quantizeNotes([note(0), note(0.58)], { beatsPerBar: 4, bars: 1 });
    expect(bars[0].beats[0].division).toBe(4);
    expect(onsets(bars[0].beats[0])).toEqual([0, 2]);
  });

  it("lleva al pulso siguiente las notas que se adelantan o que caen al final del pulso", () => {
    const { bars } = quantizeNotes([note(2.98), note(0.93)], { beatsPerBar: 4, bars: 1 });
    expect(onsets(bars[0].beats[3])).toEqual([0]);
    expect(bars[0].beats[3].slots[0]?.beat).toBe(3);
    expect(onsets(bars[0].beats[1])).toEqual([0]);
    expect(onsets(bars[0].beats[0])).toEqual([]);
  });

  it("fusiona las notas que caen en la misma casilla y conserva el acento", () => {
    const notes = [note(0.5), note(0.52, { accent: true })];
    const { bars, merged } = quantizeNotes(notes, { beatsPerBar: 4, bars: 1 });
    expect(merged).toBe(1);
    const slot = bars[0].beats[0].slots[2];
    expect(slot?.id).toBe(notes[0].id);
    expect(slot?.accent).toBe(true);
  });

  it("reparte los pulsos por compases y respeta el último pulso", () => {
    const { bars } = quantizeNotes([note(5.5), note(7.99)], { beatsPerBar: 2, bars: 4 });
    expect(bars.map((b) => b.bar)).toEqual([1, 2, 3, 4]);
    expect(bars.map((b) => b.startBeat)).toEqual([0, 2, 4, 6]);
    expect(onsets(bars[2].beats[1])).toEqual([2]);
    expect(onsets(bars[3].beats[1])).toEqual([3]);
  });
});

describe("quantizeTrack con las canciones de ejemplo", () => {
  it("ijexa-de-ensayo: los compases de tresillos se escriben en tresillo y los binarios en semicorcheas", async () => {
    const { chart } = await loadSong("ijexa-de-ensayo");
    const caixa = chart.tracks.find((t) => t.instrument === "caixa");
    if (!caixa) throw new Error("falta la caixa");
    const divisions = quantizeTrack(chart, caixa).bars.map((bar) => bar.beats.map((b) => b.division).join(""));
    expect(divisions).toEqual(["4444", "4444", "3333", "3333", "3333", "3333", "4444", "4444"]);
  });

  it.each(["samba-de-ensayo", "primeros-pasos", "ijexa-de-ensayo"])("%s: todas las notas caen en la rejilla sin perder ninguna", async (slug) => {
    const { chart } = await loadSong(slug);
    for (const track of chart.tracks) {
      const quantized = quantizeTrack(chart, track);
      const placed = quantized.bars.flatMap((bar) => bar.beats.flatMap((beat) => beat.slots.filter(Boolean)));
      expect(quantized.bars).toHaveLength(chart.bars);
      expect(quantized.merged).toBe(0);
      expect(quantized.maxOffset).toBeLessThan(1e-6);
      expect(placed).toHaveLength(track.notes.length);
    }
  });
});
