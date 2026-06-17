"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format";
import { openOrdersForExport, type OpenOrdersFilter, type StatusCell } from "./open-orders";

const cellText = (c: StatusCell) => (c.state === "na" ? "—" : c.state === "done" ? `done ${c.date ? formatDate(c.date) : ""}`.trim() : c.state);

export async function openOrdersExportAction(filter: OpenOrdersFilter): Promise<(string | number)[][]> {
  const actor = await getCurrentUser();
  if (!actor) return [];
  const rows = await openOrdersForExport(actor, filter);
  return rows.map((r) => [
    r.poNumber, r.status, formatDate(r.poReceiveDate), r.factory, r.buyer, r.sizes, r.colours,
    formatDate(r.confirmedShipDate), r.qty, r.totalValue || 0,
    cellText(r.trims), cellText(r.yarn), cellText(r.dyeing), cellText(r.bulkShade), cellText(r.ppSample), cellText(r.bulkSewing),
    formatDate(r.finalInspectionDate),
  ]);
}
