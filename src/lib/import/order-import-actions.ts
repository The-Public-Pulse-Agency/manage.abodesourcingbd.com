"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { readOrderRows } from "./orders-excel";
import { importOrders, type OrderImportSummary } from "./order-import";
import { clearOrdersAndShipments } from "./reset";

export async function importOrdersFromUpload(
  formData: FormData,
): Promise<{ ok: true; summary: OrderImportSummary } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose an .xlsx file" };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await readOrderRows(buffer);
    if (rows.length === 0) return { ok: false, error: "No order rows found — check the headers match the template." };
    const summary = await importOrders(actor, rows);
    revalidatePath("/reports/open-orders");
    revalidatePath("/orders");
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed" };
  }
}

export async function clearAllDataAction(
  confirm: string,
): Promise<{ ok: true; orders: number; shipments: number } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    const res = await clearOrdersAndShipments(actor, { confirm });
    revalidatePath("/reports/open-orders");
    revalidatePath("/reports/shipped");
    revalidatePath("/orders");
    revalidatePath("/shipments");
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to clear data" };
  }
}
