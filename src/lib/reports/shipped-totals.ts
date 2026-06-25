// Pure helpers for the Shipped Goods footer totals (no DB imports — safe for the client table).

/**
 * Sum invoice values ONCE per invoice id. A PO-level invoice can surface on several shipment
 * rows (the register falls back to the PO's invoice when a shipment isn't directly linked), so a
 * naive row-sum double-counts it. Dedupe by invoiceId — matching the dashboard receivable KPI.
 */
export function sumDistinctInvoiceValue(rows: { invoiceId: string | null; invoiceValue: number | null }[]): number {
  const byInvoice = new Map<string, number>();
  for (const r of rows) if (r.invoiceId && r.invoiceValue) byInvoice.set(r.invoiceId, r.invoiceValue);
  return [...byInvoice.values()].reduce((a, v) => a + v, 0);
}
