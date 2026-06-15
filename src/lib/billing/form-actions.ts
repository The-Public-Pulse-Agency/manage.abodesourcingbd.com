"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { updatePlan } from "./subscription";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updatePlanAction(fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await updatePlan(actor, {
      amountBdt: Number(fd.get("amountBdt")) || undefined,
      periodDays: Number(fd.get("periodDays")) || undefined,
      planName: String(fd.get("planName") || "") || undefined,
      planNotes: String(fd.get("planNotes") ?? ""),
    });
    revalidatePath("/billing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update plan" };
  }
}
