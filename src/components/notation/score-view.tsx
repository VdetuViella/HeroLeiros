"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { BookOpen, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { INSTRUMENTS } from "@/lib/chart/instruments";
import type { Chart, ChartTrack } from "@/lib/chart/types";
import { dragSelection, tapSelection, xAtBeat, type BarRange } from "@/lib/notation/layout";
import { quantizeTrack } from "@/lib/notation/quantize";
import { cn } from "@/lib/utils";

import { renderScore, STAFF_LINE_OFFSET, type ScoreGeometry } from "./render-score";
import { ScoreLegend } from "./score-legend";

export interface ScoreViewProps {
  chart: Chart;
  track: ChartTrack;
  /** Pulso que suena ahora, o `null` si no hay cursor. Se lee en cada frame. */
  readBeat?: () => number | null;
  /** Tramo que se está tocando: se sombrea. */
  activeRange?: BarRange | null;
  /** Compases elegidos para el bucle. */
  selection: BarRange | null;
  onSelectionChange: (range: BarRange | null) => void;
  /** Se muestra flotando sobre la parte baja de la partitura (p. ej. acciones de la selección). */
  footer?: ReactNode;
  className?: string;
}

const PADDING_X = 8;
/** Tras desplazar a mano, el cursor deja de mover la vista durante este tiempo. */
const USER_SCROLL_GRACE_MS = 2500;
const CURSOR_TOP = STAFF_LINE_OFFSET - 46;
const CURSOR_HEIGHT = 72;

let fontsPromise: Promise<unknown> | null = null;

function loadNotationFonts(): Promise<unknown> {
  fontsPromise ??= Promise.all([document.fonts.load("30px Bravura"), document.fonts.load("12px Academico")]);
  return fontsPromise;
}

export function ScoreView({
  chart,
  track,
  readBeat,
  activeRange,
  selection,
  onSelectionChange,
  footer,
  className,
}: ScoreViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const currentBarRef = useRef<HTMLDivElement>(null);
  const lastUserScroll = useRef(-Infinity);
  const drag = useRef<{ anchor: number; pointerId: number; moved: boolean; extend: boolean } | null>(null);

  const [fontsReady, setFontsReady] = useState(false);
  const [width, setWidth] = useState(0);
  const [geometry, setGeometry] = useState<ScoreGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  const quantized = useMemo(() => quantizeTrack(chart, track), [chart, track]);
  const sectionStarts = useMemo(() => new Map(chart.sections.map((s) => [s.startBar, s.name])), [chart.sections]);

  useEffect(() => {
    let alive = true;
    const done = () => alive && setFontsReady(true);
    loadNotationFonts().then(done, done);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(() => setWidth(Math.floor(scroller.clientWidth - 2 * PADDING_X)));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  // Dibujar con VexFlow es un efecto sobre el DOM; la geometría resultante alimenta la capa interactiva.
  useEffect(() => {
    const host = hostRef.current;
    if (!fontsReady || !host || width < 120) return;
    try {
      setGeometry(renderScore(host, quantized, width));
      setError(null);
    } catch (cause) {
      console.error(cause);
      setError("No se pudo dibujar la partitura de esta pista.");
    }
  }, [fontsReady, width, quantized]);

  useEffect(() => {
    const cursor = cursorRef.current;
    const current = currentBarRef.current;
    const scroller = scrollRef.current;
    if (!geometry || !cursor || !current || !scroller) return;
    const hide = () => {
      cursor.style.opacity = "0";
      current.style.opacity = "0";
    };
    if (!readBeat) {
      hide();
      return;
    }

    let frame = 0;
    let lastRow = -1;
    const loop = () => {
      const beat = readBeat();
      if (beat === null) {
        hide();
        lastRow = -1;
      } else {
        const index = Math.min(geometry.bars.length - 1, Math.max(0, Math.floor(beat / geometry.beatsPerBar + 1e-9)));
        const bar = geometry.bars[index];
        const x = xAtBeat(bar.anchors, beat);
        cursor.style.opacity = "1";
        cursor.style.transform = `translate3d(${x - 1}px, ${bar.top + CURSOR_TOP}px, 0)`;
        current.style.opacity = "1";
        current.style.transform = `translate3d(${bar.x}px, ${bar.top}px, 0)`;
        current.style.width = `${bar.width}px`;
        if (bar.row !== lastRow) {
          lastRow = bar.row;
          if (performance.now() - lastUserScroll.current > USER_SCROLL_GRACE_MS) {
            const target = bar.top - (scroller.clientHeight - geometry.rowHeight) * 0.25;
            scroller.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
          }
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [geometry, readBeat]);

  const markUserScroll = useCallback(() => {
    lastUserScroll.current = performance.now();
  }, []);

  const barAt = useCallback(
    (clientX: number, clientY: number): number | null => {
      const content = contentRef.current;
      if (!geometry || !content) return null;
      const rect = content.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const hit = geometry.bars.find(
        (b) => x >= b.x && x < b.x + b.width && y >= b.top && y < b.top + geometry.rowHeight,
      );
      return hit?.bar ?? null;
    },
    [geometry],
  );

  const onBarPointerDown = (bar: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    drag.current = { anchor: bar, pointerId: event.pointerId, moved: false, extend: event.shiftKey };
    markUserScroll();
    if (event.pointerType === "mouse") {
      event.preventDefault();
      contentRef.current?.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    markUserScroll();
    const bar = barAt(event.clientX, event.clientY);
    if (bar === null || (bar === state.anchor && !state.moved)) return;
    state.moved = true;
    onSelectionChange(dragSelection(state.anchor, bar));
  };

  // El toque se resuelve en `pointerup`: con la captura del ratón el `click` ya no llega al botón del compás.
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.type === "pointerup" && !state.moved) {
      onSelectionChange(tapSelection(selection, state.anchor, state.extend));
    }
  };

  const onBarClick = (bar: number) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return;
    onSelectionChange(tapSelection(selection, bar, event.shiftKey));
  };

  const inRange = (range: BarRange | null | undefined, bar: number) =>
    !!range && bar >= range.startBar && bar <= range.endBar;

  return (
    <div className={cn("relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-[#f6f1e7] text-stone-900", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-300/70 px-3 py-1.5">
        <p className="min-w-0 truncate text-xs text-stone-600">
          <span className="font-semibold text-stone-900">{INSTRUMENTS[track.instrument].name}</span>
          <span className="hidden sm:inline"> · toca o arrastra compases para elegir un bucle</span>
          <span className="sm:hidden"> · toca A y luego B</span>
        </p>
        <Button
          variant="ghost"
          size="xs"
          className="shrink-0 text-stone-700 hover:bg-stone-200 hover:text-stone-900"
          aria-expanded={showLegend}
          onClick={() => setShowLegend((v) => !v)}
        >
          <BookOpen /> Leyenda
        </Button>
      </div>
      {showLegend && (
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-b border-stone-300/70 px-3 py-2">
          <ScoreLegend instrument={track.instrument} strokes={track.lanes} ready={fontsReady} />
        </div>
      )}

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingInline: PADDING_X }}
        onWheel={markUserScroll}
        onTouchMove={markUserScroll}
      >
        <div
          ref={contentRef}
          className="relative select-none"
          style={{ height: geometry?.height ?? 120 }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            ref={currentBarRef}
            className="pointer-events-none absolute top-0 left-0 rounded-md bg-amber-400/15 opacity-0"
            style={{ height: geometry?.rowHeight ?? 0 }}
            aria-hidden
          />
          <div ref={hostRef} className="pointer-events-none absolute inset-0 [&_svg]:overflow-visible" aria-hidden />
          {geometry?.bars.map((bar) => {
            const selected = inRange(selection, bar.bar);
            const active = inRange(activeRange, bar.bar);
            const section = sectionStarts.get(bar.bar);
            return (
              <button
                key={bar.bar}
                type="button"
                aria-label={`Compás ${bar.bar}${section ? `, ${section}` : ""}`}
                aria-pressed={selected}
                className={cn(
                  "absolute touch-pan-y rounded-md text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-sky-600",
                  selected ? "bg-sky-500/20 ring-1 ring-sky-600/60" : active ? "bg-amber-500/[0.07]" : "hover:bg-stone-900/5",
                )}
                style={{ left: bar.x, top: bar.top, width: bar.width, height: geometry.rowHeight }}
                onPointerDown={onBarPointerDown(bar.bar)}
                onClick={onBarClick(bar.bar)}
              >
                <span className="absolute top-0.5 left-1 flex max-w-[calc(100%-0.5rem)] items-baseline gap-1 text-[10px] leading-none">
                  <span className="text-stone-500 tabular-nums">{bar.bar}</span>
                  {section && <span className="truncate font-semibold text-stone-700">{section}</span>}
                </span>
              </button>
            );
          })}
          <div
            ref={cursorRef}
            className="pointer-events-none absolute top-0 left-0 w-[3px] rounded-full bg-amber-600 opacity-0 shadow-[0_0_8px_rgba(217,119,6,0.6)]"
            style={{ height: CURSOR_HEIGHT }}
            aria-hidden
          />
        </div>

        {!geometry && !error && (
          <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-stone-600">
            <Loader2 className="size-4 animate-spin" /> Preparando la partitura…
          </p>
        )}
        {error && (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
      {quantized.merged > 0 && (
        <p className="shrink-0 border-t border-stone-300/70 px-3 py-1 text-[11px] text-stone-600">
          {quantized.merged}           {quantized.merged === 1 ? "golpe muy cercano a otro se ha juntado" : "golpes muy cercanos a otros se han juntado"} al escribir la partitura.
        </p>
      )}
      {footer && <div className="absolute inset-x-2 bottom-2 z-30">{footer}</div>}
    </div>
  );
}

export default ScoreView;
