"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { InstrumentId } from "@/lib/chart/types";
import {
  AccentDetector,
  MIN_ACCENT_SAMPLES,
  addAccentSample,
  analyzeAccentProfile,
  emptyAccentProfile,
  type AccentKind,
  type AccentProfile,
} from "@/lib/mic/accent";
import type { MicInput } from "@/lib/mic/mic-input";
import type { MicPreferences, MicPreferencesUpdate } from "@/lib/mic/settings";

/** Golpes que se graban cada vez que se pulsa «Grabar». */
const TAKE_SIZE = 6;

const ROWS: { kind: AccentKind; label: string; hint: string }[] = [
  { kind: "normal", label: "Golpes normales", hint: "Como tocas la mayoría de las notas." },
  { kind: "acento", label: "Golpes acentuados", hint: "Con la fuerza de un acento de verdad." },
];

interface AccentTrainerProps {
  mic: MicInput | null;
  instrument: InstrumentId;
  prefs: MicPreferences;
  onChange: (update: MicPreferencesUpdate) => void;
}

const EMPTY_PROFILE: AccentProfile = emptyAccentProfile();

const samplesOf = (profile: AccentProfile, kind: AccentKind) => (kind === "acento" ? profile.accented : profile.normal);
const formatDb = (db: number) => `${Math.round(db)} dB`;

/**
 * Calibra la fuerza de los golpes normales y acentuados para que la partida
 * pueda juzgar los acentos de la partitura con el micrófono.
 */
export function AccentTrainer({ mic, instrument, prefs, onChange }: AccentTrainerProps) {
  const [recording, setRecordingState] = useState<{ kind: AccentKind; left: number } | null>(null);
  const [lastStrike, setLastStrike] = useState<number | null>(null);
  const profile = prefs.accentProfiles[instrument] ?? EMPTY_PROFILE;
  const analysis = analyzeAccentProfile(profile);
  const detector = useMemo(() => AccentDetector.fromProfile(profile), [profile]);

  // Los golpes pueden llegar más deprisa de lo que se vuelve a pintar: la toma
  // en curso se lee de una ref y cada muestra se añade sobre las preferencias
  // actuales (actualización en forma de función), así no se pisan.
  const recordingRef = useRef(recording);
  const setRecording = useCallback((next: { kind: AccentKind; left: number } | null) => {
    recordingRef.current = next;
    setRecordingState(next);
  }, []);

  useEffect(() => {
    if (!mic || !prefs.detectAccents) return;
    return mic.onFeatures(({ strikeDb }) => {
      if (strikeDb === null) return;
      setLastStrike(strikeDb);
      const take = recordingRef.current;
      if (!take) return;
      onChange((current) => ({
        accentProfiles: {
          ...current.accentProfiles,
          [instrument]: addAccentSample(current.accentProfiles[instrument] ?? EMPTY_PROFILE, take.kind, strikeDb),
        },
      }));
      setRecording(take.left > 1 ? { kind: take.kind, left: take.left - 1 } : null);
    });
  }, [mic, prefs.detectAccents, instrument, onChange, setRecording]);

  const clear = () => {
    onChange((current) => {
      const rest = { ...current.accentProfiles };
      delete rest[instrument];
      return { accentProfiles: rest };
    });
    setRecording(null);
    setLastStrike(null);
  };

  const lastIsAccent = detector && lastStrike !== null ? detector.isAccent(lastStrike) : null;

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-3" data-testid="calibrar-acentos">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="detectar-acentos">Detectar acentos</Label>
          <p className="text-xs text-muted-foreground">
            Graba unos golpes normales y otros acentuados: la partida te dirá si das los acentos de la partitura.
          </p>
        </div>
        <Switch
          id="detectar-acentos"
          checked={prefs.detectAccents}
          onCheckedChange={(detectAccents) => {
            onChange({ detectAccents });
            setRecording(null);
          }}
        />
      </div>

      {prefs.detectAccents && (
        <>
          {!mic && <p className="text-xs text-amber-300">Pulsa «Probar el micrófono» para grabar tus golpes.</p>}
          <p className="text-xs text-muted-foreground">
            Pon el micrófono donde lo vayas a tener al tocar: si cambias de sitio o de micrófono, vuelve a calibrar.
          </p>
          <ul className="space-y-1.5">
            {ROWS.map(({ kind, label, hint }) => {
              const count = samplesOf(profile, kind).length;
              const isRecording = recording?.kind === kind;
              return (
                <li key={kind} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
                  <span className="min-w-0 text-sm">
                    <span className="flex items-center gap-2">
                      {label}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {count >= MIN_ACCENT_SAMPLES ? <Check className="inline size-3.5 text-green-400" /> : `${count}/${MIN_ACCENT_SAMPLES}`}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                  <Button
                    size="xs"
                    variant={isRecording ? "default" : "outline"}
                    disabled={!mic || (recording !== null && !isRecording)}
                    onClick={() => setRecording(isRecording ? null : { kind, left: TAKE_SIZE })}
                  >
                    <Circle className={isRecording ? "fill-current" : undefined} />
                    {isRecording ? `Toca ${recording.left}…` : "Grabar"}
                  </Button>
                </li>
              );
            })}
          </ul>

          {analysis.status !== "faltan-golpes" && (
            <StrikeScale profile={profile} thresholdDb={analysis.status === "listo" ? analysis.thresholdDb : null} lastStrike={lastStrike} />
          )}

          <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span>
              {analysis.status === "faltan-golpes" &&
                `Graba al menos ${MIN_ACCENT_SAMPLES} golpes de cada tipo. Mientras, no se juzgan los acentos.`}
              {analysis.status === "sin-diferencia" && (
                <span className="text-amber-300">
                  Los acentos suenan casi igual que los golpes normales (solo {analysis.separationDb.toFixed(1)} dB de
                  diferencia). Marca más la diferencia o acerca el micrófono, y vuelve a grabar.
                </span>
              )}
              {analysis.status === "listo" &&
                (lastIsAccent === null
                  ? `Listo: los acentos suenan ${analysis.separationDb.toFixed(1)} dB más fuertes. Toca para comprobarlo.`
                  : `Último golpe: ${lastIsAccent ? "acento" : "normal"} (${formatDb(lastStrike ?? 0)}).`)}
              {analysis.status === "listo" && analysis.agreement < 0.85 && (
                <span className="block text-amber-300">
                  Algunos golpes de la calibración quedan del lado contrario: los acentos se juzgarán con dudas.
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={clear}
              disabled={profile.normal.length === 0 && profile.accented.length === 0}
            >
              <Trash2 /> Borrar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Dónde caen los golpes grabados, el umbral y el último golpe, en una escala de dB. */
function StrikeScale({
  profile,
  thresholdDb,
  lastStrike,
}: {
  profile: AccentProfile;
  thresholdDb: number | null;
  lastStrike: number | null;
}) {
  const all = [...profile.normal, ...profile.accented, ...(lastStrike === null ? [] : [lastStrike])];
  const min = Math.min(...all) - 3;
  const max = Math.max(...all) + 3;
  const at = (db: number) => `${(((db - min) / (max - min)) * 100).toFixed(1)}%`;

  return (
    <div className="space-y-1" aria-hidden>
      <div className="relative h-6 rounded-md bg-muted/60">
        {thresholdDb !== null && (
          <>
            <div className="absolute inset-y-0 right-0 rounded-r-md bg-primary/10" style={{ left: at(thresholdDb) }} />
            <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: at(thresholdDb) }} />
          </>
        )}
        {profile.normal.map((db, i) => (
          <span key={`n${i}`} className="absolute top-1.5 size-3 -translate-x-1/2 rounded-full bg-sky-400/80" style={{ left: at(db) }} />
        ))}
        {profile.accented.map((db, i) => (
          <span key={`a${i}`} className="absolute top-1.5 size-3 -translate-x-1/2 rounded-full bg-amber-400/90" style={{ left: at(db) }} />
        ))}
        {lastStrike !== null && (
          <span
            className="absolute -top-1 h-8 w-1 -translate-x-1/2 rounded-full bg-foreground transition-[left] duration-150"
            style={{ left: at(lastStrike) }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-sky-400/80" /> Normal
        </span>
        {thresholdDb !== null && <span>Umbral {formatDb(thresholdDb)}</span>}
        <span className="flex items-center gap-1">
          Acento <span className="size-2 rounded-full bg-amber-400/90" />
        </span>
      </div>
    </div>
  );
}
