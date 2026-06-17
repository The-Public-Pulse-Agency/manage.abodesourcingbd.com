import ExcelJS from "exceljs";

export type OrderImportRow = {
  poNumber: string;
  buyer: string;
  brand: string;
  factory: string;
  style: string;
  colour: string;
  size: string;
  qty: number;
  netFob: number;
  sellFob: number;
  orderDate: string;
  shipDate: string;
  currency: string;
};

// Accepted header spellings → canonical field. Matched case-insensitively, trimmed.
const HEADER_MAP: Record<string, keyof OrderImportRow> = {
  "po number": "poNumber", po: "poNumber", "po no": "poNumber",
  buyer: "buyer", brand: "brand", factory: "factory",
  style: "style", "style ref": "style", "style no": "style",
  colour: "colour", color: "colour",
  size: "size", qty: "qty", quantity: "qty",
  "net fob": "netFob", "cost fob": "netFob",
  "sell fob": "sellFob", fob: "sellFob", price: "sellFob",
  "order date": "orderDate", "po date": "orderDate",
  "ship date": "shipDate", "confirmed ship": "shipDate", "ex factory": "shipDate",
  currency: "currency",
};

function text(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
  if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result);
  return String(v).trim();
}

/** Parse an orders .xlsx by HEADER NAME (first row = headers) into raw rows. */
export async function readOrderRows(buffer: Buffer): Promise<OrderImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const colOf: Partial<Record<keyof OrderImportRow, number>> = {};
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, col) => {
    const key = HEADER_MAP[text(cell).toLowerCase().trim()];
    if (key) colOf[key] = col;
  });
  if (colOf.poNumber === undefined) throw new Error('Could not find a "PO Number" column in the sheet header.');

  const rows: OrderImportRow[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return; // header
    const get = (k: keyof OrderImportRow) => (colOf[k] ? text(row.getCell(colOf[k]!)) : "");
    const poNumber = get("poNumber");
    if (!poNumber) return; // skip blank rows
    const num = (s: string) => { const v = Number(String(s).replace(/[^0-9.\-]/g, "")); return Number.isFinite(v) ? v : 0; };
    rows.push({
      poNumber,
      buyer: get("buyer"), brand: get("brand"), factory: get("factory"),
      style: get("style"), colour: get("colour"), size: get("size") || "PCS",
      qty: Math.max(0, Math.round(num(get("qty")))),
      netFob: num(get("netFob")), sellFob: num(get("sellFob")) || num(get("netFob")),
      orderDate: get("orderDate"), shipDate: get("shipDate"), currency: get("currency") || "USD",
    });
  });
  return rows;
}

export const ORDER_TEMPLATE_HEADERS = [
  "PO Number", "Buyer", "Brand", "Factory", "Style", "Colour", "Size", "Qty", "Net FOB", "Sell FOB", "Order Date", "Ship Date", "Currency",
];
export const ORDER_TEMPLATE_SAMPLE = [
  ["PO-1001", "Ralawise", "TriDri", "Liz Fashion", "TR010", "Black", "M", 500, 1.8, 2.4, "2026-06-01", "2026-08-15", "USD"],
  ["PO-1001", "Ralawise", "TriDri", "Liz Fashion", "TR010", "Black", "L", 700, 1.8, 2.4, "2026-06-01", "2026-08-15", "USD"],
  ["PO-1001", "Ralawise", "TriDri", "Liz Fashion", "TR010", "Navy", "M", 300, 1.8, 2.4, "2026-06-01", "2026-08-15", "USD"],
];

/** Build the demo template workbook buffer (headers + sample rows + guidance). */
export async function buildOrderTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Orders");
  ws.addRow(ORDER_TEMPLATE_HEADERS);
  ws.getRow(1).font = { bold: true };
  for (const r of ORDER_TEMPLATE_SAMPLE) ws.addRow(r);
  ws.columns.forEach((c) => { c.width = 14; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
