"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertCircle, Check, CloudOff, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  INITIAL_OFFLINE_SNAPSHOT,
  RepertoireDownload,
  browserOfflineEnvironment,
  type OfflineSnapshot,
} from "@/lib/offline/repertoire";

const serverSnapshot = (): OfflineSnapshot => INITIAL_OFFLINE_SNAPSHOT;

/**
 * Botón para guardar todas las canciones (y las grabaciones reales) en el
 * dispositivo y poder ensayar sin conexión.
 */
export function OfflineDownload({ slugs }: { slugs: string[] }) {
  const [store] = useState(() => new RepertoireDownload(slugs, browserOfflineEnvironment));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);

  useEffect(() => {
    void store.check();
    return () => store.dispose();
  }, [store]);

  if (slugs.length === 0 || snapshot.status === "sin-soporte") return null;

  const { status, done, total, failed } = snapshot;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
      data-testid="sin-conexion"
      data-estado={status}
    >
      <div className="flex min-w-0 items-start gap-2">
        {status === "listo" ? (
          <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        ) : status === "incompleto" ? (
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
        ) : (
          <CloudOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <p className="min-w-0" aria-live="polite">
          {status === "comprobando" && <span className="text-muted-foreground">Comprobando si puedes ensayar sin conexión…</span>}
          {status === "pendiente" && (
            <>
              <span className="font-medium">Ensaya sin conexión.</span>{" "}
              <span className="text-muted-foreground">Guarda las canciones en este dispositivo para tocarlas sin red.</span>
            </>
          )}
          {status === "descargando" && (
            <span className="text-muted-foreground">
              Descargando… {total > 0 ? `${done} de ${total} archivos` : ""}
            </span>
          )}
          {status === "listo" && (
            <>
              <span className="font-medium">Listo para ensayar sin conexión.</span>{" "}
              <span className="text-muted-foreground">Si el director añade canciones, vuelve a descargar.</span>
            </>
          )}
          {status === "incompleto" && (
            <>
              <span className="font-medium">La descarga no se completó.</span>{" "}
              <span className="text-muted-foreground">
                {failed > 0
                  ? `${failed === 1 ? "Falta 1 archivo" : `Faltan ${failed} archivos`}. Comprueba la conexión y reinténtalo.`
                  : "Recarga la página y reinténtalo."}
              </span>
            </>
          )}
        </p>
      </div>

      {status === "descargando" ? (
        <div className="flex shrink-0 items-center gap-2 sm:w-48">
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
          <Progress value={percent} className="flex-1" aria-label="Progreso de la descarga" />
        </div>
      ) : (
        status !== "comprobando" && (
          <Button
            size="sm"
            variant={status === "pendiente" ? "default" : "outline"}
            className="shrink-0 self-start sm:self-auto"
            onClick={() => void store.download()}
          >
            <RefreshCw />
            {status === "pendiente" ? "Descargar para ensayar sin conexión" : status === "listo" ? "Actualizar" : "Reintentar"}
          </Button>
        )
      )}
    </div>
  );
}
