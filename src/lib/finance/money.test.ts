import { describe, it, expect } from "vitest";
import { outstanding, ageBucket, isSettled, derivedPaymentStatus } from "./money";

describe("outstanding", () => {
  it("invoice amount minus payments, floored at 0", () => {
    expect(outstanding("1000.00", [{ amount: "400.00" }, { amount: "100.00" }])).toBe(500);
    expect(outstanding("1000.00", [{ amount: "1000.00" }])).toBe(0);
    expect(outstanding("1000.00", [{ amount: "1200.00" }])).toBe(0);
  });
  it("penny-safe (no float drift)", () => {
    expect(outstanding("0.30", [{ amount: "0.10" }, { amount: "0.10" }])).toBe(0.1);
  });
});

describe("isSettled / derivedPaymentStatus (ledger as source of truth)", () => {
  it("isSettled is true only when payments cover the amount", () => {
    expect(isSettled("1000", [{ amount: "1000" }])).toBe(true);
    expect(isSettled("1000", [{ amount: "1200" }])).toBe(true);
    expect(isSettled("1000", [{ amount: "999.99" }])).toBe(false);
    expect(isSettled("1000", [])).toBe(false);
  });
  it("derivedPaymentStatus reflects the payment ledger, not a stored flag", () => {
    expect(derivedPaymentStatus("1000", [])).toBe("ISSUED");
    expect(derivedPaymentStatus("1000", [{ amount: "400" }])).toBe("PARTIALLY_PAID");
    expect(derivedPaymentStatus("1000", [{ amount: "1000" }])).toBe("PAID");
  });
});

describe("ageBucket", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  it("buckets by days since issue", () => {
    expect(ageBucket(new Date("2026-06-10T00:00:00Z"), now)).toBe("0-30"); // 5d
    expect(ageBucket(new Date("2026-05-01T00:00:00Z"), now)).toBe("31-60"); // 45d
    expect(ageBucket(new Date("2026-04-01T00:00:00Z"), now)).toBe("61-90"); // 75d
    expect(ageBucket(new Date("2026-01-01T00:00:00Z"), now)).toBe("90+"); // 165d
  });
});
