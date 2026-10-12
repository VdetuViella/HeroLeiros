"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { STROKES, strokeLabel } from "@/lib/chart/instruments";
import type { InstrumentId, StrokeId } from "@/lib/chart/types";
import type { MicInput } from "@/lib/mic/mic-input";
import { strokeProfileFor, type MicPreferences, type MicPreferencesUpdate } from "@/lib/mic/settings";
import { MIN_SAMPLES_PER_LANE, StrokeClassifier, addSample, isProfileReady } from "@/lib/mic/stroke-classifier";

/** Golpes que se graban cada vez que se pulsa «Grabar». */
const TAKE_SIZE = 6;

interface StrokeTrainerProps {
  mic: MicInput | null;
  instrument: InstrumentId;
  lanes: StrokeId[];
  prefs: MicPreferences;
  onChange: (update: MicPreferencesUpdate) => void;
}

/**
 * Fase B (experimental): el jugador graba unos golpes de cada tipo y la
 * partida intenta llevar cada golpe a su carril.
 */
export function StrokeTrainer({ mic, instrument, lanes, prefs, onChange }: StrokeTrainerProps) {
  const [recording, setRecordingState] = useState<{ lane: number; left: number } | null>(null);
  const [lastGuess, setLastGuess] = useState<{ lane: number; confidence: number } | null>(null);
  const profile = strokeProfileFor(prefs, instrument, lanes);
  const ready = isProfileReady(profile, lanes.length);
  const classifier = useMemo(() => (ready ? new StrokeClassifier(profile) : null), [ready, profile]);

  // Los golpes pueden llegar antes de volver a pintar: la toma se lee de una ref
  // y cada ejemplo se añade sobre las preferencias actuales.
  const recordingRef = useRef(recording);
  const setRecording = useCallback((next: { lane: number; left: number } | null) => {
    recordingRef.current = next;
    setRecordingState(next);
  }, []);

  useEffect(() => {
    if (!mic || !prefs.classifyStrokes) return;
    return mic.onFeatures(({ features }) => {
      const take = recordingRef.current;
      if (take) {
        onChange((current) => {
          const next = addSample(strokeProfileFor(current, instrument, lanes), take.lane, features);
          return { strokeProfiles: { ...current.strokeProfiles, [instrument]: { strokes: [...lanes], samples: next.samples } } };
        });
        setRecording(take.left > 1 ? { lane: take.lane, left: take.left - 1 } : null);
      } else if (classifier) {
        setLastGuess(classifier.classify(features));
      }
    });
  }, [mic, prefs.classifyStrokes, instrument, lanes, classifier, onChange, setRecording]);

  if (lanes.length < 2) return null;

  const clear = () => {
    onChange((current) => {
      const rest = { ...current.strokeProfiles };
      delete rest[instrument];
      return { strokeProfiles: rest };
    });
    setLastGuess(null);
    setRecording(null);
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="distinguir-golpes">Distinguir golpes (experimental)</Label>
          <p className="text-xs text-muted-foreground">Enseña tus golpes y cada uno irá a su carril.</p>
        </div>
        <Switch
          id="distinguir-golpes"
          checked={prefs.classifyStrokes}
          onCheckedChange={(classifyStrokes) => {
            onChange({ classifyStrokes });
            setRecording(null);
          }}
        />
      </div>

      {prefs.classifyStrokes && (
        <>
          {!mic && <p className="text-xs text-amber-300">Pulsa «Probar el micrófono» para grabar tus golpes.</p>}
          <ul className="space-y-1.5">
            {lanes.map((stroke, lane) => {
              const count = profile.samples[lane]?.length ?? 0;
              const isRecording = recording?.lane === lane;
              const guessed = lastGuess?.lane === lane;
              return (
                <li
                  key={stroke}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5 transition-colors data-[guess=true]:bg-primary/20"
                  data-guess={guessed}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: STROKES[stroke].color }} aria-hidden />
                    {strokeLabel(instrument, stroke)}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {count >= MIN_SAMPLES_PER_LANE ? <Check className="inline size-3.5 text-green-400" /> : `${count}/${MIN_SAMPLES_PER_LANE}`}
                    </span>
                  </span>
                  <Button
                    size="xs"
                    variant={isRecording ? "default" : "outline"}
                    disabled={!mic || (recording !== null && !isRecording)}
                    onClick={() => setRecording(isRecording ? null : { lane, left: TAKE_SIZE })}
                  >
                    <Circle className={isRecording ? "fill-current" : undefined} />
                    {isRecording ? `Toca ${recording.left}…` : "Grabar"}
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span>
              {ready
                ? lastGuess
                  ? `Último golpe: ${strokeLabel(instrument, lanes[lastGuess.lane])} (${Math.round(lastGuess.confidence * 100)} % de margen)`
                  : "Listo. Toca para comprobar qué golpe reconoce."
                : `Graba al menos ${MIN_SAMPLES_PER_LANE} golpes de cada tipo. Mientras, se juzga solo el tiempo.`}
            </span>
            <Button variant="ghost" size="xs" onClick={clear} disabled={profile.samples.every((s) => s.length === 0)}>
              <Trash2 /> Borrar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
