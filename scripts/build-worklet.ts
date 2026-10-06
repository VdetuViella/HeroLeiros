/**
 * Empaqueta el AudioWorklet del micrófono en un único archivo estático,
 * porque `audioWorklet.addModule` carga una URL y no pasa por el bundler de Next.
 *
 *   npm run worklet:build
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WORKLET_ENTRY = path.join(root, "src/lib/mic/worklet/onset-processor.ts");
export const WORKLET_OUTPUT = path.join(root, "public/worklets/onset-processor.js");

const BANNER = "// Generado por `npm run worklet:build` desde src/lib/mic/worklet/onset-processor.ts. No editar a mano.";

export async function bundleWorklet(): Promise<string> {
  const result = await build({
    entryPoints: [WORKLET_ENTRY],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2020",
    platform: "browser",
    legalComments: "none",
    banner: { js: BANNER },
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

async function main() {
  const code = await bundleWorklet();
  await mkdir(path.dirname(WORKLET_OUTPUT), { recursive: true });
  const previous = await readFile(WORKLET_OUTPUT, "utf8").catch(() => null);
  if (previous === code) {
    console.log("Worklet sin cambios:", path.relative(root, WORKLET_OUTPUT));
    return;
  }
  await writeFile(WORKLET_OUTPUT, code);
  console.log("Worklet generado:", path.relative(root, WORKLET_OUTPUT), `(${(code.length / 1024).toFixed(1)} KB)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
