import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";

const day = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const num = (v: unknown) => Number(v ?? 0);

type Item = { style: string; colour: string; size: string; qty: number; price: number };

/** Build a formatted commercial Invoice document (.xlsx) for one invoice. Tenant-scoped;
 *  returns null if the invoice isn't in the actor's company. Line items + prices are derived
 *  from the linked shipment (preferred) or PO; the invoice's recorded amount is the official total. */
export async function buildInvoiceWorkbook(actor: SessionUser, invoiceId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  assertPermission(actor, "finance", "view");
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId: tenantId(actor) },
    include: {
      po: { include: { buyer: true, factory: true, lines: { include: { style: true, colour: true, sizes: true } } } },
      shipment: {
        include: { lines: { include: { sizes: true, orderLine: { include: { style: true, colour: true, sizes: true, po: { include: { buyer: true, factory: true } } } } } } },
      },
    },
  });
  if (!inv) return null;

  const isBuyer = inv.type === "BUYER";
  const priceOf = (sizes: { label: string; netFob: unknown; sellFob: unknown }[], label: string) => {
    const m = sizes.find((s) => s.label === label);
    return num(isBuyer ? m?.sellFob : m?.netFob);
  };

  // Derive line items: from the shipment if linked, else from the PO.
  const items: Item[] = [];
  let party = "—";
  let poNumber = inv.po?.poNumber ?? "—";
  if (inv.shipment) {
    const firstPo = inv.shipment.lines.find((l) => l.orderLine?.po)?.orderLine?.po;
    party = isBuyer ? firstPo?.buyer?.name ?? "—" : firstPo?.factory?.name ?? "—";
    poNumber = inv.po?.poNumber ?? firstPo?.poNumber ?? "—";
    for (const sl of inv.shipment.lines) {
      const ol = sl.orderLine;
      const style = ol?.style?.styleCode ?? ol?.style?.name ?? "—";
      const colour = ol?.colour?.name ?? "—";
      for (const s of sl.sizes) {
        items.push({ style, colour, size: s.label, qty: num(s.qty), price: priceOf(ol?.sizes ?? [], s.label) });
      }
    }
  } else if (inv.po) {
    party = isBuyer ? inv.po.buyer?.name ?? "—" : inv.po.factory?.name ?? "—";
    for (const line of inv.po.lines) {
      const style = line.style?.styleCode ?? line.style?.name ?? "—";
      const colour = line.colour?.name ?? "—";
      for (const s of line.sizes) {
        items.push({ style, colour, size: s.label, qty: num(s.qty), price: priceOf(line.sizes, s.label) });
      }
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pulse OMS";
  const ws = wb.addWorksheet("Invoice");
  ws.columns = [{ width: 26 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 16 }];

  ws.mergeCells("A1:F1");
  const title = ws.getCell("A1");
  title.value = isBuyer ? "COMMERCIAL INVOICE" : "FACTORY INVOICE";
  title.font = { bold: true, size: 16 };

  const head: [string, string][] = [
    ["Invoice Number", inv.number],
    ["Type", inv.type],
    [isBuyer ? "Bill To (Buyer)" : "From (Factory)", party],
    ["PO Number", poNumber],
    ["Issue Date", day(inv.issueDate)],
    ["Due Date", day(inv.dueDate)],
    ["Currency", inv.currency],
    ["Status", inv.status],
  ];
  ws.addRow([]);
  for (const [k, v] of head) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  }

  ws.addRow([]);
  const th = ws.addRow(["Style", "Colour", "Size", "Qty", "Unit Price", "Amount"]);
  th.font = { bold: true };
  th.eachCell((c) => { c.border = { bottom: { style: "thin" } }; });

  let lineTotal = 0;
  let totalQty = 0;
  for (const it of items) {
    const amount = Math.round(it.qty * it.price * 100) / 100;
    lineTotal += amount;
    totalQty += it.qty;
    const r = ws.addRow([it.style, it.colour, it.size, it.qty, it.price, amount]);
    r.getCell(4).numFmt = "#,##0";
    r.getCell(5).numFmt = "#,##0.0000";
    r.getCell(6).numFmt = "#,##0.00";
  }

  const subtotal = ws.addRow(["", "", "Line subtotal", totalQty, "", Math.round(lineTotal * 100) / 100]);
  subtotal.getCell(4).numFmt = "#,##0";
  subtotal.getCell(6).numFmt = "#,##0.00";
  subtotal.eachCell((c) => { c.border = { top: { style: "thin" } }; });

  // The invoice's recorded amount is the official, authoritative total (may differ from the
  // line subtotal if the amount was entered/overridden directly).
  const total = ws.addRow(["", "", "INVOICE TOTAL", "", inv.currency, num(inv.amount)]);
  total.font = { bold: true };
  total.getCell(6).numFmt = "#,##0.00";

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const safe = inv.number.replace(/[^A-Za-z0-9._-]/g, "_");
  return { buffer, filename: `INVOICE-${safe}.xlsx` };
}
