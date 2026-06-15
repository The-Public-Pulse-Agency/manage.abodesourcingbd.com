"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createSampleRequest, updateSampleStatus } from "./sampling";
import { createSampleSchema, updateSampleSchema } from "./sampling";

export type ActionResult = { error?: string };

export async function createSampleAction(poId: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  const parsed = createSampleSchema.safeParse({
    type: fd.get("type"),
    colourId: fd.get("colourId") || undefined,
    remarks: fd.get("remarks") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await createSampleRequest(actor, poId, parsed.data);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateSampleStatusAction(
  poId: string,
  sampleId: string,
  status: string,
  approvedDateISO?: string,
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  const parsed = updateSampleSchema.safeParse({
    status,
    approvedDate: approvedDateISO || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await updateSampleStatus(actor, sampleId, parsed.data);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}
