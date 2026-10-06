"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { useAccount } from "@/components/account/account-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateGroupForm() {
  const router = useRouter();
  const { refreshSession } = useAccount();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    setPending(true);
    setError(null);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "No se pudo crear el grupo.");
      setPending(false);
      return;
    }
    refreshSession();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="group-name">Nombre del grupo</Label>
        <Input id="group-name" name="name" required minLength={2} maxLength={80} placeholder="Bloco Leiros" />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
        Crear grupo
      </Button>
    </form>
  );
}
