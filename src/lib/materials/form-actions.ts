"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { addMaterial, receiveMaterial, removeMaterial, updateMaterial, type MaterialUpdateInput } from "./materials";

export type ActionResult = { error?: string };

const parseDate = (v: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

async function runUpdate(id: string, patch: MaterialUpdateInput): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateMaterial(actor, id, patch);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update material" };
  }
}

export async function setMaterialDescription(id: string, value: string): Promise<ActionResult> {
  return runUpdate(id, { description: value.trim() });
}

export async function setMaterialSupplier(id: string, value: string): Promise<ActionResult> {
  return runUpdate(id, { supplier: value });
}

export async function setMaterialBookedQty(id: string, value: string): Promise<ActionResult> {
  return runUpdate(id, { bookedQty: value.trim() === "" ? null : Number(value) });
}

export async function setMaterialUnit(id: string, value: string): Promise<ActionResult> {
  return runUpdate(id, { unit: value });
}

export async function setMaterialBookingRef(id: string, value: string): Promise<ActionResult> {
  return runUpdate(id, { bookingRef: value });
}

export async function setMaterialEta(id: string, value: string): Promise<ActionResult> {
  return runUpdate(id, { etaDate: parseDate(value) });
}

export async function addMaterialAction(poId: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await addMaterial(actor, {
      poId,
      kind: String(fd.get("kind") ?? "FABRIC") as "FABRIC" | "TRIM" | "ACCESSORY",
      description: String(fd.get("description") ?? ""),
      supplier: String(fd.get("supplier") || "") || undefined,
      bookedQty: fd.get("bookedQty") ? Number(fd.get("bookedQty")) : undefined,
      unit: String(fd.get("unit") || "") || undefined,
      bookingRef: String(fd.get("bookingRef") || "") || undefined,
      etaDate: String(fd.get("etaDate") || "") || undefined,
    });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add material" };
  }
}

export async function receiveMaterialAction(id: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await receiveMaterial(actor, id, {
      receivedQty: Number(fd.get("receivedQty")) || 0,
      receivedDate: fd.get("receivedDate") ? new Date(String(fd.get("receivedDate"))) : undefined,
    });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to record receipt" };
  }
}

export async function removeMaterialAction(id: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await removeMaterial(actor, id);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove" };
  }
}
