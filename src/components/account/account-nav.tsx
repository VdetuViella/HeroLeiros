"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChartLine, Cloud, CloudOff, CloudUpload, LayoutDashboard, LogIn, LogOut, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import { useAccount, type SyncState } from "./account-provider";

const NAV_LINK =
  "hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex";

function SyncBadge({ state, queued }: { state: SyncState; queued: number }) {
  switch (state) {
    case "inactivo":
    case "al-dia":
      return null;
    case "enviando":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
          <CloudUpload className="size-4 animate-pulse" aria-hidden />
          <span className="hidden sm:inline">Subiendo…</span>
        </span>
      );
    case "pendiente":
    case "sin-conexion":
      return (
        <span
          className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300"
          role="status"
          title="Se enviarán solas en cuanto haya conexión."
        >
          <CloudOff className="size-3.5" aria-hidden />
          {queued} {queued === 1 ? "partida" : "partidas"} en cola
        </span>
      );
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AccountNav() {
  const { user, loading, available, queued, sync, signOut } = useAccount();
  const router = useRouter();

  if (!available) return null;
  if (loading) return <Skeleton className="h-8 w-20" />;

  if (!user) {
    return (
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/entrar" />}>
        <LogIn data-icon="inline-start" aria-hidden />
        Entrar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link href="/progreso" className={NAV_LINK}>
        <ChartLine className="size-4" aria-hidden />
        Mi progreso
      </Link>
      {user.role === "director" && (
        <Link href="/director" className={NAV_LINK}>
          <LayoutDashboard className="size-4" aria-hidden />
          Panel del grupo
        </Link>
      )}
      <SyncBadge state={sync} queued={queued} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Cuenta de ${user.name}`} />
          }
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {initials(user.name) || <UserRound className="size-4" aria-hidden />}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block truncate font-medium text-foreground">{user.name}</span>
              <span className="block truncate text-xs font-normal">
                {user.role === "director" ? "Director/a" : "Miembro"} · {user.email}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/progreso" />}>
            <ChartLine aria-hidden />
            Mi progreso
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/director" />}>
            <LayoutDashboard aria-hidden />
            {user.role === "director" ? "Panel del grupo" : "Crear un grupo"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            {sync === "al-dia" || sync === "inactivo" ? <Cloud aria-hidden /> : <CloudOff aria-hidden />}
            {queued > 0 ? `${queued} en cola para subir` : "Progreso guardado en la nube"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              await signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut aria-hidden />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
