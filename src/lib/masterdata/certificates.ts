import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function listFactoriesWithCertificates(actor: SessionUser) {
  assertPermission(actor, "masterData", "view");
  return prisma.factory.findMany({
    where: { active: true },
    include: { certificates: { orderBy: { validUntil: "asc" } } },
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
  const c = await prisma.factoryCertificate.create({
    data: { factoryId: data.factoryId, name: data.name.trim(), number: data.number, validUntil: data.validUntil },
  });
  await recordAudit({ userId: actor.id, entityType: "FactoryCertificate", entityId: c.id, action: "create", after: { name: data.name, number: data.number } });
  return c;
}

export async function removeCertificate(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "edit");
  await prisma.factoryCertificate.delete({ where: { id } });
  await recordAudit({ userId: actor.id, entityType: "FactoryCertificate", entityId: id, action: "delete" });
}
