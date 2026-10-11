import { describe, expect, it } from "vitest";

import { loadSong } from "../songs/load";
import { meterFor, quantizeNotes, quantizeTrack, type QuantizableNote, type QuantizedBeat } from "./quantize";

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

  it("detecta tresillos de semicorchea (seisillos)", () => {
    const notes = [0, 1, 2, 3, 4, 5].map((i) => note(2 + i / 6));
    const { bars, merged, maxOffset } = quantizeNotes(notes, { beatsPerBar: 4, bars: 1 });
    const beat = bars[0].beats[2];
    expect(beat.division).toBe(6);
    expect(onsets(beat)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(merged).toBe(0);
    expect(maxOffset).toBeLessThan(1e-9);
  });

  it("un tresillo de corcheas exacto no se escribe como seisillo", () => {
    const notes = [0, 1 / 3, 2 / 3].map((beat) => note(beat));
    const { bars } = quantizeNotes(notes, { beatsPerBar: 4, bars: 1 });
    expect(bars[0].beats[0].division).toBe(3);
  });

  it("detecta fusas sin perder golpes", () => {
    const notes = [0, 0.125, 0.25, 0.5].map((beat) => note(beat));
    const { bars, merged } = quantizeNotes(notes, { beatsPerBar: 4, bars: 1 });
    expect(bars[0].beats[0].division).toBe(8);
    expect(onsets(bars[0].beats[0])).toEqual([0, 1, 2, 4]);
    expect(merged).toBe(0);
  });

  it("las semicorcheas con swing moderado siguen siendo semicorcheas, no seisillos ni fusas", () => {
    // 2.ª y 4.ª semicorchea 0,07 negras tarde: el «suingue» habitual de la samba.
    const notes = [0, 0.32, 0.5, 0.82].map((beat) => note(beat));
    const { bars } = quantizeNotes(notes, { beatsPerBar: 4, bars: 1 });
    expect(bars[0].beats[0].division).toBe(4);
    expect(onsets(bars[0].beats[0])).toEqual([0, 1, 2, 3]);
  });

  it("en 6/8 agrupa por negras con puntillo", () => {
    // Dos pulsos de negra con puntillo: corcheas en el primero, semicorcheas en el segundo.
    const notes = [0, 0.5, 1, 1.5, 1.75, 2, 2.25, 2.5, 2.75].map((beat) => note(beat));
    const { bars, merged, maxOffset } = quantizeNotes(notes, { beatsPerBar: 3, bars: 1, meter: "compound" });
    expect(bars[0].beats.map((b) => [b.beat, b.span, b.division])).toEqual([
      [0, 1.5, 3],
      [1.5, 1.5, 6],
    ]);
    expect(onsets(bars[0].beats[0])).toEqual([0, 1, 2]);
    expect(onsets(bars[0].beats[1])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(bars[0].beats[1].slots[3]?.beat).toBeCloseTo(2.25);
    expect(merged).toBe(0);
    expect(maxOffset).toBeLessThan(1e-9);
  });

  it("en 12/8 hay cuatro pulsos por compás y las notas pasan bien de un compás a otro", () => {
    const { bars } = quantizeNotes([note(5.5), note(6), note(11.5)], { beatsPerBar: 6, bars: 2, meter: "compound" });
    expect(bars.map((b) => b.beats.length)).toEqual([4, 4]);
    expect(bars.map((b) => b.startBeat)).toEqual([0, 6]);
    expect(onsets(bars[0].beats[3])).toEqual([2]);
    expect(onsets(bars[1].beats[0])).toEqual([0]);
    expect(onsets(bars[1].beats[3])).toEqual([2]);
  });

  it("elige compás compuesto solo para 6/8 y 12/8", () => {
    expect(meterFor([6, 8], 3)).toBe("compound");
    expect(meterFor([12, 8], 6)).toBe("compound");
    expect(meterFor([4, 4], 4)).toBe("simple");
    expect(meterFor([2, 4], 2)).toBe("simple");
    expect(meterFor([3, 8], 2)).toBe("simple");
    expect(meterFor([9, 8], 5)).toBe("simple");
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
