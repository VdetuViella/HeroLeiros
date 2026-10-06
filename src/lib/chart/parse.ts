import { Midi } from "@tonejs/midi";

import { INSTRUMENTS } from "./instruments";
import { DEFAULT_ACCENT_VELOCITY, mapNote, matchInstrument } from "./mapping";
import type { SongMeta, SongMetaSection } from "./meta";
import type {
  Chart,
  ChartNote,
  ChartSection,
  ChartTrack,
  ChartWarning,
  InstrumentId,
  UnmappedNote,
} from "./types";
import { INSTRUMENT_IDS } from "./types";

export interface ParseChartInput {
  slug: string;
  midi: ArrayBuffer | Uint8Array;
  meta: SongMeta;
}

const BEAT_EPSILON = 1e-6;

export function parseChart({ slug, midi: data, meta }: ParseChartInput): Chart {
  const midi = new Midi(data);
  const warnings: ChartWarning[] = [];
  const ppq = midi.header.ppq;

  const midiTempos = midi.header.tempos;
  const distinctTempos = new Set(midiTempos.map((t) => Math.round(t.bpm * 100) / 100));
  if (distinctTempos.size > 1) {
    warnings.push({
      code: "cambio-de-tempo",
      message: `El MIDI tiene ${distinctTempos.size} tempos distintos; HeroLeiros usa un tempo constante (${meta.bpm ?? midiTempos[0].bpm} BPM).`,
    });
  }
  const bpm = round(meta.bpm ?? midiTempos[0]?.bpm ?? 120, 3);

  const timeSignature: [number, number] = meta.timeSignature ??
    (midi.header.timeSignatures[0]?.timeSignature as [number, number] | undefined) ?? [4, 4];
  let beatsPerBar = (timeSignature[0] * 4) / timeSignature[1];
  if (!Number.isInteger(beatsPerBar)) {
    warnings.push({
      code: "compas-no-soportado",
      message: `El compás ${timeSignature[0]}/${timeSignature[1]} no tiene un número entero de negras; se redondea.`,
    });
    beatsPerBar = Math.max(1, Math.round(beatsPerBar));
  }

  const accentVelocity = meta.accentVelocity ?? DEFAULT_ACCENT_VELOCITY;
  const notesByInstrument = new Map<InstrumentId, Omit<ChartNote, "id" | "lane">[]>();
  const sourceNames = new Map<InstrumentId, string[]>();
  const unmapped = new Map<string, UnmappedNote>();

  midi.tracks.forEach((track, index) => {
    const trackName = track.name.trim() || `Pista ${index + 1}`;
    if (track.notes.length === 0) return;

    const instrument = matchInstrument(trackName, meta.trackAliases);
    if (!instrument) {
      warnings.push({
        code: "pista-desconocida",
        message: `La pista «${trackName}» no corresponde a ningún instrumento; se ignora.`,
      });
      for (const note of track.notes) addUnmapped(unmapped, trackName, null, note.midi);
      return;
    }

    const names = sourceNames.get(instrument) ?? [];
    if (names.length > 0) {
      warnings.push({
        code: "pista-duplicada",
        message: `«${trackName}» y «${names[0]}» son ambas ${INSTRUMENTS[instrument].name}; se combinan.`,
      });
    }
    sourceNames.set(instrument, [...names, trackName]);

    const list = notesByInstrument.get(instrument) ?? [];
    for (const note of track.notes) {
      const mapping = mapNote(instrument, note.midi, meta.mapping);
      if (!mapping) {
        addUnmapped(unmapped, trackName, instrument, note.midi);
        continue;
      }
      const beat = round(note.ticks / ppq, 6);
      list.push({
        beat,
        time: round((beat * 60) / bpm, 6),
        bar: Math.floor(beat / beatsPerBar + BEAT_EPSILON) + 1,
        stroke: mapping.stroke,
        velocity: round(note.velocity, 4),
        accent: mapping.accent || Math.round(note.velocity * 127) >= accentVelocity,
        midi: note.midi,
      });
    }
    notesByInstrument.set(instrument, list);
  });

  for (const entry of unmapped.values()) {
    if (entry.instrument === null) continue;
    warnings.push({
      code: "notas-sin-mapear",
      message: `«${entry.trackName}»: ${entry.count} nota(s) ${entry.midi} sin golpe asignado en ${INSTRUMENTS[entry.instrument].name}.`,
    });
  }

  const tracks: ChartTrack[] = [];
  let lastBeat = 0;
  for (const instrument of INSTRUMENT_IDS) {
    const raw = notesByInstrument.get(instrument);
    if (!raw || raw.length === 0) continue;
    const def = INSTRUMENTS[instrument];
    const lanes = def.strokes.filter((stroke) => raw.some((n) => n.stroke === stroke));
    raw.sort((a, b) => a.beat - b.beat || lanes.indexOf(a.stroke) - lanes.indexOf(b.stroke));

    const notes: ChartNote[] = [];
    for (const note of raw) {
      const previous = notes[notes.length - 1];
      if (previous && previous.stroke === note.stroke && Math.abs(previous.beat - note.beat) < BEAT_EPSILON) {
        continue;
      }
      notes.push({ ...note, id: `${instrument}-${notes.length}`, lane: lanes.indexOf(note.stroke) });
    }
    lastBeat = Math.max(lastBeat, notes[notes.length - 1].beat);
    tracks.push({
      instrument,
      name: def.name,
      sourceTrackNames: sourceNames.get(instrument) ?? [],
      lanes,
      notes,
    });
  }

  if (tracks.length === 0) {
    warnings.push({ code: "sin-notas", message: "El MIDI no tiene notas de ningún instrumento reconocido." });
  }

  const bars = Math.max(1, Math.floor(lastBeat / beatsPerBar + BEAT_EPSILON) + 1);
  const durationBeats = bars * beatsPerBar;
  const sectionSource = meta.sections?.length ? meta.sections : markerSections(midi, ppq, beatsPerBar, bars);
  const sections = buildSections(sectionSource, bars, beatsPerBar, warnings);

  return {
    slug,
    title: meta.title,
    artist: meta.artist ?? null,
    description: meta.description ?? null,
    bpm,
    beatsPerBar,
    timeSignature,
    bars,
    durationBeats,
    durationSeconds: round((durationBeats * 60) / bpm, 3),
    sections,
    tracks,
    unmapped: [...unmapped.values()].sort((a, b) => a.trackName.localeCompare(b.trackName) || a.midi - b.midi),
    warnings,
  };
}

function addUnmapped(
  map: Map<string, UnmappedNote>,
  trackName: string,
  instrument: InstrumentId | null,
  midi: number,
) {
  const key = `${trackName}::${midi}`;
  const entry = map.get(key);
  if (entry) entry.count += 1;
  else map.set(key, { trackName, instrument, midi, count: 1 });
}

function markerSections(midi: Midi, ppq: number, beatsPerBar: number, bars: number): SongMetaSection[] {
  const markers = midi.header.meta
    .filter((event) => event.type === "marker" && event.text.trim())
    .map((event) => ({
      name: event.text.trim(),
      startBar: Math.floor(event.ticks / ppq / beatsPerBar + BEAT_EPSILON) + 1,
    }))
    .sort((a, b) => a.startBar - b.startBar);

  return markers.map((marker, i) => ({
    name: marker.name,
    startBar: marker.startBar,
    endBar: (markers[i + 1]?.startBar ?? bars + 1) - 1,
  }));
}

function buildSections(
  source: SongMetaSection[],
  bars: number,
  beatsPerBar: number,
  warnings: ChartWarning[],
): ChartSection[] {
  const sections: ChartSection[] = [];
  for (const section of source) {
    if (section.startBar > bars || section.endBar < section.startBar) {
      warnings.push({
        code: "seccion-invalida",
        message: `La sección «${section.name}» (compases ${section.startBar}–${section.endBar}) está fuera de la canción (${bars} compases).`,
      });
      continue;
    }
    const endBar = Math.min(section.endBar, bars);
    if (endBar !== section.endBar) {
      warnings.push({
        code: "seccion-invalida",
        message: `La sección «${section.name}» termina en el compás ${section.endBar}, pero la canción tiene ${bars}; se recorta.`,
      });
    }
    sections.push({
      name: section.name,
      startBar: section.startBar,
      endBar,
      startBeat: (section.startBar - 1) * beatsPerBar,
      endBeat: endBar * beatsPerBar,
    });
  }

  if (sections.length === 0) {
    sections.push({ name: "Canción completa", startBar: 1, endBar: bars, startBeat: 0, endBeat: bars * beatsPerBar });
  }
  return sections;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
