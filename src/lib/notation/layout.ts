export interface RowLayoutOptions {
  /** Ancho disponible en píxeles. */
  width: number;
  /** Ancho extra del primer compás de cada fila (clave). */
  rowStartExtra: number;
  /** Ancho extra del primer compás de la partitura (indicación de compás). */
  firstBarExtra: number;
  /** La última fila solo se estira hasta este factor de su ancho natural. */
  lastRowMaxStretch?: number;
}

export interface LaidOutBar {
  /** Índice dentro de la lista de compases. */
  index: number;
  x: number;
  width: number;
}

export interface LaidOutRow {
  bars: LaidOutBar[];
}

/**
 * Reparte los compases en filas: llena cada fila con los compases que caben
 * con su ancho natural y luego los estira para ocupar todo el ancho.
 */
export function layoutRows(naturalWidths: readonly number[], options: RowLayoutOptions): LaidOutRow[] {
  const available = Math.max(1, options.width);
  const lastRowMaxStretch = options.lastRowMaxStretch ?? 1.4;
  const rows: { index: number; width: number }[][] = [];
  let current: { index: number; width: number }[] = [];
  let used = 0;

  naturalWidths.forEach((natural, index) => {
    const extra = (index === 0 ? options.firstBarExtra : 0) + (current.length === 0 ? options.rowStartExtra : 0);
    const width = natural + extra;
    if (current.length > 0 && used + width > available) {
      rows.push(current);
      current = [];
      used = 0;
      const startWidth = natural + options.rowStartExtra;
      current.push({ index, width: startWidth });
      used = startWidth;
      return;
    }
    current.push({ index, width });
    used += width;
  });
  if (current.length > 0) rows.push(current);

  return rows.map((row, rowIndex) => {
    const natural = row.reduce((sum, bar) => sum + bar.width, 0);
    const isLast = rowIndex === rows.length - 1;
    const target = isLast ? Math.min(available, natural * lastRowMaxStretch) : available;
    const scale = natural > 0 ? target / natural : 1;
    let x = 0;
    return {
      bars: row.map((bar) => {
        const width = bar.width * scale;
        const laid = { index: bar.index, x, width };
        x += width;
        return laid;
      }),
    };
  });
}

export interface BeatAnchor {
  beat: number;
  x: number;
}

/** Posición horizontal de un pulso, interpolando entre las figuras dibujadas. */
export function xAtBeat(anchors: readonly BeatAnchor[], beat: number): number {
  if (anchors.length === 0) return 0;
  if (beat <= anchors[0].beat) return anchors[0].x;
  const last = anchors[anchors.length - 1];
  if (beat >= last.beat) return last.x;
  let lo = 0;
  let hi = anchors.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (anchors[mid].beat <= beat) lo = mid;
    else hi = mid;
  }
  const a = anchors[lo];
  const b = anchors[hi];
  if (b.beat === a.beat) return a.x;
  return a.x + ((beat - a.beat) / (b.beat - a.beat)) * (b.x - a.x);
}

export interface BarRange {
  startBar: number;
  endBar: number;
}

/**
 * Selección tras tocar un compás: si había un único compás marcado (A), el
 * segundo toque cierra el tramo (B). Con `extend` (Mayús) se amplía el tramo.
 */
export function tapSelection(current: BarRange | null, bar: number, extend = false): BarRange {
  if (current && (extend || current.startBar === current.endBar) && bar !== current.startBar) {
    return { startBar: Math.min(current.startBar, bar), endBar: Math.max(current.endBar, bar) };
  }
  return { startBar: bar, endBar: bar };
}

/** Tramo al arrastrar desde el compás `anchor` hasta `bar`. */
export function dragSelection(anchor: number, bar: number): BarRange {
  return { startBar: Math.min(anchor, bar), endBar: Math.max(anchor, bar) };
}
