"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { changePassword } from "./password";

export async function changePasswordAction(fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await changePassword(actor, {
      currentPassword: String(fd.get("currentPassword") ?? ""),
      newPassword: String(fd.get("newPassword") ?? ""),
    });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to change password" };
  }
}
