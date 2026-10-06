import type { Chart, ChartNote, ChartSection, ChartTrack, InstrumentId } from "./types";

export function getTrack(chart: Chart, instrument: InstrumentId): ChartTrack | undefined {
  return chart.tracks.find((track) => track.instrument === instrument);
}

/** Notas con `startBeat <= beat < endBeat`. Las notas deben estar ordenadas. */
export function notesInRange(notes: ChartNote[], startBeat: number, endBeat: number): ChartNote[] {
  const from = lowerBound(notes, startBeat);
  const to = lowerBound(notes, endBeat);
  return notes.slice(from, to);
}

export function lowerBound(notes: { beat: number }[], beat: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].beat < beat - 1e-9) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Índice de la sección que contiene el pulso, o -1 si ninguna. */
export function sectionIndexAt(sections: ChartSection[], beat: number): number {
  for (let i = sections.length - 1; i >= 0; i--) {
    const section = sections[i];
    if (beat >= section.startBeat - 1e-9 && beat < section.endBeat - 1e-9) return i;
  }
  return -1;
}

export function barToBeat(chart: Chart, bar: number): number {
  return (bar - 1) * chart.beatsPerBar;
}
