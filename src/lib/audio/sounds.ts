import { INSTRUMENTS } from "../chart/instruments";
import type { InstrumentId, StrokeId } from "../chart/types";
import { INSTRUMENT_IDS } from "../chart/types";

export type StrokeSoundId = `${InstrumentId}:${StrokeId}`;
export type ClickSoundId = "metronomo:alto" | "metronomo:bajo";
export type SoundId = StrokeSoundId | ClickSoundId;

export function strokeSound(instrument: InstrumentId, stroke: StrokeId): StrokeSoundId {
  return `${instrument}:${stroke}`;
}

export const CLICK_SOUNDS: ClickSoundId[] = ["metronomo:alto", "metronomo:bajo"];

export function allSoundIds(): SoundId[] {
  const ids: SoundId[] = [];
  for (const instrument of INSTRUMENT_IDS) {
    for (const stroke of INSTRUMENTS[instrument].strokes) ids.push(strokeSound(instrument, stroke));
  }
  return [...ids, ...CLICK_SOUNDS];
}

/** Ruta relativa a `public/samples/` donde se busca una grabación real. */
export function samplePathFor(id: SoundId): string {
  const [group, name] = id.split(":");
  return `${group}/${name}`;
}
