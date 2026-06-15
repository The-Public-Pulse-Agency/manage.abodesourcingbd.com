import { generateAlerts } from "@/lib/alerts/generate";
import { isAuthorized } from "@/lib/alerts/cron-auth";

// Never cache: this endpoint mutates state and must run on every scheduled call.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET is not set — refusing to run the alert job");
    return Response.json({ error: "cron not configured" }, { status: 503, headers: NO_STORE });
  }
  if (!isAuthorized(req.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const { created } = await generateAlerts({ now: new Date() });
  return Response.json({ ok: true, created }, { headers: NO_STORE });
}

export const GET = handle;
export const POST = handle;
