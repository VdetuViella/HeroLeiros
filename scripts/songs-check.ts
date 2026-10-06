/**
 * Valida las canciones de content/songs antes de publicarlas.
 *
 *   npm run songs:check              # todas
 *   npm run songs:check -- mi-samba  # solo una
 *
 * Sale con código 1 si alguna canción tiene errores.
 */
import { checkSong, formatReport } from "../src/lib/songs/check";
import { listSongSlugs } from "../src/lib/songs/load";

async function main() {
  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const slugs = requested.length > 0 ? requested : await listSongSlugs();

  if (slugs.length === 0) {
    console.log("No hay canciones en content/songs. Crea content/songs/<slug>/song.mid y meta.json.");
    process.exit(1);
  }

  let failures = 0;
  for (const slug of slugs) {
    const report = await checkSong(slug);
    if (!report.ok) failures += 1;
    console.log(formatReport(report));
    console.log("");
  }

  const total = slugs.length;
  console.log(
    failures === 0
      ? `Todo correcto: ${total} canción(es) lista(s).`
      : `${failures} de ${total} canción(es) con errores.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main();
