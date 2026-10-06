import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountsUnavailable } from "@/components/account/accounts-unavailable";
import { AuthForm } from "@/components/account/auth-form";
import { AuthShell } from "@/components/account/auth-shell";
import { isDatabaseConfigured } from "@/server/db/client";
import { getCurrentUser, safeNext } from "@/server/current-user";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignUpPage({ searchParams }: PageProps<"/registro">) {
  if (!isDatabaseConfigured()) return <AccountsUnavailable />;
  const next = safeNext((await searchParams).volver, "/progreso");
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthShell
      title="Crear cuenta"
      description="Si tu director te ha pasado un enlace de invitación, ábrelo para entrar directamente en su grupo."
    >
      <AuthForm mode="registro" next={next} allowDirector switchHref={`/entrar?volver=${encodeURIComponent(next)}`} />
    </AuthShell>
  );
}
