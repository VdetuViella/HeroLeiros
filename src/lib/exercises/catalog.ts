import type { InstrumentId } from "../chart/types";

/**
 * Ejercicios de la Escuela: técnica estándar de caja (rudimentos de la PAS,
 * calentamientos clásicos) y de surdo (marcación de escola de samba), escritos
 * como patrones de texto. Ver `docs/escuela.md` para las fuentes.
 *
 * Patrones: x abierto · o apagado (caixa: «suave») · X acento · r aro · . silencio.
 * Un patrón es un compás de 4/4: 16 pasos = semicorcheas, 12 = tresillos de
 * corchea, 8 = corcheas. Digitación: D derecha, I izquierda (para zurdos, al revés).
 */

export type ExerciseFamily = "caixa" | "surdo";

export interface ExerciseSource {
  label: string;
  url?: string;
}

export interface Accompaniment {
  instrument: InstrumentId;
  bars: string[];
}

export interface Exercise {
  slug: string;
  family: ExerciseFamily;
  instrument: InstrumentId;
  /** 1 = el primero que se aprende. */
  level: number;
  title: string;
  /** Una línea: qué se trabaja. */
  focus: string;
  description: string;
  tips: string[];
  source: ExerciseSource;
  /** Escalones de tempo (BPM, negra), de menos a más. */
  tempos: number[];
  /** Compases del ejercicio; se repiten `repeat` veces. */
  bars: string[];
  hands?: string[];
  repeat: number;
  /** Otros instrumentos que suenan de fondo (se repiten igual). */
  accompaniment?: Accompaniment[];
}

export interface RoutinePart {
  exercise: string;
  /** Veces que se repiten los compases del ejercicio. */
  repeat: number;
}

/** Calentamiento: varios ejercicios seguidos, cada uno como una sección. */
export interface Routine {
  slug: string;
  family: ExerciseFamily;
  instrument: InstrumentId;
  title: string;
  description: string;
  tempos: number[];
  parts: RoutinePart[];
}

export interface LevelInfo {
  family: ExerciseFamily;
  level: number;
  title: string;
  description: string;
}

const PAS = { label: "PAS International Drum Rudiments", url: "https://www.pas.org/resources/rudiments" };
const PAS_PARADIDDLE = { label: "PAS: Paradiddles, the whole story", url: "https://pas.org/pas-blog/paradiddles-the-whole-story-in-a-nutshell/" };
const VIC_FIRTH_ACCENT_TAP = { label: "Vic Firth: Exercise #4 «Accent Tap»", url: "https://ae.vicfirth.com/?p=2473" };
const YAMAHA_WARMUP = { label: "Yamaha: Snare drum warm-up («8 on a hand»)", url: "https://hub.yamaha.com/drums/d-how-to/snare-drum-warm-up-part-1" };
const STICK_CONTROL = { label: "G. L. Stone, Stick Control (estudios de acentos)", url: "https://www.nexuspercussion.com/?p=7040" };
const SURDO_WIKI = { label: "Surdo: primeira, segunda y terceira", url: "https://en.wikipedia.org/wiki/Surdo" };
const SAMBA_NY_TERCEIRA = { label: "Samba New York: 3rd surdo basics (contratiempo)", url: "https://sambanewyorkonlineacademy.teachable.com/p/3rd-surdo-basics" };
const ROR_SAMBA_REGGAE = { label: "Rhythms of Resistance: Samba Reggae", url: "https://berlin.rhythms-of-resistance.org/old/music/sheets/pdf/sambareggae.pdf" };
const HEROLEIROS = { label: "Samba de ensayo (repertorio de HeroLeiros)" };

const SIXTEENTHS = "xxxxxxxxxxxxxxxx";
const ALTERNATE_16 = "DIDIDIDIDIDIDIDI";
const MARCACAO_PRIMEIRA = "o...x...o...x...";
const MARCACAO_SEGUNDA = "x...o...x...o...";
const CORTE_TERCEIRA = "..x.o.x...x.o.x.";
const BREAK_LOW = "x...x...x.x.x...";
const BREAK_HIGH = "X...X...X.X.X...";

export const LEVELS: LevelInfo[] = [
  { family: "caixa", level: 1, title: "Pulso y manos", description: "Golpes iguales con las dos manos, siempre con el metrónomo." },
  { family: "caixa", level: 2, title: "Acentos", description: "Diferencia clara entre acento y golpe suave, sin perder el tempo." },
  { family: "caixa", level: 3, title: "Rudimentos", description: "Paradiddles y redobles de la lista de la PAS." },
  { family: "caixa", level: 4, title: "Caixa de batucada", description: "La técnica aplicada a la levada, al samba-reggae y a los breques." },
  { family: "surdo", level: 1, title: "Pulso", description: "Un golpe firme por pulso, abierto y tapado." },
  { family: "surdo", level: 2, title: "Marcación", description: "Primeira y segunda: la base sobre la que se apoya todo el grupo." },
  { family: "surdo", level: 3, title: "Corte y breques", description: "Terceira, contratiempo y paradas del grupo." },
];

export const EXERCISES: Exercise[] = [
  // ── Caixa · nivel 1 ────────────────────────────────────────────────
  {
    slug: "caixa-ocho-por-mano",
    family: "caixa",
    instrument: "caixa",
    level: 1,
    title: "Ocho por mano",
    focus: "Igualar las dos manos",
    description: "El calentamiento clásico: ocho corcheas con la derecha y ocho con la izquierda.",
    tips: [
      "Misma altura de baqueta en todos los golpes: que no se distinga qué mano toca.",
      "Deja que la baqueta rebote; no la aprietes contra el parche.",
    ],
    source: YAMAHA_WARMUP,
    tempos: [60, 70, 80, 90, 100],
    bars: ["x.x.x.x.x.x.x.x.", "x.x.x.x.x.x.x.x."],
    hands: ["D.D.D.D.D.D.D.D.", "I.I.I.I.I.I.I.I."],
    repeat: 2,
  },
  {
    slug: "caixa-golpes-sencillos",
    family: "caixa",
    instrument: "caixa",
    level: 1,
    title: "Golpes sencillos",
    focus: "Rudimento n.º 1: redoble de golpes sencillos",
    description: "Semicorcheas alternando manos (D I D I…). Base de casi todo lo que toca la caixa.",
    tips: ["Empieza despacio y sube el tempo solo cuando salga limpio.", "Cuenta «1 i y a» en voz alta las primeras veces."],
    source: PAS,
    tempos: [60, 70, 80, 90, 100, 110],
    bars: [SIXTEENTHS],
    hands: [ALTERNATE_16],
    repeat: 4,
  },
  {
    slug: "caixa-golpes-dobles",
    family: "caixa",
    instrument: "caixa",
    level: 1,
    title: "Golpes dobles",
    focus: "Rudimento n.º 6: redoble de golpes dobles",
    description: "Dos golpes por mano (D D I I). El segundo golpe tiene que sonar igual que el primero.",
    tips: ["El segundo golpe sale del rebote, ayudado por los dedos.", "Si el segundo suena flojo, baja el tempo."],
    source: PAS,
    tempos: [50, 60, 70, 80, 90],
    bars: [SIXTEENTHS],
    hands: ["DDIIDDIIDDIIDDII"],
    repeat: 4,
  },
  {
    slug: "caixa-escalera-subdivisiones",
    family: "caixa",
    instrument: "caixa",
    level: 1,
    title: "Escalera de subdivisiones",
    focus: "Negras, corcheas, tresillos y semicorcheas sobre el mismo pulso",
    description: "Cada compás divide el pulso un poco más: 1, 2, 3 y 4 golpes por negra.",
    tips: ["El pulso no cambia: lo que cambia es cuántos golpes caben dentro.", "Los tresillos tienen que quedar redondos, no «cojos»."],
    source: { label: "Ejercicio de subdivisión con metrónomo (fundamentos de caja)" },
    tempos: [60, 70, 80, 90],
    bars: ["x...x...x...x...", "x.x.x.x.x.x.x.x.", "xxxxxxxxxxxx", SIXTEENTHS],
    hands: ["D...I...D...I...", "D.I.D.I.D.I.D.I.", "DIDIDIDIDIDI", ALTERNATE_16],
    repeat: 1,
  },

  // ── Caixa · nivel 2 ────────────────────────────────────────────────
  {
    slug: "caixa-acento-tap",
    family: "caixa",
    instrument: "caixa",
    level: 2,
    title: "Acento y golpe suave",
    focus: "Alturas: acento arriba, golpes suaves abajo",
    description: "Semicorcheas alternas con acento en la primera de cada grupo de cuatro.",
    tips: [
      "El acento sale de más altura, no de apretar más.",
      "Después del acento, para la baqueta cerca del parche para el golpe suave.",
    ],
    source: VIC_FIRTH_ACCENT_TAP,
    tempos: [60, 70, 80, 90, 100],
    bars: ["XoooXoooXoooXooo"],
    hands: [ALTERNATE_16],
    repeat: 4,
  },
  {
    slug: "caixa-acento-desplazado",
    family: "caixa",
    instrument: "caixa",
    level: 2,
    title: "Acento que se desplaza",
    focus: "Poner el acento en cualquier semicorchea",
    description: "En cada compás el acento cae una semicorchea más tarde: en el «1», en la «i», en la «y» y en la «a».",
    tips: ["Mantén los golpes suaves muy bajos para que el acento destaque.", "No adelantes el acento cuando cae a contratiempo."],
    source: STICK_CONTROL,
    tempos: [60, 70, 80, 90],
    bars: ["XoooXoooXoooXooo", "oXoooXoooXoooXoo", "ooXoooXoooXoooXo", "oooXoooXoooXoooX"],
    hands: [ALTERNATE_16, ALTERNATE_16, ALTERNATE_16, ALTERNATE_16],
    repeat: 1,
  },
  {
    slug: "caixa-acentos-en-tresillo",
    family: "caixa",
    instrument: "caixa",
    level: 2,
    title: "Acentos en tresillo",
    focus: "Acento que cambia de mano",
    description: "Tresillos alternos con acento en el primero de cada grupo: el acento cae una vez en cada mano.",
    tips: ["Escucha que los acentos de la izquierda suenen como los de la derecha."],
    source: STICK_CONTROL,
    tempos: [60, 70, 80, 90],
    bars: ["XooXooXooXoo"],
    hands: ["DIDIDIDIDIDI"],
    repeat: 4,
  },

  // ── Caixa · nivel 3 ────────────────────────────────────────────────
  {
    slug: "caixa-paradiddle",
    family: "caixa",
    instrument: "caixa",
    level: 3,
    title: "Paradiddle",
    focus: "Rudimento n.º 16: D I D D · I D I I",
    description: "Dos sencillos y un doble. El acento en el primer golpe de cada grupo cambia de mano.",
    tips: ["Piensa «pa-ra-di-dle»: el doble es el «di-dle».", "El acento va en la mano que empieza cada grupo."],
    source: PAS_PARADIDDLE,
    tempos: [50, 60, 70, 80, 90, 100],
    bars: ["XoooXoooXoooXooo"],
    hands: ["DIDDIDIIDIDDIDII"],
    repeat: 4,
  },
  {
    slug: "caixa-paradiddle-doble",
    family: "caixa",
    instrument: "caixa",
    level: 3,
    title: "Paradiddle doble",
    focus: "Rudimento n.º 17: D I D I D D · I D I D I I",
    description: "Cuatro sencillos y un doble, en tresillos: cada grupo dura dos pulsos.",
    tips: ["Acentúa el primer golpe de cada grupo de seis."],
    source: PAS_PARADIDDLE,
    tempos: [50, 60, 70, 80, 90],
    bars: ["XoooooXooooo"],
    hands: ["DIDIDDIDIDII"],
    repeat: 4,
  },
  {
    slug: "caixa-paradiddle-diddle",
    family: "caixa",
    instrument: "caixa",
    level: 3,
    title: "Paradiddle-diddle",
    focus: "Rudimento n.º 19: D I D D I I",
    description: "Un sencillo de cada mano y dos dobles, en tresillos. Siempre empieza con la misma mano.",
    tips: ["Los dos dobles seguidos tienen que sonar parejos."],
    source: PAS_PARADIDDLE,
    tempos: [50, 60, 70, 80],
    bars: ["XoooooXooooo"],
    hands: ["DIDDIIDIDDII"],
    repeat: 4,
  },
  {
    slug: "caixa-redoble-de-cinco",
    family: "caixa",
    instrument: "caixa",
    level: 3,
    title: "Redoble de cinco golpes",
    focus: "Rudimento n.º 7: D D I I D, con acento al final",
    description: "Dos dobles y un acento que cae en el pulso. Luego se repite empezando con la otra mano.",
    tips: ["El acento final cae justo en el pulso: no lo adelantes."],
    source: PAS,
    tempos: [50, 60, 70, 80],
    bars: ["xxxxX...xxxxX..."],
    hands: ["DDIID...IIDDI..."],
    repeat: 4,
  },

  // ── Caixa · nivel 4 ────────────────────────────────────────────────
  {
    slug: "caixa-levada-samba",
    family: "caixa",
    instrument: "caixa",
    level: 4,
    title: "Levada de samba",
    focus: "El colchón de la caixa con los surdos de fondo",
    description: "La levada de «Samba de ensayo»: acentos en el pulso, golpes suaves y un aro al final.",
    tips: ["Los acentos marcan el pulso con los surdos: escúchalos.", "Los golpes suaves casi no se oyen: son el colchón."],
    source: HEROLEIROS,
    tempos: [70, 80, 90, 100, 110],
    bars: ["X.oxX.oxX.oxXrox"],
    hands: ["D.DID.DID.DIDIDI"],
    repeat: 4,
    accompaniment: [
      { instrument: "surdo1", bars: [MARCACAO_PRIMEIRA] },
      { instrument: "surdo2", bars: [MARCACAO_SEGUNDA] },
    ],
  },
  {
    slug: "caixa-samba-reggae",
    family: "caixa",
    instrument: "caixa",
    level: 4,
    title: "Caixa de samba-reggae",
    focus: "Acentos 3 + 3 + 4 + 3 + 3 sobre semicorcheas",
    description: "Semicorcheas alternas con acentos en la 1.ª, 4.ª, 7.ª, 11.ª y 14.ª; el resto, golpes suaves.",
    tips: ["Agrupa en voz alta: «1-2-3, 1-2-3, 1-2-3-4, 1-2-3, 1-2-3».", "Los golpes suaves, muy bajos: son notas fantasma."],
    source: ROR_SAMBA_REGGAE,
    tempos: [70, 80, 90, 100],
    bars: ["XooXooXoooXooXoo"],
    hands: [ALTERNATE_16],
    repeat: 4,
  },
  {
    slug: "caixa-groove-y-breque",
    family: "caixa",
    instrument: "caixa",
    level: 4,
    title: "Groove y breque",
    focus: "Parar y volver a entrar a tiempo",
    description: "Tres compases de levada y uno de breque con todo el grupo, y vuelta a empezar.",
    tips: ["El breque se toca con el grupo: los silencios cuentan tanto como los golpes.", "Entra en el «1» del compás siguiente sin dudar."],
    source: HEROLEIROS,
    tempos: [70, 80, 90, 100],
    bars: ["X.oxX.oxX.oxXrox", "X.oxX.oxX.oxXrox", "X.oxX.oxX.oxXrox", BREAK_HIGH],
    hands: ["D.DID.DID.DIDIDI", "D.DID.DID.DIDIDI", "D.DID.DID.DIDIDI", "D...D...D.I.D..."],
    repeat: 2,
    accompaniment: [
      { instrument: "surdo1", bars: [MARCACAO_PRIMEIRA, MARCACAO_PRIMEIRA, MARCACAO_PRIMEIRA, BREAK_LOW] },
      { instrument: "surdo2", bars: [MARCACAO_SEGUNDA, MARCACAO_SEGUNDA, MARCACAO_SEGUNDA, BREAK_LOW] },
    ],
  },

  // ── Surdo · nivel 1 ────────────────────────────────────────────────
  {
    slug: "surdo-negras",
    family: "surdo",
    instrument: "surdo1",
    level: 1,
    title: "Un golpe por pulso",
    focus: "Pulso firme con la maza",
    description: "Negras abiertas con la maza, justo con el metrónomo.",
    tips: ["Golpea en el centro del parche y deja que la maza rebote.", "El surdo es la referencia del grupo: no corras."],
    source: SURDO_WIKI,
    tempos: [60, 70, 80, 90, 100, 110],
    bars: ["x...x...x...x..."],
    repeat: 4,
  },
  {
    slug: "surdo-abierto-y-tapado",
    family: "surdo",
    instrument: "surdo1",
    level: 1,
    title: "Abierto y tapado",
    focus: "La técnica básica del surdo",
    description: "Un golpe abierto y uno tapado (con la mano libre apoyada en el parche), alternando en cada pulso.",
    tips: ["Tapado: la mano libre sobre el parche mientras golpea la maza.", "Abierto: levanta la mano para que el parche suene entero."],
    source: SURDO_WIKI,
    tempos: [60, 70, 80, 90, 100],
    bars: ["x...o...x...o..."],
    repeat: 4,
  },
  {
    slug: "surdo-corcheas",
    family: "surdo",
    instrument: "surdo1",
    level: 1,
    title: "Dos por pulso",
    focus: "Resistencia y regularidad",
    description: "Corcheas abiertas con la maza: todas iguales y sin acelerar.",
    tips: ["Relaja el hombro: el golpe sale de la muñeca y el antebrazo."],
    source: { label: "Ejercicio de subdivisión con metrónomo" },
    tempos: [60, 70, 80, 90],
    bars: ["x.x.x.x.x.x.x.x."],
    repeat: 4,
  },

  // ── Surdo · nivel 2 ────────────────────────────────────────────────
  {
    slug: "surdo-primeira",
    family: "surdo",
    instrument: "surdo1",
    level: 2,
    title: "Marcación de primeira",
    focus: "Tapado en el 1, abierto en el 2",
    description: "El surdo grave marca el tiempo fuerte en el 2. La segunda responde de fondo.",
    tips: ["El abierto del 2 es el golpe más importante del grupo: firme y a tiempo."],
    source: SURDO_WIKI,
    tempos: [70, 80, 90, 100, 110],
    bars: [MARCACAO_PRIMEIRA],
    repeat: 4,
    accompaniment: [{ instrument: "surdo2", bars: [MARCACAO_SEGUNDA] }],
  },
  {
    slug: "surdo-segunda",
    family: "surdo",
    instrument: "surdo2",
    level: 2,
    title: "Marcación de segunda",
    focus: "Abierto en el 1, tapado en el 2",
    description: "La segunda «pregunta» en el 1 y la primeira responde en el 2.",
    tips: ["Escucha a la primeira: vuestros abiertos se alternan."],
    source: SURDO_WIKI,
    tempos: [70, 80, 90, 100, 110],
    bars: [MARCACAO_SEGUNDA],
    repeat: 4,
    accompaniment: [{ instrument: "surdo1", bars: [MARCACAO_PRIMEIRA] }],
  },
  {
    slug: "surdo-primeira-con-pique",
    family: "surdo",
    instrument: "surdo1",
    level: 2,
    title: "Primeira con anticipación",
    focus: "Un golpe de adorno justo antes del 2",
    description: "La marcación de primeira con un golpe abierto en la última semicorchea del 1.",
    tips: ["El adorno es corto y más suave: el golpe fuerte sigue siendo el del 2."],
    source: SURDO_WIKI,
    tempos: [70, 80, 90, 100],
    bars: ["o..xx...o..xx..."],
    repeat: 4,
    accompaniment: [{ instrument: "surdo2", bars: [MARCACAO_SEGUNDA] }],
  },

  // ── Surdo · nivel 3 ────────────────────────────────────────────────
  {
    slug: "surdo-terceira-corte",
    family: "surdo",
    instrument: "surdo3",
    level: 3,
    title: "Corte de terceira",
    focus: "Síncopas entre los golpes de primeira y segunda",
    description: "El patrón de corte de «Samba de ensayo», con primeira y segunda de fondo.",
    tips: ["Los golpes caen entre los pulsos: apóyate en los surdos graves."],
    source: SURDO_WIKI,
    tempos: [70, 80, 90, 100],
    bars: [CORTE_TERCEIRA],
    repeat: 4,
    accompaniment: [
      { instrument: "surdo1", bars: [MARCACAO_PRIMEIRA] },
      { instrument: "surdo2", bars: [MARCACAO_SEGUNDA] },
    ],
  },
  {
    slug: "surdo-contratiempo",
    family: "surdo",
    instrument: "surdo3",
    level: 3,
    title: "Contratiempo",
    focus: "Tocar solo entre los pulsos",
    description: "Golpes abiertos en la «y» de cada pulso, mientras primeira y segunda marcan el tiempo.",
    tips: ["Cuenta «1 y 2 y» y toca solo en las «y».", "Si te vas al pulso, baja el tempo."],
    source: SAMBA_NY_TERCEIRA,
    tempos: [60, 70, 80, 90],
    bars: ["..x...x...x...x."],
    repeat: 4,
    accompaniment: [
      { instrument: "surdo1", bars: [MARCACAO_PRIMEIRA] },
      { instrument: "surdo2", bars: [MARCACAO_SEGUNDA] },
    ],
  },
  {
    slug: "surdo-breque",
    family: "surdo",
    instrument: "surdo1",
    level: 3,
    title: "Breque de surdos",
    focus: "Parar con el grupo y volver a marcar",
    description: "Tres compases de marcación y uno de breque, y vuelta a empezar.",
    tips: ["En el breque, todos los surdos tocan juntos: golpes cortos y a tiempo."],
    source: HEROLEIROS,
    tempos: [70, 80, 90, 100],
    bars: [MARCACAO_PRIMEIRA, MARCACAO_PRIMEIRA, MARCACAO_PRIMEIRA, BREAK_LOW],
    repeat: 2,
    accompaniment: [{ instrument: "surdo2", bars: [MARCACAO_SEGUNDA, MARCACAO_SEGUNDA, MARCACAO_SEGUNDA, BREAK_LOW] }],
  },
];

export const ROUTINES: Routine[] = [
  {
    slug: "rutina-calentamiento-caixa",
    family: "caixa",
    instrument: "caixa",
    title: "Calentamiento de caixa",
    description: "Unos diez minutos antes de ensayar: manos iguales, sencillos, dobles, acentos y paradiddle.",
    tempos: [60, 70, 80, 90],
    parts: [
      { exercise: "caixa-ocho-por-mano", repeat: 2 },
      { exercise: "caixa-golpes-sencillos", repeat: 4 },
      { exercise: "caixa-golpes-dobles", repeat: 4 },
      { exercise: "caixa-acento-tap", repeat: 4 },
      { exercise: "caixa-paradiddle", repeat: 4 },
    ],
  },
  {
    slug: "rutina-calentamiento-surdo",
    family: "surdo",
    instrument: "surdo1",
    title: "Calentamiento de surdo",
    description: "Pulso, abierto y tapado, corcheas, marcación y breque, todo seguido.",
    tempos: [60, 70, 80, 90],
    parts: [
      { exercise: "surdo-negras", repeat: 2 },
      { exercise: "surdo-abierto-y-tapado", repeat: 2 },
      { exercise: "surdo-corcheas", repeat: 2 },
      { exercise: "surdo-primeira", repeat: 4 },
      { exercise: "surdo-breque", repeat: 1 },
    ],
  },
];

export function findExercise(slug: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.slug === slug);
}

export function findRoutine(slug: string): Routine | undefined {
  return ROUTINES.find((routine) => routine.slug === slug);
}

export function levelsOf(family: ExerciseFamily): LevelInfo[] {
  return LEVELS.filter((level) => level.family === family).sort((a, b) => a.level - b.level);
}

export function exercisesOf(family: ExerciseFamily, level?: number): Exercise[] {
  return EXERCISES.filter((e) => e.family === family && (level === undefined || e.level === level));
}

export const FAMILY_NAMES: Record<ExerciseFamily, string> = { caixa: "Caixa", surdo: "Surdo" };
