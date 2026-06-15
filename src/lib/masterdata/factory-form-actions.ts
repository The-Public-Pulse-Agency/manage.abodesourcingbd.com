"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createFactory, createFactorySchema } from "./factory";

export async function createFactoryFromForm(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = createFactorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "KNIT",
    contactName: formData.get("contactName") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await createFactory(actor, parsed.data);
    revalidatePath("/master-data/factories");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
