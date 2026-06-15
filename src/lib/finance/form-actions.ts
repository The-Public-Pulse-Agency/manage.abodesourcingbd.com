"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { createInvoice } from "./invoices";
import { recordPayment } from "./payments";

export type ActionResult = { error?: string };

export async function createInvoiceAction(poId: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await createInvoice(actor, {
      type: String(fd.get("type")) as "BUYER" | "FACTORY",
      number: String(fd.get("number") ?? ""),
      poId,
      amount: Number(fd.get("amount")) || 0,
      issueDate: String(fd.get("issueDate") || new Date().toISOString().slice(0, 10)),
      dueDate: String(fd.get("dueDate") || "") || undefined,
    });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create invoice" };
  }
}

export async function recordPaymentAction(invoiceId: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await recordPayment(actor, invoiceId, {
      amount: Number(fd.get("amount")) || 0,
      date: String(fd.get("date") || new Date().toISOString().slice(0, 10)),
      method: String(fd.get("method") || "TT") as "LC" | "TT" | "OTHER",
      reference: String(fd.get("reference") || "") || undefined,
    });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to record payment" };
  }
}
