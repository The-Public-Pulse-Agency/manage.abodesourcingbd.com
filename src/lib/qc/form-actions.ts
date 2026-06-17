"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import {
  addInspection,
  addInspectionSchema,
  updateInspection,
  removeInspection,
  type UpdateInspectionInput,
} from "./qc";

export type ActionResult = { error?: string };

const parseDate = (v: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

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

// Per-field inline editors only receive (id, value); the order detail is re-rendered
// via the client's router.refresh(), so a coarse layout revalidate is sufficient here.
async function runUpdate(id: string, patch: UpdateInspectionInput): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateInspection(actor, id, patch);
    revalidatePath("/orders", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update inspection" };
  }
}

export async function setInspectionResult(id: string, value: string): Promise<ActionResult> {
  return runUpdate(id, { result: value as UpdateInspectionInput["result"] });
}

export async function setInspectionType(id: string, value: string): Promise<ActionResult> {
  return runUpdate(id, { type: value as UpdateInspectionInput["type"] });
}

export async function setInspectionDate(id: string, value: string): Promise<ActionResult> {
  const d = parseDate(value);
  if (!d) return { error: "Date is required" };
  return runUpdate(id, { date: d });
}

export async function setInspectionAql(id: string, value: string): Promise<ActionResult> {
  return runUpdate(id, { aql: value.trim() || null });
}

export async function setInspectionRemarks(id: string, value: string): Promise<ActionResult> {
  return runUpdate(id, { remarks: value.trim() || null });
}

export async function deleteInspectionAction(id: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await removeInspection(actor, id);
    revalidatePath("/orders", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete inspection" };
  }
}
