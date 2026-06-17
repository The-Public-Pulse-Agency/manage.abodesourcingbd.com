import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";

export type ShippedRow = {
  id: string;
  reference: string;
  poNumber: string;
  poId: string | null;
  factory: string;
  buyer: string;
  sizes: string;
  colours: string;
  qty: number;
  shipDate: Date | null;
  etaDestination: Date | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceValue: number | null;
  invoiceDueDate: Date | null;
  paymentStatus: string | null;
  containerNo: string | null;
  tcStatus: string | null;
  remarks: string;
};

export type ShippedReport = {
  rows: ShippedRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** KPI bundle aggregated over ALL matching shipments (not just the visible page). */
  kpis: { shipments: number; totalQty: number; receivableUsd: number; paid: number; awaiting: number };
};

/**
 * Shipped-goods register: each shipment with buyer/factory/size/colour + invoice + TC.
 *
 * Paginated (skip/take + count) so the page never loads an unbounded result set. The KPI
 * bundle is computed via DB aggregates over the SAME tenant where-clause as the rows, so
 * the headline totals stay accurate across every shipment regardless of which page is shown.
 *
 * This is a RECEIVABLE-oriented register (the page's KPIs are "Invoiced value / Awaiting
 * payment" against the buyer), so per row we deterministically prefer the BUYER invoice for
 * the displayed invoiceValue/paymentStatus, falling back to a FACTORY invoice then the
 * lowest-id invoice. qty still sums all shipment lines (it is shipment-level, not per-invoice).
 */
export async function shippedGoodsReport(
  actor: SessionUser,
  opts: { page?: number; pageSize?: number } = {},
): Promise<ShippedReport> {
  assertPermission(actor, "shipment", "view");
  const cid = tenantId(actor);
  const where = { companyId: cid };
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const total = await prisma.shipment.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);

  const shipments = await prisma.shipment.findMany({
    where,
    include: {
      invoices: true,
      lines: {
        include: {
          sizes: true,
          orderLine: { include: { colour: true, po: { include: { factory: true, buyer: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const rows = shipments.map((s) => {
    const firstPo = s.lines.find((l) => l.orderLine?.po)?.orderLine?.po;
    const sizes = [...new Set(s.lines.flatMap((l) => l.sizes.map((z) => z.label)))].join(", ");
    const colours = [...new Set(s.lines.map((l) => l.orderLine?.colour?.name).filter(Boolean) as string[])].join(", ");
    const qty = s.lines.reduce((a, l) => a + l.sizes.reduce((b, z) => b + z.qty, 0), 0);
    // Deterministic, receivable-first selection (see fn doc): BUYER → FACTORY → lowest id.
    const byId = [...s.invoices].sort((a, b) => a.id.localeCompare(b.id));
    const inv = byId.find((i) => i.type === "BUYER") ?? byId.find((i) => i.type === "FACTORY") ?? byId[0];
    return {
      id: s.id,
      reference: s.blNumber ?? s.reference,
      poNumber: firstPo?.poNumber ?? "—",
      poId: firstPo?.id ?? null,
      factory: firstPo?.factory?.name ?? "—",
      buyer: firstPo?.buyer?.name ?? "—",
      sizes: sizes || "—",
      colours: colours || "—",
      qty,
      shipDate: s.exFactoryDate ?? s.blDate,
      etaDestination: s.etaDestination,
      invoiceId: inv?.id ?? null,
      invoiceNumber: inv?.number ?? null,
      invoiceValue: inv ? Number(inv.amount) : null,
      invoiceDueDate: inv?.dueDate ?? null,
      paymentStatus: inv?.status ?? null,
      containerNo: s.containerNo,
      tcStatus: s.tcStatus,
      remarks: s.remarks ?? "",
    };
  });

  const kpis = await shippedReportKpis(cid);
  return { rows, total, page, pageSize, totalPages, kpis };
}

/**
 * Headline KPIs over ALL matching shipments via DB aggregates (so they don't drift with
 * pagination). Receivable value & payment counts are taken from BUYER invoices (the register
 * is receivable-oriented) and are USD-scoped (single-currency contract — no FX mixing).
 */
async function shippedReportKpis(companyId: string | null) {
  const [shipments, qtyAgg, valueAgg, paid, awaiting] = await Promise.all([
    prisma.shipment.count({ where: { companyId } }),
    prisma.shipmentLineSize.aggregate({
      where: { companyId },
      _sum: { qty: true },
    }),
    prisma.invoice.aggregate({
      where: { companyId, currency: "USD", type: "BUYER", shipmentId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.invoice.count({ where: { companyId, type: "BUYER", shipmentId: { not: null }, status: "PAID" } }),
    prisma.invoice.count({ where: { companyId, type: "BUYER", shipmentId: { not: null }, status: { not: "PAID" } } }),
  ]);
  return {
    shipments,
    totalQty: qtyAgg._sum.qty ?? 0,
    receivableUsd: valueAgg._sum.amount ? Number(valueAgg._sum.amount) : 0,
    paid,
    awaiting,
  };
}
