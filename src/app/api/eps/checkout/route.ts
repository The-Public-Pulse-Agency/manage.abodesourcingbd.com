import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guard";
import { startRenewal } from "@/lib/billing/subscription";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const actor = await getCurrentUser();
  if (!actor) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (actor.role !== "ADMIN") return Response.json({ error: "Only an admin can pay the subscription" }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { email: true } });
  const email = user?.email || "admin@abode.com";

  const res = await startRenewal(actor, email);
  if (!res.ok) {
    return Response.json(
      { error: res.reason, blocked: "blocked" in res ? res.blocked : false },
      { status: "blocked" in res && res.blocked ? 403 : 502 },
    );
  }
  return Response.json({ redirectUrl: res.redirectUrl });
}
