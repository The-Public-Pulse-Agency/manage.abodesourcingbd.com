import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function listMovements(actor: SessionUser) {
  assertPermission(actor, "sampling", "view");
  return prisma.sampleMovement.findMany({
    where: { companyId: tenantId(actor) },
    orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
  });
}

// Distinct PO numbers for the tenant — used to power autocomplete on the sampling forms.
export async function listPoNumbers(actor: SessionUser): Promise<string[]> {
  assertPermission(actor, "sampling", "view");
  const rows = await prisma.purchaseOrder.findMany({
    where: { companyId: tenantId(actor) },
    select: { poNumber: true },
    distinct: ["poNumber"],
    orderBy: { poNumber: "asc" },
  });
  return rows.map((r) => r.poNumber.trim()).filter(Boolean);
}

export const createMovementSchema = z.object({
  direction: z.enum(["IN", "OUT"]),
  movementDate: z.string().optional(),
  sampleType: z.string().optional(),
  qty: z.coerce.number().optional(),
  artNo: z.string().min(1, "Art/Style no is required"),
  buyer: z.string().optional(),
  poNumber: z.string().optional(),
  factoryName: z.string().optional(),
  colour: z.string().optional(),
  receivedFrom: z.string().optional(),
  sentTo: z.string().optional(),
  courierName: z.string().optional(),
  awbNumber: z.string().optional(),
  remarks: z.string().optional(),
});
export type CreateMovementInput = z.input<typeof createMovementSchema>;

const parseDate = (v?: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);
const trimOrNull = (v?: string) => (v?.trim() ? v.trim() : null);
const intOrNull = (v?: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;

export async function createMovement(actor: SessionUser, input: CreateMovementInput) {
  assertPermission(actor, "sampling", "create");
  const data = createMovementSchema.parse(input);
  const item = await prisma.sampleMovement.create({
    data: {
      companyId: tenantId(actor),
      direction: data.direction,
      movementDate: parseDate(data.movementDate),
      sampleType: trimOrNull(data.sampleType),
      qty: intOrNull(data.qty),
      artNo: data.artNo.trim(),
      buyer: trimOrNull(data.buyer),
      poNumber: trimOrNull(data.poNumber),
      factoryName: trimOrNull(data.factoryName),
      colour: trimOrNull(data.colour),
      receivedFrom: trimOrNull(data.receivedFrom),
      sentTo: trimOrNull(data.sentTo),
      courierName: trimOrNull(data.courierName),
      awbNumber: trimOrNull(data.awbNumber),
      remarks: trimOrNull(data.remarks),
    },
  });
  await recordAudit({ userId: actor.id, entityType: "SampleMovement", entityId: item.id, action: "create", after: { direction: data.direction, artNo: data.artNo } });
  return item;
}

const TEXT_FIELDS = ["sampleType", "artNo", "buyer", "poNumber", "factoryName", "colour", "receivedFrom", "sentTo", "courierName", "awbNumber", "remarks", "direction"] as const;
const DATE_FIELDS = ["movementDate"] as const;
const NUMBER_FIELDS = ["qty"] as const;

export type MovementField =
  | (typeof TEXT_FIELDS)[number]
  | (typeof DATE_FIELDS)[number]
  | (typeof NUMBER_FIELDS)[number];

export async function updateMovementField(actor: SessionUser, id: string, field: MovementField, value: string) {
  assertPermission(actor, "sampling", "edit");
  const cid = tenantId(actor);
  const existing = await prisma.sampleMovement.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!existing) throw new Error("Sample movement not found");

  const data: Record<string, string | number | Date | null> = {};
  if ((DATE_FIELDS as readonly string[]).includes(field)) {
    data[field] = value ? new Date(`${value}T00:00:00.000Z`) : null;
  } else if ((NUMBER_FIELDS as readonly string[]).includes(field)) {
    const n = value === "" ? null : Number(value);
    data[field] = n === null ? null : Number.isFinite(n) ? Math.trunc(n) : null;
  } else if ((TEXT_FIELDS as readonly string[]).includes(field)) {
    if (field === "direction") {
      if (value !== "IN" && value !== "OUT") throw new Error("Direction must be IN or OUT");
      data.direction = value;
    } else if (field === "artNo") {
      const v = value.trim();
      if (!v) throw new Error("Art/Style no is required");
      data.artNo = v;
    } else {
      data[field] = value.trim() || null;
    }
  } else throw new Error("Invalid field");

  await prisma.sampleMovement.update({ where: { id }, data });
}

export async function deleteMovement(actor: SessionUser, id: string) {
  assertPermission(actor, "sampling", "edit");
  await prisma.sampleMovement.deleteMany({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "SampleMovement", entityId: id, action: "delete" });
}

// ---- Pure summary helper (no actor / no DB) ----

type Row = {
  direction: string;
  qty: number | null;
  artNo: string | null;
  buyer: string | null;
  factoryName: string | null;
  movementDate: Date | null;
  createdAt: Date;
};

export type ArtSummary = {
  artNo: string;
  totalIn: number;
  totalOut: number;
  balance: number;
  lastMovement: Date | null;
  status: "In Stock" | "Partially Sent" | "Fully Sent";
};

export type SampleDashboard = {
  totalReceived: number;
  totalSent: number;
  currentInOffice: number;
  pendingDispatch: number;
  byBuyer: Array<{ name: string; qty: number }>;
  byFactory: Array<{ name: string; qty: number }>;
};

export function summarise(rows: Row[]): { perArt: ArtSummary[]; dashboard: SampleDashboard } {
  const q = (r: Row) => r.qty ?? 0;
  const isIn = (r: Row) => r.direction === "IN";

  // Group by artNo.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.artNo ?? "";
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  const perArt: ArtSummary[] = [];
  for (const [artNo, g] of groups) {
    const totalIn = g.filter(isIn).reduce((s, r) => s + q(r), 0);
    const totalOut = g.filter((r) => !isIn(r)).reduce((s, r) => s + q(r), 0);
    const balance = totalIn - totalOut;
    let lastMovement: Date | null = null;
    for (const r of g) {
      const d = r.movementDate ?? r.createdAt;
      if (d && (!lastMovement || d > lastMovement)) lastMovement = d;
    }
    const status: ArtSummary["status"] =
      totalOut === 0 ? "In Stock" : balance <= 0 ? "Fully Sent" : "Partially Sent";
    perArt.push({ artNo, totalIn, totalOut, balance, lastMovement, status });
  }

  const totalReceived = rows.filter(isIn).reduce((s, r) => s + q(r), 0);
  const totalSent = rows.filter((r) => !isIn(r)).reduce((s, r) => s + q(r), 0);
  const currentInOffice = totalReceived - totalSent;
  const pendingDispatch = perArt.filter((a) => a.balance > 0).length;

  const sumBy = (key: "buyer" | "factoryName") => {
    const m = new Map<string, number>();
    for (const r of rows.filter(isIn)) {
      const name = (r[key] ?? "").trim();
      if (!name) continue;
      m.set(name, (m.get(name) ?? 0) + q(r));
    }
    return Array.from(m, ([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
  };

  return {
    perArt,
    dashboard: {
      totalReceived,
      totalSent,
      currentInOffice,
      pendingDispatch,
      byBuyer: sumBy("buyer"),
      byFactory: sumBy("factoryName"),
    },
  };
}
