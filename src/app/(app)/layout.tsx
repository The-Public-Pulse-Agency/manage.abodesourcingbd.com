import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/lib/auth/actions";
import { AppSidebar } from "@/components/app-sidebar";
import { unreadCount } from "@/lib/notifications/notifications";
import { getSubscription, isActive } from "@/lib/billing/subscription";
import { SubscriptionPaywall } from "@/components/billing/subscription-paywall";
import { formatDate } from "@/lib/format";

/** Full-screen "you can no longer use the app" notice with a sign-out escape hatch.
 * Used to enforce DB-side session validity without a redirect loop. */
function AccountBlocked({ message }: { message: string }) {
  return (
    <div className="auth-bg flex min-h-screen items-center justify-center p-6">
      <div className="glass elevate-lg w-full max-w-md rounded-xl p-8 text-center">
        <h1 className="text-lg font-semibold text-ink">Access unavailable</h1>
        <p className="mt-2 text-sm text-ink-soft">{message}</p>
        <form action={logoutAction} className="mt-6">
          <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90">Sign out</button>
        </form>
      </div>
    </div>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // The platform SUPERADMIN doesn't belong to a tenant — send them to the console.
  if (session.user.role === "SUPERADMIN") redirect("/admin");

  // Re-validate the JWT against the DB so deactivation, company suspension, and role
  // changes take effect immediately rather than lingering until the token expires.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, role: true, companyId: true },
  });
  if (!dbUser || !dbUser.active) return <AccountBlocked message="Your account is no longer active. Please contact your administrator." />;
  if (dbUser.role !== session.user.role) return <AccountBlocked message="Your access level has changed. Please sign in again." />;
  if (dbUser.companyId) {
    const company = await prisma.company.findUnique({ where: { id: dbUser.companyId }, select: { status: true } });
    if (company?.status === "SUSPENDED") return <AccountBlocked message="This company's account is suspended. Please contact your administrator." />;
  }

  // Per-company licence gate — when the company's subscription lapses, the app is
  // locked behind a renewal screen. Off by default (BILLING_ENABLED!="1") so trials
  // never lock anyone out until payments are switched on.
  const companyId = session.user.companyId;
  const billingOn = process.env.BILLING_ENABLED === "1";
  const sub = billingOn && companyId ? await getSubscription(companyId) : null;
  if (sub && !isActive(sub)) {
    return (
      <SubscriptionPaywall
        planName={sub.planName}
        planNotes={sub.planNotes}
        amountBdt={sub.amountBdt}
        periodDays={sub.periodDays}
        expiredOn={formatDate(sub.currentPeriodEnd)}
        isAdmin={session.user.role === "ADMIN"}
        userName={session.user.name ?? session.user.email ?? ""}
      />
    );
  }

  const unread = await unreadCount({ id: session.user.id, role: session.user.role });
  const { resolvePermissions } = await import("@/lib/auth/roles");
  const permissions = await resolvePermissions(companyId ?? null, session.user.role);
  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      <AppSidebar
        role={session.user.role}
        permissions={permissions}
        name={session.user.name ?? session.user.email ?? ""}
        unread={unread}
      />
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div key="content" className="page-enter mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
