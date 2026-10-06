"use client";

import { useEffect, useRef, useState } from "react";

import type { MicInput, MicLevelEvent } from "@/lib/mic/mic-input";
import { cn } from "@/lib/utils";

const MIN_DB = -80;

const toPercent = (db: number) => Math.min(100, Math.max(0, ((db - MIN_DB) / -MIN_DB) * 100));

interface MicLevelMeterProps {
  mic: MicInput;
  className?: string;
  /** Se llama con cada golpe detectado. */
  onHit?: () => void;
}

/**
 * Nivel del micrófono con la puerta del detector marcada: lo que pasa la
 * línea puede contar como golpe. El punto se enciende con cada golpe.
 */
export function MicLevelMeter({ mic, className, onHit }: MicLevelMeterProps) {
  const [level, setLevel] = useState<MicLevelEvent | null>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const onHitRef = useRef(onHit);

  useEffect(() => {
    onHitRef.current = onHit;
  }, [onHit]);

  useEffect(() => {
    const offLevel = mic.onLevel(setLevel);
    const offOnset = mic.onOnset(() => {
      onHitRef.current?.();
      dotRef.current?.animate(
        [
          { opacity: 1, transform: "scale(1.5)" },
          { opacity: 0.2, transform: "scale(1)" },
        ],
        { duration: 450, easing: "ease-out", fill: "forwards" },
      );
    });
    return () => {
      offLevel();
      offOnset();
    };
  }, [mic]);

  const levelDb = level?.levelDb ?? MIN_DB;
  const gateDb = level?.gateDb ?? -45;
  const over = levelDb > gateDb;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        ref={dotRef}
        className="size-3.5 shrink-0 rounded-full bg-primary opacity-20 shadow-[0_0_12px_var(--color-primary)]"
        aria-hidden
      />
      <div
        className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Nivel del micrófono"
        aria-valuemin={MIN_DB}
        aria-valuemax={0}
        aria-valuenow={Math.round(levelDb)}
        aria-valuetext={`${Math.round(levelDb)} dB`}
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-75", over ? "bg-primary" : "bg-muted-foreground/50")}
          style={{ width: `${toPercent(levelDb)}%` }}
        />
        <div className="absolute inset-y-0 w-0.5 bg-amber-300" style={{ left: `${toPercent(gateDb)}%` }} title="Umbral de golpe" />
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {level?.calibrating ? "midiendo" : `${Math.round(levelDb)} dB`}
      </span>
    </div>
  );
}
