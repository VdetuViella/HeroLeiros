import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseSongMeta, type SongMeta } from "../chart/meta";
import { parseChart } from "../chart/parse";
import type { Chart } from "../chart/types";

export const SONGS_DIR = join(process.cwd(), "content", "songs");
export const MIDI_FILE = "song.mid";
export const META_FILE = "meta.json";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Carpetas de `content/songs` con un `song.mid`. Las que empiezan por `_` se ignoran. */
export async function listSongSlugs(dir = SONGS_DIR): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((slug) => existsSync(join(dir, slug, MIDI_FILE)))
    .sort();
}

export interface LoadedSong {
  chart: Chart;
  meta: SongMeta;
  metaErrors: string[];
}

export class SongLoadError extends Error {}

export async function loadSong(slug: string, dir = SONGS_DIR): Promise<LoadedSong> {
  if (!isValidSlug(slug)) {
    throw new SongLoadError(`«${slug}» no es un nombre de carpeta válido (minúsculas, números y guiones).`);
  }
  const songDir = join(dir, slug);
  const midiPath = join(songDir, MIDI_FILE);
  const metaPath = join(songDir, META_FILE);
  if (!existsSync(midiPath)) throw new SongLoadError(`Falta ${MIDI_FILE} en ${songDir}.`);

  let rawMeta: unknown = {};
  const metaErrors: string[] = [];
  if (existsSync(metaPath)) {
    try {
      rawMeta = JSON.parse(await readFile(metaPath, "utf8"));
    } catch (error) {
      metaErrors.push(`${META_FILE} no es JSON válido: ${(error as Error).message}`);
    }
  } else {
    metaErrors.push(`Falta ${META_FILE}; se usa el nombre de la carpeta como título.`);
  }
  const { meta, errors } = parseSongMeta(rawMeta, slug);
  metaErrors.push(...errors);

  const bytes = await readFile(midiPath);
  let chart: Chart;
  try {
    chart = parseChart({ slug, midi: new Uint8Array(bytes), meta });
  } catch (error) {
    throw new SongLoadError(`No se pudo leer ${MIDI_FILE}: ${(error as Error).message}`);
  }
  return { chart, meta, metaErrors };
}

export async function loadAllSongs(dir = SONGS_DIR): Promise<LoadedSong[]> {
  const slugs = await listSongSlugs(dir);
  const songs: LoadedSong[] = [];
  for (const slug of slugs) {
    try {
      songs.push(await loadSong(slug, dir));
    } catch (error) {
      console.error(`[songs] ${slug}: ${(error as Error).message}`);
    }
  }
  return songs;
}
