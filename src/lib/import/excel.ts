import ExcelJS from "exceljs";
import type { RawRow } from "./normalize";

/**
 * Reads the "Open PO's" and "Shipped" style sheets and returns raw rows.
 * Columns are addressed positionally: A=Factory, B=Brand, ... D/E=Style name.
 */
export async function readMasterDataRows(buffer: Buffer): Promise<RawRow[]> {
  const wb = new ExcelJS.Workbook();
  // Cast bridges the Buffer generic mismatch between @types/node and ExcelJS.
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const rows: RawRow[] = [];
  wb.eachSheet((sheet) => {
    const name = sheet.name.toLowerCase();
    const isOpen = name.includes("open");
    const isShipped = name.includes("shipped");
    if (!isOpen && !isShipped) return;
    // Open PO's: Factory=A, Brand=B, Style=D. Shipped: Factory=B, Brand=C, Style=E.
    const cols = isOpen
      ? { factory: 1, brand: 2, style: 4 }
      : { factory: 2, brand: 3, style: 5 };
    sheet.eachRow((row, n) => {
      if (n <= 2) return; // header rows
      rows.push({
        factory: cellText(row.getCell(cols.factory)),
        brand: cellText(row.getCell(cols.brand)),
        styleName: cellText(row.getCell(cols.style)),
      });
    });
  });
  return rows;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
  return String(v);
}
