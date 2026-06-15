import { describe, it, expect } from "vitest";
import { productionProgress } from "./progress";

describe("productionProgress", () => {
  it("computes percent of ordered qty for each stage", () => {
    expect(productionProgress(1000, { cutQty: 500, sewQty: 250, finishQty: 100 })).toEqual({
      cutPct: 50,
      sewPct: 25,
      finishPct: 10,
    });
  });

  it("rounds to a whole percent", () => {
    expect(productionProgress(300, { cutQty: 100, sewQty: 0, finishQty: 0 }).cutPct).toBe(33);
  });

  it("returns zeros when ordered qty is zero (no divide-by-zero)", () => {
    expect(productionProgress(0, { cutQty: 0, sewQty: 0, finishQty: 0 })).toEqual({
      cutPct: 0,
      sewPct: 0,
      finishPct: 0,
    });
  });

  it("caps each stage at 100 percent", () => {
    expect(productionProgress(100, { cutQty: 150, sewQty: 120, finishQty: 100 })).toEqual({
      cutPct: 100,
      sewPct: 100,
      finishPct: 100,
    });
  });
});
