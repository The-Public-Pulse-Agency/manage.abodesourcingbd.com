"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { addInspection, addInspectionSchema } from "./qc";

export type ActionResult = { error?: string };

export async function addInspectionAction(poId: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  const parsed = addInspectionSchema.safeParse({
    type: fd.get("type"),
    result: fd.get("result"),
    date: fd.get("date"),
    aql: fd.get("aql") || undefined,
    remarks: fd.get("remarks") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await addInspection(actor, poId, parsed.data);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}
