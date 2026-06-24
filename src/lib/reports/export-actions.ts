"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format";
import { openOrdersForExport, type OpenOrdersFilter, type StatusCell } from "./open-orders";

const cellText = (c: StatusCell) => (c.state === "na" ? "—" : c.state === "done" ? `done ${c.date ? formatDate(c.date) : ""}`.trim() : c.state);

export async function openOrdersExportAction(filter: OpenOrdersFilter): Promise<(string | number)[][]> {
  const actor = await getCurrentUser();
  if (!actor) return [];
  const rows = await openOrdersForExport(actor, filter);
  // One row PER STYLE — each line is a single style with its own qty/value/sizes/colours,
  // and the PO-level fields repeated so every row is self-contained in Excel.
  return rows.flatMap((r) =>
    r.styleBreakdown.map((s) => [
      r.poNumber, r.status, formatDate(r.poReceiveDate), r.factory, r.buyer, r.brand,
      s.style, s.sizes, s.colours, s.qty, s.value || 0,
      formatDate(r.confirmedShipDate), formatDate(r.crd),
      cellText(r.trims), cellText(r.yarn), cellText(r.dyeing), cellText(r.bulkShade), cellText(r.ppSample),
      cellText(r.cutting), cellText(r.bulkSewing), cellText(r.printEmb), cellText(r.topSample),
      formatDate(r.finalInspectionDate), r.remarks,
    ]),
  );
}
