"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Headphones, Loader2, Mic, Timer, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MicInput, listMicrophones, toMicError } from "@/lib/mic/mic-input";
import { REFRACTORY_RANGE, detectorSettingsFrom, type MicPreferences } from "@/lib/mic/settings";

import { MicLevelMeter } from "./mic-level-meter";

const NOISE_SECONDS = 3;

type Status = "apagado" | "abriendo" | "activo" | "error";

interface Monitor {
  context: AudioContext;
  mic: MicInput;
}

interface MicSetupProps {
  prefs: MicPreferences;
  onChange: (patch: Partial<MicPreferences>) => void;
  latencyMs: number;
}

/**
 * Prueba y ajuste del micrófono antes de jugar: permiso, dispositivo, nivel,
 * ruido de la sala, sensibilidad y aviso de auriculares. Usa su propio
 * `AudioContext`, que se cierra al salir.
 */
export function MicSetup({ prefs, onChange, latencyMs }: MicSetupProps) {
  const [status, setStatus] = useState<Status>("apagado");
  const [error, setError] = useState<string | null>(null);
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [hits, setHits] = useState(0);
  const [measuring, setMeasuring] = useState(false);
  const prefsRef = useRef(prefs);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    if (!monitor) return;
    return () => {
      monitor.mic.close();
      void monitor.context.close();
    };
  }, [monitor]);

  useEffect(() => {
    monitor?.mic.configure(detectorSettingsFrom(prefs));
  }, [monitor, prefs]);

  const activate = useCallback(async (deviceId: string | null) => {
    setStatus("abriendo");
    setError(null);
    setMonitor(null);
    const context = new AudioContext({ latencyHint: "interactive" });
    try {
      await context.resume();
      const settings = detectorSettingsFrom(prefsRef.current);
      let mic: MicInput;
      try {
        mic = await MicInput.open(context, { deviceId, settings });
      } catch (cause) {
        // El micrófono guardado ya no está: se vuelve al predeterminado.
        if (!deviceId || toMicError(cause).code !== "sin-dispositivo") throw cause;
        mic = await MicInput.open(context, { deviceId: null, settings });
      }
      setHits(0);
      setMonitor({ context, mic });
      setStatus("activo");
      setDevices(await listMicrophones());
    } catch (cause) {
      void context.close();
      setError(toMicError(cause).message);
      setStatus("error");
    }
  }, []);

  const measureNoise = async () => {
    if (!monitor) return;
    setMeasuring(true);
    setError(null);
    try {
      const noise = await monitor.mic.measureNoise(NOISE_SECONDS);
      onChange({ noise: { floorDb: Math.round(noise.floorDb * 10) / 10, flux: noise.flux } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo medir el ruido.");
    } finally {
      setMeasuring(false);
    }
  };

  const deviceItems = devices.map((device, index) => ({
    value: device.deviceId,
    label: device.label || `Micrófono ${index + 1}`,
  }));
  const currentDevice = monitor?.mic.deviceId ?? prefs.deviceId ?? deviceItems[0]?.value ?? "";

  return (
    <div className="space-y-4">
      <HeadphonesNotice confirmed={prefs.headphones} onConfirm={(headphones) => onChange({ headphones })} />

      {status !== "activo" && (
        <div className="space-y-3 rounded-xl bg-muted/40 p-3 text-sm">
          <p className="text-muted-foreground">
            HeroLeiros escucha tu instrumento y juzga solo <strong className="text-foreground">cuándo</strong> tocas: cualquier
            golpe vale para cualquier carril. Prueba aquí el micrófono antes de empezar.
          </p>
          <Button onClick={() => void activate(prefs.deviceId)} disabled={status === "abriendo"}>
            {status === "abriendo" ? <Loader2 className="animate-spin" /> : <Mic />}
            {status === "abriendo" ? "Abriendo micrófono…" : status === "error" ? "Reintentar" : "Probar el micrófono"}
          </Button>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {monitor && status === "activo" && (
        <div className="space-y-4">
          {deviceItems.length > 1 && (
            <div className="space-y-1.5">
              <Label>Micrófono</Label>
              <Select
                items={deviceItems}
                value={currentDevice}
                onValueChange={(value) => {
                  if (!value || value === currentDevice) return;
                  onChange({ deviceId: value });
                  void activate(value);
                }}
              >
                <SelectTrigger className="w-full" aria-label="Micrófono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {deviceItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <Label>Nivel</Label>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {hits === 0 ? "Da unos golpes para probar" : `${hits} golpe${hits === 1 ? "" : "s"} detectado${hits === 1 ? "" : "s"}`}
              </span>
            </div>
            <MicLevelMeter mic={monitor.mic} onHit={() => setHits((n) => n + 1)} />
            <p className="text-xs text-muted-foreground">
              La línea amarilla es el umbral: cada golpe tiene que pasarla. Si se enciende el punto sin tocar, baja la
              sensibilidad o mide el ruido.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-3">
            <div className="text-sm">
              <p className="font-medium">Ruido de la sala</p>
              <p className="text-xs text-muted-foreground">
                {prefs.noise ? `${prefs.noise.floorDb.toFixed(1)} dB · medido` : "Sin medir: se supone una sala tranquila."}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void measureNoise()} disabled={measuring}>
              {measuring ? <Loader2 className="animate-spin" /> : <Waves />}
              {measuring ? `Silencio… (${NOISE_SECONDS} s)` : "Medir ruido"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Sensibilidad</Label>
          <span className="text-sm tabular-nums">{Math.round(prefs.sensitivity * 100)} %</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={5}
          value={Math.round(prefs.sensitivity * 100)}
          onValueChange={(value) => onChange({ sensitivity: (Array.isArray(value) ? value[0] : value) / 100 })}
          aria-label="Sensibilidad del micrófono"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Solo golpes fuertes</span>
          <span>Muy sensible</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Tiempo mínimo entre golpes</Label>
          <span className="text-sm tabular-nums">{prefs.refractoryMs} ms</span>
        </div>
        <Slider
          min={REFRACTORY_RANGE.min}
          max={REFRACTORY_RANGE.max}
          step={5}
          value={prefs.refractoryMs}
          onValueChange={(value) => onChange({ refractoryMs: Array.isArray(value) ? value[0] : value })}
          aria-label="Tiempo mínimo entre golpes en milisegundos"
        />
        <p className="text-xs text-muted-foreground">Súbelo si un solo golpe cuenta doble (eco, parche que vibra).</p>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Timer className="size-3.5" />
        Latencia del micrófono: {latencyMs} ms ·{" "}
        <Link href="/calibracion?entrada=microfono" className="underline underline-offset-2 hover:text-foreground">
          calibrar con un clic de prueba
        </Link>
      </p>
    </div>
  );
}

export function HeadphonesNotice({ confirmed, onConfirm }: { confirmed: boolean; onConfirm: (value: boolean) => void }) {
  return (
    <div
      className={
        confirmed
          ? "flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3"
          : "flex items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3"
      }
    >
      <div className="flex items-start gap-2 text-sm">
        <Headphones className={confirmed ? "mt-0.5 size-4 shrink-0 text-muted-foreground" : "mt-0.5 size-4 shrink-0 text-amber-300"} />
        <div>
          <p className="font-medium">{confirmed ? "Con auriculares" : "Usa auriculares"}</p>
          <p className="text-xs text-muted-foreground">
            {confirmed
              ? "El acompañamiento no llegará al micrófono."
              : "Si el acompañamiento sale por los altavoces, el micrófono lo oirá y contará golpes que no has dado. Mejor con cable: los Bluetooth añaden mucho retraso."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Label htmlFor="auriculares" className="text-xs">
          Los llevo
        </Label>
        <Switch id="auriculares" checked={confirmed} onCheckedChange={onConfirm} />
      </div>
    </div>
  );
}
