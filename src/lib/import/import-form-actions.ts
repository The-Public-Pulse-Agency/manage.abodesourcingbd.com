"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { readMasterDataRows } from "./excel";
import { importMasterData, type ImportSummary } from "./import-actions";

export async function importFromUpload(
  formData: FormData,
): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose an .xlsx file" };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await readMasterDataRows(buffer);
    const summary = await importMasterData(actor, rows);
    revalidatePath("/master-data/factories");
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed" };
  }
}
