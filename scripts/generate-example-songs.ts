/**
 * Genera los .mid de ejemplo de content/songs y la plantilla de docs/plantillas.
 *
 *   npm run songs:generate
 *
 * Cada patrón es un compás de 4/4 en semicorcheas (16 pasos) o en tresillos
 * de corchea (12 pasos):
 *   x abierto (36) · o apagado (37) · r aro (38) · s slap (39) · X acento (40)
 *   h agudo (60) · l grave (61) · . silencio
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { Midi } from "@tonejs/midi";

const PPQ = 480;
const BAR_TICKS = 4 * PPQ;
const STEPS_PER_BAR = [16, 12];

const NOTE: Record<string, { midi: number; velocity: number }> = {
  x: { midi: 36, velocity: 92 },
  o: { midi: 37, velocity: 70 },
  r: { midi: 38, velocity: 88 },
  s: { midi: 39, velocity: 100 },
  X: { midi: 40, velocity: 122 },
  h: { midi: 60, velocity: 92 },
  l: { midi: 61, velocity: 92 },
};

type Bars = (string | null)[];

interface SongSpec {
  slug: string;
  bpm: number;
  bars: number;
  markers: { bar: number; name: string }[];
  tracks: Record<string, Bars>;
}

function repeat(pattern: string | null, times: number): Bars {
  return Array.from({ length: times }, () => pattern);
}

function writeSong(spec: SongSpec, root: string) {
  const midi = new Midi();
  midi.header.setTempo(spec.bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
  midi.header.name = spec.slug;
  for (const marker of spec.markers) {
    midi.header.meta.push({ type: "marker", text: marker.name, ticks: (marker.bar - 1) * 4 * PPQ });
  }
  midi.header.update();

  for (const [name, bars] of Object.entries(spec.tracks)) {
    if (bars.length !== spec.bars) {
      throw new Error(`${spec.slug}/${name}: ${bars.length} compases, se esperaban ${spec.bars}`);
    }
    const track = midi.addTrack();
    track.name = name;
    track.channel = 9;
    bars.forEach((pattern, barIndex) => {
      if (!pattern) return;
      if (!STEPS_PER_BAR.includes(pattern.length)) {
        throw new Error(`${spec.slug}/${name} compás ${barIndex + 1}: «${pattern}»`);
      }
      const step = BAR_TICKS / pattern.length;
      [...pattern].forEach((char, index) => {
        if (char === ".") return;
        const note = NOTE[char];
        if (!note) throw new Error(`Carácter desconocido «${char}» en ${name}`);
        track.addNote({
          midi: note.midi,
          ticks: barIndex * BAR_TICKS + index * step,
          durationTicks: step / 2,
          velocity: note.velocity / 127,
        });
      });
    });
  }

  const file = join(root, "content", "songs", spec.slug, "song.mid");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, midi.toArray());
  console.log(`✔ ${file}`);
}

const BREAK_HIGH = "X...X...X.X.X...";
const BREAK_LOW = "x...x...x.x.x...";
const FINAL_HIGH = "X...............";
const FINAL_LOW = "x...............";

const sambaDeEnsayo: SongSpec = {
  slug: "samba-de-ensayo",
  bpm: 100,
  bars: 24,
  markers: [
    { bar: 1, name: "Llamada" },
    { bar: 5, name: "Groove" },
    { bar: 13, name: "Breque" },
    { bar: 17, name: "Groove 2" },
    { bar: 23, name: "Final" },
  ],
  tracks: {
    "Surdo 1": [
      null, null, "o...x...o...x...", "o...x...o...x...",
      ...repeat("o...x...o...x...", 8),
      BREAK_LOW, "o...x...o...x...", BREAK_LOW, "o...x...o...x...",
      ...repeat("o...x...o...x...", 6),
      "o...x...o...x...", FINAL_LOW,
    ],
    "Surdo 2": [
      null, null, "x...o...x...o...", "x...o...x...o...",
      ...repeat("x...o...x...o...", 8),
      BREAK_LOW, "x...o...x...o...", BREAK_LOW, "x...o...x...o...",
      ...repeat("x...o...x...o...", 6),
      "x...o...x...o...", FINAL_LOW,
    ],
    "Surdo 3": [
      null, null, null, null,
      ...repeat("..x.o.x...x.o.x.", 8),
      BREAK_LOW, "..x.o.x...x.o.x.", BREAK_LOW, "..x.o.x...x.o.x.",
      ...repeat("..x.o.x...x.o.x.", 6),
      "..x.o.x...x.o.x.", FINAL_LOW,
    ],
    Caixa: [
      null, null, null, "x.x.x.x.x.x.X.X.",
      ...repeat("X.oxX.oxX.oxXrox", 8),
      BREAK_HIGH, "X.oxX.oxX.oxXrox", BREAK_HIGH, "X.oxX.oxX.oxXrox",
      ...repeat("X.oxX.oxX.oxXrox", 6),
      "X.oxX.oxX.oxXrox", FINAL_HIGH,
    ],
    Repinique: [
      "x.x.x.x.s...s...", "x..x..x.x.x.X...", "x.ox.sx.x.ox.sr.", "x.ox.sx.x.ox.sr.",
      ...repeat("x.ox.sx.x.ox.sr.", 8),
      BREAK_HIGH, "x.ox.sx.x.ox.sr.", BREAK_HIGH, "x.ox.sx.x.ox.sr.",
      ...repeat("x.ox.sx.x.ox.sr.", 6),
      "x.ox.sx.x.ox.sr.", FINAL_HIGH,
    ],
    Tamborim: [
      null, null, null, null,
      ...repeat("x.x.ox.x.x.xo.x.", 8),
      BREAK_HIGH, "x.x.ox.x.x.xo.x.", BREAK_HIGH, "x.x.ox.x.x.xo.x.",
      ...repeat("x.x.ox.x.x.xo.x.", 6),
      "x.x.ox.x.x.xo.x.", FINAL_HIGH,
    ],
    Agogo: [
      null, null, "h.hl.l.hh.hl.l..", "h.hl.l.hh.hl.l..",
      ...repeat("h.hl.l.hh.hl.l..", 8),
      "h...h...h.h.h...", "h.hl.l.hh.hl.l..", "h...h...h.h.h...", "h.hl.l.hh.hl.l..",
      ...repeat("h.hl.l.hh.hl.l..", 6),
      "h.hl.l.hh.hl.l..", "h...............",
    ],
    Chocalho: [
      null, null, null, null,
      ...repeat("xoxoxoxoxoxoxoxo", 8),
      "x...x...x.x.x...", "xoxoxoxoxoxoxoxo", "x...x...x.x.x...", "xoxoxoxoxoxoxoxo",
      ...repeat("xoxoxoxoxoxoxoxo", 6),
      "xoxoxoxoxoxoxoxo", "x...............",
    ],
  },
};

const primerosPasos: SongSpec = {
  slug: "primeros-pasos",
  bpm: 84,
  bars: 12,
  markers: [],
  tracks: {
    "Surdo 1": repeat("o...x...o...x...", 12),
    "Surdo 2": repeat("x...o...x...o...", 12),
    Tamborim: [...repeat(null, 4), ...repeat("x...o...x.x.o...", 8)],
    Agogo: [...repeat(null, 4), ...repeat("h...l...h.h.l...", 4), ...repeat("h.hl.l.hh.hl.l..", 4)],
    Chocalho: [...repeat(null, 8), ...repeat("x.o.x.o.x.o.x.o.", 4)],
  },
};

const IJEXA_CAIXA = "X.oX.oX.oXro";
const IJEXA_REPI = "x.ox.sx.ox.s";

const ijexaDeEnsayo: SongSpec = {
  slug: "ijexa-de-ensayo",
  bpm: 90,
  bars: 8,
  markers: [],
  tracks: {
    "Surdo 1": repeat("o...x...o...x...", 8),
    "Surdo 2": [...repeat("x...o...x...o...", 2), ...repeat("x.....o.....x.o.", 4), "x...o...x...o...", "x..............."],
    Caixa: ["x.x.x.x.x.x.X.X.", "X.oxX.oxX.oxXrox", ...repeat(IJEXA_CAIXA, 4), "X.oxX.oxX.oxXrox", "X..............."],
    Repinique: ["x.ox.sx.x.ox.sr.", "x..x..x.x.x.X...", IJEXA_REPI, "x.ox.sx.x.ox.sr.", IJEXA_REPI, "xxx..xxx..xx", "x.ox.sx.x.ox.sr.", "X..............."],
    Agogo: [...repeat("h.hl.l.hh.hl.l..", 2), ...repeat("h.hl.lh.hl.l", 4), "h.hl.l.hh.hl.l..", "h..............."],
    Chocalho: [...repeat("xoxoxoxoxoxoxoxo", 2), ...repeat("xoxxoxxoxxox", 4), "xoxoxoxoxoxoxoxo", "x..............."],
  },
};

function writeTemplate(root: string) {
  const midi = new Midi();
  midi.header.setTempo(100);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
  midi.header.meta.push({ type: "marker", text: "Intro", ticks: 0 });
  midi.header.update();
  for (const name of ["Surdo 1", "Surdo 2", "Surdo 3", "Caixa", "Repinique", "Tamborim", "Agogo", "Chocalho"]) {
    const track = midi.addTrack();
    track.name = name;
    track.channel = 9;
  }
  const file = join(root, "docs", "plantillas", "plantilla-heroleiros.mid");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, midi.toArray());
  console.log(`✔ ${file}`);
}

const root = process.cwd();
writeSong(sambaDeEnsayo, root);
writeSong(primerosPasos, root);
writeSong(ijexaDeEnsayo, root);
writeTemplate(root);
