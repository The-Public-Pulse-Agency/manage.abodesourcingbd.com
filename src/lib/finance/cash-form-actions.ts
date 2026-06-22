"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createCashEntry, deleteCashEntry } from "./cash";

type Res = { error?: string };

export async function createCashEntryAction(fd: FormData): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await createCashEntry(actor, {
      kind: String(fd.get("kind") ?? "") as "RECEIVED" | "EXPENSE",
      entryDate: String(fd.get("entryDate") || ""),
      amountBdt: Number(fd.get("amountBdt")) || 0,
      sender: String(fd.get("sender") || "") || undefined,
      purpose: String(fd.get("purpose") || "") || undefined,
      head: String(fd.get("head") || "") || undefined,
      note: String(fd.get("note") || "") || undefined,
    });
    revalidatePath("/finance");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add entry" };
  }
}

export async function deleteCashEntryAction(id: string): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await deleteCashEntry(actor, id);
    revalidatePath("/finance");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete" };
  }
}
