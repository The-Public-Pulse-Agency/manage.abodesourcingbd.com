"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { upsertProduction } from "./production";

export type ActionResult = { error?: string };

export async function saveProductionAction(
  poId: string,
  orderLineId: string,
  input: {
    cutQty: number;
    sewQty: number;
    finishQty: number;
    shadeApproval?: string;
    ppSampleStatus?: string;
    fabricWashTest?: string;
    garmentsWashTest?: string;
    topSampleStatus?: string;
  },
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await upsertProduction(actor, orderLineId, input);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}
