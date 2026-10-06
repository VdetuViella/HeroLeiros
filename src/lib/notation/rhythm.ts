import type { QuantizedBar, QuantizedBeat, QuantizedNote } from "./quantize";

/** Duraciones de VexFlow que usamos: semicorchea, corchea y negra. */
export type BaseDuration = "16" | "8" | "q";

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

export interface BeatRhythm {
  /** El pulso entero va dentro de un tresillo (3:2). */
  tuplet: boolean;
  tokens: RhythmToken[];
}

const SIXTEENTH_NOTES: Record<number, Pick<RhythmToken, "duration" | "dots">> = {
  1: { duration: "16", dots: 0 },
  2: { duration: "8", dots: 0 },
  3: { duration: "8", dots: 1 },
  4: { duration: "q", dots: 0 },
};

const TRIPLET_NOTES: Record<number, Pick<RhythmToken, "duration" | "dots">> = {
  1: { duration: "8", dots: 0 },
  2: { duration: "q", dots: 0 },
};

/**
 * Escribe un pulso como figuras: cada nota dura hasta el siguiente golpe (o el
 * final del pulso) y los huecos iniciales son silencios. En percusión la
 * duración escrita solo indica dónde cae el siguiente golpe.
 */
export function beatRhythm(beat: QuantizedBeat): BeatRhythm {
  const onsets = beat.slots.flatMap((note, slot) => (note ? [slot] : []));
  if (onsets.length === 0) {
    return { tuplet: false, tokens: [{ slot: 0, length: beat.division, duration: "q", dots: 0, note: null }] };
  }
  if (onsets.length === 1 && onsets[0] === 0) {
    return { tuplet: false, tokens: [{ slot: 0, length: beat.division, duration: "q", dots: 0, note: beat.slots[0] }] };
  }

  const tokens: RhythmToken[] = [];
  const restSpelling = beat.division === 4 ? sixteenthRests : tripletRests;
  const noteSpelling = beat.division === 4 ? SIXTEENTH_NOTES : TRIPLET_NOTES;

  tokens.push(...restSpelling(onsets[0]));
  onsets.forEach((slot, i) => {
    const end = onsets[i + 1] ?? beat.division;
    const spelling = noteSpelling[end - slot];
    tokens.push({ slot, length: end - slot, ...spelling, note: beat.slots[slot] });
  });
  return { tuplet: beat.division === 3, tokens };
}

/** Silencios antes del primer golpe en un pulso de semicorcheas. */
function sixteenthRests(length: number): RhythmToken[] {
  switch (length) {
    case 0:
      return [];
    case 1:
      return [rest(0, 1, "16")];
    case 2:
      return [rest(0, 2, "8")];
    case 3:
      return [rest(0, 2, "8"), rest(2, 1, "16")];
    default:
      throw new Error(`Silencio de ${length} semicorcheas dentro de un pulso`);
  }
}

function tripletRests(length: number): RhythmToken[] {
  switch (length) {
    case 0:
      return [];
    case 1:
      return [rest(0, 1, "8")];
    case 2:
      return [rest(0, 2, "q")];
    default:
      throw new Error(`Silencio de ${length} corcheas de tresillo dentro de un pulso`);
  }
}

function rest(slot: number, length: number, duration: BaseDuration): RhythmToken {
  return { slot, length, duration, dots: 0, note: null };
}

export function isEmptyBar(bar: QuantizedBar): boolean {
  return bar.beats.every((beat) => beat.slots.every((slot) => slot === null));
}

/** Figuras del compás; sirve para estimar su ancho. */
export function barTokenCount(bar: QuantizedBar): number {
  if (isEmptyBar(bar)) return 1;
  return bar.beats.reduce((sum, beat) => sum + beatRhythm(beat).tokens.length, 0);
}
