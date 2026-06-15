"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { markReadAction, markAllReadAction } from "@/lib/notifications/form-actions";

export type NotificationRow = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string; // ISO
};

const TYPE_LABEL: Record<string, string> = {
  MILESTONE_OVERDUE: "Overdue",
  EX_FACTORY_SOON: "Ex-factory",
  DOC_MISSING: "Docs",
  PAYMENT_OVERDUE: "Payment",
  SAMPLE_PENDING: "Sample",
};

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationsList({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const hasUnread = items.some((i) => !i.read);

  return (
    <div className="overflow-hidden rounded-sm border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Notifications</h3>
        {hasUnread && (
          <button
            type="button"
            onClick={async () => {
              await markAllReadAction();
              router.refresh();
            }}
            className="text-xs text-ink-soft hover:text-accent"
          >
            Mark all read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-soft">No notifications.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((n) => {
            const body = (
              <div className="flex items-start gap-3">
                {!n.read && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                <div className={`flex-1 ${n.read ? "text-ink-soft" : ""}`}>
                  <span className="mr-2 rounded-sm bg-paper px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-ink-soft">
                    {TYPE_LABEL[n.type] ?? n.type}
                  </span>
                  <span className="text-sm">{n.message}</span>
                </div>
                <span className="shrink-0 text-xs text-ink-soft">{ago(n.createdAt)}</span>
              </div>
            );
            return (
              <li key={n.id} className={`px-4 py-3 ${n.read ? "" : "bg-paper/40"}`}>
                {n.link ? (
                  <Link
                    href={n.link}
                    onClick={() => {
                      if (!n.read) markReadAction(n.id);
                    }}
                    className="block hover:opacity-80"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
