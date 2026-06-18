import { RenewButton } from "./renew-button";
import { logoutAction } from "@/lib/auth/actions";

/** Full-screen lock shown when the platform subscription has lapsed. */
export function SubscriptionPaywall({
  planName,
  planNotes,
  amountBdt,
  periodDays,
  expiredOn,
  isAdmin,
  userName,
}: {
  planName: string;
  planNotes: string;
  amountBdt: number;
  periodDays: number;
  expiredOn: string;
  isAdmin: boolean;
  userName: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-lg overflow-x-auto rounded-md border border-line bg-surface elevate-lg">
        <div className="border-b border-line bg-paper px-6 py-4">
          <span className="font-mono text-sm font-bold tracking-tight text-accent">Pulse</span>
          <span className="ml-2 text-sm font-semibold tracking-tight">OMS</span>
        </div>
        <div className="space-y-5 p-6">
          <div>
            <p className="eyebrow text-bad">Subscription expired</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Renew to continue</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Access was paused on <span className="font-medium">{expiredOn}</span>. Renew the platform
              licence to restore full access for the team.
            </p>
          </div>

          <div className="rounded-sm border border-line bg-paper p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{planName}</span>
              <span className="tnum text-lg font-semibold">
                ৳{amountBdt.toLocaleString()}
                <span className="text-xs font-normal text-ink-soft"> / {periodDays} days</span>
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-soft">{planNotes}</p>
          </div>

          {isAdmin ? (
            <RenewButton amountBdt={amountBdt} />
          ) : (
            <p className="rounded-sm bg-warn-soft px-3 py-2 text-sm text-warn">
              Your administrator needs to renew the subscription. Please contact them.
            </p>
          )}

          <div className="flex items-center justify-between border-t border-line pt-4 text-xs text-ink-soft">
            <span>Signed in as {userName}</span>
            <form action={logoutAction}>
              <button type="submit" className="hover:text-accent">Sign out</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
