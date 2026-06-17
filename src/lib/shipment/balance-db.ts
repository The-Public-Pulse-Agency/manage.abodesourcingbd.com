import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { remainingBySize, type SizeBalance } from "./balance";

export type LineBalance = {
  orderLineId: string;
  styleCode: string;
  colour: string | null;
  sizes: SizeBalance[];
};

export async function getPoBalance(actor: SessionUser, poId: string): Promise<LineBalance[]> {
  assertPermission(actor, "shipment", "view");
  const lines = await prisma.orderLine.findMany({
    where: { poId, companyId: tenantId(actor) },
    include: {
      style: true,
      colour: true,
      sizes: true,
      shipmentLines: { include: { sizes: true } },
    },
  });
  return lines.map((l) => {
    const shipped = l.shipmentLines.flatMap((sl) => sl.sizes.map((s) => ({ label: s.label, qty: s.qty })));
    const ordered = l.sizes.map((s) => ({ label: s.label, qty: s.qty }));
    return {
      orderLineId: l.id,
      styleCode: l.style.styleCode,
      colour: l.colour?.name ?? null,
      sizes: remainingBySize(ordered, shipped),
    };
  });
}
