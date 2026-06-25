import { describe, it, expect } from "vitest";
import { sumDistinctInvoiceValue } from "./shipped-totals";

describe("sumDistinctInvoiceValue", () => {
  it("counts a shared PO invoice once across multiple shipment rows", () => {
    const rows = [
      { invoiceId: "inv1", invoiceValue: 1000 },
      { invoiceId: "inv1", invoiceValue: 1000 }, // same PO invoice surfaced on a 2nd shipment row
      { invoiceId: "inv2", invoiceValue: 500 },
      { invoiceId: null, invoiceValue: null }, // shipment with no invoice
    ];
    expect(sumDistinctInvoiceValue(rows)).toBe(1500); // 1000 + 500, NOT 2500
  });

  it("returns 0 when there are no invoices", () => {
    expect(sumDistinctInvoiceValue([{ invoiceId: null, invoiceValue: null }])).toBe(0);
  });
});
