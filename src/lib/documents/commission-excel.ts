import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { companyForDocument } from "@/lib/company/profile";
import { appendCompanyBank } from "./company-block";

const day = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

/** Build the buying-house's commission invoice to the buyer (.xlsx) for one ledger entry.
 *  Tenant-scoped; returns null if the entry isn't in the actor's company. */
export async function buildCommissionInvoiceWorkbook(actor: SessionUser, id: string): Promise<{ buffer: Buffer; filename: string } | null> {
  assertPermission(actor, "finance", "view");
  const cid = tenantId(actor);
  const c = await prisma.commissionEntry.findFirst({ where: { id, companyId: cid } });
  if (!c) return null;
  const [buyer, factory, company] = await Promise.all([
    c.buyerId ? prisma.buyer.findFirst({ where: { id: c.buyerId, companyId: cid }, select: { name: true } }) : null,
    c.factoryId ? prisma.factory.findFirst({ where: { id: c.factoryId, companyId: cid }, select: { name: true } }) : null,
    companyForDocument(cid),
  ]);

  const factoryValue = Number(c.factoryInvoiceValue ?? 0);
  const pct = Number(c.commissionPct ?? 0);
  const commission = Math.round(factoryValue * pct) / 100; // value × pct%

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pulse OMS";
  const ws = wb.addWorksheet("Commission Invoice");
  ws.columns = [{ width: 40 }, { width: 18 }, { width: 16 }, { width: 16 }];

  ws.mergeCells("A1:D1");
  const title = ws.getCell("A1");
  title.value = "COMMISSION INVOICE";
  title.font = { bold: true, size: 16 };

  const head: [string, string][] = [
    ["Own Invoice No", c.ownInvoiceNo || "—"],
    ["Bill To (Buyer)", buyer?.name ?? "—"],
    ["Issue Date", day(c.issueDate)],
    ["Due Date", day(c.dueDate)],
    ["Payment Status", c.paymentStatus || "—"],
    ["Against Factory Invoice", c.factoryInvoiceNo || "—"],
    ["Factory", factory?.name ?? "—"],
  ];
  ws.addRow([]);
  for (const [k, v] of head) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  }

  ws.addRow([]);
  const th = ws.addRow(["Description", "Factory Value", "Commission %", "Amount"]);
  th.font = { bold: true };
  th.eachCell((cell) => { cell.border = { bottom: { style: "thin" } }; });

  const desc = `Buying commission on factory invoice ${c.factoryInvoiceNo || "—"}`;
  const line = ws.addRow([desc, factoryValue, pct, commission]);
  line.getCell(2).numFmt = "#,##0.00";
  line.getCell(3).numFmt = '#,##0.00"%"';
  line.getCell(4).numFmt = "#,##0.00";

  const total = ws.addRow(["TOTAL DUE", "", "", commission]);
  total.font = { bold: true };
  total.getCell(4).numFmt = "#,##0.00";
  total.eachCell((cell) => { cell.border = { top: { style: "thin" } }; });

  if (c.remarks) {
    ws.addRow([]);
    const n = ws.addRow(["Remarks", c.remarks]);
    n.getCell(1).font = { bold: true };
  }

  appendCompanyBank(ws, company);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const safe = (c.ownInvoiceNo || c.id).replace(/[^A-Za-z0-9._-]/g, "_");
  return { buffer, filename: `COMMISSION-${safe}.xlsx` };
}
