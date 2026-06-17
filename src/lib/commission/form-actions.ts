"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, type SessionUser } from "@/lib/auth/guard";
import { createCommission, updateCommissionField, deleteCommission, type CommissionField } from "./commission";

type Res = { error?: string };

async function run(fn: (a: SessionUser) => Promise<void>): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await fn(actor);
    revalidatePath("/reports/commission");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function createCommissionAction(fd: FormData): Promise<Res> {
  return run(async (a) => {
    await createCommission(a, {
      buyerId: String(fd.get("buyerId") || "") || undefined,
      factoryId: String(fd.get("factoryId") || "") || undefined,
      factoryInvoiceNo: String(fd.get("factoryInvoiceNo") || "") || undefined,
      factoryInvoiceValue: String(fd.get("factoryInvoiceValue") || "") || undefined,
      commissionPct: String(fd.get("commissionPct") || "") || undefined,
    });
  });
}

const set = (id: string, f: CommissionField, value: string) => run((a) => updateCommissionField(a, id, f, value));
export async function setCommFactoryInvNo(id: string, v: string): Promise<Res> { return set(id, "factoryInvoiceNo", v); }
export async function setCommFactoryValue(id: string, v: string): Promise<Res> { return set(id, "factoryInvoiceValue", v); }
export async function setCommPct(id: string, v: string): Promise<Res> { return set(id, "commissionPct", v); }
export async function setCommOwnInvNo(id: string, v: string): Promise<Res> { return set(id, "ownInvoiceNo", v); }
export async function setCommIssueDate(id: string, v: string): Promise<Res> { return set(id, "issueDate", v); }
export async function setCommDueDate(id: string, v: string): Promise<Res> { return set(id, "dueDate", v); }
export async function setCommPaymentStatus(id: string, v: string): Promise<Res> { return set(id, "paymentStatus", v); }
export async function setCommRemarks(id: string, v: string): Promise<Res> { return set(id, "remarks", v); }
export async function setCommFactory(id: string, v: string): Promise<Res> { return set(id, "factoryId", v); }
export async function setCommBuyer(id: string, v: string): Promise<Res> { return set(id, "buyerId", v); }

export async function deleteCommissionAction(id: string): Promise<Res> {
  return run((a) => deleteCommission(a, id));
}
