import { describe, it, expect } from "vitest";
import { computeAlerts, type AlertData } from "./rules";

const EMPTY: AlertData = {
  milestonesOverdue: [],
  exFtySoon: [],
  paymentsOverdue: [],
  samplesPending: [],
  docsMissing: [],
};

describe("computeAlerts", () => {
  it("returns [] for no data", () => {
    expect(computeAlerts(EMPTY)).toEqual([]);
  });

  it("maps each category to a draft with stable dedupKey + roles", () => {
    const drafts = computeAlerts({
      ...EMPTY,
      milestonesOverdue: [{ id: "m1", poId: "po1", poNumber: "P-1", name: "PP sample" }],
      exFtySoon: [{ poId: "po2", poNumber: "P-2", exFactoryDate: new Date("2026-06-20T00:00:00Z") }],
      paymentsOverdue: [{ invoiceId: "inv1", number: "ABD-1", poId: "po3" }],
      samplesPending: [{ id: "s1", poId: "po4", poNumber: "P-4", type: "PP" }],
      docsMissing: [{ poId: "po5", poNumber: "P-5" }],
    });

    const byKey = Object.fromEntries(drafts.map((d) => [d.dedupKey, d]));
    expect(byKey["milestone-overdue:m1"].roles).toEqual(["MERCHANDISER", "ADMIN"]);
    expect(byKey["ex-fty-7d:po2"].type).toBe("EX_FACTORY_SOON");
    expect(byKey["ex-fty-7d:po2"].message).toContain("2026-06-20");
    expect(byKey["payment-overdue:inv1"].roles).toEqual(["ACCOUNTS", "ADMIN"]);
    expect(byKey["payment-overdue:inv1"].link).toBe("/orders/po3");
    expect(byKey["sample-pending:s1"].type).toBe("SAMPLE_PENDING");
    expect(byKey["doc-missing:po5"].link).toBe("/orders/po5");
  });

  it("falls back to /finance link when an overdue payment has no PO", () => {
    const [d] = computeAlerts({ ...EMPTY, paymentsOverdue: [{ invoiceId: "i", number: "X", poId: null }] });
    expect(d.link).toBe("/finance");
  });
});
