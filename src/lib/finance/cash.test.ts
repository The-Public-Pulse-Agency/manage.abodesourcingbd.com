import { describe, it, expect } from "vitest";
import { cashSummary, monthKey, type CashEntryRow } from "./cash";

const r = (kind: "RECEIVED" | "EXPENSE", date: string, amountBdt: number, head: string | null = null): CashEntryRow => ({
  id: date + amountBdt, kind, entryDate: new Date(`${date}T00:00:00.000Z`), amountBdt, sender: null, purpose: null, head, note: null,
});

describe("cashSummary", () => {
  it("computes opening (prior net), this-month totals, closing + per-head", () => {
    const rows = [
      r("RECEIVED", "2026-05-10", 1000),
      r("EXPENSE", "2026-05-15", 200),
      r("RECEIVED", "2026-06-05", 500),
      r("EXPENSE", "2026-06-08", 100, "Office Rent"),
      r("EXPENSE", "2026-06-20", 50, "Office Rent"),
    ];
    const s = cashSummary(rows, "2026-06");
    expect(s.opening).toBe(800); // 1000 - 200 from May
    expect(s.received).toBe(500);
    expect(s.expenses).toBe(150);
    expect(s.closing).toBe(1150); // 800 + 500 - 150
    expect(s.byHead).toEqual([{ head: "Office Rent", amount: 150 }]);
  });

  it("monthKey buckets by YYYY-MM", () => {
    expect(monthKey(new Date("2026-06-23T00:00:00.000Z"))).toBe("2026-06");
  });
});
