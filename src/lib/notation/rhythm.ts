import type { QuantizedBar, QuantizedBeat, QuantizedNote } from "./quantize";

/** Duraciones de VexFlow que usamos: fusa, semicorchea, corchea, negra y blanca. */
export type BaseDuration = "32" | "16" | "8" | "q" | "h";

export interface RhythmToken {
  /** Casilla donde empieza, dentro del pulso. */
  slot: number;
  /** Casillas que ocupa. */
  length: number;
  duration: BaseDuration;
  dots: 0 | 1;
  /** `null` = silencio. */
  note: QuantizedNote | null;
}

/** Grupo irregular: `numNotes` figuras en el espacio de `notesOccupied` (3:2, 6:4). */
export interface TupletRatio {
  numNotes: number;
  notesOccupied: number;
}

export interface BeatRhythm {
  /** El pulso entero va dentro de un grupo irregular, o `null` si no hace falta. */
  tuplet: TupletRatio | null;
  tokens: RhythmToken[];
}

type Figure = { value: number; duration: BaseDuration; dots: 0 | 1 };

/** Figuras disponibles, medidas en fusas, de mayor a menor. */
const FIGURES: readonly Figure[] = [
  { value: 16, duration: "h", dots: 0 },
  { value: 12, duration: "q", dots: 1 },
  { value: 8, duration: "q", dots: 0 },
  { value: 6, duration: "8", dots: 1 },
  { value: 4, duration: "8", dots: 0 },
  { value: 3, duration: "16", dots: 1 },
  { value: 2, duration: "16", dots: 0 },
  { value: 1, duration: "32", dots: 0 },
];

/** Los silencios se escriben sin puntillo para que se lea dónde cae cada parte. */
const PLAIN_FIGURES = FIGURES.filter((figure) => figure.dots === 0);

/** Fusas por negra. */
const UNITS_PER_QUARTER = 8;

/**
 * Escribe un pulso como figuras: cada nota dura hasta el siguiente golpe (o el
 * final del pulso) y los huecos iniciales son silencios. En percusión la
 * duración escrita solo indica dónde cae el siguiente golpe, así que si un hueco
 * no cabe en una sola figura se completa con silencios.
 */
export function beatRhythm(beat: QuantizedBeat): BeatRhythm {
  const { span } = beat;
  const onsets = beat.slots.flatMap((note, slot) => (note ? [slot] : []));
  if (onsets.length === 0 || (onsets.length === 1 && onsets[0] === 0)) {
    const whole = figureFor(span * UNITS_PER_QUARTER);
    if (!whole) throw new Error(`No hay figura para un pulso de ${span} negras`);
    return { tuplet: null, tokens: [{ slot: 0, length: beat.division, ...whole, note: beat.slots[0] ?? null }] };
  }

  const { unit, tuplet } = slotUnit(span, beat.division);
  const tokens: RhythmToken[] = [];
  const push = (startUnits: number, figure: Figure, note: QuantizedNote | null) => {
    tokens.push({ slot: startUnits / unit, length: figure.value / unit, duration: figure.duration, dots: figure.dots, note });
  };

  spellRests(0, onsets[0] * unit, push);
  onsets.forEach((slot, i) => {
    const end = onsets[i + 1] ?? beat.division;
    const start = slot * unit;
    const value = (end - slot) * unit;
    const figure = figureFor(value) ?? largestFigure(value, FIGURES);
    push(start, figure, beat.slots[slot]);
    spellRests(start + figure.value, value - figure.value, push);
  });
  return { tuplet, tokens };
}

/**
 * Valor escrito (en fusas) de una casilla. Si la rejilla no cae en figuras
 * normales (tresillo, seisillo), se escribe con la figura inmediatamente
 * mayor dentro de un grupo irregular.
 */
function slotUnit(span: number, division: number): { unit: number; tuplet: TupletRatio | null } {
  const exact = (span * UNITS_PER_QUARTER) / division;
  if (Number.isInteger(exact)) return { unit: exact, tuplet: null };
  const unit = 2 ** Math.ceil(Math.log2(exact));
  return { unit, tuplet: { numNotes: division, notesOccupied: (span * UNITS_PER_QUARTER) / unit } };
}

function figureFor(value: number): Figure | undefined {
  return FIGURES.find((figure) => figure.value === value);
}

function largestFigure(value: number, figures: readonly Figure[]): Figure {
  const figure = figures.find((candidate) => candidate.value <= value);
  if (!figure) throw new Error(`No hay figura para ${value} fusas`);
  return figure;
}

function spellRests(
  start: number,
  value: number,
  push: (startUnits: number, figure: Figure, note: null) => void,
): void {
  let position = start;
  let left = value;
  while (left > 0) {
    const figure = largestFigure(left, PLAIN_FIGURES);
    push(position, figure, null);
    position += figure.value;
    left -= figure.value;
  }
}

export function isEmptyBar(bar: QuantizedBar): boolean {
  return bar.beats.every((beat) => beat.slots.every((slot) => slot === null));
}

/** Figuras del compás; sirve para estimar su ancho. */
export function barTokenCount(bar: QuantizedBar): number {
  if (isEmptyBar(bar)) return 1;
  return bar.beats.reduce((sum, beat) => sum + beatRhythm(beat).tokens.length, 0);
}
