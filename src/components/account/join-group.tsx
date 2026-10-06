"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Loader2, UserPlus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AuthForm } from "./auth-form";

export function JoinGroupButton({ code, groupName }: { code: string; groupName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/invitations/${encodeURIComponent(code)}`, { method: "POST" });
    if (res.ok) {
      router.push("/progreso");
      router.refresh();
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "No se pudo unir al grupo.");
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" onClick={join} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden /> : <UserPlus data-icon="inline-start" aria-hidden />}
        Unirme a {groupName}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function JoinWithAccount({ code }: { code: string }) {
  return (
    <Tabs defaultValue="registro">
      <TabsList className="mb-4 w-full">
        <TabsTrigger value="registro">Soy nuevo</TabsTrigger>
        <TabsTrigger value="entrar">Ya tengo cuenta</TabsTrigger>
      </TabsList>
      <TabsContent value="registro">
        <AuthForm mode="registro" next="/progreso" inviteCode={code} />
      </TabsContent>
      <TabsContent value="entrar">
        <AuthForm mode="entrar" next="/progreso" inviteCode={code} />
      </TabsContent>
    </Tabs>
  );
}
