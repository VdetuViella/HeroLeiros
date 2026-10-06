import { describe, expect, it } from "vitest";

import { estimateLatency } from "./latency";

describe("estimateLatency", () => {
  const clicks = [0, 0.5, 1, 1.5, 2, 2.5];

  it("devuelve la mediana de los desfases e ignora golpes lejanos", () => {
    const taps = [0.04, 0.54, 1.05, 1.53, 2.04, 3.2];
    const estimate = estimateLatency(taps, clicks);
    expect(estimate).toEqual({ offsetMs: 40, spreadMs: 0, used: 5 });
  });

  it("detecta golpes adelantados", () => {
    expect(estimateLatency([0.47, 0.98, 1.47], clicks)?.offsetMs).toBe(-30);
  });

  it("null si no hay golpes cerca de ningún clic", () => {
    expect(estimateLatency([5, 6], clicks)).toBeNull();
  });
});
