import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
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
          const ol = await tx.orderLine.findUnique({
            where: { id: l.orderLineId },
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
                orderLineId: l.orderLineId,
                sizes: { create: l.sizes.map((s) => ({ label: s.label, qty: s.qty })) },
              })),
            },
          },
        });

        for (const poId of affectedPoIds) {
          const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
          const lines = await tx.orderLine.findMany({
            where: { poId },
            include: { sizes: true, shipmentLines: { include: { sizes: true } } },
          });
          const newStatus = isFullyShipped(lines) ? "SHIPPED" : "PARTLY_SHIPPED";
          if (po.status !== newStatus) {
            const res = await tx.purchaseOrder.updateMany({
              where: { id: poId, status: { in: [...SHIPPABLE] } },
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
  forwarderId: z.string().optional(),
  portId: z.string().optional(),
});
export type UpdateShipmentInput = z.input<typeof updateShipmentSchema>;

export async function updateShipment(actor: SessionUser, id: string, input: UpdateShipmentInput) {
  assertPermission(actor, "shipment", "edit");
  const data = updateShipmentSchema.parse(input);
  const before = await prisma.shipment.findUniqueOrThrow({ where: { id } });

  if (data.telexStatus) {
    if (TELEX_ORDER.indexOf(data.telexStatus) < TELEX_ORDER.indexOf(before.telexStatus)) {
      throw new Error(`Cannot move telex status backward (${before.telexStatus} → ${data.telexStatus})`);
    }
    if (data.telexStatus === "RELEASED" && !(data.blNumber ?? before.blNumber)) {
      throw new Error("A BL number is required before telex can be RELEASED");
    }
  }

  try {
    const shipment = await prisma.shipment.update({ where: { id }, data });
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

export async function listShipments(actor: SessionUser) {
  assertPermission(actor, "shipment", "view");
  return prisma.shipment.findMany({
    include: { forwarder: true, port: true, lines: { include: { sizes: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getShipment(actor: SessionUser, id: string) {
  assertPermission(actor, "shipment", "view");
  return prisma.shipment.findUnique({
    where: { id },
    include: {
      forwarder: true,
      port: true,
      lines: { include: { sizes: true, orderLine: { include: { style: true, colour: true, po: true } } } },
    },
  });
}
