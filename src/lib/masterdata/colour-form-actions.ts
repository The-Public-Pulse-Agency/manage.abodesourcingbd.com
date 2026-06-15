"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createColour, createColourSchema } from "./sizescale";

export async function createColourFromForm(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = createColourSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await createColour(actor, parsed.data);
    revalidatePath("/master-data/colours");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
