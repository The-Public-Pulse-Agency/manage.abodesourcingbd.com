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
};

/** Shipped-goods register: each shipment with buyer/factory/size/colour + invoice + TC. */
export async function shippedGoodsReport(actor: SessionUser): Promise<ShippedRow[]> {
  assertPermission(actor, "shipment", "view");
  const shipments = await prisma.shipment.findMany({
    where: { companyId: tenantId(actor) },
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
    take: 500,
  });

  return shipments.map((s) => {
    const firstPo = s.lines.find((l) => l.orderLine?.po)?.orderLine?.po;
    const sizes = [...new Set(s.lines.flatMap((l) => l.sizes.map((z) => z.label)))].join(", ");
    const colours = [...new Set(s.lines.map((l) => l.orderLine?.colour?.name).filter(Boolean) as string[])].join(", ");
    const qty = s.lines.reduce((a, l) => a + l.sizes.reduce((b, z) => b + z.qty, 0), 0);
    const inv = s.invoices.find((i) => i.type === "FACTORY") ?? s.invoices[0];
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
    };
  });
}
