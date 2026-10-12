import {
  Annotation,
  Articulation,
  Beam,
  Dot,
  Formatter,
  ModifierPosition,
  Parenthesis,
  Renderer,
  Stave,
  StaveNote,
  Stem,
  Tuplet,
  Voice,
  VoiceMode,
  type RenderContext,
} from "vexflow/bravura";

import type { InstrumentId } from "@/lib/chart/types";
import { layoutRows, type BeatAnchor } from "@/lib/notation/layout";
import type { QuantizedBar, QuantizedTrack } from "@/lib/notation/quantize";
import { barTokenCount, beatRhythm, isEmptyBar, type RhythmToken } from "@/lib/notation/rhythm";
import { REST_KEY, strokeSymbol, vexKey, type StrokeSymbol } from "@/lib/notation/symbols";

export const ROW_HEIGHT = 106;
export const SCORE_PADDING_TOP = 6;
/** La línea visible del pentagrama queda a esta altura dentro de la fila (deja sitio a plicas y tresillos). */
export const STAFF_LINE_OFFSET = 68;

const STAVE_LINE_SPACING = 10;
const BAR_PADDING = 34;
const NOTE_SPACE = 19;
const MIN_BAR_WIDTH = 104;
const CLEF_WIDTH = 34;
const TIME_SIGNATURE_WIDTH = 26;
export const LEGEND_GLYPH_WIDTH = 48;
export const LEGEND_GLYPH_HEIGHT = 84;
const ONLY_MIDDLE_LINE = [0, 1, 2, 3, 4].map((line) => ({ visible: line === 2 }));

export interface BarGeometry {
  bar: number;
  row: number;
  x: number;
  width: number;
  top: number;
  startBeat: number;
  endBeat: number;
  /** Pulso → x de cada figura, para mover el cursor entre ellas. */
  anchors: BeatAnchor[];
}

export interface ScoreGeometry {
  width: number;
  height: number;
  rowHeight: number;
  rows: number;
  beatsPerBar: number;
  bars: BarGeometry[];
}

function staveY(top: number): number {
  // Con 5 líneas (solo la central visible) la central está a 6 espacios del borde del pentagrama.
  return top + STAFF_LINE_OFFSET - 6 * STAVE_LINE_SPACING;
}

function newContext(host: HTMLDivElement, width: number, height: number): RenderContext {
  host.replaceChildren();
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  renderer.resize(width, height);
  return renderer.getContext();
}

function buildNote(instrument: InstrumentId, token: RhythmToken, overrideDuration?: string): StaveNote {
  const duration = overrideDuration ?? token.duration;
  if (!token.note) {
    const rest = new StaveNote({ keys: [REST_KEY], duration: `${duration}r`, dots: token.dots, clef: "percussion" });
    if (token.dots) Dot.buildAndAttach([rest], { all: true });
    return rest;
  }
  const symbol = strokeSymbol(instrument, token.note.stroke);
  const note = noteForSymbol(symbol, duration, token.dots);
  if (token.note.accent) note.addModifier(new Articulation("a>").setPosition(ModifierPosition.BELOW), 0);
  // Digitación de los ejercicios (D / I) encima de la nota.
  if (token.note.hand) note.addModifier(new Annotation(token.note.hand), 0);
  return note;
}

function noteForSymbol(symbol: StrokeSymbol, duration: string, dots: number): StaveNote {
  const note = new StaveNote({
    keys: [vexKey(symbol)],
    duration,
    dots,
    clef: "percussion",
    stemDirection: Stem.UP,
  });
  if (dots) Dot.buildAndAttach([note], { all: true });
  // Sin `betweenLines` el «+» se iría por debajo de las cuatro líneas invisibles del pentagrama.
  if (symbol.muted) note.addModifier(new Articulation("a+").setPosition(ModifierPosition.BELOW).setBetweenLines(), 0);
  if (symbol.ghost) Parenthesis.buildAndAttach([note]);
  return note;
}

function noteCenterX(note: StaveNote): number {
  return (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2;
}

interface DrawnBar {
  anchors: BeatAnchor[];
}

function drawBar(
  ctx: RenderContext,
  bar: QuantizedBar,
  quantized: QuantizedTrack,
  stave: Stave,
): DrawnBar {
  const { beatsPerBar, instrument } = quantized;
  const voice = new Voice({ numBeats: beatsPerBar, beatValue: 4 }).setMode(VoiceMode.SOFT);
  const beams: Beam[] = [];
  const tuplets: Tuplet[] = [];
  const placed: { note: StaveNote; beat: number }[] = [];

  if (isEmptyBar(bar) && beatsPerBar === 4) {
    const rest = new StaveNote({ keys: [REST_KEY], duration: "wr", clef: "percussion", alignCenter: true });
    voice.addTickables([rest]);
  } else {
    for (const beat of bar.beats) {
      const { tuplet, tokens } = beatRhythm(beat);
      const notes = tokens.map((token) => buildNote(instrument, token));
      notes.forEach((note, i) =>
        placed.push({ note, beat: beat.beat + (tokens[i].slot / beat.division) * beat.span }),
      );
      if (tuplet) {
        const allBeamed = tokens.length === tuplet.numNotes && tokens.every((t) => t.note);
        tuplets.push(
          new Tuplet(notes, {
            numNotes: tuplet.numNotes,
            notesOccupied: tuplet.notesOccupied,
            bracketed: !allBeamed,
            ratioed: false,
          }),
        );
      }
      const beamable = tokens.flatMap((t, i) => (t.note && t.duration !== "q" && t.duration !== "h" ? [i] : []));
      if (beamable.length >= 2) {
        const group = notes.slice(beamable[0], beamable[beamable.length - 1] + 1);
        const beam = new Beam(group, false);
        beams.push(beam);
      }
      voice.addTickables(notes);
    }
  }

  new Formatter().joinVoices([voice]).formatToStave([voice], stave);
  voice.draw(ctx, stave);
  for (const beam of beams) beam.setContext(ctx).draw();
  for (const tuplet of tuplets) tuplet.setContext(ctx).draw();

  const anchors: BeatAnchor[] =
    placed.length > 0
      ? placed.map(({ note, beat }) => ({ beat, x: noteCenterX(note) }))
      : [{ beat: bar.startBeat, x: stave.getNoteStartX() + 6 }];
  anchors.push({ beat: bar.startBeat + beatsPerBar, x: stave.getX() + stave.getWidth() });
  return { anchors };
}

export function naturalBarWidth(bar: QuantizedBar): number {
  return Math.max(MIN_BAR_WIDTH, BAR_PADDING + barTokenCount(bar) * NOTE_SPACE);
}

/** Dibuja la partitura de una pista en `host` (SVG) y devuelve su geometría. */
export function renderScore(host: HTMLDivElement, quantized: QuantizedTrack, width: number): ScoreGeometry {
  const rows = layoutRows(quantized.bars.map(naturalBarWidth), {
    width: width - 2,
    rowStartExtra: CLEF_WIDTH,
    firstBarExtra: TIME_SIGNATURE_WIDTH,
  });
  const height = SCORE_PADDING_TOP + rows.length * ROW_HEIGHT;
  const ctx = newContext(host, width, height);
  const bars: BarGeometry[] = [];

  rows.forEach((row, rowIndex) => {
    const top = SCORE_PADDING_TOP + rowIndex * ROW_HEIGHT;
    row.bars.forEach((laid, position) => {
      const bar = quantized.bars[laid.index];
      const stave = new Stave(laid.x + 1, staveY(top), laid.width);
      stave.setConfigForLines(ONLY_MIDDLE_LINE);
      if (position === 0) stave.addClef("percussion");
      if (laid.index === 0) stave.addTimeSignature(quantized.timeSignature.join("/"));
      stave.setContext(ctx).draw();
      const { anchors } = drawBar(ctx, bar, quantized, stave);
      bars.push({
        bar: bar.bar,
        row: rowIndex,
        x: laid.x + 1,
        width: laid.width,
        top,
        startBeat: bar.startBeat,
        endBeat: bar.startBeat + quantized.beatsPerBar,
        anchors,
      });
    });
  });

  // Dentro de una fila el cursor no salta: el final de un compás es el primer golpe del siguiente.
  for (let i = 0; i + 1 < bars.length; i++) {
    if (bars[i].row !== bars[i + 1].row) continue;
    const end = bars[i].anchors[bars[i].anchors.length - 1];
    end.x = bars[i + 1].anchors[0].x;
  }

  return { width, height, rowHeight: ROW_HEIGHT, rows: rows.length, beatsPerBar: quantized.beatsPerBar, bars };
}

/** Dibuja una sola nota de muestra para la leyenda. */
export function renderLegendGlyph(host: HTMLDivElement, symbol: StrokeSymbol, accent: boolean): void {
  const width = LEGEND_GLYPH_WIDTH;
  const height = LEGEND_GLYPH_HEIGHT;
  const ctx = newContext(host, width, height);
  const stave = new Stave(0, 40 - 6 * STAVE_LINE_SPACING, width, { leftBar: false, rightBar: false });
  stave.setConfigForLines(ONLY_MIDDLE_LINE).setNoteStartX(4);
  stave.setContext(ctx).draw();
  const note = noteForSymbol(symbol, "q", 0);
  if (accent) note.addModifier(new Articulation("a>").setPosition(ModifierPosition.BELOW), 0);
  const voice = new Voice({ numBeats: 1, beatValue: 4 }).setMode(VoiceMode.SOFT).addTickables([note]);
  new Formatter().joinVoices([voice]).formatToStave([voice], stave);
  voice.draw(ctx, stave);
}
