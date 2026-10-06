import { lowerBound, sectionIndexAt } from "../chart/query";
import type { Chart, ChartTrack, InstrumentId, StrokeId } from "../chart/types";
import type { ExpectedNote } from "../judge/types";

export interface PlanOptions {
  /** Velocidad 0.5..1 (multiplica el BPM de referencia). */
  rate: number;
  /** Compás inicial (desde 1, incluido). */
  startBar: number;
  /** Compás final (incluido). */
  endBar: number;
  /** Repetir el tramo A-B hasta que el jugador pare. */
  loop: boolean;
  /** Compases de cuenta atrás antes de la primera vuelta. */
  countInBars: number;
}

/**
 * Línea de tiempo de una partida, en segundos desde que se pulsa «Tocar».
 * La cuenta atrás ocupa [0, countInSeconds); después empieza la vuelta 0
 * del tramo [startBeat, endBeat). Con bucle, cada vuelta dura `passSeconds`.
 */
export interface SessionPlan {
  rate: number;
  bpm: number;
  secondsPerBeat: number;
  beatsPerBar: number;
  startBar: number;
  endBar: number;
  startBeat: number;
  endBeat: number;
  loop: boolean;
  countInBeats: number;
  countInSeconds: number;
  passSeconds: number;
  /** Fin de la partida (con margen para la última nota), o Infinity con bucle. */
  endTime: number;
}

export const END_TAIL_SECONDS = 1.2;

export function createPlan(chart: Chart, options: PlanOptions): SessionPlan {
  const rate = clamp(options.rate, 0.25, 2);
  const startBar = clamp(Math.round(options.startBar), 1, chart.bars);
  const endBar = clamp(Math.round(options.endBar), startBar, chart.bars);
  const bpm = chart.bpm * rate;
  const secondsPerBeat = 60 / bpm;
  const startBeat = (startBar - 1) * chart.beatsPerBar;
  const endBeat = endBar * chart.beatsPerBar;
  const countInBeats = Math.max(0, Math.round(options.countInBars)) * chart.beatsPerBar;
  const countInSeconds = countInBeats * secondsPerBeat;
  const passSeconds = (endBeat - startBeat) * secondsPerBeat;
  return {
    rate,
    bpm,
    secondsPerBeat,
    beatsPerBar: chart.beatsPerBar,
    startBar,
    endBar,
    startBeat,
    endBeat,
    loop: options.loop,
    countInBeats,
    countInSeconds,
    passSeconds,
    endTime: options.loop ? Infinity : countInSeconds + passSeconds + END_TAIL_SECONDS,
  };
}

export function beatToTime(plan: SessionPlan, beat: number, pass = 0): number {
  return plan.countInSeconds + pass * plan.passSeconds + (beat - plan.startBeat) * plan.secondsPerBeat;
}

export interface SessionPosition {
  /** Vuelta del bucle (0 durante la cuenta atrás). */
  pass: number;
  /** Pulso de la canción; durante la cuenta atrás es < startBeat. */
  beat: number;
  countIn: boolean;
  /** Pulsos restantes de cuenta atrás (redondeado hacia arriba), o 0. */
  countInRemaining: number;
}

export function positionAt(plan: SessionPlan, time: number): SessionPosition {
  if (time < plan.countInSeconds) {
    const beatsLeft = (plan.countInSeconds - time) / plan.secondsPerBeat;
    return {
      pass: 0,
      beat: plan.startBeat - beatsLeft,
      countIn: true,
      countInRemaining: Math.ceil(beatsLeft - 1e-9),
    };
  }
  const songTime = time - plan.countInSeconds;
  const pass = plan.loop && plan.passSeconds > 0 ? Math.floor(songTime / plan.passSeconds) : 0;
  const within = songTime - pass * plan.passSeconds;
  return {
    pass,
    beat: plan.startBeat + within / plan.secondsPerBeat,
    countIn: false,
    countInRemaining: 0,
  };
}

export interface ScoreEvent {
  beat: number;
  instrument: InstrumentId;
  stroke: StrokeId;
  velocity: number;
  accent: boolean;
}

export interface ScheduledEvent extends ScoreEvent {
  time: number;
  pass: number;
}

export interface MetronomeClick {
  time: number;
  downbeat: boolean;
  countIn: boolean;
}

/** Todas las notas del tramo, de todos los instrumentos, ordenadas por pulso. */
export function buildScore(chart: Chart, plan: SessionPlan): ScoreEvent[] {
  const events: ScoreEvent[] = [];
  for (const track of chart.tracks) {
    for (const note of track.notes) {
      if (note.beat < plan.startBeat - 1e-9 || note.beat >= plan.endBeat - 1e-9) continue;
      events.push({
        beat: note.beat,
        instrument: track.instrument,
        stroke: note.stroke,
        velocity: note.velocity,
        accent: note.accent,
      });
    }
  }
  return events.sort((a, b) => a.beat - b.beat);
}

/** Vueltas que se solapan con [t0, t1). */
export function passesInWindow(plan: SessionPlan, t0: number, t1: number): number[] {
  if (t1 <= plan.countInSeconds || plan.passSeconds <= 0) return [];
  const first = Math.max(0, Math.floor((t0 - plan.countInSeconds) / plan.passSeconds));
  const last = plan.loop ? Math.floor((t1 - plan.countInSeconds) / plan.passSeconds) : 0;
  const passes: number[] = [];
  for (let pass = first; pass <= last; pass++) passes.push(pass);
  return passes;
}

/** Eventos de acompañamiento con `t0 <= time < t1`. */
export function scoreEventsInWindow(
  score: ScoreEvent[],
  plan: SessionPlan,
  t0: number,
  t1: number,
): ScheduledEvent[] {
  const out: ScheduledEvent[] = [];
  for (const pass of passesInWindow(plan, t0, t1)) {
    const passStart = plan.countInSeconds + pass * plan.passSeconds;
    const b0 = plan.startBeat + (t0 - passStart) / plan.secondsPerBeat;
    const b1 = plan.startBeat + (t1 - passStart) / plan.secondsPerBeat;
    const from = lowerBound(score, Math.max(plan.startBeat, b0));
    const to = lowerBound(score, Math.min(plan.endBeat, b1));
    for (let i = from; i < to; i++) {
      const event = score[i];
      out.push({ ...event, pass, time: beatToTime(plan, event.beat, pass) });
    }
  }
  return out;
}

/**
 * Clics de metrónomo con `t0 <= time < t1`. La cuenta atrás siempre suena;
 * los clics dentro de la canción solo si `metronome`.
 */
export function clicksInWindow(
  plan: SessionPlan,
  t0: number,
  t1: number,
  metronome: boolean,
): MetronomeClick[] {
  const clicks: MetronomeClick[] = [];
  const spb = plan.secondsPerBeat;
  for (let k = Math.max(0, Math.ceil(t0 / spb - 1e-9)); k < plan.countInBeats; k++) {
    const time = k * spb;
    if (time >= t1) break;
    clicks.push({ time, downbeat: k % plan.beatsPerBar === 0, countIn: true });
  }
  if (!metronome) return clicks;

  for (const pass of passesInWindow(plan, t0, t1)) {
    const passStart = plan.countInSeconds + pass * plan.passSeconds;
    const first = Math.max(plan.startBeat, plan.startBeat + Math.ceil((t0 - passStart) / spb - 1e-9));
    for (let beat = first; beat < plan.endBeat; beat++) {
      const time = beatToTime(plan, beat, pass);
      if (time >= t1) break;
      if (time < t0) continue;
      clicks.push({ time, downbeat: beat % plan.beatsPerBar === 0, countIn: false });
    }
  }
  return clicks;
}

/** Notas que el jugador debe tocar en una vuelta, ya en segundos de partida. */
export function expectedNotesForPass(chart: Chart, track: ChartTrack, plan: SessionPlan, pass: number): ExpectedNote[] {
  const notes: ExpectedNote[] = [];
  for (const note of track.notes) {
    if (note.beat < plan.startBeat - 1e-9 || note.beat >= plan.endBeat - 1e-9) continue;
    notes.push({
      id: `${note.id}@${pass}`,
      time: beatToTime(plan, note.beat, pass),
      lane: note.lane,
      accent: note.accent,
      section: Math.max(0, sectionIndexAt(chart.sections, note.beat)),
    });
  }
  return notes;
}

/** Sección de un instante de la partida (para atribuir golpes sueltos). */
export function sectionAtTime(chart: Chart, plan: SessionPlan, time: number): number {
  const { beat } = positionAt(plan, time);
  return Math.max(0, sectionIndexAt(chart.sections, Math.max(plan.startBeat, beat)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
