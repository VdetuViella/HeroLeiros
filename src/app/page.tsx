import Link from "next/link";
import { ArrowRight, FolderOpen, Gauge, Keyboard, Mic, Music, Repeat, Smartphone } from "lucide-react";

import { InstrumentChip } from "@/components/instrument-chip";
import { InstallHint } from "@/components/pwa/install-hint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import { loadAllSongs } from "@/lib/songs/load";

const FEATURES = [
  { icon: Keyboard, title: "Teclado", text: "Teclas D F J K por defecto, configurables por carril." },
  { icon: Smartphone, title: "Pantalla táctil", text: "Pads grandes y multitáctiles en el móvil o la tableta." },
  { icon: Mic, title: "Micrófono", text: "Toca tu instrumento de verdad; se juzga el tiempo de cada golpe." },
  { icon: Music, title: "Partitura", text: "Pentagrama de percusión sincronizado, o vista dividida con el carril." },
  { icon: Gauge, title: "Velocidad", text: "Del 50 al 100 % sin perder calidad de sonido." },
  { icon: Repeat, title: "Bucles", text: "Repite una sección o cualquier tramo de compases." },
];

export default async function Home() {
  const songs = await loadAllSongs();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-amber-500/15 via-fuchsia-500/10 to-sky-500/10 p-6 sm:p-10">
        <div className="max-w-2xl space-y-4">
          <Badge variant="outline" className="border-primary/40 text-primary">
            Ensayo de batucada
          </Badge>
          <h1 className="font-heading text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            Toca tu parte con todo el grupo sonando de fondo
          </h1>
          <p className="text-lg text-muted-foreground text-pretty">
            Elige una canción y tu instrumento, baja la velocidad si hace falta y practica la sección
            que se te resiste. Cada golpe se puntúa al milisegundo.
          </p>
        </div>
        <InstallHint />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-xl bg-background/50 p-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="canciones">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="canciones" className="font-heading text-2xl font-bold tracking-tight">
              Canciones
            </h2>
            <p className="text-sm text-muted-foreground">
              {songs.length === 1 ? "1 canción disponible" : `${songs.length} canciones disponibles`}
            </p>
          </div>
        </div>

        {songs.length === 0 ? (
          <Card className="items-center py-12 text-center">
            <CardContent className="flex flex-col items-center gap-3">
              <FolderOpen className="size-10 text-muted-foreground" aria-hidden />
              <p className="font-medium">Todavía no hay canciones</p>
              <p className="max-w-md text-sm text-muted-foreground">
                El director puede añadirlas en <code className="font-mono">content/songs/&lt;nombre&gt;/</code> con un{" "}
                <code className="font-mono">song.mid</code> y un <code className="font-mono">meta.json</code>, y
                comprobarlas con <code className="font-mono">npm run songs:check</code>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {songs.map(({ chart }) => (
              <li key={chart.slug}>
                <Link
                  href={`/canciones/${chart.slug}`}
                  data-testid={`cancion-${chart.slug}`}
                  className="group block h-full rounded-xl focus-visible:outline-none"
                >
                  <Card className="h-full transition-colors group-hover:ring-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-primary">
                    <CardHeader>
                      <CardTitle className="font-heading text-xl">{chart.title}</CardTitle>
                      <CardDescription>
                        {chart.artist ? `${chart.artist} · ` : ""}
                        {chart.bpm} BPM · {chart.bars} compases · {formatDuration(chart.durationSeconds)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {chart.description && <p className="text-sm text-muted-foreground">{chart.description}</p>}
                      <div className="flex flex-wrap gap-1.5">
                        {chart.tracks.map((track) => (
                          <InstrumentChip key={track.instrument} track={track} />
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="mt-auto justify-between text-sm">
                      <span className="text-muted-foreground">
                        {chart.sections.length} {chart.sections.length === 1 ? "sección" : "secciones"}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-primary">
                        Practicar <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
