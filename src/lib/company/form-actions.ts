"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { updateCompanyProfile } from "./profile";

type Res = { error?: string };

export async function updateCompanyProfileAction(fd: FormData): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateCompanyProfile(actor, {
      name: String(fd.get("name") ?? ""),
      address: String(fd.get("address") ?? ""),
      bankName: String(fd.get("bankName") ?? ""),
      bankAccountName: String(fd.get("bankAccountName") ?? ""),
      bankAccountNo: String(fd.get("bankAccountNo") ?? ""),
      bankSwift: String(fd.get("bankSwift") ?? ""),
      bankBranch: String(fd.get("bankBranch") ?? ""),
    });
    revalidatePath("/settings");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save" };
  }
}
