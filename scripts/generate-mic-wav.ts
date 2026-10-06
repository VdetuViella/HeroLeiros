/**
 * Genera un WAV con golpes regulares para usarlo como micrófono falso en Chrome:
 *
 *   npm run mic:wav -- --bpm 90 --kind caixa --out /tmp/heroleiros-mic.wav
 *   google-chrome --use-fake-ui-for-media-stream --use-fake-device-for-media-stream \
 *     --use-file-for-fake-audio-capture=/tmp/heroleiros-mic.wav
 *
 * Chrome repite el archivo en bucle, así que dura un número entero de compases.
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { clickTrack, dbToGain, renderHits, type HitKind } from "../src/lib/mic/test-signals";
import { encodeWav } from "../src/lib/mic/wav";

const { values } = parseArgs({
  options: {
    bpm: { type: "string", default: "90" },
    kind: { type: "string", default: "caixa" },
    beats: { type: "string", default: "32" },
    noise: { type: "string", default: "-55" },
    rate: { type: "string", default: "48000" },
    out: { type: "string", default: "/tmp/heroleiros-mic.wav" },
  },
});

const KINDS: HitKind[] = ["surdo", "caixa", "tamborim", "clic"];
const kind = values.kind as HitKind;
if (!KINDS.includes(kind)) throw new Error(`--kind debe ser uno de: ${KINDS.join(", ")}`);

const bpm = Number(values.bpm);
const beats = Number(values.beats);
const sampleRate = Number(values.rate);
const seconds = (beats * 60) / bpm;
const hits = clickTrack(bpm, beats, 0, kind, 0.7).map((hit, i) => ({ ...hit, gain: i % 4 === 0 ? 0.8 : 0.5 }));
const samples = renderHits({ sampleRate, seconds, hits, noiseRms: dbToGain(Number(values.noise)) });

writeFile(values.out, encodeWav(samples, sampleRate)).then(
  () => console.log(`WAV: ${values.out} · ${beats} golpes de ${kind} a ${bpm} BPM · ${seconds.toFixed(2)} s · ${sampleRate} Hz`),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
