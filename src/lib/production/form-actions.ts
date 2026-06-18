"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { upsertProduction } from "./production";

export type ActionResult = { error?: string };

export async function saveProductionAction(
  poId: string,
  orderLineId: string,
  qty: { cutQty: number; sewQty: number; finishQty: number },
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await upsertProduction(actor, orderLineId, qty);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}
