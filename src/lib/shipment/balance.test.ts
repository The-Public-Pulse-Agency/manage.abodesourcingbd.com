import { describe, it, expect } from "vitest";
import { remainingBySize, assertWithinBalance, excessBySize, overShipNote } from "./balance";

describe("remainingBySize", () => {
  it("computes ordered - shipped per size label", () => {
    expect(
      remainingBySize([{ label: "M", qty: 100 }, { label: "L", qty: 60 }], [{ label: "M", qty: 40 }]),
    ).toEqual([
      { label: "M", ordered: 100, shipped: 40, balance: 60 },
      { label: "L", ordered: 60, shipped: 0, balance: 60 },
    ]);
  });
  it("aggregates shipped across multiple shipment rows for the same label", () => {
    const out = remainingBySize([{ label: "M", qty: 100 }], [{ label: "M", qty: 30 }, { label: "M", qty: 50 }]);
    expect(out[0].balance).toBe(20);
  });
});

describe("assertWithinBalance", () => {
  it("passes when requested <= balance", () => {
    expect(() => assertWithinBalance([{ label: "M", ordered: 100, shipped: 40, balance: 60 }], [{ label: "M", qty: 60 }])).not.toThrow();
  });
  it("ALLOWS over-shipment (factories over-produce; excess is noted, not blocked)", () => {
    // Over-shipping a valid size no longer throws — the excess is surfaced via excessBySize/overShipNote.
    expect(() => assertWithinBalance([{ label: "M", ordered: 100, shipped: 40, balance: 60 }], [{ label: "M", qty: 61 }])).not.toThrow();
  });
  it("throws for a label not in the order line", () => {
    expect(() => assertWithinBalance([{ label: "M", ordered: 100, shipped: 0, balance: 100 }], [{ label: "XXL", qty: 1 }])).toThrow(/not in the order/i);
  });
});

describe("over-shipment reporting", () => {
  it("excessBySize + overShipNote surface the extra qty without blocking", () => {
    const balances = [{ label: "M", ordered: 100, shipped: 40, balance: 60 }];
    const excess = excessBySize(balances, [{ label: "M", qty: 70 }]);
    expect(excess).toEqual([{ label: "M", excess: 10 }]);
    expect(overShipNote(excess)).toMatch(/M \+10/);
    expect(overShipNote(excessBySize(balances, [{ label: "M", qty: 50 }]))).toBeNull();
  });
});
