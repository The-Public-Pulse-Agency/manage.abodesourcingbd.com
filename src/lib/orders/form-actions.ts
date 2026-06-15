"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createPurchaseOrder } from "./po";
import { setOrderLine, removeOrderLine } from "./lines";
import { confirmPurchaseOrder } from "./confirm";
import { approveCosting } from "./costing";
import { createLot, assignPoToLot } from "./lots";
import type { CreatePoInput, SetLineInput } from "./schema";

export type ActionResult = { error?: string };

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return undefined;
  return v.trim();
}

export async function createPoAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  let id: string;
  try {
    const raw = {
      poNumber: str(fd, "poNumber") ?? "",
      buyerId: str(fd, "buyerId") ?? "",
      brandId: str(fd, "brandId") ?? "",
      factoryId: str(fd, "factoryId") ?? "",
      channel: str(fd, "channel") ?? "DIRECT",
      orderDate: str(fd, "orderDate"),
      crd: str(fd, "crd"),
      exFactoryDate: str(fd, "exFactoryDate"),
      currency: str(fd, "currency") ?? "USD",
      notes: str(fd, "notes"),
    };
    // createPurchaseOrder re-validates with Zod (coerces dates / checks enum).
    const po = await createPurchaseOrder(actor, raw as CreatePoInput);
    id = po.id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create order" };
  }
  redirect(`/orders/${id}`);
}

export async function setLineAction(poId: string, input: SetLineInput): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await setOrderLine(actor, poId, input);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save line" };
  }
}

export async function removeLineAction(poId: string, lineId: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await removeOrderLine(actor, lineId);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove line" };
  }
}

export async function approveCostingAction(poId: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await approveCosting(actor, poId);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to approve costing" };
  }
}

export async function confirmAction(poId: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await confirmPurchaseOrder(actor, poId);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to confirm order" };
  }
}

export async function createAndAssignLotAction(
  poId: string,
  name: string,
  factoryId?: string,
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    const lot = await createLot(actor, { name, factoryId });
    await assignPoToLot(actor, poId, lot.id);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create lot" };
  }
}
