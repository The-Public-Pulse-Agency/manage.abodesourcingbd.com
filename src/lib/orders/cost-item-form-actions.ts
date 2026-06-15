"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { addCostItem, removeCostItem } from "./cost-items";

export type ActionResult = { error?: string };

export async function addCostItemAction(poId: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await addCostItem(actor, {
      poId,
      category: String(fd.get("category") ?? "OTHER") as "FABRIC" | "CM" | "TRIMS" | "TEST" | "FREIGHT" | "COMMISSION" | "OTHER",
      label: String(fd.get("label") ?? ""),
      amountPerUnit: Number(fd.get("amountPerUnit")) || 0,
      note: String(fd.get("note") || "") || undefined,
    });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add cost item" };
  }
}

export async function removeCostItemAction(id: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await removeCostItem(actor, id);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove cost item" };
  }
}
