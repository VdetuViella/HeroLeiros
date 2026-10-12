import type { Chart, ChartNote, ChartTrack, InstrumentId, StrokeId } from "../chart/types";

/**
 * Casillas por pulso. En compás simple (pulso = negra): 4 = semicorcheas,
 * 3 = tresillo de corcheas, 6 = tresillo de semicorcheas (seisillo), 8 = fusas.
 * En compás compuesto (pulso = negra con puntillo): 3 = corcheas, 6 = semicorcheas.
 */
export type BeatDivision = 3 | 4 | 6 | 8;

/** Simple: el pulso es la negra (2/4, 3/4, 4/4). Compuesto: la negra con puntillo (6/8, 12/8). */
export type Meter = "simple" | "compound";

export interface MeterGrid {
  /** Duración del pulso en negras. */
  span: number;
  /** Rejillas candidatas, de la preferida a la menos habitual. */
  divisions: readonly BeatDivision[];
  /**
   * Coste extra (en negras) de cada rejilla. Evita, por ejemplo, que una corchea
   * tocada un poco tarde se convierta en tresillo o que unas semicorcheas
   * imprecisas acaben escritas como fusas.
   */
  bias: Partial<Record<BeatDivision, number>>;
}

export const METER_GRIDS: Record<Meter, MeterGrid> = {
  simple: { span: 1, divisions: [4, 3, 6, 8], bias: { 4: 0, 3: 0.04, 6: 0.12, 8: 0.1 } },
  compound: { span: 1.5, divisions: [3, 6], bias: { 3: 0, 6: 0.04 } },
};

/** Rejillas por defecto del compás simple. */
export const BEAT_DIVISIONS: readonly BeatDivision[] = METER_GRIDS.simple.divisions;

/** Coste de que dos notas caigan en la misma casilla (se fusionan). */
const COLLISION_COST = 0.25;

/** Una nota que llega hasta 1/24 de negra antes del pulso pertenece a ese pulso. */
const EARLY_TOLERANCE = 1 / 24;

export type QuantizableNote = Pick<ChartNote, "id" | "beat" | "stroke" | "accent" | "lane" | "hand">;

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
  /** Digitación, si la nota la trae. */
  hand?: ChartNote["hand"];
}

export interface QuantizedBeat {
  /** Negra (desde el inicio) en que empieza el pulso. */
  beat: number;
  /** Duración del pulso en negras: 1 en compás simple, 1,5 en compuesto. */
  span: number;
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
  /** Por defecto, simple. */
  meter?: Meter;
  /** Sustituye las rejillas candidatas del compás. */
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

/**
 * 6/8 y 12/8 se agrupan por negras con puntillo. Los compuestos que no caben en
 * un número entero de negras (3/8, 9/8) se tratan como simples, igual que el parser.
 */
export function meterFor(timeSignature: readonly [number, number], beatsPerBar: number): Meter {
  const [numerator, denominator] = timeSignature;
  const compound = denominator === 8 && numerator >= 6 && numerator % 3 === 0 && beatsPerBar * 2 === numerator;
  return compound ? "compound" : "simple";
}

export function quantizeTrack(chart: Chart, track: ChartTrack): QuantizedTrack {
  const meter = meterFor(chart.timeSignature, chart.beatsPerBar);
  const score = quantizeNotes(track.notes, { beatsPerBar: chart.beatsPerBar, bars: chart.bars, meter });
  return { ...score, instrument: track.instrument, beatsPerBar: chart.beatsPerBar, timeSignature: chart.timeSignature };
}

/**
 * Cuantiza notas a una rejilla por pulso: cada pulso se escribe con la
 * subdivisión (semicorcheas, tresillo, seisillo, fusas…) que mejor se ajuste a sus notas.
 */
export function quantizeNotes(notes: readonly QuantizableNote[], options: QuantizeOptions): QuantizedScore {
  const grid = METER_GRIDS[options.meter ?? "simple"];
  const divisions = options.divisions?.length ? options.divisions : grid.divisions;
  const { span } = grid;
  const pulsesPerBar = Math.max(1, Math.round(options.beatsPerBar / span));
  const totalPulses = Math.max(1, options.bars * pulsesPerBar);

  const byPulse: QuantizableNote[][] = Array.from({ length: totalPulses }, () => []);
  for (const note of notes) {
    const index = clamp(Math.floor((note.beat + EARLY_TOLERANCE) / span), 0, totalPulses - 1);
    byPulse[index].push(note);
  }

  const beats: QuantizedBeat[] = byPulse.map((pulseNotes, index) => {
    const start = index * span;
    const division = chooseDivision(pulseNotes, start, span, divisions, grid.bias);
    return { beat: start, span, division, slots: Array.from({ length: division }, () => null) };
  });

  let merged = 0;
  let maxOffset = 0;
  byPulse.forEach((pulseNotes, index) => {
    const { division, beat: start } = beats[index];
    for (const note of pulseNotes) {
      let target = index;
      let slot = Math.max(0, Math.round(((note.beat - start) / span) * division));
      if (slot >= division) {
        if (index + 1 < totalPulses) {
          target = index + 1;
          slot = 0;
        } else {
          slot = division - 1;
        }
      }
      const beat = beats[target];
      const quantizedBeat = beat.beat + (slot / beat.division) * beat.span;
      const placed: QuantizedNote = {
        id: note.id,
        beat: quantizedBeat,
        offset: note.beat - quantizedBeat,
        stroke: note.stroke,
        accent: note.accent,
        lane: note.lane,
        ...(note.hand ? { hand: note.hand } : {}),
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
    const first = bar * pulsesPerBar;
    bars.push({ bar: bar + 1, startBeat: bar * options.beatsPerBar, beats: beats.slice(first, first + pulsesPerBar) });
  }
  return { bars, merged, maxOffset };
}

function chooseDivision(
  notes: readonly QuantizableNote[],
  start: number,
  span: number,
  divisions: readonly BeatDivision[],
  bias: MeterGrid["bias"],
): BeatDivision {
  let best = divisions[0];
  let bestCost = Infinity;
  for (const division of divisions) {
    const cost = divisionCost(notes, start, span, division, bias[division] ?? 0);
    if (cost < bestCost - 1e-9) {
      best = division;
      bestCost = cost;
    }
  }
  return best;
}

/** Desfase total (en negras) de las notas respecto a la rejilla, más el sesgo y las colisiones. */
function divisionCost(
  notes: readonly QuantizableNote[],
  start: number,
  span: number,
  division: BeatDivision,
  bias: number,
): number {
  if (notes.length === 0) return 0;
  let cost = bias;
  const used = new Set<number>();
  for (const note of notes) {
    const position = ((note.beat - start) / span) * division;
    const slot = Math.max(0, Math.round(position));
    cost += (Math.abs(position - slot) / division) * span;
    if (used.has(slot)) cost += COLLISION_COST;
    used.add(slot);
  }
  return cost;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
