import { allSoundIds, type SoundId } from "./sounds";
import { synthesize } from "./synth";

export const SAMPLES_BASE_URL = "/samples";

/** `public/samples/manifest.json`: id de sonido → archivo relativo a `public/samples/`. */
export interface SampleManifest {
  samples: Partial<Record<SoundId, string>>;
}

export type SoundOrigin = "sample" | "sintetizado";

export interface SampleBank {
  buffers: Map<SoundId, AudioBuffer>;
  origins: Map<SoundId, SoundOrigin>;
}

async function fetchManifest(baseUrl: string): Promise<SampleManifest> {
  try {
    const response = await fetch(`${baseUrl}/manifest.json`, { cache: "no-cache" });
    if (!response.ok) return { samples: {} };
    const json = (await response.json()) as Partial<SampleManifest>;
    return { samples: json.samples ?? {} };
  } catch {
    return { samples: {} };
  }
}

/**
 * Carga las grabaciones listadas en el manifiesto y sintetiza el resto, de
 * forma que siempre hay un `AudioBuffer` para cada instrumento y golpe.
 */
export async function loadSampleBank(context: BaseAudioContext, baseUrl = SAMPLES_BASE_URL): Promise<SampleBank> {
  const manifest = await fetchManifest(baseUrl);
  const buffers = new Map<SoundId, AudioBuffer>();
  const origins = new Map<SoundId, SoundOrigin>();

  await Promise.all(
    allSoundIds().map(async (id) => {
      const file = manifest.samples[id];
      if (file) {
        try {
          const response = await fetch(`${baseUrl}/${file}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          buffers.set(id, await context.decodeAudioData(await response.arrayBuffer()));
          origins.set(id, "sample");
          return;
        } catch (error) {
          console.warn(`[samples] No se pudo cargar ${file}; se usa el sintetizador.`, error);
        }
      }
      const data = synthesize(id, context.sampleRate);
      const buffer = context.createBuffer(1, data.length, context.sampleRate);
      buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      buffers.set(id, buffer);
      origins.set(id, "sintetizado");
    }),
  );

  return { buffers, origins };
}
