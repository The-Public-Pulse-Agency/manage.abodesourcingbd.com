"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { createDocument, createDocumentSchema, type DocumentEntityType } from "./documents";

export type ActionResult = { error?: string };

export async function createDocumentAction(
  entityType: DocumentEntityType,
  entityId: string,
  fd: FormData,
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  const parsed = createDocumentSchema.safeParse({
    entityType,
    entityId,
    type: fd.get("type"),
    fileName: fd.get("fileName"),
    fileUrl: fd.get("fileUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await createDocument(actor, parsed.data);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add document" };
  }
}
