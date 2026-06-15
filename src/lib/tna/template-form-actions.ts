"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createTemplate, updateTemplate, setTemplateActive } from "./templates";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createTemplateAction(fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await createTemplate(actor, {
      key: String(fd.get("key") ?? ""),
      name: String(fd.get("name") ?? ""),
      stage: String(fd.get("stage") ?? "PRE_PRODUCTION") as "PRE_PRODUCTION" | "SAMPLING" | "PRODUCTION_QC" | "SHIPPING",
      offsetDays: Number(fd.get("offsetDays")) || 0,
      position: Number(fd.get("position")) || 0,
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add milestone" };
  }
}

export async function updateTemplateAction(id: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await updateTemplate(actor, id, {
      name: String(fd.get("name") ?? ""),
      stage: String(fd.get("stage") ?? "PRE_PRODUCTION") as "PRE_PRODUCTION" | "SAMPLING" | "PRODUCTION_QC" | "SHIPPING",
      offsetDays: Number(fd.get("offsetDays")) || 0,
      position: Number(fd.get("position")) || 0,
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update milestone" };
  }
}

export async function toggleTemplateAction(id: string, active: boolean): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  try {
    await setTemplateActive(actor, id, active);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
