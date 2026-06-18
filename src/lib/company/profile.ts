import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const SELECT = {
  id: true, name: true, address: true,
  bankName: true, bankAccountName: true, bankAccountNo: true, bankSwift: true, bankBranch: true,
} as const;

export type CompanyProfile = {
  id: string; name: string; address: string | null;
  bankName: string | null; bankAccountName: string | null; bankAccountNo: string | null;
  bankSwift: string | null; bankBranch: string | null;
};

/** The actor's OWN company profile + banking details (tenant-scoped). */
export async function getCompanyProfile(actor: SessionUser): Promise<CompanyProfile | null> {
  assertPermission(actor, "masterData", "view");
  return prisma.company.findUnique({ where: { id: tenantId(actor) }, select: SELECT });
}

/** Load the company's printable bank/profile block for documents (no permission gate beyond
 *  the caller's — used inside already-authorised document builders). */
export async function companyForDocument(companyId: string | null): Promise<CompanyProfile | null> {
  if (!companyId) return null;
  return prisma.company.findUnique({ where: { id: companyId }, select: SELECT });
}

export const companyProfileSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankSwift: z.string().optional(),
  bankBranch: z.string().optional(),
});
export type CompanyProfileInput = z.input<typeof companyProfileSchema>;

export async function updateCompanyProfile(actor: SessionUser, input: CompanyProfileInput) {
  assertPermission(actor, "masterData", "edit");
  const cid = tenantId(actor);
  const d = companyProfileSchema.parse(input);
  const data = {
    name: d.name.trim(),
    address: d.address?.trim() || null,
    bankName: d.bankName?.trim() || null,
    bankAccountName: d.bankAccountName?.trim() || null,
    bankAccountNo: d.bankAccountNo?.trim() || null,
    bankSwift: d.bankSwift?.trim() || null,
    bankBranch: d.bankBranch?.trim() || null,
  };
  await prisma.company.update({ where: { id: cid }, data });
  await recordAudit({ userId: actor.id, entityType: "Company", entityId: cid, action: "edit", after: JSON.parse(JSON.stringify(data)) });
}
