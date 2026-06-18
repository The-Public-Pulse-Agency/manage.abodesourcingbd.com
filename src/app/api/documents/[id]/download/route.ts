import { get } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth/guard";
import { getDocument } from "@/lib/documents/documents";

export const runtime = "nodejs";

/**
 * Tenant-gated document download. Streams a PRIVATE blob (uploaded files) only after verifying
 * the actor may view the parent Document; redirects to an external link for URL-only docs.
 * Sensitive trade docs are never served from a world-readable blob URL.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  let doc;
  try {
    doc = await getDocument(actor, id);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  if (!doc) return new Response("Not found", { status: 404 });

  if (doc.storageKey) {
    try {
      const blob = await get(doc.storageKey, { access: "private" });
      if (!blob) return new Response("File unavailable", { status: 404 });
      const contentType = blob.headers.get("content-type") ?? "application/octet-stream";
      const safe = doc.fileName.replace(/[^A-Za-z0-9._ -]/g, "_");
      return new Response(blob.stream, {
        headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${safe}"` },
      });
    } catch {
      return new Response("File unavailable", { status: 502 });
    }
  }

  if (doc.fileUrl && /^https?:\/\//i.test(doc.fileUrl)) {
    return Response.redirect(doc.fileUrl, 302);
  }
  return new Response("No file", { status: 404 });
}
