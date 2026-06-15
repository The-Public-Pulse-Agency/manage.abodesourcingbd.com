import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { getSubscription, isActive, daysLeft, listSubscriptionPayments } from "@/lib/billing/subscription";
import { isPaymentBlocked, epsConfigured } from "@/lib/eps";
import { RenewButton } from "@/components/billing/renew-button";
import { PlanForm } from "./plan-form";
import { formatDate } from "@/lib/format";

const RESULT_MSG: Record<string, { text: string; tone: string }> = {
  success: { text: "Payment received — subscription renewed. Thank you!", tone: "bg-ok-soft text-ok" },
  fail: { text: "Payment did not complete. Please try again.", tone: "bg-bad-soft text-bad" },
  cancel: { text: "Payment was cancelled.", tone: "bg-warn-soft text-warn" },
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  const isAdmin = actor.role === "ADMIN";

  const now = new Date();
  const [sub, payments, sp] = await Promise.all([getSubscription({ now }), listSubscriptionPayments(), searchParams]);
  const active = isActive(sub, now);
  const left = daysLeft(sub, now);
  const banner = sp.result ? RESULT_MSG[sp.result] : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Account</p>
        <h1 className="text-2xl font-semibold tracking-tight">Billing &amp; Subscription</h1>
      </div>

      {banner && <div className={`rounded-sm px-4 py-2 text-sm ${banner.tone}`}>{banner.text}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-line bg-surface p-4 elevate">
          <p className="eyebrow">Status</p>
          <p className={`mt-1 text-xl font-semibold ${active ? "text-ok" : "text-bad"}`}>
            {active ? "Active" : "Expired"}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {active ? `${left} day${left === 1 ? "" : "s"} left` : "Renew to restore access"}
          </p>
        </div>
        <div className="rounded-md border border-line bg-surface p-4 elevate">
          <p className="eyebrow">Renews / expires</p>
          <p className="tnum mt-1 text-xl font-semibold">{formatDate(sub.currentPeriodEnd)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">Last paid: {sub.lastPaymentAt ? formatDate(sub.lastPaymentAt) : "—"}</p>
        </div>
        <div className="rounded-md border border-line bg-surface p-4 elevate">
          <p className="eyebrow">Fee</p>
          <p className="tnum mt-1 text-xl font-semibold">
            ৳{sub.amountBdt.toLocaleString()}
            <span className="text-xs font-normal text-ink-soft"> / {sub.periodDays} days</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">{sub.planName}</p>
        </div>
      </div>

      <div className="rounded-md border border-line bg-surface p-4 elevate">
        <p className="text-sm">{sub.planNotes}</p>
        {isAdmin && (
          <div className="mt-3">
            <RenewButton amountBdt={sub.amountBdt} label={active ? `Renew early — pay ৳${sub.amountBdt.toLocaleString()} with EPS` : undefined} />
            {(isPaymentBlocked() || !epsConfigured()) && (
              <p className="mt-2 text-xs text-warn">
                {isPaymentBlocked()
                  ? "Payments are disabled in this environment (STAGING_PAYMENT_BLOCK=1)."
                  : "EPS credentials are not configured yet."}{" "}
                Set them in the hosting env to enable live payments.
              </p>
            )}
          </div>
        )}
      </div>

      {isAdmin && (
        <PlanForm amountBdt={sub.amountBdt} periodDays={sub.periodDays} planName={sub.planName} planNotes={sub.planNotes} minMarginPct={sub.minMarginPct} />
      )}

      <div className="overflow-hidden rounded-md border border-line bg-surface elevate">
        <div className="border-b border-line bg-paper px-4 py-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Payment history</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-1.5 font-semibold">Order</th>
              <th className="px-3 py-1.5 text-right font-semibold">Amount</th>
              <th className="px-3 py-1.5 font-semibold">Status</th>
              <th className="px-3 py-1.5 font-semibold">Date</th>
              <th className="px-3 py-1.5 font-semibold">EPS ref</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-soft">No payments yet.</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5 font-mono text-xs">{p.orderId}</td>
                <td className="px-3 py-1.5 text-right tnum">৳{p.amountBdt.toLocaleString()}</td>
                <td className="px-3 py-1.5">
                  <span className="rounded-sm bg-paper px-2 py-0.5 text-[0.6875rem] font-semibold uppercase">{p.status}</span>
                </td>
                <td className="px-3 py-1.5 tnum text-xs">{formatDate(p.paidAt ?? p.createdAt)}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-ink-soft">{p.epsRef ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
