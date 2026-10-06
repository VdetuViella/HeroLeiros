/**
 * Recorre public/samples/<grupo>/<golpe>.<ext> y escribe public/samples/manifest.json,
 * que es lo que lee la app para saber qué grabaciones reales hay.
 *
 *   npm run samples:manifest
 *
 * Los sonidos sin archivo se sintetizan en el navegador.
 */
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

import { allSoundIds, samplePathFor, type SoundId } from "../src/lib/audio/sounds";

const ROOT = join(process.cwd(), "public", "samples");
const EXTENSIONS = [".wav", ".ogg", ".mp3", ".m4a", ".flac", ".webm"];

const samples: Partial<Record<SoundId, string>> = {};
const missing: SoundId[] = [];

for (const id of allSoundIds()) {
  const base = samplePathFor(id);
  const [group, name] = base.split("/");
  const dir = join(ROOT, group);
  const file =
    existsSync(dir) && statSync(dir).isDirectory()
      ? readdirSync(dir).find((entry) => entry.slice(0, -extname(entry).length) === name && EXTENSIONS.includes(extname(entry).toLowerCase()))
      : undefined;
  if (file) samples[id] = `${group}/${file}`;
  else missing.push(id);
}

writeFileSync(join(ROOT, "manifest.json"), `${JSON.stringify({ samples }, null, 2)}\n`);
console.log(`✔ ${Object.keys(samples).length} grabaciones en public/samples/manifest.json`);
if (missing.length > 0) console.log(`  Se sintetizarán ${missing.length}: ${missing.join(", ")}`);
