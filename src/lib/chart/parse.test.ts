import { describe, expect, it } from "vitest";

import { loadSong } from "../songs/load";
import { parseSongMeta } from "./meta";
import { parseChart } from "./parse";
import { buildTestMidi } from "./test-utils";

describe("parseChart", () => {
  const midi = buildTestMidi({
    bpm: 120,
    tracks: [
      {
        name: "Surdo 1",
        notes: [
          { midi: 37, beat: 0 },
          { midi: 36, beat: 1 },
          { midi: 37, beat: 2 },
          { midi: 36, beat: 3, velocity: 120 },
          { midi: 36, beat: 5 },
        ],
      },
      { name: "agogô", notes: [{ midi: 61, beat: 0.5 }, { midi: 60, beat: 0 }, { midi: 36, beat: 1 }] },
      { name: "Teclado", notes: [{ midi: 64, beat: 0 }] },
    ],
  });
  const chart = parseChart({ slug: "prueba", midi, meta: { title: "Prueba" } });

  it("crea una pista por instrumento reconocido, en orden canónico", () => {
    expect(chart.tracks.map((t) => t.instrument)).toEqual(["surdo1", "agogo"]);
    expect(chart.tracks[1].sourceTrackNames).toEqual(["agogô"]);
  });

  it("convierte ticks a pulsos, segundos y compases", () => {
    const surdo = chart.tracks[0];
    expect(surdo.notes.map((n) => n.beat)).toEqual([0, 1, 2, 3, 5]);
    expect(surdo.notes.map((n) => n.time)).toEqual([0, 0.5, 1, 1.5, 2.5]);
    expect(surdo.notes.map((n) => n.bar)).toEqual([1, 1, 1, 1, 2]);
    expect(chart.bars).toBe(2);
    expect(chart.durationBeats).toBe(8);
    expect(chart.durationSeconds).toBe(4);
  });

  it("asigna carriles según los golpes del instrumento", () => {
    const surdo = chart.tracks[0];
    expect(surdo.lanes).toEqual(["abierto", "apagado"]);
    expect(surdo.notes.map((n) => n.lane)).toEqual([1, 0, 1, 0, 0]);
    const agogo = chart.tracks[1];
    expect(agogo.lanes).toEqual(["agudo", "grave"]);
    expect(agogo.notes.map((n) => n.stroke)).toEqual(["agudo", "grave"]);
  });

  it("marca acentos por velocidad", () => {
    expect(chart.tracks[0].notes.map((n) => n.accent)).toEqual([false, false, false, true, false]);
  });

  it("informa de notas sin mapear y pistas desconocidas", () => {
    expect(chart.unmapped).toEqual([
      { trackName: "agogô", instrument: "agogo", midi: 36, count: 1 },
      { trackName: "Teclado", instrument: null, midi: 64, count: 1 },
    ]);
    const codes = chart.warnings.map((w) => w.code);
    expect(codes).toContain("pista-desconocida");
    expect(codes).toContain("notas-sin-mapear");
  });

  it("crea una sección «Canción completa» si no hay secciones ni marcadores", () => {
    expect(chart.sections).toEqual([
      { name: "Canción completa", startBar: 1, endBar: 2, startBeat: 0, endBeat: 8 },
    ]);
  });

  it("usa el BPM de meta.json por encima del MIDI", () => {
    const fast = parseChart({ slug: "x", midi, meta: { title: "x", bpm: 60 } });
    expect(fast.bpm).toBe(60);
    expect(fast.tracks[0].notes[1].time).toBe(1);
  });

  it("combina pistas duplicadas del mismo instrumento", () => {
    const dup = parseChart({
      slug: "dup",
      meta: { title: "dup" },
      midi: buildTestMidi({
        tracks: [
          { name: "Caixa", notes: [{ midi: 36, beat: 0 }] },
          { name: "Caja", notes: [{ midi: 38, beat: 1 }, { midi: 36, beat: 0 }] },
        ],
      }),
    });
    expect(dup.tracks).toHaveLength(1);
    expect(dup.tracks[0].notes).toHaveLength(2);
    expect(dup.warnings.map((w) => w.code)).toContain("pista-duplicada");
  });

  it("lee las secciones de los marcadores del MIDI", () => {
    const withMarkers = parseChart({
      slug: "m",
      meta: { title: "m" },
      midi: buildTestMidi({
        markers: [
          { beat: 0, text: "Intro" },
          { beat: 8, text: "Groove" },
        ],
        tracks: [{ name: "Tamborim", notes: [{ midi: 36, beat: 0 }, { midi: 36, beat: 15 }] }],
      }),
    });
    expect(withMarkers.sections.map((s) => [s.name, s.startBar, s.endBar])).toEqual([
      ["Intro", 1, 2],
      ["Groove", 3, 4],
    ]);
  });

  it("avisa de secciones fuera de la canción y de cambios de tempo", () => {
    const result = parseChart({
      slug: "s",
      meta: { title: "s", sections: [{ name: "Lejos", startBar: 9, endBar: 12 }, { name: "Larga", startBar: 1, endBar: 5 }] },
      midi: buildTestMidi({
        extraTempos: [{ beat: 4, bpm: 90 }],
        tracks: [{ name: "Chocalho", notes: [{ midi: 36, beat: 0 }, { midi: 37, beat: 4 }] }],
      }),
    });
    expect(result.sections).toEqual([{ name: "Larga", startBar: 1, endBar: 2, startBeat: 0, endBeat: 8 }]);
    const codes = result.warnings.map((w) => w.code);
    expect(codes.filter((c) => c === "seccion-invalida")).toHaveLength(2);
    expect(codes).toContain("cambio-de-tempo");
  });

  it("calcula compases en 2/4", () => {
    const twoFour = parseChart({
      slug: "t",
      meta: { title: "t" },
      midi: buildTestMidi({
        timeSignature: [2, 4],
        tracks: [{ name: "Surdo 2", notes: [{ midi: 36, beat: 0 }, { midi: 36, beat: 2 }, { midi: 36, beat: 5 }] }],
      }),
    });
    expect(twoFour.beatsPerBar).toBe(2);
    expect(twoFour.tracks[0].notes.map((n) => n.bar)).toEqual([1, 2, 3]);
    expect(twoFour.bars).toBe(3);
  });
});

describe("parseSongMeta", () => {
  it("valida los campos y explica los errores en español", () => {
    const { meta, errors } = parseSongMeta(
      { bpm: 1000, sections: [{ name: "A", startBar: 0, endBar: 2 }], mapping: { bateria: {} } },
      "carpeta",
    );
    expect(meta.title).toBe("carpeta");
    expect(errors).toHaveLength(4);
    expect(errors.join(" ")).toMatch(/title/);
  });

  it("acepta un meta.json completo", () => {
    const { meta, errors } = parseSongMeta({
      title: "Samba",
      bpm: 100,
      timeSignature: [2, 4],
      sections: [{ name: "A", startBar: 1, endBar: 4 }],
      trackAliases: { Campana: "agogo" },
      mapping: { caixa: { "42": "aro", "43": { stroke: "abierto", accent: true } } },
      accentVelocity: 100,
    });
    expect(errors).toEqual([]);
    expect(meta.mapping?.caixa?.["43"]).toEqual({ stroke: "abierto", accent: true });
  });
});

describe("canciones incluidas", () => {
  it("«Samba de ensayo» tiene los 8 instrumentos y ningún aviso", async () => {
    const { chart, metaErrors } = await loadSong("samba-de-ensayo");
    expect(metaErrors).toEqual([]);
    expect(chart.warnings).toEqual([]);
    expect(chart.tracks).toHaveLength(8);
    expect(chart.bars).toBe(24);
    expect(chart.sections.map((s) => s.name)).toEqual(["Llamada", "Groove", "Breque", "Groove 2", "Final"]);
    for (const track of chart.tracks) {
      expect(track.lanes.length).toBeGreaterThanOrEqual(2);
      expect(track.lanes.length).toBeLessThanOrEqual(4);
    }
  });
});
