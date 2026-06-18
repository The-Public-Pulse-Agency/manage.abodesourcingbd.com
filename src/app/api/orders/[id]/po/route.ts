import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { buildPoWorkbook } from "@/lib/documents/po-excel";

export const runtime = "nodejs";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  if (!can(actor, "orders", "view")) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const doc = await buildPoWorkbook(actor, id);
  if (!doc) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(doc.buffer), {
    headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="${doc.filename}"` },
  });
}
