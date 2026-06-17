"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createEnquiry, updateEnquiry, convertToOrder, deleteEnquiry } from "./enquiries";

export type ActionResult = { ok: true; poId?: string } | { ok: false; error: string };

export async function createEnquiryAction(fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await createEnquiry(actor, {
      buyerId: String(fd.get("buyerId") ?? ""),
      brandId: String(fd.get("brandId") ?? ""),
      factoryId: String(fd.get("factoryId") || "") || undefined,
      styleRef: String(fd.get("styleRef") ?? ""),
      targetQty: fd.get("targetQty") ? Number(fd.get("targetQty")) : undefined,
      targetPriceUsd: fd.get("targetPriceUsd") ? Number(fd.get("targetPriceUsd")) : undefined,
      requiredShipDate: String(fd.get("requiredShipDate") || "") || undefined,
      notes: String(fd.get("notes") || "") || undefined,
    });
    revalidatePath("/enquiries");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add enquiry" };
  }
}

export async function updateEnquiryAction(
  id: string,
  input: {
    status?: string;
    quotedPriceUsd?: number;
    targetQty?: number | null;
    targetPriceUsd?: number | null;
    requiredShipDate?: string | null;
    notes?: string | null;
    factoryId?: string;
    lostReason?: string | null;
  },
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await updateEnquiry(actor, id, input as never);
    revalidatePath("/enquiries");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update enquiry" };
  }
}

export async function deleteEnquiryAction(id: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await deleteEnquiry(actor, id);
    revalidatePath("/enquiries");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete enquiry" };
  }
}

export async function convertEnquiryAction(id: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    const po = await convertToOrder(actor, id);
    revalidatePath("/enquiries");
    return { ok: true, poId: po.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to convert" };
  }
}
