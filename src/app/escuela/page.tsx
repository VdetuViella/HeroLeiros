import type { Metadata } from "next";

import { SchoolOverview } from "@/components/school/school-overview";

export const metadata: Metadata = { title: "Escuela" };

export default function SchoolPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="max-w-3xl space-y-3">
        <h1 className="font-heading text-4xl font-extrabold tracking-tight text-balance">Escuela</h1>
        <p className="text-lg text-muted-foreground text-pretty">
          Ejercicios de técnica para caixa y surdo: rudimentos de la PAS, calentamientos clásicos y la marcación de
          escola de samba. Cada ejercicio tiene tempos que se van abriendo según los superas.
        </p>
      </header>
      <SchoolOverview />
    </div>
  );
}
