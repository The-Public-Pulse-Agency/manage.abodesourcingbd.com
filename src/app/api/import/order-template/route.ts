import { auth } from "@/auth";
import { buildOrderTemplate } from "@/lib/import/orders-excel";

/** Downloadable demo Excel template for the order importer (auth-gated). */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const buf = await buildOrderTemplate();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="pulse-oms-order-template.xlsx"',
    },
  });
}
