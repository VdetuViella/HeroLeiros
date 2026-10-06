"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { authClient, authErrorMessage } from "@/lib/auth-client";

import { useAccount } from "./account-provider";

export type AuthMode = "entrar" | "registro";

interface AuthFormProps {
  mode: AuthMode;
  /** Adónde ir al terminar si no hay otra cosa que hacer. */
  next: string;
  /** Si viene de un enlace de invitación, se une al grupo tras entrar o registrarse. */
  inviteCode?: string;
  /** Permite marcar «dirijo un grupo» al registrarse. */
  allowDirector?: boolean;
  /** Enlace para cambiar de modo (entrar ↔ registro). */
  switchHref?: string;
}

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok || res.status === 409, data };
}

export function AuthForm({ mode, next, inviteCode, allowDirector = false, switchHref }: AuthFormProps) {
  const router = useRouter();
  const { refreshSession } = useAccount();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirector, setIsDirector] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);

    const auth =
      mode === "entrar"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(form.get("name") ?? "").trim() });
    if (auth.error) {
      setError(authErrorMessage(auth.error));
      setPending(false);
      return;
    }

    let destination = next;
    if (inviteCode) {
      const joined = await postJson(`/api/invitations/${encodeURIComponent(inviteCode)}`);
      if (!joined.ok) setError(String(joined.data.error ?? "No se pudo unir al grupo."));
      destination = "/progreso";
    } else if (mode === "registro" && isDirector) {
      const created = await postJson("/api/groups", { name: String(form.get("group") ?? "") });
      if (!created.ok) {
        setError(String(created.data.error ?? "No se pudo crear el grupo."));
        setPending(false);
        return;
      }
      destination = "/director";
    } else if (mode === "entrar" && next === "/progreso" && auth.data?.user && "role" in auth.data.user) {
      if (auth.data.user.role === "director") destination = "/director";
    }

    refreshSession();
    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {mode === "registro" && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Nombre</Label>
          <Input id={`${id}-name`} name="name" autoComplete="name" required minLength={2} maxLength={60} placeholder="Como te llama el grupo" />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input id={`${id}-email`} name="email" type="email" autoComplete="email" required placeholder="tu@email.com" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-password`}>Contraseña</Label>
        <Input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete={mode === "entrar" ? "current-password" : "new-password"}
          required
          minLength={8}
          placeholder={mode === "registro" ? "Mínimo 8 caracteres" : undefined}
        />
      </div>

      {mode === "registro" && allowDirector && !inviteCode && (
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label htmlFor={`${id}-director`}>Dirijo un grupo</Label>
              <p className="text-xs text-muted-foreground">
                Crea el grupo, invita a los integrantes con un enlace y sigue su progreso.
              </p>
            </div>
            <Switch id={`${id}-director`} checked={isDirector} onCheckedChange={setIsDirector} />
          </div>
          {isDirector && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-group`}>Nombre del grupo</Label>
              <Input id={`${id}-group`} name="group" required minLength={2} maxLength={80} placeholder="Bloco Leiros" />
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
        {mode === "entrar" ? (inviteCode ? "Entrar y unirme" : "Entrar") : inviteCode ? "Crear cuenta y unirme" : "Crear cuenta"}
      </Button>

      {switchHref && (
        <p className="text-center text-sm text-muted-foreground">
          {mode === "entrar" ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
          <Link href={switchHref} className="font-medium text-primary underline-offset-4 hover:underline">
            {mode === "entrar" ? "Créala aquí" : "Entra"}
          </Link>
        </p>
      )}
    </form>
  );
}
