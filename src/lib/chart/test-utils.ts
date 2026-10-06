import { Midi } from "@tonejs/midi";

export interface TestNote {
  midi: number;
  /** En negras. */
  beat: number;
  /** 1..127 */
  velocity?: number;
}

export interface TestMidiOptions {
  bpm?: number;
  extraTempos?: { beat: number; bpm: number }[];
  timeSignature?: [number, number];
  markers?: { beat: number; text: string }[];
  tracks: { name: string; notes: TestNote[] }[];
}

/** Construye un MIDI en memoria para los tests. */
export function buildTestMidi(options: TestMidiOptions): Uint8Array {
  const midi = new Midi();
  const ppq = midi.header.ppq;
  midi.header.setTempo(options.bpm ?? 120);
  for (const tempo of options.extraTempos ?? []) {
    midi.header.tempos.push({ ticks: tempo.beat * ppq, bpm: tempo.bpm });
  }
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: options.timeSignature ?? [4, 4] });
  for (const marker of options.markers ?? []) {
    midi.header.meta.push({ type: "marker", text: marker.text, ticks: marker.beat * ppq });
  }
  midi.header.update();
  for (const spec of options.tracks) {
    const track = midi.addTrack();
    track.name = spec.name;
    for (const note of spec.notes) {
      track.addNote({
        midi: note.midi,
        ticks: Math.round(note.beat * ppq),
        durationTicks: ppq / 8,
        velocity: (note.velocity ?? 90) / 127,
      });
    }
  }
  return midi.toArray();
}
