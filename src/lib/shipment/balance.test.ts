import { describe, it, expect } from "vitest";
import { remainingBySize, assertWithinBalance } from "./balance";

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
  it("throws when a size is over-shipped", () => {
    expect(() => assertWithinBalance([{ label: "M", ordered: 100, shipped: 40, balance: 60 }], [{ label: "M", qty: 61 }])).toThrow(/exceeds balance/i);
  });
  it("throws for a label not in the order line", () => {
    expect(() => assertWithinBalance([{ label: "M", ordered: 100, shipped: 0, balance: 100 }], [{ label: "XXL", qty: 1 }])).toThrow(/not in the order/i);
  });
});
