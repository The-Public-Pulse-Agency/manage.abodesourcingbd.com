"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth/guard";
import { createDocument, type DocumentEntityType } from "./documents";

type Res = { error?: string };

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Upload an actual file (PDF/image) for a shipment or order, store it in Vercel Blob, and
 * record a Document pointing at the returned URL. Requires Blob to be enabled on the project
 * (BLOB_READ_WRITE_TOKEN); fails with a clear message otherwise.
 */
export async function uploadDocumentAction(entityType: DocumentEntityType, entityId: string, fd: FormData): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };

  const file = fd.get("file");
  const type = String(fd.get("type") ?? "OTHER");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload" };
  if (file.size > MAX_BYTES) return { error: "File too large (max 15 MB)" };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { error: "File storage isn't enabled yet — turn on Blob storage in the Vercel project, then retry." };
  }

  try {
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_") || "document";
    const blob = await put(`${entityType}/${entityId}/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || undefined,
    });
    await createDocument(actor, { entityType, entityId, type: type as never, fileName: file.name, fileUrl: blob.url });
    revalidatePath(`/${entityType === "Shipment" ? "shipments" : "orders"}/${entityId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed" };
  }
}
