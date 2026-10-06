import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="font-heading text-6xl font-extrabold text-primary">404</p>
      <h1 className="font-heading text-2xl font-bold">Esta canción no está en el repertorio</h1>
      <p className="text-muted-foreground">Puede que el director la haya renombrado o que todavía no esté publicada.</p>
      <Button nativeButton={false} render={<Link href="/" />}>
        Ver canciones
      </Button>
    </div>
  );
}
