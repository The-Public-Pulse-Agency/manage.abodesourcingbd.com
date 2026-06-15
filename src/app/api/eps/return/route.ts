import { settleRenewal } from "@/lib/billing/subscription";
import { appUrl } from "@/lib/eps";

export const dynamic = "force-dynamic";

// EPS redirects the user here after the hosted checkout. We re-verify with EPS
// (authoritative) and settle idempotently, then route back to /billing.
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const order = url.searchParams.get("order") || "";
  const claimed = url.searchParams.get("status");

  let result: "success" | "fail" | "cancel" = "cancel";
  if (order && claimed === "success") {
    const s = await settleRenewal(order).catch(() => "blocked" as const);
    result = s === "paid" || s === "already-paid" ? "success" : "fail";
  }
  return Response.redirect(appUrl(`/billing?result=${result}`), 302);
}
