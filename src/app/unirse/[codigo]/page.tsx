import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon } from "lucide-react";

import { AccountsUnavailable } from "@/components/account/accounts-unavailable";
import { AuthShell } from "@/components/account/auth-shell";
import { JoinGroupButton, JoinWithAccount } from "@/components/account/join-group";
import { Button } from "@/components/ui/button";
import { getDb, isDatabaseConfigured } from "@/server/db/client";
import { getCurrentUser } from "@/server/current-user";
import { findGroupByInvite } from "@/server/groups/service";

export const metadata: Metadata = { title: "Invitación al grupo" };

export default async function InvitePage({ params }: PageProps<"/unirse/[codigo]">) {
  if (!isDatabaseConfigured()) return <AccountsUnavailable />;
  const { codigo } = await params;
  const [group, user] = await Promise.all([findGroupByInvite(getDb(), codigo), getCurrentUser()]);

  if (!group) {
    return (
      <AuthShell
        title="Invitación no válida"
        description="Este enlace ya no funciona: puede que el director lo haya cambiado. Pídele el enlace nuevo."
      >
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Mientras tanto, practica sin cuenta
        </Button>
      </AuthShell>
    );
  }

  const description = (
    <>
      <span className="flex items-center gap-1.5">
        <LinkIcon className="size-3.5" aria-hidden />
        {group.directorName} te invita a su grupo.
      </span>
      <span className="mt-1 block">Tus partidas aparecerán en su panel para que pueda ayudarte con lo que más cuesta.</span>
    </>
  );

  return (
    <AuthShell title={`Únete a ${group.name}`} description={description}>
      {user ? (
        group.directorId === user.id ? (
          <p className="text-sm text-muted-foreground">
            Diriges este grupo. Comparte este enlace con los integrantes desde el{" "}
            <Link href="/director" className="text-primary underline-offset-4 hover:underline">
              panel del grupo
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Has entrado como <strong className="text-foreground">{user.name}</strong>.
            </p>
            <JoinGroupButton code={codigo} groupName={group.name} />
          </div>
        )
      ) : (
        <JoinWithAccount code={codigo} />
      )}
    </AuthShell>
  );
}
