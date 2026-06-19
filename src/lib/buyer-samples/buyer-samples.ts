import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function listBuyerSamples(actor: SessionUser) {
  assertPermission(actor, "sampling", "view");
  return prisma.buyerSampleDispatch.findMany({ where: { companyId: tenantId(actor) }, orderBy: { createdAt: "desc" } });
}

export const createBuyerSampleSchema = z.object({
  buyerName: z.string().optional(),
  sampleType: z.string().optional(),
  artNo: z.string().min(1, "Art no is required"),
  styleName: z.string().optional(),
  factoryName: z.string().optional(),
  courierName: z.string().optional(),
  awbNumber: z.string().optional(),
  sendDate: z.string().optional(),
  numSamples: z.coerce.number().optional(),
  approxArrival: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateBuyerSampleInput = z.input<typeof createBuyerSampleSchema>;

export async function createBuyerSample(actor: SessionUser, input: CreateBuyerSampleInput) {
  assertPermission(actor, "sampling", "create");
  const data = createBuyerSampleSchema.parse(input);
  const cid = tenantId(actor);
  const item = await prisma.buyerSampleDispatch.create({
    data: {
      companyId: cid,
      buyerName: data.buyerName?.trim() || null,
      sampleType: data.sampleType?.trim() || null,
      artNo: data.artNo.trim(),
      styleName: data.styleName?.trim() || null,
      factoryName: data.factoryName?.trim() || null,
      courierName: data.courierName?.trim() || null,
      awbNumber: data.awbNumber?.trim() || null,
      sendDate: data.sendDate ? new Date(`${data.sendDate}T00:00:00.000Z`) : null,
      numSamples: data.numSamples != null && !Number.isNaN(data.numSamples) ? Math.trunc(data.numSamples) : null,
      approxArrival: data.approxArrival ? new Date(`${data.approxArrival}T00:00:00.000Z`) : null,
      notes: data.notes?.trim() || null,
    },
  });
  await recordAudit({ userId: actor.id, entityType: "BuyerSampleDispatch", entityId: item.id, action: "create", after: { artNo: data.artNo } });
  return item;
}

const TEXT_FIELDS = ["buyerName", "sampleType", "artNo", "styleName", "factoryName", "courierName", "awbNumber", "notes"] as const;
const DATE_FIELDS = ["sendDate", "approxArrival"] as const;
const NUMBER_FIELDS = ["numSamples"] as const;
export type BuyerSampleField = (typeof TEXT_FIELDS)[number] | (typeof DATE_FIELDS)[number] | (typeof NUMBER_FIELDS)[number];

export async function updateBuyerSampleField(actor: SessionUser, id: string, field: BuyerSampleField, value: string) {
  assertPermission(actor, "sampling", "edit");
  const cid = tenantId(actor);
  const existing = await prisma.buyerSampleDispatch.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!existing) throw new Error("Buyer sample not found");
  const data: Record<string, string | number | Date | null> = {};
  if ((DATE_FIELDS as readonly string[]).includes(field)) data[field] = value ? new Date(`${value}T00:00:00.000Z`) : null;
  else if ((NUMBER_FIELDS as readonly string[]).includes(field)) {
    const n = parseInt(value, 10);
    data[field] = value.trim() && !Number.isNaN(n) ? n : null;
  } else if ((TEXT_FIELDS as readonly string[]).includes(field)) {
    if (field === "artNo" && !value.trim()) throw new Error("Art no is required");
    data[field] = value.trim() || null;
  } else throw new Error("Invalid field");
  await prisma.buyerSampleDispatch.update({ where: { id }, data });
}

export async function deleteBuyerSample(actor: SessionUser, id: string) {
  assertPermission(actor, "sampling", "edit");
  await prisma.buyerSampleDispatch.deleteMany({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "BuyerSampleDispatch", entityId: id, action: "delete" });
}
