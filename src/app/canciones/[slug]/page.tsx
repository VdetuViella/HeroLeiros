import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SongPlayer } from "@/components/game/song-player";
import { isValidSlug, listSongSlugs, loadSong, type LoadedSong } from "@/lib/songs/load";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return (await listSongSlugs()).map((slug) => ({ slug }));
}

async function findSong(slug: string): Promise<LoadedSong | null> {
  if (!isValidSlug(slug)) return null;
  try {
    return await loadSong(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const song = await findSong(slug);
  return { title: song ? song.chart.title : "Canción no encontrada" };
}

export default async function SongPage({ params }: { params: Params }) {
  const { slug } = await params;
  const song = await findSong(slug);
  if (!song) notFound();
  return <SongPlayer chart={song.chart} />;
}
