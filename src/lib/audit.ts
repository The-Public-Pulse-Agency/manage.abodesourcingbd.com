import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type AuditInput = {
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: "create" | "edit" | "delete" | "approve" | "login";
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: input.before,
      after: input.after,
    },
  });
}
