"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteLink({ groupId, url }: { groupId: string; url: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar: selecciona el enlace y cópialo a mano.");
    }
  }

  async function regenerate() {
    if (!window.confirm("El enlace actual dejará de funcionar. ¿Crear uno nuevo?")) return;
    setRegenerating(true);
    setError(null);
    const res = await fetch(`/api/groups/${groupId}/invite`, { method: "POST" });
    setRegenerating(false);
    if (!res.ok) {
      setError("No se pudo cambiar el enlace. Inténtalo de nuevo.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          aria-label="Enlace de invitación"
          className="font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button variant="secondary" onClick={copy} aria-live="polite">
          {copied ? <Check data-icon="inline-start" aria-hidden /> : <Copy data-icon="inline-start" aria-hidden />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button variant="ghost" size="icon" onClick={regenerate} disabled={regenerating} aria-label="Crear un enlace nuevo">
          {regenerating ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
