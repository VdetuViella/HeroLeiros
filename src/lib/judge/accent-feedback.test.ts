import { describe, expect, it } from "vitest";

import { accentAdvice } from "./accent-feedback";
import type { AccentStats } from "./types";

function stats(partial: Partial<AccentStats>): AccentStats {
  const base = { judged: 20, correct: 0, missed: 0, extra: 0, accentNotes: 5, accentsGiven: 0, ...partial };
  return { ...base, accuracy: base.correct / base.judged };
}

describe("consejo de acentos", () => {
  it("felicita si casi todo coincide", () => {
    expect(accentAdvice(stats({ correct: 19, missed: 1, accentsGiven: 4 }))).toMatch(/muy limpios/);
  });

  it("pide marcar más los acentos si se escapan", () => {
    expect(accentAdvice(stats({ correct: 16, missed: 3, extra: 1, accentsGiven: 2 }))).toMatch(/Se te escapan/);
  });

  it("pide relajar si se acentúa de más", () => {
    expect(accentAdvice(stats({ correct: 15, missed: 0, extra: 5, accentsGiven: 5 }))).toMatch(/Acentúas notas que van normales/);
  });

  it("tramos sin acentos", () => {
    expect(accentAdvice(stats({ accentNotes: 0, correct: 20 }))).toMatch(/todo parejo/);
    expect(accentAdvice(stats({ accentNotes: 0, correct: 18, extra: 2 }))).toMatch(/misma fuerza/);
  });

  it("caso intermedio", () => {
    expect(accentAdvice(stats({ correct: 17, missed: 1, extra: 2, accentsGiven: 4 }))).toMatch(/Vas bien/);
  });
});
