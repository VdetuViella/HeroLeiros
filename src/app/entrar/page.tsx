import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountsUnavailable } from "@/components/account/accounts-unavailable";
import { AuthForm } from "@/components/account/auth-form";
import { AuthShell } from "@/components/account/auth-shell";
import { isDatabaseConfigured } from "@/server/db/client";
import { getCurrentUser, safeNext } from "@/server/current-user";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  if (!isDatabaseConfigured()) return <AccountsUnavailable />;
  const next = safeNext((await searchParams).volver, "/progreso");
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthShell
      title="Entrar"
      description="Guarda tus partidas en la nube y deja que tu director vea cómo vas. Sin cuenta también puedes jugar."
    >
      <AuthForm mode="entrar" next={next} switchHref={`/registro?volver=${encodeURIComponent(next)}`} />
    </AuthShell>
  );
}
