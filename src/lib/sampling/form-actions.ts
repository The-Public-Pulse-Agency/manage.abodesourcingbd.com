"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import {
  createSampleRequest,
  updateSampleStatus,
  editSampleFields,
  removeSampleRequest,
} from "./sampling";
import { createSampleSchema, updateSampleSchema } from "./sampling";

export type ActionResult = { error?: string };

export async function createSampleAction(poId: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  const parsed = createSampleSchema.safeParse({
    type: fd.get("type"),
    colourId: fd.get("colourId") || undefined,
    sentDate: fd.get("sentDate") || undefined,
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

export async function setSampleSentDate(
  poId: string,
  sampleId: string,
  value: string,
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    // Empty string clears the date; otherwise commit at midnight UTC.
    await editSampleFields(actor, sampleId, {
      sentDate: value ? `${value}T00:00:00.000Z` : null,
    });
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function setSampleRemarks(
  poId: string,
  sampleId: string,
  value: string,
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await editSampleFields(actor, sampleId, { remarks: value || null });
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function setSampleColour(
  poId: string,
  sampleId: string,
  value: string,
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await editSampleFields(actor, sampleId, { colourId: value || null });
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteSampleAction(
  poId: string,
  sampleId: string,
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await removeSampleRequest(actor, sampleId);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}
