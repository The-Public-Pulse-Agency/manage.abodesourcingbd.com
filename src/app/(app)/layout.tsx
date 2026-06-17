import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { unreadCount } from "@/lib/notifications/notifications";
import { getSubscription, isActive } from "@/lib/billing/subscription";
import { SubscriptionPaywall } from "@/components/billing/subscription-paywall";
import { formatDate } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // The platform SUPERADMIN doesn't belong to a tenant — send them to the console.
  if (session.user.role === "SUPERADMIN") redirect("/admin");

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
  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      <AppSidebar
        role={session.user.role}
        name={session.user.name ?? session.user.email ?? ""}
        unread={unread}
      />
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div key="content" className="page-enter mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
