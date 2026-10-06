import { AccuracyBadge } from "@/components/progress/accuracy-badge";
import { formatRelative, formatSpeed } from "@/components/progress/format";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INSTRUMENTS } from "@/lib/chart/instruments";
import type { GroupMember, MatrixCell } from "@/server/progress/queries";

export interface MatrixSong {
  slug: string;
  title: string;
}

/** Tabla miembros × canciones con la mejor precisión de cada uno. */
export function BestMatrix({
  members,
  songs,
  cells,
  now,
}: {
  members: GroupMember[];
  songs: MatrixSong[];
  cells: MatrixCell[];
  now: Date;
}) {
  const byKey = new Map(cells.map((c) => [`${c.userId}|${c.songSlug}`, c]));
  const songMean = (slug: string) => {
    const values = cells.filter((c) => c.songSlug === slug).map((c) => c.accuracy);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-40 bg-card">Integrante</TableHead>
            {songs.map((song) => (
              <TableHead key={song.slug} className="min-w-32 text-center whitespace-normal">
                {song.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.userId}>
              <TableCell className="sticky left-0 z-10 bg-card">
                <span className="block font-medium">{member.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {member.mainInstrument ? INSTRUMENTS[member.mainInstrument]?.name : "Sin partidas"}
                  {member.lastPlayedAt && ` · ${formatRelative(member.lastPlayedAt, now)}`}
                </span>
              </TableCell>
              {songs.map((song) => {
                const cell = byKey.get(`${member.userId}|${song.slug}`);
                return (
                  <TableCell key={song.slug} className="text-center">
                    {cell ? (
                      <span
                        className="inline-flex flex-col items-center gap-0.5"
                        title={`${cell.attempts} ${cell.attempts === 1 ? "partida" : "partidas"} en esta canción`}
                      >
                        <AccuracyBadge accuracy={cell.accuracy} />
                        <span className="text-[11px] text-muted-foreground">
                          {INSTRUMENTS[cell.instrument]?.name ?? cell.instrument}
                          {cell.speed < 1 && ` · ${formatSpeed(cell.speed)}`}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60" aria-label="Sin partidas">
                        —
                      </span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-muted font-medium">Media del grupo</TableCell>
            {songs.map((song) => {
              const mean = songMean(song.slug);
              return (
                <TableCell key={song.slug} className="text-center">
                  {mean === null ? <span className="text-muted-foreground/60">—</span> : <AccuracyBadge accuracy={mean} />}
                </TableCell>
              );
            })}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
