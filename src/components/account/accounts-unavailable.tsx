import Link from "next/link";
import { DatabaseZap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AccountsUnavailable() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <Card className="items-center py-10 text-center">
        <CardContent className="flex flex-col items-center gap-3">
          <DatabaseZap className="size-10 text-muted-foreground" aria-hidden />
          <h1 className="font-heading text-xl font-bold">Las cuentas no están activadas</h1>
          <p className="text-sm text-muted-foreground">
            Este servidor no tiene base de datos configurada (<code className="font-mono">DATABASE_URL</code>). Puedes
            seguir jugando: tus partidas se guardan en este dispositivo y podrás subirlas cuando haya cuentas.
          </p>
          <Button nativeButton={false} render={<Link href="/" />}>
            Ir a las canciones
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
