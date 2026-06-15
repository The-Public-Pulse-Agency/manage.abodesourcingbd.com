"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import {
  createForwarder,
  createForwarderSchema,
  updateForwarder,
  updateForwarderSchema,
} from "./logistics";

export async function createForwarderFromForm(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = createForwarderSchema.safeParse({
    name: formData.get("name"),
    contact: formData.get("contact") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await createForwarder(actor, parsed.data);
    revalidatePath("/master-data/forwarders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateForwarderFromForm(
  id: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = updateForwarderSchema.safeParse({
    name: formData.get("name"),
    contact: formData.get("contact") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await updateForwarder(actor, id, parsed.data);
    revalidatePath("/master-data/forwarders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
