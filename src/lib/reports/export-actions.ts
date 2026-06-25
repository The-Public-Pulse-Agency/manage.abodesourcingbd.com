"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format";
import { openOrdersForExport, type OpenOrdersFilter } from "./open-orders";

export async function openOrdersExportAction(filter: OpenOrdersFilter): Promise<(string | number)[][]> {
  const actor = await getCurrentUser();
  if (!actor) return [];
  const rows = await openOrdersForExport(actor, filter);
  // One row PER STYLE — each line is a single style with its own qty/value/sizes/colours,
  // and the PO-level fields repeated so every row is self-contained in Excel. Critical-path
  // status is intentionally omitted (it lives on the Critical Path report).
  return rows.flatMap((r) =>
    r.styleBreakdown.map((s) => [
      r.poNumber, r.status, formatDate(r.poReceiveDate), r.factory, r.buyer, r.brand,
      s.style, s.sizes, s.colours, s.qty, s.netFob || 0, s.value || 0,
      formatDate(r.confirmedShipDate), r.remarks,
    ]),
  );
}
