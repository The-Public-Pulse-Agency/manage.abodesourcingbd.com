"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createStyle, createStyleSchema } from "./style";

export async function createStyleFromForm(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = createStyleSchema.safeParse({
    brandId: formData.get("brandId"),
    styleCode: formData.get("styleCode"),
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    composition: formData.get("composition") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await createStyle(actor, parsed.data);
    revalidatePath("/master-data/styles");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
