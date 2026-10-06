import type { InstrumentId, StrokeId } from "./types";
import { INSTRUMENT_IDS } from "./types";

export interface InstrumentDef {
  id: InstrumentId;
  name: string;
  /** Nombre exacto recomendado para la pista del DAW. */
  trackName: string;
  description: string;
  /** Golpes que se tocan en este instrumento, en orden de carril. */
  strokes: StrokeId[];
  /** Etiquetas propias para algunos golpes (p. ej. chocalho «adelante»). */
  strokeLabels?: Partial<Record<StrokeId, string>>;
  /** Nombres alternativos aceptados para la pista (se normalizan). */
  aliases: string[];
}

export interface StrokeDef {
  id: StrokeId;
  label: string;
  /** Color del carril y de las notas en el carril de juego. */
  color: string;
}

export const STROKES: Record<StrokeId, StrokeDef> = {
  abierto: { id: "abierto", label: "Abierto", color: "#f59e0b" },
  apagado: { id: "apagado", label: "Apagado", color: "#38bdf8" },
  aro: { id: "aro", label: "Aro", color: "#e879f9" },
  slap: { id: "slap", label: "Slap", color: "#a3e635" },
  agudo: { id: "agudo", label: "Agudo", color: "#facc15" },
  grave: { id: "grave", label: "Grave", color: "#fb7185" },
};

export const INSTRUMENTS: Record<InstrumentId, InstrumentDef> = {
  surdo1: {
    id: "surdo1",
    name: "Surdo 1",
    trackName: "Surdo 1",
    description: "Surdo de primeira: el más grave, marca el tiempo fuerte.",
    strokes: ["abierto", "apagado"],
    aliases: ["surdo de primeira", "primeira", "surdo primeira", "surdo"],
  },
  surdo2: {
    id: "surdo2",
    name: "Surdo 2",
    trackName: "Surdo 2",
    description: "Surdo de segunda: responde al primero en el otro tiempo.",
    strokes: ["abierto", "apagado"],
    aliases: ["surdo de segunda", "segunda", "surdo segunda"],
  },
  surdo3: {
    id: "surdo3",
    name: "Surdo 3",
    trackName: "Surdo 3",
    description: "Surdo de terceira o de corte: rellena con síncopas.",
    strokes: ["abierto", "apagado"],
    aliases: [
      "surdo de terceira",
      "terceira",
      "surdo terceira",
      "surdo de corte",
      "corte",
    ],
  },
  caixa: {
    id: "caixa",
    name: "Caixa",
    trackName: "Caixa",
    description: "La caja: mantiene el colchón de semicorcheas.",
    strokes: ["abierto", "apagado", "aro"],
    strokeLabels: { apagado: "Suave" },
    aliases: ["caja", "caixa de guerra", "tarol", "snare"],
  },
  repinique: {
    id: "repinique",
    name: "Repinique",
    trackName: "Repinique",
    description: "Lleva las llamadas y los cortes del grupo.",
    strokes: ["abierto", "apagado", "aro", "slap"],
    aliases: ["repique", "repi", "repenique"],
  },
  tamborim: {
    id: "tamborim",
    name: "Tamborim",
    trackName: "Tamborim",
    description: "Pequeño y agudo: dibuja el teleco-teco.",
    strokes: ["abierto", "apagado"],
    aliases: ["tamborin", "tamboril"],
  },
  agogo: {
    id: "agogo",
    name: "Agogô",
    trackName: "Agogo",
    description: "Campana doble: campana aguda y campana grave.",
    strokes: ["agudo", "grave"],
    aliases: ["agogo bell", "campana"],
  },
  chocalho: {
    id: "chocalho",
    name: "Chocalho",
    trackName: "Chocalho",
    description: "Sacude el ritmo hacia delante y hacia atrás.",
    strokes: ["abierto", "apagado"],
    strokeLabels: { abierto: "Adelante", apagado: "Atrás" },
    aliases: ["ganza", "shaker", "platinela", "rocar"],
  },
};

export const INSTRUMENT_LIST: InstrumentDef[] = INSTRUMENT_IDS.map(
  (id) => INSTRUMENTS[id],
);

export function strokeLabel(instrument: InstrumentId, stroke: StrokeId): string {
  return INSTRUMENTS[instrument].strokeLabels?.[stroke] ?? STROKES[stroke].label;
}

export function isInstrumentId(value: string): value is InstrumentId {
  return (INSTRUMENT_IDS as readonly string[]).includes(value);
}
