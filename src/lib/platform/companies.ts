import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { assertPlatformOperator } from "./guard";
import { recordAudit } from "@/lib/audit";

export type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  packageId: string | null;
  users: number;
  createdAt: Date;
};

export async function listCompanies(actor: SessionUser): Promise<CompanyRow[]> {
  assertPlatformOperator(actor);
  assertPermission(actor, "companies", "view");
  const companies = await prisma.company.findMany({ orderBy: { createdAt: "asc" } });
  const userGroups = await prisma.user.groupBy({ by: ["companyId"], _count: true });
  const userBy = new Map(userGroups.map((g) => [g.companyId, g._count]));
  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: c.status,
    packageId: c.packageId,
    users: userBy.get(c.id) ?? 0,
    createdAt: c.createdAt,
  }));
}

export async function setCompanyStatus(actor: SessionUser, id: string, status: "ACTIVE" | "SUSPENDED") {
  assertPlatformOperator(actor);
  assertPermission(actor, "companies", "edit");
  const c = await prisma.company.update({ where: { id }, data: { status } });
  await recordAudit({ userId: actor.id, entityType: "Company", entityId: id, action: "edit", after: { status } });
  return c;
}

export async function setCompanyPackage(actor: SessionUser, id: string, packageId: string | null) {
  assertPlatformOperator(actor);
  assertPermission(actor, "companies", "edit");
  const c = await prisma.company.update({ where: { id }, data: { packageId } });
  await recordAudit({ userId: actor.id, entityType: "Company", entityId: id, action: "edit", after: { packageId } });
  return c;
}
