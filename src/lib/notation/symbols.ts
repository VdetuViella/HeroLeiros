import { strokeLabel } from "../chart/instruments";
import type { InstrumentId, StrokeId } from "../chart/types";

export type Notehead = "normal" | "x" | "triangulo";

/** Dónde va la cabeza respecto a la única línea del pentagrama. */
export type StaffPosition = "linea" | "encima" | "debajo";

export interface StrokeSymbol {
  notehead: Notehead;
  position: StaffPosition;
  /** «+» bajo la nota: golpe apagado o cerrado. */
  muted: boolean;
  /** Cabeza entre paréntesis: golpe suave (nota fantasma). */
  ghost: boolean;
  /** Explicación para la leyenda. */
  description: string;
}

const BASE: Omit<StrokeSymbol, "description"> = { notehead: "normal", position: "linea", muted: false, ghost: false };

export const STROKE_SYMBOLS: Record<StrokeId, StrokeSymbol> = {
  abierto: { ...BASE, description: "Cabeza normal sobre la línea: golpe abierto, dejando sonar el parche." },
  apagado: { ...BASE, muted: true, description: "«+» bajo la nota: golpe apagado, con el parche tapado." },
  aro: { ...BASE, notehead: "x", description: "Cabeza en X: golpe en el aro." },
  slap: { ...BASE, notehead: "triangulo", description: "Cabeza triangular: slap, golpe seco con la mano." },
  agudo: { ...BASE, position: "encima", description: "Cabeza encima de la línea: campana aguda." },
  grave: { ...BASE, position: "debajo", description: "Cabeza debajo de la línea: campana grave." },
};

/** Golpes que en un instrumento concreto se escriben distinto. */
const INSTRUMENT_SYMBOLS: Partial<Record<InstrumentId, Partial<Record<StrokeId, StrokeSymbol>>>> = {
  caixa: {
    apagado: { ...BASE, ghost: true, description: "Cabeza entre paréntesis: golpe suave (nota fantasma)." },
  },
  chocalho: {
    abierto: { ...BASE, description: "Cabeza normal: sacudida hacia delante." },
    apagado: { ...BASE, muted: true, description: "«+» bajo la nota: sacudida hacia atrás." },
  },
};

export const ACCENT_DESCRIPTION = "«>» bajo la nota: golpe acentuado, más fuerte que los demás.";

export function strokeSymbol(instrument: InstrumentId, stroke: StrokeId): StrokeSymbol {
  return INSTRUMENT_SYMBOLS[instrument]?.[stroke] ?? STROKE_SYMBOLS[stroke];
}

const POSITION_KEYS: Record<StaffPosition, string> = {
  linea: "b/4",
  encima: "d/5",
  debajo: "g/4",
};

const NOTEHEAD_CODES: Record<Notehead, string> = {
  normal: "",
  x: "/x",
  triangulo: "/tu",
};

/** Tecla de VexFlow (`nota/octava/cabeza`) en un pentagrama de percusión. */
export function vexKey(symbol: StrokeSymbol): string {
  return POSITION_KEYS[symbol.position] + NOTEHEAD_CODES[symbol.notehead];
}

export const REST_KEY = POSITION_KEYS.linea;

export interface LegendEntry {
  stroke: StrokeId | "acento";
  label: string;
  symbol: StrokeSymbol;
  accent: boolean;
}

/** Leyenda de los golpes de un instrumento, en orden de carril, más el acento. */
export function legendFor(instrument: InstrumentId, strokes: readonly StrokeId[]): LegendEntry[] {
  const entries: LegendEntry[] = strokes.map((stroke) => ({
    stroke,
    label: strokeLabel(instrument, stroke),
    symbol: strokeSymbol(instrument, stroke),
    accent: false,
  }));
  const accentBase = strokes.includes("abierto") ? strokeSymbol(instrument, "abierto") : strokeSymbol(instrument, strokes[0] ?? "abierto");
  entries.push({
    stroke: "acento",
    label: "Acento",
    symbol: { ...accentBase, muted: false, ghost: false, description: ACCENT_DESCRIPTION },
    accent: true,
  });
  return entries;
}
