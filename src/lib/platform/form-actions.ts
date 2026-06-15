"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createPackage, updatePackage } from "./packages";
import { setCompanyStatus, setCompanyPackage } from "./companies";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createPackageAction(fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await createPackage(actor, {
      name: String(fd.get("name") ?? ""),
      priceBdt: Number(fd.get("priceBdt")) || 0,
      periodDays: Number(fd.get("periodDays")) || 30,
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add package" };
  }
}

export async function updatePackageAction(
  id: string,
  input: { name?: string; priceBdt?: number; periodDays?: number; active?: boolean },
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await updatePackage(actor, id, input);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update package" };
  }
}

export async function setCompanyStatusAction(id: string, status: "ACTIVE" | "SUSPENDED"): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await setCompanyStatus(actor, id, status);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function setCompanyPackageAction(id: string, packageId: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await setCompanyPackage(actor, id, packageId || null);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
