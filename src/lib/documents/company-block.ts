import ExcelJS from "exceljs";
import type { CompanyProfile } from "@/lib/company/profile";

/** Append a "Banking Details (Pay To)" block to a worksheet — only the bank fields that are
 *  filled in. No-op when the company has no banking details, so docs stay clean until set up. */
export function appendCompanyBank(ws: ExcelJS.Worksheet, company: CompanyProfile | null) {
  if (!company) return;
  const lines: [string, string | null][] = [
    ["Bank", company.bankName],
    ["Account Name", company.bankAccountName],
    ["Account No", company.bankAccountNo],
    ["SWIFT / BIC", company.bankSwift],
    ["Branch / Address", company.bankBranch],
  ];
  if (!lines.some(([, v]) => v)) return;
  ws.addRow([]);
  const h = ws.addRow(["BANKING DETAILS (PAY TO)"]);
  h.getCell(1).font = { bold: true };
  for (const [k, v] of lines) {
    if (!v) continue;
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  }
}
