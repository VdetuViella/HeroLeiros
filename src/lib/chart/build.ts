import { INSTRUMENTS } from "./instruments";
import type { Chart, ChartNote, ChartSection, Hand, InstrumentId, StrokeId } from "./types";

/**
 * Charts escritos como patrones de texto (ejercicios de la Escuela), sin MIDI.
 * Los caracteres son los mismos que usa `scripts/generate-example-songs.ts`:
 *
 *   x abierto · o apagado (en la caixa, «suave») · r aro · s slap · X abierto acentuado
 *   h agudo · l grave · . silencio
 *
 * Cada cadena es un compás; su longitud reparte el compás en pasos iguales
 * (16 = semicorcheas en 4/4, 12 = tresillos de corchea, 8 = corcheas…).
 */
export const PATTERN_NOTES: Readonly<Record<string, { stroke: StrokeId; accent: boolean; velocity: number; midi: number }>> = {
  x: { stroke: "abierto", accent: false, velocity: 92 / 127, midi: 36 },
  o: { stroke: "apagado", accent: false, velocity: 70 / 127, midi: 37 },
  r: { stroke: "aro", accent: false, velocity: 88 / 127, midi: 38 },
  s: { stroke: "slap", accent: false, velocity: 100 / 127, midi: 39 },
  X: { stroke: "abierto", accent: true, velocity: 122 / 127, midi: 40 },
  h: { stroke: "agudo", accent: false, velocity: 92 / 127, midi: 60 },
  l: { stroke: "grave", accent: false, velocity: 92 / 127, midi: 61 },
};

export interface PatternTrack {
  instrument: InstrumentId;
  /** Un patrón por compás; `null` = compás en silencio. */
  bars: (string | null)[];
  /** Digitación alineada con cada patrón: `D`, `I` o `.` (sin indicar). */
  hands?: (string | null)[];
}

export interface PatternChartSpec {
  slug: string;
  title: string;
  description?: string | null;
  bpm: number;
  timeSignature?: [number, number];
  /** Inicio de cada sección (compás, empezando en 1). Sin secciones, una sola con `title`. */
  sections?: { name: string; startBar: number }[];
  /** La primera pista es la que se elige por defecto para tocar. */
  tracks: PatternTrack[];
}

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Comprueba un patrón y su digitación. Devuelve el error en español o `null`. */
export function patternError(pattern: string, beatsPerBar: number, hands?: string | null): string | null {
  if (pattern.length === 0 || pattern.length % beatsPerBar !== 0) {
    return `«${pattern}» tiene ${pattern.length} pasos: tienen que repartirse por igual entre ${beatsPerBar} pulsos.`;
  }
  for (const char of pattern) {
    if (char !== "." && !PATTERN_NOTES[char]) return `Carácter desconocido «${char}» en «${pattern}».`;
  }
  if (hands !== undefined && hands !== null) {
    if (hands.length !== pattern.length) return `La digitación «${hands}» no tiene la misma longitud que «${pattern}».`;
    for (let i = 0; i < hands.length; i++) {
      const hand = hands[i];
      if (hand !== "." && hand !== "D" && hand !== "I") return `Mano desconocida «${hand}» en «${hands}».`;
      if (hand !== "." && pattern[i] === ".") return `La digitación «${hands}» pone mano en un silencio de «${pattern}».`;
    }
  }
  return null;
}

/** Convierte patrones de texto en un `Chart` con la misma forma que el que sale del MIDI. */
export function buildPatternChart(spec: PatternChartSpec): Chart {
  const timeSignature = spec.timeSignature ?? [4, 4];
  const beatsPerBar = (timeSignature[0] * 4) / timeSignature[1];
  if (!Number.isInteger(beatsPerBar)) throw new Error(`Compás ${timeSignature.join("/")} no soportado en patrones.`);
  const bars = Math.max(1, ...spec.tracks.map((t) => t.bars.length));

  const tracks = spec.tracks.map((track) => {
    const def = INSTRUMENTS[track.instrument];
    const raw: Omit<ChartNote, "id" | "lane">[] = [];
    track.bars.forEach((pattern, barIndex) => {
      if (!pattern) return;
      const hands = track.hands?.[barIndex] ?? null;
      const error = patternError(pattern, beatsPerBar, hands);
      if (error) throw new Error(`${spec.slug} · ${def.name}, compás ${barIndex + 1}: ${error}`);
      const stepBeats = beatsPerBar / pattern.length;
      [...pattern].forEach((char, step) => {
        const mapped = PATTERN_NOTES[char];
        if (!mapped) return;
        if (!def.strokes.includes(mapped.stroke)) {
          throw new Error(`${spec.slug} · ${def.name}: el golpe «${mapped.stroke}» no existe en este instrumento.`);
        }
        const beat = round(barIndex * beatsPerBar + step * stepBeats, 6);
        const hand = hands?.[step];
        raw.push({
          beat,
          time: round((beat * 60) / spec.bpm, 6),
          bar: barIndex + 1,
          stroke: mapped.stroke,
          velocity: round(mapped.velocity, 4),
          accent: mapped.accent,
          midi: mapped.midi,
          ...(hand === "D" || hand === "I" ? { hand: hand as Hand } : {}),
        });
      });
    });
    const lanes = def.strokes.filter((stroke) => raw.some((n) => n.stroke === stroke));
    const notes: ChartNote[] = raw.map((note, i) => ({ ...note, id: `${track.instrument}-${i}`, lane: lanes.indexOf(note.stroke) }));
    return { instrument: track.instrument, name: def.name, sourceTrackNames: [def.trackName], lanes, notes };
  });

  const durationBeats = bars * beatsPerBar;
  return {
    slug: spec.slug,
    title: spec.title,
    artist: null,
    description: spec.description ?? null,
    bpm: spec.bpm,
    beatsPerBar,
    timeSignature: [timeSignature[0], timeSignature[1]],
    bars,
    durationBeats,
    durationSeconds: round((durationBeats * 60) / spec.bpm, 3),
    sections: buildSections(spec, bars, beatsPerBar),
    tracks: tracks.filter((t) => t.notes.length > 0),
    unmapped: [],
    warnings: [],
  };
}

function buildSections(spec: PatternChartSpec, bars: number, beatsPerBar: number): ChartSection[] {
  const starts = (spec.sections?.length ? spec.sections : [{ name: spec.title, startBar: 1 }])
    .filter((s) => s.startBar >= 1 && s.startBar <= bars)
    .sort((a, b) => a.startBar - b.startBar);
  if (starts.length === 0 || starts[0].startBar !== 1) starts.unshift({ name: spec.title, startBar: 1 });
  return starts.map((section, i) => {
    const endBar = (starts[i + 1]?.startBar ?? bars + 1) - 1;
    return {
      name: section.name,
      startBar: section.startBar,
      endBar,
      startBeat: (section.startBar - 1) * beatsPerBar,
      endBeat: endBar * beatsPerBar,
    };
  });
}
