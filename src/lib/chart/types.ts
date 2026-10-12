export const INSTRUMENT_IDS = [
  "surdo1",
  "surdo2",
  "surdo3",
  "caixa",
  "repinique",
  "tamborim",
  "agogo",
  "chocalho",
] as const;

export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

export const STROKE_IDS = [
  "abierto",
  "apagado",
  "aro",
  "slap",
  "agudo",
  "grave",
] as const;

export type StrokeId = (typeof STROKE_IDS)[number];

/** Mano con la que se toca un golpe: derecha o izquierda (digitación). */
export type Hand = "D" | "I";

export interface ChartNote {
  /** Estable dentro del chart: `<instrumento>-<índice>`. */
  id: string;
  /** Pulso (negra) desde el inicio de la canción, empezando en 0. */
  beat: number;
  /** Segundos desde el inicio al BPM de referencia (velocidad 100 %). */
  time: number;
  /** Compás, empezando en 1. */
  bar: number;
  stroke: StrokeId;
  /** Índice del carril dentro de `ChartTrack.lanes`. */
  lane: number;
  /** Velocidad MIDI normalizada a 0..1. */
  velocity: number;
  accent: boolean;
  /** Nota MIDI original, útil para depurar el mapeo. */
  midi: number;
  /** Digitación, si el chart la trae (ejercicios de la Escuela). */
  hand?: Hand;
}

export interface ChartTrack {
  instrument: InstrumentId;
  /** Nombre visible del instrumento. */
  name: string;
  /** Nombre de la pista tal como venía en el MIDI. */
  sourceTrackNames: string[];
  /** Golpes del instrumento, en orden de carril (izquierda → derecha). */
  lanes: StrokeId[];
  notes: ChartNote[];
}

export interface ChartSection {
  name: string;
  /** Compás inicial, empezando en 1 (incluido). */
  startBar: number;
  /** Compás final (incluido). */
  endBar: number;
  startBeat: number;
  endBeat: number;
}

export interface UnmappedNote {
  trackName: string;
  instrument: InstrumentId | null;
  midi: number;
  count: number;
}

export type ChartWarningCode =
  | "pista-desconocida"
  | "pista-duplicada"
  | "notas-sin-mapear"
  | "cambio-de-tempo"
  | "compas-no-soportado"
  | "seccion-invalida"
  | "sin-notas";

export interface ChartWarning {
  code: ChartWarningCode;
  message: string;
}

export interface Chart {
  slug: string;
  title: string;
  artist: string | null;
  description: string | null;
  /** BPM de referencia (negras por minuto) a velocidad 100 %. */
  bpm: number;
  /** Pulsos (negras) por compás. */
  beatsPerBar: number;
  timeSignature: [number, number];
  bars: number;
  durationBeats: number;
  durationSeconds: number;
  sections: ChartSection[];
  tracks: ChartTrack[];
  unmapped: UnmappedNote[];
  warnings: ChartWarning[];
}
