"use client";

import { usePathname } from "next/navigation";
import { CloudUpload } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useAccount } from "./account-provider";

/** Ofrece subir a la cuenta las partidas guardadas en este dispositivo (p. ej. jugadas sin sesión). */
export function UnsyncedBanner() {
  const { user, unsynced, uploadUnsynced, dismissUnsynced } = useAccount();
  const pathname = usePathname();

  // Durante la partida no se interrumpe al jugador.
  if (!user || unsynced.length === 0 || pathname.startsWith("/canciones/")) return null;

  const count = unsynced.length;
  return (
    <div className="border-b border-primary/30 bg-primary/10" role="region" aria-label="Partidas sin subir">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2 text-sm">
          <CloudUpload className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            Tienes <strong>{count === 1 ? "1 partida" : `${count} partidas`}</strong> guardadas solo en este
            dispositivo. ¿Las subimos a tu cuenta para que cuenten en tu progreso?
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={uploadUnsynced}>
            Subir a mi cuenta
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissUnsynced}>
            Dejarlas solo aquí
          </Button>
        </div>
      </div>
    </div>
  );
}
