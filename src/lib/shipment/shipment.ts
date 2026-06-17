import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { remainingBySize, assertWithinBalance, type SizeQty } from "./balance";

const shipmentModes = ["SEA", "AIR"] as const;
const telexStatuses = ["PENDING", "RECEIVED", "RELEASED"] as const;
const TELEX_ORDER = ["PENDING", "RECEIVED", "RELEASED"];

// IN_PRODUCTION is forward-compat (no phase sets it yet).
const SHIPPABLE = ["CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED"] as const;

export const createShipmentSchema = z
  .object({
    reference: z.string().min(1),
    mode: z.enum(shipmentModes).default("SEA"),
    containerNo: z.string().optional(),
    cartons: z.number().int().nonnegative().optional(),
    exFactoryDate: z.coerce.date().optional(),
    blNumber: z.string().optional(),
    blDate: z.coerce.date().optional(),
    telexStatus: z.enum(telexStatuses).default("PENDING"),
    forwarderId: z.string().optional(),
    portId: z.string().optional(),
    lines: z
      .array(
        z.object({
          orderLineId: z.string().min(1),
          sizes: z
            .array(z.object({ label: z.string().min(1), qty: z.number().int().positive() }))
            .min(1),
        }),
      )
      .min(1, "A shipment needs at least one line"),
  })
  .refine(
    (v) => new Set(v.lines.map((l) => l.orderLineId)).size === v.lines.length,
    { message: "An order line appears more than once in this shipment", path: ["lines"] },
  );
export type CreateShipmentInput = z.input<typeof createShipmentSchema>;

type LineWithBalance = { sizes: { label: string; qty: number }[]; shipmentLines: { sizes: { label: string; qty: number }[] }[] };

function isFullyShipped(lines: LineWithBalance[]): boolean {
  if (lines.length === 0) return false;
  return lines.every((l) => {
    if (l.sizes.length === 0) return false;
    const shipped: SizeQty[] = l.shipmentLines.flatMap((sl) => sl.sizes.map((s) => ({ label: s.label, qty: s.qty })));
    return remainingBySize(l.sizes.map((s) => ({ label: s.label, qty: s.qty })), shipped).every((b) => b.balance <= 0);
  });
}

export async function createShipment(actor: SessionUser, input: CreateShipmentInput) {
  assertPermission(actor, "shipment", "create");
  const data = createShipmentSchema.parse(input);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const affectedPoIds = new Set<string>();
        for (const l of data.lines) {
          const ol = await tx.orderLine.findFirst({
            where: { id: l.orderLineId, companyId: tenantId(actor) },
            include: { sizes: true, shipmentLines: { include: { sizes: true } }, po: true },
          });
          if (!ol) throw new Error(`Order line ${l.orderLineId} not found`);
          if (!SHIPPABLE.includes(ol.po.status as (typeof SHIPPABLE)[number])) {
            throw new Error(`Cannot ship a ${ol.po.status} order`);
          }
          affectedPoIds.add(ol.poId);
          const shipped: SizeQty[] = ol.shipmentLines.flatMap((sl) => sl.sizes.map((s) => ({ label: s.label, qty: s.qty })));
          assertWithinBalance(
            remainingBySize(ol.sizes.map((s) => ({ label: s.label, qty: s.qty })), shipped),
            l.sizes,
          );
        }

        const created = await tx.shipment.create({
          data: {
            companyId: tenantId(actor),
            reference: data.reference,
            mode: data.mode,
            containerNo: data.containerNo,
            cartons: data.cartons,
            exFactoryDate: data.exFactoryDate,
            blNumber: data.blNumber,
            blDate: data.blDate,
            telexStatus: data.telexStatus,
            forwarderId: data.forwarderId,
            portId: data.portId,
            lines: {
              create: data.lines.map((l) => ({
                companyId: tenantId(actor),
                orderLineId: l.orderLineId,
                sizes: {
                  create: l.sizes.map((s) => ({ companyId: tenantId(actor), label: s.label, qty: s.qty })),
                },
              })),
            },
          },
        });

        for (const poId of affectedPoIds) {
          const po = await tx.purchaseOrder.findFirst({ where: { id: poId, companyId: tenantId(actor) } });
          if (!po) throw new Error(`Purchase order ${poId} not found`);
          const lines = await tx.orderLine.findMany({
            where: { poId, companyId: tenantId(actor) },
            include: { sizes: true, shipmentLines: { include: { sizes: true } } },
          });
          const newStatus = isFullyShipped(lines) ? "SHIPPED" : "PARTLY_SHIPPED";
          if (po.status !== newStatus) {
            const res = await tx.purchaseOrder.updateMany({
              where: { id: poId, companyId: tenantId(actor), status: { in: [...SHIPPABLE] } },
              data: { status: newStatus },
            });
            if (res.count > 0) {
              await recordAudit(
                {
                  userId: actor.id,
                  entityType: "PurchaseOrder",
                  entityId: poId,
                  action: "edit",
                  before: { status: po.status },
                  after: { status: newStatus },
                },
                tx,
              );
            }
          }
        }

        await recordAudit(
          {
            userId: actor.id,
            entityType: "Shipment",
            entityId: created.id,
            action: "create",
            after: { reference: created.reference, lines: data.lines.length },
          },
          tx,
        );
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        const target = String(e.meta?.target ?? "");
        if (target.includes("blNumber")) throw new Error(`BL number ${data.blNumber} is already used`);
        throw new Error(`A shipment with reference ${data.reference} already exists`);
      }
      if (e.code === "P2034") {
        throw new Error("Another shipment is being recorded for this order — please retry");
      }
    }
    throw e;
  }
}

export const updateShipmentSchema = z.object({
  containerNo: z.string().optional(),
  cartons: z.number().int().nonnegative().optional(),
  blNumber: z.string().optional(),
  blDate: z.coerce.date().optional(),
  telexStatus: z.enum(telexStatuses).optional(),
  tcStatus: z.string().optional(),
  forwarderId: z.string().optional(),
  portId: z.string().optional(),
});
export type UpdateShipmentInput = z.input<typeof updateShipmentSchema>;

export async function updateShipment(actor: SessionUser, id: string, input: UpdateShipmentInput) {
  assertPermission(actor, "shipment", "edit");
  const data = updateShipmentSchema.parse(input);
  const before = await prisma.shipment.findFirst({ where: { id, companyId: tenantId(actor) } });
  if (!before) throw new Error(`Shipment ${id} not found`);

  if (data.telexStatus) {
    if (TELEX_ORDER.indexOf(data.telexStatus) < TELEX_ORDER.indexOf(before.telexStatus)) {
      throw new Error(`Cannot move telex status backward (${before.telexStatus} → ${data.telexStatus})`);
    }
    if (data.telexStatus === "RELEASED" && !(data.blNumber ?? before.blNumber)) {
      throw new Error("A BL number is required before telex can be RELEASED");
    }
  }

  try {
    await prisma.shipment.updateMany({ where: { id, companyId: tenantId(actor) }, data });
    const shipment = await prisma.shipment.findFirst({ where: { id, companyId: tenantId(actor) } });
    if (!shipment) throw new Error(`Shipment ${id} not found`);
    await recordAudit({
      userId: actor.id,
      entityType: "Shipment",
      entityId: id,
      action: "edit",
      before: { telexStatus: before.telexStatus, blNumber: before.blNumber },
      after: {
        telexStatus: data.telexStatus,
        blNumber: data.blNumber,
        blDate: data.blDate?.toISOString(),
        containerNo: data.containerNo,
        cartons: data.cartons,
      },
    });
    return shipment;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`BL number ${data.blNumber} is already used`);
    }
    throw e;
  }
}

/**
 * Delete a shipment (and its invoices/payments), then recompute each affected order's
 * status — fully-shipped → SHIPPED, some → PARTLY_SHIPPED, none left → back to CONFIRMED.
 * Used to correct mistaken / imported shipment records.
 */
export async function deleteShipment(actor: SessionUser, id: string): Promise<void> {
  assertPermission(actor, "shipment", "delete");
  const cid = tenantId(actor);
  const shipment = await prisma.shipment.findFirst({
    where: { id, companyId: cid },
    include: { lines: { select: { orderLine: { select: { poId: true } } } } },
  });
  if (!shipment) throw new Error("Shipment not found");
  const poIds = [...new Set(shipment.lines.map((l) => l.orderLine.poId))];

  await prisma.$transaction(async (tx) => {
    await tx.invoice.deleteMany({ where: { shipmentId: id, companyId: cid } }); // payments cascade
    await tx.shipment.deleteMany({ where: { id, companyId: cid } }); // lines + sizes cascade
    for (const poId of poIds) {
      const po = await tx.purchaseOrder.findFirst({ where: { id: poId, companyId: cid }, select: { status: true } });
      if (!po) continue;
      const lines = await tx.orderLine.findMany({
        where: { poId, companyId: cid },
        include: { sizes: true, shipmentLines: { include: { sizes: true } } },
      });
      const hasShip = lines.some((l) => l.shipmentLines.length > 0);
      let next: "SHIPPED" | "PARTLY_SHIPPED" | "CONFIRMED" | null = null;
      if (!hasShip) {
        if (po.status === "SHIPPED" || po.status === "PARTLY_SHIPPED") next = "CONFIRMED";
      } else {
        next = isFullyShipped(lines) ? "SHIPPED" : "PARTLY_SHIPPED";
      }
      if (next && next !== po.status) {
        await tx.purchaseOrder.updateMany({ where: { id: poId, companyId: cid }, data: { status: next } });
      }
    }
  });
  await recordAudit({ userId: actor.id, entityType: "Shipment", entityId: id, action: "delete", before: { reference: shipment.reference } });
}

export async function listShipments(actor: SessionUser) {
  assertPermission(actor, "shipment", "view");
  return prisma.shipment.findMany({
    where: { companyId: tenantId(actor) },
    include: {
      forwarder: true,
      port: true,
      invoices: true,
      lines: { include: { sizes: true, orderLine: { include: { po: { include: { factory: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Server-side paginated shipment tracker. */
export async function listShipmentsPaged(actor: SessionUser, opts: { page?: number; pageSize?: number } = {}) {
  assertPermission(actor, "shipment", "view");
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const total = await prisma.shipment.count({ where: { companyId: tenantId(actor) } });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const rows = await prisma.shipment.findMany({
    where: { companyId: tenantId(actor) },
    include: {
      forwarder: true,
      port: true,
      invoices: true,
      lines: { include: { sizes: true, orderLine: { include: { po: { include: { factory: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { rows, total, page, pageSize, totalPages };
}

export async function getShipment(actor: SessionUser, id: string) {
  assertPermission(actor, "shipment", "view");
  return prisma.shipment.findFirst({
    where: { id, companyId: tenantId(actor) },
    include: {
      forwarder: true,
      port: true,
      lines: { include: { sizes: true, orderLine: { include: { style: true, colour: true, po: true } } } },
    },
  });
}
