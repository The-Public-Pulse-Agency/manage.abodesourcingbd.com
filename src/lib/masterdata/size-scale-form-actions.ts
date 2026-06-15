"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createSizeScale, createSizeScaleSchema } from "./sizescale";

export async function createSizeScaleFromForm(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const rawSizes = String(formData.get("sizes") ?? "");
  const sizes = rawSizes
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const parsed = createSizeScaleSchema.safeParse({
    name: formData.get("name"),
    sizes,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await createSizeScale(actor, parsed.data);
    revalidatePath("/master-data/size-scales");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
