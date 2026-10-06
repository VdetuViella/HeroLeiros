import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { WORKLET_OUTPUT, bundleWorklet } from "./build-worklet";

describe("worklet del micrófono", () => {
  it("el archivo de public/ está al día con el código fuente (npm run worklet:build)", async () => {
    const [expected, committed] = await Promise.all([bundleWorklet(), readFile(WORKLET_OUTPUT, "utf8")]);
    expect(committed).toBe(expected);
  });

  it("registra el procesador y no deja imports sueltos", async () => {
    const code = await bundleWorklet();
    expect(code).toContain('registerProcessor(ONSET_PROCESSOR_NAME');
    expect(code).not.toMatch(/^\s*import\s/m);
  });
});
