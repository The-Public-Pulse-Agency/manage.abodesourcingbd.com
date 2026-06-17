import { z } from "zod";
import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Self-service password change — verifies the current password first. */
export async function changePassword(actor: SessionUser, input: ChangePasswordInput) {
  const data = changePasswordSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  if (!user) throw new Error("User not found");
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw new Error("Current password is incorrect");
  }
  if (data.currentPassword === data.newPassword) throw new Error("New password must differ from the current one");
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(data.newPassword) } });
  await recordAudit({ userId: actor.id, entityType: "User", entityId: actor.id, action: "edit", after: { passwordChanged: true } });
}
