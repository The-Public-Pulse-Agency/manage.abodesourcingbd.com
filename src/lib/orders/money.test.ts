import { describe, it, expect } from "vitest";
import { lineTotals, lineMills, rollup, type SizeRow } from "./money";

const sizes: SizeRow[] = [
  { qty: 100, netFob: "1.50", sellFob: "2.00" },
  { qty: 50, netFob: 1.5, sellFob: 2 },
];

describe("lineTotals", () => {
  it("sums qty, value (qty*sellFob), cost and margin", () => {
    const t = lineTotals(sizes);
    expect(t.qty).toBe(150);
    expect(t.value).toBe(300);
    expect(t.cost).toBe(225);
    expect(t.margin).toBe(75);
  });

  it("handles a simple fractional FOB", () => {
    const t = lineTotals([{ qty: 3, netFob: "0.10", sellFob: "0.30" }]);
    expect(t.value).toBe(0.9);
    expect(t.margin).toBe(0.6);
  });

  it("returns zeros for no sizes", () => {
    expect(lineTotals([])).toEqual({ qty: 0, value: 0, cost: 0, margin: 0 });
  });

  // Adversarial vector: margin must be Σ qty*(sell-net), rounded once — NOT value-cost
  // of two separately-rounded numbers (that buggy form yields 1.18 here).
  it("computes 4dp margin without cent drift", () => {
    const t = lineTotals([{ qty: 3, netFob: "0.2688", sellFob: "0.6643" }]);
    expect(t.value).toBe(1.99);
    expect(t.cost).toBe(0.81);
    expect(t.margin).toBe(1.19);
  });

  // Adversarial vector: per-size sub-cent extensions must sum exactly, not round per row
  // (buggy per-row rounding yields 0.06).
  it("sums sub-cent per-size extensions exactly", () => {
    const t = lineTotals([
      { qty: 1, netFob: 0, sellFob: "0.0150" },
      { qty: 1, netFob: 0, sellFob: "0.0150" },
      { qty: 1, netFob: 0, sellFob: "0.0150" },
    ]);
    expect(t.value).toBe(0.05);
  });
});

describe("rollup", () => {
  it("aggregates multiple line mills, rounding once", () => {
    const total = rollup([lineMills(sizes), lineMills([{ qty: 10, netFob: 1, sellFob: 3 }])]);
    expect(total.qty).toBe(160);
    expect(total.value).toBe(330);
    expect(total.margin).toBe(95);
  });

  // Adversarial vector: a 10-line PO of 4dp prices must not compound cent errors.
  it("rolls up 10 lines without compounding drift", () => {
    const parts = Array.from({ length: 10 }, () =>
      lineMills([{ qty: 1, netFob: "0.2688", sellFob: "0.6643" }]),
    );
    const total = rollup(parts);
    expect(total.value).toBe(6.64);
    expect(total.cost).toBe(2.69);
    expect(total.margin).toBe(3.96);
  });
});
