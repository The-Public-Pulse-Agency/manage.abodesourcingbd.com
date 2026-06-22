"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { createInvoice, updateInvoiceFields, deleteInvoice } from "./invoices";
import { recordPayment, updatePayment, deletePayment } from "./payments";

export type ActionResult = { error?: string };

export async function createInvoiceAction(poId: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await createInvoice(actor, {
      type: String(fd.get("type")) as "BUYER" | "FACTORY",
      number: String(fd.get("number") ?? ""),
      poId,
      // When raised from the shipment page, also link the invoice to that shipment so it
      // shows on the shipped register directly (not just via the PO fallback).
      shipmentId: String(fd.get("shipmentId") || "") || undefined,
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

// --- Inline invoice field setters (used by EditableCell on the invoices panel) ---

export async function setInvoiceNumber(id: string, value: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateInvoiceFields(actor, id, { number: value });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update invoice number" };
  }
}

export async function setInvoiceAmount(id: string, value: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateInvoiceFields(actor, id, { amount: Number(value) || 0 });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update amount" };
  }
}

export async function setInvoiceStatus(id: string, value: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateInvoiceFields(actor, id, { status: value });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update status" };
  }
}

export async function setInvoiceIssueDate(id: string, value: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    if (!value) return { error: "Issue date is required" };
    await updateInvoiceFields(actor, id, { issueDate: new Date(value) });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update issue date" };
  }
}

export async function setInvoiceDueDate(id: string, value: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateInvoiceFields(actor, id, { dueDate: value ? new Date(value) : null });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update due date" };
  }
}

// --- Payment field setters + delete (used by the payments sub-view) ---

export async function setPaymentAmount(paymentId: string, value: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updatePayment(actor, paymentId, { amount: Number(value) || 0 });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update payment" };
  }
}

export async function setPaymentMethod(paymentId: string, value: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updatePayment(actor, paymentId, { method: value as "LC" | "TT" | "OTHER" });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update payment" };
  }
}

export async function setPaymentDate(paymentId: string, value: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    if (!value) return { error: "Payment date is required" };
    await updatePayment(actor, paymentId, { date: value });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update payment" };
  }
}

export async function deletePaymentAction(paymentId: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await deletePayment(actor, paymentId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete payment" };
  }
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await deleteInvoice(actor, invoiceId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete invoice" };
  }
}
