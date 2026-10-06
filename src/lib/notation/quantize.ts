import type { Chart, ChartNote, ChartTrack, InstrumentId, StrokeId } from "../chart/types";

/** Casillas por negra: 4 = semicorcheas, 3 = tresillo de corcheas. */
export type BeatDivision = 4 | 3;

export const BEAT_DIVISIONS: readonly BeatDivision[] = [4, 3];

/**
 * Coste extra (en pulsos) de escribir un pulso en tresillo. Evita que una
 * corchea tocada un poco tarde se convierta en tresillo.
 */
export const DIVISION_BIAS: Record<BeatDivision, number> = { 4: 0, 3: 0.04 };

/** Coste de que dos notas caigan en la misma casilla (se fusionan). */
const COLLISION_COST = 0.25;

/** Una nota que llega hasta 1/24 de negra antes del pulso pertenece a ese pulso. */
const EARLY_TOLERANCE = 1 / 24;

export type QuantizableNote = Pick<ChartNote, "id" | "beat" | "stroke" | "accent" | "lane">;

export interface QuantizedNote {
  /** `id` de la nota original del chart. */
  id: string;
  /** Pulso cuantizado (negras desde el inicio). */
  beat: number;
  /** Pulso original menos pulso cuantizado. */
  offset: number;
  stroke: StrokeId;
  accent: boolean;
  lane: number;
}

export interface QuantizedBeat {
  /** Pulso (entero) en que empieza. */
  beat: number;
  division: BeatDivision;
  /** Una casilla por subdivisión; `null` es silencio. */
  slots: (QuantizedNote | null)[];
}

export interface QuantizedBar {
  /** Compás, empezando en 1. */
  bar: number;
  startBeat: number;
  beats: QuantizedBeat[];
}

export interface QuantizeOptions {
  beatsPerBar: number;
  bars: number;
  divisions?: readonly BeatDivision[];
}

export interface QuantizedScore {
  bars: QuantizedBar[];
  /** Notas descartadas porque otra cayó en la misma casilla. */
  merged: number;
  /** Mayor desfase absoluto entre una nota y su casilla, en pulsos. */
  maxOffset: number;
}

export interface QuantizedTrack extends QuantizedScore {
  instrument: InstrumentId;
  beatsPerBar: number;
  timeSignature: [number, number];
}

export function quantizeTrack(chart: Chart, track: ChartTrack): QuantizedTrack {
  const score = quantizeNotes(track.notes, { beatsPerBar: chart.beatsPerBar, bars: chart.bars });
  return { ...score, instrument: track.instrument, beatsPerBar: chart.beatsPerBar, timeSignature: chart.timeSignature };
}

/**
 * Cuantiza notas a una rejilla por pulso: cada negra se escribe en
 * semicorcheas o en tresillo, según qué rejilla se ajuste mejor a sus notas.
 */
export function quantizeNotes(notes: readonly QuantizableNote[], options: QuantizeOptions): QuantizedScore {
  const divisions = options.divisions?.length ? options.divisions : BEAT_DIVISIONS;
  const totalBeats = Math.max(1, Math.round(options.bars * options.beatsPerBar));

  const byBeat: QuantizableNote[][] = Array.from({ length: totalBeats }, () => []);
  for (const note of notes) {
    const index = clamp(Math.floor(note.beat + EARLY_TOLERANCE), 0, totalBeats - 1);
    byBeat[index].push(note);
  }

  const beats: QuantizedBeat[] = byBeat.map((beatNotes, index) => {
    const division = chooseDivision(beatNotes, index, divisions);
    return { beat: index, division, slots: Array.from({ length: division }, () => null) };
  });

  let merged = 0;
  let maxOffset = 0;
  byBeat.forEach((beatNotes, index) => {
    const { division } = beats[index];
    for (const note of beatNotes) {
      let target = index;
      let slot = Math.max(0, Math.round((note.beat - index) * division));
      if (slot >= division) {
        if (index + 1 < totalBeats) {
          target = index + 1;
          slot = 0;
        } else {
          slot = division - 1;
        }
      }
      const beat = beats[target];
      const quantizedBeat = beat.beat + slot / beat.division;
      const placed: QuantizedNote = {
        id: note.id,
        beat: quantizedBeat,
        offset: note.beat - quantizedBeat,
        stroke: note.stroke,
        accent: note.accent,
        lane: note.lane,
      };
      maxOffset = Math.max(maxOffset, Math.abs(placed.offset));
      const existing = beat.slots[slot];
      if (existing) {
        merged += 1;
        const keep = Math.abs(existing.offset) <= Math.abs(placed.offset) ? existing : placed;
        beat.slots[slot] = { ...keep, accent: existing.accent || placed.accent };
      } else {
        beat.slots[slot] = placed;
      }
    }
  });

  const bars: QuantizedBar[] = [];
  for (let bar = 0; bar < options.bars; bar++) {
    const startBeat = bar * options.beatsPerBar;
    bars.push({ bar: bar + 1, startBeat, beats: beats.slice(startBeat, startBeat + options.beatsPerBar) });
  }
  return { bars, merged, maxOffset };
}

function chooseDivision(
  notes: readonly QuantizableNote[],
  beatIndex: number,
  divisions: readonly BeatDivision[],
): BeatDivision {
  let best = divisions[0];
  let bestCost = Infinity;
  for (const division of divisions) {
    const cost = divisionCost(notes, beatIndex, division);
    if (cost < bestCost - 1e-9) {
      best = division;
      bestCost = cost;
    }
  }
  return best;
}

function divisionCost(notes: readonly QuantizableNote[], beatIndex: number, division: BeatDivision): number {
  if (notes.length === 0) return 0;
  let cost = DIVISION_BIAS[division];
  const used = new Set<number>();
  for (const note of notes) {
    const position = (note.beat - beatIndex) * division;
    const slot = Math.max(0, Math.round(position));
    cost += Math.abs(position - slot) / division;
    if (used.has(slot)) cost += COLLISION_COST;
    used.add(slot);
  }
  return cost;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
