import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function listFactoriesWithCertificates(actor: SessionUser) {
  assertPermission(actor, "masterData", "view");
  return prisma.factory.findMany({
    where: { companyId: tenantId(actor), active: true },
    include: {
      certificates: {
        where: { companyId: tenantId(actor) },
        orderBy: { validUntil: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export const certificateSchema = z.object({
  factoryId: z.string().min(1),
  name: z.string().min(1),
  number: z.string().optional(),
  validUntil: z.coerce.date().optional(),
});
export type CertificateInput = z.input<typeof certificateSchema>;

export async function addCertificate(actor: SessionUser, input: CertificateInput) {
  assertPermission(actor, "masterData", "edit");
  const data = certificateSchema.parse(input);
  // Tenant integrity: the parent factory must belong to the actor's company.
  const factory = await prisma.factory.findFirst({
    where: { id: data.factoryId, companyId: tenantId(actor) },
    select: { id: true },
  });
  if (!factory) throw new Error("Factory not found");
  const c = await prisma.factoryCertificate.create({
    data: { factoryId: data.factoryId, name: data.name.trim(), number: data.number, validUntil: data.validUntil, companyId: tenantId(actor) },
  });
  await recordAudit({ userId: actor.id, entityType: "FactoryCertificate", entityId: c.id, action: "create", after: { name: data.name, number: data.number } });
  return c;
}

export async function removeCertificate(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "edit");
  await prisma.factoryCertificate.deleteMany({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "FactoryCertificate", entityId: id, action: "delete" });
}
