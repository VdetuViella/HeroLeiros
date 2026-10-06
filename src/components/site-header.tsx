import Link from "next/link";
import { Drum, Timer } from "lucide-react";

import { AccountNav } from "@/components/account/account-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Drum className="size-5" aria-hidden />
          </span>
          HeroLeiros
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            Canciones
          </Link>
          <Link
            href="/calibracion"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Timer className="size-4" aria-hidden />
            <span className="hidden sm:inline">Calibrar latencia</span>
            <span className="sm:hidden">Latencia</span>
          </Link>
          <AccountNav />
        </nav>
      </div>
    </header>
  );
}
