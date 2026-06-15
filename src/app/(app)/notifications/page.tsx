import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { listNotifications } from "@/lib/notifications/notifications";
import { NotificationsList, type NotificationRow } from "@/components/notifications-list";

export default async function NotificationsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const items = await listNotifications(actor);
  const rows: NotificationRow[] = items.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Alerts</p>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      </div>
      <NotificationsList items={rows} />
    </div>
  );
}
