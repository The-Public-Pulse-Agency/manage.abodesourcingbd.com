"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import {
  createBuyer,
  createBuyerSchema,
  createBrand,
  createBrandSchema,
  updateBuyer,
  updateBuyerSchema,
  updateBrand,
  updateBrandSchema,
} from "./buyer";

export async function createBuyerFromForm(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = createBuyerSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await createBuyer(actor, parsed.data);
    revalidatePath("/master-data/buyers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function createBrandFromForm(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = createBrandSchema.safeParse({
    buyerId: formData.get("buyerId"),
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await createBrand(actor, parsed.data);
    revalidatePath("/master-data/buyers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateBuyerFromForm(
  id: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = updateBuyerSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await updateBuyer(actor, id, parsed.data);
    revalidatePath("/master-data/buyers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateBrandFromForm(
  id: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = updateBrandSchema.safeParse({
    buyerId: formData.get("buyerId"),
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await updateBrand(actor, id, parsed.data);
    revalidatePath("/master-data/buyers");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
