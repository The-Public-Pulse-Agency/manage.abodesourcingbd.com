import ExcelJS from "exceljs";
import { getPurchaseOrder } from "@/lib/orders/po";
import type { SessionUser } from "@/lib/auth/guard";

const day = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const num = (v: unknown) => Number(v ?? 0);

/** Build a formatted Purchase Order document (.xlsx) for one PO. Returns null if not found
 *  (getPurchaseOrder is tenant-scoped, so cross-tenant ids resolve to null). */
export async function buildPoWorkbook(actor: SessionUser, poId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const po = await getPurchaseOrder(actor, poId);
  if (!po) return null;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pulse OMS";
  const ws = wb.addWorksheet("Purchase Order");
  ws.columns = [{ width: 26 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 16 }];

  ws.mergeCells("A1:F1");
  const title = ws.getCell("A1");
  title.value = "PURCHASE ORDER";
  title.font = { bold: true, size: 16 };

  // Header block (label/value pairs).
  const head: [string, string][] = [
    ["PO Number", po.poNumber],
    ["Order Date", day(po.orderDate)],
    ["Buyer", po.buyer?.name ?? "—"],
    ["Brand", po.brand?.name ?? "—"],
    ["Factory", po.factory?.name ?? "—"],
    ["Channel", po.channel ?? "—"],
    ["Currency", po.currency],
    ["Confirmed Ship (Ex-factory)", day(po.exFactoryDate)],
    ["Customer Requested Date", day(po.crd)],
    ["Status", po.status],
  ];
  ws.addRow([]);
  for (const [k, v] of head) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  }

  // Line items: one row per size.
  ws.addRow([]);
  const th = ws.addRow(["Style", "Colour", "Size", "Qty", "Unit Price", "Amount"]);
  th.font = { bold: true };
  th.eachCell((c) => { c.border = { bottom: { style: "thin" } }; });

  let totalQty = 0;
  let totalValue = 0;
  for (const line of po.lines) {
    const style = line.style?.styleCode ?? line.style?.name ?? "—";
    const colour = line.colour?.name ?? "—";
    for (const s of line.sizes) {
      const qty = num(s.qty);
      const price = num(s.sellFob);
      const amount = Math.round(qty * price * 100) / 100;
      totalQty += qty;
      totalValue += amount;
      const r = ws.addRow([style, colour, s.label, qty, price, amount]);
      r.getCell(4).numFmt = "#,##0";
      r.getCell(5).numFmt = "#,##0.0000";
      r.getCell(6).numFmt = "#,##0.00";
    }
  }

  const totalRow = ws.addRow(["", "", "Total", totalQty, "", Math.round(totalValue * 100) / 100]);
  totalRow.font = { bold: true };
  totalRow.getCell(4).numFmt = "#,##0";
  totalRow.getCell(6).numFmt = "#,##0.00";
  totalRow.eachCell((c) => { c.border = { top: { style: "thin" } }; });

  if (po.notes) {
    ws.addRow([]);
    const n = ws.addRow(["Remarks", po.notes]);
    n.getCell(1).font = { bold: true };
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const safe = po.poNumber.replace(/[^A-Za-z0-9._-]/g, "_");
  return { buffer, filename: `PO-${safe}.xlsx` };
}
