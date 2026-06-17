import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { businessToday } from "@/lib/tna/schedule";
import { lineMills, rollup, type Decimalish } from "@/lib/orders/money";

const OPEN_STATUSES = ["DRAFT", "CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED"] as const;

export type StatusCell = { state: "done" | "overdue" | "pending" | "na"; date: Date | null };

export type OpenOrderRow = {
  id: string;
  poNumber: string;
  status: string;
  poReceiveDate: Date | null;
  factory: string;
  buyer: string;
  sizes: string;
  colours: string;
  confirmedShipDate: Date | null;
  pricePerUnit: number;
  totalValue: number;
  currency: string;
  trims: StatusCell;
  yarn: StatusCell;
  dyeing: StatusCell;
  bulkShade: StatusCell;
  ppSample: StatusCell;
  bulkSewing: StatusCell;
  finalInspectionDate: Date | null;
};

// Which critical-path milestone backs each status column.
const KEY = {
  trims: "TRIMS_BOOKED",
  yarn: "FABRIC_BOOKED",
  dyeing: "FABRIC_IN", // bulk fabric in-house ≈ dyeing complete
  bulkShade: "LAB_DIP", // lab-dip approval = bulk shade approval
  ppSample: "PP_SAMPLE",
  bulkSewing: "SEWING",
} as const;

export async function openOrdersReport(actor: SessionUser, opts: { now?: Date } = {}): Promise<OpenOrderRow[]> {
  assertPermission(actor, "orders", "view");
  const today = businessToday(opts.now ?? new Date());

  const pos = await prisma.purchaseOrder.findMany({
    where: { status: { in: [...OPEN_STATUSES] }, companyId: tenantId(actor) },
    include: {
      buyer: true,
      factory: true,
      lines: { include: { sizes: true, colour: true } },
      milestones: { select: { key: true, plannedDate: true, actualDate: true } },
    },
    orderBy: [{ exFactoryDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  return pos.map((po) => {
    const byKey = new Map(po.milestones.map((m) => [m.key, m]));
    const cell = (k: string): StatusCell => {
      const m = byKey.get(k);
      if (!m) return { state: "na", date: null };
      if (m.actualDate) return { state: "done", date: m.actualDate };
      if (m.plannedDate && m.plannedDate < today) return { state: "overdue", date: m.plannedDate };
      return { state: "pending", date: m.plannedDate };
    };

    const sizes = [...new Set(po.lines.flatMap((l) => l.sizes.map((s) => s.label)))].join(", ");
    const colours = [...new Set(po.lines.map((l) => l.colour?.name).filter(Boolean) as string[])].join(", ");
    const totals = rollup(po.lines.map((l) => lineMills(l.sizes as { qty: number; netFob: Decimalish; sellFob: Decimalish }[])));

    return {
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      poReceiveDate: po.orderDate,
      factory: po.factory.name,
      buyer: po.buyer.name,
      sizes: sizes || "—",
      colours: colours || "—",
      confirmedShipDate: po.exFactoryDate,
      pricePerUnit: totals.qty > 0 ? Math.round((totals.value / totals.qty) * 10000) / 10000 : 0,
      totalValue: totals.value,
      currency: po.currency,
      trims: cell(KEY.trims),
      yarn: cell(KEY.yarn),
      dyeing: cell(KEY.dyeing),
      bulkShade: cell(KEY.bulkShade),
      ppSample: cell(KEY.ppSample),
      bulkSewing: cell(KEY.bulkSewing),
      finalInspectionDate: byKey.get("FINAL_AQL")?.actualDate ?? null,
    };
  });
}
