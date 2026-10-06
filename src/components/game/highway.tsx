"use client";

import { useEffect, useRef } from "react";

import { STROKES } from "@/lib/chart/instruments";
import type { StrokeId } from "@/lib/chart/types";
import type { NoteState } from "@/lib/judge/types";
import type { FeedbackEvent, GameSession } from "@/lib/session/game-session";

/** Segundos visibles por encima de la línea de golpeo. */
const LOOKAHEAD_SECONDS = 1.6;
const HIT_LINE_RATIO = 0.84;
const HIT_BURST_SECONDS = 0.28;
const PRESS_GLOW_SECONDS = 0.12;
const LABEL_SECONDS = 0.5;

const JUDGEMENT_STYLE = {
  perfecto: { text: "¡Perfecto!", color: "#fbbf24" },
  bien: { text: "Bien", color: "#4ade80" },
  regular: { text: "Regular", color: "#38bdf8" },
  fallo: { text: "Fallo", color: "#f87171" },
  "carril-equivocado": { text: "Otro carril", color: "#fb923c" },
  "golpe-de-mas": { text: "De más", color: "#a1a1aa" },
} as const;

interface HighwayProps {
  session: GameSession;
  lanes: StrokeId[];
  keyLabels: string[];
}

export function Highway({ session, lanes, keyLabels }: HighwayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = wrapper.clientWidth;
      height = wrapper.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);

    let frame = 0;
    const loop = () => {
      drawHighway(ctx, width, height, session, lanes, keyLabels);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [session, lanes, keyLabels]);

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Carril de notas: las notas bajan hacia la línea de golpeo"
      />
    </div>
  );
}

function drawHighway(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  session: GameSession,
  lanes: StrokeId[],
  keyLabels: string[],
) {
  const t = session.now();
  const { plan } = session;
  const hitY = height * HIT_LINE_RATIO;
  const pps = hitY / LOOKAHEAD_SECONDS;
  const pastSeconds = (height - hitY) / pps;
  const laneWidth = width / lanes.length;
  const yOf = (time: number) => hitY - (time - t) * pps;

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "rgba(20, 16, 36, 0.2)");
  bg.addColorStop(1, "rgba(20, 16, 36, 0.95)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  lanes.forEach((stroke, lane) => {
    const x = lane * laneWidth;
    const color = STROKES[stroke].color;
    const laneGradient = ctx.createLinearGradient(0, 0, 0, hitY);
    laneGradient.addColorStop(0, withAlpha(color, 0));
    laneGradient.addColorStop(1, withAlpha(color, 0.1));
    ctx.fillStyle = laneGradient;
    ctx.fillRect(x + 2, 0, laneWidth - 4, hitY);

    const sincePress = t - session.lastPress[lane];
    if (sincePress >= 0 && sincePress < PRESS_GLOW_SECONDS) {
      const alpha = 0.45 * (1 - sincePress / PRESS_GLOW_SECONDS);
      const glow = ctx.createLinearGradient(0, hitY - 160, 0, hitY);
      glow.addColorStop(0, withAlpha(color, 0));
      glow.addColorStop(1, withAlpha(color, alpha));
      ctx.fillStyle = glow;
      ctx.fillRect(x + 2, hitY - 160, laneWidth - 4, 160);
    }

    if (lane > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(x - 0.5, 0, 1, height);
    }
  });

  const spb = plan.secondsPerBeat;
  const lastLine = plan.loop ? Infinity : plan.countInSeconds + plan.passSeconds;
  const firstBeat = Math.max(0, Math.floor((t - pastSeconds) / spb));
  const lastBeat = Math.ceil((t + LOOKAHEAD_SECONDS) / spb);
  for (let k = firstBeat; k <= lastBeat; k++) {
    const time = k * spb;
    if (time > lastLine + 1e-6) break;
    const isBar = k % plan.beatsPerBar === 0;
    ctx.fillStyle = isBar ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.07)";
    ctx.fillRect(0, yOf(time) - (isBar ? 1 : 0.5), width, isBar ? 2 : 1);
  }

  const notes = session.judge.notes;
  for (let i = firstVisible(notes, t - pastSeconds - HIT_BURST_SECONDS); i < notes.length; i++) {
    const state = notes[i];
    if (state.note.time > t + LOOKAHEAD_SECONDS + 0.1) break;
    drawNote(ctx, state, t, lanes, laneWidth, yOf, hitY);
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(0, hitY - 1.5, width, 3);
  lanes.forEach((stroke, lane) => {
    const cx = lane * laneWidth + laneWidth / 2;
    const color = STROKES[stroke].color;
    ctx.lineWidth = 3;
    ctx.strokeStyle = withAlpha(color, 0.9);
    roundRect(ctx, cx - laneWidth * 0.36, hitY - 13, laneWidth * 0.72, 26, 13);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(keyLabels[lane] ?? "", cx, hitY + (height - hitY) / 2 + 4);
  });

  drawFeedback(ctx, session.feedback, t, laneWidth, hitY);
}

function drawNote(
  ctx: CanvasRenderingContext2D,
  state: NoteState,
  t: number,
  lanes: StrokeId[],
  laneWidth: number,
  yOf: (time: number) => number,
  hitY: number,
) {
  const { note, result } = state;
  const stroke = lanes[note.lane];
  if (!stroke) return;
  const color = STROKES[stroke].color;
  const cx = note.lane * laneWidth + laneWidth / 2;
  const w = laneWidth * (note.accent ? 0.7 : 0.6);
  const h = note.accent ? 22 : 16;

  if (result && result !== "fallo") {
    const since = t - (state.resolvedAt ?? note.time);
    if (since < 0 || since > HIT_BURST_SECONDS) return;
    const progress = since / HIT_BURST_SECONDS;
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4 * (1 - progress) + 1;
    roundRect(ctx, cx - w / 2 - progress * 18, hitY - h / 2 - progress * 14, w + progress * 36, h + progress * 28, 12);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  const y = yOf(note.time);
  ctx.globalAlpha = result === "fallo" ? 0.28 : 1;
  ctx.fillStyle = result === "fallo" ? "#71717a" : color;
  ctx.shadowColor = result === "fallo" ? "transparent" : withAlpha(color, 0.7);
  ctx.shadowBlur = 14;
  roundRect(ctx, cx - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (note.accent && result !== "fallo") {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, cx - w / 2 + 6, y - h / 2 + 3, w - 12, h / 3, h / 6);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawFeedback(
  ctx: CanvasRenderingContext2D,
  feedback: FeedbackEvent[],
  t: number,
  laneWidth: number,
  hitY: number,
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const { event, at } of feedback) {
    const since = t - at;
    if (since < 0 || since > LABEL_SECONDS) continue;
    let lane: number | null;
    let style: { text: string; color: string };
    switch (event.kind) {
      case "acierto":
        lane = event.note.lane;
        style = JUDGEMENT_STYLE[event.judgement];
        break;
      case "fallo":
        lane = event.note.lane;
        style = JUDGEMENT_STYLE.fallo;
        break;
      case "carril-equivocado":
        lane = event.lane;
        style = JUDGEMENT_STYLE["carril-equivocado"];
        break;
      case "golpe-de-mas":
        lane = event.lane;
        style = JUDGEMENT_STYLE["golpe-de-mas"];
        break;
      default: {
        const exhaustive: never = event;
        throw new Error(`Evento desconocido: ${JSON.stringify(exhaustive)}`);
      }
    }
    if (lane === null) continue;
    const progress = since / LABEL_SECONDS;
    ctx.globalAlpha = 1 - progress * progress;
    ctx.fillStyle = style.color;
    ctx.font = `800 ${event.kind === "acierto" && event.judgement === "perfecto" ? 18 : 15}px system-ui, sans-serif`;
    ctx.fillText(style.text, lane * laneWidth + laneWidth / 2, hitY - 40 - progress * 30);
  }
  ctx.globalAlpha = 1;
}

function firstVisible(notes: readonly NoteState[], time: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].note.time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}

function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
