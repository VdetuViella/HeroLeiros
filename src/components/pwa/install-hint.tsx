"use client";

import { useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function subscribe() {
  return () => undefined;
}

function readHint(): boolean {
  return isIos() && !isStandalone();
}

/** Aviso breve para instalar en iOS; en el resto de móviles el navegador ofrece el diálogo nativo. */
export function InstallHint() {
  const show = useSyncExternalStore(subscribe, readHint, () => false);

  if (!show) return null;

  return (
    <p className="flex items-start gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground">
      <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span>
        Para instalar HeroLeiros en el iPhone o iPad: comparte esta página y elige{" "}
        <span className="font-medium text-foreground">Añadir a pantalla de inicio</span>.
      </span>
    </p>
  );
}
